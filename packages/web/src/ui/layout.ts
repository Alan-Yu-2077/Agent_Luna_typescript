// Builds the cute UI shell (vtuber-overlay style: chat panel left, model stage
// right, striped bg + lace borders + scattered motifs) plus the v0.13.4 polish
// chrome (dream overlay, mood pip, scroll pill, settings popover), and returns
// the live mount points the app wires events to. Pure DOM construction.

import { DEFAULT_IDLE_PROFILE, IDLE_PROFILES } from '../live2d/faceData';

export type LayoutRefs = {
  statusBadge: HTMLElement;
  chatLog: HTMLElement;
  input: HTMLInputElement;
  inputRow: HTMLElement;
  sendBtn: HTMLButtonElement;
  collapseBtn: HTMLButtonElement;
  dreamBtn: HTMLButtonElement;
  modelStage: HTMLElement;
  moodPip: HTMLElement;
  scrollPill: HTMLButtonElement;
  dreamOverlay: HTMLElement;
  dreamWakeBtn: HTMLButtonElement;
  dreamCaption: HTMLElement;
  settingsBtn: HTMLButtonElement;
  settingsPanel: HTMLElement;
  settingsBackdrop: HTMLElement;
  ttsToggle: HTMLInputElement;
  live2dToggle: HTMLInputElement;
  gazeToggle: HTMLInputElement;
  idleSelect: HTMLSelectElement;
  petToggle: HTMLInputElement;
  serverSettings: HTMLElement;
};

type Motif = { ch: string; top: string; left: string; size: string; op?: string };

const MOTIFS: Motif[] = [
  { ch: '☁︎', top: '14%', left: '56%', size: '26px' },
  { ch: '☁︎', top: '52%', left: '85%', size: '20px', op: '0.6' },
  { ch: '☁︎', top: '76%', left: '60%', size: '22px', op: '0.55' },
  { ch: '◇', top: '30%', left: '73%', size: '14px' },
  { ch: '◇', top: '64%', left: '80%', size: '12px', op: '0.6' },
  { ch: '✿', top: '20%', left: '90%', size: '15px', op: '0.7' },
  { ch: '❀', top: '46%', left: '53%', size: '14px', op: '0.6' },
  { ch: '✿', top: '86%', left: '88%', size: '13px', op: '0.6' },
];

// Drifting dream stars: fixed positions + staggered timing (no RNG needed).
const STARS: Array<{ left: string; dur: string; delay: string; size: string }> = [
  { left: '12%', dur: '6s', delay: '0s', size: '14px' },
  { left: '28%', dur: '7.5s', delay: '1.2s', size: '10px' },
  { left: '44%', dur: '5.5s', delay: '0.6s', size: '16px' },
  { left: '60%', dur: '8s', delay: '2s', size: '11px' },
  { left: '76%', dur: '6.5s', delay: '0.3s', size: '13px' },
  { left: '88%', dur: '7s', delay: '1.6s', size: '10px' },
];

function add(parent: Element, tag: string, cls?: string, text?: string): HTMLElement {
  const e = parent.ownerDocument.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

function toggleRow(parent: Element, labelText: string, checked: boolean): HTMLInputElement {
  const doc = parent.ownerDocument;
  const label = add(parent, 'label');
  add(label, 'span', undefined, labelText);
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  label.appendChild(input);
  return input;
}

// v0.36.4: one settings tab pane. The active one is shown; the rest are display:none (CSS).
function tabPane(parent: Element, name: string, active: boolean): HTMLElement {
  const pane = add(parent, 'div', `settings-tab${active ? ' active' : ''}`);
  pane.dataset['tab'] = name;
  return pane;
}

// v0.36.4: one icon button in the left rail. `data-tab` links it to its pane.
function railBtn(rail: Element, icon: string, label: string, name: string, active: boolean): HTMLButtonElement {
  const doc = rail.ownerDocument;
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = `rail-btn${active ? ' active' : ''}`;
  btn.dataset['tab'] = name;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.textContent = icon;
  rail.appendChild(btn);
  return btn;
}

// v0.36.4: click a rail icon → activate its pane + button (pure show/hide, no app state).
function wireTabs(rail: HTMLElement, panes: HTMLElement[]): void {
  rail.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('.rail-btn');
    if (!(btn instanceof HTMLElement)) return;
    const name = btn.dataset['tab'];
    for (const b of rail.querySelectorAll('.rail-btn')) b.classList.toggle('active', b === btn);
    for (const p of panes) p.classList.toggle('active', p.dataset['tab'] === name);
  });
}

function selectRow(
  parent: Element,
  labelText: string,
  options: ReadonlyArray<{ id: string; label: string }>,
  selected: string,
): HTMLSelectElement {
  const doc = parent.ownerDocument;
  const label = add(parent, 'label');
  add(label, 'span', undefined, labelText);
  const sel = doc.createElement('select');
  for (const o of options) {
    const opt = doc.createElement('option');
    opt.value = o.id;
    opt.textContent = o.label;
    if (o.id === selected) opt.selected = true;
    sel.appendChild(opt);
  }
  label.appendChild(sel);
  return sel;
}

export function buildLayout(root: HTMLElement): LayoutRefs {
  const doc = root.ownerDocument;
  // classList.add, NOT `className =`: other boot code may add classes to the root before buildLayout.
  root.classList.add('luna-app');
  while (root.firstChild) root.removeChild(root.firstChild);

  const stage = add(root, 'div', 'stage');

  const statusBadge = add(stage, 'div', 'status-badge', 'Connecting…');

  const settingsBtn = doc.createElement('button');
  settingsBtn.className = 'settings-btn';
  settingsBtn.type = 'button';
  settingsBtn.setAttribute('aria-label', 'Settings');
  settingsBtn.textContent = '⚙';
  stage.appendChild(settingsBtn);

  // v0.36.4 (Initiative 26): VTube-Studio-style settings — a click-to-close backdrop + a panel that
  // glides in from the right, with a left icon rail switching between grouped tabs. Every control
  // keeps its exact semantics/refs; only the container structure + skin changed. The `.settings-panel`
  // + `.on` open contract and the `label`/`.server-settings .setting-row` selectors are preserved
  // (the packaged smoke asserts them).
  const settingsBackdrop = add(stage, 'div', 'settings-backdrop');
  const settingsPanel = add(stage, 'div', 'settings-panel');
  const settingsRail = add(settingsPanel, 'div', 'settings-rail');
  const settingsBody = add(settingsPanel, 'div', 'settings-body');
  const generalTab = tabPane(settingsBody, 'general', true);
  const avatarTab = tabPane(settingsBody, 'avatar', false);
  const serverTab = tabPane(settingsBody, 'server', false);
  railBtn(settingsRail, '🎚', 'General', 'general', true);
  railBtn(settingsRail, '✨', 'Avatar', 'avatar', false);
  railBtn(settingsRail, '☁️', 'Server', 'server', false);
  wireTabs(settingsRail, [generalTab, avatarTab, serverTab]);

  const generalCard = add(generalTab, 'div', 'settings-card');
  const ttsToggle = toggleRow(generalCard, 'Voice', localStorage.getItem('luna:tts') !== '0');
  // Desktop-shell only: app.ts hides the row when no lunaPet bridge exists (plain browser) and
  // sets checked from the actual mode (?pet=1). The Setup wizard re-run row is inserted right after
  // it by app.ts (petRow.after), so it lands in this same card.
  const petToggle = toggleRow(generalCard, 'Desktop pet', false);
  petToggle.closest('label')?.classList.add('pet-mode-row');
  add(generalTab, 'div', 'hint', 'Voice / model changes need a refresh · scroll to zoom · double-click to reset');

  const avatarCard = add(avatarTab, 'div', 'settings-card');
  const live2dToggle = toggleRow(avatarCard, 'Live2D model', localStorage.getItem('luna:live2d') !== '0');
  const gazeToggle = toggleRow(avatarCard, 'Gaze follow', localStorage.getItem('luna:gaze-follow') !== '0');
  const idleSelect = selectRow(
    avatarCard,
    'Idle animation',
    IDLE_PROFILES,
    localStorage.getItem('luna:idle-profile') ?? DEFAULT_IDLE_PROFILE,
  );

  // v0.27.1: the server-driven half — settingsView.ts fills this from settings.state.
  const serverSettings = add(serverTab, 'div', 'server-settings');
  add(serverTab, 'div', 'hint server-empty', 'No server settings yet — Luna is still connecting.');

  const motifLayer = add(stage, 'div', 'motif-layer');
  for (const m of MOTIFS) {
    const s = add(motifLayer, 'span', 'motif', m.ch);
    s.style.top = m.top;
    s.style.left = m.left;
    s.style.fontSize = m.size;
    if (m.op) s.style.opacity = m.op;
  }

  const panel = add(stage, 'div', 'chat-panel');
  for (const c of ['l1', 'l2', 'r1', 'r2']) add(panel, 'span', `puff ${c}`);
  // v0.36.0: header + log + pill live in a .chat-body wrapper so the collapse can close it
  // top-to-bottom (grid-row 1fr→0fr) into the input bar, like a window sash. The input row stays a
  // direct panel child (always visible).
  const chatBody = add(panel, 'div', 'chat-body');
  const header = add(chatBody, 'div', 'chat-header');
  add(header, 'span', 'dot');
  add(header, 'span', undefined, 'Luna · online');
  const chatLog = add(chatBody, 'div', 'chat-log');
  const scrollPill = doc.createElement('button');
  scrollPill.className = 'scroll-pill';
  scrollPill.type = 'button';
  scrollPill.textContent = '↓ New messages';
  chatBody.appendChild(scrollPill);

  const inputRow = add(panel, 'div', 'chat-input-row');
  // v0.25.1 (Initiative 18): collapse ↔ expand toggle. Lives in the input-row (NOT the header) so it
  // stays reachable in collapsed mode, where the header/log are hidden and only this row remains.
  const collapseBtn = doc.createElement('button');
  collapseBtn.className = 'collapse-btn';
  collapseBtn.type = 'button';
  collapseBtn.setAttribute('aria-label', 'Collapse chat');
  collapseBtn.textContent = '⌄';
  inputRow.appendChild(collapseBtn);
  const input = doc.createElement('input');
  input.className = 'chat-input';
  input.type = 'text';
  input.placeholder = 'Say something to Luna…';
  input.autocomplete = 'off';
  inputRow.appendChild(input);
  const sendBtn = doc.createElement('button');
  sendBtn.className = 'send-btn';
  sendBtn.type = 'button';
  sendBtn.setAttribute('aria-label', 'Send');
  sendBtn.textContent = '➤';
  inputRow.appendChild(sendBtn);

  const modelStage = add(stage, 'div', 'model-stage');
  const moodPip = add(modelStage, 'div', 'mood-pip');
  add(moodPip, 'span', 'emoji', '');
  add(moodPip, 'span', 'mood-label', '');
  const ph = add(modelStage, 'div', 'model-placeholder');
  add(ph, 'div', 'ph-circle', '🌙');
  add(ph, 'div', 'label', 'No avatar installed');
  add(ph, 'div', 'sub', 'Add a Live2D model to see Luna');
  const dreamBtn = doc.createElement('button');
  dreamBtn.className = 'dream-btn';
  dreamBtn.type = 'button';
  dreamBtn.textContent = '🌙 Dream';
  modelStage.appendChild(dreamBtn);

  const dreamOverlay = add(root, 'div', 'dream-overlay');
  const stars = add(dreamOverlay, 'div', 'dream-stars');
  for (const st of STARS) {
    const s = add(stars, 'span', undefined, '✦');
    s.style.left = st.left;
    s.style.fontSize = st.size;
    s.style.animationDuration = st.dur;
    s.style.animationDelay = st.delay;
  }
  add(dreamOverlay, 'div', 'moon', '🌙');
  add(dreamOverlay, 'div', 'dream-title', 'Luna is dreaming…');
  const dreamCaption = add(dreamOverlay, 'div', 'dream-caption', '');
  const dreamWakeBtn = doc.createElement('button');
  dreamWakeBtn.className = 'wake-btn';
  dreamWakeBtn.type = 'button';
  dreamWakeBtn.textContent = '☀️ Wake';
  dreamOverlay.appendChild(dreamWakeBtn);

  return {
    statusBadge, chatLog, input, inputRow, sendBtn, collapseBtn, dreamBtn, modelStage,
    moodPip, scrollPill, dreamOverlay, dreamWakeBtn, dreamCaption,
    settingsBtn, settingsPanel, settingsBackdrop, ttsToggle, live2dToggle, gazeToggle, idleSelect,
    petToggle, serverSettings,
  };
}
