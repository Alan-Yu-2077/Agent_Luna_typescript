# Trace plumbing (v0.3.5)

Every turn writes a structured event trace to SQLite. Three lenses on one turn:

- **node** — graph transitions (`node_from → node_to`), emitted from `runTurn`'s
  `onTransition` hook. The `open_stream` transition carries an enriched payload
  (`token_count`, `first_token_ms`, `thinking_summary`).
- **tool** — dispatcher `ToolEvent`s (started / progress / final), teed in
  `runTurn`'s `dispatch_tools` consumption loop.
- **outbound** — every `ServerEvent` emitted during the turn, captured by the
  `tracedEmit` wrapper in `runTurn`.

A `tool` finalize and an `outbound` `tool.finished` describe the same moment at two
altitudes (execution view vs wire view) — that redundancy is intentional.

## The instrumentation pattern

`trace(event: TraceEvent)` is the single entry point (`instrument.ts`). It is a no-op
unless a store is set **and** tracing is enabled, so call sites stay unconditional —
no `if (traceEnabled())` guards scattered through the turn loop. One `trace()` call per
logical event, placed at the edge boundary that owns the turn context (`runTurn`), never
inside shipped lower layers (`dispatcher.ts`, `outbound.ts` are untouched).

Buffering lives in `store.ts`: events accumulate per `turn_id` in memory and flush in a
single transaction when the turn ends (`flushTrace(turnId)` in `runTurn`'s `finally`).
Hard cap of 500 events/turn; overflow drops with a single `overflow` row carrying
`dropped_count`. Payloads over 4KB truncate into a structured `{truncated, original_bytes,
preview}` wrapper — never a byte-slice of serialized JSON (Q4 resolution).

## Enable

- v0.3.5: `LUNA_TRACE=1` (default **off**).
- v0.3.6: default **on** unless `LUNA_TRACE=0`.

`trace_id = turn_id` (deterministic, collision-free across restarts; no separate id
allocator).

## Migration discipline (v0.4 inherits this)

`sql.ts` is generic — `openDb` (WAL + foreign_keys + busy_timeout per connection),
`migrate(db, dir)` (applies `migrations/NNNN_*.sql` files whose leading integer exceeds
`PRAGMA user_version`, each in its own transaction with a version bump), `closeDb`. **No
trace-specific code lives there** — v0.4's memory substrate reuses it verbatim.

Migration files contain **only** DDL — no `PRAGMA user_version`, no `journal_mode`.
`migrate()` owns the version bump; `openDb` owns per-connection pragmas. Never edit a
shipped migration in place; add `NNNN+1_*.sql`.
