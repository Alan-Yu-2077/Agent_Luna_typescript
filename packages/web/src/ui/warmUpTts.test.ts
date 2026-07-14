import { afterEach, describe, expect, test } from 'bun:test';
import { warmUpTts } from './bootGate';

// v0.37.1: the managed-wait semantics of the boot gate's warm-up — driven through a scripted global
// fetch (no DOM, no server) with injected fast timings.

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Script = {
  health: Array<{ status?: number; ready?: boolean; state?: string }>; // last entry repeats
  speak: 'reject' | 'fail' | 'ok';
};

function scriptFetch(s: Script): { speakAttempts: () => number } {
  let healthN = 0;
  let speakN = 0;
  const fake = (input: unknown): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/health')) {
      const h = s.health[Math.min(healthN, s.health.length - 1)]!;
      healthN += 1;
      if (h.status === 502) return Promise.resolve(new Response('no upstream', { status: 502 }));
      return Promise.resolve(
        new Response(JSON.stringify({ backend: { ready: h.ready ?? false, state: h.state } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (url.endsWith('/speak')) {
      speakN += 1;
      if (s.speak === 'reject') return Promise.reject(new Error('ECONNREFUSED'));
      if (s.speak === 'fail') return Promise.resolve(new Response('down', { status: 502 }));
      return Promise.resolve(new Response(new ArrayBuffer(4), { status: 200 }));
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  };
  globalThis.fetch = fake as typeof fetch;
  return { speakAttempts: () => speakN };
}

const FAST = { pollMs: 5, synthRetryMs: 5, deadlineMs: 400, synthTimeoutMs: 100 };

describe('warmUpTts — managed-wait semantics (标准 2)', () => {
  test('a managed cold start WAITS: refused warm synths retry while health says starting, ready wins', async () => {
    const s = scriptFetch({
      health: [{ state: 'starting' }, { state: 'starting' }, { state: 'starting' }, { ready: true, state: 'ready' }],
      speak: 'reject',
    });
    const states: Array<string | undefined> = [];
    const res = await warmUpTts('/api/tts', (_t, st) => states.push(st), FAST);
    expect(res).toBe('ready'); // did NOT fail fast on the refused synths
    expect(s.speakAttempts()).toBeGreaterThan(1); // the synth actually retried
    expect(states).toContain('starting'); // the caller saw the managed state (drives the skip delay)
  });

  test('gave-up on the FIRST health fails fast (the child crash-looped out before the gate mounted)', async () => {
    scriptFetch({ health: [{ state: 'gave-up' }], speak: 'reject' });
    expect(await warmUpTts('/api/tts', () => {}, FAST)).toBe('failed');
  });

  test('gave-up mid-wait fails fast instead of burning the deadline', async () => {
    scriptFetch({ health: [{ state: 'starting' }, { state: 'gave-up' }], speak: 'reject' });
    const t0 = performance.now();
    const res = await warmUpTts('/api/tts', () => {}, { ...FAST, deadlineMs: 5000 });
    expect(res).toBe('failed');
    expect(performance.now() - t0).toBeLessThan(1000); // far under the 5s deadline
  });

  test('BYO down (bare 502) still resolves unavailable fast — unmanaged semantics unchanged', async () => {
    scriptFetch({ health: [{ status: 502 }], speak: 'reject' });
    expect(await warmUpTts('/api/tts', () => {}, FAST)).toBe('unavailable');
  });

  test('already warm resolves ready without firing the synth', async () => {
    const s = scriptFetch({ health: [{ ready: true, state: 'ready' }], speak: 'reject' });
    expect(await warmUpTts('/api/tts', () => {}, FAST)).toBe('ready');
    expect(s.speakAttempts()).toBe(0);
  });

  test('an UNMANAGED synth failure keeps the old fast-fail (no retry loop for BYO)', async () => {
    const s = scriptFetch({ health: [{ state: 'idle' }], speak: 'fail' });
    expect(await warmUpTts('/api/tts', () => {}, FAST)).toBe('failed');
    expect(s.speakAttempts()).toBe(1);
  });

  test('the deadline still lifts the gate when a managed start never completes', async () => {
    scriptFetch({ health: [{ state: 'starting' }], speak: 'reject' });
    expect(await warmUpTts('/api/tts', () => {}, { ...FAST, deadlineMs: 60 })).toBe('failed');
  });
});
