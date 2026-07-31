import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import type { Live2DState } from '../sinks';
import {
  applyControl,
  INTENSITY_MARK,
  parseIntensity,
  readout,
  workbenchSections,
  type ControlTarget,
  type WorkbenchControl,
} from './workbench';
import { EMOTIONS, IDLE_PROFILES } from '../live2d/faceData';
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
  test('affect → setExpression, clip → triggerEmotion, state → setState, idle → setIdleProfile', () => {
    const { target, calls } = recorder();
    const controls: WorkbenchControl[] = [
      { kind: 'affect', id: 'bright_delight', label: '' },
      { kind: 'clip', id: 'poutyAnnoyed', label: '' },
      { kind: 'state', id: 'thinking' as Live2DState, label: '' },
      { kind: 'idle', id: 'cuteSwayV1', label: '' },
    ];
    for (const c of controls) applyControl(target, c, 0.5);
    expect(calls).toEqual([
      ['setExpression', 'bright_delight', 0.5],
      ['triggerEmotion', 'poutyAnnoyed', 0.5],
      ['setState', 'thinking'],
      ['setIdleProfile', 'cuteSwayV1'],
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
