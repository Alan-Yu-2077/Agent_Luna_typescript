import { describe, expect, test } from 'bun:test';
import { ModelDriver, type Live2DModelLike } from './modelDriver';

function fakeModel(): { model: Live2DModelLike; pos: { x: number; y: number } } {
  const pos = { x: 0, y: 0 };
  const model: Live2DModelLike = {
    internalModel: { coreModel: { setParameterValueById: () => {} } },
    scale: { set: () => {}, x: 1 },
    position: {
      set: (x: number, y: number) => {
        pos.x = x;
        pos.y = y;
      },
    },
    width: 100,
    height: 200,
  };
  return { model, pos };
}

describe('ModelDriver position channels (v0.25.2)', () => {
  test('position = base + drag + mode, each channel independently updatable', () => {
    const { model, pos } = fakeModel();
    const d = new ModelDriver(model);
    d.setBase(100, 50);
    expect(pos).toEqual({ x: 100, y: 50 });
    d.setPositionOffset(10, -5); // the user's drag
    expect(pos).toEqual({ x: 110, y: 45 });
    d.setModeOffset(300, 0); // a glide in progress
    expect(pos).toEqual({ x: 410, y: 45 });
    // fit() re-centering (setBase) must NOT clobber the drag or the glide
    d.setBase(200, 60);
    expect(pos).toEqual({ x: 510, y: 55 });
    // glide finishes → mode back to 0, drag survives
    d.setModeOffset(0, 0);
    expect(pos).toEqual({ x: 210, y: 55 });
  });
});
