import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import { handleClose, handleMessage, handleOpen } from './ws';

let server: Server<unknown>;
let url: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      if (srv.upgrade(req, { data: undefined })) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open: handleOpen,
      message: handleMessage,
      close: handleClose,
    },
  });
  url = `ws://${server.hostname}:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

function roundTrip(payload: string, timeoutMs = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('round-trip timeout'));
    }, timeoutMs);

    ws.addEventListener('open', () => {
      ws.send(payload);
    });
    ws.addEventListener('message', (e) => {
      clearTimeout(timer);
      const data = typeof e.data === 'string' ? e.data : '';
      ws.close();
      resolve(data);
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('ws error'));
    });
  });
}

describe('WS round-trip', () => {
  test('valid ping returns pong with matching seq within 100ms', async () => {
    const start = Date.now();
    const response = await roundTrip(JSON.stringify({ type: 'ping', seq: 42 }), 100);
    const elapsed = Date.now() - start;
    const event = JSON.parse(response);
    expect(event.type).toBe('pong');
    expect(event.seq).toBe(42);
    expect(typeof event.server_time_ms).toBe('number');
    expect(elapsed).toBeLessThan(100);
  });

  test('malformed JSON returns error event with code invalid_event', async () => {
    const response = await roundTrip('{not json}');
    const event = JSON.parse(response);
    expect(event.type).toBe('error');
    expect(event.code).toBe('invalid_event');
  });

  test('unknown event type returns error event with code invalid_event', async () => {
    const response = await roundTrip(JSON.stringify({ type: 'unknown', seq: 1 }));
    const event = JSON.parse(response);
    expect(event.type).toBe('error');
    expect(event.code).toBe('invalid_event');
  });

  test('ping with negative seq returns error event', async () => {
    const response = await roundTrip(JSON.stringify({ type: 'ping', seq: -1 }));
    const event = JSON.parse(response);
    expect(event.type).toBe('error');
    expect(event.code).toBe('invalid_event');
  });
});
