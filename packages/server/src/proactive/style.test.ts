import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { isActiveness, loadStyle, resolveEffectiveCadence } from './style';

const KNOBS = [
  'LUNA_PROACTIVE_MIN_INTERVAL_MS',
  'LUNA_PROACTIVE_MIN_INTERVAL_FLOOR_MS',
  'LUNA_PROACTIVE_RENUDGE_BASE_MS',
  'LUNA_PROACTIVE_DAILY_QUOTA',
  'LUNA_PROACTIVE_DAILY_QUOTA_CEILING',
  'LUNA_PROACTIVE_NUDGE_PROB',
  'LUNA_PROACTIVE_AMBIENT_PROB',
  'LUNA_PROACTIVE_STYLE',
  'LUNA_PROACTIVE_ACTIVENESS',
];

beforeEach(() => {
  for (const k of KNOBS) delete Bun.env[k];
});
afterEach(() => {
  for (const k of KNOBS) delete Bun.env[k];
});

describe('resolveEffectiveCadence (activeness lever, v0.24.2)', () => {
  test('balanced reproduces the raw base knobs (behaviour unchanged by default)', () => {
    const c = resolveEffectiveCadence({ activeness: 'balanced' });
    expect(c.minIntervalMs).toBe(300_000);
    expect(c.renudgeBaseMs).toBe(300_000);
    expect(c.dailyQuota).toBe(5);
    expect(c.nudgeProb).toBe(1.0);
    expect(c.ambientProb).toBeCloseTo(0.06); // v0.29.1: 0.12 → 0.06
  });

  test('clingy raises eagerness but the quota stays clamped to the ceiling and prob to 1', () => {
    const c = resolveEffectiveCadence({ activeness: 'clingy' });
    expect(c.minIntervalMs).toBe(180_000); // 300k × 0.6
    expect(c.dailyQuota).toBe(6); // round(5×1.6)=8 → clamped to ceiling 6
    expect(c.nudgeProb).toBe(1.0); // 1.0×1.35 → clamped to 1
    expect(c.ambientProb).toBeCloseTo(0.081); // v0.29.1: 0.06×1.35
  });

  test('aloof lowers eagerness', () => {
    const c = resolveEffectiveCadence({ activeness: 'aloof' });
    expect(c.minIntervalMs).toBe(540_000); // 300k × 1.8
    expect(c.dailyQuota).toBe(2); // round(5×0.4)
    expect(c.nudgeProb).toBeCloseTo(0.45);
  });

  test('the min-interval floor clamps a small operator base (the lever cannot breach it)', () => {
    Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'] = '100000'; // 100s base
    // clingy ×0.6 = 60s, but the 120s floor holds
    expect(resolveEffectiveCadence({ activeness: 'clingy' }).minIntervalMs).toBe(120_000);
  });
});

// v0.32.4: activeness is now an owner setting read from LUNA_PROACTIVE_ACTIVENESS (settings-panel
// pin lands in Bun.env at boot), NOT a Luna-writable DB row. saveStyle + voice notes are retired.
describe('loadStyle (owner setting, v0.32.4)', () => {
  test('isActiveness guards the level', () => {
    expect(isActiveness('clingy')).toBe(true);
    expect(isActiveness('unhinged')).toBe(false);
  });

  test('default is balanced when the env is unset', () => {
    expect(loadStyle()).toEqual({ activeness: 'balanced' });
  });

  test('reads the operator activeness from the env pin', () => {
    Bun.env['LUNA_PROACTIVE_ACTIVENESS'] = 'clingy';
    expect(loadStyle()).toEqual({ activeness: 'clingy' });
    Bun.env['LUNA_PROACTIVE_ACTIVENESS'] = 'aloof';
    expect(loadStyle()).toEqual({ activeness: 'aloof' });
  });

  test('degrades a corrupt env value to balanced', () => {
    Bun.env['LUNA_PROACTIVE_ACTIVENESS'] = 'bogus';
    expect(loadStyle().activeness).toBe('balanced');
  });
});
