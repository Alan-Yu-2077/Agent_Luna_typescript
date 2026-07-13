import type { Setting } from '@luna/protocol';

// v0.27.1: the server-driven half of the settings panel. The server's registry is the single
// authority (labels, kinds, validation, restart badges) — this renders whatever arrives and
// reports edits back; it never hardcodes a switch. Rebuilt wholesale per settings.state (the
// list is small); an in-flight rejection is healed by the state the server sends back with it.

export type SettingsSend = (key: string, value: string | null) => void;

export function groupByCategory(settings: Setting[]): Array<[string, Setting[]]> {
  const groups: Array<[string, Setting[]]> = [];
  for (const s of settings) {
    const g = groups.find(([name]) => name === s.category);
    if (g) g[1].push(s);
    else groups.push([s.category, [s]]);
  }
  return groups;
}

// v0.36.4: the value chip beside a slider. Snap the raw string to a tidy number (fall back to the
// raw string if it isn't numeric) so a dragged 3.5000001 reads "3.5".
export function formatSliderValue(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(Math.round(n * 100) / 100);
}

function controlFor(doc: Document, s: Setting, send: SettingsSend): HTMLElement {
  if (s.kind === 'boolean') {
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.className = 'setting-switch'; // v0.36.4: CSS-only iOS switch; the real checkbox stays for a11y
    input.checked = s.value === '1';
    input.addEventListener('change', () => send(s.key, input.checked ? '1' : '0'));
    return input;
  }
  // v0.36.4: a bounded number becomes a slider + live value chip; unbounded numbers + text stay
  // fields. Either way the commit contract (blur/Enter for fields, release for the slider) is intact.
  if (s.kind === 'number' && s.min !== undefined && s.max !== undefined) {
    const wrap = doc.createElement('span');
    wrap.className = 'setting-slider';
    const range = doc.createElement('input');
    range.type = 'range';
    range.min = String(s.min);
    range.max = String(s.max);
    range.step = 'any';
    range.value = s.value;
    const chip = doc.createElement('span');
    chip.className = 'slider-chip';
    chip.textContent = formatSliderValue(s.value);
    range.addEventListener('input', () => {
      chip.textContent = formatSliderValue(range.value); // live while dragging, no commit
    });
    range.addEventListener('change', () => {
      if (range.value !== s.value) send(s.key, range.value); // commit on release
    });
    wrap.append(range, chip);
    return wrap;
  }
  const input = doc.createElement('input');
  input.className = 'setting-input';
  if (s.kind === 'number') {
    input.type = 'number';
    if (s.min !== undefined) input.min = String(s.min);
    if (s.max !== undefined) input.max = String(s.max);
    input.step = 'any';
  } else {
    input.type = 'text';
  }
  input.value = s.value;
  // commit on blur/Enter, not per keystroke — a half-typed "31.2" must not fire validation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
  input.addEventListener('blur', () => {
    if (input.value !== s.value) send(s.key, input.value);
  });
  return input;
}

export function renderServerSettings(
  container: HTMLElement,
  settings: Setting[],
  send: SettingsSend,
): void {
  const doc = container.ownerDocument;
  while (container.firstChild) container.removeChild(container.firstChild);
  for (const [category, items] of groupByCategory(settings)) {
    const head = doc.createElement('div');
    head.className = 'settings-section';
    head.textContent = category;
    container.appendChild(head);
    for (const s of items) {
      const row = doc.createElement('label');
      row.className = 'setting-row';
      row.title = s.hint;
      const name = doc.createElement('span');
      name.textContent = s.label;
      row.appendChild(name);
      if (s.restart_required) {
        const badge = doc.createElement('span');
        badge.className = 'setting-badge';
        badge.textContent = 'restart';
        badge.title = 'Takes effect after Luna restarts';
        name.appendChild(badge);
      }
      const right = doc.createElement('span');
      right.className = 'setting-control';
      if (s.source === 'user') {
        const reset = doc.createElement('button');
        reset.type = 'button';
        reset.className = 'setting-reset';
        reset.textContent = '↺';
        reset.title = 'Reset to default';
        reset.addEventListener('click', (e) => {
          e.preventDefault(); // inside a <label>: don't also toggle the checkbox
          send(s.key, null);
        });
        right.appendChild(reset);
      }
      right.appendChild(controlFor(doc, s, send));
      row.appendChild(right);
      container.appendChild(row);
    }
  }
}
