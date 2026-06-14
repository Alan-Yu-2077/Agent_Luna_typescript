import { createController } from './controller';
import { LunaWsClient, type WsStatus } from './wsClient';
import { consoleLive2DSink, noopAudioSink } from './sinks';
import { CuteBubbleView } from './ui/cuteBubbleView';
import { buildLayout } from './ui/layout';
import { startTimestampRefresh } from './ui/time';

// Browser entry — builds the cute UI shell, wires the v0.12.0 consumption
// controller to the CuteBubbleView + (still stubbed) Live2D/audio sinks, and
// pipes the WS event stream through. The real Live2D model (v0.13.1) and voice
// (v0.13.2) drop into the stub sinks later; the consumption path is unchanged.

const STATUS_TEXT: Record<WsStatus, string> = {
  connecting: '连接中…',
  open: '在线',
  closed: '重连中…',
};

function boot(): void {
  const root = document.getElementById('app');
  if (!root) return;

  const refs = buildLayout(root);
  const view = new CuteBubbleView(refs.chatLog);
  const controller = createController({ view, live2d: consoleLive2DSink, audio: noopAudioSink });

  let dreaming = false;
  function setDreaming(d: boolean): void {
    dreaming = d;
    refs.input.disabled = d;
    refs.input.placeholder = d ? 'Luna 正在做梦…' : '对 Luna 说点什么…';
  }

  const client = new LunaWsClient({
    url: `ws://${location.host}`,
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

boot();
