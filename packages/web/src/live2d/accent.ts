// v0.43.12 — where the stresses are in what she is saying.
//
// The signal was already in hand: `LipSyncFrame.open` is a per-frame energy envelope, and it has been
// flowing through `FaceVm.setMouth` since the lip-sync landed. Nothing but the mouth ever read it.
// People do not only move their mouth when they talk — the head dips and the brows lift on a stressed
// syllable — so this finds those moments and v0.43.12's pulse layer performs them.
//
// Amplitude only. There is no F0 here, so a rising question intonation is invisible to this detector;
// v0.43.13 approximates that from the text's punctuation instead. Two independent signals, deliberately.

// Every constant that decides "was that a stress" lives here, together, because these are a feel
// judgement rather than a derivation — the owner tunes them against his own voice model with the
// workbench indicator, and a value scattered into the engine is a value he cannot find.
export const ACCENT_BASELINE_TAU_MS = 600; // how fast the rolling baseline follows the envelope
export const ACCENT_PEAK_RATIO = 1.6; // how far above baseline counts as a stress
export const ACCENT_PEAK_FLOOR = 0.25; // absolute floor, so breath and room noise never qualify
export const ACCENT_REFRACTORY_MS = 550; // no second stress inside this window — else she pecks
export const ACCENT_MAX_PER_UTTERANCE = 6; // a rhythm fuse: no sentence earns more than this

// How much louder than baseline saturates the strength scale. 3x baseline is already a shout.
const ACCENT_FULL_RATIO = 3;

export class AccentDetector {
  private baseline = 0;
  private lastPeakAt = -Infinity;
  private count = 0;
  private lastAt = -1;

  // Returns the stress strength in 0..1, or null when this frame is not a stress.
  feed(open: number, now: number): number | null {
    const dt = this.lastAt < 0 ? 1 / 60 : Math.max(0, (now - this.lastAt) / 1000);
    this.lastAt = now;

    const previousBaseline = this.baseline;
    // Exponential baseline over real elapsed time — same shape as v0.43.5's `approach`, and for the
    // same reason: a per-frame coefficient would make the detector frame-rate dependent.
    const k = 1 - Math.exp(-dt / (ACCENT_BASELINE_TAU_MS / 1000));
    this.baseline += (open - this.baseline) * k;

    if (this.count >= ACCENT_MAX_PER_UTTERANCE) return null;
    if (now - this.lastPeakAt < ACCENT_REFRACTORY_MS) return null;
    if (open < ACCENT_PEAK_FLOOR) return null;
    // Compared against the baseline BEFORE this frame folded into it: a loud frame drags the baseline
    // up, and measuring against the dragged value is how a real peak gets quietly discounted.
    if (previousBaseline <= 0 || open < previousBaseline * ACCENT_PEAK_RATIO) return null;

    this.lastPeakAt = now;
    this.count += 1;
    const ratio = open / previousBaseline;
    const span = ACCENT_FULL_RATIO - ACCENT_PEAK_RATIO;
    return Math.max(0, Math.min(1, (ratio - ACCENT_PEAK_RATIO) / span));
  }

  // One utterance's worth of state. The caller resets on `setMouth(null)`, i.e. the boundary the
  // audio sink already publishes between sentences.
  reset(): void {
    this.baseline = 0;
    this.lastPeakAt = -Infinity;
    this.count = 0;
    this.lastAt = -1;
  }

  peaksThisUtterance(): number {
    return this.count;
  }
}
