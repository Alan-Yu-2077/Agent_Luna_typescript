import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import type { Live2DState } from '../sinks';
import {
  applyControl,
  COSTUME_NOTE,
  INTENSITY_MARK,
  MODEL_ASSETS,
  parseIntensity,
  readout,
  workbenchSections,
  type ControlTarget,
  type WorkbenchControl,
} from './workbench';
import { ACTIONS, ALL_OVERLAY_PARAMS, EMOTIONS, IDLE_PROFILES } from '../live2d/faceData';
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
