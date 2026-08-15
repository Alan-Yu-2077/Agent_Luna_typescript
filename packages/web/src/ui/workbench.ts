import { ExpressionKey } from '@luna/protocol';
import type { Live2DSink, Live2DState } from '../sinks';
import {
  ACTIONS,
  COSTUME,
  EMOTIONS,
  FACE_CHANNEL_GROUPS,
  IDLE_PROFILES,
  timelineFor,
  type EmotionDef,
  type FaceChannel,
  type Pose,
} from '../live2d/faceData';
import {
  FACE_STATE_KEYS,
  FACE_VM_DEFAULT_STATE,
  clampStateValue,
  type FaceStateKey,
} from '../live2d/paramMap';
import { HIGH_INTENSITY } from '../live2d/expressionMap';
import { GAZE_KEY, PERF_FLAGS, flagOn, setFlag } from '../live2d/perfFlags';
import { costumeWrites, loadCostume, saveCostume, toggleCostume } from '../live2d/costume';

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
  | { kind: 'idle'; id: string; label: string }
  | { kind: 'action'; id: string; label: string };

export type WorkbenchSection = {
  id: 'affect' | 'clip' | 'state' | 'idle' | 'action';
  title: string;
  hint: string;
  controls: WorkbenchControl[];
};

// v0.43.8 — the model's 17 `.exp3.json` assets, addressable by hand.
//
// Hardcoded on purpose. The model tree is gitignored (F31) and the bundler cannot enumerate a
// directory at build time, so the honest options are a hardcoded list checked against the real
// `yumi.cdi3.json` by a test, or a runtime directory listing that does not exist. Same choice
// v0.43.1 made for `OVERLAYS`, same guard.
//
// The split is the whole point. `emotion` assets are ones the clip layer may drive on its own;
// `costume` assets are ones it must NEVER touch (v0.43.1's hard test) — she does not produce a
// microphone mid-apology. Here they are all reachable because this is the owner's hand, not hers.
export type ModelAsset = { pid: string; label: string; group: 'emotion' | 'costume' };

export const MODEL_ASSETS: readonly ModelAsset[] = [
  { pid: 'Paramheart', label: '爱心眼', group: 'emotion' },
  { pid: 'Paramxingxing', label: '星星眼', group: 'emotion' },
  { pid: 'Paramleiwangwang', label: '泪汪汪', group: 'emotion' },
  { pid: 'Paramtear', label: '眼泪', group: 'emotion' },
  { pid: 'Paramheilian', label: '黑脸', group: 'emotion' },
  { pid: 'Paramwenxiang', label: '蚊香眼', group: 'emotion' },
  { pid: 'ParamMouthShrug', label: '猫猫嘴', group: 'emotion' },
  { pid: 'ParamMouthX', label: '歪嘴', group: 'emotion' },
  { pid: 'Paramshita', label: '伸舌头', group: 'emotion' },
  { pid: 'Paramyanzhao', label: '眼罩', group: 'costume' },
  { pid: 'Paramhuatong', label: '拿话筒', group: 'costume' },
  { pid: 'Paramxiaogou', label: '漂浮小狗', group: 'costume' },
  { pid: 'Paramlonghair', label: '短发 1', group: 'costume' },
  { pid: 'Paramlonghair2', label: '短发 2', group: 'costume' },
  { pid: 'ParamarmupL', label: '左手抬起', group: 'costume' },
  { pid: 'ParamarmupR', label: '右手抬起', group: 'costume' },
  { pid: 'Paramdown1', label: '俯身按键', group: 'costume' },
];

export const COSTUME_NOTE = '情绪系统不会自动碰这些装扮 — 由你亲手决定。';

// v0.43.10: which of the try-on assets are PERSISTENT costume (the settings card owns them) versus
// session-only experiments. Returns undefined for the latter.
export function costumeIdForParam(pid: string): string | undefined {
  return Object.entries(COSTUME).find(([, def]) => def.pid === pid)?.[0];
}

export const WORKBENCH_STATES: readonly Live2DState[] = [
  'neutral',
  'thinking',
  'speaking',
  'sleeping',
];

// The intensity slider's tick mark. Imported, never re-typed: a mark at 0.7 next to a branch at 0.75
// would be a bench that teaches the wrong number.
export const INTENSITY_MARK = HIGH_INTENSITY;

const CONTROL_LABELS: Record<string, string> = {
  focused: '专注',
  fakeFierce: '假装凶',
  adorable: '可爱',
  playful: '调皮',
  shy: '害羞',
  embarrassed: '不好意思',
  awkwardV2: '尴尬',
  annoyed: '不耐烦',
  poutyAnnoyed: '气鼓鼓',
  curious: '好奇',
  tender: '温柔',
  skeptical: '怀疑',
  smug: '得意',
  disappointed: '失望',
  curious_attention: '好奇注视',
  gentle_concern: '轻柔担心',
  open_reengagement: '重新接纳',
  playful_brightness: '调皮明亮',
  focused_engagement: '专注投入',
  steady_presence: '稳定陪伴',
  soft_warmth: '柔和温暖',
  listening_attention: '专注倾听',
  alert_surprise: '警觉惊讶',
  bright_delight: '明亮喜悦',
  amused_smirk: '趣味坏笑',
  shy_softness: '害羞柔软',
  awkward_lightness: '轻微尴尬',
  guarded_distance: '保持距离',
  annoyed_resistance: '不耐烦抵抗',
  headLiftAlert: '警觉抬头',
  bodyLeanInSoft: '温柔靠近',
  slowBlinkAffection: '慢慢眨眼',
  bodySwayTenderSlow: '温柔轻晃',
  bodyLeanBackGuarded: '戒备后仰',
  lookAwayThenBack: '移开视线再看回',
  bodyPresentRight: '身体右倾',
  sighRelease: '叹气放松',
  headLowerShy: '害羞低头',
  gazeUpRecall: '抬眼回忆',
  browKnit: '皱眉',
  neutral: '自然',
  thinking: '思考',
  speaking: '说话',
  sleeping: '睡眠',
};

const titleCase = (id: string): string =>
  CONTROL_LABELS[id] ??
  id
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());

export function workbenchSections(): WorkbenchSection[] {
  return [
    {
      id: 'affect',
      title: '情绪',
      hint: `15 个情绪参数 — 滑块选择变体，达到 ${INTENSITY_MARK} 分支时会升级`,
      controls: ExpressionKey.options.map((id) => ({ kind: 'affect', id, label: titleCase(id) })),
    },
    {
      id: 'clip',
      title: '动作片段',
      hint: '每个编排好的表演都会直接播放 — 始终使用完整幅度',
      controls: Object.keys(EMOTIONS).map((id) => ({ kind: 'clip', id, label: titleCase(id) })),
    },
    {
      id: 'state',
      title: '状态',
      hint: '对话循环驱动的整体姿态',
      controls: WORKBENCH_STATES.map((id) => ({ kind: 'state', id, label: titleCase(id) })),
    },
    {
      id: 'idle',
      title: '待机',
      hint: '所有表演底下持续运行的休息动画',
      controls: IDLE_PROFILES.map((p) => ({ kind: 'idle', id: p.id, label: p.label })),
    },
    {
      id: 'action',
      title: '动作',
      hint: '九个编排好的小动作，一次播放一个',
      controls: Object.keys(ACTIONS).map((id) => ({ kind: 'action', id, label: titleCase(id) })),
    },
  ];
}

// Exactly the optional half of Live2DSink the bench drives. Typing it structurally (rather than
// against the concrete pixi sink) is what lets the dispatch below be tested against a recorder.
export type ControlTarget = Pick<Live2DSink, 'setExpression' | 'setState'> &
  Partial<
    Pick<
      Live2DSink,
      'triggerEmotion' | 'setIdleProfile' | 'setGazeFollow' | 'playAction' | 'setManualParam'
    >
  >;

export function applyControl(target: ControlTarget, c: WorkbenchControl, intensity: number): void {
  switch (c.kind) {
    case 'affect':
      // The raw slider value goes through undefined-free: `setExpression` treats it as the escalation
      // input, so rounding or defaulting it here would quietly disable the whole high branch.
      target.setExpression(c.id, intensity);
      return;
    case 'clip':
      // v0.43.15: no intensity — a named clip plays at full amplitude by definition.
      target.triggerEmotion?.(c.id);
      return;
    case 'state':
      target.setState(c.id);
      return;
    case 'idle':
      target.setIdleProfile?.(c.id);
      return;
    case 'action':
      target.playAction?.(c.id, intensity);
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

// ── v0.43.9: the pose composer ────────────────────────────────────────────────────────────────
// The pipeline behind "let me look at it before it goes in the code": 35 channels on sliders, she
// holds the pose live, and what comes out is an `EmotionDef` that pastes straight into `faceData.ts`.

export type ComposeChannel = {
  key: FaceStateKey;
  group: string;
  min: number;
  max: number;
  step: number;
};

// Slider bounds derived from `clampStateValue`, not re-typed — a slider that can travel somewhere the
// engine clamps away is a slider that lies about what she can do.
export function composeChannels(): ComposeChannel[] {
  const groupOf = new Map<FaceStateKey, string>();
  for (const [group, keys] of Object.entries(FACE_CHANNEL_GROUPS)) {
    for (const k of keys) groupOf.set(k, group);
  }
  return FACE_STATE_KEYS.map((key) => {
    const group = groupOf.get(key) ?? 'pupil';
    const lo = clampStateValue(key, -1e6);
    const hi = clampStateValue(key, 1e6);
    // The angle channels are unclamped by `clampStateValue` (they are raw Cubism degrees), so they
    // get the model's own ±30 working range rather than ±1e6.
    const unbounded = lo <= -1e5;
    return {
      key,
      group,
      min: unbounded ? -30 : lo,
      max: unbounded ? 30 : hi,
      step: unbounded ? 0.1 : 0.01,
    };
  });
}

// Groups the owner works in most, open by default. The rest fold away — 35 sliders at once is a wall.
export const COMPOSE_OPEN_GROUPS: readonly string[] = ['brows', 'mouth'];

// `pupil*` is in no channel group by design (v0.43.3 — it must be unownable), but the composer still
// has to offer it a slider, so the UI adds a group the engine does not have.
export const COMPOSE_GROUPS: Record<string, readonly FaceStateKey[]> = {
  ...FACE_CHANNEL_GROUPS,
  pupil: ['pupilX', 'pupilY'],
};

export function composeFromClip(id: string): Pose {
  const def = EMOTIONS[id as keyof typeof EMOTIONS] as EmotionDef | undefined;
  return def ? { ...def.sustainedState } : {};
}

// Only channels that actually left the neutral face — an export listing all 35 with 28 zeroes would
// be unreadable next to the hand-authored entries it has to sit beside.
function nonDefault(pose: Pose): Pose {
  const out: Pose = {};
  for (const [k, v] of Object.entries(pose) as [FaceStateKey, number][]) {
    if (Math.abs(v - FACE_VM_DEFAULT_STATE[k]) > 1e-6) out[k] = Math.round(v * 1000) / 1000;
  }
  return out;
}

// Which channel groups this pose touches — that IS what `owns` means, so it is inferred rather than
// asked for. `pupil*` belongs to no group on purpose (v0.43.3) and so can never be owned.
export function inferOwns(pose: Pose): FaceChannel[] {
  const touched = new Set(Object.keys(nonDefault(pose)));
  return (Object.entries(FACE_CHANNEL_GROUPS) as [FaceChannel, FaceStateKey[]][])
    .filter(([, keys]) => keys.some((k) => touched.has(k)))
    .map(([group]) => group);
}

export const ENTRY_FRACTION = 0.6;
export const COMPOSE_TIMELINE = { introMs: 900, performMs: 5600, outroMs: 1200 };

export function composeEmotionDef(pose: Pose, timeline = COMPOSE_TIMELINE): EmotionDef {
  const sustainedState = nonDefault(pose);
  const entryState: Pose = {};
  for (const [k, v] of Object.entries(sustainedState) as [FaceStateKey, number][]) {
    entryState[k] = Math.round(v * ENTRY_FRACTION * 1000) / 1000;
  }
  return {
    timeline,
    owns: inferOwns(pose),
    entryState,
    sustainedState,
    actionRefs: [],
    overlayRefs: [],
    physicsPassthrough: [],
  };
}

export function exportEmotionDef(pose: Pose, timeline = COMPOSE_TIMELINE): string {
  return JSON.stringify(
    {
      // A flat scale of the sustained pose is an approximation, not an authored entry — every
      // hand-written clip in `faceData.ts` leads INTO its pose differently, and that shape is
      // half of what makes a clip read as arriving rather than snapping on.
      '//': `entryState is sustained x ${ENTRY_FRACTION} — a starting point, tune it by hand`,
      ...composeEmotionDef(pose, timeline),
    },
    null,
    2,
  );
}

export type WorkbenchReadout = { mood: string; playback: string; actions: string; accent: boolean };

export type DebugBridge = {
  mood?: () => string;
  playback?: () => { id: string; phase: string } | null;
  faceVm?: {
    activeActionIds(): string[];
    activeOverlayParams?(): Record<string, number>;
    activePulseCount?(): number;
  };
};

export function readout(bridge: DebugBridge | undefined): WorkbenchReadout {
  const pb = bridge?.playback?.();
  const actions = bridge?.faceVm?.activeActionIds() ?? [];
  return {
    mood: bridge?.mood?.() ?? '—',
    playback: pb ? `${pb.id} · ${pb.phase}` : 'idle',
    actions: actions.length > 0 ? actions.join(', ') : '—',
    // v0.43.12: the stress indicator. The detector's constants are a feel judgement, and this lamp
    // is the calibration loop — it lights while a stress pulse is live, so the owner can check it
    // against what his own ears hear in his own voice model.
    accent: (bridge?.faceVm?.activePulseCount?.() ?? 0) > 0,
  };
}

const READOUT_MS = 500;

export type ComposeTarget = {
  setComposeMode(pose: Pose | null): void;
  composeActive(): boolean;
};

export type WorkbenchDeps = {
  // A thunk, not a value: the drawer is built before the model finishes loading (a model load is a
  // network fetch and a WebGL context), so the buttons must exist and then find their target.
  target: () => ControlTarget | null;
  // The composer drives FaceVm directly rather than through the sink: `setComposeMode` freezes every
  // living layer, which is a debugging state, not something the app should ever be able to enter.
  compose?: () => ComposeTarget | null;
  // A/B: hand the composed pose back as a real EmotionDef so the caller can run it as a clip. It
  // carries the SHORT timeline (`timelineFor`), i.e. the pacing the app actually performs with —
  // previewing at the authored 5.6 s would rehearse a beat that no longer exists.
  onPreviewPose?: (def: EmotionDef) => void;
  bridge?: () => DebugBridge | undefined;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  onBack?: () => void;
};

// The DOM half. Left: the live model stage the caller fills with the real sink. Right: the drawer,
// one `<section>` per group so v0.43.8's asset rows and v0.43.9's composer append instead of
// rearranging.
export function mountWorkbench(
  root: HTMLElement,
  deps: WorkbenchDeps,
): { stage: HTMLElement; dispose: () => void } {
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
    ['label', '还没有安装模型'],
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
  back.textContent = '← 返回';
  back.addEventListener('click', () => deps.onBack?.());
  head.appendChild(back);
  const title = doc.createElement('span');
  title.className = 'wb-title';
  title.textContent = 'Live2D 工作台';
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
    // v0.43.15: it selects a variant, it does not scale one. Saying "intensity" alone would keep
    // teaching the volume-knob reading the engine just stopped honouring.
    intensityLabel.textContent = `情绪强度 ${intensity.toFixed(2)} · ${intensity >= INTENSITY_MARK ? '升级变体' : '温和变体'}`;
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
  mark.title = `${INTENSITY_MARK} — 超过此值后，四种情绪会升级`;
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

  // v0.43.8: the 17 drawn assets, worn by hand. Emotional ones also LIGHT UP when the clip layer is
  // driving them, so the overlay table stops being something he has to read source to know.
  const assetToggles = new Map<string, HTMLInputElement>();
  for (const group of ['emotion', 'costume'] as const) {
    const sec = doc.createElement('section');
    sec.className = 'wb-section';
    sec.dataset['section'] = `asset-${group}`;
    const h = doc.createElement('h3');
    h.textContent = group === 'emotion' ? '素材 · 情绪' : '素材 · 装扮与道具';
    const hint = doc.createElement('p');
    hint.className = 'wb-hint';
    hint.textContent =
      group === 'emotion'
        ? '点亮 = 当前动作片段正在驱动它'
        : '由你决定 — 她的表情不会自动穿戴或摘下这些装扮';
    sec.append(h, hint);
    for (const asset of MODEL_ASSETS.filter((a) => a.group === group)) {
      const row = doc.createElement('label');
      row.className = 'wb-asset';
      row.dataset['pid'] = asset.pid;
      const box = doc.createElement('input');
      box.type = 'checkbox';
      // v0.43.10: a costume asset is the SAME switch as the one on the settings card, so the bench
      // writes through the same persisted state rather than keeping a second, session-only truth.
      const costumeId = costumeIdForParam(asset.pid);
      if (costumeId !== undefined) box.checked = loadCostume()[costumeId] === true;
      box.addEventListener('change', () => {
        const target = deps.target();
        if (costumeId === undefined) {
          target?.setManualParam?.(asset.pid, box.checked ? 1 : null);
          return;
        }
        const next = toggleCostume(loadCostume(), costumeId, box.checked);
        saveCostume(next);
        for (const [pid, value] of costumeWrites(next)) target?.setManualParam?.(pid, value);
        // A hairstyle turning on takes the other one off — the bench has to show that too.
        for (const [pid, other] of assetToggles) {
          const otherId = costumeIdForParam(pid);
          if (otherId !== undefined) other.checked = next[otherId] === true;
        }
      });
      const text = doc.createElement('span');
      text.textContent = asset.label;
      row.append(box, text);
      sec.appendChild(row);
      assetToggles.set(asset.pid, box);
    }
    drawer.appendChild(sec);
  }

  const flags = doc.createElement('section');
  flags.className = 'wb-section';
  flags.dataset['section'] = 'flags';
  const fh = doc.createElement('h3');
  fh.textContent = '开关';
  const fhint = doc.createElement('p');
  fhint.className = 'wb-hint';
  fhint.textContent = '与设置页写入同一组 localStorage 开关 — 每帧读取';
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

  // v0.43.9: the composer. Off by default — it freezes every living layer, so entering it has to be
  // a deliberate act with a badge saying so.
  const composeSec = doc.createElement('section');
  composeSec.className = 'wb-section wb-compose';
  composeSec.dataset['section'] = 'compose';
  const ch = doc.createElement('h3');
  ch.textContent = '编排姿态';
  const chint = doc.createElement('p');
  chint.className = 'wb-hint';
  chint.textContent = '冻结所有动态层，让你逐个通道编辑一个姿态';
  composeSec.append(ch, chint);

  const pose: Pose = {};
  const sliders = new Map<FaceStateKey, HTMLInputElement>();
  const values = new Map<FaceStateKey, HTMLElement>();
  let composing = false;

  const pushPose = (): void => {
    if (composing) deps.compose?.()?.setComposeMode(pose);
  };
  const paintChannel = (key: FaceStateKey): void => {
    const v = pose[key] ?? FACE_VM_DEFAULT_STATE[key];
    const s = sliders.get(key);
    if (s) s.value = String(v);
    const label = values.get(key);
    if (label) label.textContent = v.toFixed(2);
  };

  const composeRow = doc.createElement('div');
  composeRow.className = 'wb-compose-row';
  const composeToggle = doc.createElement('button');
  composeToggle.type = 'button';
  composeToggle.className = 'wb-btn wb-compose-toggle';
  composeToggle.textContent = '进入编排';
  const badge = doc.createElement('span');
  badge.className = 'wb-badge';
  badge.textContent = '编排中';
  badge.hidden = true;
  composeToggle.addEventListener('click', () => {
    composing = !composing;
    composeToggle.textContent = composing ? '退出编排' : '进入编排';
    composeToggle.classList.toggle('on', composing);
    badge.hidden = !composing;
    deps.compose?.()?.setComposeMode(composing ? pose : null);
  });
  const loadSel = doc.createElement('select');
  const blank = doc.createElement('option');
  blank.value = '';
  blank.textContent = '加载一个动作片段…';
  loadSel.appendChild(blank);
  for (const id of Object.keys(EMOTIONS)) {
    const o = doc.createElement('option');
    o.value = id;
    o.textContent = titleCase(id);
    loadSel.appendChild(o);
  }
  // Authoring a new face starts by editing a nearby one — "sad" comes out of `disappointed`, not out
  // of 35 zeroes.
  loadSel.addEventListener('change', () => {
    if (loadSel.value === '') return;
    for (const k of FACE_STATE_KEYS) delete pose[k];
    Object.assign(pose, composeFromClip(loadSel.value));
    for (const k of FACE_STATE_KEYS) paintChannel(k);
    pushPose();
  });
  const exportBtn = doc.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'wb-btn';
  exportBtn.textContent = '复制情绪定义';
  const exportOut = doc.createElement('textarea');
  exportOut.className = 'wb-export';
  exportOut.readOnly = true;
  exportOut.hidden = true;
  exportBtn.addEventListener('click', () => {
    const json = exportEmotionDef(pose);
    exportOut.value = json;
    exportOut.hidden = false;
    void navigator.clipboard?.writeText(json).catch(() => {
      /* clipboard blocked — the textarea below is the fallback, and it is always filled */
    });
  });
  const playBtn = doc.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'wb-btn';
  playBtn.textContent = 'A/B 播放';
  // Static beauty is not the same as a pose that reads in motion, so the composed face can be run
  // through a real intro→perform→outro before it is trusted.
  playBtn.addEventListener('click', () => {
    const c = deps.compose?.();
    if (!c) return;
    c.setComposeMode(null);
    composing = false;
    composeToggle.textContent = '进入编排';
    composeToggle.classList.remove('on');
    badge.hidden = true;
    deps.onPreviewPose?.(composeEmotionDef(pose, timelineFor(composeEmotionDef(pose), true)));
  });
  composeRow.append(composeToggle, badge, loadSel, playBtn, exportBtn);
  composeSec.append(composeRow, exportOut);

  for (const [group, keys] of Object.entries(COMPOSE_GROUPS)) {
    const details = doc.createElement('details');
    details.className = 'wb-group';
    if (COMPOSE_OPEN_GROUPS.includes(group)) details.open = true;
    const summary = doc.createElement('summary');
    summary.textContent =
      (
        {
          brows: '眉毛',
          mouth: '嘴巴',
          eyes: '眼睛',
          pose: '姿态',
          gaze: '视线',
          pupil: '瞳孔',
        } as Record<string, string>
      )[group] ?? group;
    details.appendChild(summary);
    for (const chan of composeChannels().filter((c) => keys.includes(c.key))) {
      const row = doc.createElement('label');
      row.className = 'wb-chan';
      row.dataset['chan'] = chan.key;
      const name = doc.createElement('span');
      name.className = 'wb-chan-name';
      // v0.43.0's invariant in the UI: these two are borrowed for as long as compose is on.
      name.textContent =
        chan.key === 'eyeOpenL' || chan.key === 'eyeOpenR' ? `${chan.key} ⟲` : chan.key;
      if (chan.key.startsWith('eyeOpen')) name.title = '退出编排后交还给眨眼控制';
      const input = doc.createElement('input');
      input.type = 'range';
      input.min = String(chan.min);
      input.max = String(chan.max);
      input.step = String(chan.step);
      input.value = String(FACE_VM_DEFAULT_STATE[chan.key]);
      const val = doc.createElement('span');
      val.className = 'wb-chan-val';
      val.textContent = FACE_VM_DEFAULT_STATE[chan.key].toFixed(2);
      input.addEventListener('input', () => {
        pose[chan.key] = Number.parseFloat(input.value);
        val.textContent = (pose[chan.key] ?? 0).toFixed(2);
        pushPose();
      });
      sliders.set(chan.key, input);
      values.set(chan.key, val);
      row.append(name, input, val);
      details.appendChild(row);
    }
    composeSec.appendChild(details);
  }
  drawer.appendChild(composeSec);

  const readoutEl = doc.createElement('section');
  readoutEl.className = 'wb-section wb-readout';
  readoutEl.dataset['section'] = 'readout';
  const rh = doc.createElement('h3');
  rh.textContent = '实时状态';
  const moodEl = doc.createElement('p');
  const clipEl = doc.createElement('p');
  const actEl = doc.createElement('p');
  const accentEl = doc.createElement('p');
  accentEl.className = 'wb-accent';
  readoutEl.append(rh, moodEl, clipEl, actEl, accentEl);
  drawer.appendChild(readoutEl);

  const paint = (): void => {
    const bridge = deps.bridge?.();
    const r = readout(bridge);
    moodEl.textContent = `情绪 — ${r.mood}`;
    clipEl.textContent = `片段 — ${r.playback}`;
    actEl.textContent = `动作 — ${r.actions}`;
    accentEl.textContent = `重音 — ${r.accent ? '● 检测到重音' : '○'}`;
    accentEl.classList.toggle('on', r.accent);
    const driven = bridge?.faceVm?.activeOverlayParams?.() ?? {};
    for (const [pid, box] of assetToggles) {
      box.parentElement?.classList.toggle('driven', driven[pid] !== undefined);
    }
  };
  paint();
  const timer = setInterval(paint, READOUT_MS);

  return {
    stage,
    dispose: () => {
      clearInterval(timer);
      // Never leave her frozen in a composed pose: exiting the bench hands every layer back.
      deps.compose?.()?.setComposeMode(null);
    },
  };
}
