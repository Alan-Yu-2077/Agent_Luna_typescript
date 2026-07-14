import { describe, expect, test } from 'bun:test';

// bun has no rAF globals; stop()'s mouth-release path touches them. Stub before importing the sink.
(globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame ??= () => 0;
(globalThis as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame ??= () => {};

import { WebAudioSink } from './webAudioSink';

// v0.37.4: the two-rung fallback ladder — an utterance the http voice can't speak goes to
// onUnspoken (the browser-voice rung) instead of being silently dropped. Only failure-side paths
// run here (success would touch AudioContext, which bun has none of); fetchSpeech is injected.

function hardFailure(status = 500): () => Promise<ArrayBuffer> {
  return () => {
    const err = new Error(`tts request failed: ${status}`) as Error & { status?: number };
    err.status = status;
    return Promise.reject(err);
  };
}

describe('WebAudioSink fallback ladder', () => {
  test('a hard failure hands the utterance to onUnspoken — never silently dropped', async () => {
    const unspoken: string[] = [];
    const sink = new WebAudioSink({
      onMouth: () => {},
      onUnspoken: (t) => unspoken.push(t),
      fetchSpeechFn: hardFailure(),
    });
    await sink.speak('hello there');
    expect(unspoken).toEqual(['hello there']);
  });

  test('a barge-in abort is NOT unspoken (interrupted words stay interrupted)', async () => {
    const unspoken: string[] = [];
    const sink = new WebAudioSink({
      onMouth: () => {},
      onUnspoken: (t) => unspoken.push(t),
      fetchSpeechFn: (_text, opts) =>
        new Promise((_res, rej) => {
          opts?.signal?.addEventListener('abort', () => {
            const e = new Error('aborted') as Error & { name: string };
            e.name = 'AbortError';
            rej(e);
          });
        }),
    });
    const p = sink.speak('interrupted');
    sink.stop();
    await p;
    expect(unspoken).toEqual([]);
  });

  test('after 5 hard failures the mute window routes utterances straight to the fallback rung', async () => {
    const unspoken: string[] = [];
    let fetches = 0;
    const sink = new WebAudioSink({
      onMouth: () => {},
      onUnspoken: (t) => unspoken.push(t),
      fetchSpeechFn: () => {
        fetches += 1;
        return hardFailure()();
      },
    });
    for (let i = 0; i < 5; i++) await sink.speak(`u${i}`); // trip the latch
    const before = fetches;
    await sink.speak('inside the mute window');
    expect(fetches).toBe(before); // no http attempt — muted
    expect(unspoken).toContain('inside the mute window'); // but still spoken via the fallback
    expect(unspoken.length).toBe(6);
  });

  test('retryable statuses (502 during a managed swap) still fall back for THIS utterance without tripping the latch', async () => {
    const unspoken: string[] = [];
    let fetches = 0;
    const sink = new WebAudioSink({
      onMouth: () => {},
      onUnspoken: (t) => unspoken.push(t),
      fetchSpeechFn: () => {
        fetches += 1;
        return hardFailure(502)();
      },
    });
    for (let i = 0; i < 8; i++) await sink.speak(`r${i}`);
    expect(fetches).toBe(8); // 502s never accrue to the mute latch — every utterance retried http
    expect(unspoken.length).toBe(8); // and every one was still spoken via the fallback
  });
});
