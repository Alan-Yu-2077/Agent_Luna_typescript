# Initiative 12 — Time perception

> **Status: ✅ SHIPPED 2026-06-17** (branch `feat/initiative-12-time-perception`, 667 tests green, A+B+C default-on). Order 12 — the capability initiative after web tools (Initiative 11).
> Version range: **v0.19.0 – v0.19.2** (3 versions; option D deferred, no version reserved). Master
> index: [`../README.md`](../README.md).
> Source: a 2023–2026 SOTA review of LLM time perception (TimeQA/Test-of-Time/TicToc temporal-reasoning
> benchmarks; Generative-Agents recency memory; Zep/Graphiti bi-temporal memory; ComPeer proactive timing;
> Anthropic prompt-cache docs) **+** the owner's decision (A+B+C in plan, D deferred), **+** the Python
> `temporal_reasoning` baseline re-read at source.

## The idea

Give Luna a real sense of time. Today she has only a **pull** `time_now` tool and internal proactive
scheduling — nothing passively tells her *what time it is*, *how long since you last spoke*, or *when a
recalled memory happened*, so she drifts (calling an hour-ago event "yesterday"). This initiative builds a
**layered time perception**: (A) **passive, pre-computed** time + elapsed-gap injected every turn in the
uncached tail; (B) **temporal grounding of memory** — relative-time labels + chronological order on recalled
candidates; (C) a **bounded subjective-time** layer (daypart mood + felt absence) wired into the dream /
proactive cycle. The through-line, forced by the benchmarks: **do all temporal arithmetic in TypeScript and
hand Claude labeled facts — never ask her to compute "how long ago."**

## Why now / why this shape

Time perception is a core companion quality the owner explicitly values, and the rewrite never ported it
(Python had `temporal_reasoning`; it's a gap, not a deliberate cut — `REWRITE_CONTEXT.md` doesn't mention
it). It lands after Initiative 11 because it leans on memory infrastructure (the recall ranking, L2
timestamps, the dream cycle) that is now mature. The split isolates the **cheap bug-fix (A)** from the
**highest-leverage companion upgrade (B)** from the **most design-sensitive layer (C)**.

## The hard part — two principles that govern every version

1. **Compute time in code, hand her labels.** The benchmarks are unambiguous: LLMs are reliable at *stating*
   an injected time but bad at *deriving* durations/ordering — Test of Time put GPT-4 at **16% on duration
   questions, ~21% off by exactly one day**; TicToc (2025) showed even per-message ISO timestamps leave the
   best model **<65%** on time-sensitive decisions. So Luna's "yesterday" drift is *her doing the
   subtraction and getting it wrong*. The fix is to never make her subtract: every elapsed gap, relative
   label, daypart, and bucket is computed in TS and handed over as a finished string.
2. **Time lives in the UNCACHED tail.** Anthropic's prompt cache matches an exact prefix; a value that
   changes every turn placed in the cached system block busts the entire downstream cache on every request
   (Anthropic's own Claude Code team treated this as an incident). Luna's cached prefix is the
   `cache_control:'ephemeral'` system block (`runTurn.ts buildSystemPrompt`), invariant per `REWRITE_CONTEXT`
   LD on the single cache breakpoint. **All time content therefore goes into the per-turn user message**
   (alongside the recall block + `userText`), after the breakpoint — never the system block. This is free for
   Luna because that per-turn user message already exists.

## Locked design decisions referenced (`docs/REWRITE_CONTEXT.md`)

- **Prompt-cache invariant** (`REWRITE_CONTEXT.md:74`): system content *"lives in the system prompt before a
  `cache_control` breakpoint and changes only on [memory change]."* → time content must NOT enter the cached
  system block; it rides the per-turn user message (the uncached tail). This is the single most load-bearing
  constraint of the initiative.
- **LD #14 — L1 thinking contract is the design** (`:49`): the time-awareness guidance (let time inform tone;
  don't announce the clock; don't compute durations) + the warmth-not-guilt guardrail are **clauses on the
  existing L1 contract** (`renderL1Contract`), not a new harness.
- **LD #15 — Proactive = agency** (`:50`): C's felt-absence signal feeds the existing proactive framing
  (cadence governor + wake gate); no new proactive machinery.
- No locked decision touches time/temporal — this initiative *adds* one (the compute-in-code + uncached-tail
  rule) as the design record here.

## Verified architectural facts (read from TS source)

1. **The uncached injection point exists** — `parse_input`/`build_request` assembles a per-turn user message:
   `retrieve()` → `renderRecallBlock(hits)` → `blocks.push(recall)` then `blocks.push({type:'text',
   text: s.userText})` → `session.history.push({role:'user', content: blocks})`
   (`packages/server/src/turn/runTurn.ts`, the build_request node). **A's time block is one more
   `blocks.push(...)` here** — after the cache breakpoint, zero cache impact.
2. **The cached prefix** — `buildSystemPrompt` returns a single block with `cache_control:{type:'ephemeral'}`
   (`runTurn.ts:~137`). Nothing time-varying may go here.
3. **The gap source** — `Session.lastUserMs` (`packages/server/src/turn/session.ts:31`) tracks the last USER
   turn but is **init to boot time, not persisted** (so it resets on restart). For a gap that survives a
   restart (the user returning after the server bounced), compute "last interaction" from the **last
   persisted L2 turn's `t_ms`** (`listRecentL2`), falling back to `lastUserMs`. Session age uses `wakePending`
   / boot time (there is no persisted session-start field; add one or derive).
4. **Recall already carries time + recency** — `Candidate` has `t_ms` and the **Generative-Agents recall
   score** `α·recency + β·importance + γ·relevance` is already implemented (`memory/recall/recall.ts:23,81-86`;
   `collectCandidates` stamps `t_ms` on l2/l3/diary, `:95-126`). **B is therefore mostly "render a relative
   label from `t_ms` + order chronologically in `renderRecallBlock`"** — the ranking it needs already exists
   (Initiative 10), it does not rebuild recency scoring.
5. **L1 clause hook** — `renderL1Contract(webSearchMounted, webFetchMounted)` builds + memoizes the contract
   from pushed clauses (`persona/l1Contract.ts:35,80-84`); the time clause is a new `TIME_CLAUSE` pushed the
   same way, gated on the time flag.
6. **C's integration points** — the dream cycle (`dream/cycle.ts`), the proactive cadence/framing
   (`proactive/cadence.ts`, `proactive/proactiveTurn.ts` DIRECTIVES), and the idle/daypart-ish FaceVm
   profiles already exist; C threads a small computed signal through them, it does not add new systems.
7. **Version head** = `v0.18.4`; next free contiguous range = **v0.19.0+**.

## Python parity notes (`/Users/alanyu2077/Desktop/Agent_Luna`, `LUNA_TEMPORAL_REASONING`, default off)

- **Python did A's flavor** — `build_temporal_context_message` (`runtime/guarded_request.py:200`) injects a
  per-turn block: local + UTC time, **daypart**, **time-since-last-interaction** (humanized `format_gap`), a
  **scene** label from `classify_temporal_scene` (`first_contact`/`live`≤5m/`short_away`≤1h/`long_away`≤1d/
  `days_away`), and session age. Plus an **L1 gate** (`_build_temporal_l1_message`, `:275`): *"时间感活在你怎么
  接住话里——报时、报具体时长几乎从不需要"* (time-sense lives in how you pick the conversation back up; announcing
  the clock / exact durations is almost never needed; thinking ≠ reply, keep deliberation out of the bubble).
- **Divergences (why we don't just port):**
  - **Python did NOT do B** (memory temporal grounding). B is the actual fix for the "yesterday" drift
    (dating *past events*), which A/the gap-scene cannot address — this is the initiative's biggest
    over-Python delta.
  - Python builds the temporal block as a **`system` message** — risks the prompt-cache hit on every turn.
    TS places it in the **uncached user tail** (fact #1/#2), so caching is unaffected.
  - We add an explicit **warmth-not-guilt guardrail** (the harmful-companion-traits research warns against
    absence used as a guilt lever). Python's L1 leans "don't announce"; ours also says "if you note an
    absence, it's warmth/curiosity, never 'you left me'."
- Python's `classify_daypart` / `format_gap` / scene thresholds are a good **reference for the defaults**, to
  be re-tuned in TS (Open Q below).

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.19.0](v0.19.0-passive-time-injection.md) | v0.19.0 | **A — passive time injection** — a TS-computed time block (local time + day-of-week + daypart + explicit tz, **elapsed-since-last** + **session bucket** continuation/same-day/new-day) pushed into the per-turn uncached user message; an L1 time clause (inform tone, don't announce, don't self-compute). Kills the "yesterday" drift. Flag `LUNA_TIME_AWARE` | Low–Med | nothing | 🟡 |
| [v0.19.1](v0.19.1-memory-temporal-grounding.md) | v0.19.1 | **B — memory temporal grounding** — `renderRecallBlock` renders a **relative-time label** (`3 days ago` / `this morning` / `just now`) per recalled candidate from its `t_ms` + orders them **chronologically**; reuses the existing GA recall ranking. The real fix for dating *past events*. Flag `LUNA_RECALL_TIME_LABELS` | Medium | v0.19.0 (shared time helpers) | 🟡 |
| [v0.19.2](v0.19.2-subjective-time-close.md) | v0.19.2 | **C — subjective time + close** — a bounded, code-computed **daypart-mood + absence-feltness** signal injected as a *suggestion* (not authority), threaded into the dream/proactive framing (ComPeer-style); a **warmth-not-guilt** L1 guardrail; measure (cache hit-rate unaffected) + **default-flip** A/B/C on; close Initiative 12. Flag `LUNA_TIME_SUBJECTIVE` | Medium | v0.19.0, v0.19.1 | 🟡 |

## Acceptance criteria (whole initiative)

- [ ] Luna **states elapsed time correctly from handed labels** (no self-computed "yesterday" for an
      hour-ago event); a controlled prompt confirms she reads the gap, not derives it.
- [ ] Recalled memories carry **relative-time labels + chronological order**, so she places past events on a
      timeline.
- [ ] A **bounded subjective-time** signal colors tone / proactivity as **warmth, never guilt**.
- [ ] **All time content is in the uncached tail**; prompt-cache hit-rate is unchanged (measured before flip).
- [ ] Each version is **default-off-flagged**, E2E-verified, then flipped; `tsc` clean + `bun test` green per
      version.

## Open questions (settle at build time)

1. **Gap source** — last persisted L2 `t_ms` (survives restart; recommended) vs `session.lastUserMs`
   (ephemeral). *Recommend L2 `t_ms` for cross-session continuity, falling back to `lastUserMs`.*
2. **Bucket thresholds + daypart boundaries** — Python's `live≤5m / short_away≤1h / long_away≤1d / days_away`
   and 4 dayparts are the starting defaults; re-tune in TS. (Build-time tunable via env.)
3. **Label format/granularity (B)** — `"3 days ago"` vs `"Tuesday"` vs both; absolute date past some horizon.
   *Recommend relative under ~1 week, then a date.*
4. **C's strength** — how strong the subjective scalar is and how deep the proactive/dream integration goes
   (light prompt-suggestion vs reworking proactive timing). *Recommend light + bounded first.*
5. **D (bi-temporal memory)** — confirmed deferred (no version); revisit only if non-destructive
   fact-supersession ("you *used* to…, but since last week…") becomes a felt need.
