import { describe, expect, test } from 'bun:test';
import { LipSync } from './lipSync';

describe('LipSync', () => {
  test('loud audio opens the mouth, then silence closes it', () => {
    const lip = new LipSync();
    let open = 0;
    for (let i = 0; i < 30; i++) open = lip.ingest(0.1); // rms 0.1 × gain 32 → loud
    expect(open).toBeGreaterThan(0.3);
    for (let i = 0; i < 80; i++) open = lip.ingest(0); // silence
    expect(open).toBeLessThan(0.1);
  });

  test('sub-floor energy keeps the mouth closed', () => {
    const lip = new LipSync();
    let open = 0;
    for (let i = 0; i < 30; i++) open = lip.ingest(0.00005);
    expect(open).toBeLessThan(0.05);
  });

  test('reset closes the mouth', () => {
    const lip = new LipSync();
    for (let i = 0; i < 20; i++) lip.ingest(0.1);
    lip.reset();
    expect(lip.ingest(0)).toBe(0);
  });
});
