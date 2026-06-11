# Roadmap — Agent_Luna (TypeScript)

Forward development plan for the TypeScript rewrite. Each initiative is a folder of staged,
self-contained version plans, executed one at a time. Version numbers reserve across initiatives so
they never overlap.

> **Current shipped head: none.** Scaffolding only. See [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md).
> First initiative is the tool spec foundation — per the locked design decision that "tool spec is
> the core element; everything else can come later."

## Planned initiatives (execution order)

| Order | Version range | Initiative | Folder | Status |
|---|---|---|---|---|
| 1 | v0.1.0 – v0.3.0 | **Tool spec foundation** — Bun skeleton + WS server + typed tool registry + `Result<T>` + 3 representative tools + first end-to-end LLM round trip with Anthropic interleaved tool-use | [`tool-spec-foundation-2026-06/`](tool-spec-foundation-2026-06/) | ⏳ next up |
| 2 | v0.4.0 – v0.5.0 | **Memory substrate** — SQLite schema for L1 / L2 / L3; replace JSON+JSONL persistence; `sqlite-vec` for embeddings | _(folder TBD)_ | ⏳ planned |
| 3 | v0.6.0 – v0.7.0 | **Persona + humanity guardrails** — three-layer persona resolution with file-watch cache; humanity hard caps with streaming-layer truncation (not prompt-only) | _(folder TBD)_ | ⏳ planned |
| 4 | v0.8.0 – v0.9.0 | **Reasoning rails** — port L1/L2 contracts with Zod-structured-output decisions; `trace_id` decision tree; reasoning audit log | _(folder TBD)_ | ⏳ planned |
| 5 | v0.10.0 – v0.11.0 | **Proactive engine** — port the state machine (`ENGAGED → IDLE_WATCH → NUDGED → DORMANT → SLEEPING`); cadence persistence; lull anchoring | _(folder TBD)_ | ⏳ planned |
| 6 | v0.12.0 – v0.13.0 | **Frontend port** — TS port of `agent-app.js` controller (event consumer + bubble state machine + command dispatch); Live2D + audio pipeline unchanged | _(folder TBD)_ | ⏳ planned |
| 7 | v0.14.0+ | **Dream engine** — isolated consolidation mode (Python Luna v0.55-equivalent); fan-out memory mining; manual trigger first, auto-trigger deferred | _(folder TBD)_ | ⏳ planned |

The order above prioritizes correctness of the agent core (tool spec → memory → reasoning) over UX
parity (frontend port comes deliberately late, since the wire contract needs to stabilize first).

## How an initiative is structured

Each initiative folder contains:
- `README.md` — initiative overview + version table + acceptance criteria for "this initiative is
  done."
- One `vX.Y.Z-<theme>.md` per planned version with: **Goal / Status / Backend / Frontend / Tests /
  Risk / Acceptance / Depends / Flag**. Self-contained — should be readable in isolation.

## How versions move

- Versions can shift between initiatives, be deferred, or be merged when reality demands.
- **Always update both the initiative README and this file in the same commit** as the change.
- A version that ships gets removed from this roadmap and logged in
  [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md) with date and theme.
- Initiatives that complete get marked ✅ shipped here (kept for orientation), then archived under
  `../history/roadmap-archived-YYYY-MM/` if the folder gets noisy.

## Initiative 1 — Tool spec foundation (v0.1.0 – v0.3.0)

The single most important block. The Python rewrite was triggered partly because tool calling is
unstable in the current system; the audit traced that to six root causes (five-path mount logic,
56-tool surface, `startswith('Error')` heuristic, no streaming during tools, no verifier loop,
reactive stall detection). v0.1–v0.3 fix all six **by design** before any other feature lands.

| Version | Plan | Theme |
|---|---|---|
| v0.1.0 | [Bun skeleton + WS server](tool-spec-foundation-2026-06/v0.1.0-bun-skeleton.md) | Project bootstrap; one WS endpoint that echoes typed events |
| v0.2.0 | [Typed tool registry + `Result<T>`](tool-spec-foundation-2026-06/v0.2.0-tool-registry.md) | Zod-first tool definitions; discriminated result type; concurrency policy; per-tool `summarize()` |
| v0.3.0 | [Anthropic interleaved tool-use end-to-end](tool-spec-foundation-2026-06/v0.3.0-interleaved-tool-use.md) | First real LLM round trip; tools stream progress through the WS; one-turn happy path working |

## Initiatives 2-7 — placeholders

Folders for these will be created when the previous initiative is close to completion. We do not
write detailed plans this far ahead because (a) what we learn in v0.1–v0.3 will change the shape
of the memory substrate work, and (b) carrying detailed plans we won't read for weeks is a known
Python-Luna failure mode (stale `iterations/ACTIVE.md`).
