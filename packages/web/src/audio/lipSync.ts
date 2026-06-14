// RMS → mouth-open, ported from Python js/runtime/lip-sync.js (the energy
// signal: gain → EMA baseline → pulse/onset contrast → gate → decay → smooth).
// Pure (no Web Audio), so it's unit-tested. The random open-target stepping and
// form/pucker/shrug shaping from the original are deferred; we drive mouth-open.

export class LipSync {
  private energyAvg = 0;
  private lastMapped = 0;
  private pending = 0;
  private current = 0;

  constructor(
    private readonly gain = 32,
    private readonly floor = 0.02,
    private readonly smoothing = 0.5,
  ) {}

  ingest(rms: number): number {
    const mapped = Math.max(0, Math.min(1, rms * this.gain));
    this.energyAvg += (mapped - this.energyAvg) * 0.08;
    const pulse = Math.max(0, mapped - this.energyAvg * 0.92);
    const onset = Math.max(0, mapped - this.lastMapped);
    const contrasted = pulse * 4.8 + onset * 3.2 + mapped * 0.12;
    const gated = contrasted < this.floor ? 0 : Math.min(1, contrasted);
    this.pending = Math.max(this.pending * 0.82, gated);
    this.current += (this.pending - this.current) * this.smoothing;
    this.lastMapped = mapped;
    return this.current;
  }

  reset(): void {
    this.energyAvg = 0;
    this.lastMapped = 0;
    this.pending = 0;
    this.current = 0;
  }
}
