# Initiative 18 — Collapsible companion UI (bubble stack + model glide)

> **Status: 📋 PLANNED.** Priority: after Initiative 17 (proactive parity). Version range:
> **v0.25.0 – v0.25.2** (3 versions). Branch: `feat/weather-perception`. Master index:
> [`../README.md`](../README.md).
> **Hard constraint: `packages/web` ONLY. Zero `packages/server` change, zero `packages/protocol`
> (wire) change** — adversarially verified feasible (see Verified facts).

## The idea

A second way to *be with* Luna. Today the app is a fixed two-column stage — a chat window (left) and
the Live2D model (right). This initiative adds a **collapsed companion mode**: click a control and the
chat window gracefully morphs into a single **bottom input bar**; Luna glides to **screen center**;
and her replies stop rendering in the (now-hidden) window and instead **pop as speech bubbles beside
her** — a **stack** where the newest bubble sits at the bottom and pushes the previous one up, each
bubble living ~10s then gently fading. Expanding reverses it: the window unfolds and Luna glides back
to the **right**. It turns Luna from "a chat app with an avatar" into "a companion on your screen you
occasionally talk to."

## Why this shape / why now

The frontend's own code anticipates it: `bubbles.ts:62` says the minimal bubble view is deliberate and
*"the real Live2D-framed UI is a later pass."* This is that pass. It is also **pure product polish
with no backend risk** — the recon below proves every pixel is drivable from events already on the
wire — so it can land safely on the stable instance without touching the server Alan runs.

## Locked design decisions referenced

- **Frontend scope LD** (`REWRITE_CONTEXT.md:42`): *"TS-port `agent-app.js` controller only — Live2D
  rendering + audio pipeline + GPT-SoVITS proxy stay as-is."* → This initiative lives entirely in the
  controller/UI layer; it does **not** touch the Live2D rendering internals beyond adding a client-side
  glide, nor the audio pipeline beyond *reading* its already-exposed speech-begin/end signals.
- **Wire LD** (`REWRITE_CONTEXT.md:37`): *"Single WebSocket per session — unifies chat / proactive /
  tool-approval / Live2D commands onto one channel."* → Collapse must **not** add a second channel or a
  UI-mode field; it is a pure view-layer concern above `onEvent`.
- **LD #9 — everything-as-tool** (`REWRITE_CONTEXT.md:201-202`, Open Q #3 resolved): reply text +
  Live2D expression/emotion/voice_params arrive **together** inside the `message` tool's
  `MessageDelivery` envelope; there is deliberately **no** top-level text or `set_expression` event. →
  Bubbles + the model's reaction both feed off that one envelope; do **not** add a text/expression
  channel for them.
- **Typed wire contract kills silent-drift** (`REWRITE_CONTEXT.md:23-27`): → feed the bubble stack
  through the **existing** `controller → BubbleView` seam, never a second parallel `onEvent` listener
  (that would re-introduce exactly the drift class the typed contract was built to eliminate).

## Verified architectural facts

Grounded in a 6-agent deep read of `packages/web` + an adversarial zero-backend verifier
(2026-07-01), cross-checked against direct reads of `bubbles.ts`, `layout.ts`, `cuteBubbleView.ts`,
`pixiLive2DSink.ts`.

**Zero-backend feasibility (the load-bearing fact):**
- The adversarial verifier **could not refute** frontend-only feasibility — `backendTouchpoints: []`.
- Luna's reply TEXT already reaches the client on existing frames: `tool.progress{tool_name:'message',
  payload.text_delta}` (stream) + `tool.finished.result.data` = `MessageDelivery.text` (final);
  extracted at `controller.ts:110-127`. Legacy text-mode: `reply.token` → synthetic `'reply'` bubble
  (`controller.ts:78-85`).
- Expression/emotion for the model's reaction ride **inside** `MessageDelivery`
  (`packages/protocol/src/message.ts:5-51`) and are applied at `controller.ts:125` — no separate event.
- User input reuses `chat.send` **verbatim** (`app.ts:136-142`; `ChatSendEvent`
  `packages/protocol/src/events.ts:20-26`) — the only client→server text path, UI-mode-agnostic.
- Proactive replies route through the **same** message-tool path; `proactive.started/finished` carry
  only `cycle_id`/`spoke` (`events.ts:164-173`). → a redirect placed on the message-tool handlers
  captures proactive bubbles **for free**.
- The server holds **no per-connection UI state**: `handleOpen` only tracks the socket + replays
  `history` (`packages/server/src/ws.ts:89-101`); it never reads a collapse/expand mode.
- `wsClient.ts:50-60` validates every frame and is UI-mode-agnostic — collapse is purely above
  `onEvent`.

**The seam to plug into (no controller/protocol change):**
- `BubbleView` is a clean DOM-free interface (`bubbles.ts:40-59`: `open/append/finalize/discard/chip/
  setThinking` + optional `renderHistory`). The controller depends only on it
  (`ControllerDeps.view`, `controller.ts:13-22`); the browser injects `CuteBubbleView` over
  `refs.chatLog` (`app.ts:33,74`). → the beside-model stack is a **new `BubbleView` impl** driven by a
  **router/decorator** over `deps.view` keyed on a live `collapsed` flag.
- `finalize(id, text)` (`cuteBubbleView.ts:103`) is the natural per-message feed for a new bubble;
  `discard(id)` (validation failure / stutter) must **not** spawn one.

**Layout + collapse shell:**
- `.stage` is a flexbox row; `.chat-panel` is `flex:0 0 38%` (contains header, `.chat-log`,
  `.scroll-pill`, and the `.chat-input-row` = input + send as its LAST child); `.model-stage` is
  `flex:1` (`theme.css:56-58,76,138`; `layout.ts:130-168`). The input-row is a ready-made one-line
  input+send unit to reparent into a bottom bar.
- No collapse/dock/minimize state exists anywhere; the idiom is a class toggled on an element +
  localStorage (`.settings-panel.on`, `luna:reduce-motion` — `app.ts:30,153`). A `.collapsed` class on
  `.luna-app`/`.stage` fits.
- `send()` (`app.ts:136-149`) reuses verbatim; only its local echo (`view.userMessage`) target changes
  in collapsed mode. A mobile breakpoint already reflows the stage to a column at ≤720px
  (`theme.css:171-175`) — collapsed CSS must reconcile with it.

**Model glide:**
- The model is centered **within its host** (`.model-stage`) by `fit()` (`pixiLive2DSink.ts:105-115`);
  `driver.setBase/setPositionOffset` (`modelDriver.ts:50-58`) are the instant position knobs. There is
  **no** glide/tween and **no** `glide`/`setPosition` on the `Live2DSink` interface (`sinks.ts:15`).
- A live per-frame beat already exists (`internal.on('beforeModelUpdate', …faceVm.tick)`,
  `pixiLive2DSink.ts:147`) — the glide rides it, no animation library needed (VANILLA constraint).
- `easeInOutSine`/`lerp`/`clamp01` already exist (`faceVm.ts:643-648`) but are **file-private** — must
  be exported / extracted to reuse. `easeInOutSine` matches CSS `ease-in-out`, so a JS glide stays
  visually consistent with CSS morph/fade.
- `fit()` re-runs **only** on `window 'resize'` (`pixiLive2DSink.ts:115`); resizing just `.model-stage`
  won't re-center. The persisted drag offset (`off.dx/off.dy`, `luna:live2d:pos`, clamped ±50% host) is
  re-applied by `fit()` → the glide must use a **dedicated mode-offset channel**, not the user's drag
  offset, or it clobbers/fights the saved drag.

**Animation + TTS interplay:**
- The only rAF loop is the private lip-sync driver (`webAudioSink.ts:116`) — not a shared clock; new
  animations use CSS transitions/`@keyframes` (matching `float`/`dream-drift`/`think-dots`) or their own
  rAF. Existing fade idiom: `transition: opacity 0.3s` (mood-pip), `dream-drift` (translateY+opacity).
- **Playback is serialized** (`SerialQueue`, `webAudioSink.ts:43-50`): a multi-message turn queues
  utterances, so a **blind 10s wall-clock TTL** starting at bubble-emit desyncs — a later bubble fades
  before its utterance is even spoken. `audio.speak()` already exposes an `onStart` hook (speech-begin,
  currently **unused**) and resolves on speech-end (`sinks.ts:36-42`, `webAudioSink.ts:93-114`) — the
  right signals to gate a bubble's life.
- Barge-in (`turn.started` → `audio.stop()`, `controller.ts:64-76`) kills audio but **nothing clears
  bubbles** today; the stack must fast-fade on `turn.started`. Note proactive turns do **not** emit
  `turn.started` — the stack must key lifecycle off `proactive.started/finished` too.
- `.reduce-motion` + `@media (prefers-reduced-motion)` are a hard accessibility contract
  (`theme.css:243-250`, `app.ts:160-164`) — all three animations must add matching snap/no-fade
  overrides.

## The hard part

- **Two geometry owners.** Panels are CSS-flex-declarative; the model is imperative-per-frame (`fit()`).
  The glide must live in **one** system (recommend: pixi ticker rAF tween of a mode-offset) so a CSS
  host-resize and a `fit()` snap don't visually disagree.
- **`position:fixed` isn't animatable.** Morphing a flex panel into a fixed bottom bar can't be a naive
  flex-basis transition — needs a FLIP-style measure/animate or a fixed-overlay bar that cross-fades
  with the panel. This is the finickiest pure-CSS piece.
- **Bubble life vs serialized speech.** Honor Alan's ~10s, but start the clock at **speech-begin**
  (`onStart`), not emit-time, so it aligns with when Luna actually says the line; fast-fade on barge-in.
- **One consumer of truth.** Drive the stack through the `controller→BubbleView` seam (a router keyed on
  a live flag), never a parallel `onEvent` listener — the anti-drift discipline.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.25.0](v0.25.0-speech-bubble-stack.md) | v0.25.0 | Beside-model **speech-bubble stack** (`SpeechStackView` `BubbleView` impl: newest-bottom, push-up, speech-gated ~10s fade) + a `RouterBubbleView` over `deps.view` keyed on a live flag; barge-in fast-fade. Testable standalone via a toggle (no collapse UI yet) | High | nothing | 📋 PLANNED |
| [v0.25.1](v0.25.1-collapse-morph.md) | v0.25.1 | **Collapse/expand mode**: client `.collapsed` state + button + localStorage; window↔bottom-bar CSS morph; input/`send()` reuse + echo handling; flip routes replies to the stack + hides the window; mobile-breakpoint reconciliation; reduce-motion | Medium | v0.25.0 | 📋 PLANNED |
| [v0.25.2](v0.25.2-model-glide.md) | v0.25.2 | **Model glide** center↔right on collapse/expand — pixi-ticker rAF tween on a dedicated mode-offset (exported `easeInOutSine`/`lerp`), coexisting with the persisted drag offset; reduce-motion snap; polish + initiative close | Medium | v0.25.1 | 📋 PLANNED |

## Acceptance criteria for the whole initiative

- [ ] A collapse control morphs the chat window into a single bottom input bar, and expand reverses it —
      both gracefully (and instantly under reduce-motion).
- [ ] In collapsed mode the user still sends via the bottom bar (`chat.send` unchanged); Luna's replies
      render as beside-model bubbles, **not** in the window.
- [ ] Bubbles form a stack: newest at the bottom, previous pushed up, each ~10s then a gradual fade;
      the life aligns with speech (starts at speech-begin), and a new user turn (barge-in) fast-fades
      the stack.
- [ ] Proactive messages while collapsed appear as bubbles (for free, via the message-tool path).
- [ ] Luna glides to screen center on collapse and back to the right on expand, without clobbering the
      user's saved drag offset.
- [ ] Reload while collapsed does not double-render or strand replies (explicit `renderHistory`
      decision).
- [ ] **Zero** diff in `packages/server` and `packages/protocol`; `bun test` + all three `tsc --noEmit`
      green.

## Open questions to settle at build time (do not block start)

- **Glide mechanism** — recommend the **pixi-ticker rAF tween** (one animation system; avoids the
  `fit()`-snap-vs-CSS-transition disagreement + the window-`resize`-only re-fit gap) over CSS
  host-resize + re-`fit()`. Ratify in v0.25.2.
- **Bubble TTL basis** — Alan said "~10s". Recommend a 10s life that **starts at speech-begin
  (`onStart`)** (fixes the serialized-audio desync) with a fast-fade on barge-in; the 10s is a tunable.
- **User echo in collapsed mode** — the spec only asks for Luna's *replies* as bubbles. Recommend
  **suppressing** the window echo in collapsed mode (the user sees their text in the input as they
  type); optionally show the user's own line as a brief distinct bubble. Minor product call.
- **Collapsed `renderHistory`** — recommend **no-op** on reconnect while collapsed (it's optional on
  `BubbleView`), so the server's unconditional `history` frame doesn't replay 50 turns as a bubble
  avalanche.
