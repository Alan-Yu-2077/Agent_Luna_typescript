import { createController } from './controller';
import { DomBubbleView } from './bubbles';
import { LunaWsClient } from './wsClient';
import { consoleLive2DSink, noopAudioSink } from './sinks';

// Browser entry — wires the consumption controller to a DOM bubble view, the
// (stubbed) Live2D + audio sinks, and the WS client. The real Live2D model
// driver + GPT-SoVITS audio replace the stubs in a later pass; this proves the
// consumption path end-to-end in a browser today.
function boot(): void {
  const log = document.getElementById('log');
  const input = document.getElementById('input') as HTMLInputElement | null;
  const statusEl = document.getElementById('status');
  if (!log || !input) return;

  const view = new DomBubbleView(log);
  const controller = createController({ view, live2d: consoleLive2DSink, audio: noopAudioSink });

  const client = new LunaWsClient({
    url: `ws://${location.host}`,
    onEvent: (e) => {
      if (e.type === 'turn.started') view.chip('tool', '·'); // lightweight turn marker
      controller.handle(e);
    },
    onStatus: (s) => {
      if (statusEl) statusEl.textContent = s;
    },
  });
  client.connect();

  function send(): void {
    const text = input!.value.trim();
    if (!text) return;
    view.finalize(`user:${Date.now()}`, text); // render the user line immediately
    client.send({ type: 'chat.send', text });
    input!.value = '';
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });
}

boot();
