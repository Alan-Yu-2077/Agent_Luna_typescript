import { MessageDelivery } from '@luna/protocol';
import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
import { consoleLive2DSink, noopAudioSink, type AudioSink, type Live2DSink } from './sinks';
import { CuteBubbleView } from './ui/cuteBubbleView';
import { buildLayout } from './ui/layout';
import { startTimestampRefresh } from './ui/time';
import { moodOf } from './ui/mood';
import { createPixiLive2DSink } from './live2d/pixiLive2DSink';
import { WebAudioSink } from './audio/webAudioSink';

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

  if (location.search.includes('dev')) {
    const g = globalThis as unknown as { lunaLive2D?: Live2DSink; lunaAudio?: AudioSink };
    g.lunaLive2D = live2d;
    g.lunaAudio = audio;
  }

  startTimestampRefresh(refs.chatLog);
}

void boot();
