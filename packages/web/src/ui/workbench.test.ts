import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import type { Live2DState } from '../sinks';
import {
  applyControl,
  COMPOSE_GROUPS,
  composeChannels,
  composeEmotionDef,
  composeFromClip,
  COSTUME_NOTE,
  ENTRY_FRACTION,
  exportEmotionDef,
  inferOwns,
  INTENSITY_MARK,
  MODEL_ASSETS,
  parseIntensity,
  readout,
  workbenchSections,
  type ControlTarget,
  type WorkbenchControl,
} from './workbench';
import { ACTIONS, ALL_OVERLAY_PARAMS, EMOTIONS, IDLE_PROFILES, type EmotionDef } from '../live2d/faceData';
import { FACE_STATE_KEYS } from '../live2d/paramMap';
import { affectToEmotion, HIGH_INTENSITY } from '../live2d/expressionMap';
import { PERF_FLAGS } from '../live2d/perfFlags';

type Call = [string, ...unknown[]];

function recorder(): { target: ControlTarget; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    target: {
      setExpression: (key, emotion) => calls.push(['setExpression', key, emotion]),
      setState: (state) => calls.push(['setState', state]),
      triggerEmotion: (id, intensity) => calls.push(['triggerEmotion', id, intensity]),
      setIdleProfile: (id) => calls.push(['setIdleProfile', id]),
      playAction: (name, intensity) => calls.push(['playAction', name, intensity]),
      setManualParam: (pid, v) => calls.push(['setManualParam', pid, v]),
    },
  };
}

describe('workbenchSections — derived from the engine tables, never hand-listed', () => {
  const sections = workbenchSections();
  const by = (id: string) => sections.find((s) => s.id === id);

  test('one button per wire affect', () => {
    expect(by('affect')?.controls.map((c) => c.id)).toEqual([...ExpressionKey.options]);
  });

  test('one button per authored clip — including the four only v0.43.2 made reachable', () => {
    const ids = by('clip')?.controls.map((c) => c.id) ?? [];
    expect(ids).toEqual(Object.keys(EMOTIONS));
    for (const id of ['fakeFierce', 'embarrassed', 'poutyAnnoyed', 'disappointed']) {
      expect(ids).toContain(id);
    }
  });

  test('the four coarse states and the five idle profiles', () => {
    expect(by('state')?.controls.map((c) => c.id)).toEqual([
      'neutral',
      'thinking',
      'speaking',
      'sleeping',
    ]);
    expect(by('idle')?.controls.map((c) => c.id)).toEqual(IDLE_PROFILES.map((p) => p.id));
  });

  test('every control carries a label — a bench of blank buttons is not a bench', () => {
    for (const s of sections) for (const c of s.controls) expect(c.label.length).toBeGreaterThan(0);
  });

  test('the slider tick mark IS the escalation threshold, not a copy of it', () => {
    expect(INTENSITY_MARK).toBe(HIGH_INTENSITY);
  });

  test('the flag list covers the five per-tick keys the engine reads', () => {
    expect(PERF_FLAGS.map((f) => f.key)).toEqual([
      'luna:gaze-follow',
      'luna:affect',
      'luna:live-peak',
      'luna:short-clips',
      'luna:idle-actions',
    ]);
  });
});

describe('applyControl — each kind reaches the sink method that performs it', () => {
  test('affect, clip, state, idle and gesture each dispatch to their own method', () => {
    const { target, calls } = recorder();
    const controls: WorkbenchControl[] = [
      { kind: 'affect', id: 'bright_delight', label: '' },
      { kind: 'clip', id: 'poutyAnnoyed', label: '' },
      { kind: 'state', id: 'thinking' as Live2DState, label: '' },
      { kind: 'idle', id: 'cuteSwayV1', label: '' },
      { kind: 'action', id: 'sighRelease', label: '' },
    ];
    for (const c of controls) applyControl(target, c, 0.5);
    expect(calls).toEqual([
      ['setExpression', 'bright_delight', 0.5],
      ['triggerEmotion', 'poutyAnnoyed', 0.5],
      ['setState', 'thinking'],
      ['setIdleProfile', 'cuteSwayV1'],
      ['playAction', 'sighRelease', 0.5],
    ]);
  });

  test('a target missing the optional methods does not throw', () => {
    const bare: ControlTarget = { setExpression: () => {}, setState: () => {} };
    expect(() => applyControl(bare, { kind: 'clip', id: 'shy', label: '' }, 1)).not.toThrow();
    expect(() =>
      applyControl(bare, { kind: 'idle', id: 'cuteSwayV1', label: '' }, 1),
    ).not.toThrow();
  });
});

// The point of the slider: the intensity must arrive at `setExpression` EXACTLY, because that value
// is what v0.43.2's branch reads. Rounding it anywhere in the UI silently deletes the high half.
describe('the intensity slider drives the escalation branch end to end', () => {
  const forward = (raw: string): number | undefined => {
    const { target, calls } = recorder();
    applyControl(target, { kind: 'affect', id: 'annoyed_resistance', label: '' }, parseIntensity(raw));
    return calls[0]?.[2] as number | undefined;
  };

  test('just under the mark stays the flat look, at the mark it puffs up', () => {
    const low = forward('0.69');
    const high = forward('0.7');
    expect(affectToEmotion('annoyed_resistance', low)).toBe('annoyed');
    expect(affectToEmotion('annoyed_resistance', high)).toBe('poutyAnnoyed');
  });

  test('parseIntensity clamps and survives a blank field', () => {
    expect(parseIntensity('0.7')).toBe(0.7);
    expect(parseIntensity('')).toBe(0.95);
    expect(parseIntensity('9')).toBe(1);
    expect(parseIntensity('-2')).toBe(0);
  });
});

describe('readout — the live panel degrades instead of lying', () => {
  test('no bridge yet reads as blank, not as a state that is not happening', () => {
    expect(readout(undefined)).toEqual({ mood: '—', playback: 'idle', actions: '—' });
  });

  test('a live bridge names the clip, its phase and the running gestures', () => {
    expect(
      readout({
        mood: () => 'warm · calm · yielding (v+0.55 a-0.10 d-0.20)',
        playback: () => ({ id: 'adorable', intensity: 0.9, phase: 'perform' }),
        faceVm: { activeActionIds: () => ['sighRelease', 'headLowerShy'] },
      }),
    ).toEqual({
      mood: 'warm · calm · yielding (v+0.55 a-0.10 d-0.20)',
      playback: 'adorable · perform · 0.90',
      actions: 'sighRelease, headLowerShy',
    });
  });

  test('an idle model reports idle rather than the last clip it played', () => {
    const r = readout({ mood: () => 'x', playback: () => null, faceVm: { activeActionIds: () => [] } });
    expect(r.playback).toBe('idle');
    expect(r.actions).toBe('—');
  });
});

// v0.43.8 — the 17 drawn assets. The list is hardcoded (the model tree is gitignored and the bundler
// cannot enumerate it), so the guard is the same one v0.43.1 used: check it against the file the
// artist shipped. A typo'd id is otherwise a checkbox that silently does nothing.
describe('MODEL_ASSETS — the hardcoded catalog matches the real model', () => {
  const modelParamIds = (): Set<string> => {
    const cdi: { Parameters: { Id: string }[] } = JSON.parse(
      readFileSync(join(import.meta.dir, '../../public/models/yumi/yumi.cdi3.json'), 'utf8'),
    );
    return new Set(cdi.Parameters.map((p) => p.Id));
  };

  test('every asset param exists on the model', () => {
    const ids = modelParamIds();
    expect(MODEL_ASSETS.filter((a) => !ids.has(a.pid)).map((a) => a.pid)).toEqual([]);
  });

  test('the catalog covers all 17 shipped exp3 assets, with no duplicates', () => {
    expect(MODEL_ASSETS.length).toBe(17);
    expect(new Set(MODEL_ASSETS.map((a) => a.pid)).size).toBe(17);
  });

  test('the costume group is exactly what the emotion system is walled off from', () => {
    const costume = MODEL_ASSETS.filter((a) => a.group === 'costume').map((a) => a.pid).sort();
    expect(costume).toEqual(
      [
        'Paramyanzhao',
        'Paramhuatong',
        'Paramxiaogou',
        'Paramlonghair',
        'Paramlonghair2',
        'ParamarmupL',
        'ParamarmupR',
        'Paramdown1',
      ].sort(),
    );
  });

  // The wall v0.43.1 built stands: nothing here re-opens automatic selection over the props. This
  // catalog is reachable only from the bench, i.e. only by the owner's hand.
  test('no prop leaked into an emotion overlay', () => {
    const props = new Set(MODEL_ASSETS.filter((a) => a.group === 'costume').map((a) => a.pid));
    // `Paramdown1` IS in OVERLAYS (adorable's bow) — the wall is about the OTHER seven.
    const leaked = ALL_OVERLAY_PARAMS.filter((p) => props.has(p) && p !== 'Paramdown1');
    expect(leaked).toEqual([]);
  });

  test('the costume group carries the note saying the emotion system will not touch them', () => {
    expect(COSTUME_NOTE).toContain('never touches these');
  });
});

describe('workbenchSections — the gesture section (v0.43.8)', () => {
  test('one button per authored gesture, derived from ACTIONS', () => {
    const section = workbenchSections().find((s) => s.id === 'action');
    expect(section?.controls.map((c) => c.id)).toEqual(Object.keys(ACTIONS));
    expect(section?.controls.length).toBe(9);
  });
});

// v0.43.9 — the composer's data layer. The export is the deliverable: numbers that paste into
// `faceData.ts` and mean there what they meant on the bench.
describe('composeChannels — sliders bounded by the engine, not by guesswork', () => {
  const channels = composeChannels();
  const byKey = (k: string) => channels.find((c) => c.key === k);

  test('one slider per state channel, all 35', () => {
    expect(channels.map((c) => c.key)).toEqual([...FACE_STATE_KEYS]);
  });

  test('bounds come from clampStateValue, so a slider cannot travel where the engine clamps', () => {
    expect(byKey('eyeOpenL')).toMatchObject({ min: 0, max: 1 });
    expect(byKey('browLY')).toMatchObject({ min: -1, max: 1 });
    expect(byKey('mouthShrug')).toMatchObject({ min: -2, max: 2 });
    expect(byKey('jawOpen')).toMatchObject({ min: 0, max: 2 });
  });

  test('the unclamped angle channels get the model working range instead of infinity', () => {
    expect(byKey('headPitch')).toMatchObject({ min: -30, max: 30 });
  });

  test('pupil channels get a slider even though they belong to no engine group', () => {
    expect(byKey('pupilX')?.group).toBe('pupil');
    expect(COMPOSE_GROUPS['pupil']).toEqual(['pupilX', 'pupilY']);
  });
});

describe('the compose export', () => {
  test('load → export is lossless on the sustained pose', () => {
    const loaded = composeFromClip('shy');
    const def = composeEmotionDef(loaded);
    expect(def.sustainedState).toEqual(EMOTIONS.shy.sustainedState);
  });

  test('owns is inferred from which groups the pose actually touches', () => {
    expect(inferOwns({ browLY: -0.5 })).toEqual(['brows']);
    expect(inferOwns({ cheekPuff: 1, mouthForm: -0.3 }).sort()).toEqual(['mouth', 'specials']);
    // pupil is in no group on purpose (v0.43.3) — it must never become ownable.
    expect(inferOwns({ pupilX: 0.4 })).toEqual([]);
  });

  test('channels left at their default are omitted, not exported as zeroes', () => {
    const def = composeEmotionDef({ browLY: -0.5, headPitch: 0, eyeOpenL: 1 });
    expect(Object.keys(def.sustainedState)).toEqual(['browLY']);
  });

  test('entryState is the documented approximation, and says so in the JSON', () => {
    const def = composeEmotionDef({ cheekPuff: 1 });
    expect(def.entryState['cheekPuff']).toBeCloseTo(ENTRY_FRACTION, 6);
    const json = JSON.parse(exportEmotionDef({ cheekPuff: 1 })) as Record<string, unknown>;
    expect(String(json['//'])).toContain('tune it by hand');
  });

  test('the export parses back into the EmotionDef shape faceData.ts expects', () => {
    const json = JSON.parse(exportEmotionDef(composeFromClip('disappointed'))) as EmotionDef;
    expect(typeof json.timeline.introMs).toBe('number');
    expect(typeof json.timeline.performMs).toBe('number');
    expect(typeof json.timeline.outroMs).toBe('number');
    expect(Array.isArray(json.owns)).toBe(true);
    expect(Array.isArray(json.actionRefs)).toBe(true);
    expect(Array.isArray(json.overlayRefs)).toBe(true);
    expect(Array.isArray(json.physicsPassthrough)).toBe(true);
    expect(Object.keys(json.sustainedState).length).toBeGreaterThan(0);
  });

  test('an unknown clip id loads an empty pose rather than throwing', () => {
    expect(composeFromClip('does-not-exist')).toEqual({});
  });
});
