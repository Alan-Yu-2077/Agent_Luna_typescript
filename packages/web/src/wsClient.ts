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
// Cap the offline buffer so a long outage can't grow it without bound.
const MAX_OUTBOX = 100;

export class LunaWsClient {
  private ws: WebSocket | null = null;
  private closed = false;
  // C2 (v0.16.0): frames sent while the socket isn't OPEN are buffered here and
  // flushed on reopen, instead of being silently dropped (the bubble was already
  // rendered, so a dropped frame meant a message the server never received).
  private outbox: ClientEvent[] = [];
  private attempt = 0;

  constructor(private readonly opts: WsClientOptions) {}

  connect(): void {
    this.closed = false;
    this.opts.onStatus?.('connecting');
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.attempt = 0;
      this.opts.onStatus?.('open');
      this.flush();
    });
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
      if (this.closed) return;
      // Exponential backoff with jitter, capped — no tight reconnect storm if the
      // server is down for a while.
      const base = this.opts.reconnectMs ?? 1500;
      const delay = Math.min(base * 2 ** this.attempt, 15_000);
      this.attempt += 1;
      setTimeout(() => this.connect(), delay + Math.random() * 250);
    });
  }

  private flush(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const pending = this.outbox;
    this.outbox = [];
    for (const e of pending) this.ws.send(JSON.stringify(e));
  }

  send(e: ClientEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(e));
      return;
    }
    // Not open yet (connecting / reconnecting) — buffer and flush on open.
    this.outbox.push(e);
    if (this.outbox.length > MAX_OUTBOX) this.outbox.shift();
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
