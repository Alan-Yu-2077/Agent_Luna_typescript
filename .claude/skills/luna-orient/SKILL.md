---
name: luna-orient
description: Ground-truth project map for Luna (TypeScript). Invoke at the start of any non-trivial task in this repo (or via /luna-orient) before searching the tree blindly. Loads the package layout, the load-bearing invariants, the current shipped version, and where code-truth lives vs documentation-truth.
---

# Luna — Orientation

Run this before any non-trivial change. It tells you what the project is, where things live, what the
current version is, and which invariants a change must not break.

Do not rely on memory or on a prior conversation — re-orient at the start of a new task so the shipped
version and the invariants are fresh.

---

## Step 1 — Read the map

Read these, in order. They are short.

| File | What it gives you |
|---|---|
| `ARCHITECTURE.md` | The structural map: packages, the wire contract, memory, tools, proactive rails, perception, front end |
| `CONTRIBUTING.md` | The invariants + code standards + commit/version conventions |
| `docs/history/DEVELOPMENT.md` | **Truth source for "what version are we on"** and how each area evolved |
| `ROADMAP.md` | Direction, by theme (a plan, not a contract) |

If a `docs/roadmap/` folder exists, it holds staged, executable version plans — check it before planning
new work, so you don't collide with a reserved version number.

## Step 2 — Extract the current state

From `docs/history/DEVELOPMENT.md`:

- the **last row of the Version Index table** → the current shipped version
- the detailed section for that version → what just landed and why

You will need the version number to propose the next one.

## Step 3 — Know the package layout

```
packages/
├── protocol/   ← shared Zod schemas + inferred types: THE wire contract
├── server/     ← Bun + WebSocket runtime (turn engine, memory, tools, dream, proactive)
├── web/        ← browser front end (Live2D avatar, audio, chat UI)
└── desktop/    ← Electron shell (native window, desktop pet, model picker)
```

Dependency direction: `server` and `web` both depend on `protocol`. Nothing depends on `server` or
`web`. `desktop` wraps the built `web` and supervises `server`.

Inside `packages/server/src/`:

| Dir | Owns |
|---|---|
| `provider/` | The model seam (`chatStream` / `complete` + a capabilities descriptor); Anthropic + OpenAI-compatible impls behind a factory |
| `turn/` | A turn: assemble prompt → stream → dispatch tools → integrity rails → persist. Perception (time/weather) is injected here |
| `tools/` | `defineTool` declarations + the dispatcher (concurrency policy lives here) |
| `memory/` | Three-layer store (L1 window / L2 turns / L3 facts) + hybrid recall |
| `dream/` | Offline consolidation: salience, diaries, L2→L3, persona/soul, skill distillation |
| `proactive/` | The silence ladder + self-continuation rails |
| `skills/` | Procedural memory — save/recall distilled how-to skills |
| `code/` | The code-agent capability (repo map, symbol search, gated edits) |
| `settings/` | Typed settings registry over a SQLite `settings` table |
| `trace/`, `sql.ts` | Per-turn trace store + SQLite helpers |

## Step 4 — Load the caution points

These are the places where a well-meaning change quietly breaks the system. `CONTRIBUTING.md` states
them normatively; internalize them before you edit:

1. **`packages/protocol/src/events.ts` is the single source of truth for the socket.** A new
   `ServerEvent` variant without its consumer is silent drift. Change both sides in one commit and
   typecheck `server` + `web`.
2. **Never buffer tool calls.** Emit `tool.started` / `tool.progress` / `tool.finished` as the provider
   stream yields them. Buffering re-introduces the blocking-tool-turn symptom.
3. **The dispatcher's concurrency policy is load-bearing.** A tool declared parallel-safe that mutates
   shared state is a race.
4. **SQLite migrations are versioned files, never in-place edits.** They must be atomic.
5. **Risky subsystems ship behind a default-off `LUNA_*` flag**, are verified in isolation, then flipped
   in a follow-up.

## Step 5 — Code-truth vs doc-truth

- **Code is truth** for how something behaves right now. Read the module.
- **`docs/history/DEVELOPMENT.md` is truth** for what shipped and when.
- **`ROADMAP.md` / `docs/roadmap/` are plans**, not contracts — they can be stale. Never cite a roadmap
  file as evidence that something exists.

If a doc and the code disagree, the code wins and the doc is a bug — fix it in the same change.

## Output

After orienting, state in one short block:

```
Current version: vX.Y.Z (from the Version Index)
Packages in scope: <which of protocol/server/web/desktop>
Invariants at risk: <wire contract | tool concurrency | migrations | none>
```

Then proceed to the task (usually `luna-dev`).
