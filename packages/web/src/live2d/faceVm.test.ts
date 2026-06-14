import { describe, expect, test } from 'bun:test';
import { FaceVm, type ParamWriter } from './faceVm';

function recorder(): { writer: ParamWriter; last: Map<string, number> } {
  const last = new Map<string, number>();
  return { writer: { setParam: (id, v) => last.set(id, v) }, last };
}

describe('FaceVm', () => {
  test('an expression drives its mapped params toward target over ticks', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setExpression('bright_delight', 1);
    for (let i = 0; i < 200; i++) vm.tick(i * 16);
    expect(last.get('ParamMouthForm') ?? 0).toBeCloseTo(0.9, 1);
  });

  test('clear releases displaced params back toward neutral', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setExpression('bright_delight', 1);
    for (let i = 0; i < 50; i++) vm.tick(i * 16);
    vm.clear();
    for (let i = 0; i < 400; i++) vm.tick((50 + i) * 16);
    expect(Math.abs(last.get('ParamMouthForm') ?? 0)).toBeLessThan(0.05);
  });

  test('speaking state opens the mouth with the lip-sync value', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setState('speaking');
    vm.setMouth(0.8);
    for (let i = 0; i < 200; i++) vm.tick(i * 16);
    expect(last.get('ParamMouthOpenY') ?? 0).toBeCloseTo(0.8, 1);
  });

  test('sleeping closes the eyes', () => {
    const { writer, last } = recorder();
    const vm = new FaceVm(writer);
    vm.setState('sleeping');
    for (let i = 0; i < 300; i++) vm.tick(i * 16);
    expect(last.get('ParamEyeOpenL') ?? 1).toBeLessThan(0.05);
  });
});
