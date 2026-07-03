import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { migrate } from '../sql';
import { MockProvider } from '../provider/mock';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn, warnIfExpensiveRound } from './runTurn';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';

// v0.28.5 — the 390K-token-incident lesson: cost regressions must be visible in logs + traces,
// not only on the bill.

let warned: string[] = [];
const realWarn = console.warn;

beforeEach(() => {
  warned = [];
  console.warn = (...args: unknown[]) => {
    warned.push(args.map(String).join(' '));
  };
  delete Bun.env['LUNA_COST_WARN_INPUT_TOKENS'];
});

afterEach(() => {
  console.warn = realWarn;
  delete Bun.env['LUNA_COST_WARN_INPUT_TOKENS'];
});

describe('warnIfExpensiveRound', () => {
  test('fires above the threshold, silent below, =0 disables', () => {
    Bun.env['LUNA_COST_WARN_INPUT_TOKENS'] = '50000';
    warnIfExpensiveRound(49_999, 't1');
    expect(warned.length).toBe(0);
    warnIfExpensiveRound(50_001, 't1');
    expect(warned.length).toBe(1);
    expect(warned[0]).toContain('50001 input tokens');
    expect(warned[0]).toContain('t1');

    Bun.env['LUNA_COST_WARN_INPUT_TOKENS'] = '0';
    warnIfExpensiveRound(9_999_999, 't2'); // disabled → silent
    expect(warned.length).toBe(1);
  });

  test('default threshold is 80K', () => {
    warnIfExpensiveRound(80_000, 't3'); // at threshold → silent (strict >)
    expect(warned.length).toBe(0);
    warnIfExpensiveRound(80_001, 't3');
    expect(warned.length).toBe(1);
  });
});

describe('turn.result usage lands in the trace', () => {
  test('an expensive round warns AND the trace records the real usage', async () => {
    const db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    const store = new TraceStore(db);
    setTraceStore(store);
    resetSessions();
    Bun.env['LUNA_COST_WARN_INPUT_TOKENS'] = '100000';
    try {
      const provider = new MockProvider([
        [
          { kind: 'text_delta', text: 'hi' },
          {
            kind: 'message_stop',
            stopReason: 'end_turn',
            toolUses: [],
            assistantContent: [
              { type: 'text', text: 'hi' },
            ] as unknown as Anthropic.ContentBlock[],
            usage: { input_tokens: 294_000, output_tokens: 20 }, // the incident's shape
          },
        ],
      ]);
      await runTurn({
        session: getSession('cw'),
        turnId: 'cw:t1',
        userText: 'hello',
        provider,
        registry: builtinRegistry,
        emit: () => {},
      });
      // the loud tripwire fired
      expect(warned.some((w) => w.includes('294000 input tokens'))).toBe(true);
      // and /_trace now carries the turn's real totals
      const events = store.getEventsByTurn('cw:t1');
      const result = events.find(
        (e) => JSON.parse(e.payload_json).server_event_type === 'turn.result',
      );
      expect(result).toBeDefined();
      const payload = JSON.parse(result!.payload_json) as {
        payload?: { usage?: { input_tokens: number; output_tokens: number } };
      };
      expect(payload.payload?.usage?.input_tokens).toBe(294_000);
      expect(payload.payload?.usage?.output_tokens).toBe(20);
    } finally {
      setTraceStore(null);
      db.close(false);
      resetSessions();
    }
  });
});
