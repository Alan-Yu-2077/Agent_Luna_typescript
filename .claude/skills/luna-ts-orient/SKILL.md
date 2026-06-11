---
name: luna-ts-orient
description: >
  Ground-truth project map for Agent_Luna (TypeScript rewrite, not the Python original).
  Invoke at the start of any non-trivial task in this repo (or via /luna-ts-orient) before
  searching the tree blindly. Tells you the current shipped version, the locked design
  decisions, the deliberate cuts from Python Luna, and where to find code-truth vs
  documentation-truth. The Python original lives at `/Users/alanyu2077/Desktop/Agent_Luna`
  and is a *parity reference*, not the same project. Treat
  `docs/history/DEVELOPMENT.md` as the truth source for "what version are we on" in THIS
  repo — never confuse it with the Python repo's version log.
---

# Agent_Luna (TypeScript) — Code-Truth Orientation

This skill is a code-truth map for the TypeScript rewrite. It is **deliberately distinct** from
the Python project's `luna-orient` skill; the two repos share design history but not version
numbers, runtime, or source tree.

## What this repo is

A clean-room TypeScript rewrite of [Agent_Luna](https://github.com/Alan-Yu-2077/Agent_Luna) at
`/Users/alanyu2077/Desktop/Agent_Luna` (Python, shipped through v0.47.11 as of 2026-06-11). The
rewrite targets two goals the Python version cannot reach incrementally: end-to-end response
speed and a single typed contract shared by backend and frontend. See
[`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md) for the audited facts that drive
every decision here.

## Current state (read this first)

> **Shipped head: v0.3.6** (2026-06-11). Initiatives 1 (tool spec) and 1.5 (observability) are
> complete. Next up: Initiative 2 — memory substrate (v0.4.0). The agent core works end-to-end:
> a WS client sends `chat.send`, a real LLM turn streams back through a StateGraph with
> interleaved tool calls, and every turn is traced to SQLite and browsable at `/_trace`.

Always confirm the head by reading the top of
[`docs/history/DEVELOPMENT.md`](../../../docs/history/DEVELOPMENT.md) — it is the truth source,
not this skill. The file map below is current as of v0.3.6; if DEVELOPMENT.md shows a higher
version, trust the code and update this skill.

### File map (v0.3.6)

```
packages/protocol/src/         ← the wire contract (zero runtime logic; both packages import it)
  events.ts    ClientEvent (ping | dev.dispatch_tool | chat.send)
               ServerEvent (pong | error | tool.started/progress/finished | turn.started | reply.token | turn.result)
  tools.ts     ToolName enum (time_now | read_file | remember), ToolErrorCode, ToolResult (ok|err), ToolEvent, ToolCall
  trace.ts     TraceEvent (node | tool | outbound | overflow), schema_v:1
  utils.ts     assertNever
packages/server/src/
  main.ts                entry: Bun.serve; boots provider + sqlite + trace store; fetch composes viewer → WS upgrade → 426
  ws.ts                  handleMessage exhaustive switch; chat.send → runTurn; dev.dispatch_tool (LUNA_DEV_TOOLS=1); setRuntime
  outbound.ts            outbound(ws, event) — sole validated ServerEvent send boundary (SHIPPED, do not instrument here)
  sql.ts                 openDb (WAL) / migrate (PRAGMA user_version) / closeDb — GENERIC, v0.4 memory reuses verbatim
  provider/
    types.ts             ProviderEvent union + Provider interface
    anthropic.ts         AnthropicProvider — @anthropic-ai/sdk@0.104.1, adaptive thinking, finalMessage()-based tool extraction
    mock.ts              MockProvider — scripted rounds for tests
  turn/
    graph.ts             inline 7-node StateGraph + runGraph(onTransition)
    runTurn.ts           node implementations; MAX_TOOL_ITERATIONS=8; trace instrumentation (guarded by traceEnabled())
    session.ts           in-memory Session (history/turnSeq/activeTurn/mutex); getSession('default')
  tools/
    defineTool.ts        ToolSpec<I,O> generic factory → concrete Tool interface (any-bivariance, documented)
    registry.ts          builtinRegistry: Record<ToolName, Tool>
    dispatcher.ts        dispatchToolCalls — concurrency + AbortController + MAX_CONCURRENT=8 (SHIPPED, don't instrument here)
    mutex.ts             FIFO async mutex, AbortSignal-aware
    mergeAsync.ts        source-tagged sparse-array merger
    builtin/             time_now (safe-parallel) · read_file (Bun.file, ENOENT→recoverable) · remember (session-serial, in-mem Map)
    README.md            tool-author contract + abort discipline
  trace/
    store.ts             per-turn buffer, single-tx flush, 500-cap + overflow, 4KB structured truncation, listTurns/getEventsByTurn
    instrument.ts        trace() single entry; traceEnabled() (default ON unless LUNA_TRACE=0); getTraceStore()
    viewer.ts            traceViewerHandler(req, store) — /_trace HTML + /api/turns + /api/events, or null to fall through
    viewer/index.html    vanilla 2-pane viewer, 2s refresh
    migrations/0001_traces.sql
    README.md            instrumentation + migration discipline (v0.4 reads this)
  scripts/
    smoke-yunwu.ts       2-round gateway smoke (real API)
    trace-latency.ts     trace overhead bench
```

### The hot path (chat turn)

`ws.ts:handleMessage` (chat.send) → `runTurn` (`turn/runTurn.ts`) drives the StateGraph:
`parse_input → build_request → open_stream → dispatch_tools → append_results → finalize`.
`open_stream` iterates `provider.chatStream` (`provider/anthropic.ts`), emits `reply.token`,
accumulates text + thinking summary; on `message_stop` with `tool_use` → `dispatch_tools` runs
`dispatchToolCalls` (`tools/dispatcher.ts`) and forwards `tool.*` events; `append_results`
appends `finalMessage().content` verbatim (signed thinking blocks) + tool_result, loops up to
`MAX_TOOL_ITERATIONS=8`. Every node transition / tool event / outbound event is traced (guarded
by `traceEnabled()`) and flushed to SQLite at turn end. All wire sends go through
`outbound.ts:outbound` (validates `ServerEvent` before send).

### Run / test

- `bun test` (from repo root) — 73 tests across 14 files, ~400ms.
- `bun x tsc --noEmit -p packages/{protocol,server}/tsconfig.json` — both must be clean.
- `bun run dev:server` — needs `.env` (gitignored; `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`,
  `LUNA_MODEL`, `LUNA_MAX_TOKENS`). **Bun lives at `/opt/homebrew/bin/bun`** — not always on the
  non-interactive shell `PATH`; the harness shell also pre-sets `ANTHROPIC_BASE_URL=https://api.anthropic.com`,
  so pass `ANTHROPIC_BASE_URL=https://yunwu.ai` explicitly when smoke-testing the real gateway.
- Env flags: `LUNA_DEV_TOOLS=1` (dev.dispatch_tool), `LUNA_TRACE=0` (disable tracing — default on),
  `LUNA_VIEWER=0` (disable /_trace → server becomes WS-only, 426), `LUNA_DB_PATH`, `LUNA_PORT`,
  `LUNA_INTEGRATION_TESTS=1`.

### Doc-vs-code traps (v0.3.6)

1. **Provider gateway**: code targets `https://yunwu.ai` (Python parity) via `ANTHROPIC_BASE_URL`,
   not `api.anthropic.com`. The SDK appends `/v1/messages`. yunwu re-serializes responses but
   preserves signed thinking blocks (verified by `smoke-yunwu.ts`).
2. **Thinking config diverges from Python**: Python uses `LUNA_THINKING_BUDGET_TOKENS=2048`;
   that 400s on opus-4-8. TS uses `thinking:{type:'adaptive', display:'summarized'}`.
3. **`reply.thinking` was planned but cut** — thinking summaries go to traces only (no frontend
   until v0.12). Don't add a `reply.thinking` ServerEvent.
4. **`LUNA_VIEWER=0` → 426, not 404** — viewer handler is bypassed entirely; server is WS-only.

### Where the next initiative plugs in

v0.4 memory: `turn/session.ts` is in-memory — swap to SQLite-backed via `sql.ts` (reuse
`openDb`/`migrate` verbatim, add `migrations/0002_*.sql`). The `getSession`/`saveSession` seam
and the `remember` tool's in-memory `Map` are the two swap points.

## Locked design decisions (don't re-litigate)

From [`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md):

| Decision | Choice |
|---|---|
| Runtime | **Bun** (native TS, `bun:sqlite`, native WebSocket) |
| Wire | **Single WebSocket per session** — one channel for chat + proactive + tool approval + Live2D commands |
| Persistence | **SQLite** (+ `sqlite-vec` for embeddings) |
| Schema | **Zod** as single source of truth → TS types + JSON Schema + runtime validation |
| User scope | **Single user** (no `user_id` threading; default session) |
| LLM provider | **Anthropic via official SDK only** (drop `openai_compat` and `mock`) |
| Tool streaming | **Anthropic interleaved tool-use SSE** — token stream continues through tool calls |
| Frontend scope | **TS-port `agent-app.js` controller only** — Live2D + audio pipeline untouched |

## What's cut from Python (减负 list — don't try to port these)

See [`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md) §"What we are cutting" for the
full list with rationale. Highlights:

- STS2 game integration (29 tools, all gone)
- `openai_compat` and `mock` providers
- Tool demand-load + `workspace_intent` keyword gating + `force_full_tools` meta (the v0.47.x
  bug source)
- Skills subsystem (`list_skills` / `activate_skill` / `exit_skill`)
- Tool approval gating (dormant in Python)
- `patch_file` / `replace_in_file` (kept `edit_file` only)
- `make_directory` / `move_path` / `copy_path` / `delete_path` (folded into `shell`)
- `local_roots` / `explore_local_files` / `codebase_overview` / `find_relevant_files`
  (covered by `list_files` + `search_code` + `read_file`)
- `progress_update` (replaced by tool-self-streaming)
- 4 separate memory tools (`remember`/`revise_memory`/`forget`/`update_self`) → one `remember`
  with discriminator
- All AGENT_MESSAGE_TOOL_NAMES special-casing
- `startswith('Error')` failure heuristic

## What's kept from Python

- Four-layer memory model (L1 / L2 / L3 / diary) — concepts, storage swapped to SQLite
- Proactive state machine (`ENGAGED → IDLE_WATCH → NUDGED → DORMANT → SLEEPING`)
- Reasoning-spec L1/L2 philosophy (mechanical rail + bounded model judgment + logged audit)
- Humanity hard caps (140 / 4 / 55), but enforced at the streaming layer (not prompt-only)
- Persona three-layer resolution (base / runtime / scene)
- Live2D pipeline + TTS pipeline (Node proxy + Python GPT-SoVITS sidecar) — untouched

## Cross-references

- Python source (parity reference): `/Users/alanyu2077/Desktop/Agent_Luna`
- Python audit findings (the 15-dimension ground-truth pass that drives this rewrite): captured
  in [`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md) §"Why we are rewriting"
- Forward plan: [`docs/roadmap/README.md`](../../../docs/roadmap/README.md)
- Per-version log: [`docs/history/DEVELOPMENT.md`](../../../docs/history/DEVELOPMENT.md)

## Once code exists (grow this skill at v0.1+)

After v0.1.0 ships, this section should be expanded to mirror Python `luna-orient`'s pattern:

- **File map**: `packages/protocol/`, `packages/server/`, `packages/web/` with per-file roles
- **The hot path**: WS frame → router → turn orchestrator → tool dispatcher → provider stream
  → outbound, with file:line citations
- **WS event contract**: every `ClientEvent` / `ServerEvent` variant, source, when emitted
- **Memory layer table**: SQLite schemas, indexes, retrieval paths
- **Tool surface**: each tool's input/output schema + concurrency + summarize
- **Run / test**: `bun start`, `bun test`, env vars consumed
- **Doc-vs-code traps** (will accrue over time): claims in docs that drifted past code

**Discipline**: every shipped version should append to this skill if it changes the orientation
picture. A skill stale by 3 versions is worse than no skill.

## Doc-vs-code traps (current)

Pre-v0.1: none — no code to drift past. Once v0.1+ ships, document them here, mirroring the
Python skill's pattern (numbered, with citations).

## Iteration discipline (when landing changes)

- Append outcome to `docs/history/DEVELOPMENT.md` Version Index + Detailed Record (template
  identical to Python repo's; see luna-ts-dev Phase 4)
- Update this skill's "Once code exists" section to reflect new architectural truth
- Add tests next to the package they cover (`packages/server/src/**/*.test.ts`)
- Update `docs/REWRITE_CONTEXT.md` if a Locked decision changes or an Open question resolves
