import { describe, expect, test } from 'bun:test';
import {
  AccentDetector,
  ACCENT_MAX_PER_UTTERANCE,
  ACCENT_PEAK_FLOOR,
  ACCENT_REFRACTORY_MS,
} from './accent';

const FRAME_MS = 1000 / 60;

// A synthetic envelope: a quiet floor with peaks at known times, the shape a real utterance's
// `lip.open` has. Peaks are a few frames wide, like a syllable rather than a spike.
function envelope(opts: {
  durationMs: number;
  floor: number;
  peaks: Array<{ atMs: number; value: number }>;
  widthMs?: number;
}): Array<{ t: number; open: number }> {
  const width = opts.widthMs ?? 80;
  const out: Array<{ t: number; open: number }> = [];
  for (let t = 0; t <= opts.durationMs; t += FRAME_MS) {
    let open = opts.floor;
    for (const p of opts.peaks) {
      const d = Math.abs(t - p.atMs);
      if (d < width / 2) open = Math.max(open, p.value * Math.cos((Math.PI * d) / width));
    }
    out.push({ t, open });
  }
  return out;
}

function run(frames: Array<{ t: number; open: number }>): Array<{ t: number; strength: number }> {
  const d = new AccentDetector();
  const hits: Array<{ t: number; strength: number }> = [];
  for (const f of frames) {
    const s = d.feed(f.open, f.t);
    if (s !== null) hits.push({ t: f.t, strength: s });
  }
  return hits;
}

describe('AccentDetector — finding the stresses in an energy envelope', () => {
  test('six well-separated peaks produce exactly six stresses, each within two frames', () => {
    const peaks = [1000, 3000, 5500, 8000, 11000, 14000];
    const hits = run(
      envelope({ durationMs: 20_000, floor: 0.1, peaks: peaks.map((atMs) => ({ atMs, value: 0.8 })) }),
    );
    expect(hits.length).toBe(6);
    hits.forEach((h, i) => {
      const target = peaks[i] ?? 0;
      // The detector fires on the RISE, so it lands at or just before the crest.
      expect(h.t).toBeGreaterThan(target - 60);
      expect(h.t).toBeLessThan(target + 2 * FRAME_MS);
    });
  });

  test('two peaks inside the refractory window count as one', () => {
    const hits = run(
      envelope({
        durationMs: 6000,
        floor: 0.1,
        peaks: [{ atMs: 2000, value: 0.8 }, { atMs: 2300, value: 0.8 }],
      }),
    );
    expect(2300 - 2000).toBeLessThan(ACCENT_REFRACTORY_MS);
    expect(hits.length).toBe(1);
  });

  test('silence and throat-clearing below the floor never register', () => {
    expect(run(envelope({ durationMs: 8000, floor: 0, peaks: [] })).length).toBe(0);
    const quiet = envelope({
      durationMs: 8000,
      floor: 0.02,
      peaks: [{ atMs: 3000, value: ACCENT_PEAK_FLOOR - 0.05 }],
    });
    expect(run(quiet).length).toBe(0);
  });

  test('a slow swell with no peak is not a stress', () => {
    const frames: Array<{ t: number; open: number }> = [];
    for (let t = 0; t <= 10_000; t += FRAME_MS) frames.push({ t, open: (t / 10_000) * 0.9 });
    expect(run(frames).length).toBe(0);
  });

  // The rhythm fuse: however emphatic the delivery, one sentence does not earn twenty nods.
  test('a sentence full of peaks is capped', () => {
    const peaks = Array.from({ length: 30 }, (_, i) => ({ atMs: 800 + i * 900, value: 0.85 }));
    const hits = run(envelope({ durationMs: 30_000, floor: 0.1, peaks }));
    expect(hits.length).toBe(ACCENT_MAX_PER_UTTERANCE);
  });

  test('the cap and the baseline reset at the utterance boundary', () => {
    const d = new AccentDetector();
    const frames = envelope({
      durationMs: 30_000,
      floor: 0.1,
      peaks: Array.from({ length: 30 }, (_, i) => ({ atMs: 800 + i * 900, value: 0.85 })),
    });
    for (const f of frames) d.feed(f.open, f.t);
    expect(d.peaksThisUtterance()).toBe(ACCENT_MAX_PER_UTTERANCE);
    d.reset();
    expect(d.peaksThisUtterance()).toBe(0);
    for (const f of frames) d.feed(f.open, f.t);
    expect(d.peaksThisUtterance()).toBe(ACCENT_MAX_PER_UTTERANCE);
  });

  test('strength scales with how far above the baseline the peak reaches, and stays in 0..1', () => {
    const at = (value: number): number =>
      run(envelope({ durationMs: 5000, floor: 0.12, peaks: [{ atMs: 2000, value }] }))[0]?.strength ?? -1;
    const soft = at(0.3);
    const loud = at(0.95);
    expect(soft).toBeGreaterThanOrEqual(0);
    expect(loud).toBeLessThanOrEqual(1);
    expect(loud).toBeGreaterThan(soft);
  });

  // Frame-rate independence, for the same reason v0.43.5 made the smoothing time-based: a baseline
  // that follows per FRAME rather than per SECOND detects differently under load.
  test('the same envelope at 30 fps finds the same stresses as at 60', () => {
    const peaks = [{ atMs: 1000, value: 0.8 }, { atMs: 3000, value: 0.8 }, { atMs: 5000, value: 0.8 }];
    const at60 = run(envelope({ durationMs: 7000, floor: 0.1, peaks }));
    const frames30 = envelope({ durationMs: 7000, floor: 0.1, peaks }).filter((_, i) => i % 2 === 0);
    const at30 = run(frames30);
    expect(at30.length).toBe(at60.length);
  });
});
