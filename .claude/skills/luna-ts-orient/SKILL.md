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

> **Shipped head: v0.15.4** (2026-06-15) — confirm via the top of
> [`docs/history/DEVELOPMENT.md`](../../../docs/history/DEVELOPMENT.md), the truth source. Initiatives
> 1 (tool spec), 1.5 (observability), 2 (memory + dream), 3 (persona + `message` tool, **LD #9**),
> 4 (action integrity — **LD #14**), 5 (proactive agency — **LD #15**), 6 (frontend port — Live2D
> **yumi** + voice + lip-sync), and 8 (code-agent capability — read/nav/edit/shell/verify/repo-map +
> propose-only self-edit behind an evaluator firewall) are all **complete**. **Planned next:**
> Initiative 9 (audit remediation — security loopback bind, recompute efficiency, dead-infra,
> v0.16.x) and Initiative 10 (memory depth — ~100-turn window + diary injection, **amends LD #12**,
> v0.17.x). The file map further down predates v0.13+ — treat DEVELOPMENT.md + the code as truth where
> they diverge. **Luna also has agency when no one
> is talking**: a `.unref()`'d heartbeat (`LUNA_PROACTIVE`, default ON, `=0` kill switch) runs a
> conservative wake judgment and, on act, a proactive `runTurn` that can act SILENTLY — bounded by
> a hard reversible-silent/irreversible-surfaced safety gate + action budget. Self-continuation =
> a `setTimeout` micro-wake after a user turn; dream auto-trigger = a `consolidate`-intent turn
> calling `enter_dream`. The agent core works end-to-end: WS
> `chat.send` → real LLM turn through a generic StateGraph with interleaved tools, reasoning
> under the **L1 thinking contract** (`LUNA_L1_CONTRACT`, default on) → **speech via the
> `message` tool only** (`LUNA_MESSAGE_TOOL`, default on) → **action-integrity guards** in
> finalize (`LUNA_INTEGRITY_GUARD`: is_final-promise + intent-without-act, one bounded retry) →
> persisted to SQLite (L1 + L2 + L3 + prose core) → hybrid recall (auto-injected + the agentic
> `recall` tool) → off-hot-path **defection audit** (`LUNA_DECISION_AUDIT`) writing typed
> `decision` traces → manual/tool-triggered **dream** consolidates offline — all traced (incl.
> the decision replay tree) at `/_trace`; chat at `/_chat`. All Initiative-4 flags default on
> with `=0` escape hatches.

Always confirm the head by reading the top of
[`docs/history/DEVELOPMENT.md`](../../../docs/history/DEVELOPMENT.md) — it is the truth source,
not this skill. The file map below is current as of v0.7.0; if DEVELOPMENT.md shows a higher
version, trust the code and update this skill.

### Proactive-agency additions (v0.10.0–v0.11.0, Initiative 5 — LD #15)

```
packages/protocol/src/events.ts   ClientEvent += proactive.fire · ServerEvent += proactive.started/finished{spoke}
packages/server/src/
  migrations/0007_proactive.sql    cadence columns on sessions (restart-survival)
  proactive/
    proactiveTurn.ts   runProactiveTurn = runTurn + proactiveTurn:true (silence allowed) + intent framing (spontaneous/continuation/consolidate)
    safetyGate.ts      proactiveRiskOf FAIL-CLOSED (safe only if opted in) · isProactiveActionAllowed (surface needs a prior-round message) · maxProactiveActions()
    cadence.ts         passesAntiSpam rail (quiet/idle-floor/cooldown/quota; NO deep-absence/too-soon) · slot bitmask (scheduledSlots/isSlotConsumed/markSlotConsumed) · commit/commitSilent/load/save · proactiveEnabled() = LUNA_PROACTIVE!=='0' (default ON)
    detectors.ts       the registry (v0.22): evaluateDetectors first-match over afterNight · scheduledWindow · weatherShift · openThreadAged · promisedFollowThrough (last two default-off); pure, LLM-free, drafting-as-decision (NO wake-gate since v0.22.3)
    fire.ts            maybeFireProactive = the funnel (anti-spam→detector→debounce→turn→cadence commit→dream handoff) inside withProactiveLock, the REAL per-session single-turn lock every path shares
    scheduler.ts       runTick (in-flight guard) → tickOnce iterates sessions → maybeFireProactive; fireProactiveForActiveSessions (the weather hook); startScheduler in main.ts. Heartbeat is LLM-free.
    continuation.ts    self-continuation = setTimeout micro-wake after a user turn (mechanical probability gate); through withProactiveLock, rail-light (no cadence commit)
  turn/runTurn.ts      dispatch_tools HARD GATE (proactive surface-risk blocked until surfaced) + action budget; finalize exempts the empty-reply guard for proactive turns
  ws.ts                proactive.fire branch (lock-routed) + maybeFireOnReconnect event hook + activeSockets/broadcast + lastUserMs stamp + maybeScheduleContinuation
  scripts/proactive-soak.ts        manual heartbeat soak vs the real model
  FLAGS: LUNA_PROACTIVE (default ON) · rail: TICK_SECONDS/IDLE_FLOOR_MS/MIN_INTERVAL_MS/DAILY_QUOTA/QUIET_HOURS/DEBOUNCE_MS/MAX_ACTIONS · detectors: SLOTS/WEATHER_SHIFT/EVENT_HOOKS/OPEN_THREADS(_THREAD_AGE_MS)/FOLLOW_THROUGH(_PROMISE_AGE_MS/_PROMISE_MAX_AGE_MS) · LUNA_SELFCONT(_PROBABILITY/_PAUSE_MS)
```

### Action-integrity additions (v0.8.0–v0.9.0, Initiative 4 — LD #14)

```
packages/protocol/src/
  trace.ts     TraceEvent += DecisionTraceEvent {surface, decision, reason, evidence?} (kind-agnostic store → no store change)
  tools.ts     ToolName += recall (6 tools)
packages/server/src/
  turn/integrity/defectionAudit.ts
                 detectDefection (PURE, zero-LLM): is_final_promise > message_intent (verbatim msg text) > thinking_intent (audit-only, never retried)
                 PROMISE_PATTERNS + NEGATION_AFTER/CAPABILITY_MODAL filters (v0.9.0 tuning) · runDefectionAudit (gated, never throws, sync in finally before flushTrace)
  persona/l1Contract.ts   renderL1Contract — commitment-to-act + tool-trigger pass (recall/save/check) + proportionality + no-leak + honesty; cached core block
  turn/runTurn.ts         finalize: correctionUsed Set + correctionWatermark — empty/promise/intent guards, one user-role retry each then degrade; emitGuardDecision
  tools/builtin/recall.ts agentic memory search — flat input {query,scope?,limit?} · reuses retrieve() · always mounted (LD #10)
  scripts/integrity-sweep.ts   baseline-vs-full measurement sweep (v0.9.0 recorded)
  FLAGS (all default ON since v0.9.0, =0 escape hatch): LUNA_L1_CONTRACT · LUNA_INTEGRITY_GUARD · LUNA_DECISION_AUDIT
```

### Persona + message-tool additions (v0.5.1–v0.7.0)

```
packages/protocol/src/
  message.ts   ExpressionKey (15 affects) · VoiceParams · MessageSegment{delay_ms metadata} · MessageDelivery (tool.finished payload = frontend contract)
  events.ts    ToolProgressEvent += tool_name (message streaming subscription key)
  tools.ts     ToolName += message (5 tools)
packages/server/
  persona/default.md       Luna's persona file (ported from Python; honest-embodiment + no-capability-claims)
  src/persona/
    loader.ts              mtime-gated hot reload (LUNA_PERSONA_PATH override; fallback never crashes)
    humanity.ts            caps 140/4/55 as constants · CJK splitSentences/splitClauses (schema + prompt share them)
    scene.ts               WAKE_SCENE_BLOCK — message-level, first turn after boot (Session.wakePending)
  src/tools/builtin/message.ts   flat root-object input · superRefine humanity caps · segments derived server-side
  src/tools/registry.ts    ToolRegistry = Partial<Record> · messageRegistry · isMessageMode(registry) = mode truth
  src/turn/
    jsonTextStream.ts      incremental "text"-field extractor over input_json_delta chunks (escapes/\uXXXX/nesting)
    runTurn.ts             buildSystemPrompt(session, messageMode): base→persona→embodiment→humanity→core, one cache block
                           open_stream: tool_input_delta → tool.progress text_delta · finalize: empty-reply guard (one user-role retry → degraded trace)
  src/devchat/devchat.html streaming bubbles by call_id · 🎭 expression chips · err → discard preview
  scripts/ab-message-mode.ts   A/B harness text-mode vs message-mode (v0.7.0 baseline; rerun before Initiative 4 changes)
```

### Memory + dream additions (v0.4.0–v0.5.0; base map below is v0.3.6)

```
packages/protocol/src/
  memory.ts    L2Turn · SessionRow · L3Category/L3Fact (deleted_ms soft-delete) · CoreMemory (prose)
  events.ts    += chat dream.enter/dream.wake · dream.status/dream.step · error{code:'dreaming'}
  tools.ts     ToolName += enter_dream (4 tools)
packages/server/src/
  migrations/            ONE shared dir (0001 traces … 0006 dream); migrate() throws on dup numbers
  memory/
    sessionStore.ts      setMemoryDb() seam (no-op unset) · loadSession/persistSession/appendL2/listL2 · commitFold CAS
    l1Window.ts          buildActiveContext (summary-msg + verbatim tail) · planFold (whole L2 turns) · maybeFold (ASYNC post-finalize, CAS)
    l3Store.ts           addFact (dedupKey, prefixed ids, active_threads TTL) · forgetFact = SOFT delete · listFacts(asOf time-travel)
    coreMemory.ts        getCore/updateCore (audit-first)/restore(n) — prose only
    renderCoreBlock.ts   STABLE system-prompt block + cache_control breakpoint (byte-identity = cache invariant, test-pinned)
    recall/
      vecRuntime.ts      initCustomSqlite (process-global, BEFORE any Database; tests via bunfig preload) · tryLoadVec
      embed.ts           ~60-LOC fetch /v1/embeddings client (NOT openai_compat) · f32-LE BLOB · sha256 cache · cosine
      lexical.ts         CJK sliding bigrams + ascii words
      recall.ts          hybrid 0.7cos+0.3lex + recency; vec0 lazy-created derived table; fallback TS cosine; recall block = MESSAGE level
  dream/
    dreamState.ts        module gate + SQLite write-through · finished_idle parked · bootReconcile (crash-stale → aborted+awake)
    cycle.ts             SECOND StateGraph (6 DreamNodes) · trace dream:<cycle_id> · flush per step
    llm.ts               summarizer→default key cascade (two provider instances) · failure classification · Zod patch parsing
    prompts.ts           natural-language headers — NO <<<>>> delimiters (yunwu content-filter lesson)
  tools/builtin/enter_dream.ts   pending-intent ONLY; cycle starts post-turn.result (ws.ts continuation)
  turn/graph.ts          runGraph<S, N extends string> — generic; TurnNode + NodeName alias
```

Key invariants (each test-pinned): hot path = zero synchronous memory LLM calls (async CAS fold
is the sole exception) · system prompt byte-stable unless memory changes · forget = soft delete ·
dream never overlaps a live turn (incl. its trigger's turn) · fold input = L2 verbatim, never the
prior summary. Test preload forces `LUNA_MEMORY_EMBEDDING=0` (Bun auto-loads `.env` with real
keys — unit tests must not hit the network ambiently). WAL gotcha: a not-cleanly-closed DB fails
`{readonly:true}` opens with SQLITE_CANTOPEN — inspect with a writable connection.

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
