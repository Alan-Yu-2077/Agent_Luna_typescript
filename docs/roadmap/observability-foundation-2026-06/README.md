# Initiative 1.5 — Observability Foundation (v0.3.5 – v0.3.6)

> **Status: PLANNED.** Priority: between Initiative 1 (tool-spec-foundation) and Initiative 2
> (memory substrate). Version range: **v0.3.5 – v0.3.6**. Master:
> [`../README.md`](../README.md).

## The idea

Every turn-loop node transition (per the v0.3 StateGraph) and every tool dispatch gets a
`trace_id` and an SQLite row. A minimal local viewer renders the resulting traces as a flat
per-turn timeline. This is the observability layer Mastra (Mastra Telemetry) and LangGraph
(LangSmith) ship as a default — Luna currently has none, and inserting it **before** memory
work means every later initiative inherits "how do I see what just happened" for free.

## Why prioritized here (between v0.3 and v0.4)

Per the master roadmap's [ordering philosophy](../README.md#ordering-philosophy): align with
Mastra/LangGraph's functional surface before layering Luna positioning on top. Specifically:

- **Before memory (v0.4)**: memory turns misfire silently (wrong recall, wrong tier, stale
  embedding). Debugging memory without traces is print-debugging a black box. Trace plumbing
  first means every v0.4+ bug has a reproducible timeline.
- **After tool spec (v0.3)**: traces of tool dispatch need the dispatcher to exist. v0.3 ships
  that, and its StateGraph implementation gives us the stable edge boundaries to instrument
  without ad-hoc print statements.
- **Before reasoning rails (v0.8)**: when L1/L2 reasoning lands, each decision wants a
  `trace_id` to link back to (Open Q #8 partial). The plumbing has to exist first.

## Locked design decisions referenced

From [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- **LD #3 — Persistence: SQLite + `sqlite-vec`**. v0.3.5 introduces the first `bun:sqlite`
  touch in the rewrite. Establishes connection pool / WAL mode / migration patterns that v0.4
  memory substrate reuses verbatim.
- **LD #4 — Zod single source of truth**. Trace event types (`NodeTrace`, `ToolTrace`,
  `OutboundTrace`) live in `packages/protocol/src/trace.ts` as Zod discriminated unions —
  parsed before write and parsed on viewer read. Same discipline as `events.ts`.
- **LD #8 — Anthropic interleaved tool-use SSE**. Tool trace rows reflect interleaved
  dispatch — multiple tools active concurrently produce overlapping `(started_ms, ended_ms)`
  intervals; the schema supports overlapping intervals first-class.
- **LD #9 — Everything-as-tool (introduction v0.6)**. Trace plumbing is sized for the v0.6
  frequency, not the v0.3 baseline. Concretely: per-turn buffer + single-transaction flush at
  turn end, not per-event sync (because v0.6 turns will emit ~50 `message` tool events vs v0.3's
  ~5).

## Verified architectural facts (v0.1.0 shipped)

From the v0.1.0 implementation in `packages/server/src/`:

- [`outbound.ts:5`](../../../packages/server/src/outbound.ts) — `outbound(ws, event)` is the
  sole validated outbound boundary. **Instrumentation point**: wrap to also emit a trace row
  per `ServerEvent`.
- [`ws.ts:18`](../../../packages/server/src/ws.ts) — `handleMessage` is the sole inbound
  boundary. **Instrumentation point**: mint `trace_id` here on each `ClientEvent`.
- [`main.ts:5`](../../../packages/server/src/main.ts) — `Bun.serve` entry. **Instrumentation
  point**: open SQLite at boot, graceful close on `SIGTERM`.

These are stable hook points shipped in v0.1.0; instrumentation wraps them without modifying.

## Python parity notes

Python Luna has **no equivalent observability layer** (audit § "no first-class
observability"). This initiative has no parity reference — treat it as a new capability the
rewrite adds, modeled on Mastra Telemetry / LangSmith conventions, not as a port.

## The hard part

- **SQLite write amplification**: a busy turn emits 20–50 trace rows (more once LD #9 lands
  in v0.6). Per-row `INSERT` is fine for v0.3.5 baselines but won't scale. **Discipline**:
  per-turn in-memory buffer, single-transaction flush at `node_to === 'end'`. Hard 500-row
  cap with `trace.overflow` marker.
- **Schema versioning from day one**: every trace row carries a `schema_v` column.
  `PRAGMA user_version` migration anchor pattern starts here, not at v0.4 memory. v0.4 will
  copy `packages/server/src/sql.ts` (extracted in v0.3.5) verbatim.
- **`trace_id` stability across reconnect**: WS reconnect mid-turn (per v0.3 test 5) must
  keep the same `trace_id`. Derive deterministically from `(session_id, turn_seq)`, not
  `crypto.randomUUID()`.
- **Latency budget**: <5% regression on a 100-turn synthetic benchmark vs `LUNA_TRACE=0`.
  Mitigation: the buffer never holds the hot path; flush is async post-turn.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [Trace plumbing](v0.3.5-trace-plumbing.md) | v0.3.5 | `trace_id` + SQLite trace schema + auto-instrument every dispatcher / outbound / StateGraph-transition point | Medium (first `bun:sqlite` touch; establishes WAL + migration pattern) | v0.3.0 | ✅ shipped 2026-06-11 |
| [Local viewer](v0.3.6-local-viewer.md) | v0.3.6 | Read-only HTML viewer at `/_trace` rendering per-turn timelines | Low | v0.3.5 | ✅ shipped 2026-06-11 |

## Acceptance criteria for this initiative

When v0.3.6 ships:

- [ ] A v0.3 baseline turn (`chat.send` → tool calls → reply) produces a fully-linked trace
  tree queryable by `trace_id`.
- [ ] No observable latency regression: ≤5% on a 100-turn synthetic benchmark vs v0.3
  baseline.
- [ ] Schema is migration-versioned (`schema_v` column, `migrations/0001_traces.sql`).
- [ ] Developer can browse traces at `http://localhost:8787/_trace` without writing SQL.
- [ ] The instrumentation pattern (one `trace()` function per logical event, called from
  StateGraph edge boundaries) is documented in `packages/server/src/trace/README.md` and
  reused by v0.4 memory work without modification.
- [ ] Resolves Open Q #8 partial (trace_id propagation portion). Full reasoning-decision
  replay tree deferred to v0.8+.

## Open questions blocking start

From [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- **Q4 — Result compaction tripwire**: trace storage of large tool outputs needs a policy.
  If a tool's `data` payload is 50KB, do we trace the full output, truncate at 4KB, or store
  a hash + reference to the actual blob? **Must resolve before v0.3.5 schema lock** —
  this changes the `payload_json` column semantics.
- **Q5 — Concurrency declaration granularity**: confirmed locked to 3-state enum at v0.2
  design review (carried-over). No blocker for this initiative.

Not blocking start: Q1, Q2, Q6, Q7.
