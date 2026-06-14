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

  test('speaking state opens the mouth with the lip-sync value', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setState('speaking');
    vm.setMouth(0.8);
    run(vm, 0, 2000);
    expect(last.get('ParamMouthOpenY') ?? 0).toBeCloseTo(0.8, 1);
  });

  test('sleeping closes the eyes', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setState('sleeping');
    run(vm, 0, 4000);
    expect(last.get('ParamEyeOpenL') ?? 1).toBeLessThan(0.1);
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
