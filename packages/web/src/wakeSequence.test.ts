import { describe, expect, test } from 'bun:test';
import { runSequence, SLEEP_STEPS, SLEEP_TOTAL_MS, WAKE_STEPS, WAKE_TOTAL_MS } from './wakeSequence';
import type { Live2DSink } from './sinks';

function recorder(): { sink: Live2DSink; calls: Array<[string, ...unknown[]]> } {
  const calls: Array<[string, ...unknown[]]> = [];
  return {
    calls,
    sink: {
      setExpression: () => {},
      setState: (s) => calls.push(['setState', s]),
      setMouth: () => {},
      clear: () => {},
      playAction: (name) => calls.push(['playAction', name]),
      pulse: (pose, ms) => calls.push(['pulse', pose, ms]),
      triggerEmotion: (id) => calls.push(['triggerEmotion', id]),
    },
  };
}

describe('the wake sequence — choreography over existing layers (v0.44.1)', () => {
  test('four beats, in order, at the approved offsets', () => {
    const { sink, calls } = recorder();
    const scheduled: Array<{ ms: number; fn: () => void }> = [];
    runSequence(sink, WAKE_STEPS, (fn, ms) => {
      scheduled.push({ ms, fn });
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
    // The 0ms beat fires synchronously — she must visibly START waking on the click frame.
    expect(calls).toEqual([['setState', 'neutral']]);
    expect(scheduled.map((s) => s.ms)).toEqual([550, 950, 1300]);
    for (const s of scheduled) s.fn();
    expect(calls).toEqual([
      ['setState', 'neutral'],
      ['playAction', 'headLiftAlert'],
      ['pulse', { browLY: 0.06, browRY: 0.06 }, 500],
      ['triggerEmotion', 'tender'],
    ]);
  });

  test('every offset fits inside the declared 1.8s window', () => {
    for (const s of WAKE_STEPS) expect(s.at).toBeLessThan(WAKE_TOTAL_MS);
  });

  test('a sink without the optional methods wakes without throwing', () => {
    const bare: Live2DSink = { setExpression: () => {}, setState: () => {}, setMouth: () => {}, clear: () => {} };
    const scheduled: Array<() => void> = [];
    expect(() => {
      runSequence(bare, WAKE_STEPS, (fn) => {
        scheduled.push(fn);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });
      scheduled.forEach((f) => f());
    }).not.toThrow();
  });

  test('cancel drops the beats that have not fired', () => {
    const { sink, calls } = recorder();
    const seq = runSequence(sink, WAKE_STEPS); // real timers this time
    seq.cancel();
    expect(calls).toEqual([['setState', 'neutral']]); // only the synchronous beat happened
  });
});

describe('the sleep sequence — the way back down', () => {
  // One call, and the layers do the rest: the state bias lowers the head at the slow posture rate,
  // and `sleeping` holds the lids shut. The v0.43.0 eyelid invariant is pinned where it lives —
  // faceVm.test.ts asserts sleeping closes the eyes and no persistent layer fights the blink.
  test('a single beat: setState(sleeping), immediately', () => {
    const { sink, calls } = recorder();
    runSequence(sink, SLEEP_STEPS);
    expect(calls).toEqual([['setState', 'sleeping']]);
  });

  test('going down is quicker than waking — leaving should not feel like a ceremony', () => {
    expect(SLEEP_TOTAL_MS).toBeLessThan(WAKE_TOTAL_MS);
  });
});
