# Initiative 15 — Proactive pipeline redesign (v0.22.0 – v0.22.3)

> **Status: PLANNED.** Priority: **high** — the proactive feature is "on" but has **never once spoken**
> in the product's entire life (data below). Version range **v0.22.0 – v0.22.3** (a minor: this
> re-architects the proactive trigger path). Master index: [`../README.md`](../README.md).
> Distinct from **Initiative 5 — Proactive agency** (v0.10–v0.11, ✅ shipped), which built the
> proactive *turn* + cadence + the safety contract; this initiative replaces the *wake decision*.

## The idea

Replace the per-tick **LLM wake-gate** — which decides "should I speak?" *before* drafting and has
returned **`hold` 100% of the time, never once `act`** — with cheap **deterministic trigger detectors**
that feed the **existing silence-capable turn graph**. The proactive turn already returns
`{spoke}` (it speaks iff it calls the `message` tool), so **that return becomes the only "should I
speak?" judgment** (drafting-as-decision). The LLM is invoked only to *draft* when a concrete,
code-detected reason already exists. Efficient (no idle LLM polling), reliable (after-a-night *will*
fire), graph-native (a trigger is just another way to enter the turn graph).

Architecture (from the 2026-06-24 design panel): **Detector-Gated Drafting-as-Decision.**

## Why prioritized

The proactive system runs (timer, prefilter, wake-gate all execute) but the **wake-gate never pulls
the trigger**. A flagship companion behavior — she reaches out unprompted — is effectively dead, and
no amount of restarting fixes it because the gate itself is the blocker. This is the single biggest
gap between "Luna is configured to be a companion" and "Luna behaves like one."

## Locked design decisions referenced

- **LD #9 — everything-as-tool / `message` as the speech tool.** Speaking = calling `message`; a turn
  may call it 0+ times. The redesign keeps this: `{spoke} = messageTexts.length > 0` is the verdict.
- **LD #15 — proactive safety contract** (reversible-silent / irreversible-surfaced + kill switch +
  action budget). The redesign keeps the contract: the cadence governor (**quiet hours / cooldown /
  daily quota**) stays the anti-spam rail for the detector/scheduled path, and `LUNA_PROACTIVE=0` stays
  the kill switch. **Two deliberate changes *within* the contract:** (1) the > 18 h `deep_absence`
  blanket is **dropped** — a long absence is now a *trigger*, not a suppressor (see the ⚠ fact below);
  (2) `continuation` stays a bounded *one-per-reply* micro-wake, rail-light by design, so the rail caps
  the **detector** path, not continuation. The daily-quota budget is preserved (now counting
  **messages**, via the spoke/silent split). *(Confirm verbatim against `docs/REWRITE_CONTEXT.md` at
  build time — this initiative stays inside both decisions, it does not amend them.)*

## Verified architectural facts (code-confirmed 2026-06-24/25)

- **One generic graph.** `runGraph(graph, start, state)` walks nodes until `'end'`
  ([`turn/graph.ts:14`](../../../packages/server/src/turn/graph.ts)); the same shape runs reactive
  turns, the dream cycle, and proactive turns.
- **The proactive turn is just `runTurn` + a USER-role "you woke on your own; speaking is optional;
  do nothing if nothing's worth it" framing**, and it **returns `{spoke}`**
  (`spoke = state.messageTexts.length > 0`) — [`proactive/proactiveTurn.ts:83`](../../../packages/server/src/proactive/proactiveTurn.ts).
  It is already silence-capable; **this `{spoke}` becomes the sole "should I speak?" judgment.**
- **Scheduler** (60 s tick — [`proactive/scheduler.ts:38`](../../../packages/server/src/proactive/scheduler.ts)):
  iterate `activeSessionIds()` → cheap cadence prefilter `shouldConsiderWake`
  ([`proactive/cadence.ts:65`](../../../packages/server/src/proactive/cadence.ts)) → **LLM `wakeGate`**
  (`scheduler.ts:117`) → if `act`, `runProactiveTurn` (`scheduler.ts:135`) → `commitProactive` bumps
  the daily quota **unconditionally** (`cadence.ts:96`).
- **Cadence gates** (`cadence.ts:69–91`): quiet hours `0–5` (set `[0,6)`, i.e. midnight up to but not
  including 6am); `deep_absence` if idle > ~18 h (`LUNA_PROACTIVE_LONG_ABSENCE_MS`); `cooldown` 5 m
  after a fire; `quota_exhausted` at 5/day; `too_soon` if the effective gap < 10 m. **Old-model firing
  window: idle 10 m – 18 h.** A `hold` does **not** start the cooldown — that (not the idle window) is
  why it **re-fires every 60 s**.
- **⚠ deep_absence is a relic of the old model and must NOT gate the detectors.** `afterANightOpening`
  needs a gap ≥ 6 h, but `shouldConsiderWake` rejects `deep_absence` at > 18 h — so reusing it
  verbatim would let the after-a-night greeting fire **only** in [6 h, 18 h] and **swallow every gap
  > 18 h** (a weekend away, a 2-day absence) — exactly when an after-absence greeting *should* fire.
  In the redesign a long absence is a **trigger, not a suppressor**: detectors are gated by
  **quiet-hours + cooldown + quota only**, never by `deep_absence`. (v0.22.0 splits this subset out;
  v0.22.1's `safetyRail` drops the blanket `deep_absence`.)
- **wakeGate** ([`proactive/wakeGate.ts`](../../../packages/server/src/proactive/wakeGate.ts)): system
  prompt says *"Most of the time the right answer is to stay quiet"*; **fails closed** (garble/throw →
  don't speak); exports `WakeVerdict`, `wakeGate`, `buildWakeContext`.
- **`afterANightOpening(nowMs, lastInteractionMs)`** already exists
  ([`turn/temporalContext.ts:228`](../../../packages/server/src/turn/temporalContext.ts)); the
  `lastInteractionMs(session)` helper is private in `proactiveTurn.ts:52` (factor it out for reuse).

### The data (live trace DB, queried 2026-06-24)

- **Every `proactive_wake` decision in history is `hold` — `act` count: 0.** Breakdown: most are the
  LLM judging "only 11–30 min of quiet, no reason to interrupt"; **8** `judgment_unparseable`; **6**
  `judgment_unavailable:exception` (all fail-closed to silence).
- **Scheduler-driven proactive messages ever produced: 0.** The 4 `proactive%` rows in L2 are
  `:cont:` **continuations** (the separate "one more thought after a reply" path), not the scheduler.
- Last wake decision **2026-06-16 12:17**; none since (the v0.21.6 "empty session map after restart"
  bug — fixed in code, not yet deployed on Alan's instance).

## The hard part

**Anti-spam without an LLM gate.** The deterministic path must not over-fire: the cadence rail stays
tight, each detector carries its own **debounce / per-day-consumed** bit, and a **spoke/silent quota
split** means a *silent* draft does not burn the daily message budget (so she can "consider and stay
quiet" cheaply, repeatedly, without exhausting the cap). Detectors must be **pure + injectable-clock
testable** (like `proactiveWeatherNote`), read only in-memory + SQLite + cached snapshots (no network,
no model), and the trigger **seed rides the uncached user tail** (cache invariant preserved). All off
the hot path; one proactive turn at a time (reuse the existing `ticking` + `activeTurn` + `isDreaming`
locks).

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| 1 | [v0.22.0](v0.22.0-detector-mvp.md) | **Detector-MVP** — inline after-a-night detector replaces the wake-gate call; spoke/silent quota split; `wakeGate` behind a default-off flag | **Low** | v0.21.6 deployed | PLANNED |
| 2 | [v0.22.1](v0.22.1-detector-registry-slots.md) | **Detector registry + scheduled slots** — `safetyRail`/`considerProactive` split; `detectors.ts` registry (after-night + scheduled-window); migration `0013` (per-day slot bitmask); `LUNA_PROACTIVE_SLOTS` | **Medium** (schema) | v0.22.0 | PLANNED |
| 3 | [v0.22.2](v0.22.2-event-hooks-debounce.md) | **Event hooks + debounce + weather-shift** — per-detector debounce; `weatherShift` detector; fire the same path from `ws` reconnect-after-a-night + the weather refresher | **Medium** | v0.22.1 | PLANNED |
| 4 | [v0.22.3](v0.22.3-fuzzy-detectors-close.md) | **Fuzzy detectors + close** — `openThreadAged` + `promisedFollowThrough` (default OFF, soft-seed); **delete `wakeGate`**; initiative close | **Low** | v0.22.2 | PLANNED |

## Acceptance criteria (whole initiative)

- [ ] On a normal connected day, the scheduler produces **real proactive turns with `spoke=true`** —
      she actually reaches out (vs. 0 ever today).
- [ ] **Zero speculative LLM calls** on a truly idle day where no detector fires (vs. ~1000 holds/day).
- [ ] The **after-a-night** greeting fires reliably after an overnight gap (first connected tick).
- [ ] A **silent** proactive draft does **not** consume the daily message quota.
- [ ] The cadence rail (quiet hours / cooldown / quota / deep-absence) still **hard-caps** — no spam.
- [ ] `wakeGate.ts` + `WakeVerdict`/`buildWakeContext` are **deleted** by v0.22.3.
- [ ] A **dev trigger** exists to force-fire a proactive turn (bypassing detectors) for live verify.
- [ ] `bun test` green, `tsc` ×3 clean, every stage default-flag-guarded then flipped.

## Open questions (settle at build time)

1. **Keep any low-frequency LLM "ambient reach-out" path, or go purely deterministic?** Recommend
   **purely deterministic** for v0.22.x (the LLM gate is exactly what failed); revisit later if she
   feels too "scheduled."
2. **`LUNA_PROACTIVE_SLOTS` default** — ship a scheduled-floor default (e.g. `'11,20'`) so she always
   has *some* daily opening, or leave unset (detectors-only) by default?
3. **Stage-3 event-hook firing** — default-on, or behind a flag for one release?
