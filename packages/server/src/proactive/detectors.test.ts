import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { setMemoryDb } from '../memory/sessionStore';
import { getSession, resetSessions } from '../turn/session';
import { type Cadence, dateKey } from './cadence';
import { evaluateDetectors, type DetectorCtx } from './detectors';

const NOW = 1_700_000_000_000;
const baseCadence: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
  slotsUsed: 0,
  slotsDate: '',
};

// No memory DB → lastInteractionMs(session) returns null for a fresh (turnSeq 0)
// session → afterANightOpening is false → the afterNight detector is null. So these
// tests isolate the scheduledWindow detector + the registry ordering.
beforeEach(() => {
  setMemoryDb(null);
  resetSessions();
});
afterEach(() => {
  delete Bun.env['LUNA_PROACTIVE_SLOTS'];
  resetSessions();
});

const ctx = (nowHour: number, cadence: Cadence = baseCadence): DetectorCtx => ({
  session: getSession('default'),
  cadence,
  nowMs: NOW,
  nowHour,
});

describe('proactive detectors (v0.22.1)', () => {
  test('scheduledWindow fires at a configured hour when the slot is unconsumed', () => {
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11,20';
    const hit = evaluateDetectors(ctx(11));
    expect(hit?.debounceKey).toBe('slot:11');
    expect(hit?.intent).toBe('spontaneous');
  });

  test('scheduledWindow is null off-slot', () => {
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11,20';
    expect(evaluateDetectors(ctx(9))).toBeNull();
  });

  test('scheduledWindow is null when that slot already fired today', () => {
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11';
    const consumed: Cadence = { ...baseCadence, slotsUsed: 1 << 11, slotsDate: dateKey(NOW) };
    expect(evaluateDetectors(ctx(11, consumed))).toBeNull();
    // ...but a stale slotsDate (yesterday) does not count as consumed
    const stale: Cadence = { ...baseCadence, slotsUsed: 1 << 11, slotsDate: '2000-01-01' };
    expect(evaluateDetectors(ctx(11, stale))?.debounceKey).toBe('slot:11');
  });

  test('no slots + no prior interaction → no detector fires (afterNight null)', () => {
    expect(evaluateDetectors(ctx(11))).toBeNull();
  });
});
