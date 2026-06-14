# Initiative 6 — Frontend Port: the Body (v0.12.0 – v0.13.3)

> **Status: 🔨 IN PROGRESS.** v0.12.0 ✅ shipped (consumption controller). v0.13.0–v0.13.3
> ⏳ planned (authored 2026-06-13): the redesigned cute UI + Live2D + TTS — "the body." Master:
> [`../README.md`](../README.md).

## The idea

The backend brain and the frontend **consumption controller** (v0.12.0, `packages/web`) are done;
what's missing is the visible, audible **body**. This initiative gives Luna (1) a freshly-designed,
cute, Japanese-leaning UI (Alan's design, NOT a port of the Python page), (2) a real Live2D avatar
driven by the message envelope's `expression`/`emotion`, and (3) real voice via the GPT-SoVITS
sidecar with lip-sync. All of it hangs off the `Live2DSink`/`AudioSink` interfaces v0.12.0 already
defined, so the consumption logic doesn't change shape — the stubs get real implementations.

## Why now / ordering

Last piece of the rewrite's user-facing surface. Ordered after everything else because the wire
contract had to freeze first (it has: `tool.progress{tool_name:'message'}` + `MessageDelivery` with
`expression`/`emotion`/`voice_params`, shipped in Initiative 3). Within this initiative: the **UI
shell first** (usable + pretty with stub sinks), then **Live2D** (the riskiest — WebGL/Cubism),
then **TTS+lip-sync** (needs the model for lip-sync), then **polish + dream overlay + close**.

## Locked design decisions referenced (REWRITE_CONTEXT.md)

- **LD #9 (everything-as-tool)** — the `message` envelope already carries the Live2D/TTS metadata
  (`expression: ExpressionKey` (15 affects), `emotion: 0–1`, `voice_params`); the frontend is a pure
  consumer, the backend computes nothing in a separate `expression.update` (REWRITE_CONTEXT:201).
- **LD #2 (single WebSocket)** — one channel carries chat / tool / dream / proactive; no SSE/poll.
- **Frontend scope (clarified here).** REWRITE_CONTEXT:42/193 said "Live2D rendering + audio pipeline
  + GPT-SoVITS proxy stay as-is (cost/benefit)." Clarification for this initiative: **as-is = reuse
  the heavy, proven, art/infra layers** — the `pixi-live2d-display` (Cubism 4) runtime + the
  `live2dcubismcore` core + the **yumi** model assets + the Python GPT-SoVITS sidecar. **NOT as-is =
  the UI (Alan redesigns) and the TS driver glue** (FaceVM/lip-sync/audio-player), which is ported
  fresh to fit the sink interfaces — "参考 Python 但不照搬." This is an evolution of the locked
  decision, not a contradiction: the cost/benefit logic (don't rebuild the avatar art, the Cubism
  SDK, or the SoVITS model) holds; only the glue + the page are new.

## Verified architectural facts (TS source, 2026-06-13)

1. **Sink interfaces exist and are the seam** — `Live2DSink { setExpression(key, emotion?), clear() }`
   and `AudioSink { speak(text, voice?, onStart?), stop() }`
   ([`packages/web/src/sinks.ts`](../../../packages/web/src/sinks.ts)), with console/no-op stubs.
   v0.13.1/v0.13.2 replace the stubs; **the interfaces will GROW** (motion/state/lip-sync-amount) —
   a deliberate, additive change, controller updated in lockstep.
2. **The controller drives the sinks** — `createController({view, live2d, audio})` calls
   `live2d.setExpression` + `audio.speak` on a message-tool `tool.finished`
   ([`packages/web/src/controller.ts`](../../../packages/web/src/controller.ts)). New Live2D states
   (thinking on `turn.started`, sleeping on `dream.status`) are new controller→sink calls.
3. **`BubbleView` is the chat seam** — `open/append/finalize/discard/chip`
   ([`packages/web/src/bubbles.ts`](../../../packages/web/src/bubbles.ts)); the new UI is a richer
   `BubbleView` impl (left/right bubbles, timestamps, tool cards) — the controller is unchanged.
4. **`MessageDelivery`** ([`packages/protocol/src/message.ts`](../../../packages/protocol/src/message.ts))
   carries `segments[{index,text,delay_ms}]` (paced reveal), `expression`, `emotion`, `voice_params`.
5. **`bun run dev:web`** serves `packages/web/index.html` (Bun fullstack); browser bundle builds.

## Python parity notes (reference, not copy — `/Users/alanyu2077/Desktop/Agent_Luna/Live2D_Work`)

The proven runtime to learn from (then rewrite into TS behind the sinks):
- **Renderer:** `pixi-live2d-display` (cubism4) + `dist/live2dcubismcore.min.js`; model
  `models/yumi/yumi.model3.json` (+ `.moc3`, textures, expressions, motions). **Reuse these assets +
  the lib.**
- **`js/runtime/model-driver.js`** — Cubism abstraction (`setParam`, load, perform). → TS Live2DSink impl.
- **`js/runtime/face-vm.js`** — the 60fps state machine: layer stack (idle profile → state → emotion
  → motion → param overrides), `tick(now, {idleProfileId, stateId, isSpeaking, speakingAmount,
  playback, speechArticulation})`. → TS FaceVM-equivalent. Port the *layer model*, not the code.
- **`js/runtime/lip-sync.js` + `speech-face-track.js`** — RMS → mouth articulation. → TS lip-sync.
- **`js/runtime/speech-controller.js` + `audio-stream-player.js` + `tts/`** — `speakSegments(segments,
  {onAudioStart})`, GPT-SoVITS provider, segment-buffered playback. → TS AudioSink impl.
- **GPT-SoVITS proxy** lives in the Python `Agent/app/server.py` — **reuse the sidecar**; the TS
  AudioSink calls its TTS endpoint. (Decide at build time: call it directly, or proxy through the TS
  server — the latter keeps one origin.)
- **Expression mapping:** the 15 `ExpressionKey` affects must map to yumi's actual expressions/
  motions (a lookup table built at v0.13.1, from the model's `.model3.json`).
- **Lessons to keep (Python era):** `reply.token.reset` ghost-token clearing (n/a — our streaming is
  via message tool); min-overlay-duration to avoid dream-flash (v0.55.3); audio unlock requires a
  user gesture (browser autoplay policy) — the first click wakes audio.

## The hard part (recurring principles)

1. **The UI is a `BubbleView` + sink consumers, never new event logic.** All server interpretation
   stays in the controller (v0.12.0). The UI only renders + drives sinks. No business logic in DOM.
2. **Live2D is the WebGL risk** — Cubism SDK loading, the model pipeline, the render loop. Spike it
   first (v0.13.1), behind a flag, before wiring expressions.
3. **Audio needs a user gesture** — browsers block autoplay; the first user interaction unlocks the
   audio context. Queue any pre-unlock speech.
4. **Everything degrades gracefully** — no Live2D (WebGL unavailable) → the model area shows a static
   image/placeholder; no audio → silent, text still flows. The chat must work even if the body fails.
5. **Cute, but accessible** — honor `prefers-reduced-motion` (the lace shimmer, the dream overlay);
   keep contrast readable over the striped background.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| (shipped) | v0.12.0 | Consumption controller — event→bubble + sink interfaces | — | — | ✅ |
| [v0.13.0](v0.13.0-cute-ui-shell.md) | v0.13.0 | Cute UI shell — the redesigned page (layout, style, bubbles, timestamps, tool cards, dream button); stub sinks | Low | v0.12.0 | ✅ shipped 2026-06-14 (chat-left/model-right) |
| [v0.13.1](v0.13.1-live2d.md) | v0.13.1 | Live2D **foundation** — real `Live2DSink` (pixi-live2d + Cubism + yumi), first-cut FaceVM, draggable + persisted, degrade-safe | High | v0.13.0 | ✅ shipped 2026-06-14 |
| [v0.13.2](v0.13.2-live2d-fidelity.md) | v0.13.2 | Live2D **high-fidelity FaceVM** — layered engine + emotion/action libraries + rich affect→emotion map | Medium | v0.13.1 | ⏳ |
| [v0.13.3](v0.13.3-tts-lipsync.md) | v0.13.3 | Voice — real `AudioSink` (GPT-SoVITS), playback, on-audio-start → Live2D, lip-sync | Medium | v0.13.1 | ⏳ |
| [v0.13.4](v0.13.4-polish-close.md) | v0.13.4 | Dream overlay + UX extras + responsive/a11y + integration + initiative close | Low | v0.13.0–v0.13.3 | ⏳ |

## Acceptance criteria for the whole initiative

- [x] The redesigned cute UI renders: striped light-blue/white bg + lace borders, two-pane
      (**chat left / model right**), user-left/Luna-right bubbles with per-bubble timestamps,
      cute tool-action cards, input bar, 🌙 入梦 button. (v0.13.0)
- [x] Live2D yumi renders + animates (built-in blink/breath); her `expression`/`emotion` drive her
      face (first-cut, v0.13.1); she is draggable + position persists. (rich emotions → v0.13.2)
- [ ] She speaks (GPT-SoVITS) with lip-sync; audio unlocks on first gesture; on-audio-start Live2D
      commands fire.
- [ ] Dream overlay on dreaming + ☀️ wake; proactive messages visually distinct; thinking indicator.
- [ ] Graceful degradation (no WebGL / no audio) keeps chat working; `prefers-reduced-motion` honored.
- [ ] All three packages typecheck; `packages/web` tests green; live browser end-to-end verified
      against `bun run dev:server` + `bun run dev:web`.

## Open questions blocking start

None block v0.13.0 (pure UI on the shipped controller). To settle during:
- **v0.13.1:** Cubism SDK integration path (bundle `live2dcubismcore` + `pixi-live2d-display` into
  `packages/web`, or load via script tag); the yumi expression/motion → 15-`ExpressionKey` map.
- **v0.13.2:** call the GPT-SoVITS sidecar directly from the browser, or proxy it through the TS
  server (one-origin, hides the sidecar URL — recommended). Where the sidecar runs in the TS setup.
- **Palette:** sample yumi's main colors for the accent palette (build-time design step).
