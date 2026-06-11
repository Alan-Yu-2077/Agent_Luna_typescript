# Initiative 1 — Tool spec foundation (v0.1.0 – v0.3.0)

## Why this is first

Six root causes of the Python tool-call instability, traced in the 2026-06-11 audit:

1. Mount logic has 5 intersecting paths (`force_full_tools` / `workspace_intent` / `judgment.mode` /
   skill-forced / env-gates). Every regression in v0.47.x was in this layer.
2. Tool surface is 56 items (29 are STS2 and effectively unused).
3. `startswith('Error')` heuristic mis-flags tools returning normal text.
4. Token streaming silently disabled on any tool-enabled turn (no perceived progress for ~30s).
5. No verifier loop on risky tools (`write_file` "succeeds" without confirming intent).
6. Stall detection is reactive (5 god-class rules in `ToolResultAdapter`).

This initiative fixes 1-6 **by design** before any other Luna feature lands. Memory, persona,
reasoning, proactive, and frontend all sit on top of a stable tool surface, so getting this right
first means nothing downstream re-litigates a broken foundation.

## Versions

| Version | Plan | Theme | Status |
|---|---|---|---|
| v0.1.0 | [Bun skeleton + WS server](v0.1.0-bun-skeleton.md) | Project bootstrap; protocol package; one WS endpoint that echoes typed events | ✅ shipped 2026-06-11 |
| v0.2.0 | [Typed tool registry + `Result<T>`](v0.2.0-tool-registry.md) | Zod-first tool definitions; discriminated result type; concurrency policy; per-tool `summarize()`; 3 representative tools | ✅ shipped 2026-06-11 |
| v0.3.0 | [Anthropic interleaved tool-use end-to-end](v0.3.0-interleaved-tool-use.md) | First real LLM round trip; tools stream progress through the WS; one-turn happy path working | ⏳ planned |

## Acceptance for this initiative

When v0.3.0 ships, the following must be true:

- [ ] Running `bun start` boots a server in <100ms.
- [ ] A connected client can open a WS, send a user message, and receive a typed event stream that
  ends with `turn.result`.
- [ ] At least one tool runs during the turn (e.g. `time_now` or `read_file`), streams progress
  events, and returns a typed `Result<T>`.
- [ ] Token streaming **does not stop** when a tool call happens mid-turn (interleaved tool-use).
- [ ] All event types on the wire are defined in `packages/protocol` as Zod discriminated unions.
- [ ] `packages/server` has zero `as any` casts on the wire boundary.
- [ ] No `startswith('Error')`-style heuristics anywhere in the tool path.
- [ ] All tools always-mounted; no demand-load, no keyword-driven `workspace_intent`, no
  `force_full_tools` meta field.

## What this initiative explicitly does NOT include

- Memory (no persistence yet — turns are in-process only).
- Persona / humanity (model gets a placeholder system prompt).
- Reasoning rails (no L1/L2 contracts; the model just responds).
- Proactive (no idle handling, no state machine).
- Frontend (a minimal CLI or test harness client only; no Live2D, no `agent-app.js` integration).
- Multiple sessions (one session, in-memory state).

These come in initiatives 2-7. The hard rule for this initiative is: **prove the tool spec is
stable end-to-end with the smallest possible surrounding system**.

## Open questions for v0.3 design

(From [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md) open list. v0.1 and v0.2 shipped
without foreclosing future shape.)

- ~~Q1~~ **RESOLVED 2026-06-11 by Locked Decision #10**: shell tool always-on + deny-regex
  inside the tool. `defineTool` has no `mountedWhen` field.
- ~~Q3~~ **RESOLVED 2026-06-11 by Locked Decision #9 (everything-as-tool)**: Live2D metadata
  lives in the `message` tool envelope (`expression`, `emotion`, `voice_params`), not a
  separate `set_expression` tool. 10-tool surface stays at 10. Introduction at v0.6.
- ~~Q5~~ **RESOLVED 2026-06-11 at v0.2 design review**: 3-state concurrency enum locked;
  per-resource locks revisited only if v0.4 memory work demands finer granularity.

v0.3 (Anthropic interleaved tool-use) has no remaining blocking open questions; it builds on
the v0.2 contract verbatim.
