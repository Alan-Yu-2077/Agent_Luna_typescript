# Initiative 17 — Proactive parity restore (the silence ladder)

> **Status: 📋 PLANNED.** Priority: **next** (first initiative after Initiative 16 ✅).
> Version range: **v0.24.0 – v0.24.2** (3 versions). Branch: `feat/weather-perception`.
> Master index: [`../README.md`](../README.md).

## The idea

The proactive **wake decision** is wrong for this product. Initiative 15 replaced the LLM
wake-gate with a **deterministic detector registry** (after-a-night, scheduled-slot, weather-shift,
open-thread, promised-follow-through), first-match-wins. In practice that made Luna reach out on a
**calendar** (`LUNA_PROACTIVE_SLOTS=11,20` — "she waits for the top of the hour to speak") and gave
her **no graded restraint**: every fire is one-shot — consider once, speak or stay silent, done. No
ambient musing, no gentle re-nudge, no "I'll leave you be" wind-down.

Alan's **original Python design** is the opposite and is the one he wants: a **single-signal
escalation ladder driven by silence**. One input — *how long since anyone spoke* — drives a phase
machine (`ENGAGED → IDLE_WATCH → NUDGED → DORMANT`) through four restraint levels: a light **ambient**
thought → a low-key **idle_nudge** → progressively lighter **renudge**s on exponential backoff → a
**leave_message** that releases the user and goes quiet, auto-recovering after a cool-down. The model
has the final say (each fire is a *prompt*, and she may output the silent sentinel), and a
**companion-opener constraint** keeps her from ever opening with a surveillance/check-in question.

This initiative restores that ladder as the proactive **decision layer**, deletes the detector
registry + all slot machinery, and — faithful to the Python design — adds the **self-tuning style
layer** (`set_proactive_style`: activeness + voice notes, clamped inside operator safety rails).

## Why now / why this shape

Alan drove the reversal directly (2026-07-01): after seeing the detector set explained, he found the
hour-locked `scheduledWindow` unnatural and said *"主动消息的逻辑可以参考一下 python 版。那一个我的设计就挺好的"*
(reference the Python version; that design of mine was good), then chose **pure-Python replica** — the
silence ladder only, with **all five detectors deleted** (accepting the loss of the net-new
weather-shift / promise-follow-through / after-a-night triggers to get the clean escalation ladder
back).

**Shape: restore the decision layer, keep the agency machinery.** This is a *synthesis*, not a
line-by-line port. Initiative 5's proactive **turn** is good and stays: a proactive turn is a normal
`runTurn` with the full tool surface where speaking is optional and irreversible actions must surface
first (the safety gate). What changes is only the layer *above* it — **what decides when, and with
what restraint, to consider reaching out**. Python's message-only outbox/cursor/TTL/SSE-replay
delivery layer is **not** restored (the single persistent WS already makes it unnecessary — that part
of LD #15 stands).

## Locked design decisions referenced

- **LD #15 — "Proactive = agency, not messaging"** (`REWRITE_CONTEXT.md:50`, LANDED v0.10.0–v0.11.0).
  Verbatim on the point this initiative touches: *"The Python 5-state machine survives only as a
  **cadence governor** (quotas/cooldowns/quiet-hours/DORMANT-recovery/restart-persistence); its
  message-only contract and its outbox/cursor/TTL/SSE-replay delivery layer are dropped."* Rationale
  recorded there: *"audited against the 2026 ambient/Hermes proactive-agent paradigm at Alan's
  direction."*
  → **This initiative AMENDS LD #15.** Alan has reversed the 2026-06-13 direction: the dropped
  escalation ladder (ambient → idle_nudge → renudge → leave_message, backoff, DORMANT-recovery) is
  **restored as the proactive decision layer**. What LD #15 **keeps** is preserved intact: the
  full-tool, message-optional, safety-gated proactive *turn*, the `LUNA_PROACTIVE` kill switch, the
  `.unref()`'d heartbeat, and the dropped outbox/SSE-replay delivery layer stays dropped. The
  amendment lands in `REWRITE_CONTEXT.md` in v0.24.1 (the version that makes the ladder the default).
- **LD #11 — "Memory + dream are one initiative"** (`REWRITE_CONTEXT.md:46`). The proactive
  `consolidate`-intent turn is the dream auto-trigger; **self-continuation** (the ~4s micro-wake after
  a user turn) is a separate path. **Both are untouched** — they are not part of the idle ladder.

## Verified architectural facts (from real TS source)

- **The phase machine is already vestigial.** `Cadence` persists `phase` + `nudgesSent`
  (`cadence.ts:10-22`) and `recordUserActivity(c)` resets them (`cadence.ts:143-145`) — but
  `recordUserActivity` is **never called anywhere**, and `idle_watch`/`nudged`/`dormant` are **never
  written** (the only occurrences are the `PHASES` validation set). Only `'engaged'` is ever stored.
  The DB columns + a validator + an unused reset function are all that remain of the ladder. This
  initiative makes those fields *live* — no new columns are needed for the ladder itself.
- **The decision hook is one call.** `maybeFireProactive` (`fire.ts:118-160`) runs the whole funnel
  inside the single-turn lock: `passesAntiSpam` (`fire.ts:122`) → `detectProactive(ctx)`
  (`fire.ts:125`, the seam defaulting to `evaluateDetectors`) → debounce → `runProactiveTurn` →
  commit. **The ladder replaces exactly `detectProactive`** — the lock, the rail, the turn, and the
  cadence commit are reused.
- **The anti-spam rail already mirrors Python's mechanical gates.** `passesAntiSpam`
  (`cadence.ts:74-93`): `proactiveEnabled` kill switch, `quietHours` (default `0,1,2,3,4,5`), an idle
  floor (`LUNA_PROACTIVE_IDLE_FLOOR_MS`, 60s), a cooldown (`LUNA_PROACTIVE_MIN_INTERVAL_MS`, 300s), a
  daily quota (`LUNA_PROACTIVE_DAILY_QUOTA`, 5). Python's `evaluate` folds these same gates in-line
  (`proactive.py:258-271`). The ladder consumes the rail's verdict; it does **not** re-implement it.
- **The detector registry to delete.** `detectors.ts:229-243` — `REGISTRY = [afterNight,
  scheduledWindow, weatherShift, openThreadAged, promisedFollowThrough]` + `evaluateDetectors`. Slot
  machinery to delete: `scheduledSlots`/`isSlotConsumed`/`markSlotConsumed` (`cadence.ts:120-139`) +
  the `slotsUsed`/`slotsDate` columns + `markSlotConsumed` wiring at `fire.ts:143`.
- **The turn already carries the seed + a partial companion constraint.** `runProactiveTurn`
  (`proactiveTurn.ts:88-102`) returns `{spoke}` (`state.messageTexts.length > 0`); `framing()`
  (`proactiveTurn.ts:71-84`) appends the `seed` to a USER-role stage direction; the `spontaneous`
  DIRECTIVE (`proactiveTurn.ts:21-27`) **already** forbids "在吗 / 吃了吗 / 到哪了 / 怎么不理我".
  The ladder swaps the single `spontaneous` framing for **four scenario framings** and completes the
  companion constraint.
- **The safety gate is decision-independent.** `safetyGate.ts` (per-cycle action budget +
  reversible-silent/irreversible-surfaced) reads only the running turn, not the wake reason —
  **untouched** by this initiative.

## Python parity notes (the design being restored)

Source: `/Users/alanyu2077/Desktop/Agent_Luna/Agent/src/luna/runtime/proactive.py` (+
`memory/proactive_config.py`, `tools/proactive_tools.py`). Mature shipped code — in-source version
anchors run v0.44 (config file) → v0.45.0 (pure-backend trigger) → v0.47.13 (DORMANT recovery) →
v0.58.0.2 (outbox TTL). What we port and what we deliberately drop:

| Python behavior | Cite | Port? |
|---|---|---|
| `evaluate()` phase machine `ENGAGED→IDLE_WATCH→NUDGED→DORMANT(+SLEEPING)` | `proactive.py:223-320` | **Yes** — the decision core |
| `effective_gap = min(gap, since_last_proactive)` (never nudge into a silence she just broke) | `proactive.py:277-281` | **Yes** |
| 4 scenarios: `ambient` / `idle_nudge` / `renudge` / `leave_message` | `proactive.py:297-318` | **Yes** |
| `ambient` = 12% coin flip after `ambient_min`, no-response-needed | `proactive.py:303-304` | **Yes** |
| `renudge` exponential backoff `(1.0, 2.4, 6.0)`, then `leave_message` | `proactive.py:149-151,313-318` | **Yes** |
| DORMANT auto-recovery after `dormant_recovery` (1h) of silence | `proactive.py:288-295` | **Yes** |
| long-absence (>18h) → `SLEEPING`, **stay quiet** until the user speaks | `proactive.py:260-262` | **Yes** (⚠ replaces the TS after-a-night proactive greeting) |
| `commit_emission` — phase/nudges/quota transitions on a fired scenario | `proactive.py:322-342` | **Yes** |
| `COMPANION_OPENER_CONSTRAINT` (陪他不查岗; self-disclosure / fresh topic / vary the opener) | `proactive.py:367-378` | **Yes** — full text |
| `<proactive_meta>{follow_up, reason}>` — model decides "last one" → DORMANT | `proactive.py:434-464` | **Yes** |
| anti-repeat: don't reuse the last few openers (`recent_texts`, maxlen 5) | `proactive.py:204,428-432` | **Yes** |
| `set_proactive_style` + activeness (aloof/balanced/clingy) lever, clamped by floor/ceiling | `proactive_config.py:36-108`, `proactive_tools.py` | **Yes** — v0.24.2 |
| outbox / cursor / TTL / SSE-replay delivery layer | `proactive.py:81-146` | **No** — single WS makes it moot (LD #15 stands) |

**Deliberate divergences (recorded so the implementer doesn't "fix" them):**
1. **Agency preserved over pure messaging.** Python's ladder is message-centric; the TS turn stays
   full-tool + message-optional + safety-gated (LD #15). The ladder decides the *scenario/restraint*;
   the turn still may act silently or speak. So the four scenarios are framings passed to
   `runProactiveTurn`, not a `send_message` call.
2. **No proactive morning greeting.** Pure replica means the after-a-night **detector is deleted**;
   Python instead goes `SLEEPING` on a long absence and waits for the user. The *framing warmth* for a
   long gap (`feltAbsenceFor`, `proactiveWeatherNote` in `proactiveTurn.ts:65-84`) may stay as texture
   but will rarely fire. **This is a real behavior change Alan has accepted.**
3. **One clock.** TS already uses local-time `dateKey`/`getHours` for quota + quiet hours
   (`cadence.ts:47-64`); keep that (Python mixes `now_local` + `time.time()`).

## The hard part

- **Activating a dormant state machine safely.** The `phase`/`nudgesSent` columns exist but have only
  ever held defaults. When the ladder goes live it will *read* them — a restart mid-`NUDGED` must
  rehydrate correctly (Python rehydrates once per process, `proactive.py:241-248`; TS already persists
  via `loadCadence`/`saveCadence`, so this is wiring, not a migration).
- **Two overlapping "min interval" notions.** The rail's cooldown (`passesAntiSpam`) and the ladder's
  `min_interval` are the same concept. Do **not** double-gate — the ladder trusts the rail's cooldown
  and layers only the phase logic on top (Python keeps them equal by default, `proactive.py:270`).
- **`ambient` vs `idle_threshold` ordering.** With Python's conservative defaults `idle_threshold ==
  ambient_min == 120`, the `>= idle_threshold` branch wins and **ambient never fires**. Ambient only
  lives when `idle_threshold` is tuned *above* `ambient_min`. The plan sets sane distinct defaults so
  ambient is reachable, and documents the relationship.
- **Character is the payload.** The restraint-graded directives + the companion constraint are the
  *product*. Port the Chinese directive text faithfully (it is the persona), don't paraphrase it.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.24.0](v0.24.0-silence-ladder-core.md) | v0.24.0 | Silence-driven escalation ladder + 4 scenario framings + companion constraint + `follow_up` meta + anti-repeat — behind `LUNA_PROACTIVE_LADDER` (default off, coexists with detectors) | High | nothing | 📋 PLANNED |
| [v0.24.1](v0.24.1-retire-detectors.md) | v0.24.1 | Flip `LUNA_PROACTIVE_LADDER` default on; delete the 5 detectors + slot machinery + `LUNA_PROACTIVE_SLOTS`; migration to retire the slot columns; amend LD #15 | Medium | v0.24.0 | 📋 PLANNED |
| [v0.24.2](v0.24.2-style-self-tuning.md) | v0.24.2 | `set_proactive_style` tool + activeness (aloof/balanced/clingy) lever + voice-notes/exemplars persistence, clamped inside operator floor/ceiling — initiative close | Low | v0.24.1 | 📋 PLANNED |

## Acceptance criteria for the whole initiative

- [ ] Luna reaches out off **silence**, not a clock: a quiet lull can produce an ambient thought or a
      low-key nudge with **no `LUNA_PROACTIVE_SLOTS` set**.
- [ ] The escalation ladder is observable end-to-end: a sustained no-reply silence produces
      `idle_nudge` → lighter `renudge`(s) on backoff → a `leave_message`, then **DORMANT** (quiet),
      then **auto-recovery** after the cool-down.
- [ ] `effective_gap` holds: she never nudges within `min_interval` of her *own* last outreach.
- [ ] Every proactive opener obeys the **companion constraint** (no 在吗/查岗 opener; varied openings;
      no repeat of the last few openers).
- [ ] `<proactive_meta>{follow_up:false}>` drives her to DORMANT; the meta tail never reaches the
      user-visible bubble / TTS / L2.
- [ ] The five detectors + `scheduledWindow`/slot machinery are **gone**; `bun test` + `tsc` green;
      `LUNA_PROACTIVE=0` still hard-off.
- [ ] `set_proactive_style` lets Luna move her own activeness within bounds she cannot exceed.
- [ ] LD #15 is amended in `REWRITE_CONTEXT.md` (ladder-as-decision restored; agency turn + dropped
      delivery layer preserved).

## Open questions blocking start

- **None block v0.24.0.** The one design ratification — reversing LD #15 — is Alan's explicit
  standing direction (2026-07-01, pure-Python replica). The amendment is recorded, not re-litigated.
- **Settle at build time (v0.24.0):** the default `idle_threshold` / `ambient_min` / `ambient_prob` /
  `renudge_base` / `max_nudges` / `dormant_recovery` values (Python's are a starting point, but Alan
  may want her livelier or quieter — a lived-experience knob, tunable via env without a restart).
