// v0.28.1 (Initiative 20): pet-mode framing math, pure so it can be unit-tested without WebGL.
// Windowed mode height-fits the FULL body (0.92 of the host, centered — see pixiLive2DSink.fit()).
// Pet mode instead shows a fixed HALF-BODY portrait: scaled up past the full-body fit and anchored
// near the top, so only head→torso fills the window (feet clip below) and it re-fits to any window
// size (v0.28.2 resizes the window; this derives everything from live host dims, never a fixed size).

export type Framing = { scale: number; baseX: number; baseY: number };

// Multiplier on the full-body height-fit — >1 crops tighter (more of the body off-frame). ~1.7
// lands head-to-waist for the reference model; tuned in the isolated preview.
const PET_ZOOM = 1.7;
// Head crown as a fraction of host height from the top (small headroom; the rest of the body runs
// off the bottom).
const PET_TOP = 0.06;

export function petFraming(
  hostW: number,
  hostH: number,
  naturalW: number,
  naturalH: number,
): Framing {
  // Defensive: a model that failed to measure (0 dims) would make scale NaN/Infinity and break
  // model.scale.set()/setBase(). Live2DModel.from() validates dims, so this is latent — but a pure
  // helper should never emit NaN. Fall back to an untouched, centered model.
  if (!(naturalW > 0) || !(naturalH > 0) || !(hostW > 0) || !(hostH > 0)) {
    return { scale: 1, baseX: 0, baseY: 0 };
  }
  const fullBodyScale = (hostH * 0.92) / naturalH; // the windowed height-fit
  const scale = fullBodyScale * PET_ZOOM;
  const scaledW = naturalW * scale;
  return {
    scale,
    baseX: (hostW - scaledW) / 2, // center horizontally (arms may clip at the sides — fine for a bust)
    baseY: hostH * PET_TOP, // top-anchored: head near the top, feet clip below
  };
}
