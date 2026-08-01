import { describe, expect, test } from 'bun:test';
import { FaceVm, PULSE_MAX_HEAD_DEG, approach, type FaceVmOptions, type ParamWriter } from './faceVm';
import { AffectState } from './affect';
import { ACTIONS, EMOTIONS, FACE_PARAM_GAIN, timelineFor } from './faceData';
import { FACE_VM_PARAM_MAP, clampStateValue, type FaceStateKey } from './paramMap';

function recorder(): { writer: ParamWriter; last: Map<string, number> } {
  const last = new Map<string, number>();
  return { writer: { setParam: (id, v) => last.set(id, v) }, last };
}
function run(vm: FaceVm, from: number, to: number, dt = 16): void {
  for (let t = from; t <= to; t += dt) vm.tick(t);
}

describe('FaceVm — emotion engine', () => {
  test('an expression reaches its perform pose + fires its overlay', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setExpression('shy_softness', 1); // → shy (mouthPucker −0.32, 脸红 overlay)
    run(vm, 0, 3000); // past intro (980ms) into perform
    expect(last.get('ParamMouthpucker') ?? 0).toBeLessThan(-0.15);
    expect(last.get('Paramsmileshy') ?? 0).toBeGreaterThan(0.5);
  });

  test('steady_presence is the baseline — no emotion, overlays stay 0', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setExpression('steady_presence');
    run(vm, 0, 1000);
    expect(last.get('Paramsmileshy') ?? 0).toBe(0);
    expect(last.get('Paramheilian') ?? 0).toBe(0);
  });

  test('an emotion releases after its timeline', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setExpression('shy_softness', 1);
    run(vm, 0, 3000);
    expect(last.get('ParamMouthpucker') ?? 0).toBeLessThan(-0.15);
    run(vm, 3016, 12000); // past perform(5600)+outro(1300) → cleared
    expect(Math.abs(last.get('ParamMouthpucker') ?? 0)).toBeLessThan(0.05);
  });

  test('a lip-sync frame owns the mouth (overrides emotion, drives 4 params)', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setState('speaking');
    vm.setMouth({ open: 0.8, form: 0.2, shrug: 0.1, pucker: -0.3 });
    run(vm, 0, 2000);
    // written raw (lip-sync already smoothed) — exact, not eased
    expect(last.get('ParamMouthOpenY') ?? 0).toBe(0.8);
    expect(last.get('ParamMouthForm') ?? 0).toBe(0.2);
    expect(last.get('ParamMouthpucker') ?? 0).toBe(-0.3);
  });

  test('clearing the lip frame releases the mouth back toward rest', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setMouth({ open: 0.9, form: 0.3, shrug: 0.1, pucker: -0.4 });
    run(vm, 0, 500);
    vm.setMouth(null);
    run(vm, 516, 3000);
    expect(last.get('ParamMouthOpenY') ?? 1).toBeLessThan(0.1);
  });

  test('sleeping closes the eyes', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setState('sleeping');
    run(vm, 0, 4000);
    expect(last.get('ParamEyeOpenL') ?? 1).toBeLessThan(0.1);
  });

  test('head/body pose writes only via flushPose (pre-physics), not tick', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setState('sleeping'); // STATE_BIAS: headPitch -10 (→ ParamAngleY), headRoll 6
    run(vm, 0, 2000);
    expect(last.has('ParamAngleY')).toBe(false); // tick smooths pose but does not write it
    vm.flushPose();
    expect(Math.abs(last.get('ParamAngleY') ?? 0)).toBeGreaterThan(2); // now written from cur
  });

  test('triggerEmotion plays a named preset directly; bad id is a no-op', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    expect(vm.listEmotions()).toContain('shy');
    vm.triggerEmotion('does-not-exist'); // guarded — must not throw or queue
    run(vm, 0, 100);
    vm.triggerEmotion('shy', 1);
    run(vm, 116, 3000);
    expect(last.get('Paramsmileshy') ?? 0).toBeGreaterThan(0.5);
  });

  test('emotion intensity scales expression strength', () => {
    const full = recorder();
    const fvm = new FaceVm(full.writer, { rng: () => 0.5 });
    fvm.setExpression('annoyed_resistance', 1);
    run(fvm, 0, 3000);
    const half = recorder();
    const hvm = new FaceVm(half.writer, { rng: () => 0.5 });
    hvm.setExpression('annoyed_resistance', 0.5);
    run(hvm, 0, 3000);
    expect(Math.abs(full.last.get('ParamMouthForm') ?? 0)).toBeGreaterThan(
      Math.abs(half.last.get('ParamMouthForm') ?? 0),
    );
  });
});

describe('FaceVm — idle profiles', () => {
  const rng = (): number => 0.5; // deterministic look-wander for tests

  test('the awake idle drives body sway in neutral (written via flushPose)', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng });
    run(vm, 0, 2000);
    vm.flushPose();
    const moved = ['ParamAngleZ', 'ParamBodyAngleZ', 'ParamBodyAngleY'].some(
      (p) => Math.abs(last.get(p) ?? 0) > 0.5,
    );
    expect(moved).toBe(true);
  });

  test('different profiles produce different motion at the same clock', () => {
    const a = recorder();
    const va = new FaceVm(a.writer, { rng, idleProfile: 'cuteSwayV1' });
    const b = recorder();
    const vb = new FaceVm(b.writer, { rng, idleProfile: 'peekyIdleV1' });
    run(va, 0, 1500);
    va.flushPose();
    run(vb, 0, 1500);
    vb.flushPose();
    const diff = ['ParamAngleX', 'ParamAngleZ', 'ParamBodyAngleZ'].some(
      (p) => Math.abs((a.last.get(p) ?? 0) - (b.last.get(p) ?? 0)) > 0.5,
    );
    expect(diff).toBe(true);
  });

  test('setIdleProfile switches the active profile; an unknown id is a no-op', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng });
    expect(vm.getIdleProfile()).toBe('defaultIdleV1');
    vm.setIdleProfile('does-not-exist'); // guarded
    expect(vm.getIdleProfile()).toBe('defaultIdleV1');
    vm.setIdleProfile('sweetBounceV1');
    expect(vm.getIdleProfile()).toBe('sweetBounceV1');
    expect(vm.listIdleProfiles().map((p) => p.id)).toContain('shyDriftV1');
  });

  test('the idle wanders the gaze only when gaze-follow is off', () => {
    const on = recorder();
    const von = new FaceVm(on.writer, { rng, gazeActive: true });
    run(von, 0, 1500);
    expect(on.last.has('ParamEyeBallX')).toBe(false); // mouse owns the eyes

    const off = recorder();
    const voff = new FaceVm(off.writer, { rng: () => 0.9, gazeActive: false });
    run(voff, 0, 1500);
    expect(off.last.has('ParamEyeBallX')).toBe(true); // idle wanders the gaze
  });

  test('the sleeping state suppresses the awake idle (no idle gaze wander)', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.9, gazeActive: false, idleProfile: 'sweetBounceV1' });
    vm.setState('sleeping');
    run(vm, 0, 1500);
    expect(last.has('ParamEyeBallX')).toBe(false); // idle is gated off while sleeping
  });
});

// --- v0.42.1: the continuous mood undertone -------------------------------------------------

// Record the FULL parameter stream (every write, in order) so "unchanged" can be asserted exactly
// rather than by sampling a few ids.
function streamRecorder(): { writer: ParamWriter; stream: string[] } {
  const stream: string[] = [];
  return { writer: { setParam: (id, v) => stream.push(`${id}=${v.toFixed(9)}`) }, stream };
}

// `ambient: 0` so the mood contributes exactly nothing until it is nudged — the byte-identity
// regressions below are about the LAYER being silent, not about drift being absent (drift has its
// own coverage in affect.test.ts, and it is deliberately alive in production).
function runWithAffect(on: boolean, drive?: (vm: FaceVm) => void): string[] {
  const { writer, stream } = streamRecorder();
  const affect = new AffectState({ ambient: 0 });
  const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => on });
  drive?.(vm);
  run(vm, 0, 4000);
  return stream;
}

describe('FaceVm — affect undertone (v0.42.1)', () => {
  test('flag OFF: the parameter stream is byte-identical to having no affect state at all', () => {
    const { writer, stream } = streamRecorder();
    const plain = new FaceVm(writer, { rng: () => 0.5 }); // no affect wired — the pre-v0.42.1 shape
    plain.setExpression('bright_delight', 1);
    run(plain, 0, 4000);

    const gated = runWithAffect(false, (vm) => vm.setExpression('bright_delight', 1));
    expect(gated).toEqual(stream);
  });

  test('flag ON but the mood at rest: still byte-identical (enabling it cannot disturb a resting face)', () => {
    const { writer, stream } = streamRecorder();
    const plain = new FaceVm(writer, { rng: () => 0.5 });
    run(plain, 0, 4000);

    const resting = runWithAffect(true); // ticked, never nudged
    expect(resting).toEqual(stream);
  });

  test('flag ON after a message: the rendered stream genuinely changes', () => {
    const off = runWithAffect(false, (vm) => vm.setExpression('bright_delight', 1));
    const on = runWithAffect(true, (vm) => vm.setExpression('bright_delight', 1));
    expect(on).not.toEqual(off);
    // More channels clear the write threshold once a mood rides under the clip.
    expect(on.length).toBeGreaterThan(off.length);
    // DIRECTION is asserted post-clip in the next test, not here: while a clip performs it OWNS the
    // expressive channels, so the undertone is (correctly) suppressed on exactly those params.
  });

  test('THE POINT: the mood is still there long after the clip has ended', () => {
    // bright_delight → `adorable`; run far past intro+perform+outro so the clip is provably inactive.
    const { writer, last } = recorder();
    const affect = new AffectState();
    const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => true });
    vm.setExpression('bright_delight', 1);
    run(vm, 0, 30_000);
    const withMood = last.get('ParamMouthForm') ?? 0;

    const { writer: w2, last: l2 } = recorder();
    const plain = new FaceVm(w2, { rng: () => 0.5 });
    plain.setExpression('bright_delight', 1);
    run(plain, 0, 30_000);
    const withoutMood = l2.get('ParamMouthForm') ?? 0;

    expect(withMood).toBeGreaterThan(withoutMood); // she is still warm; the old engine went flat
  });

  test('lip-sync still owns the mouth regardless of mood', () => {
    const { writer, last } = recorder();
    const affect = new AffectState();
    const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => true });
    vm.setExpression('annoyed_resistance', 1);
    run(vm, 0, 2000);
    vm.setMouth({ open: 0.7, form: 0.3, shrug: 0.1, pucker: -0.2 });
    run(vm, 2000, 2200);
    expect(last.get('ParamMouthOpenY')).toBeCloseTo(0.7, 6);
    expect(last.get('ParamMouthForm')).toBeCloseTo(0.3, 6);
  });

  test('a clip that owns a channel converges to the SAME value with or without a mood', () => {
    // `shy` owns the mouth. Since v0.42.2 the smoothing rate itself is arousal-dependent, so the two
    // runs take slightly different *paths* — what must not change is where an owned channel lands.
    const pluck = (s: string[], id: string): number[] =>
      s.filter((e) => e.startsWith(`${id}=`)).map((e) => Number(e.split('=')[1]));
    const off = runWithAffect(false, (vm) => vm.setExpression('shy_softness', 1));
    const on = runWithAffect(true, (vm) => vm.setExpression('shy_softness', 1));
    const a = pluck(on, 'ParamMouthpucker');
    const b = pluck(off, 'ParamMouthpucker');
    expect(a.length).toBe(b.length);
    expect(a[a.length - 1]!).toBeCloseTo(b[b.length - 1]!, 2);
  });
});

describe('FaceVm — living baseline (v0.42.2)', () => {
  // THE INITIATIVE'S HEADLINE CLAIM, asserted numerically: the clip is a performance, the mood is
  // what remains. Run well past intro+perform+outro and the face must still be displaced.
  test('the mood outlives the clip by a wide margin', () => {
    const readAt = (on: boolean, endMs: number): Map<string, number> => {
      const { writer, last } = recorder();
      const affect = new AffectState({ ambient: 0 });
      const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => on });
      vm.setExpression('bright_delight', 1);
      run(vm, 0, endMs);
      return last;
    };
    // 25 s is far past any clip timeline in faceData (longest ≈ 8.5 s total).
    const withMood = readAt(true, 25_000);
    const without = readAt(false, 25_000);

    const form = (m: Map<string, number>): number => m.get('ParamMouthForm') ?? 0;
    expect(form(withMood)).toBeGreaterThan(form(without) + 0.01);
  });

  test('the resting pose itself moved — a sour mood rests differently from a bright one', () => {
    const restAfter = (key: 'bright_delight' | 'annoyed_resistance'): number => {
      const { writer, last } = recorder();
      const affect = new AffectState({ ambient: 0 });
      const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => true });
      vm.setExpression(key, 1);
      run(vm, 0, 20_000);
      return last.get('ParamMouthForm') ?? 0;
    };
    expect(restAfter('bright_delight')).toBeGreaterThan(restAfter('annoyed_resistance'));
  });

  test('smoothing follows arousal: an alert mood converges faster than a becalmed one', () => {
    // Probe `mouthPucker`: the `shy` clip drives it hard, and affectPose deliberately never touches
    // it — so the ONLY thing differing between the two runs is the arousal-modulated smoothing rate.
    const puckerAfter = (arousal: number, ms: number): number => {
      const { writer, last } = recorder();
      const affect = new AffectState({ ambient: 0, baseline: { valence: 0, arousal, dominance: 0 } });
      const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => true });
      vm.triggerEmotion('shy', 1);
      run(vm, 0, ms);
      return last.get('ParamMouthpucker') ?? 0;
    };
    // Early in the intro the alert run has travelled further toward the (negative) target.
    expect(puckerAfter(0.9, 300)).toBeLessThan(puckerAfter(-0.9, 300));
  });
});

// --- v0.43.0: she blinks again ------------------------------------------------------------------

describe('FaceVm — the eyelid invariant', () => {
  // THE INVARIANT: the PERSISTENT layers (idle, state bias, mood) must never write eyeOpen, because
  // FaceVm writes after the built-in CubismEyeBlink and a persistent writer therefore pins the
  // parameter forever — she simply stops blinking. The TIME-BOUNDED layers (the 14 hand-authored
  // clips, the 9 actions) may write it: `playful`'s 0.62/0.94 and `skeptical`'s 0.62/0.86 are
  // authored asymmetries that carry a lot of her character, and they end. `sleeping` is the one
  // persistent exception, and shutting her eyes is the entire point of that state.
  //
  // Counts every setParam touching an id, not just the last value: the failure mode guarded here is
  // "written every single frame with the same number", which a last-value probe cannot see.
  function eyeWrites(opts: {
    state?: 'neutral' | 'thinking' | 'speaking' | 'sleeping';
    affectOn?: boolean;
    expression?: 'bright_delight' | 'shy_softness' | 'annoyed_resistance';
    fromMs?: number;
    toMs?: number;
  }): { l: number; r: number; values: string[] } {
    const seen: number[] = [];
    let l = 0;
    let r = 0;
    let now = 0;
    const from = opts.fromMs ?? 0;
    const writer: ParamWriter = {
      setParam: (id, v) => {
        if (now < from) return;
        if (id === 'ParamEyeOpenL') { l++; seen.push(v); }
        if (id === 'ParamEyeOpenR') r++;
      },
    };
    const affect = new AffectState();
    const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => opts.affectOn ?? true });
    if (opts.state) vm.setState(opts.state);
    if (opts.expression) vm.setExpression(opts.expression, 1);
    for (now = 0; now <= (opts.toMs ?? 9600); now += 16) vm.tick(now);
    return { l, r, values: [...new Set(seen.map((v) => v.toFixed(3)))] };
  }

  test('a mood alone never touches the eyelids — 0 writes across 600 frames', () => {
    // Measured before this version: 599 of 600 frames, every one of them the constant 1.000.
    const w = eyeWrites({ affectOn: true, toMs: 9600 });
    expect(w.l).toBe(0);
    expect(w.r).toBe(0);
  });

  test('…nor does a sour mood (the negative-arousal half of the removed term)', () => {
    const w = eyeWrites({ affectOn: true, state: 'speaking', toMs: 9600 });
    expect(w.l).toBe(0);
  });

  test('a clip may own the eyelids while it performs — that asymmetry is authored character', () => {
    // `playful` sustains eyeOpenL 0.62 / eyeOpenR 0.94. Time-bounded, so the blink resumes after.
    const w = eyeWrites({ affectOn: true, expression: 'shy_softness', toMs: 3000 });
    expect(w.l).toBeGreaterThan(0);
  });

  test('…and MUST give them back when it ends — no residue after the timeline', () => {
    // shy: intro 980 + perform 5600 + outro 1300 ≈ 7.9 s. Sample well past that.
    const w = eyeWrites({ affectOn: true, expression: 'shy_softness', fromMs: 9000, toMs: 14_000 });
    expect(w.l).toBe(0);
    expect(w.r).toBe(0);
  });

  test('thinking no longer stares — this path predates v0.42.3 and was never affect-related', () => {
    // Measured before this version: 501 of 501 frames pinned at a constant 0.85.
    const w = eyeWrites({ state: 'thinking', affectOn: false, toMs: 8000 });
    expect(w.l).toBe(0);
    expect(w.r).toBe(0);
  });

  test('sleeping still shuts her eyes — the one deliberate writer, not collateral damage', () => {
    const w = eyeWrites({ state: 'sleeping', affectOn: false, toMs: 3200 });
    expect(w.l).toBeGreaterThan(100);
    expect(w.values).toContain('0.000');
  });
});

// --- v0.43.3: the thaw + microsaccades -----------------------------------------------------------

describe('FaceVm — the peak is no longer a still photograph', () => {
  // Samples a channel across a clip's PERFORM window and reports the mean absolute per-frame change.
  // Before this version these were exactly 0.00e+0 for every face channel an active clip owned, while
  // `ParamAngleZ` (not owned, driven by the idle) moved 0.116 per frame — body swaying, face frozen.
  function perform(
    pid: string,
    livePeak: boolean,
    clip: 'bright_delight' | 'shy_softness' = 'bright_delight',
    opts: { short?: boolean; toMs?: number; fromMs?: number } = {},
  ): { frozenFrames: number; frames: number; range: number } {
    // One sample per FRAME, not per setParam call: the mouth channels are written twice a frame (the
    // main loop, then the lip-sync ownership block), and counting both would read the duplicate as a
    // frozen frame.
    const vals: number[] = [];
    let now = 0;
    let frameValue: number | undefined;
    const writer: ParamWriter = { setParam: (p, v) => { if (p === pid) frameValue = v; } };
    // Idle actions off: this probe is about what a CLIP does, and a spontaneous gesture landing
    // mid-window would be measured as the clip breathing.
    const vm = new FaceVm(writer, {
      rng: () => 0.5,
      livePeakEnabled: () => livePeak,
      idleActionsEnabled: () => false,
      shortClipsEnabled: () => opts.short ?? true,
    });
    vm.setExpression(clip, 1);
    // The window sits strictly INSIDE perform, so nothing here measures the outro's slide back to
    // baseline. Short timings: intro ≈0.8–1.0 s, perform ≈2.4–2.6 s.
    const from = opts.fromMs ?? 1500;
    for (now = 0; now <= (opts.toMs ?? 3300); now += 16) {
      frameValue = undefined;
      vm.tick(now);
      if (now >= from && frameValue !== undefined) vals.push(frameValue);
    }
    if (vals.length < 2) return { frozenFrames: 0, frames: vals.length, range: 0 };
    let frozen = 0;
    for (let i = 1; i < vals.length; i++) if (vals[i] === vals[i - 1]) frozen++;
    return { frozenFrames: frozen, frames: vals.length, range: Math.max(...vals) - Math.min(...vals) };
  }

  // `adorable`'s brows are pinned at ±1 with a 1.35 gain, so they saturate the clamp at BOTH ends and
  // provably cannot breathe (see the dedicated test below). Brows are probed on `shy` instead, where
  // browLY sits at 0.26 and has room.
  const THAWED: Array<[string, 'bright_delight' | 'shy_softness']> = [
    ['ParamMouthpucker', 'bright_delight'],
    ['ParamMouthShrug', 'bright_delight'],
    ['ParamBrowYL', 'shy_softness'],
    ['ParamCheekpuff', 'shy_softness'],
  ];

  test('owned face channels change on EVERY frame — zero frozen frames', () => {
    // The precise inverse of the measured bug. Asserting a per-frame magnitude instead would punish
    // motion for being gentle: a channel breathing 0.018 over a 5 s cycle moves 7e-5 per frame and is
    // perfectly visible. What was broken was not the size of the step but that there was no step.
    for (const [pid, clip] of THAWED) {
      const { frozenFrames, frames } = perform(pid, true, clip);
      expect(`${pid}:${frozenFrames}/${frames > 100}`).toBe(`${pid}:0/true`);
    }
  });

  test('…and the swing is large enough for a person to see, not merely for a test to measure', () => {
    // The v0.42.4 lesson: direction/ordering assertions pass happily on motion nobody can perceive.
    // Measured over a LONG perform window: the wobble's period is 3.3–10.5 s, so a full cycle does not
    // fit inside v0.43.4's ~2.4 s one. Amplitude is a property of the mechanism, not of clip length.
    const long = { short: false, fromMs: 1500, toMs: 6500 };
    for (const [pid, clip] of THAWED) {
      expect(`${pid}:${perform(pid, true, clip, long).range > 0.01}`).toBe(`${pid}:true`);
    }
  });

  test('…and were provably a still photograph with the flag off', () => {
    for (const [pid, clip] of THAWED) {
      const { frozenFrames, frames, range } = perform(pid, false, clip);
      expect(`${pid}:${frozenFrames === frames - 1}:${range}`).toBe(`${pid}:true:0`);
    }
  });

  test('KNOWN LIMIT: a channel authored at its clamp cannot breathe, and we do not pretend it can', () => {
    // `adorable` sets browLY = -1 with FACE_PARAM_GAIN 1.35. Both -1 and -1+jitter map past the clamp
    // after the gain, so the written value is identical every frame. Fixing it means lowering the
    // authored peak — a taste decision for the owner, not something to smuggle in here.
    expect(FACE_PARAM_GAIN.browLY! * Math.abs(EMOTIONS.adorable.sustainedState.browLY!)).toBeGreaterThan(1);
    expect(perform('ParamBrowYL', true, 'bright_delight').range).toBe(0);
  });

  test('the peak is not diluted — the authored pose still lands within 8%', () => {
    const settled = (livePeak: boolean): number => {
      const { writer, last } = recorder();
      const vm = new FaceVm(writer, { rng: () => 0.5, livePeakEnabled: () => livePeak });
      vm.setExpression('bright_delight', 1);
      run(vm, 0, 4000);
      return last.get('ParamMouthpucker') ?? 0;
    };
    const on = settled(true);
    const off = settled(false);
    expect(Math.abs(on - off)).toBeLessThan(Math.abs(off) * 0.08);
  });

  test('head and body are untouched — they already move under the built-in breath', () => {
    const trace = (livePeak: boolean): number[] => {
      const out: number[] = [];
      let now = 0;
      const writer: ParamWriter = { setParam: (p, v) => { if (p === 'ParamAngleZ') out.push(v); } };
      const vm = new FaceVm(writer, { rng: () => 0.5, livePeakEnabled: () => livePeak });
      vm.setExpression('bright_delight', 1);
      for (now = 0; now <= 5000; now += 16) { vm.tick(now); vm.flushPose(); }
      return out;
    };
    expect(trace(true)).toEqual(trace(false));
  });

  test('no channel is pushed past its clamp by the residue', () => {
    const offenders: string[] = [];
    const writer: ParamWriter = {
      setParam: (id, v) => {
        for (const [key, pid] of Object.entries(FACE_VM_PARAM_MAP)) {
          if (pid !== id) continue;
          const gain = FACE_PARAM_GAIN[key as FaceStateKey] ?? 1;
          const lim = clampStateValue(key as FaceStateKey, v / gain) * gain;
          if (Math.abs(v - lim) > 1e-6) offenders.push(`${id}=${v}`);
        }
      },
    };
    for (const id of Object.keys(EMOTIONS)) {
      const vm = new FaceVm(writer, { rng: () => 0.5, livePeakEnabled: () => true });
      vm.triggerEmotion(id, 1);
      for (let t = 0; t <= 9000; t += 16) { vm.tick(t); vm.flushPose(); }
    }
    expect(offenders).toEqual([]);
  });
});

// --- v0.43.4: shorter performances + a face that does things unprompted --------------------------

describe('timelines — a beat, not a sit', () => {
  test('every clip performs for 2200–2800 ms when shortened', () => {
    for (const [id, def] of Object.entries(EMOTIONS)) {
      const t = timelineFor(def, true);
      expect(`${id}:${t.performMs >= 2200 && t.performMs <= 2800}`).toBe(`${id}:true`);
    }
  });

  test('the authored ordering survives the mapping — longer clips stay longer', () => {
    const byAuthored = Object.values(EMOTIONS).sort((a, b) => a.timeline.performMs - b.timeline.performMs);
    const shortened = byAuthored.map((d) => timelineFor(d, true).performMs);
    for (let i = 1; i < shortened.length; i++) expect(shortened[i]!).toBeGreaterThanOrEqual(shortened[i - 1]!);
  });

  test('intro and outro are untouched — only the sit in the middle is cut', () => {
    for (const def of Object.values(EMOTIONS)) {
      const t = timelineFor(def, true);
      expect(t.introMs).toBe(def.timeline.introMs);
      expect(t.outroMs).toBe(def.timeline.outroMs);
    }
  });

  test('the flag returns the authored timings exactly', () => {
    for (const def of Object.values(EMOTIONS)) expect(timelineFor(def, false)).toEqual(def.timeline);
  });

  test('the floor keeps the t=3000ms pose assertions meaningful', () => {
    // Those two tests sample at 3000 ms to prove a clip reached its pose. At performMs 1900 the sample
    // lands after the clip is over (measured 0.018 where >0.5 is needed). This is why the floor is
    // 2200 rather than the 1600–2200 the plan first proposed.
    const shy = timelineFor(EMOTIONS.shy, true);
    expect(shy.introMs + shy.performMs).toBeGreaterThan(3000);
  });
});

describe('FaceVm — spontaneous idle actions', () => {
  function lcg(seed: number): () => number {
    let n = seed;
    return () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  }

  function idleRun(ms: number, opts: { enabled?: boolean; mood?: AffectState } = {}): string[] {
    // Which action fired is inferred from the head/body channels the actions drive; simplest reliable
    // signal is that SOMETHING wrote a pose param away from the idle's own value, so instead we count
    // scheduler picks through a spy on the rng-driven pool by observing distinct action starts.
    const fired: string[] = [];
    const writer: ParamWriter = { setParam: () => {} };
    const vm = new FaceVm(writer, {
      rng: lcg(12345),
      idleActionsEnabled: () => opts.enabled ?? true,
      affect: opts.mood,
      affectEnabled: () => opts.mood !== undefined,
    });
    for (let t = 0; t <= ms; t += 16) {
      const before = vm.activeActionIds();
      vm.tick(t);
      for (const id of vm.activeActionIds()) if (!before.includes(id)) fired.push(id);
    }
    return fired;
  }

  test('she does something on her own every 8–20 s — ≥20 gestures in five minutes', () => {
    expect(idleRun(300_000).length).toBeGreaterThanOrEqual(20);
  });

  test('no gesture repeats within three of itself', () => {
    const names = idleRun(300_000).map((id) => id.split(':')[1]!);
    for (let i = 3; i < names.length; i++) {
      expect(names.slice(i - 3, i)).not.toContain(names[i]!);
    }
  });

  test('nothing fires with the flag off', () => {
    expect(idleRun(300_000, { enabled: false })).toEqual([]);
  });

  test('nothing fires while a clip is performing — that is what avoids the ownership fight', () => {
    // applyActions hard-sets and does not consult `owned`, so an overlapping gesture would punch
    // straight through a performance.
    const writer: ParamWriter = { setParam: () => {} };
    const vm = new FaceVm(writer, { rng: lcg(99), idleActionsEnabled: () => true });
    for (let t = 0; t <= 300_000; t += 2000) {
      vm.setExpression('bright_delight', 1); // keep a clip permanently active
      for (let k = 0; k < 125; k++) vm.tick(t + k * 16);
      expect(vm.activeActionIds().filter((id) => id.startsWith('idle:'))).toEqual([]);
    }
  });

  test('the mood biases which gesture she reaches for', () => {
    const warm = new AffectState({ ambient: 0, baseline: { valence: 0.9, arousal: -0.4, dominance: -0.1 } });
    const cold = new AffectState({ ambient: 0, baseline: { valence: -0.9, arousal: 0.2, dominance: 0.5 } });
    const warmNames = idleRun(600_000, { mood: warm }).map((id) => id.split(':')[1]!);
    const coldNames = idleRun(600_000, { mood: cold }).map((id) => id.split(':')[1]!);
    const count = (xs: string[], n: string): number => xs.filter((x) => x === n).length;
    expect(count(warmNames, 'bodyLeanInSoft')).toBeGreaterThan(count(coldNames, 'bodyLeanInSoft'));
    expect(count(coldNames, 'bodyLeanBackGuarded')).toBeGreaterThan(count(warmNames, 'bodyLeanBackGuarded'));
  });

  test('the eyelid invariant survives: a gesture may close her eyes, and gives them back', () => {
    let writes = 0;
    let lastValue = 1;
    const writer: ParamWriter = { setParam: (p, v) => { if (p === 'ParamEyeOpenL') { writes++; lastValue = v; } } };
    const vm = new FaceVm(writer, { rng: lcg(4242), idleActionsEnabled: () => true });
    for (let t = 0; t <= 300_000; t += 16) vm.tick(t);
    // slowBlinkAffection / lookAwayThenBack legitimately drive the eyelids — they are time-bounded,
    // which is exactly what v0.43.0's invariant permits. What must not happen is a permanent hold.
    expect(writes).toBeGreaterThan(0);
    expect(Math.abs(lastValue - 1)).toBeLessThan(0.05);
  });
});

// --- v0.43.5: frame-rate-independent smoothing ---------------------------------------------------

describe('smoothing — the substitution is a no-op at 60 fps', () => {
  function streamAt(dtMs: number, frames: number, perOrgan: boolean): Map<string, number> {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, {
      rng: () => 0.5,
      idleActionsEnabled: () => false,
      smoothingEnabled: () => perOrgan,
    });
    vm.setExpression('shy_softness', 1);
    for (let i = 0; i <= frames; i++) { vm.tick(i * dtMs); vm.flushPose(); }
    return last;
  }

  test('THE GATE: at 60 fps the new coefficient IS the old constant', () => {
    // This is the gate the whole version hangs on, stated directly rather than sampled. The old loop
    // used a fixed per-frame coefficient `sm`; the new one uses `approach(sm, dt)`. If those are equal
    // at the frame rate everything was tuned at, the substitution cannot have changed the feel — and
    // if they are not, this version is a re-tune wearing a refactor's clothes.
    for (const smBase of [0.18, 0.24, 0.34]) {
      for (const mult of [0.6, 1, 1.6]) {
        const sm = smBase * mult;
        expect(Math.abs(approach(sm, 1 / 60) - sm)).toBeLessThan(1e-12);
      }
    }
  });

  test('the expression still lands where it always did', () => {
    const now = streamAt(1000 / 60, 180, false); // 3.0 s — inside shy's shortened perform window
    expect(now.get('ParamMouthpucker')!).toBeLessThan(-0.15);
    expect(now.get('Paramsmileshy')!).toBeGreaterThan(0.5);
  });

  test('half the frame rate, half the frames — same settled face', () => {
    // The actual payoff: the old fixed coefficient converged the same FRACTION per frame regardless of
    // elapsed time, so at 30 fps the same expression settled half as far in the same wall-clock.
    // Tolerance is relative — head angles are degrees (±30), the rest are normalised.
    const a = streamAt(1000 / 60, 360, false);
    const b = streamAt(1000 / 30, 180, false);
    for (const id of ['ParamMouthpucker', 'ParamBrowYL', 'ParamMouthShrug', 'ParamAngleY']) {
      const av = a.get(id) ?? 0;
      const bv = b.get(id) ?? 0;
      const tol = Math.max(0.02, Math.abs(av) * 0.05);
      expect(`${id}:${Math.abs(av - bv) <= tol}`).toBe(`${id}:true`);
    }
  });

  test('a backgrounded tab cannot teleport the face on refocus', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false });
    vm.setExpression('shy_softness', 1);
    vm.tick(0);
    const before = last.get('ParamMouthpucker') ?? 0;
    vm.tick(30_000); // 30 s of "away"
    const after = last.get('ParamMouthpucker') ?? 0;
    // dt is clamped to 0.25 s, so one frame can advance at most a quarter-second's worth.
    expect(Math.abs(after - before)).toBeLessThan(0.6);
  });
});

describe('smoothing — per-organ pacing', () => {
  // Time for a channel to travel 90% of the way from where it started to where it ends up. Derived
  // from the trace rather than from a hardcoded target, so it works regardless of sign or gain.
  function timeTo90(pid: string, perOrgan: boolean): number {
    const trace: Array<[number, number]> = [];
    let now = 0;
    const writer: ParamWriter = { setParam: (p, v) => { if (p === pid) trace.push([now, v]); } };
    const vm = new FaceVm(writer, {
      rng: () => 0.5,
      idleActionsEnabled: () => false,
      smoothingEnabled: () => perOrgan,
    });
    vm.setState('sleeping'); // a step input on an eye channel AND a pose channel at once
    for (now = 0; now <= 4000; now += 16) { vm.tick(now); vm.flushPose(); }
    if (trace.length < 2) return Infinity;
    const first = trace[0]![1];
    const final = trace.at(-1)![1];
    const span = final - first;
    if (Math.abs(span) < 1e-6) return Infinity;
    for (const [t, v] of trace) if (Math.abs(v - first) >= Math.abs(span) * 0.9) return t;
    return Infinity;
  }

  test('the eyes settle faster than the posture does', () => {
    expect(timeTo90('ParamEyeOpenL', true)).toBeLessThan(timeTo90('ParamAngleY', true));
  });

  test('with the flag off every channel shares one rate again', () => {
    expect(timeTo90('ParamEyeOpenL', false)).toBe(timeTo90('ParamAngleY', false));
  });
});

describe('physicsPassthrough — the field finally has a reader', () => {
  test('adorable hands its eyelids back, so she blinks through the cutest clip', () => {
    // Declared in faceData since the clip was authored; unread until v0.43.4, which meant `adorable`
    // pinned both eyelids at 1 for its entire perform window.
    expect(EMOTIONS.adorable.physicsPassthrough).toContain('eyeOpenL');
    let writes = 0;
    const writer: ParamWriter = { setParam: (p) => { if (p === 'ParamEyeOpenL') writes++; } };
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false });
    vm.setExpression('bright_delight', 1);
    for (let t = 0; t <= 5000; t += 16) vm.tick(t);
    expect(writes).toBe(0);
  });

  test('a clip WITHOUT the declaration still owns its eyelids', () => {
    expect(EMOTIONS.shy.physicsPassthrough).toEqual([]);
    let writes = 0;
    const writer: ParamWriter = { setParam: (p) => { if (p === 'ParamEyeOpenL') writes++; } };
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false });
    vm.setExpression('shy_softness', 1);
    for (let t = 0; t <= 3000; t += 16) vm.tick(t);
    expect(writes).toBeGreaterThan(0);
  });
});

describe('FaceVm — pupil microsaccades', () => {
  function pupilTrace(seed: () => number, ms = 10_000): number[] {
    const out: number[] = [];
    const writer: ParamWriter = { setParam: (p, v) => { if (p === 'ParamhitomiX') out.push(v); } };
    const vm = new FaceVm(writer, { rng: seed });
    for (let t = 0; t <= ms; t += 16) vm.tick(t);
    return out;
  }

  test('the pupil visits several distinct targets over ten seconds', () => {
    let n = 0;
    const rng = (): number => ((n = (n * 9301 + 49297) % 233280), n / 233280);
    const distinct = new Set(pupilTrace(rng).map((v) => v.toFixed(3)));
    expect(distinct.size).toBeGreaterThanOrEqual(4);
  });

  test('it stays a microsaccade — never beyond ±0.15', () => {
    let n = 7;
    const rng = (): number => ((n = (n * 9301 + 49297) % 233280), n / 233280);
    for (const v of pupilTrace(rng)) expect(Math.abs(v)).toBeLessThanOrEqual(0.15 + 1e-9);
  });

  test('it does not disturb the eyelids — the v0.43.0 invariant still holds', () => {
    let l = 0;
    const writer: ParamWriter = { setParam: (p) => { if (p === 'ParamEyeOpenL') l++; } };
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    for (let t = 0; t <= 9600; t += 16) vm.tick(t);
    expect(l).toBe(0);
  });
});

// --- v0.43.1: the model's own peak assets reach the screen ---------------------------------------

describe('FaceVm — native peak overlays', () => {
  function peak(
    id: 'bright_delight' | 'playful_brightness' | 'awkward_lightness' | 'shy_softness' | 'gentle_concern',
    pid: string,
    intensity = 1,
  ): number {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setExpression(id, intensity);
    run(vm, 0, 3000); // past the intro, inside perform
    return last.get(pid) ?? 0;
  }

  test('delight lights up the heart eyes', () => {
    expect(peak('bright_delight', 'Paramheart')).toBeGreaterThan(0.5);
  });

  test('playfulness lights up the star eyes', () => {
    expect(peak('playful_brightness', 'Paramxingxing')).toBeGreaterThan(0.5);
  });

  test('mild awkwardness lights up the swirl eyes — it rides the `awkwardV2` branch', () => {
    // v0.43.2 put `awkward_lightness` on a branch: pushed hard it performs `embarrassed` instead,
    // which is a blush rather than a system-crash face. The swirl belongs to the lighter one.
    expect(peak('awkward_lightness', 'Paramwenxiang', 0.4)).toBeGreaterThan(0.3);
  });

  test('strong concern reaches the tears — a clip that was unreachable before v0.43.2', () => {
    expect(peak('gentle_concern', 'Paramtear', 0.9)).toBeGreaterThan(0.5);
  });

  test('an unrelated emotion lights up none of them — the whitelist is not leaky', () => {
    for (const pid of ['Paramheart', 'Paramxingxing', 'Paramwenxiang', 'Paramtear']) {
      expect(`${pid}:${peak('shy_softness', pid)}`).toBe(`${pid}:0`);
    }
  });

  // --- v0.43.2: the overlay no longer flares as the clip lets go ---
  //
  // `stage.weight` is direction-relative: during the outro it counts progress BACK toward baseline.
  // Read as an absolute strength it made every overlay fade IN as the clip wound down, reach full
  // value, and hard-cut to zero on the frame the stage went inactive. Measured on `shy`'s blush:
  // 0.000 at 6600ms → 0.449 at 7200 → 0.990 at 7800 → 0 at 7900.
  function overlayTrace(id: 'shy_softness' | 'bright_delight', pid: string, fromMs: number, toMs: number): number[] {
    const trace: number[] = [];
    let now = 0;
    const writer: ParamWriter = { setParam: (p, v) => { if (p === pid && now >= fromMs) trace.push(v); } };
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setExpression(id, 1);
    for (now = 0; now <= toMs; now += 16) vm.tick(now);
    return trace;
  }

  test('the blush fades OUT through the outro — monotonically, to nothing', () => {
    // shy: intro 980 + perform 5600 = 6580, outro 1300 → sample the whole tail.
    const trace = overlayTrace('shy_softness', 'Paramsmileshy', 6600, 9000);
    expect(trace.length).toBeGreaterThan(100);
    const rises = trace.filter((v, i) => i > 0 && v > trace[i - 1]! + 1e-9).length;
    expect(rises).toBe(0);
    expect(trace.at(-1)).toBe(0);
  });

  test('…while the intro still fades IN — only the outro was reversed', () => {
    const trace = overlayTrace('shy_softness', 'Paramsmileshy', 0, 980);
    const falls = trace.filter((v, i) => i > 0 && v < trace[i - 1]! - 1e-9).length;
    expect(falls).toBe(0);
    expect(trace.at(-1)!).toBeGreaterThan(0.9);
  });

  test('a peak asset fades out the same way — no hard cut on the last frame', () => {
    const trace = overlayTrace('bright_delight', 'Paramheart', 6980, 9500);
    const rises = trace.filter((v, i) => i > 0 && v > trace[i - 1]! + 1e-9).length;
    expect(rises).toBe(0);
  });

  test('overlay strength follows the affect intensity, like the pose already did', () => {
    const at = (intensity: number): number => {
      const { writer, last } = recorder();
      const vm = new FaceVm(writer, { rng: () => 0.5 });
      vm.setExpression('bright_delight', intensity);
      run(vm, 0, 3000);
      return last.get('Paramheart') ?? 0;
    };
    expect(at(0.3)).toBeLessThan(at(1));
    expect(at(0.3)).toBeGreaterThan(0);
  });

  test('the asset is released when the clip ends — it does not latch on', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setExpression('bright_delight', 1);
    run(vm, 0, 3000);
    expect(last.get('Paramheart') ?? 0).toBeGreaterThan(0.5);
    run(vm, 3016, 14_000); // past intro 780 + perform 6200 + outro 1100
    expect(last.get('Paramheart') ?? 0).toBe(0);
  });

  test('the rest of the face is untouched: mood still reaches mouth, smile and brows', () => {
    const { writer, last } = recorder();
    const affect = new AffectState({ ambient: 0 });
    const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => true });
    vm.setExpression('bright_delight', 1);
    run(vm, 0, 20_000);
    expect(last.get('ParamMouthForm') ?? 0).toBeGreaterThan(0.1);
    expect(last.get('ParamEyeSmileL') ?? 0).toBeGreaterThan(0.1);
    expect(last.get('ParamBrowYL') ?? 0).toBeGreaterThan(0.05);
  });
});

// v0.43.8 — the workbench's two engine hooks. Both are manual-only entry points, so the tests are
// about the mechanism (does it fire, does it stop, does it win the write order), not about looks.
// Every write per param id, not just the last — "written every frame" and "written once" are
// indistinguishable to the last-value recorder above.
function countingWriter(): { writer: ParamWriter; writes: Map<string, number[]> } {
  const writes = new Map<string, number[]>();
  return {
    writer: {
      setParam: (id, v) => {
        const a = writes.get(id);
        if (a) a.push(v);
        else writes.set(id, [v]);
      },
    },
    writes,
  };
}

describe('FaceVm — manual gesture single-shot (v0.43.8)', () => {
  test('playAction queues under a manual: key and expires on its own', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    run(vm, 0, 100);
    vm.playAction('sighRelease'); // durationMs 1460
    run(vm, 116, 400);
    expect(vm.activeActionIds().some((id) => id.startsWith('manual:sighRelease:'))).toBe(true);
    run(vm, 416, 2200);
    expect(vm.activeActionIds()).toEqual([]);
  });

  test('an unknown gesture name is a no-op, not a crash', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    run(vm, 0, 100);
    expect(() => vm.playAction('nope')).not.toThrow();
    expect(vm.activeActionIds()).toEqual([]);
  });

  test('a manually fired gesture actually moves the model', () => {
    const { writer, last } = recorder();
    // Idle gestures off so the only thing that can move the head is the manual one.
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false });
    run(vm, 0, 200);
    const before = last.get(FACE_VM_PARAM_MAP.headPitch) ?? 0;
    vm.playAction('headLowerShy', 1); // headPitch peaks at 11 (deg) mid-track
    let peak = before;
    for (let t = 216; t <= 1100; t += 16) {
      vm.tick(t);
      vm.flushPose();
      peak = Math.max(peak, last.get(FACE_VM_PARAM_MAP.headPitch) ?? 0);
    }
    expect(peak).toBeGreaterThan(2);
  });

  test('listActions names every authored gesture, derived from the table', () => {
    const { writer } = recorder();
    expect(new FaceVm(writer).listActions()).toEqual(Object.keys(ACTIONS));
  });
});

describe('FaceVm — worn model params (v0.43.8)', () => {
  // The prop params are not in ALL_OVERLAY_PARAMS, so nothing zeroes them — but pixi's motion update
  // has a save/restore cycle that drops a one-shot write. Wearing must therefore be per-frame.
  test('a worn param is written EVERY frame, not once', () => {
    const { writer, writes } = countingWriter();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setManualParam('Paramyanzhao', 1);
    for (let i = 0; i < 100; i++) vm.tick(i * 16);
    expect(writes.get('Paramyanzhao')?.length).toBe(100);
    expect(new Set(writes.get('Paramyanzhao'))).toEqual(new Set([1]));
  });

  test('taking it off writes exactly one 0, then stops — no frozen eyepatch', () => {
    const { writer, writes } = countingWriter();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setManualParam('Paramyanzhao', 1);
    for (let i = 0; i < 10; i++) vm.tick(i * 16);
    vm.setManualParam('Paramyanzhao', null);
    for (let i = 10; i < 40; i++) vm.tick(i * 16);
    const w = writes.get('Paramyanzhao') ?? [];
    expect(w.length).toBe(11);
    expect(w[10]).toBe(0);
    expect(vm.manualParamIds()).toEqual([]);
  });

  // Write ORDER is the load-bearing part: the overlay loop writes 0 to every overlay param each
  // frame, so a worn overlay id has to be written after it or wearing heart eyes would do nothing.
  test('a worn overlay id beats the overlay loop that zeroes it', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setManualParam('Paramheart', 1);
    run(vm, 0, 500);
    expect(last.get('Paramheart')).toBe(1);
  });

  test('activeOverlayParams reports what the CLIP drives, not what is worn', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setManualParam('Paramyanzhao', 1);
    vm.setExpression('shy_softness', 1); // shy carries the 脸红 overlay
    run(vm, 0, 3000);
    const driven = vm.activeOverlayParams();
    expect(driven['Paramsmileshy']).toBeGreaterThan(0.5);
    expect('Paramyanzhao' in driven).toBe(false);
  });

  test('nothing playing means nothing driven', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    run(vm, 0, 500);
    expect(vm.activeOverlayParams()).toEqual({});
  });
});

// v0.43.9 — compose mode. The composer's whole value rests on two claims: the face holds exactly
// what the sliders say (no living layer bleeding in), and the numbers it exports mean the same thing
// they mean in `faceData.ts` (the preview goes through the real gain path).
describe('FaceVm — compose mode (v0.43.9)', () => {
  test('every living layer goes silent — only the composed channels are written', () => {
    const { writer, writes } = countingWriter();
    const affect = new AffectState({ ambient: 0 });
    affect.nudge('bright_delight', 1); // a live mood that would normally tint everything
    const vm = new FaceVm(writer, { rng: () => 0.5, affect, affectEnabled: () => true });
    vm.setComposeMode({ browLY: -0.5 });
    for (let i = 0; i < 600; i++) {
      vm.tick(i * 16);
      vm.flushPose();
    }
    // ParamBrowYL is the composed channel. Nothing from the idle, the mood, the microsaccade or the
    // state bias may appear alongside it.
    expect(writes.has('ParamBrowYL')).toBe(true);
    for (const forbidden of ['ParamhitomiX', 'ParamhitomiY', 'ParamAngleZ', 'ParamBodyAngleZ', 'ParamEyeSmileL']) {
      expect(writes.has(forbidden)).toBe(false);
    }
  });

  test('composed values travel the real gain + clamp path', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    // browLY has gain 1.35 and clamps to [-1, 1] → -1 x 1.35 clamps back to -1.
    // headPitch has gain 1 and no clamp → -10 stays -10.
    vm.setComposeMode({ browLY: -1, headPitch: -10 });
    run(vm, 0, 4000);
    vm.flushPose();
    expect(last.get('ParamBrowYL')).toBeCloseTo(clampStateValue('browLY', -1 * (FACE_PARAM_GAIN.browLY ?? 1)), 6);
    expect(last.get('ParamAngleY') ?? 0).toBeCloseTo(-10, 1);
  });

  // v0.43.0's invariant is "persistent layers never write eyeOpen; time-bounded ones may and must
  // release". Compose is time-bounded by the owner leaving the bench — half-lidded has to be
  // authorable — so it writes, and then gives the eyelids back.
  test('compose may hold the eyelids, and hands them back on exit', () => {
    const { writer, writes } = countingWriter();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setComposeMode({ eyeOpenL: 0.4, eyeOpenR: 0.4 });
    for (let i = 0; i < 200; i++) vm.tick(i * 16);
    expect((writes.get('ParamEyeOpenL') ?? []).length).toBeGreaterThan(100);
    const held = (writes.get('ParamEyeOpenL') ?? []).length;
    vm.setComposeMode(null);
    for (let i = 200; i < 600; i++) vm.tick(i * 16);
    // Once released the value returns to 1 (the default) and the write gate stops writing it.
    const after = (writes.get('ParamEyeOpenL') ?? []).length;
    expect(after - held).toBeLessThan(120);
    expect(vm.composeActive()).toBe(false);
  });

  test('leaving compose brings the living layers straight back', () => {
    const { writer, writes } = countingWriter();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setComposeMode({ browLY: -0.5 });
    for (let i = 0; i < 200; i++) {
      vm.tick(i * 16);
      vm.flushPose();
    }
    expect(writes.has('ParamAngleZ')).toBe(false); // idle sway frozen
    vm.setComposeMode(null);
    for (let i = 200; i < 400; i++) {
      vm.tick(i * 16);
      vm.flushPose();
    }
    expect(writes.has('ParamAngleZ')).toBe(true); // and alive again
  });

  test('previewPose runs an unauthored pose through a real intro→perform→outro', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setComposeMode({ cheekPuff: 1 });
    run(vm, 0, 200);
    vm.previewPose({
      timeline: { introMs: 400, performMs: 1200, outroMs: 400 },
      owns: ['specials'],
      entryState: { cheekPuff: 0.6 },
      sustainedState: { cheekPuff: 1 },
      actionRefs: [],
      overlayRefs: [],
      physicsPassthrough: [],
    });
    expect(vm.composeActive()).toBe(false); // a preview is motion; compose is a freeze
    run(vm, 216, 1200);
    expect(last.get('ParamCheekpuff') ?? 0).toBeGreaterThan(0.7);
    run(vm, 1216, 4000);
    expect(last.get('ParamCheekpuff') ?? 1).toBeLessThan(0.1); // and it releases
  });

  test('the preview id is unreachable from triggerEmotion', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.triggerEmotion('__preview__');
    run(vm, 0, 500);
    expect(vm.currentPlayback()).toBeNull();
  });
});

// v0.43.11 — listening. Half of every conversation is her NOT talking; these are the two halves of
// that half: attention while you type, and visible thought while she waits on the model.
describe('FaceVm — the listening bias (v0.43.11)', () => {
  // The bias is small and rides UNDER a live idle that also drives headYaw, so an absolute reading
  // would be measuring the sway. Two VMs on the same clock and the same rng, one listening: the
  // difference between them IS the bias, and nothing else.
  function pair(opts: Partial<FaceVmOptions> = {}): { a: FaceVm; b: FaceVm; delta: (t: number) => number } {
    const ra = recorder();
    const rb = recorder();
    const mk = (): FaceVm => new FaceVm(ra.writer, { rng: () => 0.5, idleActionsEnabled: () => false, ...opts });
    const a = mk();
    const b = new FaceVm(rb.writer, { rng: () => 0.5, idleActionsEnabled: () => false, ...opts });
    return {
      a,
      b,
      delta: () => {
        a.flushPose();
        b.flushPose();
        return (ra.last.get('ParamAngleX') ?? 0) - (rb.last.get('ParamAngleX') ?? 0);
      },
    };
  }

  test('turning toward you is a fade, not a jump, and it fades back', () => {
    const { a: listening, b: control, delta } = pair();
    run(listening, 0, 500);
    run(control, 0, 500);
    expect(Math.abs(delta(500))).toBeLessThan(0.01); // identical until asked
    listening.setListening(true);
    expect(listening.isListening()).toBe(true);
    for (let t = 516; t <= 1516; t += 16) {
      listening.tick(t);
      control.tick(t);
    }
    expect(Math.abs(delta(1516))).toBeGreaterThan(1); // turned toward the panel
    listening.setListening(false);
    for (let t = 1532; t <= 3600; t += 16) {
      listening.tick(t);
      control.tick(t);
    }
    expect(Math.abs(delta(3600))).toBeLessThan(0.3); // and back, smoothly
  });

  // The gaze arbitration from v0.13.x is untouched: while mouse-follow owns the eyes, listening must
  // move the head and body and nothing else.
  test('listening never writes the eyeballs while gaze-follow owns them', () => {
    const { writer, writes } = countingWriter();
    const vm = new FaceVm(writer, { rng: () => 0.5, gazeActive: true, idleActionsEnabled: () => false });
    vm.setListening(true);
    for (let i = 0; i < 200; i++) {
      vm.tick(i * 16);
      vm.flushPose();
    }
    expect(writes.has('ParamEyeBallX')).toBe(false);
    expect(writes.has('ParamEyeBallY')).toBe(false);
    expect(writes.has('ParamAngleX')).toBe(true);
  });

  test('the flag off makes setListening a no-op', () => {
    const { a: listening, b: control, delta } = pair({ listeningEnabled: () => false });
    listening.setListening(true);
    for (let t = 0; t <= 2000; t += 16) {
      listening.tick(t);
      control.tick(t);
    }
    expect(Math.abs(delta(2000))).toBeLessThan(0.01);
  });
});

describe('FaceVm — thinking choreography (v0.43.11)', () => {
  const THINKING = ['gazeUpRecall', 'browKnit', 'lookAwayThenBack'];
  const nameOf = (id: string): string => id.split(':')[1] ?? '';

  function collect(vm: FaceVm, ms: number): string[] {
    const seen = new Set<string>();
    for (let t = 0; t <= ms; t += 16) {
      vm.tick(t);
      for (const id of vm.activeActionIds()) seen.add(nameOf(id));
    }
    return [...seen];
  }

  test('thinking draws from the thinking pool, at the denser cadence', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setState('thinking');
    const fired = collect(vm, 60_000);
    expect(fired.length).toBeGreaterThan(0);
    for (const name of fired) expect(THINKING).toContain(name);
    // 60 s at 3.5–8 s intervals is at least six firings; the set is capped at 3 distinct names, so
    // count the scheduling instead.
    let firings = 0;
    const vm2 = new FaceVm(recorder().writer, { rng: () => 0.5 });
    vm2.setState('thinking');
    const live = new Set<string>();
    for (let t = 0; t <= 60_000; t += 16) {
      vm2.tick(t);
      for (const id of vm2.activeActionIds()) {
        if (!live.has(id)) {
          live.add(id);
          firings++;
        }
      }
    }
    expect(firings).toBeGreaterThanOrEqual(6);
  });

  test('back to neutral, she goes back to the idle pool and its slower pace', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    vm.setState('neutral');
    const fired = collect(vm, 60_000);
    expect(fired.length).toBeGreaterThan(0);
    for (const name of fired) expect(THINKING.includes(name) && name !== 'lookAwayThenBack').toBe(false);
  });

  test('the flag off leaves thinking on the ordinary idle pool', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5, listeningEnabled: () => false });
    vm.setState('thinking');
    const fired = collect(vm, 60_000);
    for (const name of fired) expect(['gazeUpRecall', 'browKnit']).not.toContain(name);
  });

  // v0.43.0's invariant, stated exactly: PERSISTENT layers never write an eyelid; TIME-BOUNDED ones
  // may, and must release. The two gestures added here take the simple route and declare no eyelid
  // track at all; `lookAwayThenBack` (reused from the idle pool) does drive them, and v0.43.4
  // deliberately REJECTED stripping that — so the assertion on it is that it gives them back.
  test('the new thinking gestures declare no eyelid track', () => {
    for (const name of ['gazeUpRecall', 'browKnit']) {
      const tracks = Object.keys(ACTIONS[name]?.tracks ?? {});
      expect(tracks).not.toContain('eyeOpenL');
      expect(tracks).not.toContain('eyeOpenR');
    }
  });

  test('the one thinking gesture that does drive the eyelids returns them', () => {
    for (const key of ['eyeOpenL', 'eyeOpenR'] as const) {
      const kfs = ACTIONS['lookAwayThenBack']?.tracks[key] ?? [];
      expect(kfs.length).toBeGreaterThan(0);
      expect(kfs[kfs.length - 1]?.value).toBeCloseTo(kfs[0]?.value ?? -1, 6);
    }
  });
});

// v0.43.12 — the pulse layer and the stress nods it carries. Initiative 30's立项 named this as its
// one untouched gap: six versions, and she still said everything with a still face.
describe('FaceVm — stress pulses while speaking (v0.43.12)', () => {
  // Drive a synthetic energy envelope through setMouth the way the audio sink does: one frame per
  // tick, `null` at the sentence boundary.
  function speak(
    vm: FaceVm,
    frames: Array<{ t: number; open: number }>,
    onFrame?: (t: number) => void,
  ): void {
    for (const f of frames) {
      vm.tick(f.t);
      vm.setMouth({ open: f.open, form: 0, shrug: 0, pucker: 0 });
      onFrame?.(f.t);
    }
    vm.setMouth(null);
  }

  const envelope = (peaks: number[], durationMs: number): Array<{ t: number; open: number }> => {
    const out: Array<{ t: number; open: number }> = [];
    for (let t = 0; t <= durationMs; t += 16) {
      let open = 0.1;
      for (const at of peaks) {
        const d = Math.abs(t - at);
        if (d < 40) open = Math.max(open, 0.8 * Math.cos((Math.PI * d) / 80));
      }
      out.push({ t, open });
    }
    return out;
  };

  // The idle drives `headPitch` too, so an absolute reading measures the sway, not the nod. Two VMs
  // on the same clock and the same envelope, one with the flag off: the difference IS the pulse layer
  // and nothing else — the same differential discipline the listening bias needed.
  function speakPair(peaks: number[], durationMs: number): { deltas: number[]; after: number } {
    const on = recorder();
    const off = recorder();
    const opts = { rng: () => 0.5, idleActionsEnabled: () => false } as const;
    const vmOn = new FaceVm(on.writer, opts);
    const vmOff = new FaceVm(off.writer, { ...opts, speechPerformanceEnabled: () => false });
    const deltas: number[] = [];
    for (const f of envelope(peaks, durationMs)) {
      const frame = { open: f.open, form: 0, shrug: 0, pucker: 0 };
      vmOn.tick(f.t);
      vmOn.setMouth(frame);
      vmOff.tick(f.t);
      vmOff.setMouth(frame);
      vmOn.flushPose();
      vmOff.flushPose();
      deltas.push((on.last.get('ParamAngleY') ?? 0) - (off.last.get('ParamAngleY') ?? 0));
    }
    vmOn.setMouth(null);
    vmOff.setMouth(null);
    for (let t = durationMs + 16; t <= durationMs + 2000; t += 16) {
      vmOn.tick(t);
      vmOff.tick(t);
    }
    vmOn.flushPose();
    vmOff.flushPose();
    return { deltas, after: (on.last.get('ParamAngleY') ?? 0) - (off.last.get('ParamAngleY') ?? 0) };
  }

  test('a stressed syllable produces a nod, and the head returns after it', () => {
    const { deltas, after } = speakPair([2000], 3000);
    expect(Math.max(...deltas.map(Math.abs))).toBeGreaterThan(0.5);
    // The envelope is a half-sine, so a finished pulse contributes exactly nothing — no residue.
    expect(Math.abs(after)).toBeLessThan(0.05);
  });

  // Her built-in breath already swings ParamAngleY by ±8°; a stress that competed with that would be
  // a second animation rather than an accent.
  test('no pulse can move the head further than the declared bound', () => {
    const { deltas } = speakPair([1000, 2000, 3000, 4000, 5000, 6000], 7000);
    expect(Math.max(...deltas.map(Math.abs))).toBeLessThanOrEqual(PULSE_MAX_HEAD_DEG);
  });

  test('the rhythm fuse holds across a very emphatic sentence', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false });
    let fired = 0;
    let wasActive = false;
    const peaks = Array.from({ length: 30 }, (_, i) => 800 + i * 900);
    speak(vm, envelope(peaks, 28_000), (t) => {
      const active = vm.activePulseCount(t) > 0;
      if (active && !wasActive) fired++;
      wasActive = active;
    });
    expect(fired).toBe(6);
  });

  test('the pulse layer touches neither the eyelids nor the mouth', () => {
    const { writer, writes } = countingWriter();
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false, gazeActive: false });
    const before = {
      eyeL: (writes.get('ParamEyeOpenL') ?? []).length,
      mouthForm: new Set(writes.get('ParamMouthForm') ?? []).size,
    };
    speak(vm, envelope([1000, 2500], 4000));
    // The mouth IS written — by the lip-sync, from the frames we fed. What must not happen is the
    // pulse layer adding a second writer to those channels, or touching the eyelids at all.
    expect((writes.get('ParamEyeOpenL') ?? []).length).toBe(before.eyeL);
    expect(before.mouthForm).toBe(0);
  });

  test('the flag off means no detection and no pulses at all', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, {
      rng: () => 0.5,
      idleActionsEnabled: () => false,
      speechPerformanceEnabled: () => false,
    });
    let seen = 0;
    speak(vm, envelope([1000, 2500, 4000], 5000), (t) => {
      seen = Math.max(seen, vm.activePulseCount(t));
    });
    expect(seen).toBe(0);
  });

  test('addPulse is generic — v0.43.13 rides this mechanism, not a new one', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5, idleActionsEnabled: () => false });
    run(vm, 0, 200);
    vm.addPulse({ headRoll: 4 }, 500);
    let peak = 0;
    for (let t = 216; t <= 800; t += 16) {
      vm.tick(t);
      vm.flushPose();
      peak = Math.max(peak, Math.abs(last.get('ParamAngleZ') ?? 0));
    }
    expect(peak).toBeGreaterThan(1);
    run(vm, 816, 2000);
    vm.flushPose();
    expect(vm.activePulseCount()).toBe(0);
  });
});

// v0.43.13 — the punctuation gestures ride v0.43.12's layer through a gated door, so the product
// toggle silences them while the workbench (which calls `addPulse` directly) keeps working.
describe('FaceVm — pulseSpeech is the gated door onto the pulse layer (v0.43.13)', () => {
  test('with the flag on it is exactly addPulse', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5 });
    run(vm, 0, 100);
    vm.pulseSpeech({ headRoll: 4.5 }, 700);
    expect(vm.activePulseCount()).toBe(1);
  });

  test('with the flag off it does nothing', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5, speechPerformanceEnabled: () => false });
    run(vm, 0, 100);
    vm.pulseSpeech({ headRoll: 4.5 }, 700);
    expect(vm.activePulseCount()).toBe(0);
  });

  // The bench is a debugging surface: a product toggle must not make it lie about what it can drive.
  test('the flag never silences the workbench path', () => {
    const { writer } = recorder();
    const vm = new FaceVm(writer, { rng: () => 0.5, speechPerformanceEnabled: () => false });
    run(vm, 0, 100);
    vm.addPulse({ headRoll: 4.5 }, 700);
    expect(vm.activePulseCount()).toBe(1);
  });
});
