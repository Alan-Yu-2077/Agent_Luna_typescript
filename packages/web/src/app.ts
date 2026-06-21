import { MessageDelivery } from '@luna/protocol';
import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
import { lastGeoFix, requestGeolocation } from './geo';
import { consoleLive2DSink, noopAudioSink, type AudioSink, type Live2DSink, type Live2DState } from './sinks';
import { CuteBubbleView } from './ui/cuteBubbleView';
import { buildLayout } from './ui/layout';
import { startTimestampRefresh } from './ui/time';
import { moodOf } from './ui/mood';
import { createPixiLive2DSink } from './live2d/pixiLive2DSink';
import { WebAudioSink } from './audio/webAudioSink';
import { createBootGate, warmUpTts } from './ui/bootGate';

// Browser entry — builds the cute UI shell + the live Live2D avatar + voice, and
// wires the v0.12.0 consumption controller plus the v0.13.4 polish chrome (dream
// overlay, thinking indicator, mood pip, scroll pill, settings). Degrades to the
// placeholder + silence if WebGL/audio are unavailable; chat works regardless.

const STATUS_TEXT: Record<WsStatus, string> = { connecting: 'Connecting…', open: 'Online', closed: 'Reconnecting…' };
// Backend WS port: default 8787, overridable via `?ws=<port>` so an isolated dev
// instance (separate worktree) can point its web at a separate server without
// touching the stable instance. Persists across reloads (the query stays in the URL).
const WS_PORT = new URLSearchParams(location.search).get('ws') ?? '8787';
const WS_URL = `ws://${location.hostname}:${WS_PORT}`;
const DREAM_MIN_MS = 1500;

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  if (localStorage.getItem('luna:reduce-motion') === '1') root.classList.add('reduce-motion');

  const refs = buildLayout(root);
  const view = new CuteBubbleView(refs.chatLog, refs.scrollPill);

  // Boot gate: when voice is on, block the UI until GPT-SoVITS has warmed its
  // (~5GB) model. Skippable, and degrades fast (no block) if no sidecar is up.
  // The rest of boot (Live2D, WS) proceeds behind the overlay.
  if (localStorage.getItem('luna:tts') !== '0') {
    const gate = createBootGate(root);
    let skipped = false;
    gate.onSkip(() => {
      skipped = true;
      gate.done();
    });
    void warmUpTts('/api/gpt-sovits', (s) => {
      if (!skipped) gate.setStatus(s);
    }).then((res) => {
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

  let live2d: Live2DSink = consoleLive2DSink;
  if (localStorage.getItem('luna:live2d') !== '0') {
    const sink = await createPixiLive2DSink(refs.modelStage);
    if (sink) {
      live2d = sink;
      refs.modelStage.querySelector('.model-placeholder')?.remove();
    }
  }

  let audio: AudioSink = noopAudioSink;
  if (localStorage.getItem('luna:tts') !== '0') {
    audio = new WebAudioSink({ onMouth: (frame) => live2d.setMouth(frame) });
  }

  const controller = createController({ view, live2d, audio });

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

  function updateMood(key: Parameters<typeof moodOf>[0]): void {
    const m = moodOf(key);
    const emoji = refs.moodPip.querySelector('.emoji');
    const label = refs.moodPip.querySelector('.mood-label');
    if (emoji) emoji.textContent = m.emoji;
    if (label) label.textContent = m.label;
    refs.moodPip.classList.add('on');
  }

  const client = new LunaWsClient({
    url: WS_URL,
    onEvent: (e) => {
      if (e.type === 'turn.started' || e.type === 'proactive.started') view.showThinking();
      if (e.type === 'turn.result') view.hideThinking();
      if (e.type === 'dream.status') setDream(e.is_dreaming);
      if (e.type === 'dream.step') refs.dreamCaption.textContent = e.detail || e.step;
      if (e.type === 'tool.finished' && e.result.kind === 'ok') {
        const parsed = MessageDelivery.safeParse(e.result.data);
        if (parsed.success && parsed.data.expression) updateMood(parsed.data.expression);
      }
      controller.handle(e);
    },
    onStatus: (s) => {
      refs.statusBadge.textContent = STATUS_TEXT[s];
      refs.statusBadge.dataset['status'] = s;
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
    view.userMessage(text);
    client.send({ type: 'chat.send', text });
    refs.input.value = '';
  }
  refs.sendBtn.addEventListener('click', send);
  refs.input.addEventListener('keydown', (e) => {
    // Don't send mid-IME-composition: the Enter that commits a Chinese pinyin
    // candidate must select the candidate, not dispatch a half-composed message.
    // isComposing covers modern browsers; keyCode 229 is the legacy WebView signal.
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) send();
  });
  refs.dreamBtn.addEventListener('click', () => client.send({ type: 'dream.enter' }));
  refs.dreamWakeBtn.addEventListener('click', () => client.send({ type: 'dream.wake' }));

  refs.settingsBtn.addEventListener('click', () => refs.settingsPanel.classList.toggle('on'));
  refs.ttsToggle.addEventListener('change', () =>
    localStorage.setItem('luna:tts', refs.ttsToggle.checked ? '1' : '0'),
  );
  refs.live2dToggle.addEventListener('change', () =>
    localStorage.setItem('luna:live2d', refs.live2dToggle.checked ? '1' : '0'),
  );
  refs.motionToggle.addEventListener('change', () => {
    const on = refs.motionToggle.checked;
    localStorage.setItem('luna:reduce-motion', on ? '1' : '0');
    root.classList.toggle('reduce-motion', on);
  });
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

  if (location.search.includes('dev')) {
    const g = globalThis as unknown as { lunaLive2D?: Live2DSink; lunaAudio?: AudioSink };
    g.lunaLive2D = live2d;
    g.lunaAudio = audio;
    buildDevPanel(live2d);
  }

  startTimestampRefresh(refs.chatLog);
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
