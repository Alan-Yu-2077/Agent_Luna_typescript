import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import type Anthropic from '@anthropic-ai/sdk';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { handleClose, handleMessage, handleOpen, setRuntime, type WSData } from './ws';
import { MockProvider } from './provider/mock';
import type { ProviderEvent } from './provider/types';
import { builtinRegistry, messageRegistry } from './tools/registry';
import { getSession, resetSessions } from './turn/session';
import { migrate } from './sql';
import { initSettings, setSetting } from './settings/store';

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
      const data = typeof e.data === 'string' ? e.data : '';
      // v0.27.1: every connect is greeted with a settings.state push — not the response
      // these round-trip helpers are waiting for.
      if (data.includes('"settings.state"')) return;
      clearTimeout(timer);
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
      if (data && typeof data === 'object' && 'type' in data && data.type === 'settings.state') {
        return; // connect-greeting push (v0.27.1), not part of the collected exchange
      }
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

describe('chat.send', () => {
  beforeEach(() => {
    resetSessions();
  });
  afterEach(() => {
    setRuntime(null);
  });

  function mockRounds(): ProviderEvent[][] {
    const assistantContent = [
      { type: 'text', text: 'Hi there.' },
    ] as unknown as Anthropic.ContentBlock[];
    return [
      [
        { kind: 'text_delta', text: 'Hi ' },
        { kind: 'text_delta', text: 'there.' },
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent,
          usage: { input_tokens: 10, output_tokens: 4 },
        },
      ],
    ];
  }

  test('chat.send streams turn.started → reply.token+ → turn.result', async () => {
    setRuntime({ provider: new MockProvider(mockRounds()), registry: builtinRegistry });
    const events = await collectUntil(
      JSON.stringify({ type: 'chat.send', text: 'hello' }),
      new Set(['turn.result', 'error']),
      1000,
    );
    const types = events.map((e) => (e as { type: string }).type);
    expect(types[0]).toBe('turn.started');
    expect(types.filter((t) => t === 'reply.token').length).toBe(2);
    expect(types.at(-1)).toBe('turn.result');
    const result = events.at(-1) as { text: string; finish_reason: string };
    expect(result.text).toBe('Hi there.');
    expect(result.finish_reason).toBe('end_turn');
  });

  test('chat.send without runtime returns runtime_not_configured', async () => {
    const response = await roundTrip(JSON.stringify({ type: 'chat.send', text: 'hello' }));
    const event = JSON.parse(response);
    expect(event.type).toBe('error');
    expect(event.code).toBe('runtime_not_configured');
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

describe('proactive.fire (WS gating)', () => {
  beforeEach(() => {
    resetSessions();
  });
  afterEach(() => {
    setRuntime(null);
    delete Bun.env['LUNA_PROACTIVE'];
  });

  test('LUNA_PROACTIVE=0 → proactive_disabled (kill switch)', async () => {
    Bun.env['LUNA_PROACTIVE'] = '0'; // default is ON since v0.11.0
    setRuntime({ provider: new MockProvider([]), registry: messageRegistry });
    const event = JSON.parse(await roundTrip(JSON.stringify({ type: 'proactive.fire' })));
    expect(event.type).toBe('error');
    expect(event.code).toBe('proactive_disabled');
  });

  test('LUNA_PROACTIVE=1 but no runtime → runtime_not_configured', async () => {
    Bun.env['LUNA_PROACTIVE'] = '1';
    setRuntime(null);
    const event = JSON.parse(await roundTrip(JSON.stringify({ type: 'proactive.fire' })));
    expect(event.type).toBe('error');
    expect(event.code).toBe('runtime_not_configured');
  });

  test('rejects with turn_in_progress while a user turn is active (mutex)', async () => {
    Bun.env['LUNA_PROACTIVE'] = '1';
    setRuntime({ provider: new MockProvider([]), registry: messageRegistry });
    getSession('default').activeTurn = 'busy-turn'; // simulate an in-flight user turn
    const event = JSON.parse(await roundTrip(JSON.stringify({ type: 'proactive.fire' })));
    expect(event.type).toBe('error');
    expect(event.code).toBe('turn_in_progress');
    getSession('default').activeTurn = null;
  });

  test('gating passes → a silent proactive cycle emits started…finished(spoke:false)', async () => {
    Bun.env['LUNA_PROACTIVE'] = '1';
    const silent: ProviderEvent[][] = [
      [
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent: [] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 5, output_tokens: 1 },
        },
      ],
    ];
    setRuntime({ provider: new MockProvider(silent), registry: messageRegistry });
    const events = await collectUntil(
      JSON.stringify({ type: 'proactive.fire' }),
      new Set(['proactive.finished', 'error']),
      1000,
    );
    const types = events.map((e) => (e as { type: string }).type);
    expect(types[0]).toBe('proactive.started');
    expect(types.at(-1)).toBe('proactive.finished');
    const finished = events.at(-1) as { spoke: boolean };
    expect(finished.spoke).toBe(false);
  });
});

describe('settings over the wire (v0.27.1)', () => {
  test('every connect is greeted with a settings.state push', async () => {
    const first = await new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error('no greeting')), 300);
      ws.addEventListener('message', (e) => {
        clearTimeout(timer);
        ws.close();
        resolve(typeof e.data === 'string' ? e.data : '');
      });
    });
    const event = JSON.parse(first) as { type: string; settings: Array<{ key: string }> };
    expect(event.type).toBe('settings.state');
    expect(event.settings.length).toBeGreaterThan(0);
  });

  test('settings.set → broadcast settings.state with the pin; invalid → error + heal frame', async () => {
    const prev = Bun.env['LUNA_PROACTIVE'];
    const mem = new Database(':memory:', { strict: true });
    migrate(mem, join(import.meta.dir, 'migrations'));
    initSettings(mem);
    try {
      const ok = await collectUntil(
        JSON.stringify({ type: 'settings.set', key: 'proactive.enabled', value: '0' }),
        new Set(['__none__']),
        300,
      ).catch(() => null);
      // broadcast frames are filtered by collectUntil; read the raw exchange instead
      const frames = await new Promise<unknown[]>((resolve, reject) => {
        const ws = new WebSocket(url);
        const seen: unknown[] = [];
        const timer = setTimeout(() => {
          ws.close();
          resolve(seen);
        }, 250);
        ws.addEventListener('open', () =>
          ws.send(JSON.stringify({ type: 'settings.set', key: 'proactive.enabled', value: '0' })),
        );
        ws.addEventListener('message', (e) => {
          seen.push(JSON.parse(typeof e.data === 'string' ? e.data : 'null'));
        });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('ws error'));
        });
      });
      expect(ok).toBeNull();
      const states = frames.filter(
        (f): f is { type: string; settings: Array<{ key: string; value: string; source: string }> } =>
          typeof f === 'object' && f !== null && (f as { type?: string }).type === 'settings.state',
      );
      // greeting + post-set broadcast
      expect(states.length).toBeGreaterThanOrEqual(2);
      const last = states.at(-1);
      const pin = last?.settings.find((s) => s.key === 'proactive.enabled');
      expect(pin).toMatchObject({ value: '0', source: 'user' });
      expect(Bun.env['LUNA_PROACTIVE']).toBe('0');

      const rejected = await new Promise<unknown[]>((resolve) => {
        const ws = new WebSocket(url);
        const seen: unknown[] = [];
        setTimeout(() => {
          ws.close();
          resolve(seen);
        }, 250);
        ws.addEventListener('open', () =>
          ws.send(JSON.stringify({ type: 'settings.set', key: 'selfcont.probability', value: '9' })),
        );
        ws.addEventListener('message', (e) => {
          seen.push(JSON.parse(typeof e.data === 'string' ? e.data : 'null'));
        });
      });
      const types = rejected.map((f) => (f as { type: string }).type);
      expect(types).toContain('error');
      // greeting state + heal state after the rejection
      expect(types.filter((t) => t === 'settings.state').length).toBeGreaterThanOrEqual(2);
      const err = rejected.find((f) => (f as { type: string }).type === 'error') as {
        code: string;
      };
      expect(err.code).toBe('settings_invalid');
    } finally {
      setSetting('proactive.enabled', null);
      if (prev === undefined) delete Bun.env['LUNA_PROACTIVE'];
      else Bun.env['LUNA_PROACTIVE'] = prev;
      const scratch = new Database(':memory:', { strict: true });
      migrate(scratch, join(import.meta.dir, 'migrations'));
      initSettings(scratch);
    }
  });
});
