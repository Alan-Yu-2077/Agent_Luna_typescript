import { describe, expect, test } from 'bun:test';

// bun has no rAF globals; stop()'s mouth-release path touches them. Stub before importing the sink.
(globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame ??= () => 0;
(globalThis as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame ??= () => {};

import { WebAudioSink } from './webAudioSink';

// v0.37.4: an utterance the http voice can't speak goes to onUnspoken instead of vanishing inside
// the sink. v0.43.14 changed only what the APP does with that callback (it used to borrow the
// browser voice; it now logs and skips) — the sink's obligation to REPORT the unspoken line is
// exactly what these tests pin, and it is unchanged. Only failure-side paths run here (success
// would touch AudioContext, which bun has none of); fetchSpeech is injected.

function hardFailure(status = 500): () => Promise<ArrayBuffer> {
  return () => {
    const err = new Error(`tts request failed: ${status}`) as Error & { status?: number };
    err.status = status;
    return Promise.reject(err);
  };
}

describe('WebAudioSink — the unspoken report (v0.37.4 sink contract, v0.43.14 semantics)', () => {
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

  test('after 5 hard failures the mute window reports utterances unspoken without an http attempt', async () => {
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
    expect(unspoken).toContain('inside the mute window'); // reported, not swallowed by the sink
    expect(unspoken.length).toBe(6);
  });

  test('retryable statuses (502 during a managed swap) report THIS utterance without tripping the latch', async () => {
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
    expect(unspoken.length).toBe(8); // and every one was REPORTED rather than vanishing
  });
});

// v0.43.14 — the sink now REPORTS whether the words reached the room. Before, every line got out
// one way or another (http, or the browser voice behind it), so "the promise resolved" was a fair
// proxy for "she said it". With the fallback gone it is not, and v0.43.13's end-of-sentence
// gestures were firing into a silence nobody heard.
describe('WebAudioSink — speak reports whether it was actually voiced (v0.43.14)', () => {
  test('a hard failure resolves false', async () => {
    const sink = new WebAudioSink({ onMouth: () => {}, fetchSpeechFn: hardFailure() });
    expect(await sink.speak('never heard')).toBe(false);
  });

  test('the mute window resolves false without even attempting http', async () => {
    let attempts = 0;
    const sink = new WebAudioSink({
      onMouth: () => {},
      fetchSpeechFn: () => {
        attempts++;
        return hardFailure()();
      },
    });
    for (let i = 0; i < 5; i++) await sink.speak(`trip ${i}`);
    const before = attempts;
    expect(await sink.speak('inside the mute window')).toBe(false);
    expect(attempts).toBe(before); // no request went out
  });

  test('empty text resolves false — nothing was said', async () => {
    const sink = new WebAudioSink({ onMouth: () => {}, fetchSpeechFn: hardFailure() });
    expect(await sink.speak('   ')).toBe(false);
  });

  // A barge-in clears the queue, so the skipped task never runs. She did not say that line either,
  // and the gesture that would have followed it must not fire.
  test('a barged-in line resolves false rather than undefined', async () => {
    const sink = new WebAudioSink({ fetchSpeechFn: () => new Promise(() => {}), onMouth: () => {} });
    const first = sink.speak('interrupted');
    const queued = sink.speak('never got a turn');
    sink.stop();
    expect(await queued).toBe(false);
    void first;
  });
});
