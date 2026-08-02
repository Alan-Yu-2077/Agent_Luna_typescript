import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { COSTUME, COSTUME_IDS, ALL_OVERLAY_PARAMS } from './faceData';
import { costumeWrites, parseCostume, toggleCostume, type CostumeState } from './costume';

const MODEL_INSTALLED = existsSync(join(import.meta.dir, '../../public/models/yumi/yumi.cdi3.json'));

const modelParamIds = (): Set<string> => {
  const cdi: { Parameters: { Id: string }[] } = JSON.parse(
    readFileSync(join(import.meta.dir, '../../public/models/yumi/yumi.cdi3.json'), 'utf8'),
  );
  return new Set(cdi.Parameters.map((p) => p.Id));
};

describe('COSTUME — the third semantic (v0.43.10)', () => {
  test.skipIf(!MODEL_INSTALLED)('every costume param exists on the model', () => {
    const ids = modelParamIds();
    expect(Object.values(COSTUME).filter((c) => !ids.has(c.pid)).map((c) => c.pid)).toEqual([]);
  });

  // The two tables mean different things — an overlay is chosen by the emotion system and lasts as
  // long as its clip; a costume is chosen by the owner and lasts until he changes it. An id in both
  // would mean a clip ending could quietly take his eyepatch off.
  test('costume and overlay params are disjoint sets', () => {
    const overlays = new Set(ALL_OVERLAY_PARAMS);
    expect(Object.values(COSTUME).filter((c) => overlays.has(c.pid)).map((c) => c.pid)).toEqual([]);
  });

  test('the raised arms are NOT costume — a lifted arm is gesture material', () => {
    const pids = Object.values(COSTUME).map((c) => c.pid);
    expect(pids).not.toContain('ParamarmupL');
    expect(pids).not.toContain('ParamarmupR');
  });
});

describe('costume persistence', () => {
  test('a round trip keeps what she is wearing', () => {
    const state = toggleCostume({}, 'eyepatch', true);
    expect(parseCostume(JSON.stringify(state))).toEqual({ eyepatch: true });
  });

  test('malformed or unknown storage never wears something unremovable', () => {
    expect(parseCostume(null)).toEqual({});
    expect(parseCostume('not json')).toEqual({});
    expect(parseCostume('[1,2]')).toEqual({});
    // An id no longer in the catalog is dropped: nothing would ever write 0 to its param again.
    expect(parseCostume('{"ghostHat":true}')).toEqual({});
  });

  test('the hairstyles are mutually exclusive; both off is the drawn default', () => {
    let s: CostumeState = toggleCostume({}, 'longHair', true);
    expect(s).toEqual({ longHair: true });
    s = toggleCostume(s, 'shortHair2', true);
    expect(s).toEqual({ shortHair2: true });
    s = toggleCostume(s, 'shortHair2', false);
    expect(s).toEqual({});
  });

  test('non-grouped items coexist freely', () => {
    let s = toggleCostume({}, 'eyepatch', true);
    s = toggleCostume(s, 'mic', true);
    expect(s).toEqual({ eyepatch: true, mic: true });
  });

  test('an unknown id is a no-op, not a crash', () => {
    expect(toggleCostume({ mic: true }, 'nope', true)).toEqual({ mic: true });
  });

  // The write set is total on purpose: a removed item needs an explicit release, exactly like
  // ALL_OVERLAY_PARAMS being written whole every frame.
  test('every catalog item is written on every change — removals are released, not forgotten', () => {
    const writes = costumeWrites({ eyepatch: true });
    expect(writes.length).toBe(COSTUME_IDS.length);
    expect(writes).toContainEqual(['Paramyanzhao', 1]);
    expect(writes).toContainEqual(['Paramhuatong', null]);
    expect(writes).toContainEqual(['Paramlonghair', null]);
  });

  test('wearing nothing releases everything', () => {
    expect(costumeWrites({}).every(([, v]) => v === null)).toBe(true);
  });
});
