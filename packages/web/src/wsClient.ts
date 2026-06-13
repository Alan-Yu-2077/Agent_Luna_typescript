import { ServerEvent, type ClientEvent } from '@luna/protocol';

export type WsStatus = 'connecting' | 'open' | 'closed';

export type WsClientOptions = {
  url: string;
  onEvent: (e: ServerEvent) => void;
  onStatus?: (status: WsStatus) => void;
  reconnectMs?: number;
};

// Typed WS client. The validated boundary: every inbound frame is
// ServerEvent.safeParse'd, so a frame the server shape changed out from under
// us is dropped (observable), never silently mis-handled — the rewrite's answer
// to the Python silent-drift class. Auto-reconnects unless closed deliberately.
export class LunaWsClient {
  private ws: WebSocket | null = null;
  private closed = false;

  constructor(private readonly opts: WsClientOptions) {}

  connect(): void {
    this.closed = false;
    this.opts.onStatus?.('connecting');
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;
    ws.addEventListener('open', () => this.opts.onStatus?.('open'));
    ws.addEventListener('message', (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      let json: unknown;
      try {
        json = JSON.parse(ev.data);
      } catch {
        return;
      }
      const parsed = ServerEvent.safeParse(json);
      if (parsed.success) this.opts.onEvent(parsed.data);
    });
    ws.addEventListener('close', () => {
      this.opts.onStatus?.('closed');
      if (!this.closed) setTimeout(() => this.connect(), this.opts.reconnectMs ?? 1500);
    });
  }

  send(e: ClientEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(e));
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
