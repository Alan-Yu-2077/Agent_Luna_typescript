// v0.35.0 (Initiative 25): the multi-step first-run wizard. Six steps — chat → memory → search →
// weather → avatar → voice. This version ships the frame + field plumbing; live probes for steps
// 2–4 arrive in v0.35.1, drag-in installs in v0.35.2/3, full walkthrough copy in v0.35.4.
//
// Key custody (v0.28.0 rule): field values ride ONE bridge call (probe / wizardSubmit) into the
// shell and never come back; nothing here logs or re-renders a submitted value.
//
// The core is a pure state machine + step/field tables so `bun test` covers navigation and
// collection without a DOM; mountSetupWizard is a thin renderer over it.

import { detectSetupLang, makeT, persistSetupLang, type SetupLang } from './setupCopy';
import { createDropZone } from './dropZone';

export type WizardFieldSpec = {
  key: string; // the luna.env key this input feeds (whitelist enforced shell-side too)
  labelKey: string;
  type: 'text' | 'password';
  placeholder: string;
  initial?: string;
};

export type WizardStepSpec = {
  id: 'chat' | 'embedding' | 'search' | 'weather' | 'avatar' | 'voice';
  titleKey: string;
  optional: boolean;
  fields: WizardFieldSpec[];
};

export function wizardSteps(): WizardStepSpec[] {
  return [
    {
      id: 'chat',
      titleKey: 'step.chat.title',
      optional: false,
      fields: [
        {
          key: 'ANTHROPIC_BASE_URL',
          labelKey: 'step.chat.baseUrl',
          type: 'text',
          placeholder: 'https://api.anthropic.com',
          initial: 'https://api.anthropic.com',
        },
        { key: 'ANTHROPIC_API_KEY', labelKey: 'step.chat.apiKey', type: 'password', placeholder: 'sk-…' },
        {
          key: 'LUNA_MODEL',
          labelKey: 'step.chat.model',
          type: 'text',
          placeholder: 'claude-sonnet-4-6',
          initial: 'claude-sonnet-4-6',
        },
      ],
    },
    {
      id: 'embedding',
      titleKey: 'step.embedding.title',
      optional: true,
      fields: [
        {
          key: 'LUNA_EMBEDDING_MODEL',
          labelKey: 'step.embedding.model',
          type: 'text',
          placeholder: 'text-embedding-3-large',
          initial: 'text-embedding-3-large',
        },
        { key: 'LUNA_EMBEDDING_API_KEY', labelKey: 'step.embedding.apiKey', type: 'password', placeholder: 'sk-…' },
        {
          key: 'LUNA_EMBEDDING_BASE_URL',
          labelKey: 'step.embedding.baseUrl',
          type: 'text',
          placeholder: 'https://api.openai.com',
          initial: 'https://api.openai.com',
        },
      ],
    },
    {
      id: 'search',
      titleKey: 'step.search.title',
      optional: true,
      fields: [
        { key: 'LUNA_WEB_SEARCH_API_KEY', labelKey: 'step.search.apiKey', type: 'password', placeholder: 'tvly-…' },
      ],
    },
    {
      id: 'weather',
      titleKey: 'step.weather.title',
      optional: true,
      fields: [
        { key: 'LUNA_WEATHER_API_KEY', labelKey: 'step.weather.apiKey', type: 'password', placeholder: '…' },
        {
          key: 'LUNA_WEATHER_API_HOST',
          labelKey: 'step.weather.apiHost',
          type: 'text',
          placeholder: 'xxxx.qweatherapi.com',
        },
        { key: 'LUNA_LAT_LON', labelKey: 'step.weather.latlon', type: 'text', placeholder: '31.23,121.47' },
      ],
    },
    { id: 'avatar', titleKey: 'step.avatar.title', optional: true, fields: [] },
    {
      id: 'voice',
      titleKey: 'step.voice.title',
      optional: true,
      fields: [{ key: 'LUNA_TTS_URL', labelKey: 'step.voice.url', type: 'text', placeholder: 'http://127.0.0.1:9880' }],
    },
  ];
}

// Values the user has actually typed (or a step pre-filled), keyed by env key. Empty/whitespace
// values are dropped at collection so a skipped field never clobbers an existing luna.env line
// (mergeEnvFile would happily write KEY= otherwise).
export function collectValues(values: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of values) {
    const t = v.trim();
    if (t !== '') out[k] = t;
  }
  return out;
}

export type WizardState = {
  index: number;
  count: number;
  atFirst: boolean;
  atLast: boolean;
};

export function createWizardNav(count: number): {
  state: () => WizardState;
  next: () => WizardState;
  back: () => WizardState;
} {
  let index = 0;
  const state = (): WizardState => ({
    index,
    count,
    atFirst: index === 0,
    atLast: index === count - 1,
  });
  return {
    state,
    next: () => {
      if (index < count - 1) index += 1;
      return state();
    },
    back: () => {
      if (index > 0) index -= 1;
      return state();
    },
  };
}

type SetupFields = { baseUrl: string; apiKey: string; model: string };
type SetupVerdict = { ok: boolean; error?: string };
export type ProbeKind = 'embedding' | 'search' | 'weather';
export type WizardBridge = {
  probe(f: SetupFields): Promise<SetupVerdict>;
  wizardSubmit(fields: Record<string, string>): Promise<SetupVerdict>;
  probeProvider?(kind: ProbeKind, fields: Record<string, string>): Promise<SetupVerdict>;
  scanVoicePack?(file: File): Promise<Record<string, unknown>>;
  installVoicePack?(args: Record<string, string>): Promise<Record<string, unknown>>;
  chooseTtsRuntime?(): Promise<Record<string, unknown>>;
  // v0.37.2: the one-click GPT-SoVITS installer (标准 1) — start kicks/resumes it, status polls it.
  provisionStart?(): Promise<Record<string, unknown>>;
  provisionStatus?(): Promise<Record<string, unknown>>;
  // v0.37.8: what is ALREADY configured, so re-running setup preserves it. Secrets are never
  // returned — a configured key comes back as a NAME in `configured`, never as a value.
  wizardPrefill?(): Promise<{ values?: Record<string, string>; configured?: string[] }>;
};

// v0.37.2: provision stage → copy key (pure so it unit-tests; the wizard label rides makeT).
export function provisionCopyKey(stage: string, inFlight: boolean): string {
  if (stage === 'ready') return 'step.voice.provision.ready';
  if (stage === 'failed') return 'step.voice.provision.failed';
  if (stage === 'idle') return 'step.voice.provision.hint';
  if (!inFlight) return 'step.voice.provision.paused'; // resumable — a quit mid-install parks here
  return `step.voice.provision.${stage}`;
}

// v0.35.1: the probe gate for optional steps. Next with an untested filled key runs the probe
// first; a failed probe arms "continue anyway" (the second click advances). Pure so it unit-tests.
export type ProbeState = 'none' | 'ok' | 'fail';
export function probeGateAction(filled: boolean, probed: ProbeState): 'probe' | 'advance' {
  return filled && probed === 'none' ? 'probe' : 'advance';
}
export function nextLabelKey(probed: ProbeState, atLast: boolean): string {
  if (probed === 'fail') return 'wizard.continueAnyway';
  return atLast ? 'wizard.finish' : 'wizard.next';
}

// Which values feed each optional step's probe; null = nothing filled → no probe, plain advance.
export function probeFieldsFor(kind: ProbeKind, values: Map<string, string>): Record<string, string> | null {
  const v = (k: string): string => (values.get(k) ?? '').trim();
  if (kind === 'embedding') {
    if (v('LUNA_EMBEDDING_API_KEY') === '') return null;
    return {
      baseUrl: v('LUNA_EMBEDDING_BASE_URL'),
      apiKey: v('LUNA_EMBEDDING_API_KEY'),
      model: v('LUNA_EMBEDDING_MODEL'),
    };
  }
  if (kind === 'search') {
    if (v('LUNA_WEB_SEARCH_API_KEY') === '') return null;
    return { apiKey: v('LUNA_WEB_SEARCH_API_KEY') };
  }
  if (v('LUNA_WEATHER_API_KEY') === '' && v('LUNA_WEATHER_API_HOST') === '') return null;
  return { apiKey: v('LUNA_WEATHER_API_KEY'), apiHost: v('LUNA_WEATHER_API_HOST') };
}

const PROBE_STEP: Partial<Record<WizardStepSpec['id'], ProbeKind>> = {
  embedding: 'embedding',
  search: 'search',
  weather: 'weather',
};

// v0.35.4: the per-step walkthrough cards — where to register, what to paste, what skipping means.
// Text lives in the zh/en copy table; hrefs are pinned here so a link-audit test can assert each
// vendor/resource URL appears exactly once. Links open via the shell's window-open handler
// (system browser only, https only).
export type StepGuide = { textKey: string; links: Array<{ href: string; labelKey: string }> };
export const STEP_GUIDES: Record<WizardStepSpec['id'], StepGuide> = {
  chat: {
    textKey: 'guide.chat',
    links: [{ href: 'https://console.anthropic.com', labelKey: 'guide.chat.link' }],
  },
  embedding: {
    textKey: 'guide.embedding',
    links: [{ href: 'https://platform.openai.com/api-keys', labelKey: 'guide.embedding.link' }],
  },
  search: {
    textKey: 'guide.search',
    links: [{ href: 'https://app.tavily.com', labelKey: 'guide.search.link' }],
  },
  weather: {
    textKey: 'guide.weather',
    links: [{ href: 'https://dev.qweather.com', labelKey: 'guide.weather.link' }],
  },
  avatar: {
    textKey: 'guide.avatar',
    links: [
      { href: 'https://b23.tv/NOg9J41', labelKey: 'guide.avatar.link.pack' },
      { href: 'https://www.live2d.com/en/learn/sample/', labelKey: 'guide.avatar.link.samples' },
    ],
  },
  voice: {
    textKey: 'guide.voice',
    links: [
      { href: 'https://b23.tv/cTW61p1', labelKey: 'guide.voice.link.pack' },
      { href: 'https://github.com/RVC-Boss/GPT-SoVITS', labelKey: 'guide.voice.link.runtime' },
    ],
  },
};

// v0.39.0: which steps may auto-collapse their walkthrough card. Only the two resource steps grow a
// SECOND body of content (a scanned voice pack, an installed avatar) that then competes with the
// guidance for the card's height; everywhere else the guidance IS the step, so it stays open.
export function guideOpen(stepId: WizardStepSpec['id'], hasResults: boolean): boolean {
  if (stepId !== 'voice' && stepId !== 'avatar') return true;
  return !hasResults;
}

type InstallResult = { ok: boolean; modelUrl?: string; error?: string };
type PetBridge = {
  chooseModel?: () => Promise<InstallResult>;
  installModelFile?: (file: File) => Promise<InstallResult>;
};

// v0.35.3: voice-pack state that must survive re-renders (language toggles, step navigation).
type VoiceScanResult = {
  ok: boolean;
  root?: string;
  scan?: { gpt: string[]; sovits: string[]; refWavs: string[]; transcripts: string[] };
  transcriptPreview?: string;
  error?: string;
};
type VoiceState = {
  root?: string;
  scan?: NonNullable<VoiceScanResult['scan']>;
  picks: { gptCkpt?: string; sovitsPth?: string; referenceWav?: string; transcriptTxt?: string };
  transcript: string;
  promptLang: string;
  runtimeDir?: string;
  runtimeVenv?: boolean;
  command?: string;
  installedOk?: boolean;
};

const fileName = (p: string): string => p.split('/').pop() ?? p;

function bridges(): { setup?: WizardBridge & { wizard?: boolean }; pet?: PetBridge } {
  const g = globalThis as { lunaSetup?: WizardBridge & { wizard?: boolean }; lunaPet?: PetBridge };
  return { setup: g.lunaSetup, pet: g.lunaPet };
}

// v0.37.8: re-running setup must NOT destroy what is already configured. Saved values win over a
// field's static `initial` (before this, re-running the wizard and clicking through overwrote a
// custom gateway URL / model with the stock defaults). Secrets never leave the main process — a
// configured key arrives as a name in `configured`, its input stays EMPTY, and an empty field is
// dropped on submit (mergeEnvFile then preserves the stored value). Pure so it unit-tests.
export function hydrateWizardValues(
  saved: Record<string, string>,
  configured: readonly string[],
  specs: readonly WizardFieldSpec[],
): { values: Map<string, string>; configured: Set<string> } {
  const values = new Map<string, string>();
  const conf = new Set(configured);
  for (const spec of specs) {
    const savedValue = (saved[spec.key] ?? '').trim();
    if (savedValue !== '') values.set(spec.key, savedValue);
    else if (!conf.has(spec.key) && spec.initial) values.set(spec.key, spec.initial);
  }
  return { values, configured: conf };
}

function fieldRow(
  parent: HTMLElement,
  label: string,
  spec: WizardFieldSpec,
  values: Map<string, string>,
  opts: { configuredHint?: string } = {},
): HTMLInputElement {
  const doc = parent.ownerDocument;
  const row = doc.createElement('label');
  row.className = 'setup-field';
  const span = doc.createElement('span');
  span.textContent = label;
  const input = doc.createElement('input');
  input.type = spec.type;
  // A configured secret shows "already set — leave blank to keep" instead of its value.
  input.placeholder = opts.configuredHint ?? spec.placeholder;
  input.value = values.get(spec.key) ?? (opts.configuredHint ? '' : (spec.initial ?? ''));
  if (input.value !== '') values.set(spec.key, input.value);
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.addEventListener('input', () => values.set(spec.key, input.value));
  row.append(span, input);
  parent.appendChild(row);
  return input;
}

// A password field whose key is already stored: show "already set" and keep the input empty.
function secretHintFor(
  spec: WizardFieldSpec,
  configured: Set<string>,
  t: (k: string) => string,
): { configuredHint?: string } {
  return spec.type === 'password' && configured.has(spec.key)
    ? { configuredHint: t('wizard.configured') }
    : {};
}

export function mountSetupWizard(root: HTMLElement, opts: { preview?: boolean } = {}): void {
  const doc = root.ownerDocument;
  root.classList.add('luna-app', 'setup');
  while (root.firstChild) root.removeChild(root.firstChild);

  let lang: SetupLang = detectSetupLang();
  const steps = wizardSteps();
  const nav = createWizardNav(steps.length);
  let values = new Map<string, string>();
  let configuredSecrets = new Set<string>();
  const probeStates = new Map<string, ProbeState>(); // per-step; reset to 'none' when its fields change
  let voiceBackend = 'browser';
  let avatarInstalled = false;
  let busy = false;
  const voice: VoiceState = { picks: {}, transcript: '', promptLang: 'en' };
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let provisionTimer: ReturnType<typeof setInterval> | null = null;

  const card = doc.createElement('div');
  card.className = 'setup-card wizard';
  root.appendChild(card);

  const { setup, pet } = bridges();
  const live = !opts.preview && !!setup;

  const render = (): void => {
    const t = makeT(lang);
    const secretHint = (f: WizardFieldSpec, tt: (k: string) => string): { configuredHint?: string } =>
      secretHintFor(f, configuredSecrets, tt);
    const s = nav.state();
    const step = steps[s.index]!;
    if (healthTimer !== null) {
      clearInterval(healthTimer);
      healthTimer = null;
    }
    if (provisionTimer !== null) {
      clearInterval(provisionTimer);
      provisionTimer = null;
    }
    while (card.firstChild) card.removeChild(card.firstChild);

    const langBtn = doc.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'setup-lang-btn';
    langBtn.textContent = t('wizard.lang');
    langBtn.addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      persistSetupLang(lang);
      render();
    });
    card.appendChild(langBtn);

    const title = doc.createElement('div');
    title.className = 'setup-title';
    title.textContent = t('wizard.title');
    const sub = doc.createElement('div');
    sub.className = 'setup-sub';
    sub.textContent = t('wizard.subtitle');
    card.append(title, sub);

    const dots = doc.createElement('div');
    dots.className = 'wizard-dots';
    steps.forEach((st, i) => {
      const dot = doc.createElement('span');
      dot.className = 'wizard-dot' + (i === s.index ? ' on' : i < s.index ? ' done' : '');
      dot.title = t(st.titleKey);
      dots.appendChild(dot);
    });
    card.appendChild(dots);

    const stepTitle = doc.createElement('div');
    stepTitle.className = 'wizard-step-title';
    stepTitle.textContent =
      `${s.index + 1}/${s.count} · ${t(step.titleKey)}` + (step.optional ? ` ${t('wizard.optional')}` : '');
    card.appendChild(stepTitle);

    const body = doc.createElement('div');
    body.className = 'wizard-step-body';
    body.dataset['step'] = step.id;
    card.appendChild(body);
    // v0.39.0: a step carrying scan results earns the wider card — spend width before height.
    if (step.id === 'voice' && voice.scan) card.dataset['dense'] = '1';
    else delete card.dataset['dense'];

    // v0.35.4: the walkthrough card — plain-language registration/download guidance + links.
    // v0.39.0: a <details> that yields its space once the step has content of its own.
    const guide = STEP_GUIDES[step.id];
    const guideBox = doc.createElement('details');
    guideBox.className = 'wizard-guide';
    guideBox.open = guideOpen(step.id, step.id === 'voice' ? voice.scan !== undefined : avatarInstalled);
    const summary = doc.createElement('summary');
    summary.className = 'wizard-guide-summary';
    summary.textContent = t('wizard.guide.summary');
    guideBox.appendChild(summary);
    const guideText = doc.createElement('div');
    guideText.className = 'wizard-guide-text';
    guideText.textContent = t(guide.textKey);
    guideBox.appendChild(guideText);
    const linkRow = doc.createElement('div');
    linkRow.className = 'wizard-guide-links';
    for (const link of guide.links) {
      const a = doc.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.className = 'wizard-guide-link';
      a.textContent = t(link.labelKey);
      linkRow.appendChild(a);
    }
    guideBox.appendChild(linkRow);
    body.appendChild(guideBox);

    if (step.id === 'voice') {
      const radio = doc.createElement('div');
      radio.className = 'wizard-radio-row';
      for (const [value, key] of [
        ['browser', 'step.voice.browser'],
        ['http', 'step.voice.http'],
      ] as const) {
        const lab = doc.createElement('label');
        const input = doc.createElement('input');
        input.type = 'radio';
        input.name = 'tts-backend';
        input.value = value;
        input.checked = voiceBackend === value;
        input.addEventListener('change', () => {
          voiceBackend = value;
          values.set('LUNA_TTS_BACKEND', value);
          render();
        });
        const span = doc.createElement('span');
        span.textContent = t(key);
        lab.append(input, span);
        radio.appendChild(lab);
      }
      body.appendChild(radio);
      if (voiceBackend === 'http') {
        for (const f of step.fields)
          fieldRow(body, t(f.labelKey), f, values, secretHint(f, t));

        // v0.37.2 (标准 1): the one-click installer — download + deploy the GPT-SoVITS runtime and
        // mark it ready, resumable across quits. Renders only in the desktop shell (bridge present).
        const provisionStart = setup?.provisionStart;
        const provisionStatus = setup?.provisionStatus;
        if (provisionStart && provisionStatus) {
          const box = doc.createElement('div');
          box.className = 'wizard-provision';
          const row = doc.createElement('div');
          row.className = 'wizard-actions';
          const btn = doc.createElement('button');
          btn.type = 'button';
          btn.className = 'setup-btn';
          btn.textContent = t('step.voice.provision.button');
          const line = doc.createElement('div');
          line.className = 'wizard-provision-status';
          line.textContent = t('step.voice.provision.hint');
          row.appendChild(btn);
          box.append(row, line);
          body.appendChild(box);

          const paint = (snap: Record<string, unknown>): void => {
            const stage = typeof snap['stage'] === 'string' ? snap['stage'] : 'idle';
            const inFlight = snap['inFlight'] === true;
            const pct = typeof snap['pct'] === 'number' ? snap['pct'] : 0;
            const err = typeof snap['error'] === 'string' ? ` — ${snap['error']}` : '';
            const pctTxt = stage === 'downloading' && pct > 0 ? ` ${pct}%` : '';
            line.textContent = `${t(provisionCopyKey(stage, inFlight))}${pctTxt}${stage === 'failed' ? err : ''}`;
            btn.disabled = inFlight || stage === 'ready';
            if ((stage === 'ready' || stage === 'failed') && provisionTimer !== null) {
              clearInterval(provisionTimer);
              provisionTimer = null;
            }
          };
          const poll = (): void => {
            void provisionStatus().then(paint);
          };
          poll(); // hydrate a resumed/parked install on step entry
          btn.addEventListener('click', () => {
            void provisionStart().then((r) => {
              if (r['ok'] !== true) {
                line.textContent = typeof r['error'] === 'string' ? r['error'] : t('step.voice.provision.failed');
                return;
              }
              if (provisionTimer === null) provisionTimer = setInterval(poll, 800);
            });
          });
        }

        // v0.35.3: drop the downloaded GPT-SoVITS pack → scan → confirm picks/transcript → install
        // (weights copied, luna.env written, api_v2 yaml + launch command generated). BYO boundary:
        // Luna prepares everything; the user runs the command.
        const scanPack = setup?.scanVoicePack;
        const installPack = setup?.installVoicePack;
        if (scanPack && installPack) {
          const zone = createDropZone(doc, {
            label: t('step.voice.drop'),
            onFiles: (files) => {
              const first = files.item(0);
              if (!first) return;
              setStatus(t('step.voice.scanning'), 'info');
              void scanPack(first).then((r) => {
                const res = r as VoiceScanResult;
                if (!res.ok || !res.scan || !res.root) {
                  setStatus(typeof res.error === 'string' ? res.error : '', 'error');
                  return;
                }
                voice.root = res.root;
                voice.scan = res.scan;
                voice.picks = {
                  ...(res.scan.gpt.length === 1 ? { gptCkpt: res.scan.gpt[0] } : {}),
                  ...(res.scan.sovits.length === 1 ? { sovitsPth: res.scan.sovits[0] } : {}),
                  ...(res.scan.refWavs.length === 1 ? { referenceWav: res.scan.refWavs[0] } : {}),
                  ...(res.scan.transcripts.length > 0 ? { transcriptTxt: res.scan.transcripts[0] } : {}),
                };
                if (voice.transcript === '' && typeof res.transcriptPreview === 'string')
                  voice.transcript = res.transcriptPreview;
                voice.installedOk = false;
                voice.command = undefined;
                render();
              });
            },
          });
          body.appendChild(zone);

          if (voice.scan && voice.root) {
            // v0.39.0: everything the scan produced lives in ONE block with horizontal rows, so a
            // dropped pack adds a bounded card instead of eight full-width form rows.
            const pack = doc.createElement('div');
            pack.className = 'wizard-pack';
            const packTitle = doc.createElement('div');
            packTitle.className = 'wizard-pack-title';
            packTitle.textContent = t('step.voice.pack.title');
            pack.appendChild(packTitle);
            body.appendChild(pack);
            const pickRow = (
              labelKey: string,
              options: string[],
              picked: string | undefined,
              onPick: (p: string) => void,
            ): void => {
              const row = doc.createElement('label');
              row.className = 'setup-field';
              const span = doc.createElement('span');
              span.textContent = t(labelKey);
              row.appendChild(span);
              if (options.length === 1) {
                const val = doc.createElement('div');
                val.className = 'wizard-picked';
                val.textContent = fileName(options[0]!);
                row.appendChild(val);
              } else {
                const select = doc.createElement('select');
                select.className = 'wizard-select';
                for (const opt of options) {
                  const o = doc.createElement('option');
                  o.value = opt;
                  o.textContent = fileName(opt);
                  o.selected = opt === picked;
                  select.appendChild(o);
                }
                select.addEventListener('change', () => onPick(select.value));
                if (!picked && options[0]) onPick(options[0]);
                row.appendChild(select);
              }
              pack.appendChild(row);
            };
            pickRow('step.voice.gpt', voice.scan.gpt, voice.picks.gptCkpt, (p) => {
              voice.picks.gptCkpt = p;
            });
            pickRow('step.voice.sovits', voice.scan.sovits, voice.picks.sovitsPth, (p) => {
              voice.picks.sovitsPth = p;
            });
            pickRow('step.voice.ref', voice.scan.refWavs, voice.picks.referenceWav, (p) => {
              voice.picks.referenceWav = p;
            });

            const tRow = doc.createElement('label');
            tRow.className = 'setup-field';
            const tSpan = doc.createElement('span');
            tSpan.textContent = t('step.voice.transcript');
            const tArea = doc.createElement('textarea');
            tArea.className = 'wizard-textarea';
            tArea.rows = 2;
            tArea.value = voice.transcript;
            tArea.addEventListener('input', () => {
              voice.transcript = tArea.value;
            });
            tRow.append(tSpan, tArea);
            pack.appendChild(tRow);

            const langRow = doc.createElement('label');
            langRow.className = 'setup-field';
            const lSpan = doc.createElement('span');
            lSpan.textContent = t('step.voice.promptLang');
            const lSel = doc.createElement('select');
            lSel.className = 'wizard-select';
            for (const l of ['en', 'zh', 'ja', 'auto']) {
              const o = doc.createElement('option');
              o.value = l;
              o.textContent = l;
              o.selected = voice.promptLang === l;
              lSel.appendChild(o);
            }
            lSel.addEventListener('change', () => {
              voice.promptLang = lSel.value;
            });
            langRow.append(lSpan, lSel);
            pack.appendChild(langRow);

            const runtimeRow = doc.createElement('div');
            runtimeRow.className = 'wizard-runtime-row';
            const rBtn = doc.createElement('button');
            rBtn.type = 'button';
            rBtn.className = 'setup-btn ghost';
            rBtn.textContent = t('step.voice.runtime.choose');
            const rInfo = doc.createElement('span');
            rInfo.className = 'wizard-runtime-info';
            rInfo.textContent = voice.runtimeDir
              ? `${fileName(voice.runtimeDir)}${voice.runtimeVenv ? ' (venv ✓)' : ''}`
              : t('step.voice.runtime.none');
            rBtn.addEventListener('click', () => {
              void setup?.chooseTtsRuntime?.().then((r) => {
                const ok = r['ok'] === true;
                if (!ok) {
                  if (r['error'] !== 'cancelled') setStatus(String(r['error'] ?? ''), 'error');
                  return;
                }
                voice.runtimeDir = String(r['dir'] ?? '');
                voice.runtimeVenv = r['venv'] === true;
                render();
              });
            });
            runtimeRow.append(rBtn, rInfo);
            pack.appendChild(runtimeRow);

            const installBtn = doc.createElement('button');
            installBtn.type = 'button';
            installBtn.className = 'setup-btn wizard-voice-install';
            installBtn.textContent = t('step.voice.install');
            installBtn.disabled =
              busy || !voice.picks.gptCkpt || !voice.picks.sovitsPth || !voice.picks.referenceWav;
            installBtn.addEventListener('click', () => {
              if (!voice.root) return;
              setStatus(t('wizard.installing'), 'info');
              const args: Record<string, string> = {
                root: voice.root,
                gptCkpt: voice.picks.gptCkpt ?? '',
                sovitsPth: voice.picks.sovitsPth ?? '',
                referenceWav: voice.picks.referenceWav ?? '',
                transcriptTxt: voice.picks.transcriptTxt ?? '',
                promptText: voice.transcript,
                promptLang: voice.promptLang,
                textLang: 'auto',
              };
              if (voice.runtimeDir) args['runtimeDir'] = voice.runtimeDir;
              void installPack(args).then((r) => {
                if (r['ok'] !== true) {
                  setStatus(String(r['error'] ?? ''), 'error');
                  return;
                }
                voice.installedOk = true;
                voice.command = typeof r['command'] === 'string' ? r['command'] : undefined;
                render();
                const st = card.querySelector('.setup-status');
                if (st instanceof HTMLElement) {
                  st.textContent = t('step.voice.installed');
                  st.dataset['kind'] = 'ok';
                }
              });
            });
            pack.appendChild(installBtn);

            if (voice.installedOk && voice.command) {
              const cmdTitle = doc.createElement('div');
              cmdTitle.className = 'setup-sub';
              cmdTitle.textContent = t('step.voice.command.title');
              const pre = doc.createElement('pre');
              pre.className = 'wizard-command';
              pre.textContent = voice.command;
              const copyBtn = doc.createElement('button');
              copyBtn.type = 'button';
              copyBtn.className = 'setup-btn ghost wizard-copy';
              copyBtn.textContent = t('step.voice.copy');
              copyBtn.addEventListener('click', () => {
                void navigator.clipboard?.writeText(voice.command ?? '').then(() => {
                  copyBtn.textContent = t('step.voice.copied');
                });
              });
              pack.append(cmdTitle, pre, copyBtn);
            }
          }
        }

        // Live health badge — polls the same /api/tts/health the app itself uses; flips green the
        // moment the user's api_v2 answers. Read-only and cheap; cleared on every re-render.
        const badge = doc.createElement('div');
        badge.className = 'wizard-voice-badge down';
        badge.textContent = t('step.voice.badge.down');
        body.appendChild(badge);
        const testBtn = doc.createElement('button');
        testBtn.type = 'button';
        testBtn.className = 'setup-btn ghost wizard-voice-test';
        testBtn.textContent = t('step.voice.test');
        testBtn.disabled = true;
        testBtn.addEventListener('click', () => {
          testBtn.disabled = true;
          void fetch('/api/tts/speak', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: 'Voice check — can you hear me?' }),
          })
            .then(async (res) => {
              if (!res.ok) throw new Error(String(res.status));
              const buf = await res.arrayBuffer();
              const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
              const audio = new Audio(url);
              audio.addEventListener('ended', () => URL.revokeObjectURL(url));
              return audio.play();
            })
            .catch(() => setStatus(t('step.voice.test.failed'), 'error'))
            .finally(() => {
              testBtn.disabled = false;
            });
        });
        body.appendChild(testBtn);
        const pollHealth = (): void => {
          // v0.37.15 (audit): res.ok is TRUE for the managed 200s {state:'starting'|'gave-up'}, so the
          // badge went green while api_v2 was still loading (~13 s) or had crash-looped out — and Test
          // then 502'd. Read the body like bootGate does: green only on real readiness, a distinct
          // "warming" state while it loads, down on gave-up/unreachable.
          void fetch('/api/tts/health', { signal: AbortSignal.timeout(2500) })
            .then(async (res) => {
              const body = (await res.json().catch(() => null)) as { backend?: { ready?: boolean; state?: string } } | null;
              const state = body?.backend?.state;
              const ready = res.ok && (body?.backend?.ready === true || state === 'ready');
              const warming = res.ok && (state === 'starting' || state === 'restarting');
              badge.classList.toggle('up', ready);
              badge.classList.toggle('warming', warming);
              badge.classList.toggle('down', !ready && !warming);
              badge.textContent = t(ready ? 'step.voice.badge.up' : warming ? 'step.voice.badge.warming' : 'step.voice.badge.down');
              testBtn.disabled = !ready;
            })
            .catch(() => {
              badge.classList.remove('up', 'warming');
              badge.classList.add('down');
              badge.textContent = t('step.voice.badge.down');
              testBtn.disabled = true;
            });
        };
        pollHealth();
        healthTimer = setInterval(pollHealth, 3000);
      }
    } else if (step.id === 'avatar') {
      const chooseModel = pet?.chooseModel;
      const installFile = pet?.installModelFile;
      const onResult = (r: InstallResult): void => {
        // 'cancelled' is the picker dialog being dismissed — not an error worth alarming over.
        if (!r.ok && r.error === 'cancelled') return;
        if (!r.ok) return setStatus(r.error ?? '', 'error');
        avatarInstalled = true;
        render(); // collapses the walkthrough now that the step is done; status is re-set after
        const st = card.querySelector('.setup-status');
        if (st instanceof HTMLElement) {
          st.textContent = t('step.avatar.installed');
          st.dataset['kind'] = 'ok';
        }
      };
      if (installFile) {
        // v0.35.2: drag the downloaded model folder straight in.
        const zone = createDropZone(doc, {
          label: t('step.avatar.drop'),
          onFiles: (files) => {
            const first = files.item(0);
            if (!first) return;
            setStatus(t('wizard.installing'), 'info');
            void installFile(first).then(onResult);
          },
        });
        body.appendChild(zone);
      }
      if (chooseModel) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'setup-btn ghost';
        btn.textContent = t('step.avatar.choose');
        btn.addEventListener('click', () => {
          void chooseModel().then(onResult);
        });
        body.appendChild(btn);
      }
      if (!chooseModel && !installFile) {
        const note = doc.createElement('div');
        note.className = 'setup-sub';
        note.textContent = t('step.avatar.browserOnly');
        body.appendChild(note);
      }
    } else {
      const probeKind = PROBE_STEP[step.id];
      const inputs = step.fields.map((f) => fieldRow(body, t(f.labelKey), f, values, secretHint(f, t)));
      if (probeKind) {
        for (const input of inputs)
          input.addEventListener('input', () => probeStates.set(step.id, 'none'));
      }
      if (step.id === 'weather') {
        const note = doc.createElement('div');
        note.className = 'setup-sub wizard-provider-note';
        const updateNote = (): void => {
          const hasKey = (values.get('LUNA_WEATHER_API_KEY') ?? '').trim() !== '';
          note.textContent = t(hasKey ? 'step.weather.provider.qweather' : 'step.weather.provider.openmeteo');
        };
        updateNote();
        for (const input of inputs) input.addEventListener('input', updateNote);
        body.appendChild(note);
      }
    }

    const status = doc.createElement('div');
    status.className = 'setup-status';
    card.appendChild(status);
    const setStatus = (text: string, kind: 'info' | 'error' | 'ok'): void => {
      status.textContent = text;
      status.dataset['kind'] = kind;
    };

    const actions = doc.createElement('div');
    actions.className = 'setup-actions wizard-actions';
    card.appendChild(actions);

    const mkBtn = (label: string, cls: string): HTMLButtonElement => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      actions.appendChild(b);
      return b;
    };

    const backBtn = mkBtn(t('wizard.back'), 'setup-btn ghost wizard-back');
    backBtn.disabled = s.atFirst || busy;
    backBtn.addEventListener('click', () => {
      nav.back();
      render();
    });

    if (step.id === 'chat') {
      const testBtn = mkBtn(t('wizard.test'), 'setup-btn ghost wizard-test');
      testBtn.disabled = busy || !live;
      testBtn.addEventListener('click', () => {
        const f = chatFields();
        if (!f) return setStatus(t('wizard.chat.required'), 'error');
        if (!setup) return;
        busy = true;
        testBtn.disabled = true;
        setStatus(t('wizard.testing'), 'info');
        void setup.probe(f).then((v) => {
          busy = false;
          testBtn.disabled = false;
          setStatus(v.ok ? t('wizard.test.ok') : (v.error ?? ''), v.ok ? 'ok' : 'error');
        });
      });
    }

    const probeKind = PROBE_STEP[step.id];
    const runProbe = (kind: ProbeKind, onDone: (v: SetupVerdict) => void): void => {
      const pf = probeFieldsFor(kind, values);
      if (!pf) return setStatus(t('wizard.nothingToTest'), 'info');
      if (!setup?.probeProvider) return;
      busy = true;
      setStatus(t('wizard.testing'), 'info');
      void setup.probeProvider(kind, pf).then((v) => {
        busy = false;
        probeStates.set(step.id, v.ok ? 'ok' : 'fail');
        onDone(v);
      });
    };
    if (probeKind && setup?.probeProvider) {
      const testBtn = mkBtn(t('wizard.test'), 'setup-btn ghost wizard-test');
      testBtn.disabled = busy || !live;
      testBtn.addEventListener('click', () => {
        runProbe(probeKind, (v) => setStatus(v.ok ? t('wizard.test.ok') : (v.error ?? ''), v.ok ? 'ok' : 'error'));
      });
    }

    if (step.optional && !s.atLast) {
      const skipBtn = mkBtn(t('wizard.skip'), 'setup-btn ghost wizard-skip');
      skipBtn.disabled = busy;
      skipBtn.addEventListener('click', () => {
        for (const f of step.fields) values.delete(f.key);
        nav.next();
        render();
      });
    }

    const nextBtn = mkBtn(
      t(probeKind ? nextLabelKey(probeStates.get(step.id) ?? 'none', s.atLast) : s.atLast ? 'wizard.finish' : 'wizard.next'),
      'setup-btn wizard-next',
    );
    nextBtn.disabled = busy || (s.atLast && !live);
    nextBtn.addEventListener('click', () => {
      if (step.id === 'chat' && !chatFields()) return setStatus(t('wizard.chat.required'), 'error');
      // v0.35.1: an optional step with a filled, untested key auto-probes on Next — pass advances,
      // fail shows the verdict and arms "continue anyway" (this same button, second click).
      if (probeKind && setup?.probeProvider && !s.atLast) {
        const pf = probeFieldsFor(probeKind, values);
        if (probeGateAction(pf !== null, probeStates.get(step.id) ?? 'none') === 'probe') {
          runProbe(probeKind, (v) => {
            if (v.ok) {
              nav.next();
              render();
            } else {
              nextBtn.textContent = t('wizard.continueAnyway');
              setStatus(v.error ?? '', 'error');
            }
          });
          return;
        }
      }
      if (!s.atLast) {
        nav.next();
        render();
        return;
      }
      if (!setup) return;
      busy = true;
      render();
      const finalStatus = card.querySelector('.setup-status');
      if (finalStatus instanceof HTMLElement) {
        finalStatus.textContent = makeT(lang)('wizard.finishing');
        finalStatus.dataset['kind'] = 'info';
      }
      void setup.wizardSubmit(collectValues(values)).then((v) => {
        // On success the shell swaps this window for the app; still here = failure.
        if (!v.ok) {
          busy = false;
          render();
          const st = card.querySelector('.setup-status');
          if (st instanceof HTMLElement) {
            st.textContent = v.error ?? makeT(lang)('wizard.finish.failed');
            st.dataset['kind'] = 'error';
          }
        }
      });
    });
  };

  const chatFields = (): SetupFields | null => {
    const baseUrl = (values.get('ANTHROPIC_BASE_URL') ?? '').trim();
    const apiKey = (values.get('ANTHROPIC_API_KEY') ?? '').trim();
    const model = (values.get('LUNA_MODEL') ?? '').trim();
    if (!baseUrl || !apiKey) return null;
    return { baseUrl, apiKey, model };
  };

  // v0.37.8: hydrate from what is ALREADY in luna.env, so "Re-run setup" preserves the config
  // instead of overwriting it with the stock defaults. Secrets come back as names only.
  const prefill = setup?.wizardPrefill;
  if (live && prefill) {
    void prefill().then((r) => {
      const specs = steps.flatMap((st) => st.fields);
      const saved = r.values ?? {};
      const h = hydrateWizardValues(saved, r.configured ?? [], specs);
      values = h.values;
      configuredSecrets = h.configured;
      const backend = (saved['LUNA_TTS_BACKEND'] ?? '').trim();
      if (backend !== '') voiceBackend = backend; // a saved http voice must survive a re-run
      render();
    });
  }

  render();
}
