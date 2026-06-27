import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions, type Session } from '../turn/session';
import { resetDreamStateForTests } from '../dream/dreamState';
import { loadCadence } from './cadence';
import {
  maybeFireProactive,
  resetProactiveFireStateForTests,
  setProactiveDetectorForTests,
  withProactiveLock,
  type MaybeFireOpts,
} from './fire';

const endRound: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

const dreamLlm = { primary: new MockProvider([]), fallback: null };

let db: Database;
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  Bun.env['LUNA_PROACTIVE'] = '1';
  Bun.env['LUNA_PROACTIVE_QUIET_HOURS'] = ''; // clock-independent
  resetSessions();
  resetDreamStateForTests();
  resetProactiveFireStateForTests();
});
afterEach(() => {
  setMemoryDb(null);
  delete Bun.env['LUNA_PROACTIVE'];
  delete Bun.env['LUNA_PROACTIVE_QUIET_HOURS'];
  delete Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'];
  delete Bun.env['LUNA_PROACTIVE_DEBOUNCE_MS'];
  setProactiveDetectorForTests(null);
  resetProactiveFireStateForTests();
  db.close(false);
});

// past the 60s idle floor so passesAntiSpam allows the funnel
function idle(s: Session): void {
  s.lastUserMs = Date.now() - 5 * 60_000;
}

function opts(
  session: Session,
  provider: MockProvider,
  nowMs = Date.now(),
): MaybeFireOpts & { provider: MockProvider; _events: ServerEvent[] } {
  const _events: ServerEvent[] = [];
  return {
    session,
    provider,
    registry: messageRegistry,
    emit: (e) => _events.push(e),
    dreamLlm,
    nowMs,
    nowHour: new Date(nowMs).getHours(),
    _events,
  };
}

describe('withProactiveLock (the single-turn lock primitive)', () => {
  test('a second acquire while the first is in-flight returns null without running fn', async () => {
    const s = getSession('default');
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const p1 = withProactiveLock(s, async () => {
      await gate;
      return 'a';
    });
    // p1 holds the lock — a racing acquire sees it and bails (no double-run)
    let ranB = false;
    const r2 = await withProactiveLock(s, async () => {
      ranB = true;
      return 'b';
    });
    expect(r2).toBeNull();
    expect(ranB).toBe(false);
    release();
    expect(await p1).toBe('a');
  });

  test('the lock is released so a later acquire succeeds', async () => {
    const s = getSession('default');
    expect(await withProactiveLock(s, async () => 'first')).toBe('first');
    expect(await withProactiveLock(s, async () => 'second')).toBe('second');
  });

  test('rejects (null) while a reactive turn is active', async () => {
    const s = getSession('default');
    s.activeTurn = 'busy';
    let ran = false;
    const r = await withProactiveLock(s, async () => {
      ran = true;
      return 'x';
    });
    expect(r).toBeNull();
    expect(ran).toBe(false);
    s.activeTurn = null;
  });

  test('rejects (null) when proactive is disabled', async () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    const r = await withProactiveLock(getSession('default'), async () => 'x');
    expect(r).toBeNull();
  });
});

describe('maybeFireProactive (the detector funnel)', () => {
  test('a trigger + idle → fires and stamps the cadence cooldown', async () => {
    setProactiveDetectorForTests(() => ({ intent: 'spontaneous', seed: 's', debounceKey: 'after_night' }));
    const s = getSession('default');
    idle(s);
    const o = opts(s, new MockProvider([[endRound]]));
    const out = await maybeFireProactive(o);
    expect(out.fired).toBe(true);
    expect(o.provider.requests.length).toBeGreaterThanOrEqual(1);
    expect(o._events.some((e) => e.type === 'proactive.started')).toBe(true);
    expect(loadCadence('default').lastProactiveMs).toBeGreaterThan(0);
  });

  test('no trigger → no fire', async () => {
    setProactiveDetectorForTests(() => null);
    const s = getSession('default');
    idle(s);
    const o = opts(s, new MockProvider([[endRound]]));
    expect((await maybeFireProactive(o)).fired).toBe(false);
    expect(o.provider.requests.length).toBe(0);
  });

  test('anti-spam (cooldown) blocks the funnel before the detector runs', async () => {
    let detectCalls = 0;
    setProactiveDetectorForTests(() => {
      detectCalls += 1;
      return { intent: 'spontaneous', seed: 's', debounceKey: 'after_night' };
    });
    const s = getSession('default');
    idle(s);
    await maybeFireProactive(opts(s, new MockProvider([[endRound]]))); // first fire stamps cooldown
    const callsAfterFirst = detectCalls;
    const o = opts(s, new MockProvider([[endRound]])); // immediate second — within 5m cooldown
    expect((await maybeFireProactive(o)).fired).toBe(false);
    expect(o.provider.requests.length).toBe(0);
    expect(detectCalls).toBe(callsAfterFirst); // detector NOT consulted — anti-spam short-circuits
  });

  test('two concurrent funnel calls never double-fire (the lock)', async () => {
    setProactiveDetectorForTests(() => ({ intent: 'spontaneous', seed: 's', debounceKey: 'after_night' }));
    const s = getSession('default');
    idle(s);
    const a = opts(s, new MockProvider([[endRound]]));
    const b = opts(s, new MockProvider([[endRound]]));
    const [ra, rb] = await Promise.all([maybeFireProactive(a), maybeFireProactive(b)]);
    expect([ra.fired, rb.fired].filter(Boolean).length).toBe(1); // exactly one
    expect(a.provider.requests.length + b.provider.requests.length).toBe(1);
  });

  test('no-op while a reactive turn is active', async () => {
    setProactiveDetectorForTests(() => ({ intent: 'spontaneous', seed: 's', debounceKey: 'after_night' }));
    const s = getSession('default');
    idle(s);
    s.activeTurn = 'busy';
    const o = opts(s, new MockProvider([[endRound]]));
    expect((await maybeFireProactive(o)).fired).toBe(false);
    expect(o.provider.requests.length).toBe(0);
    s.activeTurn = null;
  });

  test('debounce: the same trigger key within the window is skipped; a different key passes', async () => {
    Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'] = '1'; // take the cadence cooldown out of the picture
    const s = getSession('default');
    s.lastUserMs = Date.now() - 60 * 60_000; // well past the idle floor
    let nextKey = 'weather:rain:mild';
    setProactiveDetectorForTests(() => ({ intent: 'spontaneous', seed: 's', debounceKey: nextKey }));
    const base = Date.now();
    const fire = (nowMs: number) => maybeFireProactive(opts(s, new MockProvider([[endRound]]), nowMs));

    expect((await fire(base)).fired).toBe(true); // first: fires, stamps debounce[weather:rain:mild]
    expect((await fire(base + 10_000)).fired).toBe(false); // same key, 10s later → debounced
    nextKey = 'after_night';
    expect((await fire(base + 20_000)).fired).toBe(true); // a different key → passes
  });
});
