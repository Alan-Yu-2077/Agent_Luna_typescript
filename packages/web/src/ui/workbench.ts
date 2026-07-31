import { ExpressionKey } from '@luna/protocol';
import type { Live2DSink, Live2DState } from '../sinks';
import { EMOTIONS, IDLE_PROFILES } from '../live2d/faceData';
import { HIGH_INTENSITY } from '../live2d/expressionMap';
import { GAZE_KEY, PERF_FLAGS, flagOn, setFlag } from '../live2d/perfFlags';

// v0.43.7 — the Live2D workbench. Six versions of expressive machinery accumulated behind one
// observable surface (her final face) and one console bridge, and the owner said it plainly: the
// system had outgrown what a human could debug by looking at it. This is the control panel: every
// affect, clip, state, idle profile and flag as a button, on the same renderer the real app uses.
//
// The split below is not decoration. Everything above `mountWorkbench` is data — derived from the
// same tables the engine reads, so a new affect or clip appears here without anyone remembering to
// add it — and that half is what the tests drive. `mountWorkbench` is DOM assembly over it.

export type WorkbenchControl =
  | { kind: 'affect'; id: ExpressionKey; label: string }
  | { kind: 'clip'; id: string; label: string }
  | { kind: 'state'; id: Live2DState; label: string }
  | { kind: 'idle'; id: string; label: string };

export type WorkbenchSection = {
  id: 'affect' | 'clip' | 'state' | 'idle';
  title: string;
  hint: string;
  controls: WorkbenchControl[];
};

export const WORKBENCH_STATES: readonly Live2DState[] = ['neutral', 'thinking', 'speaking', 'sleeping'];

// The intensity slider's tick mark. Imported, never re-typed: a mark at 0.7 next to a branch at 0.75
// would be a bench that teaches the wrong number.
export const INTENSITY_MARK = HIGH_INTENSITY;

const titleCase = (id: string): string =>
  id.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

export function workbenchSections(): WorkbenchSection[] {
  return [
    {
      id: 'affect',
      title: 'Affect',
      hint: `the 15 wire keys — the slider crosses the ${INTENSITY_MARK} branch`,
      controls: ExpressionKey.options.map((id) => ({ kind: 'affect', id, label: titleCase(id) })),
    },
    {
      id: 'clip',
      title: 'Clip',
      hint: 'every authored performance, played directly',
      controls: Object.keys(EMOTIONS).map((id) => ({ kind: 'clip', id, label: titleCase(id) })),
    },
    {
      id: 'state',
      title: 'State',
      hint: 'the coarse posture the turn loop drives',
      controls: WORKBENCH_STATES.map((id) => ({ kind: 'state', id, label: titleCase(id) })),
    },
    {
      id: 'idle',
      title: 'Idle',
      hint: 'the resting animation underneath everything',
      controls: IDLE_PROFILES.map((p) => ({ kind: 'idle', id: p.id, label: p.label })),
    },
  ];
}

// Exactly the optional half of Live2DSink the bench drives. Typing it structurally (rather than
// against the concrete pixi sink) is what lets the dispatch below be tested against a recorder.
export type ControlTarget = Pick<Live2DSink, 'setExpression' | 'setState'> &
  Partial<Pick<Live2DSink, 'triggerEmotion' | 'setIdleProfile' | 'setGazeFollow'>>;

export function applyControl(target: ControlTarget, c: WorkbenchControl, intensity: number): void {
  switch (c.kind) {
    case 'affect':
      // The raw slider value goes through undefined-free: `setExpression` treats it as the escalation
      // input, so rounding or defaulting it here would quietly disable the whole high branch.
      target.setExpression(c.id, intensity);
      return;
    case 'clip':
      target.triggerEmotion?.(c.id, intensity);
      return;
    case 'state':
      target.setState(c.id);
      return;
    case 'idle':
      target.setIdleProfile?.(c.id);
      return;
  }
}

// A slider reports a string. `0.7` arriving as `0.5` (a stepped input) or `NaN` (an empty field)
// both silently defeat the branch, so the parse is explicit and clamped.
export function parseIntensity(raw: string): number {
  const v = Number.parseFloat(raw);
  if (Number.isNaN(v)) return 0.95;
  return Math.max(0, Math.min(1, v));
}

export type WorkbenchReadout = { mood: string; playback: string; actions: string };

export type DebugBridge = {
  mood?: () => string;
  playback?: () => { id: string; intensity: number; phase: string } | null;
  faceVm?: { activeActionIds(): string[] };
};

export function readout(bridge: DebugBridge | undefined): WorkbenchReadout {
  const pb = bridge?.playback?.();
  const actions = bridge?.faceVm?.activeActionIds() ?? [];
  return {
    mood: bridge?.mood?.() ?? '—',
    playback: pb ? `${pb.id} · ${pb.phase} · ${pb.intensity.toFixed(2)}` : 'idle',
    actions: actions.length > 0 ? actions.join(', ') : '—',
  };
}

const READOUT_MS = 500;

export type WorkbenchDeps = {
  // A thunk, not a value: the drawer is built before the model finishes loading (a model load is a
  // network fetch and a WebGL context), so the buttons must exist and then find their target.
  target: () => ControlTarget | null;
  bridge?: () => DebugBridge | undefined;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  onBack?: () => void;
};

// The DOM half. Left: the live model stage the caller fills with the real sink. Right: the drawer,
// one `<section>` per group so v0.43.8's asset rows and v0.43.9's composer append instead of
// rearranging.
export function mountWorkbench(root: HTMLElement, deps: WorkbenchDeps): { stage: HTMLElement; dispose: () => void } {
  const doc = root.ownerDocument;
  root.classList.add('workbench');
  root.replaceChildren();

  const stage = doc.createElement('div');
  stage.className = 'wb-stage';
  // Same placeholder markup the main layout builds, so `applyEmptyState` works here unchanged —
  // a bench opened from an external browser with no model resolved must say so, not show a void.
  const ph = doc.createElement('div');
  ph.className = 'model-placeholder';
  const phParts: ReadonlyArray<readonly [string, string]> = [
    ['ph-circle', '🌙'],
    ['label', 'No avatar installed'],
    ['sub', ''],
  ];
  for (const [cls, text] of phParts) {
    const el = doc.createElement('div');
    el.className = cls;
    el.textContent = text;
    ph.appendChild(el);
  }
  stage.appendChild(ph);
  root.appendChild(stage);

  const drawer = doc.createElement('div');
  drawer.className = 'wb-drawer';
  root.appendChild(drawer);

  const head = doc.createElement('div');
  head.className = 'wb-head';
  const back = doc.createElement('button');
  back.type = 'button';
  back.className = 'wb-back';
  back.textContent = '← Back';
  back.addEventListener('click', () => deps.onBack?.());
  head.appendChild(back);
  const title = doc.createElement('span');
  title.className = 'wb-title';
  title.textContent = 'Live2D workbench';
  head.appendChild(title);
  drawer.appendChild(head);

  // Intensity first: it is an argument to everything below it, so it reads as one.
  const intensityRow = doc.createElement('label');
  intensityRow.className = 'wb-intensity';
  const intensityLabel = doc.createElement('span');
  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = '0.95';
  let intensity = parseIntensity(slider.value);
  const paintIntensity = (): void => {
    intensityLabel.textContent = `Intensity ${intensity.toFixed(2)}${intensity >= INTENSITY_MARK ? ' · escalated' : ''}`;
    intensityRow.classList.toggle('high', intensity >= INTENSITY_MARK);
  };
  slider.addEventListener('input', () => {
    intensity = parseIntensity(slider.value);
    paintIntensity();
  });
  paintIntensity();
  intensityRow.append(intensityLabel, slider);
  const mark = doc.createElement('span');
  mark.className = 'wb-mark';
  mark.style.left = `${INTENSITY_MARK * 100}%`;
  mark.title = `${INTENSITY_MARK} — above this, four affects escalate`;
  intensityRow.appendChild(mark);
  drawer.appendChild(intensityRow);

  for (const section of workbenchSections()) {
    const el = doc.createElement('section');
    el.className = 'wb-section';
    el.dataset['section'] = section.id;
    const h = doc.createElement('h3');
    h.textContent = section.title;
    const hint = doc.createElement('p');
    hint.className = 'wb-hint';
    hint.textContent = section.hint;
    const grid = doc.createElement('div');
    grid.className = 'wb-grid';
    for (const c of section.controls) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'wb-btn';
      b.dataset['control'] = `${c.kind}:${c.id}`;
      b.textContent = c.label;
      b.addEventListener('click', () => {
        const target = deps.target();
        if (target) applyControl(target, c, intensity);
        for (const sib of grid.querySelectorAll('.wb-btn.on')) sib.classList.remove('on');
        if (section.id === 'state' || section.id === 'idle') b.classList.add('on');
      });
      grid.appendChild(b);
    }
    el.append(h, hint, grid);
    drawer.appendChild(el);
  }

  const flags = doc.createElement('section');
  flags.className = 'wb-section';
  flags.dataset['section'] = 'flags';
  const fh = doc.createElement('h3');
  fh.textContent = 'Flags';
  const fhint = doc.createElement('p');
  fhint.className = 'wb-hint';
  fhint.textContent = 'the same localStorage keys the settings card writes — read every tick';
  flags.append(fh, fhint);
  for (const f of PERF_FLAGS) {
    const row = doc.createElement('label');
    row.className = 'wb-flag';
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.checked = flagOn(f.key, deps.storage ?? undefined);
    box.dataset['flag'] = f.key;
    box.addEventListener('change', () => {
      setFlag(f.key, box.checked, deps.storage ?? undefined);
      // Gaze-follow is the one flag the sink caches at construction rather than reading per tick.
      if (f.key === GAZE_KEY) deps.target()?.setGazeFollow?.(box.checked);
    });
    const text = doc.createElement('span');
    text.textContent = `${f.label} — ${f.hint}`;
    row.append(box, text);
    flags.appendChild(row);
  }
  drawer.appendChild(flags);

  const readoutEl = doc.createElement('section');
  readoutEl.className = 'wb-section wb-readout';
  readoutEl.dataset['section'] = 'readout';
  const rh = doc.createElement('h3');
  rh.textContent = 'Live';
  const moodEl = doc.createElement('p');
  const clipEl = doc.createElement('p');
  const actEl = doc.createElement('p');
  readoutEl.append(rh, moodEl, clipEl, actEl);
  drawer.appendChild(readoutEl);

  const paint = (): void => {
    const r = readout(deps.bridge?.());
    moodEl.textContent = `mood — ${r.mood}`;
    clipEl.textContent = `clip — ${r.playback}`;
    actEl.textContent = `actions — ${r.actions}`;
  };
  paint();
  const timer = setInterval(paint, READOUT_MS);

  return { stage, dispose: () => clearInterval(timer) };
}
