import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { LunaWsClient } from './wsClient';

// C2 (v0.16.0): frames sent before the socket is OPEN must buffer and flush on
// open, not silently drop. Driven against an injected fake WebSocket.

type Listener = (ev: unknown) => void;

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static last: FakeSocket | null = null;

  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  private listeners: Record<string, Listener[]> = {};

  constructor(public url: string) {
    FakeSocket.last = this;
  }
  addEventListener(type: string, cb: Listener): void {
    (this.listeners[type] ??= []).push(cb);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = FakeSocket.CLOSED;
  }
  fireOpen(): void {
    this.readyState = FakeSocket.OPEN;
    for (const cb of this.listeners['open'] ?? []) cb({});
  }
}

// WHY-cast: substituting the ambient WebSocket with a controllable fake for the test.
const realWebSocket = globalThis.WebSocket;
beforeEach(() => {
  (globalThis as { WebSocket: unknown }).WebSocket = FakeSocket;
  FakeSocket.last = null;
});
afterEach(() => {
  (globalThis as { WebSocket: unknown }).WebSocket = realWebSocket;
});

describe('LunaWsClient offline buffer', () => {
  test('buffers a frame sent before open, flushes on open', () => {
    const client = new LunaWsClient({ url: 'ws://x', onEvent: () => {} });
    client.connect();
    const sock = FakeSocket.last!;
    expect(sock.readyState).toBe(FakeSocket.CONNECTING);

    client.send({ type: 'chat.send', text: 'hi' });
    expect(sock.sent.length).toBe(0); // buffered, not dropped

    sock.fireOpen();
    expect(sock.sent.length).toBe(1);
    expect(JSON.parse(sock.sent[0]!).text).toBe('hi');
  });

  test('sends immediately when already open', () => {
    const client = new LunaWsClient({ url: 'ws://x', onEvent: () => {} });
    client.connect();
    const sock = FakeSocket.last!;
    sock.fireOpen();

    client.send({ type: 'chat.send', text: 'now' });
    expect(sock.sent.length).toBe(1);
    expect(JSON.parse(sock.sent[0]!).text).toBe('now');
  });
});
