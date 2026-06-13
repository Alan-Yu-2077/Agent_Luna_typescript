# Initiative 4 — Action Integrity Rails (v0.8.0 – v0.9.0)

> **Status: ✅ SHIPPED 2026-06-13 (all 5 versions).** Version range **v0.8.0 → v0.9.0**. Master:
> [`../README.md`](../README.md). As-shipped notes are folded into LD #14 in
> [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md) and the per-version records in
> [`../../history/DEVELOPMENT.md`](../../history/DEVELOPMENT.md).

## The idea

Make Luna's words and actions one thing. Two failure modes are in scope, both with real evidence
in this project: **言行不一致** — she says "我马上去查" and then ends the turn with `tool_calls=[]`
(Python v0.58.0.1; and the TS L3 key_moment "说'让我先读'却没真读，被你当场拆穿"); and **该调不调**
— a fact worth remembering or a memory worth recalling passes without the tool firing. The cure is
**constraining what the model thinks about** (an L1 thinking contract), backed by mechanical
enforcement at the output boundary and an off-hot-path audit that measures whether it's working.

## Why this shape, and why it is NOT a gate layer

This corrects a Python misreading (recorded as **LD #14** in
[`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md)). Alan's original reasoning-constraint
intent was *always* the **thinking contract** — shape how Luna reasons so tools fire reliably and
promises convert to acts. Python's `reasoning-spec.md` misread this as a separate **L2 decision
gate** (an extra bounded LLM call emitting `{decision, reason}`) and built a harness around it.
That harness is **not ported**:

- A gate is an *external* judge — it cannot reach into a turn and force the main model's hand.
  Using a softer thing (a second judgment) to fix a soft failure (the first judgment) is the
  wrong tool. The thing that actually moves the model's behavior mid-turn is the **contract it
  reasons under** plus **mechanical enforcement of what it emitted**.
- A gate only earns its keep when a decision has **no turn to ride** — proactive outreach,
  self-continuation (decisions that happen with no user message in flight). Those belong to
  **Initiative 5**, hand-rolled there if needed. Building the harness now, speculatively, is the
  investment Python's own spec warned against ("finalized at v0.49 with the first real consumer").

Python's *four principles* survive where still apt — **override-not-depend** (a missing signal
falls back to mechanical behavior, never silently disables a feature — the lesson that killed the
v0.28 `more_to_say` signal), **inviolable mechanical rails**, **every decision logs its reason**,
**cheap-exit first**. Its *machinery* does not.

## Locked design decisions referenced

From [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- **LD #14 (Reasoning constraints)** — L1 thinking contract is the design; structural +
  mechanical enforcement at the boundary; async defection audit into decision traces; no standing
  L2 gate harness. This initiative *is* LD #14's implementation.
- **LD #9 (Everything-as-tool)** — speech is the `message` tool; "calling IS the act" is already
  half-true structurally (a turn that thinks but emits nothing is caught by the v0.6.2 empty-reply
  guard). This initiative closes the remaining gap: thinking that *promises* an act via `message`
  text instead of performing it.
- **LD #10 (always-on tool surface)** — the `recall` tool mounts always; no judgment-gated
  mounting. Immunizes the Python "said I'd remember but the tool wasn't even mounted" class.

## Verified architectural facts (TS source, read 2026-06-13)

Hook points this initiative builds on, confirmed from shipped code:

1. **The empty-reply guard is the generalization seed** —
   [`runTurn.ts:297`](../../../packages/server/src/turn/runTurn.ts) checks
   `messageTexts.length === 0 && finishReason === 'end_turn' && !silentRetried`, injects a
   **user-role** stage direction ([`SILENT_TURN_DIRECTIVE`, runTurn.ts:30](../../../packages/server/src/turn/runTurn.ts)),
   re-enters `build_request`, and on double-failure writes an `empty_turn` node trace
   (runTurn.ts:323). The action-integrity guards (v0.8.2) are the same pattern with new
   predicates; `silentRetried` becomes a small retry-reason set.
2. **The L1 contract is a new block in the cached system core** —
   `buildSystemPrompt(session, messageMode)`
   ([`runTurn.ts:24`+](../../../packages/server/src/turn/runTurn.ts)) already assembles
   base → message-mode directive → persona → embodiment → humanity → core memory into one
   `cache_control` block. The L1 contract is one more stable part — byte-identical across turns,
   so the prompt-cache invariant holds (extend the existing snapshot test).
3. **`is_final` is a free promise contract** — `MessageInput`
   ([`message.ts:49`](../../../packages/protocol/src/message.ts)) already carries
   `is_final: z.boolean()`. A turn whose last delivered message had `is_final:false` but then
   ended is a **mechanically detectable** broken promise — zero false positives, no dictionary.
4. **Decision traces extend the existing union** — `TraceEvent` is a
   `z.discriminatedUnion('kind', …)` ([`trace.ts:44`](../../../packages/protocol/src/trace.ts))
   with `node`/`tool`/`outbound`/`overflow` variants, stored one row per event and rendered at
   `/_trace`. A new `decision` variant is the natural home for defection-audit output — the
   "decision replay tree" is the existing per-turn trace view, gaining decision rows.
5. **An off-hot-path LLM lane exists if a future consumer needs one** — `Provider.complete()`
   ([`types.ts:48`](../../../packages/server/src/provider/types.ts)) + the summarizer-key cascade
   ([`main.ts:42`](../../../packages/server/src/main.ts), `dreamLlm.primary/fallback`) give a
   judgment call that never competes with the reply key's quota. **This initiative's audit does
   NOT use it** — detection is a pure function (2026-06-13 amendment), so I4 stays zero-LLM until
   the v0.9.0 sweep. The lane is noted here because **Initiative 5's gate** (a trigger with no
   turn to ride) is its natural first real consumer.
6. **The measurement harness exists** — `scripts/ab-message-mode.ts`
   ([packages/server/scripts](../../../packages/server/scripts/ab-message-mode.ts)) already runs a
   scripted conversation through both modes and tallies per-turn metrics. v0.9.0 extends it with
   intent-honored / tool-fire columns rather than inventing a new harness.

## Python parity notes (read 2026-06-13)

- **Intent-without-act audit** mirrors Python `_audit_web_search_intent_no_call`
  (`agent_loop.py:669`): tool mounted, not called, intent pattern matched → log a defection with
  the matched keyword + evidence tail. **TS divergence (2026-06-13 plan audit): the load-bearing
  match source is the *delivered message text*, not thinking.** Python matched raw thinking; our
  thinking is `display:'summarized'` and may paraphrase or drop the intent phrasing, so
  thinking matches are demoted to an audit-only count. Message texts are verbatim
  (`state.messageTexts`) and are the user-facing promise itself — strictly better signal on this
  stack. We additionally have the structural `is_final` promise check Python lacked, and emit
  typed `decision` traces instead of a JSONL side-file.
- **Empty-reply retry** mirrors Python `_primary_chat` empty-reply path (`agent_loop.py:1031`,
  retry with `tools=[]` + `thinking={}`); the TS empty-reply guard (v0.6.2) already ships this
  shape. v0.8.2 generalizes it rather than re-porting.
- **L1 thinking contract** generalizes Python's scattered L1 directives (commitment-to-act for
  web search; "you MUST always produce a spoken reply"; v0.50 memory-salience thinking scope) into
  one coherent contract block — the thing Python never consolidated because it was chasing the L2
  misreading.
- **Not ported**: `reasoning.py` harness (`parse_reasoning_meta`/`reasoned_decision`/
  `append_reasoning_audit`), `reasoning.jsonl` sink, the `<reasoning_meta>` regex protocol. Reason:
  LD #14 — these are the gate machinery.

## The hard part (recurring principles for this initiative)

1. **Enforce structurally before judging.** Order of preference for every integrity concern:
   make the failure *unrepresentable* (schema) > *mechanically caught + corrected* (guard) >
   *prompted against* (L1 contract) > *measured after* (audit). Reach for a model judgment only
   when the first three can't apply.
2. **Guards correct once, then yield.** Every mechanical guard gets exactly one corrective retry
   (the empty-reply guard's discipline), then degrades gracefully and logs — never a retry loop,
   never a hard block on a possibly-false-positive.
3. **Instrument before contract.** The defection audit (the measurement instrument) ships
   *first* so every later version's effect is a before/after number, not a vibe. This is Python's
   "measure before extending" made structural — and our own A/B discipline from Initiative 3.
4. **The contract is cache-stable.** L1 text lives in the system core; it must be byte-identical
   across turns or it breaks the prompt-cache invariant. No per-turn interpolation in the contract
   block.
5. **Override-not-depend.** Nothing here may turn a feature off when it misfires: a failed audit
   call, a garbled judgment, a missed pattern → fall back to current behavior + a trace, never a
   silenced capability.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.8.0](v0.8.0-decision-traces-audit.md) | v0.8.0 | Decision trace events + async defection audit + replay-tree view (**the instrument, first**) | Low | nothing | ⏳ |
| [v0.8.1](v0.8.1-l1-thinking-contract.md) | v0.8.1 | L1 thinking contract block (commitment-to-act + proportionality + no-leak) | Low | v0.8.0 (to measure) | ⏳ |
| [v0.8.2](v0.8.2-action-integrity-guards.md) | v0.8.2 | `is_final` promise contract + intent-without-act guard (mechanical) | Medium | v0.8.0, v0.8.1 | ⏳ |
| [v0.8.3](v0.8.3-recall-tool.md) | v0.8.3 | `recall` tool (Open Q #9) + tool-trigger checklist in L1 | Low | v0.8.1 | ⏳ |
| [v0.9.0](v0.9.0-measure-and-close.md) | v0.9.0 | Measurement sweep + contract tuning + initiative close | Low | all | ⏳ |

## Acceptance criteria for the whole initiative

- [ ] A recorded before/after: intent-without-act defection rate and tool-fire rate, measured on
      the same scripted conversation with the contract+guards off (baseline) vs on.
- [ ] `is_final:false`-then-end is mechanically impossible to ship un-retried; verified by test.
- [ ] The L1 thinking contract lives in the cached system core; system prompt stays byte-identical
      across no-change turns (existing snapshot test extended, still green).
- [ ] `recall` is callable by the model and its call/no-call shows up in decision traces.
- [ ] `/_trace` shows decision rows interleaved in the per-turn tree (the replay view).
- [ ] Every guard/audit obeys override-not-depend: a forced failure falls back + traces, never
      disables a capability (tested).
- [ ] Full suite green; real-LLM smoke per version that touches the provider path.

## Open questions blocking start

None block v0.8.0. Two to settle *during* the initiative, at the version that owns them:

- **Intent dictionary scope (v0.8.2):** which CJK/English thinking patterns count as a promise to
  act, and how to keep false positives low (the guard offers a *double exit* — "act now, or
  rephrase without promising" — precisely because the dictionary is fuzzy). Tuned against v0.8.0's
  recorded baseline.
- **Recall trigger discipline (v0.8.3):** how hard the L1 contract pushes "recall before
  answering" without making her recall-spam. Measured, not guessed.
