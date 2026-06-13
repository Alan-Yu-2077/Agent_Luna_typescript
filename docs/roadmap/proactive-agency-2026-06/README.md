# Initiative 5 — Proactive Agency (v0.10.0 – v0.11.0)

> **Status: ⏳ PLANNED (authored 2026-06-13).** Priority: next after Initiative 4 (shipped
> v0.9.0). Version range **v0.10.0 → v0.11.0** (5 versions). Master:
> [`../README.md`](../README.md).

## The idea

Give Luna **agency when no one is talking to her** — not just "should I send a check-in message?"
but "I woke on my own; I can think, recall, consolidate, look something up, or reach out — or do
nothing." A proactive turn is a normal `runTurn` with a different opening framing and the full tool
surface; **the `message` tool is optional**, so she can *act without speaking* (quietly save a
fact, refine her sense of the relationship, run a dream) and surface to the user only when it's
worth it. This is the companion-scaled version of the 2026 **proactive / ambient agent** paradigm
(perceive → infer → act autonomously, human-in-the-loop when needed), not a port of Python's
message-only proactive engine.

## Why this reframe (audit of the old design)

Python's proactive engine is **deliberately message-only**: proactive turns set
`disable_code_tools`, skip memory injection, and the directive pressures the model to emit text or
`__PROACTIVE_SILENT__` (`Agent/src/luna/runtime/proactive.py`). Its 5-state machine
(`ENGAGED→IDLE_WATCH→NUDGED→DORMANT→SLEEPING`) only ever decides *whether to speak*. That is a
2024-era check-in bot. The current paradigm — [Hermes Agent (Nous Research, Feb 2026)](https://hermes-agent.nousresearch.com/),
[ambient agents](https://www.moveworks.com/us/en/resources/blog/what-is-an-ambient-agent), and the
proactive-agent literature ([Proactive Agent](https://arxiv.org/pdf/2410.12361),
[PROBE](https://arxiv.org/abs/2510.19771), [ContextAgent](https://openreview.net/pdf/8c61939b607693d9b13cc1df27793d844f3648f5.pdf)) —
centers on **autonomous tool use**, with messaging as one possible output. Alan's explicit intent
(2026-06-13): proactivity must show up as *autonomous tool-calling*, not just messaging.

The reframe is cheap for us because Initiatives 1–4 already built the substrate:
- **everything-as-tool (LD #9)** → `message` is just a tool; a silent proactive turn is native.
- A proactive turn **is `runTurn`** → L1 contract, dispatcher, integrity guards, decision traces all apply unchanged.
- The **wake gate** ("act now?") is *the one legitimate L2 gate* Initiative 4 deferred here (a decision with no turn to ride), reusing the audit lane + `decision` traces.
- **Dream auto-trigger** = one kind of scheduled proactive action (`enter_dream` on deep idle).
- **Self-continuation** = a delayed proactive micro-wake; no separate machinery.
- **Persistent WS (LD #2)** → Python's outbox/cursor/TTL/SSE-replay delivery layer (and its
  v0.58.0.2 backlog-burst bug) **does not exist here**; the server pushes proactive bubbles directly.

The Python state machine survives only as a **cadence governor** (quotas, cooldowns, quiet hours,
DORMANT-recovery, restart-persistence), wrapped around the agency loop instead of being the whole thing.

## Locked decisions (this initiative, 2026-06-13)

Three forks Alan locked before authoring, plus the safety contract they require:

- **Tool scope: full registry, including `shell` when it ships.** Maximum autonomy. (`shell` does
  not exist yet — the loop mounts the full registry per LD #10 always-on; `shell` joins under the
  safety tier below when it lands.)
- **Silent proactive turns allowed.** A proactive turn may complete with tool calls and **no
  `message`** — the message-mode empty-reply guard is relaxed for proactive turns specifically.
- **Triggers: idle ticks + scheduled wakeups** (cron-like), not event-driven (deferred).
- **Safety contract (LD #15, see REWRITE_CONTEXT):** the full-tool-incl-shell choice makes an
  unsupervised loop the highest-risk surface in the rewrite, so the agency loop is governed by:
  *reversible/read-only actions (recall, read, search, memory writes, dream) may run silently;
  **irreversible or destructive actions must surface** — Luna messages the user about what she did
  or intends, rather than executing silently.* Plus a global kill switch (`LUNA_PROACTIVE`,
  default off until proven), a per-cycle **action budget**, deny-regex on `shell` (LD #10), and full
  tracing under a `proactive:<cycle_id>` namespace (the dream-cycle pattern). This contract is the
  spine of v0.10.1.

## Locked design decisions referenced (from REWRITE_CONTEXT.md)

- **LD #2 single WebSocket** — server-initiated push of proactive bubbles; no outbox/replay layer.
- **LD #9 everything-as-tool** — `message` optional; silent agency native.
- **LD #10 always-on tools + deny-regex** — proactive turns mount the full registry; `shell` (when
  it ships) carries its deny-regex into the proactive tier.
- **LD #11 dream merge** — dream auto-trigger lands here (the deferred half), reusing this initiative's idle scheduler.
- **LD #14 action-integrity** — proactive turns are `runTurn`, so the L1 contract + integrity
  guards + decision audit govern autonomous action exactly as they govern reactive turns; the wake
  gate is the legitimate L2 gate Initiative 4 deferred.

## Verified architectural facts (TS source, to confirm at build time)

These are the hook points the plans build on (cite `file:line` when each version starts):

1. **`runTurn`** ([`packages/server/src/turn/runTurn.ts`](../../../packages/server/src/turn/runTurn.ts))
   is the reusable turn engine; `finalize` owns the message-mode empty-reply guard (the thing
   v0.10.0 must relax for proactive turns) and the integrity guards. A proactive turn is a
   `runTurn` with a proactive opening directive + the full registry.
2. **Dream cycle** ([`packages/server/src/dream/cycle.ts`](../../../packages/server/src/dream/cycle.ts))
   is the precedent for a second StateGraph + `proactive:<cycle_id>` tracing + per-step flush +
   `Provider.complete` off the reply key. The proactive loop borrows its trace/isolation shape.
3. **Decision traces + audit lane** ([`packages/server/src/turn/integrity/defectionAudit.ts`](../../../packages/server/src/turn/integrity/defectionAudit.ts),
   `DecisionTraceEvent`) — the wake gate writes `surface:'proactive_wake'` decision traces; the
   safety surfacing writes `surface:'proactive_action'`.
4. **WS server** ([`packages/server/src/ws.ts`](../../../packages/server/src/ws.ts), `main.ts`)
   — the heartbeat/scheduler lives server-side; proactive bubbles push over the existing WS;
   `chat.send` already serializes against an active turn via `Session.mutex` (proactive turns must
   take the same mutex so they never overlap a user turn).
5. **Session store** ([`packages/server/src/memory/sessionStore.ts`](../../../packages/server/src/memory/sessionStore.ts))
   — cadence state (phase, quota, last-proactive-at) persists here for restart-survival (Python
   v0.47.3 lesson); a new migration adds the columns.

## Python parity notes (lessons to keep, machinery to drop)

Keep the **lessons**, not the code (`Agent/src/luna/runtime/proactive.py`, `self_continuation.py`):
- **Cadence must survive restart** (v0.47.3) — persist phase/quota/last-proactive-at.
- **Negative verdicts must expire** (v0.47.13) — DORMANT auto-recovers after a cooldown; one
  "don't bother" must not mute her forever.
- **Don't depend on UI liveness** (v0.45.0) — the scheduler is pure backend (trivially true with
  our persistent WS).
- **Companion-opener constraint** — never open with status/check-in questions (在吗/吃了吗/到哪了);
  self-disclosure or a fresh topic instead. Port the directive guidance into the proactive framing.
- **Self-reported "more to say" signals are unreliable** (v0.28.1) — self-continuation uses a
  probability/mechanical gate, not a model-emitted flag.
- **Stage directions go low in the message array, never system** (v0.27.1) — the proactive/
  continuation framing is a user-role stage direction (consistent with the v0.6.2/v0.8.2 guards).

**Dropped wholesale:** ProactiveOutbox, seq cursors, TTL replay, the SSE poll/stream dual path —
all artifacts of intermittent HTTP+SSE that the single persistent WS makes unnecessary.

## The hard part (recurring principles)

1. **Safety before autonomy.** The guardrails (v0.10.1) land *before* the scheduler makes the loop
   autonomous (v0.10.3). A manually-triggered primitive (v0.10.0) is the test bed.
2. **Reversible-silent / irreversible-surfaced.** The one rule that reconciles full-tool autonomy
   with an unsupervised loop. Reads, searches, recall, memory writes, dream → may be silent.
   Anything that mutates the outside world irreversibly → must surface.
3. **A proactive turn never overlaps a user turn.** Both take `Session.mutex`; a user message
   mid-proactive-cycle wins (the proactive turn yields or is abandoned cleanly).
4. **Everything traced.** A proactive cycle is as inspectable as a dream — `proactive:<cycle_id>`,
   per-action decision traces, browsable at `/_trace`. An autonomous loop you can't audit is a
   liability.
5. **Off by default until proven.** `LUNA_PROACTIVE=0` is the kill switch; flip only after the
   manual primitive + safety + scheduler are individually verified.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.10.0](v0.10.0-proactive-turn-primitive.md) | v0.10.0 | Proactive turn primitive — `runTurn` + proactive framing + full registry + **silent allowed** (manual trigger) | Medium | nothing | ⏳ |
| [v0.10.1](v0.10.1-autonomous-safety.md) | v0.10.1 | Safety & permission scaffolding — reversible-silent/irreversible-surfaced, action budget, kill switch, tracing | High | v0.10.0 | ⏳ |
| [v0.10.2](v0.10.2-cadence-wake-gate.md) | v0.10.2 | Cadence governor + wake gate — quotas/cooldowns/quiet-hours + the bounded "act now?" L2 gate | Medium | v0.10.0 | ⏳ |
| [v0.10.3](v0.10.3-scheduler-heartbeat.md) | v0.10.3 | Scheduler/heartbeat — idle ticks + scheduled wakeups → autonomous; cadence restart-persistence | High | v0.10.1, v0.10.2 | ⏳ |
| [v0.11.0](v0.11.0-continuation-dream-close.md) | v0.11.0 | Self-continuation (delayed micro-wake) + dream auto-trigger + surfacing UI + measurement + close | Medium | all | ⏳ |

## Acceptance criteria for the whole initiative

- [ ] A proactive turn can run the full tool surface and complete **silently** (no `message`) —
      verified end-to-end.
- [ ] The reversible-silent / irreversible-surfaced contract is enforced and tested (a mutating
      action without a surfacing `message` is caught).
- [ ] The wake gate's "act now?" decisions are visible as `proactive_wake` decision traces.
- [ ] A proactive turn never overlaps a user turn (mutex; user message mid-cycle wins).
- [ ] Cadence survives restart; DORMANT auto-recovers; quiet hours + daily quota honored.
- [ ] Dream auto-triggers on deep idle via the scheduler; self-continuation works as a delayed micro-wake.
- [ ] `LUNA_PROACTIVE=0` fully disables the loop (kill switch); default off until v0.11.0 close.
- [ ] Every proactive cycle is fully traced at `/_trace`; full suite green; real-LLM smokes per version.

## Open questions blocking start

None block v0.10.0. To settle during the initiative, at the version that owns each:
- **Safety contract precision (v0.10.1):** the exact "irreversible/destructive" classification —
  which tools/operations must surface. Starting position: any non-read, non-memory, non-dream tool
  (i.e. `shell` writes, future file mutation) must surface; memory writes are reversible (soft-delete + dream reconciliation) so may be silent.
- **Schedule config shape (v0.10.3):** how scheduled wakeups are expressed (cron strings? a small
  declarative table?) and where stored.
- **Quota/cadence constants (v0.10.2):** the companion-appropriate idle threshold, daily quota,
  cooldowns — tuned against a recorded baseline like Initiative 3/4, not guessed.
- **Self-continuation default (v0.11.0, REWRITE_CONTEXT Open Q #2):** ship on by default, or opt-in?
