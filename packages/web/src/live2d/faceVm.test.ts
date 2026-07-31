import { describe, expect, test } from 'bun:test';
import { FaceVm, type ParamWriter } from './faceVm';
import { AffectState } from './affect';
import { EMOTIONS, FACE_PARAM_GAIN } from './faceData';
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
  ): { frozenFrames: number; frames: number; range: number } {
    // One sample per FRAME, not per setParam call: the mouth channels are written twice a frame (the
    // main loop, then the lip-sync ownership block), and counting both would read the duplicate as a
    // frozen frame.
    const vals: number[] = [];
    let now = 0;
    let frameValue: number | undefined;
    const writer: ParamWriter = { setParam: (p, v) => { if (p === pid) frameValue = v; } };
    const vm = new FaceVm(writer, { rng: () => 0.5, livePeakEnabled: () => livePeak });
    vm.setExpression(clip, 1);
    for (now = 0; now <= 6000; now += 16) {
      frameValue = undefined;
      vm.tick(now);
      if (now >= 2000 && frameValue !== undefined) vals.push(frameValue);
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
      expect(`${pid}:${frozenFrames}/${frames > 200}`).toBe(`${pid}:0/true`);
    }
  });

  test('…and the swing is large enough for a person to see, not merely for a test to measure', () => {
    // The v0.42.4 lesson: direction/ordering assertions pass happily on motion nobody can perceive.
    for (const [pid, clip] of THAWED) {
      expect(`${pid}:${perform(pid, true, clip).range > 0.01}`).toBe(`${pid}:true`);
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
