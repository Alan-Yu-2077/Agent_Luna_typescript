// v0.28.0 (Initiative 20): the first-run setup screen (desktop shell only — mounted when the shell
// loads the window with ?setup=1). Collects base URL + key + model and hands them to the shell's
// lunaSetup bridge, which tests + writes luna.env and restarts the sidecar. The key never leaves
// via this view except into that one bridge call; nothing here persists or echoes it.

type SetupFields = { baseUrl: string; apiKey: string; model: string };
type SetupVerdict = { ok: boolean; error?: string };
type SetupBridge = {
  probe(f: SetupFields): Promise<SetupVerdict>;
  submit(f: SetupFields): Promise<SetupVerdict>;
};

function bridge(): SetupBridge | undefined {
  return (globalThis as { lunaSetup?: SetupBridge }).lunaSetup;
}

function field(
  parent: HTMLElement,
  label: string,
  type: 'text' | 'password',
  value: string,
  placeholder: string,
): HTMLInputElement {
  const doc = parent.ownerDocument;
  const row = doc.createElement('label');
  row.className = 'setup-field';
  const span = doc.createElement('span');
  span.textContent = label;
  const input = doc.createElement('input');
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  row.append(span, input);
  parent.appendChild(row);
  return input;
}

export function mountSetupView(root: HTMLElement): void {
  const doc = root.ownerDocument;
  root.classList.add('luna-app', 'setup');
  while (root.firstChild) root.removeChild(root.firstChild);

  const card = doc.createElement('div');
  card.className = 'setup-card';
  const title = doc.createElement('div');
  title.className = 'setup-title';
  title.textContent = '欢迎使用 Luna';
  const sub = doc.createElement('div');
  sub.className = 'setup-sub';
  sub.textContent = '连接模型后即可开始。之后可以在设置里修改。';
  card.append(title, sub);

  const baseUrl = field(
    card,
    'API 接口地址',
    'text',
    'https://api.anthropic.com',
    'https://api.anthropic.com',
  );
  const apiKey = field(card, 'API 密钥', 'password', '', 'sk-…');
  const model = field(card, '模型', 'text', 'claude-sonnet-4-6', 'claude-sonnet-4-6');

  const status = doc.createElement('div');
  status.className = 'setup-status';
  const actions = doc.createElement('div');
  actions.className = 'setup-actions';
  const testBtn = doc.createElement('button');
  testBtn.type = 'button';
  testBtn.className = 'setup-btn ghost';
  testBtn.textContent = '测试连接';
  const saveBtn = doc.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'setup-btn';
  saveBtn.textContent = '保存并启动';
  actions.append(testBtn, saveBtn);
  card.append(status, actions);
  root.appendChild(card);

  const fields = (): SetupFields => ({
    baseUrl: baseUrl.value.trim(),
    apiKey: apiKey.value.trim(),
    model: model.value.trim(),
  });
  const setStatus = (text: string, kind: 'info' | 'error' | 'ok'): void => {
    status.textContent = text;
    status.dataset.kind = kind;
  };
  const setBusy = (busy: boolean): void => {
    testBtn.disabled = busy;
    saveBtn.disabled = busy;
  };

  const b = bridge();
  if (!b) {
    // A plain browser reached ?setup=1 — nothing to write to. Explain rather than hang.
    setStatus('配置向导只能在 Luna 桌面 App 中使用。', 'error');
    setBusy(true);
    return;
  }

  const guard = (): boolean => {
    const f = fields();
    if (!f.baseUrl || !f.apiKey) {
      setStatus('请填写接口地址和 API 密钥。', 'error');
      return false;
    }
    return true;
  };

  testBtn.addEventListener('click', async () => {
    if (!guard()) return;
    setBusy(true);
    setStatus('测试中…', 'info');
    const v = await b.probe(fields());
    setStatus(v.ok ? '连接正常 ✓' : (v.error ?? '连接失败。'), v.ok ? 'ok' : 'error');
    setBusy(false);
  });

  saveBtn.addEventListener('click', async () => {
    if (!guard()) return;
    setBusy(true);
    setStatus('正在连接并启动 Luna…', 'info');
    const v = await b.submit(fields());
    // On success the shell swaps this window for the app; if we're still here, it failed.
    if (!v.ok) {
      setStatus(v.error ?? '配置失败。', 'error');
      setBusy(false);
    }
  });
}
