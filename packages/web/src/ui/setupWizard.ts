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
};

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

type PetBridge = { chooseModel?: () => Promise<{ ok: boolean; modelUrl?: string; error?: string }> };

function bridges(): { setup?: WizardBridge & { wizard?: boolean }; pet?: PetBridge } {
  const g = globalThis as { lunaSetup?: WizardBridge & { wizard?: boolean }; lunaPet?: PetBridge };
  return { setup: g.lunaSetup, pet: g.lunaPet };
}

function fieldRow(
  parent: HTMLElement,
  label: string,
  spec: WizardFieldSpec,
  values: Map<string, string>,
): HTMLInputElement {
  const doc = parent.ownerDocument;
  const row = doc.createElement('label');
  row.className = 'setup-field';
  const span = doc.createElement('span');
  span.textContent = label;
  const input = doc.createElement('input');
  input.type = spec.type;
  input.placeholder = spec.placeholder;
  input.value = values.get(spec.key) ?? spec.initial ?? '';
  if (input.value !== '') values.set(spec.key, input.value);
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.addEventListener('input', () => values.set(spec.key, input.value));
  row.append(span, input);
  parent.appendChild(row);
  return input;
}

export function mountSetupWizard(root: HTMLElement, opts: { preview?: boolean } = {}): void {
  const doc = root.ownerDocument;
  root.classList.add('luna-app', 'setup');
  while (root.firstChild) root.removeChild(root.firstChild);

  let lang: SetupLang = detectSetupLang();
  const steps = wizardSteps();
  const nav = createWizardNav(steps.length);
  const values = new Map<string, string>();
  const probeStates = new Map<string, ProbeState>(); // per-step; reset to 'none' when its fields change
  let voiceBackend = 'browser';
  let busy = false;

  const card = doc.createElement('div');
  card.className = 'setup-card wizard';
  root.appendChild(card);

  const { setup, pet } = bridges();
  const live = !opts.preview && !!setup;

  const render = (): void => {
    const t = makeT(lang);
    const s = nav.state();
    const step = steps[s.index]!;
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
      if (voiceBackend === 'http') for (const f of step.fields) fieldRow(body, t(f.labelKey), f, values);
    } else if (step.id === 'avatar') {
      const chooseModel = pet?.chooseModel;
      if (chooseModel) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'setup-btn ghost';
        btn.textContent = t('step.avatar.choose');
        btn.addEventListener('click', () => {
          void chooseModel().then((r) => {
            setStatus(r.ok ? t('step.avatar.installed') : (r.error ?? ''), r.ok ? 'ok' : 'error');
          });
        });
        body.appendChild(btn);
      } else {
        const note = doc.createElement('div');
        note.className = 'setup-sub';
        note.textContent = t('step.avatar.browserOnly');
        body.appendChild(note);
      }
    } else {
      const probeKind = PROBE_STEP[step.id];
      const inputs = step.fields.map((f) => fieldRow(body, t(f.labelKey), f, values));
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

  render();
}
