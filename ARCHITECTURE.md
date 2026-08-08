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
- **Music** — the same triple, the same dormancy (`LUNA_MUSIC=1`, darwin, `media-control` present).
  The official NeteaseMusic.app plays; Luna **observes** the system-wide Now Playing record from
  outside (macOS MediaRemote, vendored `packages/music-cli` — its adapter/library/lyrics modules are
  each the ONLY file that knows the corresponding external format, everything else consumes the
  `types.ts` contracts). Surfaces as tools, as ambient context, as a rate-limited track-change
  moment, and as the session page's player card.

  Two locked decisions (2026-08, owner):
  1. **Observe, never wrap.** The community NetEase API keystone (`Binaryify/NeteaseCloudMusicApi`,
     30.3k★, the de-facto standard) was archived 2024-02-28; `go-musicfox` is a pure TUI with no
     scriptable command surface. External observation means zero reverse-engineering, zero DRM,
     zero account credentials — and Apple Music / Spotify / browser playback compatible for free.
  2. **Luna does not DJ — "Route 2" (Luna picks the songs) evaluated and REJECTED.** The official
     client cannot be commanded to play a given track: `orpheus://` is a CEF-internal resource
     protocol with no playback route, and there is no AppleScript `.sdef`. The only viable path is
     a self-hosted player (mpv) fed by unofficial audio-URL APIs, measured against the owner's own
     library (1411 tracks): **92% is VIP-gated** (fee=1: 47%, fee=8 hi-fi-needs-VIP: 45%);
     unauthenticated playback covers ~6% at 64kbps; authenticating exposes the owner's VIP account
     to platform risk control. Not worth it — shelved. To ever reopen: first verify a logged-in VIP
     audio path end-to-end via `go-musicfox`, then talk. Transport commands (play/pause/next/prev)
     stay — that is acting on the owner's request, not choosing for them.

## The front end (`web`)

A framework-free TypeScript app.

- **`wsClient.ts` / `controller.ts` / `app.ts`** — the socket client, the turn/state controller, and the
  top-level wiring.
- **`live2d/`** — the avatar: a PIXI + Live2D Cubism renderer, an expression/pose mapper, gaze-follow, and
  a lip-sync engine that drives the mouth parameter from audio. (The Live2D Cubism Core runtime is
  proprietary and vendored as a pre-built file — see [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES).)

  The face is a **layered per-frame engine**, not a preset switcher. `FaceVm` composes, in order:
  procedural **idle** (five selectable profiles) → coarse **state bias** (neutral/thinking/speaking/
  sleeping) → the **mood undertone** → the **emotion clip** (intro→perform→outro) → the **thaw** →
  **actions** → smoothing → per-channel gain and clamp, writing 35 named channels to raw Cubism
  parameter ids. Each layer skips the channels an upper layer *owns*, which is how lip-sync keeps the
  mouth and gaze-follow keeps the eyes without any layer knowing about the others.

  The mood undertone is the continuous half (Initiative 29). An affect arriving on the wire is an
  **impulse** into a 3-axis VAD field (`affect.ts`), not a selection: a fast `current` chases a
  slowly-decaying `target`, so a mood *outlives the clip that announced it* instead of snapping back
  to neutral. `affectPose.ts` projects that field onto the channels as a small additive offset and
  — the part that makes it a mood rather than a tint — also moves the **resting pose itself**, so "at
  rest" means "at rest in this mood". Arousal modulates the smoothing rate, and a bounded ambient
  wander keeps a settled state from reading as frozen. `luna:affect = '0'` opts out.

  Ownership is exclusive, which used to mean a playing clip froze the face solid for its whole perform
  window. The **thaw** (Initiative 30) breaks that without surrendering ownership: a fraction of the
  idle's deviation from rest, plus a small per-channel out-of-phase wobble scaled by how far the clip
  pushed that channel, is added *on top of* the authored pose. Peaks keep their shape and breathe.
  Three rules keep the layers from fighting over the same parameters, and they are worth stating
  because none of them is guessable from the code alone:

  - **Eyelids belong to the built-in blink.** `FaceVm` writes after Cubism's `CubismEyeBlink`, so any
    *persistent* layer that touches `eyeOpen` silently deletes blinking. Persistent layers must never;
    a time-bounded clip or gesture may, and must release. A clip can also decline its eyelids by
    declaring them in `physicsPassthrough`.
  - **Head and body are physics inputs**, written in a separate pre-physics pass (`flushPose`), and
    the built-in breath already moves them — so the thaw deliberately leaves them alone.
  - **Smoothing is an exponential approach over real elapsed time**, with per-organ speeds (eyes and
    mouth settle fast, posture slowly) and a dt clamp so a backgrounded tab cannot teleport the face.

  The affect→clip lookup is intensity-branched: the wire's optional 0–1 `emotion` selects between a
  mild and an escalated performance, which is what makes all fourteen authored clips reachable from
  fifteen affects. Left alone, she plays one of nine authored gestures every 8–20 s, drawn with
  mood-weighted probability and only while nothing else is performing.

  **Speech and listening** are the other half of a conversation — the stretches where she is waiting
  or talking rather than reacting. Three sources feed one mechanism:

  - **Attention** while the user types is a *level*, not an event: a small head-and-body bias held
    while there is input and released on a debounce, so per-keystroke jitter is impossible rather
    than merely tuned away. While she is `thinking` the gesture scheduler swaps to a denser pool
    (3.5–8 s) of retrieval and deliberation gestures.
  - **Stress**, from the audio. `LipSyncFrame.open` is already a per-frame energy envelope; a rolling
    baseline over it detects the peaks, and each becomes a 1–3° nod. Because head pitch is written in
    the pre-physics pass, her hair follows for free.
  - **Sentence shape**, from the text. A sentence's final punctuation maps to a gesture, timed
    against the serial speech queue: emphasis on the audio's start, a question's tilt on its
    resolution — where the rise actually is. There is no pitch tracking, so this is the honest
    approximation, and it is deliberately a second, independent signal rather than an extension of
    the first.

  All three are **additive pulses** — a pose plus a duration, sampled under a half-sine so they leave
  no residue — and all three obey the three arbitration rules above unchanged. The browser fallback
  voice publishes no envelope, so the stress layer stays silent there rather than faking a
  performance. `luna:listening` and `luna:speech-performance` opt out.

  A `?workbench=1` URL mode mounts the *same* renderer with every affect, clip, state, idle profile,
  gesture, drawn asset and flag on a button, plus a 35-channel pose composer that exports a
  paste-ready clip definition. It is deliberately not a second app: a bench with its own renderer
  would let a face be tuned that the app then performs differently.
- **`audio/`** + **`sinks.ts`** — TTS playback with a serial speech queue (one utterance finishes before
  the next starts) and pluggable audio sinks; a text-only degrade path keeps working when no voice
  backend is configured.
- **`ui/`** — the chat surface, speech bubbles, the collapsible companion layout, and the settings
  workspace.

No avatar model or voice weights ship in this repo. The front end renders a friendly empty state until a
Live2D model is installed; voice is bring-your-own. See [`.env.example`](.env.example) for the
configuration surface.

## The front door (v0.44.x)

Opening the app lands on a **main menu**, not mid-conversation: she sleeps on the right (a pure
front-end state — the backend is not connected), and Talk / Diary / Skills / Dream / Settings / Quit
float on the left. Boot is two halves: the lobby half runs immediately (layout, the Live2D sink, the
menu), and the session half — the WS client, controller, voice, geolocation — is `activateSession()`,
which in menu mode does not run until Talk. The menu is therefore **cold by construction**: every
proactive pathway rides the socket that was never built. Pet, agent-only, `?setup`, `?workbench` and
`luna:menu='0'` boot directly, byte-identical to the pre-menu app.

**Talk wakes her in place** (she belongs to no page): the menu overlays the chat panel's own grid
slot, so the swap changes the room around a girl who never moves, while a four-beat wake sequence
plays over existing engine layers and the TTS warms underneath the animation instead of behind a
gate. While the menu is up the canvas itself spans the whole stage (`.menu-wide`, v0.44.8) so a
zoomed model is cropped only by the window, never by an interior slot edge — a frame rect
(`Live2DSink.setFrame`) keeps her base position exactly where the session slot puts her, and the
re-clip at Talk lands under the chat panel's fade-in. ← Menu disconnects politely — mid-turn it waits for the turn (and proactive-turn) end. Dream
connects and enters the dream without waking her first; the skipped wake plays when the dream ends.

**Diary, Skills, Settings are pages over the read-only data surface** (`/api/data/*` — product HTTP,
loopback-bounded, zod-guarded at both ends, forwarded same-origin by the desktop's allowlist).
Reading her diary cannot wake her because the book is HTTP and the session is WS. The diary is a
two-page book (lit-days-only calendar, a spine page-turn, dreams translated from the consolidation
pipeline into what she did that night); Skills is a growth record (self-taught marked); Settings is
seven categories over ADOPTED live rows plus the module cards (whitelisted env merge, restart to
apply) and the persona editor (fixed core owner-editable behind a diff preview; evolving read-only;
her self-edit tool still cannot touch fixed).

Motion holds two bands (audited by test): stage moments 1.5–2s built from orchestrated phases, micro
feedback ~0.3s; `prefers-reduced-motion` collapses stages to a 0.2s fade with every destination
still reachable.

## The desktop shell (`desktop`)

An Electron app that packages the built web front end, spawns and supervises the server process, resolves
paths and config for a packaged bundle, and adds native touches: a draggable desktop "pet" window, native
location acquisition, a first-run onboarding, and a packaged-app smoke check.

## Configuration

Everything is env-driven; see [`.env.example`](.env.example) for the full, documented surface. The only
required value to get a text-only Luna running is an Anthropic (or OpenAI-compatible gateway) API key.
Feature-gate flags default to sensible values, and risky subsystems ship behind a default-off flag so a
new feature can be enabled deliberately.
