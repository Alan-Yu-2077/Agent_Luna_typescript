import { describe, expect, test } from 'bun:test';
import { FaceVm, type ParamWriter } from './faceVm';

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
    const vm = new FaceVm(writer);
    vm.setExpression('shy_softness', 1); // → shy (mouthPucker −0.32, 脸红 overlay)
    run(vm, 0, 3000); // past intro (980ms) into perform
    expect(last.get('ParamMouthpucker') ?? 0).toBeLessThan(-0.15);
    expect(last.get('Paramsmileshy') ?? 0).toBeGreaterThan(0.5);
  });

  test('steady_presence is the baseline — no emotion, overlays stay 0', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setExpression('steady_presence');
    run(vm, 0, 1000);
    expect(last.get('Paramsmileshy') ?? 0).toBe(0);
    expect(last.get('Paramheilian') ?? 0).toBe(0);
  });

  test('an emotion releases after its timeline', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setExpression('shy_softness', 1);
    run(vm, 0, 3000);
    expect(last.get('ParamMouthpucker') ?? 0).toBeLessThan(-0.15);
    run(vm, 3016, 12000); // past perform(5600)+outro(1300) → cleared
    expect(Math.abs(last.get('ParamMouthpucker') ?? 0)).toBeLessThan(0.05);
  });

  test('a lip-sync frame owns the mouth (overrides emotion, drives 4 params)', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
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
    const vm = new FaceVm(writer);
    vm.setMouth({ open: 0.9, form: 0.3, shrug: 0.1, pucker: -0.4 });
    run(vm, 0, 500);
    vm.setMouth(null);
    run(vm, 516, 3000);
    expect(last.get('ParamMouthOpenY') ?? 1).toBeLessThan(0.1);
  });

  test('sleeping closes the eyes', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setState('sleeping');
    run(vm, 0, 4000);
    expect(last.get('ParamEyeOpenL') ?? 1).toBeLessThan(0.1);
  });

  test('head/body pose writes only via flushPose (pre-physics), not tick', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setState('sleeping'); // STATE_BIAS: headPitch -10 (→ ParamAngleY), headRoll 6
    run(vm, 0, 2000);
    expect(last.has('ParamAngleY')).toBe(false); // tick smooths pose but does not write it
    vm.flushPose();
    expect(Math.abs(last.get('ParamAngleY') ?? 0)).toBeGreaterThan(2); // now written from cur
  });

  test('triggerEmotion plays a named preset directly; bad id is a no-op', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    expect(vm.listEmotions()).toContain('shy');
    vm.triggerEmotion('does-not-exist'); // guarded — must not throw or queue
    run(vm, 0, 100);
    vm.triggerEmotion('shy', 1);
    run(vm, 116, 3000);
    expect(last.get('Paramsmileshy') ?? 0).toBeGreaterThan(0.5);
  });

  test('emotion intensity scales expression strength', () => {
    const full = recorder();
    const fvm = new FaceVm(full.writer);
    fvm.setExpression('annoyed_resistance', 1);
    run(fvm, 0, 3000);
    const half = recorder();
    const hvm = new FaceVm(half.writer);
    hvm.setExpression('annoyed_resistance', 0.5);
    run(hvm, 0, 3000);
    expect(Math.abs(full.last.get('ParamMouthForm') ?? 0)).toBeGreaterThan(
      Math.abs(half.last.get('ParamMouthForm') ?? 0),
    );
  });
});
