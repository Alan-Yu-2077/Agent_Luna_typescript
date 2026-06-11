import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import { handleClose, handleMessage, handleOpen, type WSData } from './ws';

let server: Server<WSData>;
let url: string;

beforeAll(() => {
  server = Bun.serve<WSData>({
    port: 0,
    fetch(req, srv) {
      if (srv.upgrade(req, { data: { sessionId: 'default' } })) return;
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

function collectUntil(
  payload: string,
  finalTypes: Set<string>,
  timeoutMs = 500,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const events: unknown[] = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('round-trip timeout'));
    }, timeoutMs);

    ws.addEventListener('open', () => ws.send(payload));
    ws.addEventListener('message', (e) => {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : null;
      events.push(data);
      if (data && typeof data === 'object' && 'type' in data && finalTypes.has((data as { type: string }).type)) {
        clearTimeout(timer);
        ws.close();
        resolve(events);
      }
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

describe('dev.dispatch_tool', () => {
  beforeEach(() => {
    Bun.env['LUNA_DEV_TOOLS'] = '1';
  });
  afterEach(() => {
    delete Bun.env['LUNA_DEV_TOOLS'];
  });

  test('time_now dispatch yields tool.started + tool.finished with matching call_id', async () => {
    const events = await collectUntil(
      JSON.stringify({
        type: 'dev.dispatch_tool',
        call_id: 'smoke-1',
        tool_name: 'time_now',
        input: {},
      }),
      new Set(['tool.finished', 'error']),
    );
    const started = events.find(
      (e) => e && typeof e === 'object' && (e as { type: string }).type === 'tool.started',
    ) as { type: string; call_id: string; tool_name: string } | undefined;
    const finished = events.find(
      (e) => e && typeof e === 'object' && (e as { type: string }).type === 'tool.finished',
    ) as { type: string; call_id: string; result: { kind: string; data: { iso: string } } } | undefined;

    expect(started).toBeDefined();
    expect(started?.call_id).toBe('smoke-1');
    expect(started?.tool_name).toBe('time_now');
    expect(finished).toBeDefined();
    expect(finished?.call_id).toBe('smoke-1');
    expect(finished?.result.kind).toBe('ok');
    expect(typeof finished?.result.data.iso).toBe('string');
  });

  test('dispatch with LUNA_DEV_TOOLS=0 returns invalid_event error', async () => {
    delete Bun.env['LUNA_DEV_TOOLS'];
    const response = await roundTrip(
      JSON.stringify({
        type: 'dev.dispatch_tool',
        call_id: 'gated',
        tool_name: 'time_now',
        input: {},
      }),
    );
    const event = JSON.parse(response);
    expect(event.type).toBe('error');
    expect(event.code).toBe('invalid_event');
    expect(event.message).toContain('LUNA_DEV_TOOLS');
  });
});
