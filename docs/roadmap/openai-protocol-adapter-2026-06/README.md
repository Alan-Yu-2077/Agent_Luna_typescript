# Initiative 16 — OpenAI-protocol adapter (model compatibility)

> **Status: PLANNED.** Priority: next after Initiative 15 (proactive redesign, ✅ shipped).
> Version range: **v0.23.0 – v0.23.3**. Master index: [`../README.md`](../README.md).

## The idea

Today Luna can only run on the **Anthropic Messages protocol** — the chat path is hardwired to
`@anthropic-ai/sdk` shapes (the request, the streaming events, and the *canonical history format*
are all Anthropic-typed). This initiative adds an **OpenAI Chat-Completions–protocol provider**
behind the existing `Provider` seam so Luna can run on **any model reachable over the OpenAI
protocol** (OpenAI's own models, OSS models behind an OpenAI-compatible gateway, the yunwu
OpenAI route, vLLM/Ollama/LM Studio, etc.) — while keeping Anthropic the native, default path.
The through-line is unchanged: low latency (interleaved tool-use streaming) + a typed contract.

The chosen shape is **translate at the provider boundary**, not a ground-up neutral-IR rewrite:
the Anthropic-shaped types stay the internal interchange format, and `OpenAIProvider` is a
*translating adapter* (Anthropic⇄OpenAI in/out). This keeps the blast radius to the new provider
+ a pure translation layer, leaving `runTurn`/history/memory/tests untouched. (The alternative —
a provider-neutral message IR threaded through ~30 files + the L2 history schema — is recorded
under "Architectural decision" as explicitly deferred.)

## Why prioritized

Model breadth is a strategic capability (cost/availability/experimentation, and a hard
requirement for OSS packaging — Initiative refs in the master index). It is also *low-coupling*:
the `Provider` interface already exists as the single seam, so the work is additive and
flag-isolated, with zero default-path change until explicitly switched.

## Locked design decisions referenced (and AMENDED)

This initiative **amends a Locked Decision** in [`docs/REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md).
Recording the amendment (with rationale) is in-scope for v0.23.0.

- **LD (provider), verbatim:** "LLM provider | **Anthropic via official SDK** | Drop
  `openai_compat` (broken `api_key_override` handling) and `mock` provider."
- **Cut-list entry, verbatim:** "`openai_compat` adapter — doesn't honor `api_key_override`, so
  v0.47.5 isolation evaporates on it."
- **LD #13, verbatim (excerpt):** "…Embeddings via a **minimal standalone fetch client**
  (Anthropic has no embeddings API) — this is *not* a resurrection of the cut `openai_compat`
  adapter, which targeted the chat-provider path; **chat stays Anthropic-SDK-only**."

**Why the amendment is justified (not a regression to the cut adapter):** the Python
`openai_compat` was cut for one concrete bug — it ignored per-call `api_key_override`, breaking
the dream summarizer-key isolation. A **fresh TS `OpenAIProvider`** has no such bug: like
`AnthropicProvider`, it takes `apiKey` in its constructor (`provider/anthropic.ts:40-46`), so the
summarizer-key cascade (`DreamLLM {primary, fallback}`) works per-instance. The LD's *intent*
(don't ship a key-isolation-breaking adapter) is preserved; only "chat is Anthropic-only" is
lifted. The embeddings path (LD #13) is **unaffected** — it is already a standalone fetch client,
out of scope here.

## Verified architectural facts (from source, 2026-06-25 @ v0.22.3)

- **The seam is small + clean:** `interface Provider { chatStream(req): AsyncIterable<ProviderEvent>;
  complete(req): Promise<CompleteResult> }` — [`provider/types.ts:50-53`](../../../packages/server/src/provider/types.ts). Two impls today: `AnthropicProvider`, `MockProvider`.
- **But the seam leaks Anthropic types as the canonical IR:** `ProviderRequest.system: string |
  Anthropic.TextBlockParam[]`, `messages: Anthropic.MessageParam[]`, `tools: Anthropic.Tool[]`
  ([`types.ts:29-37`](../../../packages/server/src/provider/types.ts)); `ProviderEvent.message_stop.assistantContent: Anthropic.ContentBlock[]` ([`types.ts:21-27`](../../../packages/server/src/provider/types.ts)); `CompleteRequest.messages: Anthropic.MessageParam[]` ([`types.ts:39-43`](../../../packages/server/src/provider/types.ts)).
- **History is Anthropic-shaped end to end:** `session.history: Anthropic.MessageParam[]`
  ([`turn/session.ts:16`](../../../packages/server/src/turn/session.ts)); `runTurn` pushes `{role:'assistant', content: ev.assistantContent}` at `message_stop` ([`turn/runTurn.ts:364`](../../../packages/server/src/turn/runTurn.ts)) and tool results as Anthropic `{type:'tool_result', tool_use_id, content, is_error}` blocks in a user message ([`runTurn.ts:498-514`](../../../packages/server/src/turn/runTurn.ts)). **~30 files import `@anthropic-ai/sdk`** (mostly to type `MessageParam`/`ContentBlock`) — the breadth that makes a neutral-IR rewrite expensive and the boundary-translation shape cheap.
- **Anthropic-specific request features in the chat path:** `thinking: {type:'adaptive',
  display:'summarized'}` ([`anthropic.ts:80`](../../../packages/server/src/provider/anthropic.ts)); a `cache_control: {type:'ephemeral'}` breakpoint on the system text block ([`runTurn.ts:148`](../../../packages/server/src/turn/runTurn.ts)) — the prefix-cache keystone (the rewrite's #1 perf goal); the yunwu `_noargs` gateway unwrap ([`anthropic.ts:18-35`](../../../packages/server/src/provider/anthropic.ts)). `complete()` deliberately omits thinking ([`anthropic.ts:48-58`](../../../packages/server/src/provider/anthropic.ts)).
- **Streaming shape today (Anthropic SSE):** `content_block_start` (tool_use) → `content_block_delta`
  (`text_delta`/`thinking_delta`/`input_json_delta`) → `finalMessage()` → `content` blocks +
  `stop_reason` + `usage` ([`anthropic.ts:72-140`](../../../packages/server/src/provider/anthropic.ts)). The `ProviderEvent` union is the normalization target every provider must emit.
- **Config + instantiation:** `LUNA_MODEL` (default `claude-opus-4-8`), `LUNA_MAX_TOKENS`,
  `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` ([`anthropic.ts:10-11,40-46`](../../../packages/server/src/provider/anthropic.ts)); `new AnthropicProvider()` + the summarizer-key dream cascade in [`main.ts:71-77,112`](../../../packages/server/src/main.ts).
- **`complete()` consumers:** `DreamLLM {primary, fallback}` ([`dream/llm.ts`](../../../packages/server/src/dream/llm.ts)) — both providers must implement `complete`.
- **Tool-schema wire rule (must carry over):** tools are **flat root-level objects** (the yunwu
  gateway mangles root-level `anyOf`); enforced via `superRefine`, regression-tested in
  `runTurn.test.ts` (REWRITE_CONTEXT v0.5.2 amendment). The OpenAI `tools`/`functions` schema is
  derived from the same `Anthropic.Tool[]` and inherits the flat-root constraint.

## Architectural decision

**Chosen: boundary translation (Anthropic-shaped types remain the canonical IR).** `OpenAIProvider
implements Provider` translates `ProviderRequest`→OpenAI request on the way in and OpenAI
response/SSE→`ProviderEvent` (with a **synthesized `assistantContent: Anthropic.ContentBlock[]`**)
on the way out, so multi-turn history replay is unchanged. Pros: blast radius = the new provider +
a pure, unit-testable translation module; `runTurn`/history/memory/the ~30 importers stay as-is;
default path byte-identical. Cons: an Anthropic⇄OpenAI **round-trip** each turn (history stored
Anthropic-shaped, re-translated to OpenAI next turn) — acceptable and lossless for text + tool
calls; reasoning/thinking is the lossy edge (handled in v0.23.2).

**Deferred: a provider-neutral message IR.** Cleaner long-term (no round-trip) but a ~30-file +
L2-schema refactor — out of scope; revisit only if the round-trip proves lossy in practice.

## The hard part (recurring principles)

- **History round-trip fidelity.** The single highest-risk surface: a multi-turn conversation with
  `tool_use`/`tool_result` blocks must survive Anthropic→OpenAI→(synthesized Anthropic)→OpenAI…
  Map `tool_use`↔`assistant.tool_calls[]`, `tool_result`↔`{role:'tool', tool_call_id}`, content
  blocks↔string-or-parts. Pure translation functions, exhaustively unit-tested, land **before** any
  network code.
- **Interleaved tool-use streaming.** The rewrite's #1 latency principle (REWRITE_CONTEXT) — do not
  buffer tool calls to the end. OpenAI streams `tool_calls[].function.arguments` as string deltas
  across chunks keyed by `index`; accumulate per-index and emit `tool_use_start`/`tool_input_delta`
  as they arrive, mirroring the Anthropic path.
- **The cache invariant degrades, doesn't break.** `cache_control` is Anthropic-only; the OpenAI
  provider strips it. Where the OpenAI backend auto-caches a stable prefix the byte-stable system
  block still helps; where it doesn't, the turn is correct but un-cached. An accepted divergence —
  model breadth in exchange for a provider-specific perf guarantee.
- **Capability-gated behavior, not model sniffing.** Branch on a `ProviderCapabilities` descriptor
  (thinking? prompt-cache? tool support? system role? token-param name?), never on a model-id regex.

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.23.0](v0.23.0-provider-seam-capabilities.md) | v0.23.0 | Provider seam: `ProviderCapabilities` + `providerFor()` factory; route Anthropic through it unchanged; record the LD amendment | Low | — | PLANNED |
| [v0.23.1](v0.23.1-openai-translation-complete.md) | v0.23.1 | `OpenAIProvider`: the Anthropic⇄OpenAI translation core (pure, unit-tested) + `complete()` + a correctness-first non-streaming `chatStream()` | Medium | v0.23.0 | PLANNED |
| [v0.23.2](v0.23.2-openai-streaming.md) | v0.23.2 | OpenAI SSE → `ProviderEvent` real streaming (interleaved tool-use parity) + reasoning→thinking | Medium-High | v0.23.1 | PLANNED |
| [v0.23.3](v0.23.3-model-registry-close.md) | v0.23.3 | per-model capability quirks + a model→provider registry + multi-model E2E + REWRITE_CONTEXT amendment + close | Medium | v0.23.2 | PLANNED |

## Acceptance criteria for the whole initiative

- [ ] `LUNA_PROVIDER=openai` runs a full **reactive** turn end-to-end on an OpenAI-protocol model
      via the gateway — text reply + a real tool call + the `message` tool — with correct history.
- [ ] **Token streaming + interleaved tool-use** works on the OpenAI path (no buffer-till-end).
- [ ] **Multi-turn history round-trips** without corruption: `tool_use`/`tool_result` and
      multi-message assistant turns survive Anthropic→OpenAI→synthesized-Anthropic→OpenAI.
- [ ] `complete()` works on the OpenAI provider (dream/summarization via the `DreamLLM` cascade,
      summarizer-key honored per-instance).
- [ ] A **reasoning model**'s reasoning surfaces as `thinking_delta` (or is cleanly omitted); a
      **no-tools** or **no-system-role** model degrades gracefully (capability-gated).
- [ ] `LUNA_PROVIDER=anthropic` (**default**) is byte-for-byte unchanged; all existing tests green;
      the Anthropic prefix-cache invariant intact.
- [ ] The provider LD in `REWRITE_CONTEXT.md` is amended (multi-provider chat); `luna-ts-orient`
      skill-map updated to name `providerFor`/`OpenAIProvider`/`ProviderCapabilities`.

## Open questions blocking start

1. **Target endpoint/model matrix.** Which OpenAI-protocol target(s) does Alan want first — the
   yunwu OpenAI route, OpenAI direct, or a specific OSS model behind a compatible gateway? This
   fixes the test matrix and *which* quirks (token-param name, system-role support, reasoning
   shape) actually matter. (Blocks v0.23.1 test design + v0.23.3 scope.)
2. **Config surface.** One global `LUNA_PROVIDER`+`LUNA_MODEL`+`LUNA_OPENAI_BASE_URL`/`_API_KEY`,
   or a real **model registry** (id → provider/endpoint/key/capabilities) so several models are
   selectable without env churn? (Sizes v0.23.3.)
3. **UI exposure.** Is model selection / thinking-availability a web-UI concern in this initiative,
   or purely server/env for now? (If UI: a wire-contract addition in the protocol package — flag it
   early.)
