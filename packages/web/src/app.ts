import { MessageDelivery } from '@luna/protocol';
import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
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

const STATUS_TEXT: Record<WsStatus, string> = { connecting: '连接中…', open: '在线', closed: '重连中…' };
const WS_URL = `ws://${location.hostname}:8787`;
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
        res === 'unavailable' ? '未检测到语音服务，直接进入' : res === 'failed' ? '语音加载失败，静音进入' : '语音就绪 ✓',
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
    audio = new WebAudioSink({ onMouth: (v) => live2d.setMouthOpen(v) });
  }

  const controller = createController({ view, live2d, audio });

  let dreaming = false;
  let dreamShownAt = 0;
  let dreamHideTimer = 0;
  function setDream(on: boolean): void {
    dreaming = on;
    refs.input.disabled = on;
    refs.input.placeholder = on ? 'Luna 正在做梦…' : '对 Luna 说点什么…';
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
    },
  });
  client.connect();

  function send(): void {
    const text = refs.input.value.trim();
    if (!text || dreaming) return;
    view.userMessage(text);
    client.send({ type: 'chat.send', text });
    refs.input.value = '';
  }
  refs.sendBtn.addEventListener('click', send);
  refs.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
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
  title.textContent = '🎭 dev · 表演触发';
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
  play.textContent = '▶ 表演';
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
    note.textContent = '(模型未加载 — 占位 sink)';
    note.style.cssText = 'color:#8b93a7;';
    panel.appendChild(note);
  }
  document.body.appendChild(panel);
}

void boot();
