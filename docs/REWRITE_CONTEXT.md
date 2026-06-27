# Rewrite Context — facts and decisions

This file captures (a) the audited reality of Python Luna that drives this rewrite, (b) the design
decisions already locked, and (c) the questions still open. Anything claimed here should be
verifiable against the Python source at `/Users/alanyu2077/Desktop/Agent_Luna` or against
`docs/history/DEVELOPMENT.md` there.

> The original audit was a 15-dimension multi-agent ground-truth pass run on 2026-06-11 against
> Python Luna v0.47.9. The findings below are the high-signal subset that actually shapes v2.

---

## Why we are rewriting (the two goals)

1. **End-to-end response latency.** Python Luna's hot path has 17 distinct latency sources, the
   four largest of which are structural and cannot be incrementally fixed:
   - Token streaming silently disabled on any tool-enabled turn (`agent_loop.py:835-840` + Anthropic
     adapter `382-386` wraps blocking call as one `StreamDelta`).
   - `_stream_reply_segments` paces multi-segment replies via blocking `time.sleep` on the HTTP
     request thread (`server.py:169/174`, default 4000ms per continuation).
   - All non-streaming `/api/chat` traffic serializes through a single `AgentLoopThread` daemon.
   - Mid-stream failure catches broad `Exception` and re-runs as blocking → silent 2x token spend.
2. **Typed wire contract.** The current SSE protocol has three documented silent-drift cases:
   `tts.segment` frontend handler early-returns on `interim:true` (so the sticky-provider/voice
   mechanism the wire contract assumes is dead code); `build_proactive_events` always emits
   `turn.result` but `renderProactiveEvent` ignores it; the frontend has a `turn.completed` handler
   whose backend emission site lives in `turn_planner.py:259` but is not audited as part of the
   contract. A shared typed schema makes each of these a compile error.

---

## Locked design decisions

| Decision | Choice | Why (short) |
|---|---|---|
| Runtime | **Bun** | Native TS, `bun:sqlite`, native WebSocket, sub-50ms cold start |
| Wire | **Single WebSocket per session** | Kills per-turn TCP teardown + unifies chat / proactive / tool-approval / Live2D commands onto one channel |
| Persistence | **SQLite** (+ `sqlite-vec` for embeddings) | Eliminates single-JSON-rewrite cost on semantic memory + linear-scan recall on timeline |
| Validation | **Zod** (one schema → TS type + JSON Schema + runtime validation) | Single source of truth for the contract |
| Single user | **Yes** | Luna is a companion; multi-user is not a v2 goal |
| LLM provider | **Anthropic via official SDK (default)**; **OpenAI Chat-Completions provider** behind the `Provider` seam — Initiative 16 (v0.23.x) | **Amended v0.23.0.** Originally "Anthropic-only; drop `openai_compat`" — but that cut was specifically for the Python adapter's broken `api_key_override`. A *fresh* TS `OpenAIProvider` takes `apiKey` per-instance (like `AnthropicProvider`, `provider/anthropic.ts:40`), so the bug doesn't recur and the dream summarizer-key isolation holds; chat is therefore no longer Anthropic-only. Selected by `LUNA_PROVIDER` via `providerFor()`; default path byte-unchanged; `cache_control` is stripped on the OpenAI path (auto-cache, not explicit). Embeddings (LD #13) unaffected. The runtime `mock` provider stays cut; `MockProvider` is a test-only seam. |
| Frontend scope | **TS-port `agent-app.js` controller only** | Live2D rendering + audio pipeline + GPT-SoVITS proxy stay as-is (cost/benefit) |
| Tool streaming | **Anthropic interleaved tool-use SSE** | Token streams continue through tool calls — the biggest single perceived-latency win |
| Outbound action shape | **Everything-as-tool** (`message` tool + all side-effect tools; no top-level `text`; reasoning via Claude `thinking` blocks) | Unified action space + forcing function for tool infra quality + Live2D metadata envelope natural. **Resolves Open Q #3.** Introduction in v0.6. See LD #9 detail below. |
| Risky-tool mount policy | **Always-on + deny-regex** inside the tool (no judgment-gated mounting; no `mountedWhen` predicate on `defineTool`) | 1 fewer LLM call per turn vs judgment-gated; matches Mastra/LangGraph/Aider; deny-regex provably testable. **Resolves Open Q #1.** Locked at v0.2 design review; applies to `shell` when it ships at v0.4+. |
| Memory + dream are one initiative | **Merge** the memory substrate and the dream engine into Initiative 2 (v0.4.0–v0.5.0). Dream is the consolidation engine memory needs; manual + `enter_dream` tool + manual-wake first, **auto-idle deferred** to Initiative 5 (proactive) which owns the idle scheduler. Wake is LLM-free for memory. Reconciliation = reasoning-gated remember/forget supersede, **not in-place UPDATE**. | **LD #11. Resolves Open Q #6.** Port of Python's shipped v0.52–v0.57. See LD #11 detail below. |
| Memory layer model | **3 layers** — L1 (会话级活跃上下文: live thread + rolling summary) / L2 (全量化存档 + 日记周记: full-text archive, diaries generated from it) / L3 (长期记忆: durable facts Luna remembers/forgets). **Diary (day/week/month) is a dream OUTPUT living in L2, not a 4th layer.** Plus a prose **core memory** (self_state + relationship_status), always-injected, dream-updated, with a lightweight SQLite audit + `restore(n)`. | **LD #12.** Alan-locked layer defs (Python `memory-redesign-dream/README.md:29-34`); supersedes the earlier "four-layer (L1/L2/L3/diary)" wording. **AMENDED v0.17.0 (Initiative 10, owner correction per `MEMORY_DESIGN_DIVERGENCE.md`):** L1 active window = **~100 verbatim *turns*** (env `LUNA_L1_RECENT_TURNS`, 40–150), not a message cap; older history compresses to a **structured, size-bounded digest with importance anchors** (LLM-rated salience), replacing the unbounded `rolling_summary`. Supersedes v0.4.1's "12 pairs" default + messages unit. **AMENDED v0.17.1:** the **diary** is no longer "an L2 archive output, not injected" — it is an **injected long-range memory layer**: a standing day/week/month digest in the cached system block (`renderDiaryDigest`) **and** a recall candidate source (`collectCandidates` += `'diary'`), ranked by the Generative-Agents recency×importance×relevance score. Monthly diaries are generated. Closes `MEMORY_DESIGN_DIVERGENCE.md`. |
| Memory recall | **Hybrid, embedding-first**: `sqlite-vec` cosine + CJK-bigram lexical fallback + recency boost, over L2 full-text + L3 facts. Embeddings via a **minimal standalone fetch client** (Anthropic has no embeddings API) — this is *not* a resurrection of the cut `openai_compat` adapter, which targeted the chat-provider path; chat stays Anthropic-SDK-only. | **LD #13.** Diverges from Python (lexical-first, embedding opt-in) because `sqlite-vec` is the locked substrate; keeps lexical for CJK robustness + offline. |
| Reasoning constraints | **L1 thinking contract is the design, not gates.** Action integrity (言行一致 + 工具稳发) is achieved by: (1) the L1 thinking-contract block in the system core (commitment-to-act, tool-trigger checklist, proportionality), (2) structural/mechanical enforcement at the output boundary (`is_final` promise contract, intent-without-act guard — generalizations of the v0.6.2 empty-reply guard), (3) **async off-hot-path** defection audit producing decision traces. **No standing L2 gate harness is built**; a gate is hand-rolled only where a decision has no turn to ride (Initiative 5's proactive/self-continuation, at most). | **LD #14 (2026-06-13). LANDED v0.8.0–v0.9.0.** Corrects a Python misreading: Alan's original reasoning-constraint intent was *always* the thinking contract; Python's `reasoning-spec.md` L2 harness was a misinterpretation that got rationalized. Python's four principles survive where still apt (override-not-depend, inviolable rails, every decision logs, cheap-exit first); its machinery does not. **As shipped**: detection matches the *delivered message text* (not summarized thinking); the audit is synchronous-but-zero-LLM in `finally` (no extra LLM call); the guard runs in `finalize` with a watermark + one-retry-per-reason bound; the `recall` tool resolved Open Q #9 (v0.8.3); all three flags default on at v0.9.0 with `=0` escape hatches. See `docs/roadmap/action-integrity-2026-06/`. |
| Proactive = agency, not messaging | **Proactivity is autonomous tool use, not just sending check-in messages.** A proactive turn is a normal `runTurn` with a proactive framing and the **full tool surface**; the `message` tool is **optional** — Luna may act silently (recall, consolidate, dream, look something up) and surface to the user only when worth it. Triggers: idle ticks + scheduled wakeups (event-driven deferred). The Python 5-state machine survives only as a **cadence governor** (quotas/cooldowns/quiet-hours/DORMANT-recovery/restart-persistence); its message-only contract and its outbox/cursor/TTL/SSE-replay delivery layer are dropped (the single persistent WS makes them unnecessary). **Safety contract:** Alan chose full-tool-incl-`shell` autonomy, so an unsupervised loop is the highest-risk surface in the rewrite — governed by **reversible-silent / irreversible-surfaced** (reads/searches/memory/dream may run silently; irreversible/destructive actions must surface a message first), a `LUNA_PROACTIVE` kill switch (default off until proven), a per-cycle action budget, deny-regex on `shell` (LD #10), fail-closed classification for unknown tools, and full `proactive:<cycle_id>` tracing. The wake gate is the one legitimate L2 gate Initiative 4 deferred (a decision with no turn to ride), reusing its audit lane. | **LD #15 (2026-06-13). LANDED v0.10.0–v0.11.0.** Supersedes the earlier "port the proactive state machine" framing — audited against the 2026 ambient/[Hermes](https://hermes-agent.nousresearch.com/) proactive-agent paradigm at Alan's direction. **As shipped**: a proactive turn is `runProactiveTurn` (a `runTurn` with `message` optional → silent agency); the hard safety gate (reversible-silent / irreversible-surfaced, fail-closed) + action budget bound it; the cadence governor + bounded wake judgment (fail-closed, off the reply key) decide; a `.unref()`'d heartbeat with an in-flight guard drives it; self-continuation is a `setTimeout` micro-wake, dream auto-trigger is a `consolidate`-intent turn calling `enter_dream`. `LUNA_PROACTIVE` defaults **ON** (Alan's choice; `=0` kill switch). Python's outbox/cursor/TTL/SSE-replay layer was never built. Open tuning item: the wake judgment is conservative by default (rarely stirs in casual idle) — a lived-experience knob. See `docs/roadmap/proactive-agency-2026-06/`. |

### Locked decision #11 — Memory + dream merge (detail)

The old roadmap parked dream at a standalone Initiative 7 (v0.14+). That was wrong: dream is the only
place reconciliation, diaries, and core-memory updates happen — memory without dream is a store with
no consolidation. Dream is therefore the **capstone of Initiative 2 (v0.5.0)**, after the three layers
exist for it to write into.

- **Trigger**: manual (WS `dream.enter`) + `enter_dream` tool (Luna can choose to sleep) + manual
  `dream.wake` (parks at `finished_idle`). **Auto-idle trigger deferred** to land with Initiative 5
  (proactive), reusing its idle scheduler — exactly the coupling Python's deferred
  `v0.56.0-dream-autotrigger` relied on. Manual proven first (Python's own staging rationale).
- **Isolation**: `chat.send` while dreaming is rejected (`error{code:'dreaming'}`), never interleaved.
  This is the race the entire Python memory redesign existed to kill.
- **Reconciliation**: per-cycle `memory_audit` does reasoning-gated **forget(stale ids) + remember(new)**
  — supersede, never in-place UPDATE. `forget` is a **soft delete** (`deleted_ms` time-validity on
  `l3_facts`; recall filters; `asOf` time-travel queries possible) — deliberately diverging from
  Python's hard-delete `ForgetTool` so "this was once true" stays first-class. The audit table is
  reserved for core memory.
- **`self_state` shape**: **prose** (Alan decision E), **plus** a lightweight SQLite audit table +
  `restore(n)` (keeping the undo Python got cold feet about retiring — v0.57.0 deferral, confirmed
  2026-06-12). Not Python's 5 structured fields, not a consistency tripwire.
- **Cache-aware injection (TS-only constraint)**: the stable core block (prose core memory + durable
  highlights) lives in the system prompt **before a `cache_control` breakpoint** and changes only on
  real memory updates; the per-query retrieval block is injected at **message level after the cached
  prefix**. The top-level system prompt never varies per query — a byte-varying system prompt would
  invalidate the Anthropic prefix cache every turn, against the rewrite's #1 goal. Python re-sent
  full context per turn and never had this constraint; TS lives by it.
- **Hot path**: zero synchronous memory LLM calls on a live turn (see amended Open Q #7; the async
  L1 fold is the one sanctioned exception, superseded by dream).
- **Dream execution shape**: a **second StateGraph** on the generalized `runGraph` (not a bespoke
  step pipeline — sequential if/else runners are the shape rejected at v0.3); traces under
  `dream:<cycle_id>` with per-step flushes. `enter_dream` mid-turn sets a **pending intent**; the
  cycle starts only post-`finalize` (closes Python's tail-race window where the daemon thread could
  overlap the triggering turn).
- **6-step cycle** (port of `dream.py:728-735`): refine_semantic → refine_layer1 → memory_audit →
  persona_update → run_diaries (day/week/month) → rag_refresh.
- **Two inherited production hardenings** (same yunwu gateway): natural-language section headers (no
  `<<<MEMORY_BEGIN>>>` delimiters — content-filter trip, Python v0.56.1); two-attempt summarizer→default
  key cascade (rate-limit, Python v0.56.2).

### Locked decision #9 — Everything-as-tool (detail)

All user-facing output flows through tools. There is no top-level `text` output from the model
on a normal turn; the system prompt enforces tool-only output. The `message` tool carries the
actual user-visible content with Live2D metadata embedded:

| Field | Type (Zod) | Notes |
|---|---|---|
| `text` | `z.string().min(1).max(140)` | Humanity char cap as schema, not streaming truncation |
| `sentences` | `z.array(z.string().max(55)).max(4)` | Sentence count + per-sentence cap as schema |
| `expression` | `ExpressionEnum.optional()` | Live2D motion key (`smile` / `curious` / …) |
| `emotion` | `z.number().min(0).max(1).optional()` | Driver for blended expression intensity |
| `voice_params` | `VoiceParams.optional()` | Per-message TTS overrides |
| `is_final` | `z.boolean()` | Last message of this turn vs more coming after a tool call |

Internal reasoning lives in Claude `thinking` blocks (Anthropic primitive), kept separate from
`message` so the "decide to speak" boundary is sharp.

**Why this works:**
- *Unified action space*: every model output is a typed structured action; eval + trace are
  uniform; no "text vs tool" mode-swap behavior in the model.
- *Forcing function*: `message` becomes the highest-frequency dispatcher path — tool infra
  (dispatcher, streaming, `Result<T>`, concurrency) cannot rot as an "exceptional path."
- *Live2D envelope natural*: `text` and `expression` arrive together in one validated frame;
  eliminates the Python silent-drift class where a frontend handler early-returns on a frame
  the backend assumed consumed.
- *Schema constraint vs hack*: humanity caps (140/4/55) are Zod constraints on `message.input`;
  the model gets a `validation_failed` and re-emits, instead of being truncated mid-sentence.

**Introduction timing**: v0.6, alongside the humanity-caps refactor in Initiative 3 (persona +
humanity guardrails). v0.3 ships `reply.token` text-default to give Initiative 2 (memory) a
stable baseline; the v0.6 swap is staged behind `LUNA_MESSAGE_TOOL=1` so an A/B comparison
against the v0.3 baseline is possible.

> **LANDED 2026-06-13 (v0.6.1–v0.7.0).** Default ON since v0.7.0; `LUNA_MESSAGE_TOOL=0` is the
> permanent text-path escape hatch (supported at least through Initiative 6). As-shipped
> amendments to the sketch table above (full rationale in
> `docs/roadmap/persona-message-tool-2026-06/README.md` A1–A6):
> `sentences` is **server-derived**, never a model field — the model supplies `text` only, the
> ≤4×≤55 caps run in `superRefine` over CJK splitters, and derived segments ship in the
> `MessageDelivery` envelope (`tool.finished` payload) with `delay_ms` pacing **metadata** (the
> server never sleeps). The input schema is a **flat root object** (v0.5.2 gateway rule — never
> a wire-level discriminated union). Python's separate expression pass is cut: `expression` is a
> typed optional schema field (15-key enum), `emotion` normalized [0,1]. The humanity auditor is
> not ported — Zod IS the auditor, and violations are *recoverable errors*, countable in traces.
> Empty turns get one user-role corrective retry, then a traced degraded fallback.

**Anthropic stream compatibility**: `input_json_delta` carries the `text` field's tokens, so
the token-stream UX is preserved — the model still streams text, just inside a tool input
envelope rather than a top-level text block. *(Verified live on yunwu 2026-06-12: incremental
chunks, streamed preview byte-equal to delivery — `jsonTextStream.ts` does the extraction.)*

**Frontend implication**: Initiative 6 (frontend port, v0.12) consumers subscribe to
`tool.progress{tool_name:'message', payload:{text_delta}}` instead of `reply.token`, and render
delivery from the `MessageDelivery` envelope on `tool.finished`. Shipped and fixed at v0.6.2;
the dev chat page is the reference consumer.

## What we are cutting from Python Luna (减负 list)

These are **explicitly out of scope** for v2. Most are dead, vestigial, or symptomatic patches:

**Whole subsystems removed**
- **STS2 game integration** (29 tools, `sts2.py` 1333 lines, pre-loop judge call, `LUNA_STS2_MAX_TOOL_ITERATIONS=64`). Env-disabled by default and unused.
- **`openai_compat` adapter** — doesn't honor `api_key_override`, so v0.47.5 isolation evaporates on it.
- **`mock` provider** — replaced by vitest mocks at the test boundary.
- **Tool demand-load + `workspace_intent` keyword gating + `force_full_tools` meta path** — eliminated by keeping a small (~10) tool surface always mounted. Removes the entire class of "model said 'I'll remember that' but no tool fired" regressions (v0.47.9 was a fix to v0.47.6 caused by this).
- **Skills subsystem** (`list_skills` / `activate_skill` / `exit_skill` + `state.active_skill`). With a 10-tool surface there is no second-level filter to perform.
- **Tool approval gating** (`tool.approval_required` + `/api/tool/approval`). Dormant in Python; not implemented in v2 until a real use case shows up.
- **Wide-open CORS + 0.0.0.0 binding**. Localhost only via Bun's default.

**Tools collapsed or dropped**
- `patch_file`, `replace_in_file` → merged into `edit_file`. Three ways to edit a file is one of the instability sources.
- `make_directory`, `move_path`, `copy_path`, `delete_path` → folded into `shell` tool.
- `local_roots`, `explore_local_files`, `codebase_overview`, `find_relevant_files` → covered by `list_files` + `search_code` + `read_file`.
- `progress_update` → replaced by streaming progress from tools themselves (interleaved tool-use).
- `remember`, `revise_memory`, `forget`, `update_self` → collapsed into one `remember` tool with a discriminated input (final shape locked at v0.4.2 planning: `action: 'add' | 'forget' | 'update_self'` + `category` for L3 placement; supersedes the early `input.kind` sketch — v0.2 shipped `kind` as a category stub, v0.4.2 reshapes it). **v0.5.2 wire-contract amendment:** the discrimination is enforced in `superRefine` over a **flat root-level object schema**, never `z.discriminatedUnion` on the wire — the yunwu gateway mangles root-level `anyOf` tool schemas into `{"_noargs": "<raw>"}` (every real-usage `remember` call failed until this fix). Rule generalizes to all tools incl. the v0.6 `message` tool; regression-tested in `runTurn.test.ts`.

**Dead code removed in transit**
- `core_memory_refiner` **module name** is cut, **but its rendering function survives**: the
  L3→context renderer (Python `build_semantic_memory_block`) is re-homed and split cache-aware in
  v0.4.2/v0.4.3 — `renderCoreBlock.ts` (stable, system-prompt side) + `renderRecallBlock.ts`
  (per-query, message-level side). Cut the alias shell, not the renderer.
- `memory_pass.py` (legacy salience, only referenced by tests).
- `.workspace/luna/memory/{core,episodes,events,index}` directories (vestigial).
- `reasoned_decision` helper (declared finalized at v0.49, never used in production).
- `CHANNEL_INTERIM_MESSAGE` / `CHANNEL_STREAM_SEGMENT` constants (exported but never imported).
- `unregister` method on `ToolRegistry` (never called).

**Special cases removed by redesign**
- `AGENT_MESSAGE_TOOL_NAMES` dispatch special case — `message` becomes a normal tool with streaming output. (Reinforced by LD #9: `message` is the typical tool, not a special case.)
- `startswith('Error')` heuristic for tool failure — replaced by discriminated `Result<T>`.
- Expression pass aux LLM call — folded into the `message` tool's input schema (text + expression returned together per LD #9).
- Self-continuation reasoning extra LLM call — disabled by default; mechanical brake retained.

## What we are deliberately keeping

- ~~Four-layer memory model~~ → **superseded by LD #12: a 3-layer model** (L1 live window / L2 full-text archive + diaries / L3 semantic) **plus prose core memory**. Diary (day/week/month) is a dream output in L2, not a 4th tier. Concepts kept, storage swapped to SQLite. See Initiative 2 (`docs/roadmap/memory-dream-substrate-2026-06/`).
- ~~Proactive state machine (`ENGAGED → IDLE_WATCH → NUDGED → DORMANT → SLEEPING`) and cadence persistence~~ → **superseded 2026-06-13**: Initiative 5 designs proactive/self-continuation **fresh on the TS architecture's advantages** (persistent WS push + timers + everything-as-tool means a continuation is just a delayed normal turn; Python's outbox/cursor/TTL delivery machinery has no counterpart here). Python's *lessons* carry (pacing quotas, cooldowns, the v0.28 self-reported-signal failure); its state-machine shape is a reference, not a spec.
- Reasoning-spec **L1 philosophy only** (thinking contract + inviolable mechanical rails + every decision logged). **The L2 gate harness is NOT kept — see LD #14**: it was a misreading of the original intent; decision logging migrates into the trace table as typed decision events.
- Humanity hard caps (140 chars / 4 sentences / 55 char clause). Implementation upgraded per LD #9: Zod constraints on `message` tool input, not prompt-only and not streaming-layer truncation.
- Persona three-layer resolution (base / runtime / scene). Single file-watch cache replaces 4× per-turn reads.
- Live2D motion pipeline + TTS pipeline (Node proxy + Python GPT-SoVITS sidecar). Untouched. Per LD #9: backend computes nothing in `expression.update`; the model sets it inside the `message` envelope.

## Open questions (carried in from conversation)

These have **not** been decided. Each is parked here so future-me can pick up the thread.

1. ~~**Mount control for risky tools (`shell`)**~~ — **RESOLVED 2026-06-11 by Locked Decision #10**: always-on + deny-regex inside the tool. `defineTool` has no `mountedWhen` field. Shell tool itself lands at v0.4+ when concrete need arises.
2. ~~**Self-continuation default behavior**~~ — **RESOLVED 2026-06-13 (v0.11.0)**: shipped as a `setTimeout`-based micro-wake (~4s after a user turn) running a `continuation`-intent proactive turn, gated by a mechanical probability (`LUNA_SELFCONT_PROBABILITY`, default 0.35; no model-emitted "more to say" flag — v0.28.1 lesson) as a USER-role stage direction (v0.27.1 lesson). **Default on** (with `LUNA_PROACTIVE`), `LUNA_SELFCONT=0` opts out. Python's 40%-coin-flip and `parse_continuation_line` machinery were not used. See `docs/roadmap/proactive-agency-2026-06/`.
3. ~~**Live2D command authorship**~~ — **RESOLVED 2026-06-11 by Locked Decision #9 (everything-as-tool)**: Live2D metadata travels inside the `message` tool envelope (`expression`, `emotion`, `voice_params` fields). Model-controlled, but not a separate `set_expression` tool — the 10-tool surface stays at 10. See LD #9 detail above.
4. ~~**Result compaction**~~ — **RESOLVED 2026-06-11 (v0.3.5)**: per-tool `summarize()` only, **no** global tripwire on the dispatcher → LLM path (v0.2 locked direction holds). Separately, trace storage truncates over-large `payload_json` at 4KB into a structured `{truncated, original_bytes, preview}` wrapper (never a byte-slice of serialized JSON). The two concerns are decoupled: tool results to the model stay per-tool-summarized; trace persistence clamps independently.
5. ~~**Concurrency declaration granularity**~~ — **RESOLVED 2026-06-11 at v0.2 design review**: per-tool `concurrency: 'safe-parallel' | 'session-serial' | 'global-serial'` (3-state enum). No per-resource locks in v1. Revisit only if v0.4 memory work demands finer granularity.
6. ~~**Dream engine scope**~~ — **RESOLVED 2026-06-12 by Locked Decision #11**: in scope, merged into Initiative 2 (v0.5.0). Trigger = manual + `enter_dream` tool + manual-wake first; auto-idle deferred to Initiative 5 (proactive). See `docs/roadmap/memory-dream-substrate-2026-06/`.
7. ~~**Backend trigger for memory writes**~~ — **RESOLVED 2026-06-12 (amended same day)**: no **synchronous** memory LLM call on the live-turn hot path. The single sanctioned exception is the **async fire-and-forget L1 fold** (v0.4.1): it runs after `turn.result` is emitted, never blocks a reply or the next turn, commits via CAS, and dream's `refine_layer1` supersedes it. All other consolidation runs in dream (`memory_audit`/`run_diaries`), not per-turn calls.
8. **Reasoning audit upgrade**: every L1/L2 decision gets a `trace_id` and links into a tree so a turn can be fully replayed. **Partially scheduled**: `trace_id` propagation + per-node SQLite trace lands in v0.3.5 (Observability Foundation initiative). Full reasoning-decision replay tree TBD — likely v0.8+ alongside reasoning rails initiative.
9. ~~**Model-callable `recall` tool**~~ — **RESOLVED 2026-06-13, scheduled by Initiative 4 (lands v0.8.3)**: the tool ships on the always-mounted surface, with its trigger discipline written into the L1 thinking contract ("she mentions something you feel you should know — recall before answering"). Automatic injection stays; the tool is the agentic complement, and its call/no-call decisions become visible in the decision traces (LD #14). See `docs/roadmap/action-integrity-2026-06/`.

---

## How to use this file

- Before starting a new version plan, read the **Locked design decisions** and **減負 list** to make sure you're not re-litigating something.
- If a decision needs to change, **update this file in the same commit** as the version plan that changes it. Do not let it drift.
- New open questions: append to the list. Resolved questions: strike through in place with a `RESOLVED YYYY-MM-DD by LD #N` note (preserves the question number for back-references in initiative READMEs).
