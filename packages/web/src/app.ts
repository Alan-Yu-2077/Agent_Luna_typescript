import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
import { consoleLive2DSink, noopAudioSink, type Live2DSink } from './sinks';
import { CuteBubbleView } from './ui/cuteBubbleView';
import { buildLayout } from './ui/layout';
import { startTimestampRefresh } from './ui/time';
import { createPixiLive2DSink } from './live2d/pixiLive2DSink';

// Browser entry — builds the cute UI shell, mounts the real Live2D avatar
// (v0.13.1) into the model stage behind a WebGL/flag guard, and wires the
// v0.12.0 consumption controller. Falls back to the placeholder + console sink
// if Live2D is disabled or unavailable; chat works either way.

const STATUS_TEXT: Record<WsStatus, string> = {
  connecting: '连接中…',
  open: '在线',
  closed: '重连中…',
};

// In dev the web bundle is served from a different port than the WS backend
// (LUNA_PORT 8787); point the socket at the backend host explicitly.
const WS_URL = `ws://${location.hostname}:8787`;

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  const refs = buildLayout(root);
  const view = new CuteBubbleView(refs.chatLog);

  let live2d: Live2DSink = consoleLive2DSink;
  if (localStorage.getItem('luna:live2d') !== '0') {
    const sink = await createPixiLive2DSink(refs.modelStage);
    if (sink) {
      live2d = sink;
      refs.modelStage.querySelector('.model-placeholder')?.remove();
    }
  }

  const controller = createController({ view, live2d, audio: noopAudioSink });

  let dreaming = false;
  function setDreaming(d: boolean): void {
    dreaming = d;
    refs.input.disabled = d;
    refs.input.placeholder = d ? 'Luna 正在做梦…' : '对 Luna 说点什么…';
  }

  const client = new LunaWsClient({
    url: WS_URL,
    onEvent: (e) => {
      if (e.type === 'dream.status') setDreaming(e.is_dreaming);
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

  startTimestampRefresh(refs.chatLog);
}

void boot();
