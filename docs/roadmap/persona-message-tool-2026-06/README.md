# Initiative 3 — Persona + Humanity Guardrails + `message` Tool (v0.6.0 – v0.7.0)

> **Status: ✅ SHIPPED 2026-06-13 (all 4 versions, authored 2026-06-12).** Version range
> **v0.6.0 → v0.7.0**.
> This is where **LD #9 (everything-as-tool) lands**: all user-facing output moves into a typed
> `message` tool envelope, humanity hard caps become Zod schema instead of prompt hopes, and
> Luna gets her actual persona. Master: [`../README.md`](../README.md).

## The idea

Through v0.5.2 Luna is an excellent *agent* and an anonymous *person*: she remembers, recalls,
dreams — but speaks with a default assistant voice through top-level text. This initiative gives
her (1) a persona resolved from files + her own core memory, (2) humanity guardrails that are
**schema-enforced, not prompt-suggested**, and (3) the `message` tool — the single typed channel
for everything she says, carrying Live2D metadata (`expression`, `emotion`, `voice_params`) in
the same validated frame as the text.

Python reference (research read 2026-06-12, ground-truth file:line audit): persona =
`soul.py` 3-layer assembly (base md file → active-persona selector → scene-conditional message);
humanity = `humanity_rules.json` caps (140/4/55) injected as prompt text + **observational**
auditor (no enforcement — v0.47.4 showed 8/8 violations slip through); message pipeline =
`reply.stream_segment` SSE with **server-side `time.sleep` pacing** (28ms/char, 120–900ms);
expression = a **separate LLM pass** (v0.29.0) because the inline `<luna_performance>` block was
silently dropped on ~15% of turns.

## Why now

Per the master ordering philosophy: persona/humanity sits **on top of memory** (core-memory prose
is persona layer 2; humanity caps shape what `remember` stores). And the `message` wire contract
must be fixed **before** Initiative 6 (frontend port) can consume
`tool.progress{tool_name:'message'}` — specifying it here is what makes v0.12 a port instead of a
design project.

## Locked decisions referenced

- **LD #9** (everything-as-tool, detail in [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md)):
  `message` tool envelope, thinking blocks for reasoning, no top-level text, introduction behind
  `LUNA_MESSAGE_TOOL=1` with the v0.3 `reply.token` text path as the A/B baseline.
- **v0.5.2 wire-contract rule**: tool input schemas are **flat root-level objects** — the yunwu
  gateway mangles root `anyOf` into `{"_noargs": ...}`. The `message` schema is born flat;
  per-field constraints + `superRefine`, regression-tested.
- **Prompt-cache invariant** (Initiative 2): persona/humanity/scene blocks join the **stable
  system core** before the `cache_control` breakpoint. Byte-identical across turns unless a
  persona file actually changes (mtime-gated reload = deliberate, observable cache bust).
- **Hot-path rule**: zero synchronous extra LLM calls per turn — which is why the Python
  expression pass is **cut**, not ported (see amendment A3).

## Empirically verified before authoring (2026-06-12, this machine)

1. **yunwu streams `input_json_delta` incrementally** for a `message` tool: 8 partial-json
   chunks for a 26-char reply, text tokens arriving progressively, `stop_reason: tool_use`,
   no top-level text leak, and the model spontaneously set `is_final: false`. The LD #9
   streaming UX ("text streams inside the tool envelope") is real on our gateway. GO.
2. Python persona file is 105 lines of sectioned markdown (`persona.runtime.default.md`) —
   portable as-is.

## Deliberate divergences from Python (amendments, same spirit as Initiative 2's audit)

- **A1 — `sentences` is server-derived, not model input.** LD #9's sketch table listed both
  `text` (≤140) and `sentences` (≤4×55) as model-supplied fields — that is two sources of truth
  that can desync. The model supplies **`text` only**; the server splits it with the ported
  CJK-aware regex and *validates* the caps (≤4 sentences, ≤55-char clause) in `superRefine`.
  The split segments ship to the frontend in `tool.finished` (with pacing metadata), not back
  from the model. LD #9's intent (caps as schema, recoverable `validation_failed`, model
  re-emits) is fully preserved.
- **A2 — no server-side pacing sleeps.** Python's server sleeps 28ms/char between SSE segment
  sends. TS line: the server computes `delay_ms` per segment (same 28ms/char, clamp 120–900
  constants) and ships it as **metadata**; the frontend paces. The hot path never sleeps.
- **A3 — expression pass cut; expression is a schema field.** Python needed a second LLM call
  because a free-text inline block was dropped ~15% of the time. A typed optional field in the
  tool schema is structurally present in every call — the failure mode being defended against
  does not exist here. Cost: one less knob (no per-segment expression evolution within a single
  message; one expression per bubble). Multi-bubble turns recover per-bubble expression
  naturally. If real usage shows expression-omission, revisit — observable via traces.
- **A4 — humanity auditor not ported.** Zod **is** the auditor now, and it *enforces* instead of
  observing. Violations surface as `validation_failed` traces (countable in `/_trace`), which is
  strictly more signal than Python's `reasoning.jsonl` scoring.
- **A5 — persona hot-reload via mtime cache.** Python re-reads the persona file every call (no
  cache, no watch). TS: `statSync` mtime check per turn (~µs), re-read only on change. Stable
  bytes → stable prompt cache; an edit busts the cache exactly once, deliberately.
- **A6 — `progress_update` tool not ported** (Python's second AGENT_MESSAGE tool). Interleaved
  tool-use + multi-bubble `message` calls cover the "talk while working" need with one surface.

## Python failure modes this initiative must not re-create

| Python failure (version) | TS defense |
|---|---|
| Humanity audit observational; 8/8 violations slipped (v0.47.4) | Caps are Zod schema; violation = recoverable error, model re-emits |
| Empty reply: thinking-only turns, no spoken text (v0.47.12, 50% on bad days) | Turn-level guard: message-tool mode requires ≥1 successful `message` call; one corrective retry, then graceful fallback (v0.6.2) |
| Expression silently missing ~15% (pre-v0.29.0) | Typed optional schema field, not free-text block (A3) |
| Continuation directive hoisted into system block → echo confusion (v0.27.1) | No message-shaped directives in system; corrective retry is a **user-role** stage direction |
| `<<<>>>` delimiters trip yunwu content filter (v0.56.1) | Natural-language prompt headers (already repo convention since v0.5.0) |

## Version plan

| Version | Theme | Plan |
|---|---|---|
| v0.6.0 | Persona foundation — files, mtime cache, system-prompt assembly, humanity rules block | [`v0.6.0-persona-foundation.md`](v0.6.0-persona-foundation.md) |
| v0.6.1 | `message` tool + schema humanity caps (flag off) — envelope, registry mount, wire shape | [`v0.6.1-message-tool.md`](v0.6.1-message-tool.md) |
| v0.6.2 | Streaming message text — `input_json_delta` → `tool.progress` deltas; empty-reply guard; dev chat consumes | [`v0.6.2-streaming-message.md`](v0.6.2-streaming-message.md) |
| v0.7.0 | Default flip + segmentation/pacing metadata + A/B close | [`v0.7.0-default-flip.md`](v0.7.0-default-flip.md) |

Per-version validation (established pattern): `bun x tsc --noEmit` both packages + `bun test`
green + DEVELOPMENT.md entry + commit on main. Real-LLM smoke where the version touches the
provider path.

## Out of scope

Reasoning rails / L1-L2 contracts (Initiative 4) · proactive + self-continuation (Initiative 5;
includes Python's 40%-gate lesson) · Live2D frontend consumption (Initiative 6 — this initiative
only **fixes the wire shape**) · TTS pipeline · model-callable `recall` tool (Open Q #9, revisit
after this initiative ships) · multi-persona management UI (single `LUNA_PERSONA_PATH` override
suffices for one user).
