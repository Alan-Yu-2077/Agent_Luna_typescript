import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { isActiveness, loadStyle, resolveEffectiveCadence, saveStyle } from './style';

const KNOBS = [
  'LUNA_PROACTIVE_MIN_INTERVAL_MS',
  'LUNA_PROACTIVE_MIN_INTERVAL_FLOOR_MS',
  'LUNA_PROACTIVE_RENUDGE_BASE_MS',
  'LUNA_PROACTIVE_DAILY_QUOTA',
  'LUNA_PROACTIVE_DAILY_QUOTA_CEILING',
  'LUNA_PROACTIVE_NUDGE_PROB',
  'LUNA_PROACTIVE_AMBIENT_PROB',
  'LUNA_PROACTIVE_STYLE',
];

let db: Database;
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  for (const k of KNOBS) delete Bun.env[k];
});
afterEach(() => {
  setMemoryDb(null);
  db.close(false);
});

describe('resolveEffectiveCadence (activeness lever, v0.24.2)', () => {
  test('balanced reproduces the raw base knobs (behaviour unchanged by default)', () => {
    const c = resolveEffectiveCadence({ activeness: 'balanced', voiceNotes: '' });
    expect(c.minIntervalMs).toBe(300_000);
    expect(c.renudgeBaseMs).toBe(300_000);
    expect(c.dailyQuota).toBe(5);
    expect(c.nudgeProb).toBe(1.0);
    expect(c.ambientProb).toBeCloseTo(0.12);
  });

  test('clingy raises eagerness but the quota stays clamped to the ceiling and prob to 1', () => {
    const c = resolveEffectiveCadence({ activeness: 'clingy', voiceNotes: '' });
    expect(c.minIntervalMs).toBe(180_000); // 300k × 0.6
    expect(c.dailyQuota).toBe(6); // round(5×1.6)=8 → clamped to ceiling 6
    expect(c.nudgeProb).toBe(1.0); // 1.0×1.35 → clamped to 1
    expect(c.ambientProb).toBeCloseTo(0.162); // 0.12×1.35
  });

  test('aloof lowers eagerness', () => {
    const c = resolveEffectiveCadence({ activeness: 'aloof', voiceNotes: '' });
    expect(c.minIntervalMs).toBe(540_000); // 300k × 1.8
    expect(c.dailyQuota).toBe(2); // round(5×0.4)
    expect(c.nudgeProb).toBeCloseTo(0.45);
  });

  test('the min-interval floor clamps a small operator base (the lever cannot breach it)', () => {
    Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'] = '100000'; // 100s base
    // clingy ×0.6 = 60s, but the 120s floor holds
    expect(resolveEffectiveCadence({ activeness: 'clingy', voiceNotes: '' }).minIntervalMs).toBe(
      120_000,
    );
  });
});

describe('loadStyle / saveStyle (v0.24.2)', () => {
  test('isActiveness guards the level', () => {
    expect(isActiveness('clingy')).toBe(true);
    expect(isActiveness('unhinged')).toBe(false);
  });

  test('default is balanced with no notes', () => {
    expect(loadStyle()).toEqual({ activeness: 'balanced', voiceNotes: '' });
  });

  test('saveStyle persists + trims; a partial patch keeps the rest', () => {
    saveStyle({ activeness: 'clingy', voiceNotes: '  warm and a bit teasing  ' });
    expect(loadStyle()).toEqual({ activeness: 'clingy', voiceNotes: 'warm and a bit teasing' });
    saveStyle({ activeness: 'aloof' }); // voice notes untouched
    expect(loadStyle()).toEqual({ activeness: 'aloof', voiceNotes: 'warm and a bit teasing' });
  });

  test('loadStyle degrades a corrupt persisted activeness to balanced', () => {
    db.prepare("UPDATE proactive_style SET activeness = 'bogus' WHERE id = 1").run();
    expect(loadStyle().activeness).toBe('balanced');
  });
});
