# Roadmap — Agent_Luna (TypeScript)

Forward development plan for the TypeScript rewrite. Each initiative is a folder of staged,
self-contained version plans, executed one at a time. Version numbers reserve across initiatives so
they never overlap.

> **Current shipped head: v0.9.0** (2026-06-13, action-integrity defaults flipped on).
> Initiatives 1, 1.5, 2, 3, and 4 ✅ complete — Luna remembers, recalls by meaning (auto + the
> agentic `recall` tool), dreams, has her persona, speaks through the typed `message` tool, and
> now reasons under an L1 thinking contract with structural/mechanical action-integrity guards
> (LD #14 landed; promises mechanically un-droppable; every judgment a typed `decision` trace).
> **Next up: Initiative 5 — proactive + self-continuation, designed fresh on the TS architecture
> (not a Python port), inheriting Initiative 4's audit + decision-trace substrate.** See
> [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md).

## Planned initiatives (execution order)

| Order | Version range | Initiative | Folder | Status |
|---|---|---|---|---|
| 1 | v0.1.0 – v0.3.0 | **Tool spec foundation** — Bun skeleton + WS server + typed tool registry + `Result<T>` + 3 representative tools + first end-to-end LLM round trip with Anthropic interleaved tool-use | [`tool-spec-foundation-2026-06/`](tool-spec-foundation-2026-06/) | ✅ shipped 2026-06-11 |
| 1.5 | v0.3.5 – v0.3.6 | **Observability foundation** — `trace_id` propagation through the v0.3 StateGraph; SQLite trace table (one row per node transition + per tool call); minimal local viewer. Mastra Telemetry / LangSmith parity, table-stakes for every later initiative | [`observability-foundation-2026-06/`](observability-foundation-2026-06/) | ✅ shipped 2026-06-11 |
| 2 | v0.4.0 – v0.5.0 | **Memory + dream substrate** — SQLite three-layer memory (L1 window / L2 full-text archive / L3 semantic) + prose core memory + hybrid `sqlite-vec`/CJK recall + the **dream** consolidation engine (manual + `enter_dream` tool; reconciliation, diaries, persona update). Merges the old "memory" + "dream" initiatives — dream is the engine memory needs. Port of Python v0.52–v0.57 | [`memory-dream-substrate-2026-06/`](memory-dream-substrate-2026-06/) | ✅ shipped 2026-06-12 (5 versions) |
| 3 | v0.6.0 – v0.7.0 | **Persona + humanity guardrails + `message` tool** — three-layer persona resolution with mtime-cached hot-reload; humanity hard caps as Zod schema on `message` input (not prompt-only, not truncation). **Introduces `message` tool** per LD #9 (everything-as-tool) behind `LUNA_MESSAGE_TOOL`, default-flipped at v0.7.0; frontend wire-event shape (`tool.progress{tool_name:'message'}`) is fixed here for Initiative 6 to consume | [`persona-message-tool-2026-06/`](persona-message-tool-2026-06/) | ✅ shipped 2026-06-13 (4 versions) |
| 4 | v0.8.0 – v0.9.0 | **Action integrity rails** — 言行一致 + 工具稳发. **L1 thinking contract** (commitment-to-act + tool-trigger checklist + proportionality) in the cached core; structural/mechanical boundary enforcement (`is_final` promise contract + intent-without-act guard, generalizing the v0.6.2 empty-reply guard); off-hot-path defection audit → `decision` traces + replay tree; `recall` tool (Open Q #9). **No L2 gate harness** (LD #14 corrects a Python misreading) | [`action-integrity-2026-06/`](action-integrity-2026-06/) | ✅ shipped 2026-06-13 (5 versions) |
| 5 | v0.10.0 – v0.11.0 | **Proactive + self-continuation (fresh design)** — designed on the TS architecture's advantages (persistent WS push + timers + everything-as-tool → a continuation is a delayed normal turn), **not** a Python port. Pacing state machine + cadence + lull anchoring as *reference*; the one legitimate decision **gate** (a trigger with no turn to ride) is hand-rolled here, reusing Initiative 4's audit lane + `decision` traces. **Carries the deferred dream auto-trigger** | _(folder TBD)_ | ⏳ planned |
| 6 | v0.12.0 – v0.13.0 | **Frontend port** — TS port of `agent-app.js` controller (event consumer + bubble state machine + command dispatch); subscribes to `tool.progress{tool_name:'message'}` per LD #9; Live2D + audio pipeline unchanged; dream overlay / 🌙 button | _(folder TBD)_ | ⏳ planned |

## Ordering philosophy

**Align with Mastra/LangGraph's functional surface first, then layer Luna's distinctive
positioning on top.** Initiatives 1, 1.5, and the storage half of 2 (tool spec, observability,
SQLite memory) are table-stakes that any production agent framework ships by default — without
them, the character work sits on a foundation that can't be seen, evaluated, or reproduced.
**Observability (1.5) is deliberately placed before memory (2)** because memory that ships
untraced is memory that can't be debugged when it misbehaves in a v0.10 proactive turn. The
**dream** half of Initiative 2 is where Luna's positioning starts — it is not a generic agent
feature, so it lands as the capstone of the memory work (v0.5.0), once the three layers exist for
it to consolidate. Frontend (6) is last because the wire contract has to stabilize first or the
controller re-ports every minor version. Frame: *build the framework, then build the character on
top* — anything Mastra or LangGraph would ship unmodified goes early; anything that requires
Luna's specific positioning (companion agent, dream, Live2D, proactive) goes later, atop a
foundation already proven.

**Note on the dissolved "Dream engine" initiative (old Order 7):** the original roadmap parked
dream at v0.14+ as a standalone initiative. That was wrong — dream is the consolidation engine the
memory layers cannot function without (reconciliation, diaries, core-memory updates all live in
it). It is now the capstone of Initiative 2 (v0.5.0). Its **auto-trigger** piece is the only part
that defers: it lands with Initiative 5 (proactive), whose idle scheduler it reuses.

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

## Initiative 2 — Memory + Dream substrate (v0.4.0 – v0.5.0)

Planned in detail (next up). The three-layer SQLite memory + the dream consolidation engine, ported
from Python Luna's shipped `memory-redesign-dream` initiative (v0.52–v0.57). See
[`memory-dream-substrate-2026-06/`](memory-dream-substrate-2026-06/).

| Version | Plan | Theme |
|---|---|---|
| v0.4.0 | [Memory substrate foundation](memory-dream-substrate-2026-06/v0.4.0-memory-substrate.md) | SQLite-backed `Session` (L1) + L2 full-text timeline; single-writer free via WAL |
| v0.4.1 | [L1 rolling window](memory-dream-substrate-2026-06/v0.4.1-l1-rolling-window.md) | recent-N verbatim + compress-once; never re-compress; L2 re-derive |
| v0.4.2 | [L3 semantic + core memory](memory-dream-substrate-2026-06/v0.4.2-l3-semantic-core.md) | SQLite L3 (5 categories) + `remember`/`forget` upgrade + prose core memory + per-turn injection |
| v0.4.3 | [Hybrid recall](memory-dream-substrate-2026-06/v0.4.3-hybrid-recall.md) | `sqlite-vec` embedding-first + CJK-bigram lexical over L2 + L3 |
| v0.5.0 | [Dream engine](memory-dream-substrate-2026-06/v0.5.0-dream-engine.md) | manual + `enter_dream` tool; 6-step cycle (reconcile / diaries / persona); isolated, manual-wake |

## Initiatives 3–6 — placeholders

Folders for these will be created when the previous initiative is close to completion. We do not
write detailed plans this far ahead because (a) what we learn in v0.4–v0.5 will change the shape of
the persona/reasoning work, and (b) carrying detailed plans we won't read for weeks is a known
Python-Luna failure mode (stale `iterations/ACTIVE.md`).
