// v0.44.6 — the module cards: chat LLM / embedding / web search / weather, each a uniform shape so
// a future module is one more declaration, not a new UI. Everything here opens NEW DOORS on
// existing machinery: values come from the wizard's prefill bridge (secrets arrive as NAMES, never
// values), probes are the wizard's own vendor-hinted probes, and Save rides the same whitelisted
// mergeEnvFile path — now with a luna.env.bak first.
//
// Effect semantics (README OQ2, settled here): saved fields take effect AFTER RESTART. The provider
// is constructed at boot, and a hot swap is complexity a single-machine app does not need — the
// card says so plainly and offers the Restart button.

export type ModuleField = {
  key: string; // the luna.env key, exactly
  label: string;
  secret?: boolean;
  placeholder?: string;
};

export type ModuleCard = {
  id: 'chat' | 'embedding' | 'search' | 'weather';
  title: string;
  blurb: string;
  fields: ModuleField[];
  // Which probe the card runs: the chat card rides lunaSetup.probe; the rest ride probeProvider.
  probe: 'chat' | 'embedding' | 'search' | 'weather';
};

export const MODULE_CARDS: readonly ModuleCard[] = [
  {
    id: 'chat',
    title: 'Chat LLM',
    blurb: '她说话用的脑子',
    probe: 'chat',
    fields: [
      { key: 'ANTHROPIC_BASE_URL', label: 'Base URL', placeholder: 'https://…' },
      { key: 'ANTHROPIC_API_KEY', label: 'API key', secret: true, placeholder: 'sk-…' },
      { key: 'LUNA_MODEL', label: 'Model' },
      { key: 'LUNA_MAX_TOKENS', label: 'Max tokens' },
    ],
  },
  {
    id: 'embedding',
    title: 'Embedding',
    blurb: '她回忆的检索向量',
    probe: 'embedding',
    fields: [
      { key: 'LUNA_EMBEDDING_BASE_URL', label: 'Base URL', placeholder: 'https://…' },
      { key: 'LUNA_EMBEDDING_API_KEY', label: 'API key', secret: true, placeholder: 'sk-…' },
      { key: 'LUNA_EMBEDDING_MODEL', label: 'Model' },
    ],
  },
  {
    id: 'search',
    title: 'Web search',
    blurb: '她查外面世界的手',
    probe: 'search',
    fields: [
      { key: 'LUNA_WEB_SEARCH_PROVIDER', label: 'Provider', placeholder: 'tavily' },
      { key: 'LUNA_WEB_SEARCH_API_KEY', label: 'API key', secret: true, placeholder: 'tvly-…' },
    ],
  },
  {
    id: 'weather',
    title: 'Weather',
    blurb: '她看窗外的眼睛',
    probe: 'weather',
    fields: [
      { key: 'LUNA_WEATHER_PROVIDER', label: 'Provider', placeholder: 'qweather' },
      { key: 'LUNA_WEATHER_API_KEY', label: 'API key', secret: true },
      { key: 'LUNA_WEATHER_API_HOST', label: 'API host', placeholder: 'xxxx.qweatherapi.com' },
    ],
  },
];

// `sk-gt6U…` — enough to recognise which key it is, never enough to retype it. An empty value reads
// 未配置; a configured-but-unknown secret (the prefill sends names only) reads as dots.
export function maskKey(value: string): string {
  const v = value.trim();
  if (v === '') return '未配置';
  if (v.length <= 8) return `${v[0]}…`;
  return `${v.slice(0, 7)}…${v.slice(-4)}`;
}

export const SECRET_CONFIGURED = '••••••••';

// Only what actually changed goes to mergeEnvFile — an untouched field must never be rewritten
// (the wizard's own collect discipline: a skipped field never clobbers an existing line).
export function changedFields(
  cards: readonly ModuleCard[],
  edits: ReadonlyMap<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const card of cards) {
    for (const f of card.fields) {
      const v = edits.get(f.key);
      if (v !== undefined && v.trim() !== '') out[f.key] = v.trim();
    }
  }
  return out;
}

// The probe payload per card, assembled from current edits + prefill values. Missing pieces stay
// empty strings — the probes themselves answer with their "enter a key" guidance.
export function probeFieldsFor(
  card: ModuleCard,
  valueOf: (key: string) => string,
): Record<string, string> {
  switch (card.probe) {
    case 'chat':
      return {
        baseUrl: valueOf('ANTHROPIC_BASE_URL'),
        apiKey: valueOf('ANTHROPIC_API_KEY'),
        model: valueOf('LUNA_MODEL'),
      };
    case 'embedding':
      return {
        baseUrl: valueOf('LUNA_EMBEDDING_BASE_URL'),
        apiKey: valueOf('LUNA_EMBEDDING_API_KEY'),
        model: valueOf('LUNA_EMBEDDING_MODEL'),
      };
    case 'search':
      return { apiKey: valueOf('LUNA_WEB_SEARCH_API_KEY') };
    case 'weather':
      return { apiKey: valueOf('LUNA_WEATHER_API_KEY'), apiHost: valueOf('LUNA_WEATHER_API_HOST') };
  }
}

export type ModulesBridges = {
  prefill?: () => Promise<{ values?: Record<string, string>; configured?: string[] }>;
  probeChat?: (fields: { baseUrl: string; apiKey: string; model: string }) => Promise<{ ok: boolean; error?: string }>;
  probeProvider?: (
    kind: 'embedding' | 'search' | 'weather',
    fields: Record<string, string>,
  ) => Promise<{ ok: boolean; error?: string }>;
  saveConfig?: (fields: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  relaunch?: () => void;
};

export function mountModulesSection(doc: Document, bridges: ModulesBridges): HTMLElement {
  const host = doc.createElement('div');
  host.className = 'modules-section';

  // A plain browser has no bridge: read-only by construction, and it says so instead of failing.
  if (!bridges.prefill || !bridges.saveConfig) {
    const note = doc.createElement('p');
    note.className = 'settings-page-note';
    note.textContent = '模块配置在桌面端编辑——浏览器里只是看看。';
    host.appendChild(note);
    return host;
  }

  const edits = new Map<string, string>();
  let prefillValues: Record<string, string> = {};
  let configuredSecrets = new Set<string>();

  const valueOf = (key: string): string => edits.get(key) ?? prefillValues[key] ?? '';

  const build = (): void => {
    for (const card of MODULE_CARDS) {
      const el = doc.createElement('article');
      el.className = 'module-card';
      const h = doc.createElement('h4');
      h.textContent = card.title;
      const blurb = doc.createElement('p');
      blurb.className = 'module-blurb';
      blurb.textContent = card.blurb;
      el.append(h, blurb);

      for (const f of card.fields) {
        const row = doc.createElement('label');
        row.className = 'module-field';
        const name = doc.createElement('span');
        name.textContent = f.label;
        const input = doc.createElement('input');
        input.type = 'text';
        if (f.placeholder) input.placeholder = f.placeholder;
        const stored = prefillValues[f.key] ?? '';
        if (f.secret) {
          // Masked at rest, editable plaintext on focus, masked again on blur. The prefill never
          // carried the secret's VALUE — only its name — so a configured key renders as dots and
          // an edit REPLACES it outright.
          input.value = configuredSecrets.has(f.key) ? SECRET_CONFIGURED : maskKey(stored);
          input.addEventListener('focus', () => {
            input.value = edits.get(f.key) ?? '';
          });
          input.addEventListener('blur', () => {
            const typed = input.value.trim();
            if (typed !== '') {
              edits.set(f.key, typed);
              input.value = maskKey(typed);
            } else {
              edits.delete(f.key);
              input.value = configuredSecrets.has(f.key) ? SECRET_CONFIGURED : maskKey(stored);
            }
          });
        } else {
          input.value = stored;
          input.addEventListener('input', () => edits.set(f.key, input.value));
        }
        row.append(name, input);
        el.appendChild(row);
      }

      const foot = doc.createElement('div');
      foot.className = 'module-foot';
      const verdict = doc.createElement('span');
      verdict.className = 'module-verdict';
      const probeBtn = doc.createElement('button');
      probeBtn.type = 'button';
      probeBtn.className = 'module-btn';
      probeBtn.textContent = 'Probe';
      probeBtn.addEventListener('click', () => {
        verdict.textContent = '探测中…';
        verdict.dataset['state'] = 'busy';
        const fields = probeFieldsFor(card, valueOf);
        const run =
          card.probe === 'chat'
            ? bridges.probeChat?.(fields as { baseUrl: string; apiKey: string; model: string })
            : bridges.probeProvider?.(card.probe, fields);
        void (run ?? Promise.resolve({ ok: false, error: 'no bridge' })).then((v) => {
          verdict.textContent = v.ok ? '通 ✓' : (v.error ?? '失败');
          verdict.dataset['state'] = v.ok ? 'ok' : 'bad';
        });
      });
      const saveBtn = doc.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'module-btn primary';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        const cardEdits = new Map([...edits].filter(([k]) => card.fields.some((f) => f.key === k)));
        const fields = changedFields([card], cardEdits);
        if (Object.keys(fields).length === 0) {
          verdict.textContent = '没有改动。';
          verdict.dataset['state'] = 'bad';
          return;
        }
        void bridges.saveConfig!(fields).then((v) => {
          if (!v.ok) {
            verdict.textContent = v.error ?? '保存失败';
            verdict.dataset['state'] = 'bad';
            return;
          }
          verdict.textContent = '已保存——重启后生效。';
          verdict.dataset['state'] = 'ok';
          restartRow.hidden = false;
        });
      });
      foot.append(probeBtn, saveBtn, verdict);
      el.appendChild(foot);
      host.appendChild(el);
    }

    const restartRow = doc.createElement('div');
    restartRow.className = 'module-restart';
    restartRow.hidden = true;
    if (bridges.relaunch) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'module-btn primary';
      btn.textContent = 'Restart Luna';
      btn.addEventListener('click', () => bridges.relaunch?.());
      restartRow.appendChild(btn);
    } else {
      restartRow.textContent = '重启 Luna 后生效。';
    }
    host.appendChild(restartRow);
  };

  void bridges
    .prefill()
    .then((p) => {
      prefillValues = p.values ?? {};
      configuredSecrets = new Set(p.configured ?? []);
    })
    .catch(() => {})
    .finally(build);

  return host;
}
