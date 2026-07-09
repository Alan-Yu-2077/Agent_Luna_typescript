# Architecture

Luna is a companion agent: an LLM brain with persistent memory, proactive agency, action-integrity
rails, a code-agent capability, and an embodied front end (a Live2D avatar with voice and lip-sync).
This document is the structural map — what the pieces are and how they fit. It intentionally carries no
per-version history; see [`ROADMAP.md`](ROADMAP.md) for direction.

## Monorepo layout

A Bun workspace with four packages. The dependency arrow points one way: `server` and `web` both depend
on `protocol`; nothing depends on `server` or `web`; `desktop` wraps the built `web` + spawns `server`.

```
packages/
├── protocol/   ← the shared wire contract: Zod schemas + inferred TS types
├── server/     ← the agent brain: Bun + WebSocket runtime, memory, tools, proactive
├── web/        ← the browser front end: Live2D avatar, audio, lip-sync, chat UI
└── desktop/    ← an Electron shell that hosts the web build and supervises the server
```

- **`protocol`** is the single source of truth for everything that crosses the socket.
  `events.ts` defines the `ClientEvent` / `ServerEvent` discriminated unions; `tools.ts`, `memory.ts`,
  `message.ts`, and `trace.ts` define the payload shapes. Both `server` and `web` import the *same*
  types, so a wire change that isn't reflected on both sides is a compile error rather than a silent
  runtime drift.
- **`server`** owns all state and all model calls. It never trusts the client for anything but intent.
- **`web`** is a thin, reactive view: it renders what the server streams and sends user intent back.
- **`desktop`** is optional. Everything runs in a browser against the server; the Electron shell adds a
  native window, a desktop "pet" mode, and OS integration (e.g. native location).

## The socket contract (`protocol`)

Communication is a single WebSocket carrying discriminated-union events, validated at the boundary with
Zod. The server emits fine-grained streaming events (turn lifecycle, per-token reply text, tool
lifecycle, memory/trace updates) rather than one buffered response — so the UI reflects thinking, tool
progress, and reply text as they happen. Tool use in particular is streamed: `tool.started` /
`tool.progress` / `tool.finished` events fire as the provider stream yields them, never buffered to the
end of the turn.

## The server brain (`server`)

- **`main.ts`** — process entry: reads env/config, opens the SQLite DB, constructs the provider, mounts
  the tool registry, and starts the WS server (`ws.ts`).
- **`provider/`** — the model seam. A `Provider` interface (`chatStream` / `complete` +
  a `capabilities` descriptor) with an Anthropic implementation and an OpenAI-Chat-Completions
  implementation, selected by env through a small factory. The rest of the server is provider-agnostic.
- **`turn/`** — a turn is the unit of work: assemble the prompt (system core + memory recall + perception
  context + rolling history), stream the model, dispatch any tool calls, enforce the action-integrity
  rails, and persist the result. Perception context (time, weather) is injected here.
- **`tools/`** — the capability surface (see below).
- **`memory/`** — the three-layer store + recall (see below).
- **`dream/`** — offline consolidation (see below).
- **`proactive/`** — the agency rails (see below).
- **`skills/`** — procedural memory: a shelf of distilled how-to skills the agent can save and recall.
- **`code/`** — the code-agent capability (repo map, symbol search, edits) with capability gates.
- **`persona/`** — the persona/embodiment/humanity prompt blocks.
- **`settings/`** — a typed settings registry backed by a SQLite `settings` table, surfaced in a
  workspace UI; a pinned setting can override an env default at boot.
- **`trace/`** + **`sql.ts`** — a per-turn trace store for observability, and the SQLite helpers.

### Tool registry & concurrency model

Tools are declared with a `defineTool` helper that pairs a Zod input schema with an async-generator
`execute` (so a tool can stream progress) and metadata: a `concurrency` policy, a `summarize` for
history compaction, a `timeoutMs`, and a `proactiveRisk` marker. A dispatcher runs the tool calls a turn
requests, honoring each tool's concurrency policy — this is load-bearing for correctness: a tool marked
parallel-safe must not mutate shared state. Read-only tools (e.g. weather, web fetch) are `safe`; tools
that write are gated and, where sensitive (self-edit), human-gated. Capability gates (`LUNA_CODE_WRITE`,
`LUNA_SHELL`, `LUNA_SELF_EDIT`, `LUNA_SKILLS`, …) unmount whole tool groups from the prompt.

### Three-layer memory + recall

Memory is a single SQLite database with three layers:

- **L1 — the rolling window.** Recent turns kept verbatim, oldest folded into a compact rolling digest as
  the window fills. This is the working context.
- **L2 — durable turns.** Every persisted exchange, with salience scoring, so older material can be
  recalled on demand rather than kept hot.
- **L3 — facts.** Structured long-lived memory (core facts, preferences, key moments, active threads,
  project context), plus a **soul file** (a fixed owner-editable core + a Luna-evolving section) that
  carries identity across sessions.

**Recall** is hybrid: a lexical pass plus embedding cosine similarity, blended with recency and salience
weights. The vector path uses the `sqlite-vec` extension when an extension-capable SQLite is available
(`LUNA_SQLITE_LIB` overrides the probe); when it isn't, recall degrades to a pure-TS cosine fallback so
the system still works everywhere. Recall can run off the time-to-first-token path so it never blocks the
reply.

### Dream consolidation (`dream`)

Between conversations (and on a graceful shutdown), Luna "dreams": an offline pass that scores salience,
writes diary entries, consolidates L2→L3 facts, updates the persona/soul, and distills skills. Dream work
runs on its own model key so it never competes with the live reply's quota, and is cooldown-gated so it
doesn't fire on every close.

### Proactive agency (`proactive`)

Luna can speak first. Two rails share one turn machinery:

- **The silence ladder** — as user silence grows, a laddered set of deterministic detectors (scheduled
  openings, weather shifts, aged open threads, unkept promises) may fire a proactive turn, subject to
  quiet hours, a daily quota, cooldowns, and per-trigger debounce.
- **Self-continuation** — shortly after a reply, Luna may micro-wake to continue her own thought.

Both are heavily rail-guarded (idle floors, intervals, budgets) so agency never becomes interruption.

### Perception (`turn` + `tools/web/weather`)

- **Time** — passive injection of now / elapsed-gap / daypart into the uncached tail of the prompt, plus
  relative-time labels on recalled memories and a subjective daypart mood.
- **Weather** — a pluggable provider (Open-Meteo keyless by default, or QWeather with a key) gated on a
  resolved location (`LUNA_LAT_LON`). Surfaces as a tool, as ambient context, and as a proactive
  weather-shift detector — all dormant until a location is configured.

## The front end (`web`)

A framework-free TypeScript app.

- **`wsClient.ts` / `controller.ts` / `app.ts`** — the socket client, the turn/state controller, and the
  top-level wiring.
- **`live2d/`** — the avatar: a PIXI + Live2D Cubism renderer, an expression/pose mapper, gaze-follow, and
  a lip-sync engine that drives the mouth parameter from audio. (The Live2D Cubism Core runtime is
  proprietary and vendored as a pre-built file — see [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES).)
- **`audio/`** + **`sinks.ts`** — TTS playback with a serial speech queue (one utterance finishes before
  the next starts) and pluggable audio sinks; a text-only degrade path keeps working when no voice
  backend is configured.
- **`ui/`** — the chat surface, speech bubbles, the collapsible companion layout, and the settings
  workspace.

No avatar model or voice weights ship in this repo. The front end renders a friendly empty state until a
Live2D model is installed; voice is bring-your-own. See [`.env.example`](.env.example) for the
configuration surface.

## The desktop shell (`desktop`)

An Electron app that packages the built web front end, spawns and supervises the server process, resolves
paths and config for a packaged bundle, and adds native touches: a draggable desktop "pet" window, native
location acquisition, a first-run onboarding, and a packaged-app smoke check.

## Configuration

Everything is env-driven; see [`.env.example`](.env.example) for the full, documented surface. The only
required value to get a text-only Luna running is an Anthropic (or OpenAI-compatible gateway) API key.
Feature-gate flags default to sensible values, and risky subsystems ship behind a default-off flag so a
new feature can be enabled deliberately.
