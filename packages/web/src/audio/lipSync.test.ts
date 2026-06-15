import { describe, expect, test } from 'bun:test';
import { LipSync } from './lipSync';

const DT = 0.016; // ~60fps

function drive(lip: LipSync, rms: number, frames: number): { open: number; form: number; shrug: number; pucker: number } {
  let f = { open: 0, form: 0, shrug: 0, pucker: 0 };
  for (let i = 0; i < frames; i++) {
    lip.ingest(rms);
    f = lip.tick(DT);
  }
  return f;
}

describe('LipSync (Python port)', () => {
  test('loud audio opens the mouth, then silence closes it', () => {
    const lip = new LipSync({ rng: () => 0.5 }); // deterministic mid-step picks
    let f = drive(lip, 0.1, 40); // rms 0.1 × gain 32 → loud
    expect(f.open).toBeGreaterThan(0.3);
    f = drive(lip, 0, 100); // silence
    expect(f.open).toBeLessThan(0.15);
  });

  test('silent / sub-floor energy keeps the mouth closed', () => {
    const lip = new LipSync({ rng: () => 0 }); // rest branch picks target 0
    const f = drive(lip, 0.00005, 40);
    expect(f.open).toBeLessThan(0.1);
  });

  test('drives all four mouth params, shaped away from rest while speaking', () => {
    const lip = new LipSync({ rng: () => 0.5 });
    const f = drive(lip, 0.1, 40);
    // form opens up from its 0.12 rest; pucker moves off its 0.6 rest
    expect(f.form).toBeGreaterThan(0.2);
    expect(f.pucker).toBeLessThan(0.4);
    // all within the Python clamps
    expect(f.form).toBeLessThanOrEqual(0.48);
    expect(f.pucker).toBeGreaterThanOrEqual(-1);
    expect(f.shrug).toBeGreaterThanOrEqual(-0.04);
    expect(f.shrug).toBeLessThanOrEqual(0.4);
  });

  test('stochastic stepping varies the open target (not a flat follower)', () => {
    let n = 0;
    const seq = [0.1, 0.9, 0.4, 0.72, 0.2, 0.95, 0.05, 0.6];
    const lip = new LipSync({ rng: () => seq[n++ % seq.length] ?? 0.5 });
    const distinct = new Set<number>();
    for (let i = 0; i < 60; i++) {
      lip.ingest(0.1);
      distinct.add(Math.round(lip.tick(DT).open * 100));
    }
    expect(distinct.size).toBeGreaterThan(3);
  });

  test('reset closes the mouth', () => {
    const lip = new LipSync({ rng: () => 0.5 });
    drive(lip, 0.1, 30);
    lip.reset();
    expect(lip.tick(DT).open).toBeLessThan(0.05);
  });
});
