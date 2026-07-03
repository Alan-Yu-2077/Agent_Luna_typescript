# Initiative 21 — Proactive silence as an idle-timer (silence-trigger redesign)

> **Status: PLANNED.** Priority: **high** (a live-exposed, user-reported bug — Luna interrupts
> active conversations). Version range: **v0.29.0 – v0.29.1**. Follows Initiative 17 (the silence
> ladder). Master index: [`../README.md`](../README.md).

## The idea

Initiative 17 restored Alan's Python **silence ladder** as the proactive wake decision — a phase
machine (`engaged → idle_watch → nudged → dormant`) driven by one signal, `effective_gap` ("how
long since anyone last spoke"). But the TS implementation computes that gap from the **wrong set of
anchors**: `session.lastUserMs` (the user's last message) + `cadence.lastProactiveMs` (her own
*proactive* outreach). **Luna's ordinary reactive replies advance neither anchor.** So the moment
she finishes answering, the silence clock keeps counting from the *earlier* user message, crosses
the 2-minute ambient / 10-minute idle thresholds while the user is still reading her reply, and she
interrupts an active conversation. This is the "系统对'静默'的概念存在误解" the user reported.

Rather than re-port Python's specific `last_interaction_at` field and keep enumerating "which
messages count", this initiative **makes silence itself the trigger**: a single `lastActivityMs`
timestamp, **bumped by every piece of conversation activity** (user messages + *every* Luna reply —
reactive, continuation, proactive). `silenceGap = now - lastActivityMs`. Nothing to forget: any new
interaction resets the idle timer automatically. The escalation ladder then reads this one honest
silence signal. This is the standard idle-timer (debounce / presence / screensaver) pattern, and it
permanently kills the whole "we forgot to count anchor X" bug class that produced this defect.

## Why this design (not the minimal patch)

The minimal fix is "add a `lastAssistantMs` anchor and take `max(lastUserMs, lastAssistantMs)`". It
works, but it keeps the fragile shape: a hand-maintained *set* of anchors that a future interaction
type (a new event, a new turn kind) can silently fall outside of — exactly how this bug was born.
Alan's redesign (2026-07-03) collapses the set into a single idle timer bumped at one choke point,
so correctness no longer depends on remembering to enumerate. Same semantics as Python
(`last_interaction_at`), simpler and future-proof mechanism.

## Two orthogonal clocks (do NOT merge them)

The redesign touches ONLY the silence signal. The proactive system keeps **two independent clocks**;
conflating them is the trap to avoid:

| Clock | Field | Bumped by | Drives |
|---|---|---|---|
| **Silence idle-timer** *(the fix)* | `session.lastActivityMs` (new) | all conversation activity | *whether to consider* opening: `engaged→idle_watch`, `ambient`, `dormant`-recovery, `sleeping` |
| **Outreach spacing** *(unchanged)* | `cadence.lastProactiveMs` | her proactive outreach only | *how often she may actually speak*: base cooldown, renudge backoff (1.0/2.4/6.0×), daily quota |

`effectiveGap = min(silenceGap, sinceProactive)` is retained (so she never nudges into a silence she
just broke). The renudge backoff + quota are governors a flat silence timer cannot express, so the
spacing clock stays.

## Locked design decisions referenced

- **LD #15 (2026-06-13, amended v0.24.1, Initiative 17)** — *"The Python 5-state machine survives as
  a cadence governor … the silence ladder (`proactive.py`'s phase machine: `effective_gap`-driven
  `engaged → idle_watch → nudged → dormant`) is restored as the proactive DECISION
  (`proactive/ladder.ts`, behind `LUNA_PROACTIVE_LADDER`, default on)."*
  This initiative stays **entirely inside LD #15** — it does not change the ladder, the safety gate,
  the kill switch, or the dropped delivery layer. It corrects **how `effective_gap` is computed** so
  the TS ladder finally matches the LD's stated `effective_gap` intent. **No LD amendment required.**

## Verified architectural facts (from a 20-agent adversarial diagnosis, 2026-07-03 — 13 CONFIRMED / 1 refuted)

- `packages/server/src/proactive/ladder.ts:75-78` — `userGap = now - session.lastUserMs`;
  `sinceProactive = now - cadence.lastProactiveMs`; `effectiveGap = min(userGap, sinceProactive)`.
  **No reactive-reply term.** The block comment (ladder.ts:10-12) claims "since ANYONE last spoke —
  the user OR Luna's own last outreach", but the code only counts the user + *proactive* outreach.
- `packages/server/src/turn/session.ts:35` — `Session` has `lastUserMs` (user turns) and
  `sessionStartMs`; **no `lastAssistantMs` / activity anchor**.
- `packages/server/src/ws.ts:233` — `session.lastUserMs = Date.now()` on `chat.send`, at turn
  **start**.
- `packages/server/src/turn/runTurn.ts:880` — `appendL2({...})` records `t_ms` at turn finalize, but
  **nothing writes back a session activity timestamp**; `activeTurn` is cleared (~runTurn.ts:850)
  with no silence-anchor update.
- `packages/server/src/proactive/cadence.ts:77-80` — the `passesAntiSpam` idle floor
  (`LUNA_PROACTIVE_IDLE_FLOOR_MS`, default 60_000) is measured from `lastUserMs`. Because
  `lastUserMs` is stamped at turn **start**, a reactive turn lasting > 60s means the floor is
  **already elapsed** the instant she finishes — the "don't reach in mid-exchange" guard is dead
  right when it's needed most.
- `packages/server/src/proactive/fire.ts:44-45` — `withProactiveLock` returns null while
  `session.activeTurn !== null` (won't fire *during* a reactive turn), but the very next tick after
  it clears can fire.
- `packages/server/src/proactive/scheduler.ts:29` — tick default 60s
  (`LUNA_PROACTIVE_TICK_SECONDS`); `scheduler.ts:69`, `fireProactiveForActiveSessions` (`:84`), and
  the ws reconnect hook **all** funnel through `maybeFireProactive` → the same broken gap.
- `packages/server/src/proactive/ladder.ts:63-64` — `idleThresholdMs` 600_000 (10m),
  `ambientMinMs` 120_000 (2m). `packages/server/src/proactive/style.ts:59` — `baseAmbientProb` 0.12.
- `packages/server/src/proactive/proactiveTurn.ts:150` — a `lastInteractionMs(session)` helper that
  reads the **last L2 turn's `t_ms`** (any turn kind) **already exists**, but the ladder never calls
  it — the correct anchor is present in the codebase and unused.

### Confirmed secondary amplifiers (fixed/tuned in v0.29.1)

- **Ambient probability compounds**: `engaged` re-rolls `rng() < ambientProb` (0.12) every 60s tick
  while `silenceGap ∈ [120s, 600s)` — cumulative ≈ **85% over ~15 min**. Once the anchor is wrong,
  an interruption is near-certain.
- **60s idle floor pre-elapsed** by any reactive turn > 60s (see cadence.ts fact above).
- **`ambientMinMs` 120s is too short** to call a 2-minute pause "silence".

## Python parity notes

- `Agent/src/luna/memory/session_store.py:772` — `current_interaction_dt = last_assistant_dt or
  last_user_dt or _local_now()`: Python anchors the silence gap on the **last assistant reply**
  (primary), user message (fallback). Set by `_derive_state`, called after **every** turn.
- `Agent/src/luna/runtime/guarded_request.py` `_temporal_gap_seconds` — reads
  `temporal.last_interaction_at`; `Agent/src/luna/runtime/proactive.py:234,277-280` —
  `gap = _temporal_gap_seconds(...)`; `effective_gap = min(gap, since_proactive)`.
- **Deliberate, better divergence**: TS collapses Python's derive-on-snapshot `last_interaction_at`
  into a single `lastActivityMs` bumped at one choke point — identical semantics (time since the last
  thing said in the channel), a simpler and drift-proof mechanism. TS also **keeps the escalation
  reset keyed on the USER** (`lastUserMs`), not on any-interaction-change: this avoids the ambiguity
  where Luna's own utterance would reset the very escalation she's climbing (Python sidesteps it by
  excluding proactive from `last_interaction_at`; the TS user-keyed reset is cleaner).

## Design decisions (resolved in this plan; one-line reversible if Alan disagrees)

1. **"All interaction" = conversation activity** — user messages + *every* Luna reply (reactive,
   continuation, proactive). **NOT** raw socket connect/reconnect: reconnection is presence, not
   speech, and stays its own hook (bumping the timer on reconnect would erase the long uninterrupted
   silence the "after-a-night" opening needs).
2. **Luna's own utterances DO bump the idle timer** (reactive reply, nudge, ambient musing).
   Rationale: she never nudges into a silence she just broke; ambients self-space. *If Alan prefers
   an ambient musing NOT to reset the escalation ladder, that is a single-line exclusion at the
   bump site — noted, not chosen.*
3. **`lastUserMs` is retained for exactly one job**: the escalation reset (a *user* reply →
   `phase = engaged`, `nudgesSent = 0`).
4. **`lastProactiveMs` is retained** for the spacing governors (cooldown / renudge / quota).

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| 1/2 | v0.29.0 | Silence idle-timer core — `lastActivityMs` bumped by all conversation activity; ladder + anti-spam floor read it; behind `LUNA_PROACTIVE_SILENCE_TIMER` (default on, `=0` = old anchor) | Medium | Init 17 shipped | PLANNED |
| 2/2 | v0.29.1 | Tune the amplifiers (ambientMin 120→300s, ambientProb 0.12→~0.06) + retire the old user-only anchor path + remove the flag | Low | v0.29.0 | PLANNED |

## Acceptance criteria for the whole initiative

- [ ] After Luna sends a reactive reply, no proactive fires until `LUNA_PROACTIVE_AMBIENT_MIN_MS`
      have elapsed **since her reply finished** (not since the user's earlier message).
- [ ] A reactive turn lasting longer than the idle floor does not leave the floor pre-elapsed at
      completion.
- [ ] A *user* reply still resets the escalation ladder to `engaged` with `nudgesSent = 0`.
- [ ] `dormant` auto-recovery and the renudge backoff still measure from the correct clocks
      (recovery from last activity; renudge from `lastProactiveMs`) — no regression in
      `ladder.test.ts`.
- [ ] Cumulative ambient probability over a genuine 15-minute silence is bounded to a comfortable
      rate (post-tune).
- [ ] `bun test` green across all packages; `tsc` clean; the old user-only-anchor path is gone by
      v0.29.1.

## Open questions blocking start

- **None from `REWRITE_CONTEXT.md`** — the redesign lives inside LD #15 (no Open Question gates it).
- The two plan-level design choices (ambient-resets-timer; interaction = conversation, not socket)
  are **resolved above** with rationale; Alan can flip either at build time without restructuring.
