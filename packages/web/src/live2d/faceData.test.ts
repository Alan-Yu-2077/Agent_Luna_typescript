import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { ALL_OVERLAY_PARAMS, EMOTIONS, OVERLAYS } from './faceData';

// The model's real parameter inventory, read from the file the artist shipped. Overlays address raw
// Cubism ids by string, so a typo is otherwise a silent no-op — the face just quietly lacks a feature.
const MODEL_DIR = join(import.meta.dir, '../../public/models/yumi');
// Bring-your-own asset: the model tree is gitignored, so CI runners have none. These assertions are
// about the REAL installed model (a fixture would test nothing) — they run on the owner's machine
// and skip, loudly named, anywhere the model is absent.
const MODEL_INSTALLED = existsSync(join(MODEL_DIR, 'yumi.cdi3.json'));
function modelParamIds(): Set<string> {
  const cdi: { Parameters: { Id: string }[] } = JSON.parse(readFileSync(join(MODEL_DIR, 'yumi.cdi3.json'), 'utf8'));
  return new Set(cdi.Parameters.map((p) => p.Id));
}

// v0.43.1: the model ships these as costume/prop toggles. They are drawn assets exactly like the
// emotional ones, which is precisely why the boundary has to be enforced rather than remembered —
// nothing in the file format distinguishes "heart eyes" from "holds a microphone".
const COSTUME_AND_PROPS = [
  'ParamarmupL', 'ParamarmupR', // 抬手左 / 抬手右
  'Paramhuatong', // 拿话筒
  'Paramxiaogou', // 漂浮小狗
  'Paramyanzhao', // 眼罩
  'Paramlonghair', 'Paramlonghair2', // 短发 1 / 2
];

describe('OVERLAYS — the model\'s own peak assets', () => {
  test.skipIf(!MODEL_INSTALLED)('every overlay param actually exists on the model', () => {
    const ids = modelParamIds();
    const missing = ALL_OVERLAY_PARAMS.filter((p) => !ids.has(p));
    expect(missing).toEqual([]);
  });

  test('no costume or prop asset is reachable through an overlay', () => {
    const leaked = ALL_OVERLAY_PARAMS.filter((p) => COSTUME_AND_PROPS.includes(p));
    expect(leaked).toEqual([]);
  });

  test('ALL_OVERLAY_PARAMS covers every param in the table — a missed one would latch on forever', () => {
    // faceVm zeroes exactly this list each frame; anything outside it can be set but never cleared.
    const declared = new Set(ALL_OVERLAY_PARAMS);
    const used = Object.values(OVERLAYS).flatMap((o) => Object.keys(o));
    expect(used.filter((p) => !declared.has(p))).toEqual([]);
  });

  test('the four v0.43.1 additions are wired to the emotions that earn them', () => {
    const refs = (id: keyof typeof EMOTIONS): string[] => EMOTIONS[id].overlayRefs;
    expect(refs('adorable')).toContain('爱心眼');
    expect(refs('playful')).toContain('星星眼');
    expect(refs('awkwardV2')).toContain('蚊香眼');
    expect(refs('disappointed')).toContain('眼泪');
  });
});

describe('EMOTIONS — referential integrity', () => {
  test('no overlayRef points at an overlay that does not exist', () => {
    const dangling: string[] = [];
    for (const [id, def] of Object.entries(EMOTIONS)) {
      for (const ref of def.overlayRefs) if (!(ref in OVERLAYS)) dangling.push(`${id} → ${ref}`);
    }
    expect(dangling).toEqual([]);
  });

  test('a restrained clip stays restrained — no emotion carries more than three overlays', () => {
    // Overlays are full-strength drawn assets; stacking them reads as a costume change, not a mood.
    for (const [id, def] of Object.entries(EMOTIONS)) {
      expect(`${id}:${def.overlayRefs.length <= 3}`).toBe(`${id}:true`);
    }
  });
});
