# Initiative 2 — Memory + Dream Substrate (v0.4.0 – v0.5.0)

> **Status: PLANNED — next up (execution Order 2).** Version range **v0.4.0 → v0.5.0**.
> Merges the old "memory substrate" (Initiative 2) and "dream engine" (old Initiative 7) into
> one initiative — dream **is** the consolidation engine that memory needs, so they ship
> together. Master: [`../README.md`](../README.md).

## The idea

Luna restarts and forgets everything today (`session.ts` is an in-memory `Map`). This initiative
gives her a persistent, three-layer memory on SQLite, plus the **dream** — an isolated background
consolidation mode that digests the day, reconciles long-term facts, and updates her sense of the
relationship. It is a **port of Python Luna's shipped `memory-redesign-dream` initiative
(v0.52–v0.57)**, not a fresh design: that system has been through production, hit real failure
modes (content-filter trips, rate-limit cascades, no-op flashes), and accreted the fixes. We
inherit the proven shape and the SQLite substrate from v0.3.5's `sql.ts` lets us collapse several
Python versions.

## Why this initiative, and why now

Per the master [ordering philosophy](../README.md#ordering-philosophy): memory is table-stakes,
and it must land **before** persona/humanity (Initiative 3) and proactive (Initiative 5) because
both sit on top of it — humanity caps constrain what gets remembered; proactive idle behavior
shares scheduling with dream. It lands **after** observability (1.5) so memory bugs are traceable
from day one (a memory turn writes node/tool/outbound traces already).

**Dream merged in, not deferred to v0.14:** the old roadmap parked dream at Initiative 7 (v0.14+).
That was wrong — dream is not a late luxury, it is the only place reconciliation, diaries, and
core-memory updates happen. Memory without dream is a store with no consolidation: facts pile up,
contradictions coexist, diaries never get written. So dream is the **capstone of this initiative
(v0.5.0)**, right after the three layers exist for it to write into.

## Locked design decisions referenced

From [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- **Persistence: SQLite (+ `sqlite-vec` for embeddings).** All four Python storage forms (L3
  JSON, L2 JSONL timeline, day/week/month summary JSON, dream-state JSON) become SQLite tables.
- **Zod single source of truth.** Memory record types (`L2Turn`, `L3Fact`, `CoreMemory`,
  `DiaryEntry`, `DreamState`) live in `packages/protocol` as Zod schemas → TS types + runtime
  validation, same discipline as `events.ts` / `trace.ts`.
- **Single user.** No `user_id` threading; one `'default'` session. This is *why* the port is a
  减法 — Python's memory machinery defended against cross-session write concurrency that does not
  exist for a single companion user.
- **LD #11 / #12 / #13** (added with this initiative — see REWRITE_CONTEXT): memory+dream are one
  initiative; 3-layer model with diary-as-dream-output + prose core memory; hybrid recall.

## Verified architectural facts (TS source, read 2026-06-12)

Hook points this initiative builds on, confirmed from shipped code:

1. **`sql.ts` is reusable verbatim** — `openDb` (WAL + foreign_keys + busy_timeout),
   `migrate(db, dir)` (applies `migrations/NNNN_*.sql` above `PRAGMA user_version`), `closeDb`
   ([`packages/server/src/sql.ts`](../../../packages/server/src/sql.ts)). Built generic in v0.3.5
   precisely so this initiative reuses it. Add `migrations/0002_memory.sql` etc.
2. **`session.ts` is the L1 swap point** — `getSession(id)` returns an in-memory `Session
   { id, history: Anthropic.MessageParam[], turnSeq, activeTurn, mutex }`
   ([`packages/server/src/turn/session.ts:14`](../../../packages/server/src/turn/session.ts)). The
   `getSession`/(new)`saveSession` seam is where SQLite backing lands. `history` is stored as
   Anthropic `MessageParam[]` — persist it as-is (v0.3 note: don't invent a parallel shape).
3. **`remember` tool is the L3 write seam** — currently `kind: 'fact'|'preference'|'moment'`,
   in-memory `Map<sessionId, Item[]>`
   ([`packages/server/src/tools/builtin/remember.ts:4`](../../../packages/server/src/tools/builtin/remember.ts)),
   with a `// v0.4 will move this to SQLite` marker on line 31. Upgraded here to SQLite-backed L3
   with categories + a `forget` action (the cut-list's "one `remember` tool with a discriminated
   input" — final shape `action` + `category`, superseding the early `input.kind` sketch).
4. **`runTurn.build_request` is the injection point** — the system prompt is currently a
   placeholder constant `SYSTEM_PROMPT_PLACEHOLDER`
   ([`packages/server/src/turn/runTurn.ts`](../../../packages/server/src/turn/runTurn.ts)). The L3
   semantic block + core memory get prepended here. v0.3 left a note: "wire it through a single
   `buildSystemPrompt(session)` function so the substitution lands in one place."
5. **`dispatchToolCalls` concurrency** — `remember`/`forget` are `session-serial`
   ([`packages/server/src/tools/dispatcher.ts`](../../../packages/server/src/tools/dispatcher.ts));
   the single-writer property Python added a global lock for is **free** here via SQLite WAL +
   the existing session mutex.

## Python parity notes (read from source 2026-06-12)

Each cited from the shipped Python at `/Users/alanyu2077/Desktop/Agent_Luna`. We **port the shape,
diverge on storage and a few deliberate choices.**

- **Layer model (Alan-locked 2026-06-10, `memory-redesign-dream-2026-06/README.md:29-34`):**
  L1 = 会话级活跃上下文 (live thread + rolling summary); L2 = 全量化存档 + 日记周记 (full-text
  archive; diaries generated from it, RAG-recallable); L3 = 长期记忆 (durable facts Luna
  remembers/forgets herself). **Diary is a dream OUTPUT living in L2, not a 4th layer.**
- **Dream steps (`dream.py:728-735`):** `refine_semantic` (L3 de-dup/supersede) → `refine_layer1`
  (L1 summary) → `memory_audit` (review L3 vs dialogue → forget stale ids + remember new) →
  `persona_update` (update self-state) → `run_diaries` (day/week/month backfill) → `rag_refresh`
  (warm embedding cache).
- **Reconciliation = remember/forget supersede, NOT in-place UPDATE** (`dream.py` memory_audit;
  `README.md:43` "remember/forget becomes reasoning-constrained"). To correct a fact: forget old
  id + remember new. We keep this — it preserves "this was once true" via the audit trail.
- **L3 categories + caps (`semantic_memory.py:42-46`):** core_facts 15 / preferences 10 /
  key_moments 12 / active_threads 6 (TTL-expire) / project_context 8. Port the categories; confirm
  caps at build.
- **Trigger = manual + tool + manual-wake** (`v0.55.0`, DEVELOPMENT.md): 🌙 button →
  `/api/dream/enter`; `enter_dream` tool Luna can call; parks at `finished_idle`, explicit `wake()`
  required. **Auto-idle trigger was written (`v0.56.0-dream-autotrigger.md`) but deliberately
  DEFERRED** — "until the manual v0.55 dream is proven in use." We follow the same staging.
- **Wake is LLM-free (`v0.53.0`):** the live turn does zero memory LLM work; all consolidation is
  in dream. This is *why* there is no per-turn memory call (resolves old Open Q #7).
- **Two production gotchas we inherit (same yunwu.ai gateway):**
  (a) `<<<MEMORY_BEGIN>>>`-style delimiters trip yunwu's content filter (`v0.56.1`) — use
  natural-language section headers in dream prompts;
  (b) the summarizer key can hit per-group rate limits — two-attempt cascade (summarizer key →
  default key) (`v0.56.2`). Python `.env` has `LUNA_SUMMARIZER_API_KEY`.

### Deliberate divergences from Python

> Python is the **reference**, not the template. Where its design was a workaround or its
> environment lacked a constraint TS has (prompt caching above all), TS takes the better path.

| Python | TS | Why |
|---|---|---|
| JSON/JSONL files under `.workspace/luna/memory/` | SQLite tables | LD: SQLite locked. Fixes Python's unbounded-JSONL + linear-scan-recall gap for free (indexed) |
| Single global `MEMORY_LOCK` (RLock) | SQLite WAL + `session-serial` mutex | Single-writer is structural, not a lock we add |
| Recall: lexical-first, embedding opt-in (`LUNA_MEMORY_EMBEDDING=0`) | embedding-first via `sqlite-vec`, CJK-bigram lexical as hybrid fallback | `sqlite-vec` is locked; keep lexical for CJK robustness + offline |
| `self_model` = 5 structured fields + `self_history.jsonl` rollback | **prose `self_state` + lightweight SQLite audit table + `restore(n)`** | Alan decision E (prose) + keep the undo Python got cold feet about retiring (v0.57.0 deferral). Confirmed 2026-06-12 |
| `ForgetTool` = hard delete from L3 JSON | **soft delete** (`deleted_ms` time-validity on `l3_facts`; recall filters; `asOf` time-travel) | "This was once true" stays first-class, queryable — not buried in an audit log. Audit table is core-memory-only. Alan-endorsed in the design conversation |
| Memory block re-sent as per-turn system messages (no caching concern) | **cache-aware split**: stable core block in system prompt before a `cache_control` breakpoint; per-query recall block at message level after the cached prefix | A byte-varying system prompt invalidates the Anthropic prefix cache every turn — taxing the latency the rewrite exists to win. Python never had this constraint; TS lives by it |
| L1 fold summary in an aux thread pool | **async fire-and-forget post-`finalize`** with CAS commit; hot path makes zero synchronous memory LLM calls | Same intent, made explicit and tested (the async property is load-bearing; v0.4.1 test 5 guards it) |
| Dream = bespoke step list + daemon thread; `enter_dream` starts the thread mid-tool (tail-race window) | dream = **second StateGraph** on the generalized `runGraph` (per-step trace via `onTransition`); `enter_dream` sets a **pending intent**, cycle starts post-`finalize` | Sequential step-runners are the shape this codebase rejected at v0.3; isolation is absolute, no overlap window at all |

## The hard part

- **Prompt-cache discipline (TS goal #1):** the top-level system prompt must stay byte-stable
  across turns except on real memory updates. Anything per-query lives at message level after the
  cached prefix. Every version that touches injection carries a MockProvider byte-identity test.
- **Hot path stays LLM-free:** no synchronous memory LLM call on a live turn, ever. The single
  sanctioned async exception is the v0.4.1 L1 fold (post-`finalize`, fire-and-forget, CAS-committed),
  and dream's `refine_layer1` supersedes it.
- **SQLite migration discipline** (inherited from `trace/README.md`): never edit a shipped
  migration; add `NNNN+1_*.sql`. `migrate()` owns the version bump; migration files are DDL-only.
- **Dream isolation contract:** consolidation must never overlap a live turn — including the turn
  that triggered it (`enter_dream` = pending intent, starts post-`finalize`). On the single WS,
  `chat.send` while dreaming is rejected, not interleaved.
- **Compression drift (L1):** the one real correctness trap — never re-compress already-compressed
  content. Recent N verbatim; older content compressed **once**; re-derive from L2 when accuracy
  matters. L2 is the only ground truth.
- **Reconciliation correctness:** memory_audit must supersede (soft-forget + remember), never
  silently duplicate or randomly pick between contradictory facts. This is the character's coherence.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [Memory substrate foundation](v0.4.0-memory-substrate.md) | v0.4.0 | SQLite-backed `Session` (L1 persistence) + L2 full-text timeline table; reuse `sql.ts`; single-writer free via WAL | Medium | v0.3.6 | ⏳ planned |
| [L1 rolling window](v0.4.1-l1-rolling-window.md) | v0.4.1 | recent-N verbatim + compress-once rolling summary; never re-compress; L2 re-derive | Medium | v0.4.0 | ⏳ planned |
| [L3 semantic + core memory](v0.4.2-l3-semantic-core.md) | v0.4.2 | SQLite L3 (5 categories) + `remember`/`forget` tool upgrade + prose core memory (self_state + relationship_status + audit/restore) + per-turn injection block | Medium-High | v0.4.0 | ⏳ planned |
| [Hybrid recall (RAG)](v0.4.3-hybrid-recall.md) | v0.4.3 | `sqlite-vec` embedding-first + CJK-bigram lexical over L2 full-text + L3 facts | Medium | v0.4.2 | ⏳ planned |
| [Dream engine](v0.5.0-dream-engine.md) | v0.5.0 | manual (WS + `enter_dream` tool) + manual-wake isolated dream: refine_semantic / refine_l1 / memory_audit / persona_update / run_diaries (day/week/month) / rag_refresh; dream gate on single WS | High | v0.4.3 | ⏳ planned |

**Deferred (no number reserved yet): dream auto-trigger.** Lands **after Initiative 5 (proactive,
v0.10–v0.11)** because it reuses the proactive idle scheduler that does not exist until then — the
same coupling Python's `v0.56.0-dream-autotrigger` relied on (`_handle_idle`). Includes the
too-long-since-dream safety net for always-on users and graceful wake-on-input. Manual dream
(v0.5.0) must be proven first.

## Acceptance criteria for this initiative

When v0.5.0 ships:

- [ ] Luna survives a server restart with full conversation history (L1 + L2 persisted).
- [ ] L2 holds the full-text of every turn; L1 active window stays bounded without re-compression
  drift (verified by deriving the same summary twice from L2 yields stable output).
- [ ] `remember`/`forget` write to SQLite L3 with categories (`forget` = soft delete with
  time-validity); the stable core block is injected in the system prompt, per-query recall at
  message level.
- [ ] **Prompt cache survives memory**: consecutive turns without memory changes produce
  byte-identical system prompts (test-asserted), and a manual smoke shows
  `usage.cache_read_input_tokens > 0` on follow-up turns.
- [ ] Recall returns relevant L2/L3 results via `sqlite-vec` with CJK-bigram fallback; a Chinese
  temporal query ("上周聊了啥") returns sensible hits; soft-deleted facts only via `asOf`.
- [ ] A manual dream (WS command or `enter_dream` tool) runs the 6-step graph, reconciles a planted
  contradiction (soft-forget old + remember new — never both active), writes a day diary, updates
  core memory, and parks at `finished_idle` until wake. `chat.send` during dream is rejected, not
  interleaved — and a tool-triggered dream starts only after its own turn's `turn.result`.
- [ ] No synchronous memory LLM call on a live turn (the async L1 fold is the sanctioned exception;
  dream supersedes it).
- [ ] Every memory + dream operation is traced (v0.3.5 plumbing; dream under `dream:<cycle_id>`
  with per-step flushes) and browsable at `/_trace`.

## Open questions blocking start

From [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- ~~**Q6 — Dream engine scope / trigger**~~ → **RESOLVED** by this initiative + LD #11: in scope,
  merged here; manual + `enter_dream` tool + manual-wake first; auto-idle deferred to post-proactive.
- ~~**Q7 — Per-turn memory write call**~~ → **RESOLVED** by the LLM-free-wake design (Python v0.53):
  no per-turn memory LLM call; all consolidation in dream.
- **self_model shape** → **RESOLVED 2026-06-12**: prose `self_state` + lightweight SQLite audit +
  `restore(n)`. Captured as a divergence above and in v0.4.2.
- **Q9 — model-callable `recall` tool** (agentic memory search) → **parked, non-blocking**: v0.4.x
  ships injection-only recall; revisit after LD #9 (message_tool, v0.6) settles the tool-surface
  interaction patterns. Named here so it doesn't silently disappear.

No remaining blockers. v0.4.0 can start once Initiative 1.5 is the shipped head (it is).
