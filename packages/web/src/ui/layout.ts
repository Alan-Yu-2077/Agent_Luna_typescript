// Builds the cute UI shell (vtuber-overlay style: chat panel left, model stage
// right, striped bg + lace borders + scattered motifs) plus the v0.13.4 polish
// chrome (dream overlay, mood pip, scroll pill, settings popover), and returns
// the live mount points the app wires events to. Pure DOM construction.

export type LayoutRefs = {
  statusBadge: HTMLElement;
  chatLog: HTMLElement;
  input: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  dreamBtn: HTMLButtonElement;
  modelStage: HTMLElement;
  moodPip: HTMLElement;
  scrollPill: HTMLButtonElement;
  dreamOverlay: HTMLElement;
  dreamWakeBtn: HTMLButtonElement;
  dreamCaption: HTMLElement;
  settingsBtn: HTMLButtonElement;
  settingsPanel: HTMLElement;
  ttsToggle: HTMLInputElement;
  live2dToggle: HTMLInputElement;
  motionToggle: HTMLInputElement;
  gazeToggle: HTMLInputElement;
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

export function buildLayout(root: HTMLElement): LayoutRefs {
  const doc = root.ownerDocument;
  root.className = 'luna-app';
  while (root.firstChild) root.removeChild(root.firstChild);

  add(root, 'div', 'lace-top');
  const stage = add(root, 'div', 'stage');

  const statusBadge = add(stage, 'div', 'status-badge', '连接中…');

  const settingsBtn = doc.createElement('button');
  settingsBtn.className = 'settings-btn';
  settingsBtn.type = 'button';
  settingsBtn.setAttribute('aria-label', '设置');
  settingsBtn.textContent = '⚙';
  stage.appendChild(settingsBtn);
  const settingsPanel = add(stage, 'div', 'settings-panel');
  const ttsToggle = toggleRow(settingsPanel, '语音', localStorage.getItem('luna:tts') !== '0');
  const live2dToggle = toggleRow(settingsPanel, 'Live2D 模型', localStorage.getItem('luna:live2d') !== '0');
  const motionToggle = toggleRow(settingsPanel, '减少动效', localStorage.getItem('luna:reduce-motion') === '1');
  const gazeToggle = toggleRow(settingsPanel, '视线跟随', localStorage.getItem('luna:gaze-follow') !== '0');
  add(settingsPanel, 'div', 'hint', '语音 / 模型改动需刷新生效 · 滚轮缩放 · 双击复位');

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
  const header = add(panel, 'div', 'chat-header');
  add(header, 'span', 'dot');
  add(header, 'span', undefined, 'Luna · 在线');
  const chatLog = add(panel, 'div', 'chat-log');
  const scrollPill = doc.createElement('button');
  scrollPill.className = 'scroll-pill';
  scrollPill.type = 'button';
  scrollPill.textContent = '↓ 新消息';
  panel.appendChild(scrollPill);

  const inputRow = add(panel, 'div', 'chat-input-row');
  const input = doc.createElement('input');
  input.className = 'chat-input';
  input.type = 'text';
  input.placeholder = '对 Luna 说点什么…';
  input.autocomplete = 'off';
  inputRow.appendChild(input);
  const sendBtn = doc.createElement('button');
  sendBtn.className = 'send-btn';
  sendBtn.type = 'button';
  sendBtn.setAttribute('aria-label', '发送');
  sendBtn.textContent = '➤';
  inputRow.appendChild(sendBtn);

  const modelStage = add(stage, 'div', 'model-stage');
  const moodPip = add(modelStage, 'div', 'mood-pip');
  add(moodPip, 'span', 'emoji', '');
  add(moodPip, 'span', 'mood-label', '');
  const ph = add(modelStage, 'div', 'model-placeholder');
  add(ph, 'div', 'ph-circle', 'yumi');
  add(ph, 'div', 'label', '模型表演区');
  add(ph, 'div', 'sub', '可拖动 · v0.13.1 接入真模型');
  const dreamBtn = doc.createElement('button');
  dreamBtn.className = 'dream-btn';
  dreamBtn.type = 'button';
  dreamBtn.textContent = '🌙 入梦';
  modelStage.appendChild(dreamBtn);

  add(root, 'div', 'lace-bottom');

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
  add(dreamOverlay, 'div', 'dream-title', 'Luna 在做梦…');
  const dreamCaption = add(dreamOverlay, 'div', 'dream-caption', '');
  const dreamWakeBtn = doc.createElement('button');
  dreamWakeBtn.className = 'wake-btn';
  dreamWakeBtn.type = 'button';
  dreamWakeBtn.textContent = '☀️ 唤醒';
  dreamOverlay.appendChild(dreamWakeBtn);

  return {
    statusBadge, chatLog, input, sendBtn, dreamBtn, modelStage,
    moodPip, scrollPill, dreamOverlay, dreamWakeBtn, dreamCaption,
    settingsBtn, settingsPanel, ttsToggle, live2dToggle, motionToggle, gazeToggle,
  };
}
