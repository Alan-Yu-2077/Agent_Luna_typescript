import type { LayoutRefs } from './layout';
import { mountModulesSection, type ModulesBridges } from './modulesConfig';
import { mountPersonaSection } from './personaEditor';

// v0.44.5 — settings, reorganised by WHICH PART OF HER a control touches. The old VTS side panel
// grew three tabs and a dozen switches; finding one meant guessing. Five categories now, entered
// from the menu as a full page.
//
// The migration is an ADOPTION, not a rebuild: the page moves the old panel's live DOM rows into
// the new categories. Same elements, same listeners, same localStorage keys — the live-read
// contracts physically cannot drift, because they are the same nodes. In `luna:menu='0'` boots the
// page never mounts and the old panel keeps its rows, untouched.

export type SettingsCategoryId =
  'voice' | 'expression' | 'appearance' | 'behaviour' | 'persona' | 'modules' | 'system';

export type SettingsCategory = { id: SettingsCategoryId; label: string; blurb: string };

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  { id: 'voice', label: '声音', blurb: '她的声音' },
  { id: 'expression', label: '表情与动作', blurb: '她的表情与动作' },
  { id: 'appearance', label: '外观', blurb: '她的样子与这间屋子' },
  { id: 'behaviour', label: '行为', blurb: '她自己的行为' },
  // v0.44.6: persona is its own category (it is ABOUT her, not about widgets), and the four module
  // cards get their own too — four cards under System would have buried both.
  { id: 'persona', label: '人格', blurb: '她是谁' },
  { id: 'modules', label: '能力模块', blurb: '接进来的能力' },
  { id: 'system', label: '系统', blurb: '底层与工具' },
];

// The reconciliation artifact (the version's core risk is losing a switch in the move): every
// localStorage-backed control in the old panel, mapped to exactly one category. The test cross-
// checks this list against `PERF_FLAGS` and against itself — no key missing, none twice.
export const SETTINGS_IA: Record<SettingsCategoryId, readonly string[]> = {
  voice: ['luna:tts'],
  expression: [
    'luna:affect',
    'luna:live-peak',
    'luna:short-clips',
    'luna:idle-actions',
    'luna:listening',
    'luna:speech-performance',
    'luna:idle-profile',
  ],
  appearance: ['luna:live2d', 'luna:gaze-follow', 'luna:costume'],
  behaviour: [],
  persona: [], // HTTP-backed (the soul endpoints), not localStorage
  modules: [], // luna.env-backed through the desktop bridge, not localStorage
  system: [], // the server registry card is WS-driven, not localStorage-backed
};

export function iaKeys(): string[] {
  return Object.values(SETTINGS_IA).flat();
}

// Which old-panel rows land where. The refs are the SAME elements the old panel built — adoption
// moves them, listeners and all.
export function mountSettingsPage(doc: Document, refs: LayoutRefs): HTMLElement {
  const page = doc.createElement('div');
  page.className = 'settings-page';

  const rail = doc.createElement('nav');
  rail.className = 'settings-page-rail';
  const bodyHost = doc.createElement('div');
  bodyHost.className = 'settings-page-body';
  page.append(rail, bodyHost);

  const sections = new Map<SettingsCategoryId, HTMLElement>();
  const railBtns: HTMLButtonElement[] = [];
  for (const cat of SETTINGS_CATEGORIES) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'settings-page-cat';
    b.dataset['cat'] = cat.id;
    b.textContent = cat.label;
    rail.appendChild(b);
    railBtns.push(b);

    const sec = doc.createElement('section');
    sec.className = 'settings-page-section';
    sec.dataset['cat'] = cat.id;
    const h = doc.createElement('h3');
    h.textContent = cat.label;
    const blurb = doc.createElement('p');
    blurb.className = 'settings-page-blurb';
    blurb.textContent = cat.blurb;
    sec.append(h, blurb);
    bodyHost.appendChild(sec);
    sections.set(cat.id, sec);

    b.addEventListener('click', () => select(cat.id));
  }

  const select = (id: SettingsCategoryId): void => {
    for (const b of railBtns) b.classList.toggle('on', b.dataset['cat'] === id);
    for (const [cid, sec] of sections) sec.classList.toggle('on', cid === id);
  };

  const rowOf = (input: HTMLElement | null): HTMLElement | null => input?.closest('label') ?? null;
  const adopt = (cat: SettingsCategoryId, el: HTMLElement | null): void => {
    if (el) sections.get(cat)?.appendChild(el);
  };

  // ── Voice ──
  adopt('voice', rowOf(refs.ttsToggle));
  const health = doc.createElement('p');
  health.className = 'settings-voice-health';
  health.textContent = '声音服务:查看中…';
  sections.get('voice')?.appendChild(health);
  void fetch('/api/tts/health')
    .then(async (r) => {
      const body = (await r.json().catch(() => null)) as { backend?: { state?: string } } | null;
      const state = body?.backend?.state ?? (r.ok ? 'ready' : 'down');
      health.textContent =
        state === 'ready'
          ? '声音服务:在跑 ✓'
          : state === 'starting' || state === 'restarting'
            ? '声音服务:正在启动…'
            : '声音服务:没有在跑';
    })
    .catch(() => {
      health.textContent = '声音服务:没有在跑';
    });

  // ── Expression & Motion — the seven performance controls, in the PERF_FLAGS order ──
  adopt('expression', rowOf(refs.affectToggle));
  adopt('expression', rowOf(refs.livePeakToggle));
  adopt('expression', rowOf(refs.shortClipsToggle));
  adopt('expression', rowOf(refs.idleActionsToggle));
  adopt('expression', rowOf(refs.listeningToggle));
  adopt('expression', rowOf(refs.speechPerfToggle));
  adopt('expression', rowOf(refs.idleSelect));

  // ── Appearance ──
  adopt('appearance', rowOf(refs.live2dToggle));
  adopt('appearance', rowOf(refs.gazeToggle));
  // The whole costume card (v0.43.10) — its toggles carry their own wiring.
  const costumeCard = Object.values(refs.costumeToggles)[0]?.closest('.settings-card');
  if (costumeCard instanceof HTMLElement) adopt('appearance', costumeCard);
  adopt('appearance', rowOf(refs.petToggle));
  const rerun = refs.petToggle.closest('.settings-card')?.querySelector('.rerun-setup-row');
  if (rerun instanceof HTMLElement) adopt('appearance', rerun);

  // ── Behaviour — a placeholder on purpose: proactive knobs live in env/DB pins today, and
  // surfacing them is its own decision, not a side effect of moving furniture. ──
  const note = doc.createElement('p');
  note.className = 'settings-page-note';
  note.textContent =
    '她的主动行为(何时来找你、多久说一次)暂时还住在配置文件里——搬进这里是之后的一版。';
  sections.get('behaviour')?.appendChild(note);

  // ── Persona (v0.44.6) — the soul endpoints; the self-edit firewall lives in the tool layer. ──
  sections.get('persona')?.appendChild(mountPersonaSection(doc));

  // ── Modules (v0.44.6) — four uniform cards over the wizard's own bridges. ──
  const setup = (globalThis as { lunaSetup?: Record<string, unknown> }).lunaSetup as
    | {
        wizardPrefill?: ModulesBridges['prefill'];
        probe?: ModulesBridges['probeChat'];
        probeProvider?: ModulesBridges['probeProvider'];
        saveConfig?: ModulesBridges['saveConfig'];
      }
    | undefined;
  const pet = (globalThis as { lunaPet?: { relaunch?: () => void } }).lunaPet;
  sections.get('modules')?.appendChild(
    mountModulesSection(doc, {
      ...(setup?.wizardPrefill ? { prefill: setup.wizardPrefill.bind(setup) } : {}),
      ...(setup?.probe ? { probeChat: setup.probe.bind(setup) } : {}),
      ...(setup?.probeProvider ? { probeProvider: setup.probeProvider.bind(setup) } : {}),
      ...(setup?.saveConfig ? { saveConfig: setup.saveConfig.bind(setup) } : {}),
      ...(pet?.relaunch ? { relaunch: pet.relaunch.bind(pet) } : {}),
    }),
  );

  // ── System — the server registry card is adopted whole; its render pipeline is untouched. ──
  adopt('system', refs.serverSettings);
  const wbRow = doc.createElement('div');
  wbRow.className = 'settings-page-tools';
  adopt('system', wbRow);
  wbRow.appendChild(refs.workbenchBtn);

  select('voice');
  return page;
}
