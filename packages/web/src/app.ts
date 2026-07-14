import { MessageDelivery } from '@luna/protocol';
import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
import { resolveWsUrl } from './wsUrl';
import { isInteractivePoint, modelRectFromVars } from './ui/petHitTest';
import { lastGeoFix, requestGeolocation } from './geo';
import { consoleLive2DSink, noopAudioSink, type AudioSink, type Live2DSink, type Live2DState } from './sinks';
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
import { WebSpeechSink } from './audio/webSpeechSink';
import { resolveTtsBackend } from './audio/ttsBackend';
import { createBootGate, warmUpTts } from './ui/bootGate';
import { mountPhysicsScene } from './physics/scene';
import { createRiseBubbles } from './ui/riseBubble';
import { mountPackDrop } from './ui/packDrop';

// Browser entry — builds the cute UI shell + the live Live2D avatar + voice, and
// wires the v0.12.0 consumption controller plus the v0.13.4 polish chrome (dream
// overlay, thinking indicator, mood pip, scroll pill, settings). Degrades to the
// placeholder + silence if WebGL/audio are unavailable; chat works regardless.

const STATUS_TEXT: Record<WsStatus, string> = { connecting: 'Connecting…', open: 'Online', closed: 'Reconnecting…' };
// Backend WS endpoint: fixed 127.0.0.1 + `?ws=<port>` override (isolated dev: `:5273/?ws=8888`).
// v0.26.0: no longer derived from location.hostname — a desktop shell's origin must not decide
// where the local server lives.
const WS_URL = resolveWsUrl(location.search);
const DREAM_MIN_MS = 1500;

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
  // v0.36.0: Reduce-motion is gone (Initiative 26 constitution — the app is always alive). Clean up
  // the stale persisted key so a previously-on instance doesn't carry a dead flag forever.
  localStorage.removeItem('luna:reduce-motion');

  const refs = buildLayout(root);
  const windowView = new CuteBubbleView(refs.chatLog, refs.scrollPill);

  // Voice backend: 'browser' (zero-setup Web Speech — the default a fresh install speaks with) |
  // 'http' (self-hosted GPT-SoVITS via the /api/tts forward) | 'none'. Only the http backend loads a
  // model, so only it gets the warm-up boot gate; the browser voice needs no warm-up.
  const ttsBackend = resolveTtsBackend();

  // Boot gate: for the http voice backend, block the UI until it has warmed its model. Skippable, and
  // degrades fast (no block) if no sidecar is up. The rest of boot (Live2D, WS) proceeds behind it.
  if (ttsBackend === 'http') {
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
          ? 'No voice service detected, entering…'
          : res === 'failed'
            ? 'Voice failed to load, entering muted'
            : 'Voice ready ✓',
      );
      globalThis.setTimeout(() => gate.done(), res === 'ready' ? 300 : 900);
    });
  }

  // v0.28.1: pet mode fixes the model as a half-body portrait (no drag/zoom) — the sink needs to
  // know at creation time. Computed once here; the pet-interaction block below reuses it.
  const isPet = new URLSearchParams(location.search).has('pet');

  let live2d: Live2DSink = consoleLive2DSink;
  // No model ships by default (bring-your-own). Resolve an installed one; when there's none, WebGL is
  // off, or a configured model fails to load, keep the empty-state placeholder — labelled by which.
  let modelState: 'ok' | 'none' | 'webgl-off' | 'load-failed' = 'none';
  if (localStorage.getItem('luna:live2d') !== '0') {
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
  if (modelState !== 'ok') applyEmptyState(refs.modelStage, modelState);

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

  let audio: AudioSink = noopAudioSink;
  if (ttsBackend === 'http') {
    // v0.37.4: the two-rung ladder — an utterance the GPT voice can't speak (hard failure / the
    // 60s mute window) falls to the browser voice instead of being silently dropped; the next
    // utterance retries http, so recovery re-promotes by itself. Never a silent downgrade: each
    // fallback is logged with the reason surface (the console is the desktop shell's log).
    let fallbackVoice: WebSpeechSink | null = null;
    audio = new WebAudioSink({
      onMouth: (frame) => live2d.setMouth(frame),
      onUnspoken: (text, voice) => {
        console.warn('[voice] GPT voice unavailable — speaking via the browser voice this once');
        fallbackVoice ??= new WebSpeechSink({ onMouth: (frame) => live2d.setMouth(frame) });
        void fallbackVoice.speak(text, voice);
      },
    });
  } else if (ttsBackend === 'browser') {
    audio = new WebSpeechSink({ onMouth: (frame) => live2d.setMouth(frame) });
  }
  // Speech-gate the stack: when Luna actually begins speaking a reply, restart the newest bubble's
  // life so its ~10s aligns with the utterance (playback is serialized, so emit ≠ speak time). When
  // she FINISHES speaking (the speak promise resolves), that bubble detaches and falls (v0.36.2).
  // Only wired for real voice backends — the voiceless noop sink resolves instantly, so it relies on
  // the hang TTL to trigger the fall instead of dropping the bubble the moment it appears.
  const hasVoice = ttsBackend === 'http' || ttsBackend === 'browser';
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
    // `client` is declared below; settings.state only arrives over the socket, so this
    // closure never runs before the client exists.
    onSettings: (settings) =>
      renderServerSettings(refs.serverSettings, settings, (key, value) =>
        client.send({ type: 'settings.set', key, value }),
      ),
  });

  let dreaming = false;
  let dreamShownAt = 0;
  let dreamHideTimer = 0;
  function setDream(on: boolean): void {
    dreaming = on;
    refs.input.disabled = on;
    refs.input.placeholder = on ? 'Luna is dreaming…' : 'Say something to Luna…';
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

  const client = new LunaWsClient({
    url: WS_URL,
    onEvent: (e) => {
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
  client.connect();
  // Ask the browser for the user's location (one-time permission prompt). On a fix,
  // send it (v0.21.3 GPS auto-location); onStatus re-sends on later reconnects.
  // Silently no-ops if denied/unavailable → the LUNA_LAT_LON env fallback.
  requestGeolocation((fix) => client.send({ type: 'client.geo', lat: fix.lat, lon: fix.lon }));

  function send(): void {
    const text = refs.input.value.trim();
    if (!text || dreaming) return;
    windowView.userMessage(text);
    client.send({ type: 'chat.send', text });
    // Collapsed (log hidden) → the message would otherwise vanish; let it float up and out instead.
    if (isCollapsed) riseBubbles.spawn(text);
    refs.input.value = '';
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
      };
    }
  ).lunaPet;
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
  refs.dreamBtn.addEventListener('click', () => client.send({ type: 'dream.enter' }));
  refs.dreamWakeBtn.addEventListener('click', () => client.send({ type: 'dream.wake' }));

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
  refs.idleSelect.addEventListener('change', () => {
    // idle animation switches live (no refresh) — FaceVm swaps the resting profile
    localStorage.setItem('luna:idle-profile', refs.idleSelect.value);
    live2d.setIdleProfile?.(refs.idleSelect.value);
  });
  // v0.27.0: pet mode is a SHELL choice (window recreation), not a page style — the row only
  // exists inside the desktop app; a plain browser (no bridge) never shows it.
  const setPetMode = bridge?.setPetMode;
  const petRow = refs.petToggle.closest('label');
  if (setPetMode) {
    refs.petToggle.checked = isPet;
    refs.petToggle.addEventListener('change', () => setPetMode(refs.petToggle.checked));
  } else if (petRow instanceof HTMLElement) {
    petRow.style.display = 'none';
  }

  // v0.35.0: re-enter the setup wizard from Settings (desktop shell only — the shell owns the
  // setup window). Rendered next to the pet row so shell-owned rows stay grouped.
  const openSetup = (globalThis as { lunaSetup?: { openSetup?: () => void } }).lunaSetup?.openSetup;
  if (openSetup && petRow?.parentElement) {
    const row = document.createElement('label');
    row.className = 'setting-row rerun-setup-row';
    const name = document.createElement('span');
    name.textContent = 'Setup wizard';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'setting-reset';
    btn.textContent = 'Re-run…';
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
  if (voiceBridge?.scanVoicePack && voiceBridge.installVoicePack) {
    const scan = voiceBridge.scanVoicePack.bind(voiceBridge);
    const install = voiceBridge.installVoicePack.bind(voiceBridge);
    mountPackDrop(document, { scanVoicePack: scan, installVoicePack: install });
  }

  startTimestampRefresh(refs.chatLog);
}

// The empty-state placeholder copy, keyed by why no avatar rendered. `none` is the default
// bring-your-own state; the other two explain a real fault. Points at where to drop a model + SETUP.md.
function applyEmptyState(stage: HTMLElement, state: 'none' | 'webgl-off' | 'load-failed'): void {
  const ph = stage.querySelector('.model-placeholder');
  if (!ph) return;
  const copy: Record<typeof state, [string, string]> = {
    none: ['No avatar installed', 'Drop a Live2D model in public/models/ — see docs/SETUP.md'],
    'webgl-off': ['WebGL unavailable', "This browser can't render the avatar"],
    'load-failed': ['Model failed to load', 'Check the model files in public/models/'],
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
    btn.textContent = 'Choose model folder…';
    btn.addEventListener('click', () => void chooseModel());
    ph.appendChild(btn);
  }
}

// Dev-only (?dev) floating panel: trigger every preset emotion + the coarse
// states, so performances are visibly testable without the backend. MVP for the
// 表演编排 / 挂机 / 睡眠 inspection ask.
function buildDevPanel(live2d: Live2DSink): void {
  const btn = 'background:#20242f;color:#e7e9ef;border:1px solid #2c3140;border-radius:6px;padding:3px 8px;cursor:pointer;font:inherit;';
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:10px;bottom:10px;z-index:9999;background:rgba(20,22,28,.92);color:#e7e9ef;' +
    'border:1px solid #2c3140;border-radius:10px;padding:10px;font:12px ui-monospace,monospace;' +
    'display:flex;flex-direction:column;gap:6px;max-width:250px;';
  const title = document.createElement('div');
  title.textContent = '🎭 dev · trigger performance';
  title.style.cssText = 'color:#ffa7d1;font-weight:600;';
  panel.appendChild(title);

  const emotions = live2d.listEmotions?.() ?? [];
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;';
  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;background:#20242f;color:inherit;border:1px solid #2c3140;border-radius:6px;padding:3px;';
  for (const id of emotions) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id;
    sel.appendChild(o);
  }
  const play = document.createElement('button');
  play.textContent = '▶ Play';
  play.style.cssText = btn;
  play.addEventListener('click', () => live2d.triggerEmotion?.(sel.value));
  row.append(sel, play);
  panel.appendChild(row);

  const srow = document.createElement('div');
  srow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
  const states: Array<[string, Live2DState]> = [
    ['Idle', 'neutral'],
    ['Thinking', 'thinking'],
    ['Speaking', 'speaking'],
    ['Sleeping', 'sleeping'],
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
    note.textContent = '(model not loaded — placeholder sink)';
    note.style.cssText = 'color:#8b93a7;';
    panel.appendChild(note);
  }

  document.body.appendChild(panel);
}

void boot();
