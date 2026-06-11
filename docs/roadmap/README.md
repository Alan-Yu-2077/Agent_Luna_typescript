# Roadmap — Agent_Luna (TypeScript)

Forward development plan for the TypeScript rewrite. Each initiative is a folder of staged,
self-contained version plans, executed one at a time. Version numbers reserve across initiatives so
they never overlap.

> **Current shipped head: v0.3.6** (2026-06-11, local trace viewer). Initiatives 1 and 1.5
> ✅ complete. **Next up: Initiative 2 — memory substrate (v0.4.0–v0.5.0).** See
> [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md).

## Planned initiatives (execution order)

| Order | Version range | Initiative | Folder | Status |
|---|---|---|---|---|
| 1 | v0.1.0 – v0.3.0 | **Tool spec foundation** — Bun skeleton + WS server + typed tool registry + `Result<T>` + 3 representative tools + first end-to-end LLM round trip with Anthropic interleaved tool-use | [`tool-spec-foundation-2026-06/`](tool-spec-foundation-2026-06/) | ✅ shipped 2026-06-11 |
| 1.5 | v0.3.5 – v0.3.6 | **Observability foundation** — `trace_id` propagation through the v0.3 StateGraph; SQLite trace table (one row per node transition + per tool call); minimal local viewer. Mastra Telemetry / LangSmith parity, table-stakes for every later initiative | [`observability-foundation-2026-06/`](observability-foundation-2026-06/) | ✅ shipped 2026-06-11 |
| 2 | v0.4.0 – v0.5.0 | **Memory substrate** — SQLite schema for L1 / L2 / L3; replace JSON+JSONL persistence; `sqlite-vec` for embeddings | _(folder TBD)_ | ⏳ planned |
| 3 | v0.6.0 – v0.7.0 | **Persona + humanity guardrails** — three-layer persona resolution with file-watch cache; humanity hard caps move from streaming-layer truncation to Zod schema on `message` input. **Introduces `message_tool`** per LD #9 (everything-as-tool); frontend wire-event shape (`tool.progress{tool_name:'message'}`) is fixed here for Initiative 6 to consume | _(folder TBD)_ | ⏳ planned |
| 4 | v0.8.0 – v0.9.0 | **Reasoning rails** — port L1/L2 contracts with Zod-structured-output decisions; full decision replay tree on top of the v0.3.5 trace plumbing | _(folder TBD)_ | ⏳ planned |
| 5 | v0.10.0 – v0.11.0 | **Proactive engine** — port the state machine (`ENGAGED → IDLE_WATCH → NUDGED → DORMANT → SLEEPING`); cadence persistence; lull anchoring | _(folder TBD)_ | ⏳ planned |
| 6 | v0.12.0 – v0.13.0 | **Frontend port** — TS port of `agent-app.js` controller (event consumer + bubble state machine + command dispatch); subscribes to `tool.progress{tool_name:'message'}` per LD #9; Live2D + audio pipeline unchanged | _(folder TBD)_ | ⏳ planned |
| 7 | v0.14.0+ | **Dream engine** — isolated consolidation mode (Python Luna v0.55-equivalent); fan-out memory mining; manual trigger first, auto-trigger deferred | _(folder TBD)_ | ⏳ planned |

## Ordering philosophy

**Align with Mastra/LangGraph's functional surface first, then layer Luna's distinctive
positioning on top.** Initiatives 1, 1.5, and 2 (tool spec, observability, memory) are
table-stakes that any production agent framework ships by default — without them, the character
work in Initiatives 3–5 (persona, humanity, reasoning rails, proactive) sits on a foundation
that can't be seen, evaluated, or reproduced. **Observability (1.5) is deliberately placed
before memory (2)** because memory that ships untraced is memory that can't be debugged when it
misbehaves in a v0.10 proactive turn. Frontend (6) is last because the wire contract has to
stabilize first or the controller re-ports every minor version. Frame: *build the framework,
then build the character on top* — anything Mastra or LangGraph would ship unmodified goes
early; anything that requires Luna's specific positioning (companion agent, Live2D, proactive)
goes later, atop a foundation already proven.

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
| v0.1.0 ✅ | [Bun skeleton + WS server](tool-spec-foundation-2026-06/v0.1.0-bun-skeleton.md) | Project bootstrap; one WS endpoint that echoes typed events — **shipped 2026-06-11** |
| v0.2.0 ✅ | [Typed tool registry + `Result<T>`](tool-spec-foundation-2026-06/v0.2.0-tool-registry.md) | Zod-first tool definitions; discriminated `Result<T>`; 3-state concurrency policy; per-tool `summarize()`; 3 representative tools end-to-end through dispatcher — **shipped 2026-06-11** |
| v0.3.0 ✅ | [Anthropic interleaved tool-use end-to-end](tool-spec-foundation-2026-06/v0.3.0-interleaved-tool-use.md) | First real LLM round trip; tools stream progress through the WS; StateGraph turn loop with `onTransition` instrumentation seam — **shipped 2026-06-11**. yunwu.ai gateway verified (adaptive thinking + signed-block round-trip). |

## Initiative 1.5 — Observability foundation (v0.3.5 – v0.3.6)

The piece Mastra (Telemetry) and LangGraph (LangSmith) ship by default and Luna currently
lacks. Inserted **before** memory because memory bugs that ship untraced are nearly
impossible to debug in proactive turns. See
[`observability-foundation-2026-06/`](observability-foundation-2026-06/).

| Version | Plan | Theme |
|---|---|---|
| v0.3.5 ✅ | [Trace plumbing](observability-foundation-2026-06/v0.3.5-trace-plumbing.md) | `trace_id` propagation; SQLite trace table; instrument the StateGraph + dispatcher tee + outbound. First `bun:sqlite` touch; `sql.ts` WAL/migration pattern v0.4 reuses verbatim — **shipped 2026-06-11**. |
| v0.3.6 ✅ | [Local viewer](observability-foundation-2026-06/v0.3.6-local-viewer.md) | Read-only `/_trace` HTML route over the trace table; per-turn timeline; `LUNA_TRACE` default on — **shipped 2026-06-11**. |

## Initiatives 2–7 — placeholders

Folders for these will be created when the previous initiative is close to completion. We do not
write detailed plans this far ahead because (a) what we learn in v0.1–v0.3.6 will change the shape
of the memory substrate work, and (b) carrying detailed plans we won't read for weeks is a known
Python-Luna failure mode (stale `iterations/ACTIVE.md`).
