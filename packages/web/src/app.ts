import { MessageDelivery } from '@luna/protocol';
import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
import { resolveWsUrl } from './wsUrl';
import { isInteractivePoint, modelRectFromVars } from './ui/petHitTest';
import { lastGeoFix, requestGeolocation, setGeoFix } from './geo';
import {
  consoleLive2DSink,
  noopAudioSink,
  type AudioSink,
  type Live2DSink,
  type Live2DState,
} from './sinks';
import { CuteBubbleView } from './ui/cuteBubbleView';
import { SpeechStackView } from './ui/speechStackView';
import { RouterBubbleView } from './ui/routerBubbleView';
import { buildLayout } from './ui/layout';
import { renderServerSettings } from './ui/settingsView';
import { mountSetupView } from './ui/setupView';
import { mountSetupWizard } from './ui/setupWizard';
import { mountReconfigureButton } from './ui/reconfigure';
import { startTimestampRefresh } from './ui/time';
import { moodOf } from './ui/mood';
import { createPixiLive2DSink } from './live2d/pixiLive2DSink';
import { resolveModelUrl } from './live2d/resolveModelUrl';
import { webglAvailable } from './live2d/cubismRuntime';
import { WebAudioSink } from './audio/webAudioSink';
import { resolveTtsBackend } from './audio/ttsBackend';
import { createBootGate, warmUpTts } from './ui/bootGate';
import { mountPhysicsScene } from './physics/scene';
import { createRiseBubbles } from './ui/riseBubble';
import { mountPackDrop } from './ui/packDrop';
import { resolveUiMode } from './uiMode';
import { mountWorkbench, type ComposeTarget, type DebugBridge } from './ui/workbench';
import type { EmotionDef } from './live2d/faceData';
import { costumeWrites, loadCostume, saveCostume, toggleCostume } from './live2d/costume';
import { isWorkbenchMode, workbenchModelUrl } from './workbenchMode';
import { menuEnabled } from './menuMode';
import { mountPlayerCard } from './ui/playerCard';
import { mountMainMenu } from './ui/mainMenu';
import { runSequence, SLEEP_STEPS, WAKE_STEPS } from './wakeSequence';
import { createReturnGate } from './returnGate';
import { mountDiaryBook } from './ui/diaryBook';
import { mountSkillsPage } from './ui/skillsPage';
import { mountSettingsPage } from './ui/settingsPage';

// Browser entry — builds the cute UI shell + the live Live2D avatar + voice, and
// wires the v0.12.0 consumption controller plus the v0.13.4 polish chrome (dream
// overlay, thinking indicator, mood pip, scroll pill, settings). Degrades to the
// placeholder + silence if WebGL/audio are unavailable; chat works regardless.

const STATUS_TEXT: Record<WsStatus, string> = {
  connecting: '连接中…',
  open: '在线',
  closed: '重新连接中…',
};
// Backend WS endpoint: fixed 127.0.0.1 + `?ws=<port>` override (isolated dev: `:5273/?ws=8888`).
// v0.26.0: no longer derived from location.hostname — a desktop shell's origin must not decide
// where the local server lives.
const WS_URL = resolveWsUrl(location.search);
const DREAM_MIN_MS = 1500;
// Where the workbench remembers the URL it was opened from, so "← Back" returns to the exact
// instance (ws port, pet mode and all) rather than a bare '/'.
const WORKBENCH_RETURN_KEY = 'luna:workbench-return';
// v0.43.11: how long after the last keystroke she stops leaning in. Long enough to survive thinking
// mid-sentence, short enough that an abandoned draft does not hold her turned for a minute.
const TYPING_IDLE_MS = 1500;

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  // v0.28.0: first-run setup screen (desktop shell loads ?setup=1). Mount the form and stop — no
  // WS, no Live2D, no boot gate until the shell has keys and swaps this window for the app.
  // v0.35.0: the shell advertises the multi-step wizard via lunaSetup.wizard (LUNA_SETUP_WIZARD);
  // `&wizard=1` mounts it bridge-less in a plain browser as a read-only PREVIEW (probe/finish
  // disabled) so the flow + copy can be reviewed without the desktop app.
  const search = new URLSearchParams(location.search);
  if (search.has('setup')) {
    const setupBridge = (globalThis as { lunaSetup?: { wizard?: boolean } }).lunaSetup;
    if (setupBridge?.wizard) mountSetupWizard(root);
    else if (search.has('wizard')) mountSetupWizard(root, { preview: true });
    else mountSetupView(root);
    return;
  }
  // v0.43.7: `?workbench=1` — the Live2D bench. Same early-exit shape as `?setup`: no WS, no chat
  // UI, no boot gate. It mounts the REAL sink so what he tunes here is what he gets in the app.
  if (isWorkbenchMode(location.search)) {
    let benchSink: Live2DSink | null = null;
    // v0.43.9: the composer reaches past the sink to the FaceVm, through the same `?workbench` debug
    // bridge the readout uses. Freezing every living layer is a bench state, not an app capability,
    // so it deliberately never becomes a Live2DSink method.
    type BenchVm = ComposeTarget & { previewPose(def: EmotionDef, intensity?: number): void };
    const benchVm = (): BenchVm | null =>
      (globalThis as { __lunaDbg?: { faceVm?: BenchVm } }).__lunaDbg?.faceVm ?? null;
    const bench = mountWorkbench(root, {
      target: () => benchSink,
      compose: benchVm,
      onPreviewPose: (def) => benchVm()?.previewPose(def),
      bridge: () => (globalThis as { __lunaDbg?: DebugBridge }).__lunaDbg,
      onBack: () => {
        const prev = sessionStorage.getItem(WORKBENCH_RETURN_KEY);
        location.href = prev !== null && prev !== '' ? prev : location.pathname;
      },
    });
    const modelUrl = workbenchModelUrl(location.search, resolveModelUrl());
    if (modelUrl && webglAvailable()) {
      benchSink = await createPixiLive2DSink(bench.stage, { modelUrl });
    }
    if (benchSink) bench.stage.querySelector('.model-placeholder')?.remove();
    else
      applyEmptyState(
        bench.stage,
        !modelUrl ? 'none' : webglAvailable() ? 'load-failed' : 'webgl-off',
      );
    window.addEventListener('pagehide', () => bench.dispose());
    return;
  }

  // v0.36.0: Reduce-motion is gone (Initiative 26 constitution — the app is always alive). Clean up
  // the stale persisted key so a previously-on instance doesn't carry a dead flag forever.
  localStorage.removeItem('luna:reduce-motion');
  // v0.43.14: the browser voice is gone, and with it the picker that named which system voice to
  // borrow. Clear the stale key so a previously-set preference does not linger forever unread.
  localStorage.removeItem('luna:voice');

  // v0.39.2: agent-only — the same brain with nothing but the conversation. No avatar is resolved or
  // rendered, no voice is set up, and the model stage takes no width (theme.css `.agent-only`).
  const uiMode = resolveUiMode();
  const agentOnly = uiMode === 'agent';
  const refs = buildLayout(root);
  if (agentOnly) root.classList.add('agent-only');
  const windowView = new CuteBubbleView(refs.chatLog, refs.scrollPill);

  // Voice backend: 'http' (self-hosted GPT-SoVITS via the /api/tts forward) | 'none' (silent, and
  // the default when nothing is configured). Only the http backend loads a model, so only it gets
  // the warm-up boot gate. v0.43.14 retired the third option, the browser's Web Speech voice.
  const ttsBackend = resolveTtsBackend();

  // v0.28.1: pet mode fixes the model as a half-body portrait (no drag/zoom) — the sink needs to
  // know at creation time. Computed once here; the pet-interaction block below reuses it.
  const isPet = new URLSearchParams(location.search).has('pet');

  // v0.44.0 — the cold lobby. Boot is now two halves. The LOBBY half runs immediately: layout, the
  // Live2D sink (model loads as always), and the menu with her asleep. The SESSION half — the WS
  // client, its connect, the controller wiring, geo, voice — is `activateSession()` below, and in
  // menu mode it does not run at all: the backend stays untouched until Talk (v0.44.1). The TTS
  // sidecar itself is the desktop process's child and starts with the app regardless (M1 boundary:
  // only the WS session is deferred). Direct-boot paths (pet / agent-only / luna:menu=0 / ?menu=0)
  // activate immediately and behave exactly as before this version.
  const lobbyOn = menuEnabled({ search: location.search, storage: localStorage, agentOnly });

  // Boot gate: for the http voice backend, block the UI until it has warmed its model. Skippable, and
  // degrades fast (no block) if no sidecar is up. In lobby mode there is nothing to gate — warming
  // belongs to Talk (the wake gate, v0.44.1), not to a menu that makes no sound.
  if (!lobbyOn && ttsBackend === 'http') {
    const gate = createBootGate(root);
    let skipped = false;
    gate.onSkip(() => {
      skipped = true;
      gate.done();
    });
    // v0.37.1 (标准 2): during a MANAGED cold start (Luna spawned the voice child herself — health
    // says starting/restarting) the gate is real: skip hides for the first ~20s. It reveals on time,
    // and instantly when warm-up resolves (failure included) — never strands anyone (v0.35.6 rule).
    const gateStart = performance.now();
    let skipDelayArmed = false;
    void warmUpTts('/api/tts', (s, state) => {
      if (skipped) return;
      gate.setStatus(s);
      if (!skipDelayArmed && (state === 'starting' || state === 'restarting')) {
        skipDelayArmed = true;
        gate.setSkipHidden(true);
        const remaining = Math.max(0, 20_000 - (performance.now() - gateStart));
        globalThis.setTimeout(() => gate.setSkipHidden(false), remaining);
      }
    }).then((res) => {
      gate.setSkipHidden(false);
      if (skipped) return;
      gate.setStatus(
        res === 'unavailable'
          ? '没有检测到语音服务，进入中…'
          : res === 'failed'
            ? '语音加载失败，将以静音模式进入'
            : '语音已就绪 ✓',
      );
      globalThis.setTimeout(() => gate.done(), res === 'ready' ? 300 : 900);
    });
  }

  let live2d: Live2DSink = consoleLive2DSink;
  // No model ships by default (bring-your-own). Resolve an installed one; when there's none, WebGL is
  // off, or a configured model fails to load, keep the empty-state placeholder — labelled by which.
  let modelState: 'ok' | 'none' | 'webgl-off' | 'load-failed' = 'none';
  if (!agentOnly && localStorage.getItem('luna:live2d') !== '0') {
    const modelUrl = resolveModelUrl();
    if (!modelUrl) modelState = 'none';
    else if (!webglAvailable()) modelState = 'webgl-off';
    else {
      const sink = await createPixiLive2DSink(refs.modelStage, { pet: isPet, modelUrl });
      if (sink) {
        live2d = sink;
        modelState = 'ok';
        refs.modelStage.querySelector('.model-placeholder')?.remove();
      } else modelState = 'load-failed';
    }
  }
  refs.modelStage.dataset['modelState'] = modelState;
  // Agent-only has no avatar by choice, so the "no avatar installed / install one" empty state would
  // be nagging about something the user opted out of. The stage is hidden and stays hidden.
  if (!agentOnly && modelState !== 'ok') applyEmptyState(refs.modelStage, modelState);

  // v0.25.0 (Initiative 18): the beside-model speech stack + a router that mirrors Luna's replies to
  // it in collapsed companion mode. v0.25.1: `collapsed` now reads the real collapse state (persisted
  // in localStorage, toggled by the header collapse button + applied as a `.collapsed` class).
  // v0.36.2: one physics scene, shared by falling speech bubbles (here) + rising send bubbles
  // (v0.36.3). Injected into the stack as its detach seam so her finished replies fall into the room.
  const physicsScene = mountPhysicsScene();
  const speechStack = new SpeechStackView(refs.modelStage, {
    detach: (el, angle) => physicsScene.detachFalling(el, angle),
  });
  // v0.36.3: when the log is hidden, your sent message rises off the input bar and out the ceiling.
  const riseBubbles = createRiseBubbles({
    doc: document,
    scene: physicsScene,
    barRect: () => {
      const r = refs.inputRow.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top };
    },
  });
  let isCollapsed = localStorage.getItem('luna:collapsed') === '1';
  const view = new RouterBubbleView(windowView, speechStack);

  // v0.44.0: the audio sink is session-half state — created in activateSession, noop until then.
  // Boot-scoped because the ?dev globals and the speech gate close over the variable.
  let audio: AudioSink = noopAudioSink;

  let dreaming = false;
  let dreamShownAt = 0;
  let dreamHideTimer = 0;
  function setDream(on: boolean): void {
    dreaming = on;
    refs.input.disabled = on;
    refs.input.placeholder = on ? 'Luna 正在做梦…' : '和 Luna 说点什么…';
    if (on) {
      clearTimeout(dreamHideTimer);
      dreamShownAt = Date.now();
      refs.dreamOverlay.classList.add('on');
    } else {
      const wait = Math.max(0, DREAM_MIN_MS - (Date.now() - dreamShownAt));
      dreamHideTimer = window.setTimeout(() => {
        refs.dreamOverlay.classList.remove('on');
        refs.dreamCaption.textContent = '';
      }, wait);
    }
  }

  let lastMoodKey: string | undefined;
  function updateMood(key: Parameters<typeof moodOf>[0]): void {
    const m = moodOf(key);
    const emoji = refs.moodPip.querySelector('.emoji');
    const label = refs.moodPip.querySelector('.mood-label');
    if (emoji) emoji.textContent = m.emoji;
    if (label) label.textContent = m.label;
    refs.moodPip.classList.add('on');
    // v0.36.0: a mood *change* pops the pill (retrigger the animation by clearing then re-adding on
    // the next frame). No pop on a repeat of the same mood.
    if (key !== lastMoodKey) {
      lastMoodKey = key;
      refs.moodPip.classList.remove('mood-pop');
      requestAnimationFrame(() => refs.moodPip.classList.add('mood-pop'));
    }
  }

  const updateReconfigure = mountReconfigureButton(
    refs.statusBadge,
    (globalThis as { lunaSetup?: { openSetup?: () => void } }).lunaSetup?.openSetup,
  );

  // v0.44.0 — the SESSION half. Everything here used to run inline at this exact spot in boot, and
  // for the direct-boot paths it still does (the call sits right below, same position in the
  // sequence). In menu mode nothing here runs until Talk: no WS construction, no controller, no
  // voice sink, no geolocation prompt. `wsClient` is the null-until-activated seam the lobby-safe
  // listeners below guard on.
  let wsClient: LunaWsClient | null = null;
  // v0.44.1: ← Menu closes the socket politely; Talk after that reuses the same client — connect()
  // resets its deliberate-close latch. `wsLive` is the belt against a double activate.
  let wsLive = false;
  const returnGate = createReturnGate();
  let dreamWakePending = false;
  // v0.45.4: the player card mounts once, at first session activation — Talk in a lobby boot,
  // immediately on a direct boot. Pet and agent-only never mount it (no session surface for it);
  // setup/workbench boot different roots entirely; menu mode hides it via CSS (pure sleep mood).
  let playerMounted = false;
  const mountPlayer = (): void => {
    if (playerMounted || isPet || agentOnly) return;
    playerMounted = true;
    mountPlayerCard(document);
  };
  const activateSession = (): void => {
    mountPlayer();
    if (wsClient) {
      if (!wsLive) {
        wsLive = true;
        wsClient.connect();
      }
      return;
    }
    if (ttsBackend === 'http') {
      // v0.43.14: the second rung of v0.37.4's ladder is gone. An utterance the GPT voice cannot
      // speak (hard failure / the 60 s mute window) is now SKIPPED — logged, and the serial queue
      // moves on to the next one. `onUnspoken` still fires, so the failure is never silent to the
      // log; it is only silent to the room.
      audio = new WebAudioSink({
        onMouth: (frame) => live2d.setMouth(frame),
        onUnspoken: (text) => {
          console.warn(
            `[voice] her voice is unavailable — skipping this line: ${text.slice(0, 40)}`,
          );
        },
      });
    }
    // Speech-gate the stack: when Luna actually begins speaking a reply, restart the newest bubble's
    // life so its ~10s aligns with the utterance (playback is serialized, so emit ≠ speak time). When
    // she FINISHES speaking (the speak promise resolves), that bubble detaches and falls (v0.36.2).
    // Only wired for real voice backends — the voiceless noop sink resolves instantly, so it relies
    // on the hang TTL to trigger the fall instead of dropping the bubble the moment it appears.
    const hasVoice = ttsBackend === 'http';
    const speechGatedAudio: AudioSink = {
      speak: (text, voice, onStart) => {
        const p = audio.speak(text, voice, () => {
          speechStack.noteSpeechStart();
          onStart?.();
        });
        if (hasVoice) void p.then(() => speechStack.noteSpeechEnd()).catch(() => {});
        return p;
      },
      stop: () => audio.stop(),
    };

    const controller = createController({
      view,
      live2d,
      audio: speechGatedAudio,
      onSettings: (settings) =>
        renderServerSettings(refs.serverSettings, settings, (key, value) =>
          client.send({ type: 'settings.set', key, value }),
        ),
    });

    const client = new LunaWsClient({
      url: WS_URL,
      onEvent: (e) => {
        // v0.44.1: the polite-disconnect gate watches the turn lifecycle; and a dream entered
        // straight from the menu wakes her when it ENDS (she slept into it, so the wake she skipped
        // on the way in plays on the way out).
        returnGate.onEvent(e);
        if (e.type === 'dream.status' && !e.is_dreaming && dreamWakePending) {
          dreamWakePending = false;
          runSequence(live2d, WAKE_STEPS);
        }
        // The typing indicator is owned by the controller now (v0.21.9): it keeps the
        // dots up for the whole turn and hides them on turn.result / proactive.finished,
        // instead of this open-only show that the first tool/message used to kill.
        if (e.type === 'dream.status') setDream(e.is_dreaming);
        if (e.type === 'dream.step') refs.dreamCaption.textContent = e.detail || e.step;
        // barge-in: a new user turn clears the beside-model stack (the window keeps the full log).
        if (e.type === 'turn.started') speechStack.clearAll();
        if (e.type === 'tool.finished' && e.result.kind === 'ok') {
          const parsed = MessageDelivery.safeParse(e.result.data);
          if (parsed.success && parsed.data.expression) updateMood(parsed.data.expression);
        }
        controller.handle(e);
      },
      onStatus: (s) => {
        refs.statusBadge.textContent = STATUS_TEXT[s];
        refs.statusBadge.dataset['status'] = s;
        // v0.35.6: a broken config (dead backend, reconnect loop) surfaces the way back to the
        // wizard right on the badge — no hunting through Settings while nothing works.
        updateReconfigure(s);
        // Re-send the cached GPS fix on every (re)connect so a server restart still
        // gets the location (the server holds it in-memory).
        if (s === 'open') {
          const fix = lastGeoFix();
          if (fix) client.send({ type: 'client.geo', lat: fix.lat, lon: fix.lon });
        }
      },
    });
    wsClient = client;
    wsLive = true;
    client.connect();
    // Watch the browser for the user's location (one-time permission prompt). Fires on the
    // initial fix AND every real move (v0.37.17 — the old one-shot froze at page-load time);
    // onStatus re-sends the newest fix on later reconnects. Silently no-ops if
    // denied/unavailable → the LUNA_LAT_LON env fallback.
    requestGeolocation((fix) => client.send({ type: 'client.geo', lat: fix.lat, lon: fix.lon }));
  };
  if (!lobbyOn) activateSession();

  function send(): void {
    const text = refs.input.value.trim();
    if (!text || dreaming || !wsClient) return;
    windowView.userMessage(text);
    wsClient.send({ type: 'chat.send', text });
    // Collapsed (log hidden) → the message would otherwise vanish; let it float up and out instead.
    if (isCollapsed) riseBubbles.spawn(text);
    refs.input.value = '';
    live2d.setListening?.(false); // v0.43.11: the message is gone — nothing left to lean toward
  }
  refs.sendBtn.addEventListener('click', send);

  // v0.25.1: collapse ↔ expand. Toggles a `.collapsed` class on the root (theme.css morphs the chat
  // window into a bottom input bar) + persists the choice; a resize re-fits the model into the
  // resized region (v0.25.2 turns that re-fit into a glide). In collapsed mode Luna's replies mirror
  // to the beside-model speech stack via the RouterBubbleView's live `() => isCollapsed`.
  // v0.36.0 关窗户: collapse is a two-phase sash close. Phase 1 keeps the panel in the flow and
  // squeezes the body shut top-to-bottom (CSS `.collapsing` animates grid-rows 1fr→0fr); after
  // --m-soft, phase 2 docks the panel as the fixed bottom bar (`.collapsed`) and the model FLIP-
  // glides into the freed width. Expand runs it in reverse: un-dock (model glides back) with the body
  // still shut, then a frame later remove `.collapsing` so the rows glide 0fr→1fr (sash opens). A
  // generation counter cancels stale phase callbacks when the user toggles rapidly.
  const COLLAPSE_MS = 540; // v0.36.7: ≈ --m-slow (0.5s) + slack — the owner wanted the close slower
  let collapseGen = 0;
  let collapseTimer = 0;
  const applyCollapsed = (animate = true): void => {
    const gen = ++collapseGen;
    clearTimeout(collapseTimer);
    refs.collapseBtn.textContent = isCollapsed ? '⌃' : '⌄';
    refs.collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expand chat' : 'Collapse chat');

    if (!animate) {
      root.classList.remove('collapsing');
      root.classList.toggle('collapsed', isCollapsed);
      globalThis.dispatchEvent(new Event('resize'));
      return;
    }

    if (isCollapsed) {
      root.classList.add('collapsing'); // phase 1: sash-close, still in flow
      collapseTimer = window.setTimeout(() => {
        if (gen !== collapseGen) return;
        const dock = (): void => {
          root.classList.remove('collapsing');
          root.classList.add('collapsed'); // phase 2: fixed bar; model-stage grows
        };
        if (live2d.glideLayout) live2d.glideLayout(dock);
        else dock();
        globalThis.dispatchEvent(new Event('resize'));
      }, COLLAPSE_MS);
    } else {
      const undock = (): void => {
        root.classList.remove('collapsed');
        root.classList.add('collapsing'); // back in flow, body still shut (rows at 0fr)
      };
      if (live2d.glideLayout) live2d.glideLayout(undock);
      else undock();
      // Force a reflow so the shut (0fr) state is committed, THEN release it — the rows transition
      // 0fr→1fr and the sash opens. A rAF here would STALL while the tab is hidden (document.hidden
      // freezes rAF), leaving the chat stuck shut; a synchronous reflow fires regardless of
      // visibility, so expand can never wedge.
      void root.offsetHeight;
      root.classList.remove('collapsing');
      globalThis.dispatchEvent(new Event('resize'));
    }
  };
  refs.collapseBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    try {
      localStorage.setItem('luna:collapsed', isCollapsed ? '1' : '0');
    } catch {
      /* storage unavailable — fine */
    }
    applyCollapsed();
  });
  applyCollapsed(false); // boot in the persisted collapse state — no animation

  // v0.26.2 (Initiative 19): pet mode — the desktop shell's transparent always-on-top window loads
  // with ?pet=1. Strip the room (stripes/lace/motifs go transparent), force the companion layout,
  // and drive region click-through: over her body / the bar / the buttons the window takes the
  // mouse; everywhere else the desktop does (the shell's setIgnoreMouseEvents via the preload
  // bridge — macOS has no per-pixel pass-through).
  const bridge = (
    globalThis as {
      lunaPet?: {
        setIgnore(ignore: boolean): void;
        setPetMode?(on: boolean): void;
        dragStart?(): void;
        dragMove?(dx: number, dy: number): void;
        dragEnd?(): void;
        onGeoFix?(cb: (fix: { lat: number; lon: number }) => void): void;
      };
    }
  ).lunaPet;
  // v0.37.17: the desktop shell re-polls CoreLocation and pushes a moved fix here — the
  // webview has no browser GPS, so this is the desktop's only live-location channel. Cache
  // it (reconnects re-send the newest) and forward it as client.geo.
  bridge?.onGeoFix?.((fix) => {
    setGeoFix(fix);
    // v0.44.0: the CACHE half always runs (fixes arriving during the menu are kept); the send half
    // waits for the session — onStatus 'open' re-sends the newest cached fix on connect anyway.
    wsClient?.send({ type: 'client.geo', lat: fix.lat, lon: fix.lon });
  });
  if (isPet) {
    document.body.classList.add('pet');
    root.classList.add('pet');
    if (!isCollapsed) {
      isCollapsed = true;
      try {
        localStorage.setItem('luna:collapsed', '1');
      } catch {
        /* storage unavailable — fine */
      }
      applyCollapsed(false); // pet boots collapsed — no sash animation on first paint
    }
    // v0.28.6: manual window drag replaces `-webkit-app-region: drag` (which swallowed every
    // mousedown before the DOM saw it — nothing inside the pet was clickable). A pointerdown ON HER
    // BODY (the sink-published bbox) starts a drag; movement streams TOTAL screen-space deltas to
    // the shell, which moves the window. Buttons/input/panel receive ordinary DOM clicks — nothing
    // intercepts them. Click-vs-drag is unambiguous: her body drags, everything else clicks.
    if (bridge?.dragStart) {
      let drag: { sx: number; sy: number } | null = null;
      refs.modelStage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const stage = refs.modelStage;
        const rect = modelRectFromVars(stage.getBoundingClientRect(), {
          left: stage.style.getPropertyValue('--luna-model-left'),
          top: stage.style.getPropertyValue('--luna-model-top'),
          width: stage.style.getPropertyValue('--luna-model-width'),
          height: stage.style.getPropertyValue('--luna-model-height'),
        });
        if (!rect || !isInteractivePoint(e.clientX, e.clientY, [rect])) return;
        drag = { sx: e.screenX, sy: e.screenY };
        bridge.dragStart?.();
      });
      window.addEventListener('pointermove', (e) => {
        if (drag) bridge.dragMove?.(e.screenX - drag.sx, e.screenY - drag.sy);
      });
      const endDrag = (): void => {
        if (!drag) return;
        drag = null;
        bridge.dragEnd?.();
      };
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    }
  }
  refs.input.addEventListener('keydown', (e) => {
    // Don't send mid-IME-composition: the Enter that commits a Chinese pinyin
    // candidate must select the candidate, not dispatch a half-composed message.
    // isComposing covers modern browsers; keyCode 229 is the legacy WebView signal.
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) send();
  });
  // v0.43.11: she notices you typing. A LEVEL held while there is input and dropped on a debounce —
  // a per-keystroke pulse would make her twitch. `send()` clears it directly: the message is gone,
  // there is nothing left to lean toward, and waiting out the debounce would look like a lag.
  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  const setListening = (on: boolean): void => {
    clearTimeout(typingTimer);
    typingTimer = undefined;
    live2d.setListening?.(on);
  };
  refs.input.addEventListener('input', () => {
    if (refs.input.value === '') {
      setListening(false);
      return;
    }
    live2d.setListening?.(true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => live2d.setListening?.(false), TYPING_IDLE_MS);
  });
  refs.input.addEventListener('blur', () => setListening(false));
  refs.input.addEventListener('focus', () => {
    if (refs.input.value !== '') live2d.setListening?.(true);
  });

  refs.dreamBtn.addEventListener('click', () => wsClient?.send({ type: 'dream.enter' }));
  refs.dreamWakeBtn.addEventListener('click', () => wsClient?.send({ type: 'dream.wake' }));

  // v0.36.4: the VTS panel glides in with a click-to-close backdrop; Escape closes it too.
  const setSettingsOpen = (open: boolean): void => {
    refs.settingsPanel.classList.toggle('on', open);
    refs.settingsBackdrop.classList.toggle('on', open);
  };
  refs.settingsBtn.addEventListener('click', () =>
    setSettingsOpen(!refs.settingsPanel.classList.contains('on')),
  );
  refs.settingsBackdrop.addEventListener('click', () => setSettingsOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && refs.settingsPanel.classList.contains('on')) setSettingsOpen(false);
  });
  refs.ttsToggle.addEventListener('change', () =>
    localStorage.setItem('luna:tts', refs.ttsToggle.checked ? '1' : '0'),
  );
  refs.live2dToggle.addEventListener('change', () =>
    localStorage.setItem('luna:live2d', refs.live2dToggle.checked ? '1' : '0'),
  );
  refs.gazeToggle.addEventListener('change', () => {
    // gaze-follow takes effect live (no refresh) — toggles pixi autoFocus
    localStorage.setItem('luna:gaze-follow', refs.gazeToggle.checked ? '1' : '0');
    live2d.setGazeFollow?.(refs.gazeToggle.checked);
  });
  refs.affectToggle.addEventListener('change', () => {
    // v0.42.3: mood memory takes effect live — the sink re-reads this key every tick, so turning it
    // off drops the undertone on the next frame without disturbing anything else.
    localStorage.setItem('luna:affect', refs.affectToggle.checked ? '1' : '0');
  });
  refs.livePeakToggle.addEventListener('change', () => {
    // v0.43.3: same live-read contract as mood memory — switching it off makes a playing clip go back
    // to being a still photograph on the very next frame.
    localStorage.setItem('luna:live-peak', refs.livePeakToggle.checked ? '1' : '0');
  });
  refs.shortClipsToggle.addEventListener('change', () => {
    // v0.43.4: read when a clip STARTS, not per frame — a performance that began long must finish
    // long, or flipping this mid-expression would jump her out of the pose.
    localStorage.setItem('luna:short-clips', refs.shortClipsToggle.checked ? '1' : '0');
  });
  refs.idleActionsToggle.addEventListener('change', () => {
    localStorage.setItem('luna:idle-actions', refs.idleActionsToggle.checked ? '1' : '0');
  });
  refs.listeningToggle.addEventListener('change', () => {
    localStorage.setItem('luna:listening', refs.listeningToggle.checked ? '1' : '0');
  });
  refs.speechPerfToggle.addEventListener('change', () => {
    localStorage.setItem('luna:speech-performance', refs.speechPerfToggle.checked ? '1' : '0');
  });
  refs.idleSelect.addEventListener('change', () => {
    // idle animation switches live (no refresh) — FaceVm swaps the resting profile
    localStorage.setItem('luna:idle-profile', refs.idleSelect.value);
    live2d.setIdleProfile?.(refs.idleSelect.value);
  });
  // v0.43.10: costume. The sink already applied the saved state at boot; these rows keep it in sync,
  // writing the whole set on every change so a removed item is actively released rather than latched.
  let costume = loadCostume();
  const paintCostume = (): void => {
    for (const [id, box] of Object.entries(refs.costumeToggles)) box.checked = costume[id] === true;
  };
  paintCostume();
  for (const [id, box] of Object.entries(refs.costumeToggles)) {
    box.addEventListener('change', () => {
      costume = toggleCostume(costume, id, box.checked);
      saveCostume(costume);
      for (const [pid, value] of costumeWrites(costume)) live2d.setManualParam?.(pid, value);
      paintCostume(); // a hairstyle turning on takes the other one off — show that
    });
  }

  // v0.43.7: leaving for the workbench is a full navigation (it is a different page mode), so the
  // current URL is stashed first — the bench's "← Back" restores the exact instance.
  refs.workbenchBtn.addEventListener('click', () => {
    sessionStorage.setItem(WORKBENCH_RETURN_KEY, location.href);
    const next = new URLSearchParams(location.search);
    next.set('workbench', '1');
    location.href = `${location.pathname}?${next.toString()}`;
  });
  // v0.27.0: pet mode is a SHELL choice (window recreation), not a page style — the row only
  // exists inside the desktop app; a plain browser (no bridge) never shows it.
  const setPetMode = bridge?.setPetMode;
  const petRow = refs.petToggle.closest('label');
  if (setPetMode && !agentOnly) {
    refs.petToggle.checked = isPet;
    refs.petToggle.addEventListener('change', () => setPetMode(refs.petToggle.checked));
  } else if (petRow instanceof HTMLElement) {
    petRow.style.display = 'none';
  }

  // v0.39.2: agent-only drops the panes that only exist to serve an avatar (the Live2D/gaze/idle tab
  // and its rail icon; the pet window is a Luna-shaped window with no Luna in it). The mood pip and
  // the Dream button live INSIDE the model stage, so they move to the chat header or they'd vanish
  // with it — dreaming is a core capability, not an avatar feature.
  if (agentOnly) {
    refs.avatarTab.style.display = 'none';
    refs.avatarRailBtn.style.display = 'none';
    refs.chatHeader.append(refs.moodPip, refs.dreamBtn);
  }

  // v0.35.0: re-enter the setup wizard from Settings (desktop shell only — the shell owns the
  // setup window). Rendered next to the pet row so shell-owned rows stay grouped.
  const openSetup = (globalThis as { lunaSetup?: { openSetup?: () => void } }).lunaSetup?.openSetup;
  if (openSetup && petRow?.parentElement) {
    const row = document.createElement('label');
    row.className = 'setting-row rerun-setup-row';
    const name = document.createElement('span');
    name.textContent = '配置向导';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'setting-reset';
    btn.textContent = '重新运行…';
    btn.addEventListener('click', () => openSetup());
    row.append(name, btn);
    petRow.after(row);
  }

  if (location.search.includes('dev')) {
    const g = globalThis as unknown as { lunaLive2D?: Live2DSink; lunaAudio?: AudioSink };
    g.lunaLive2D = live2d;
    g.lunaAudio = audio;
    buildDevPanel(live2d);
  }

  // v0.37.3: drop a voice pack anywhere on the RUNNING app to swap her voice — no re-entering setup.
  // Desktop only (needs the lunaSetup scan/install bridges); a plain browser has no drop surface.
  const voiceBridge = (
    globalThis as {
      lunaSetup?: {
        scanVoicePack?: (f: File) => Promise<Record<string, unknown>>;
        installVoicePack?: (a: Record<string, string>) => Promise<Record<string, unknown>>;
      };
    }
  ).lunaSetup;
  if (!agentOnly && voiceBridge?.scanVoicePack && voiceBridge.installVoicePack) {
    const scan = voiceBridge.scanVoicePack.bind(voiceBridge);
    const install = voiceBridge.installVoicePack.bind(voiceBridge);
    mountPackDrop(document, { scanVoicePack: scan, installVoicePack: install });
  }

  // v0.44.0/v0.44.1 — the front door. Mounted last so every lobby-safe wire above exists behind it.
  // Talk swaps menu for chat while she wakes IN PLACE (D4); ← Menu disconnects politely and she
  // sleeps again; Dream connects and enters the dream without waking her first.
  if (lobbyOn) {
    const quitBridge = (globalThis as { lunaPet?: { quit?: () => void } }).lunaPet?.quit;
    let menuHandle: { dispose: () => void; leaveForTalk: () => void } | null = null;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;

    // v0.44.8 (owner correction): in menu mode the canvas spans the whole stage so a zoomed model
    // is never sliced by the session slot's left edge — only the window crops her. The frame rect
    // keeps her BASE exactly where the slot puts her, so Talk wakes her in place (D4) and the
    // re-clip lands under the chat panel's fade-in.
    const GAP_PX = 20; // mirrors theme.css `.stage { gap: 20px }`
    const PAD_PX = 22; // mirrors theme.css `.stage { padding: 0 22px }`
    const panelEl = refs.chatHeader.closest<HTMLElement>('.chat-panel');
    const slotFrame = (): { left: number; width: number } => {
      const hostR = refs.modelStage.getBoundingClientRect();
      const hostW = refs.modelStage.clientWidth || 1;
      const plain = { left: 0, width: hostW };
      const stageR = refs.modelStage.parentElement?.getBoundingClientRect();
      if (!stageR) return plain;
      // The slot the SESSION layout would give the canvas: from the chat panel's right edge plus
      // the flex gap, to the stage's right padding edge — both in canvas coordinates.
      const left = (panelEl?.getBoundingClientRect().right ?? 0) + GAP_PX - hostR.left;
      const width = stageR.right - PAD_PX - hostR.left - left;
      // Side-by-side session layout only: in collapsed/column layouts the canvas is already full
      // width — there is no slot edge to mimic, so the frame is the plain canvas.
      return left > 0 && left < hostW * 0.75 && width > 50 ? { left, width } : plain;
    };
    const wideStage = (on: boolean): void => {
      const wide = on && modelState === 'ok'; // empty-state card keeps its normal slot
      root.classList.toggle('menu-wide', wide);
      live2d.setFrame?.(wide ? slotFrame : null);
      globalThis.dispatchEvent(new Event('resize')); // pixi resizeTo re-measures the host
    };

    // The menu→chat swap both Talk and Dream ride: the text column fades left, the chat fades in
    // over it (CSS `.waking`), and once the reveal lands the menu DOM is gone entirely.
    const swapToChat = (): void => {
      menuHandle?.leaveForTalk();
      root.classList.add('waking');
      swapTimer = setTimeout(() => {
        menuHandle?.dispose();
        menuHandle = null;
        root.classList.remove('waking');
        // Re-clip to the session slot only now, with the chat panel opaque over that edge — the
        // seam change is invisible and she does not move (base was already the slot's centre).
        wideStage(false);
      }, 1000);
    };

    const mountMenu = (): void => {
      wideStage(true);
      menuHandle = mountMainMenu(root, {
        stage: refs.modelStage,
        sink: live2d,
        hasAvatar: modelState === 'ok',
        onTalk: () => {
          swapToChat();
          // She starts waking on the click frame; the WS connects and the voice warms UNDER the
          // 1.8s animation — the wake gate is the wake itself, not an overlay that would hide it.
          runSequence(live2d, WAKE_STEPS);
          activateSession();
          if (ttsBackend === 'http') void warmUpTts('/api/tts', () => {});
        },
        onDream: () => {
          // Straight from sleep into the dream — a sleeper does not wake to fall asleep. The wake
          // she skipped here plays when the dream ENDS (the dream.status tap above).
          swapToChat();
          dreamWakePending = true;
          activateSession();
          wsClient?.send({ type: 'dream.enter' });
        },
        // v0.44.3/4/5: the three real pages. The diary book rides the HTTP data surface (reading
        // her diary never wakes her); the settings page ADOPTS the old panel's live rows, so the
        // controls keep their exact wiring wherever they are displayed.
        pageBody: (id) =>
          id === 'diary'
            ? mountDiaryBook(document)
            : id === 'skills'
              ? mountSkillsPage(document)
              : mountSettingsPage(document, refs),
        ...(quitBridge ? { quit: () => quitBridge() } : {}),
      });
    };
    mountMenu();

    // ← Menu lives in the chat header, and the disconnect is POLITE: mid-turn it waits for the
    // turn's end (returnGate), then closes the socket and she goes back down.
    const returnBtn = document.createElement('button');
    returnBtn.type = 'button';
    returnBtn.className = 'menu-return-btn';
    returnBtn.textContent = '← 菜单';
    returnBtn.addEventListener('click', () => {
      returnGate.request(() => {
        clearTimeout(swapTimer);
        wsClient?.close();
        wsLive = false;
        menuHandle?.dispose();
        mountMenu(); // re-asserts menu-mode + sleeping; the SLEEP sequence is that single beat
        runSequence(live2d, SLEEP_STEPS);
      });
    });
    refs.chatHeader.appendChild(returnBtn);

    // v0.44.5: in lobby boots the old slide-in panel is unreachable BY DESIGN — Settings lives
    // behind the menu, one hierarchy, no back doors. The ⚙ button therefore goes; the panel DOM
    // stays as the donor the settings page adopts its rows from. Esc in chat = the quick way home.
    refs.settingsBtn.style.display = 'none';
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'Escape' &&
        menuHandle === null &&
        !refs.settingsPanel.classList.contains('on')
      ) {
        returnBtn.click();
      }
    });
  }

  startTimestampRefresh(refs.chatLog);
}

// The empty-state placeholder copy, keyed by why no avatar rendered. `none` is the default
// bring-your-own state; the other two explain a real fault. Points at where to drop a model + SETUP.md.
function applyEmptyState(stage: HTMLElement, state: 'none' | 'webgl-off' | 'load-failed'): void {
  const ph = stage.querySelector('.model-placeholder');
  if (!ph) return;
  const copy: Record<typeof state, [string, string]> = {
    none: ['还没有安装模型', '把 Live2D 模型放进 public/models/，详见 docs/SETUP.md'],
    'webgl-off': ['WebGL 不可用', '当前浏览器无法渲染模型'],
    'load-failed': ['模型加载失败', '请检查 public/models/ 里的模型文件'],
  };
  const [labelText, subText] = copy[state];
  const label = ph.querySelector('.label');
  const sub = ph.querySelector('.sub');
  if (label) label.textContent = labelText;
  if (sub) sub.textContent = subText;
  // Desktop only: a native folder picker to install a model (a plain browser has no bridge → drop a
  // folder in public/models/ + set luna:model-url per docs/SETUP.md instead).
  const chooseModel = (
    globalThis as { lunaPet?: { chooseModel?: () => Promise<{ ok: boolean; error?: string }> } }
  ).lunaPet?.chooseModel;
  if (chooseModel && state === 'none' && !ph.querySelector('.choose-model-btn')) {
    const btn = ph.ownerDocument.createElement('button');
    btn.className = 'choose-model-btn';
    btn.type = 'button';
    btn.textContent = '选择模型文件夹…';
    btn.addEventListener('click', () => void chooseModel());
    ph.appendChild(btn);
  }
}

// Dev-only (?dev) floating panel: trigger every preset emotion + the coarse
// states, so performances are visibly testable without the backend. MVP for the
// 表演编排 / 挂机 / 睡眠 inspection ask.
function buildDevPanel(live2d: Live2DSink): void {
  const btn =
    'background:#20242f;color:#e7e9ef;border:1px solid #2c3140;border-radius:6px;padding:3px 8px;cursor:pointer;font:inherit;';
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:10px;bottom:10px;z-index:9999;background:rgba(20,22,28,.92);color:#e7e9ef;' +
    'border:1px solid #2c3140;border-radius:10px;padding:10px;font:12px ui-monospace,monospace;' +
    'display:flex;flex-direction:column;gap:6px;max-width:250px;';
  const title = document.createElement('div');
  title.textContent = '🎭 开发面板 · 触发表演';
  title.style.cssText = 'color:#ffa7d1;font-weight:600;';
  panel.appendChild(title);

  const emotions = live2d.listEmotions?.() ?? [];
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;';
  const sel = document.createElement('select');
  sel.style.cssText =
    'flex:1;background:#20242f;color:inherit;border:1px solid #2c3140;border-radius:6px;padding:3px;';
  for (const id of emotions) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id;
    sel.appendChild(o);
  }
  const play = document.createElement('button');
  play.textContent = '▶ 播放';
  play.style.cssText = btn;
  play.addEventListener('click', () => live2d.triggerEmotion?.(sel.value));
  row.append(sel, play);
  panel.appendChild(row);

  const srow = document.createElement('div');
  srow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
  const states: Array<[string, Live2DState]> = [
    ['待机', 'neutral'],
    ['思考', 'thinking'],
    ['说话', 'speaking'],
    ['睡眠', 'sleeping'],
  ];
  for (const [label, st] of states) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = btn;
    b.addEventListener('click', () => live2d.setState(st));
    srow.appendChild(b);
  }
  panel.appendChild(srow);

  if (!emotions.length) {
    const note = document.createElement('div');
    note.textContent = '（模型尚未加载 — 当前为占位模式）';
    note.style.cssText = 'color:#8b93a7;';
    panel.appendChild(note);
  }

  document.body.appendChild(panel);
}

void boot();
