# Agent_Luna (TypeScript) — Development History

Last updated: 2026-06-12 (Asia/Shanghai) — v0.5.1 (dev chat page `/_chat`)

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
| `v0.2.0` | 2026-06-11 | Typed tool registry + `Result<T>` + 3 representative tools | `14753c4` |
| `v0.3.0` | 2026-06-11 | Anthropic interleaved tool-use end-to-end (StateGraph turn loop) | `8fbdce4` |
| `v0.3.5` | 2026-06-11 | Trace plumbing — first `bun:sqlite`, trace_id through the graph | `cbb468a` |
| `v0.3.6` | 2026-06-11 | Local `/_trace` viewer; `LUNA_TRACE` default on | `58a970a` |
| `v0.4.0` | 2026-06-12 | Memory substrate foundation — SQLite-backed sessions (L1) + L2 full-text timeline | `c2b322b` |
| `v0.4.1` | 2026-06-12 | L1 rolling window — recent-N verbatim + compress-once async fold | `e406b60` |
| `v0.4.2` | 2026-06-12 | L3 semantic store + prose core memory + remember/forget/update_self | `07cc0c1` |
| `v0.4.3` | 2026-06-12 | Hybrid recall — sqlite-vec embedding-first + CJK-bigram lexical | `25d2b08` |
| `v0.5.0` | 2026-06-12 | Dream engine — isolated 6-step consolidation; Initiative 2 complete | `a0df0b5` |
| `v0.5.1` | 2026-06-12 | Dev chat page `/_chat` — first usable conversation surface | `working tree` |

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

### `v0.5.1` — 2026-06-12 — Dev chat page `/_chat`

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/devchat/` — `devchat.ts` (handler: `/_chat` → static HTML, null
  fall-through; same shape as the trace viewer, mounted behind the same `LUNA_VIEWER` gate)
  and `devchat.html` (~200 LOC vanilla): streaming chat bubbles over the existing WS protocol
  (`chat.send` → `turn.started`/`reply.token`/`turn.result`), tool chips, 🌙 入梦 / ☀️ 唤醒
  buttons (`dream.enter`/`dream.wake`), dream-step chips, dreaming-state input lock,
  auto-reconnect, link to `/_trace`. Zero new wire events — pure consumer.
- Tests: 113 across 20 files (+2). Boot smoke: `/_chat` 200 with content, `/_trace` 200, WS ping ok.

Inference:

- First **usable** conversation surface — Alan can now actually live with Luna's memory
  (the "manual dream proven in use" staging both Python and the TS roadmap call for) without
  waiting for Initiative 6's real frontend. Explicitly a dev page: the Live2D `agent-app`
  port at v0.12 is unaffected and remains the product surface.

### `v0.5.0` — 2026-06-12 — Dream engine (Initiative 2 capstone)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`graph.ts` generalized** (`runGraph<S, N extends string>`; `NodeFn` returns `N | 'end'`)
  — type-level only, turn loop unchanged (`TurnNode` 6-union + `NodeName` alias). The dream
  cycle is a **second StateGraph** on the same runner, not a bespoke pipeline.
- Wire contract: `ClientEvent` += `dream.enter` / `dream.wake`; `ServerEvent` +=
  `dream.status` / `dream.step {step, status, detail}`; `chat.send` while dreaming →
  `error{code:'dreaming'}` (reject, never interleave).
- `enter_dream` tool added (`ToolName` → 4): **pending-intent only** — sets
  `session.pendingDream`; the ws layer starts the cycle strictly after the triggering
  turn's `turn.result` (closes Python's tail-race where the daemon thread started inside
  tool execution).
- `dream/` (5 files, ~600 LOC): `dreamState.ts` (module-state gate + SQLite write-through;
  `finished_idle` parked semantics — completed cycle keeps `is_dreaming=true` until an
  explicit wake; **boot reconciliation** marks crash-stale cycles aborted and parks awake),
  `cycle.ts` (six DreamNode steps: refine_semantic → refine_layer1 → memory_audit →
  persona_update → run_diaries → rag_refresh; traces under `dream:<cycle_id>` with
  **per-step flushes**; per-step `DreamReport` records persisted to `dream_reports`),
  `llm.ts` (two-attempt summarizer→default key cascade as **two provider instances**;
  failure classification incl. yunwu's Chinese rate-limit strings; Zod `MemoryPatch` /
  `PersonaPatch` JSON-block parsing), `prompts.ts` (natural-language section headers —
  **no `<<<>>>` delimiters**, the Python v0.56.1 content-filter lesson, test-asserted).
- `migrations/0006_dream.sql`: `dream_state` (seeded single row), `dream_reports`,
  `diaries` (day/week/month, `UNIQUE(kind, period_key)`). Diary tiers: day → week rollup
  (complete week groups), capped by `LUNA_DREAM_MAX_DIARIES_PER_CYCLE` (20).
- Reconciliation = supersede via the v0.4.2 stores: `memory_audit` soft-forgets stale ids +
  adds replacements; `persona_update` writes prose core memory with source `'dream'`.
- `main.ts`: dream LLM cascade built from `LUNA_SUMMARIZER_API_KEY` (+ fallback to the
  main provider); `bootReconcile()` at startup. Test preload now also forces
  `LUNA_MEMORY_EMBEDDING=0` ambiently — unit tests can never hit the network via the
  auto-loaded `.env` (suites opt back in with fake clients).
- Tests: 111 across 19 files (was 102). New dream suite (9): gate + wake lifecycle ·
  double-enter/early-wake rejection · **planted-contradiction reconciliation (exactly one
  active fact survives, old one soft-deleted)** · day+week diaries · persona update with
  dream-source audit · key cascade + delimiter-absence · per-step trace durability ·
  pending-intent (no dream activity before `turn.result`) · boot reconciliation.
- Real-LLM smoke (full cycle ×2): built memory in chat → `dream.enter` → six steps ran
  (`persona_update:ok / run_diaries:ok / rag_refresh:ok`; `memory_audit` reconciled when
  given material — and on one run was correctly `skipped` because Luna had **already
  self-reconciled live** via the remember tool) → `chat.send` while parked → `dreaming` →
  wake → coherent replies. DB evidence: a real first-person diary row ("Today we finished
  the dream engine. After all the back-and-forth, the false starts…"), dream-updated
  `self_state` + `relationship_status`, parked `dream_state`, full step report.

Inference:

- **Initiative 2 (memory + dream substrate) is complete.** Luna now has the full loop her
  positioning requires: she remembers (L3 + core), recalls by meaning (hybrid), survives
  restarts (L1/L2), and consolidates offline (dream) — with the live hot path making zero
  synchronous memory LLM calls and the prompt cache surviving by construction.
- The isolation contract is stricter than Python's in two places (pending-intent trigger,
  boot reconciliation) and equal where Python's hard-won fixes mattered (content-filter
  prompts, key cascade) — the audited "port the lessons, not the accidents" line held.
- Deviation from plan, documented: the pending-dream check lives in `ws.ts`'s post-turn
  continuation rather than `runTurn`'s finally — same semantics (strictly post-finalize),
  cleaner emit reuse, no dream import inside the turn loop.

### `v0.4.3` — 2026-06-12 — Hybrid recall (sqlite-vec + CJK lexical)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Spike first** (`scripts/spike-sqlite-vec.ts`): `Database.setCustomSQLite` + sqlite-vec
  0.1.9 load + vec0 KNN verified live on this machine — PASS, vec0 primary path GO.
- Added `memory/recall/` (4 files, ~330 LOC): `vecRuntime.ts` (guarded `initCustomSqlite` —
  process-global, once, before any Database; `tryLoadVec` with remembered failure),
  `embed.ts` (~60 LOC fetch client for OpenAI-compatible `/v1/embeddings` — deliberately
  NOT the cut `openai_compat` adapter; batch ≤64; f32-LE BLOB layout shared by vec0 and the
  TS path; sha256 `contentHash`; `cosine`), `lexical.ts` (ASCII words + **CJK sliding
  bigrams** + stopwords, ported approach from Python `semantic_retrieval`), `recall.ts`
  (`retrieve` = hybrid 0.7·cosine + 0.3·lexical + recency boost over L2 tail + live L3
  facts; soft-deleted excluded; embedding outage → lexical-only; `MAX_EMBED_PER_TURN=64`
  cold-cache cap until dream's `rag_refresh`; `renderRecallBlock`).
- vec0 virtual table (`vec_cache`) is **derived data created lazily at runtime** keyed to
  `embeddings_cache.rowid` — migrations must not depend on a loadable extension.
  `0005_embeddings.sql` ships only the regular `embeddings_cache` table. Embedding-only
  vec0 columns (the #274 metadata-col bug avoidance).
- `runTurn.parse_input`: recall block injected as a `<memory>` text block **inside the user
  message** (message level, after the cached prefix); user turns persist as-sent.
  `bunfig.toml` gains `[test] preload` (`test-preload.ts` → `initCustomSqlite` before any
  test constructs a Database). `main.ts` calls `initCustomSqlite()` before `openDb`.
- Env: `LUNA_EMBEDDING_MODEL` / `LUNA_EMBEDDING_API_KEY` / `LUNA_EMBEDDING_BASE_URL`
  (+ `.env.example`), `LUNA_MEMORY_RETRIEVAL_K` (12), `LUNA_MEMORY_EMBEDDING` (=0 →
  lexical-only, zero API).
- Tests: 102 across 18 files (was 93). New recall suite (9): CJK bigram tokenize · Chinese
  lexical no-API · paraphrase semantic hit (deterministic fake embed client) · hash-cache
  no-re-embed · recency tie-break · soft-deleted excluded · renderRecallBlock · **system
  prompt byte-identical across different queries** (recall is message-level — the cache
  invariant holds).
- Real-API smoke: "what hot drink hobby did I mention?" hit the espresso L2 row with
  **zero shared keywords** (true semantic match via text-embedding-3-large, 3072-dim);
  `embeddings_cache` 3 rows + `vec_cache` 3 rows (vec0 live in production code).

Inference:

- Luna can now recall by meaning, in two languages, with a graceful degradation ladder:
  vec0 KNN → TS cosine over the same BLOBs → pure CJK/ASCII lexical — each step a silent
  fallback, no configuration coupling.
- The cache invariant survived its hardest test: per-query retrieval content rides the
  user message; the system prompt never varies with the query. TS goal #1 (latency via
  prefix cache) and Luna's memory coexist by construction.

### `v0.4.2` — 2026-06-12 — L3 semantic store + prose core memory

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Protocol: `L3Category` (5 Python-parity categories), `L3Confidence`, `L3Fact`
  (with `deleted_ms` + `expires_ms`), `CoreMemory` (prose `self_state` +
  `relationship_status`). `migrations/0004_l3_core.sql`: `l3_facts` (+ category/dedup
  indexes), `core_memory` (single row, seeded), `core_memory_audit` (append-only).
- `memory/l3Store.ts` (~90 LOC): `addFact` (punctuation-normalized `dedupKey` port of
  Python's `_dedup_key`; prefixed ids `cf_/pf_/km_/at_/pc_`; `active_threads` get a
  14-day TTL), **`forgetFact` = soft delete** (`deleted_ms`, never removes the row — the
  deliberate divergence from Python's hard-delete `ForgetTool`), `listFacts` with
  **`asOf` time-travel** (deleted facts visible when valid at that time).
- `memory/coreMemory.ts`: `getCore` / `updateCore` (audit-first: prior state recorded
  before every write) / `restore(n)`. Prose only — no 5-field structure, no consistency
  tripwire (Alan decision E + kept-undo compromise).
- `memory/renderCoreBlock.ts`: the **stable** memory prefix (core memory + per-category
  render-capped facts with `[id]` handles + a one-line remember-tool hint). Deterministic
  — no timestamps. Render caps = Python's storage caps (15/10/12/6/8); storage stays
  unbounded until dream prunes.
- `remember` tool rewritten: discriminated `action: add | forget | update_self` input
  (the cut-list's four-tools-into-one, final shape), SQLite-backed via the seam,
  `session-serial`; unconfigured seam → structured err, never a throw.
- `runTurn`: `buildSystemPrompt(session)` composes `[placeholder + core block]` as
  `TextBlockParam[]` with a **`cache_control: ephemeral` breakpoint**;
  `ProviderRequest.system` widened to `string | TextBlockParam[]`; user turns now persist
  as content-block arrays (as-sent fidelity, ready for v0.4.3's message-level recall
  block); `complete()` gains adaptive thinking.
- Env: `LUNA_MEMORY_INJECT` (default on). Test fixtures switched to real `migrate()`.
- Tests: 93 across 17 files (was 84). New: l3 suite (7 — soft-delete + asOf, dedup +
  re-add-after-forget, TTL, audit + restore, render determinism, **byte-identical system
  prompts across no-change turns / differing after a change**), remember suite rewrite (5).
- Manual smoke (real LLM): "remember my cat is named Mochi" → model called the tool,
  **chose `core_facts` itself**, L3 row landed; restart → "What is my cat called?" →
  **"Mochi"**.

Inference:

- Luna now has self-managed durable memory with the prompt-cache invariant enforced by
  test: the system prompt changes only when memory changes. The `[id]` handles in the
  rendered block are what lets the model `forget` precisely — the supersede loop
  (forget old + add new) is now mechanically possible for both the model (live) and
  dream's `memory_audit` (v0.5.0, bulk).
- Soft-delete + `asOf` makes "this was once true" a first-class query — the time-travel
  substrate dream reconciliation and future temporal reasoning both stand on.

### `v0.4.1` — 2026-06-12 — L1 rolling window

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/memory/l1Window.ts` (~110 LOC): `buildActiveContext` (bounded
  view sent to the model — `[<conversation_summary> user message?] + history.slice(lowWater)`;
  `session.history` itself is never truncated), `planFold` (chooses **whole L2 turns** so the
  fold boundary always lands at a turn start, never splitting tool_use/tool_result pairs;
  fold input comes from L2 `user_text`/`assistant_text` columns — never from
  `rollingSummary`), `maybeFold` (**async fire-and-forget**, scheduled in `runTurn`'s
  finally after trace flush; CAS-committed).
- `migrations/0003_l1_window.sql`: `sessions` += `rolling_summary`, `window_low_water`.
  `sessionStore.commitFold` appends the summary chunk via SQL `||` concat with
  `WHERE window_low_water = :expected` — CAS failure = `changes === 0`, fold discards.
- `Provider` interface gains **`complete(req): Promise<{text, usage}>`** (non-streaming;
  shared by this fold and v0.5.0's dream): `AnthropicProvider.complete` via
  `messages.create`, constructor gains optional `apiKey` (dream's key cascade = two provider
  instances); `MockProvider` gains `completeResponder` + request capture.
- `runTurn.open_stream` now sends `buildActiveContext(session)` instead of raw history.
- Env: `LUNA_L1_WINDOW` (default on), `LUNA_L1_KEEP_MSGS` (24), `LUNA_L1_FOLD_BATCH_MSGS` (12).
- Tests: 84 across 16 files (was 78). New l1Window suite (6): bounded@40turns ·
  **no-re-compression invariant** (second fold input excludes the first summary's marker
  text) · deterministic plan from same L2 · `LUNA_L1_WINDOW=0` passthrough ·
  fold-never-blocks (gated in-flight fold + live turn completes; fold lands after) ·
  CAS stale-fold discard (fast fold wins, slow fold returns false).

Inference:

- **The compression-drift trap is structurally closed**: summaries only ever grow by
  appending chunks derived from verbatim L2 text; existing summary text is never an input
  to summarization. The hot path keeps zero synchronous memory LLM calls (the fold runs
  post-`turn.result`) — both audited TS-line constraints hold by construction, with tests
  guarding each.
- Corrects the Python port hazard flagged in the roadmap audit: Python ran its fold in an
  aux thread pool, and the async property was nearly lost in translation. Here it is
  explicit, CAS-protected, and test-pinned.

### `v0.4.0` — 2026-06-12 — Memory substrate foundation

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/protocol/src/memory.ts` (Zod `L2Turn` + `SessionRow`) and
  `packages/server/src/memory/sessionStore.ts` (~100 LOC): `setMemoryDb()` injection seam
  (mirrors `setTraceStore` — unset → all functions no-op, existing test suites run unchanged),
  `loadSession` / `persistSession` (upsert) / `appendL2` / `listL2`.
- **Migrations unified into one shared dir** `packages/server/src/migrations/`:
  `0001_traces.sql` moved from `trace/migrations/` (number is the identity — path is never
  recorded, so existing DBs are unaffected), new `0002_memory.sql` (`sessions`, `l2_turns`
  + `(session_id, t_ms)` index). `migrate()` now throws on duplicate migration numbers
  (they would otherwise be silently skipped). Trace test fixture paths updated.
- `session.ts` hydrates from SQLite on first `getSession` when the seam is set; `Session`
  gains `pendingDream: string | null` (reserved for v0.5.0). `runTurn` snapshots history
  length at turn start and persists the turn's full as-sent slice to L2 (`raw_json`) +
  upserts the session in its `finally` — signed thinking blocks survive restarts verbatim.
- **Mutex unification (audit finding H)**: deleted `dispatcher.getSessionMutex` (the second,
  parallel per-session mutex map); both ws paths (`chat.send` and `dev.dispatch_tool`) now
  feed `DispatchContext.sessionMutex` from the single `getSession(id).mutex`.
- Env: `LUNA_PERSIST` (default on; `=0` keeps sessions in-memory). Wiring in `main.ts` only.
- Tests: 78 across 15 files (was 73). New: sessionStore (4 — restart-survival incl. signed
  thinking + tool_use round-trip, L2 ordering + raw_json fidelity, ephemeral seam, upsert),
  sql duplicate-number throw.
- Manual smoke (real LLM, two boots, one DB): told her "My name is Alan", killed the server,
  rebooted, asked "What is my name?" → **"Alan"**. DB after: schema v2, `turn_seq=2`, 2 L2 rows.

Inference:

- **Luna survives restarts** — the foundational property of Initiative 2, proven end-to-end
  against the real gateway. History persists as the exact Anthropic content blocks the model
  produced (signature validation keeps working on resumed conversations).
- Collapses Python v0.52 (single-writer) + v0.53 (full-text archive) into one version:
  SQLite WAL + the unified session mutex give single-writer structurally, with no lock
  machinery to port.
- L2 is now the ground-truth corpus that v0.4.1's fold derives from, v0.4.3 embeds, and
  v0.5.0's diaries summarize — everything downstream reads from here.

### `v0.3.6` — 2026-06-11 — Local trace viewer

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/trace/viewer.ts` (~45 LOC): `traceViewerHandler(req, store)`
  returns a `Response` for `/_trace` (static HTML), `/_trace/api/turns?limit=`,
  `/_trace/api/events?turn_id=` (parses `payload_json` on the way out), or `null` for
  non-`/_trace` paths so the caller falls through to the WS upgrade. Read-only; shares the
  boot `Database` via the trace store (no second connection).
- Added `packages/server/src/trace/viewer/index.html` (~210 LOC, vanilla — no framework, no
  build step): two-pane layout (turn list / per-turn timeline), color-coded event kinds
  (node / tool / outbound / overflow), `+Nms` relative offsets, click-to-expand
  `payload_json`, 2s auto-refresh.
- `main.ts`: composes the fetch handler **before** `Bun.serve` — viewer handler first (when
  `LUNA_VIEWER !== '0'`), then WS upgrade, then 426. `getTraceStore()` added to instrument
  for the shared-store reference.
- **`LUNA_TRACE` default flipped on**: `traceEnabled()` now returns true unless
  `LUNA_TRACE === '0'` (v0.3.5 was opt-in `=== '1'`). Tracing is on by default now that a
  viewer makes it useful.
- Tests: 73 across 14 files (was 68). New: viewer (5 — HTML 200, turns newest-first, events
  parsed/ascending, unknown subpath 404, non-`/_trace` → null). `instrument.test.ts` updated
  for the default-on semantics (explicit `LUNA_TRACE=0` opt-out test).
- Manual smoke: real LLM turn (tracing on by default) → `/_trace` serves HTML, turns API
  shows the 22-event turn, events API returns node:9 / outbound:11 / tool:2; WS ping/pong
  unaffected with the viewer mounted; `LUNA_VIEWER=0` makes the server WebSocket-only
  (`/_trace` → 426).

Inference:

- **Initiative 1.5 (observability foundation) is complete.** Luna now has the
  Mastra-Telemetry / LangSmith-equivalent layer the roadmap placed deliberately *before*
  memory (v0.4): every turn is a replayable, browsable event tree. Memory bugs that ship in
  v0.4+ now have a timeline to debug against instead of being a black box.
- The viewer's left-list / right-detail shape is a candidate pattern for a v0.12 frontend
  debug overlay, but nothing downstream hard-depends on it yet.
- Deliberate divergence from the plan's acceptance: `LUNA_VIEWER=0` yields **426** (the
  server becomes genuinely WebSocket-only — the viewer handler is bypassed entirely) rather
  than 404. 426 is the more honest signal; the handler's own 404-for-unknown-subpath
  contract is still unit-tested.

### `v0.3.5` — 2026-06-11 — Trace plumbing

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/protocol/src/trace.ts` (~70 LOC): Zod `TraceEvent` discriminated
  union — `node` / `tool` / `outbound` / `overflow`, each carrying `schema_v: z.literal(1)`,
  `trace_id`, `turn_id`, `session_id`, `t_ms`. `TRACE_SCHEMA_V = 1`.
- Added `packages/server/src/sql.ts` (~50 LOC): generic `bun:sqlite` boilerplate —
  `openDb` (WAL + foreign_keys + busy_timeout per connection), `migrate(db, dir)`
  (applies `migrations/NNNN_*.sql` whose leading integer exceeds `PRAGMA user_version`,
  each in its own transaction; PRAGMA bump interpolated since PRAGMA can't bind),
  `closeDb`. **Zero trace-specific code — v0.4 memory substrate reuses it verbatim.**
- Added `packages/server/src/trace/` — `migrations/0001_traces.sql` (DDL + 2 indexes,
  no PRAGMA), `store.ts` (per-turn in-memory buffer, single-transaction flush on turn
  end, 500-event cap + `overflow` row, 4KB structured-wrapper truncation, read API
  `listTurns` / `getEventsByTurn`), `instrument.ts` (`trace()` single entry, `LUNA_TRACE`
  gate — default off in v0.3.5), `README.md` (instrumentation + migration discipline).
- Instrumented `runTurn.ts`: `onTransition` → node trace (the `open_stream` transition
  carries `{token_count, first_token_ms, thinking_summary}`); `dispatch_tools` loop tees
  each `ToolEvent` → tool trace; a `tracedEmit` wrapper records every `ServerEvent` as an
  outbound trace; `flushTrace` in the `finally`. **All three construction sites guarded by
  `traceEnabled()`** so the production default-off path builds zero discarded objects.
  Shipped `dispatcher.ts` and `outbound.ts` untouched.
- `main.ts`: opens SQLite at boot (`LUNA_DB_PATH`, default `./luna.sqlite`), runs
  `migrate`, sets the trace store, closes DB on SIGTERM. `.gitignore` += `*.sqlite*`.
- Tests: 68 across 13 files (was 57). New: sql (4 — migration idempotency/ordering/WAL,
  tmpdir), store (5 — buffer/flush/overflow/4KB-truncation/listTurns ordering),
  instrument (2 — full-turn node+tool+outbound rows keyed by turn_id, gate-off → no rows).
- Latency: per-turn absolute trace cost 0.15–0.5ms on a network-free synthetic bench
  (`scripts/trace-latency.ts`). End-to-end smoke: a real LLM turn wrote 24 rows
  (9 node + 13 outbound + 2 tool) under one turn_id.

Inference:

- **First persistence layer in the rewrite.** The `sql.ts` WAL + versioned-migration
  pattern is the one v0.4 memory work copies — getting it generic and reusable here means
  the SQLite substrate lands once, not twice.
- **Partially resolves Open Q #8**: every turn now carries a `trace_id` (= turn_id) and a
  replayable event tree. The full L1/L2 reasoning-decision tree is still deferred to v0.8,
  but the plumbing it will hang off now exists.
- **Resolves Open Q #4**: trace `payload_json` truncates at 4KB into a structured
  `{truncated, original_bytes, preview}` wrapper (never a byte-slice of serialized JSON).
  The dispatcher keeps pure per-tool `summarize` with no global tripwire — the locked
  direction from v0.2 holds.
- The synthetic-bench 5% gate from the plan was a measurement artifact (network-free turns
  run in ~5ms, so sub-ms persistence reads as 6–8%); the production-meaningful bound is the
  absolute per-turn cost, which against real 1000ms+ turns is <0.05%. The bench asserts the
  absolute budget and reports the synthetic % for transparency.

### `v0.3.0` — 2026-06-11 — Anthropic interleaved tool-use end-to-end

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/provider/` (3 files, ~140 LOC): `types.ts` (`ProviderEvent`
  union — `text_delta` / `thinking_delta` / `tool_use_start` / `message_stop` carrying
  `stopReason` + `toolUses` + verbatim `assistantContent` + usage), `anthropic.ts`
  (`AnthropicProvider` over `@anthropic-ai/sdk@0.104.1` exact-pinned; `messages.stream()`
  raw-event mapping; tool inputs taken from `finalMessage().content` — **no**
  `input_json_delta` accumulation; `maxRetries: 2` explicit), `mock.ts` (scripted rounds,
  per-request message snapshot).
- Added `packages/server/src/turn/` (3 files, ~280 LOC): `graph.ts` (inline 7-node
  StateGraph — `parse_input → build_request → open_stream → dispatch_tools →
  append_results → finalize → end`; `runGraph` with `onTransition` hook reserved as the
  v0.3.5 instrumentation seam), `session.ts` (in-memory `Session` with history /
  turnSeq / activeTurn / mutex; `'default'` id), `runTurn.ts` (node implementations;
  `MAX_TOOL_ITERATIONS = 8`; `zod-to-json-schema` with `$refStrategy: 'none'` for tool
  definitions; assistant content appended verbatim so signed thinking blocks survive;
  unknown tool names short-circuit to `tool_not_found` without dispatching).
- Extended wire contract: `ClientEvent` += `chat.send {turn_id?, text}`; `ServerEvent`
  += `turn.started`, `reply.token`, `turn.result {text, finish_reason, usage}` with
  `FinishReason` enum (`end_turn | max_iterations | max_tokens | refusal | error`).
- `ws.ts` gained the `chat.send` branch: one active turn per session
  (`turn_in_progress` error), `runtime_not_configured` guard, emit wrapper that
  swallows dead-socket sends so mid-turn disconnect cannot abort tool execution.
- `main.ts` constructs `AnthropicProvider` + `builtinRegistry` at boot when
  `ANTHROPIC_API_KEY` is set. Env: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`,
  `LUNA_MODEL` (default `claude-opus-4-8`), `LUNA_MAX_TOKENS` (default 8192).
  `.env.example` committed; real `.env` gitignored (values copied from Python Luna).
- Provider config: yunwu.ai gateway verified by an early 2-round smoke
  (`scripts/smoke-yunwu.ts`) — adaptive thinking with `display: 'summarized'` accepted,
  signed thinking blocks survive the tool_result round-trip, tool_use streams.
- **Deliberate divergence from Python**: Python Luna uses
  `LUNA_THINKING_BUDGET_TOKENS=2048`; `budget_tokens` returns 400 on `claude-opus-4-8`.
  TS uses `thinking: {type: 'adaptive', display: 'summarized'}`.
- Tests: 57 across 11 files (was 49). New: runTurn (6 — spec tests 1-6 incl.
  interleaving proof, iteration cap, dead-socket resilience, mid-stream provider
  failure), chat.send WS round-trip (2). Manual smoke: real dual-tool turn
  (`time_now` + `read_file`) over WS — 32 streamed tokens, 2 tool cycles, coherent
  reply, `finish_reason: end_turn`.

Inference:

- **Initiative 1 (tool spec foundation) is complete.** All six Python tool-instability
  root causes are now structurally closed: single always-mounted registry (no 5-path
  mount logic), 3-tool closed surface, discriminated `Result<T>` (no `startswith`
  heuristics), token streaming continues through tool calls (the perceived-latency win
  the rewrite was started for), typed wire contract end-to-end, hard iteration cap
  instead of reactive stall rules.
- The StateGraph shape means v0.3.5 instrumentation is one `onTransition` wire-up, v0.6
  `message_tool` swap is one node change, and v0.8/v0.10 insert nodes mechanically —
  the LangGraph-style orchestration alignment is now in code, not just on the roadmap.
- Verbatim `assistantContent` in history is load-bearing: reconstructing thinking
  blocks from deltas would break Anthropic's signature validation on the next request.
  The early gateway smoke de-risked this before the graph was built on top.

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
