# Agent_Luna (TypeScript) — Development History

Last updated: 2026-06-11 (Asia/Shanghai) — v0.2.0 (Typed tool registry + Result<T>)

## Scope

Per-version log of what has actually shipped in the TypeScript rewrite. This is the **truth source**
for "what version are we on" — not the roadmap, not in-flight conversation.

Conventions match Python Luna:
- `Fact` = grounded in commit history, repository docs, or checked-in code in this TS repo.
- `Inference` = phase summary derived from those materials.
- `-dev` = current working-tree iteration not yet committed.

The Python original (`/Users/alanyu2077/Desktop/Agent_Luna`) stays the running production system
during the rewrite. Its version log is unrelated to this one — `v0.1` here is not `v0.1` there.

## Source material

- 2026-06-11 15-dimension ground-truth audit of Python Luna v0.47.9 (`/Users/alanyu2077/.claude/.../tasks/w7tdhaip0.output`)
- Design conversation 2026-06-11 (Bun / WS / SQLite / Zod / single-user / interleaved tool streaming)
- 减负 list (see [`../REWRITE_CONTEXT.md`](../REWRITE_CONTEXT.md))

## High-level stages (planned, subject to roadmap)

- `v0.1` — project skeleton: Bun + TS + Zod + bun:sqlite + WS server bootstrap. No agent logic yet.
- `v0.2` — tool spec: typed registry, `Result<T>`, streaming tool execution, 3 representative tools end-to-end (`time_now`, `read_file`, `remember`).
- `v0.3` — single-turn LLM round trip with Anthropic interleaved tool-use SSE wired through WS to a minimal client.
- `v0.4` — memory substrate on SQLite (L1 session state first).
- `v0.5+` — TBD; see roadmap.

## Version index

| Version | Date | Theme | Evidence |
|---|---|---|---|
| `v0.1.0` | 2026-06-11 | Bun skeleton + WS server | `7ebd73a` |
| `v0.2.0` | 2026-06-11 | Typed tool registry + `Result<T>` + 3 representative tools | `working tree` |

## Detailed records

### `v0.1.0` — 2026-06-11 — Bun skeleton + WS server

Status:

- working tree (commit hash filled in after merge to main)

Fact:

- Created Bun monorepo root with `package.json` (workspaces `packages/*`), `tsconfig.base.json`
  (`strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` + `noUnusedParameters`,
  `noEmit: true`, `types: ["bun"]`), `bunfig.toml` (`[install] saveTextLockfile = true`),
  `.gitignore` (commits `bun.lock`, ignores `bun.lockb`), `.editorconfig`, `.prettierrc`
  (semi, single-quote, trailing-comma all, width 100), `.prettierignore`.
- Added `packages/protocol/` (6 files, 86 lines): Zod `ClientEvent` (discriminated union of
  `PingEvent`) and `ServerEvent` (discriminated union of `PongEvent` + `ErrorEvent`) in
  `src/events.ts`; `assertNever` helper in `src/utils.ts`; `src/index.ts` re-exports.
  Dependency: `zod ^3.25.0`.
- Added `packages/server/` (6 files, 144 lines): `src/main.ts` boots `Bun.serve` on
  `LUNA_PORT` (default 8787) with WS upgrade; `src/ws.ts` handles open/message/close with
  Zod `safeParse` + exhaustive switch + `assertNever(event.type)`; `src/outbound.ts`
  centralizes `ServerEvent.parse` → `ws.send` as the **sole** validated outbound boundary;
  workspace dep `@luna/protocol: workspace:*`.
- Added test suites: `packages/protocol/src/events.test.ts` (8 tests, ClientEvent +
  ServerEvent parse/reject cases) and `packages/server/src/ws.test.ts` (4 tests, random-port
  WS round-trip, malformed JSON, unknown event, invalid seq). 12/12 green in 13ms.
- Installed dev tooling: `@types/bun`, `prettier`, `typescript`. Bun 1.3.14 (≥ 1.2 spec).
  Text-format `bun.lock` committed; binary `bun.lockb` ignored.
- Manual smoke against `bun run dev:server`: ping `seq:7` → pong with matching seq + valid
  `server_time_ms`; round-trip 3ms on localhost.
- TypeScript `tsc --noEmit` clean on both packages; no `as any`, no `as unknown`, no
  `@ts-ignore`, no `startswith('Error')` heuristic.

Inference:

- Establishes the **discriminated-union wire contract** that v0.2 (`tool.started` /
  `tool.progress` / `tool.finished`) and v0.3 (`turn.started` / `reply.token` /
  `turn.result` / `chat.send`) extend by appending variants — no protocol rewrite needed
  downstream. The `assertNever(event.type)` exhaustiveness pattern in `ws.ts` will catch any
  forgotten case at compile time when new variants land.
- Proves the locked runtime/wire choices (Bun + Zod + native WebSocket, single channel per
  session) work end-to-end with sub-100ms cold boot and 3ms ping/pong round-trip on
  localhost. The Python `time.sleep`-paced HTTP-thread serialization is structurally
  impossible in this stack.
- The `outbound()` validate-before-send wrapper is load-bearing for v0.2/v0.3: the tool
  dispatcher and the turn loop will each be handed an `emit: (e: ServerEvent) => void`
  callback that wraps `outbound`, so the wire boundary stays the **only** place schema
  validation lives. Eliminates the Python "frontend handler early-returns on a frame the
  backend assumes is consumed" silent-drift class of bugs by design.
- Confirms file-split: only **types and wire shapes** live in `packages/protocol`;
  `defineTool`, the dispatcher, and provider logic stay in `packages/server`. Frontend
  (`packages/web`) will consume the same protocol package in Initiative 6, getting
  contract drift as a type error rather than a runtime mismatch.

### `v0.2.0` — 2026-06-11 — Typed tool registry + `Result<T>`

Status:

- working tree (commit hash filled in after merge to main)

Fact:

- Added `packages/protocol/src/tools.ts` (~60 LOC): Zod schemas for `ToolName` (closed
  enum: `time_now | read_file | remember`), `ToolErrorCode` (5 variants), `ToolResult`
  (discriminated `ok` / `err`), `ToolEvent` (discriminated `started` / `progress` /
  `final`), `ToolCall`. All exported types via `z.infer`.
- Extended `packages/protocol/src/events.ts`: `ClientEvent` gained
  `dev.dispatch_tool { call_id, tool_name, input }` (dev-only). `ServerEvent` gained
  `tool.started`, `tool.progress`, `tool.finished`.
- Added `packages/server/src/tools/` (10 files, ~530 LOC): `defineTool.ts` (ToolSpec generic
  factory → concrete Tool interface), `registry.ts` (`Record<ToolName, Tool>` builtin
  registry), `dispatcher.ts` (concurrency grouping + AbortController + manual `iter.next()`
  race + `iter.return()` cleanup + output schema validation + `data ?? null` serialize +
  `MAX_CONCURRENT_TOOLS_PER_SESSION = 8` backstop), `mutex.ts` (FIFO async mutex with
  `AbortSignal`-aware `acquire`), `mergeAsync.ts` (source-tagged sparse-array merger with
  per-iterator catch + `return()` propagation), `README.md` (tool author contract).
- Added 3 representative tools (`builtin/`): `time_now` (safe-parallel, instant),
  `read_file` (safe-parallel, `Bun.file().text()` with ENOENT → recoverable error,
  32KB truncation), `remember` (session-serial, in-memory `Map<sessionId, Item[]>`
  keyed by session).
- Updated `packages/server/src/main.ts` + `ws.ts`: WS data slot typed as
  `{sessionId: string}` (preparation for v0.4 sessions). `ws.ts` adds `dev.dispatch_tool`
  branch gated on `LUNA_DEV_TOOLS=1` that forwards dispatcher events as
  `ServerEvent.tool.*` through the existing `outbound()` boundary.
- Test count: 49 across 9 files (was 12 in v0.1.0). New: tools (8), mutex (4), mergeAsync
  (3), dispatcher (8), time_now (2), read_file (2), remember (3), dev.dispatch_tool
  round-trip (2). Suite green in ~300ms.
- TypeScript `tsc --noEmit` clean on both packages. Two intentional `any` in
  `defineTool.ts` Tool interface (with paired WHY comment) for generic-invariance
  bivariance; no `as any`, no `as unknown`, no `@ts-ignore`. One `@ts-expect-error` in
  dispatcher.test.ts for the unreachable `tool_not_found` path (annotated).
- Manual smoke against `LUNA_DEV_TOOLS=1 bun run dev:server`:
  `dev.dispatch_tool{tool_name:'time_now'}` → `[tool.started, tool.finished]` with
  `result.kind='ok'` and valid `iso` field.

Inference:

- **Establishes the tool contract for everything downstream.** v0.3 (LLM-driven dispatch),
  v0.4 (memory tools touching SQLite), v0.6 (`message_tool` per LD #9), v0.8 (reasoning-rail
  tools) all sit on this shape. The `defineTool` generic factory gives per-tool I/O type
  inference; the concrete `Tool` interface allows heterogeneous registry storage; the
  dispatcher's runtime Zod safeParse guarantees the wire contract.
- **Fixes 4 of the 6 Python tool-instability root causes by design.** No 5-path mount logic
  (always-on registry); no 56-tool surface (closed 3-tool surface, grows to 10); no
  `startswith('Error')` heuristic (discriminated `Result<T>` with structured `ToolErrorCode`);
  no buffered tool-turn (async generator yields stream through `mergeAsync`). The remaining
  2 (no verifier loop, reactive stall detection) are v0.3+ concerns.
- **Resolves Open Q #1 + Open Q #5.** Q1 → new Locked Decision #10 (shell tool always-on +
  deny-regex per Mastra/LangGraph parity; no `mountedWhen` field on `defineTool`). Q5
  confirmed locked at 3-state `concurrency` enum at v0.2 design review.
- **Forecloses v0.6 `message_tool` introduction without contract change.** v0.2's `output:
  z.ZodTypeAny` accepts `z.null()` for void-returning tools; the `concurrency` enum already
  includes `session-serial`; `execute: async function*` is exactly the streaming shape
  Anthropic's `input_json_delta` will hook into. v0.6 is a pure add of one tool, not a
  contract revision.
- **First load-bearing dispatcher correctness fix found in testing**: the original design
  returned from `runOne` immediately after the terminal event, abandoning the tool's
  async generator without giving its `finally` block a chance to run (session-serial test
  3 had `maxActive=3` instead of `1`). Fixed by `await iter.return()` in dispatcher's
  finally, with a 100ms grace race on the abort path. Tool authors get reliable cleanup
  semantics; the abort discipline is documented in `packages/server/src/tools/README.md`.

## Pre-history (2026-06-11)

- 11:28 — Empty repo cloned to `/Users/alanyu2077/Desktop/Agent_Luna_typescript`.
- ~12:10 — Multi-agent ground-truth audit of Python Luna v0.47.9 completed (32 agents, 15 dimensions).
- 13:xx — Design conversation locked Bun / WS / SQLite / single-user / Anthropic interleaved tool-use / 10-tool surface.
- Late afternoon — Docs scaffolding (`README.md`, `docs/`, `roadmap/`, `REWRITE_CONTEXT.md`, this file) created.

Nothing else exists in this repo yet.
