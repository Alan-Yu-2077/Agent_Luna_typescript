// Builds the cute UI shell (vtuber-overlay style: chat panel left, model stage
// right, striped bg + lace borders + scattered motifs) and returns the live
// mount points the app wires events to. Pure DOM construction — no app logic.

export type LayoutRefs = {
  statusBadge: HTMLElement;
  chatLog: HTMLElement;
  input: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  dreamBtn: HTMLButtonElement;
  modelStage: HTMLElement;
};

type Motif = { ch: string; top: string; left: string; size: string; op?: string };

// Soft monochrome motifs scattered over the model (right) area. ︎ forces
// the cloud glyph to text presentation so it takes the lace tint.
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

function add(parent: Element, tag: string, cls?: string, text?: string): HTMLElement {
  const e = parent.ownerDocument.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

export function buildLayout(root: HTMLElement): LayoutRefs {
  const doc = root.ownerDocument;
  root.className = 'luna-app';
  while (root.firstChild) root.removeChild(root.firstChild);

  add(root, 'div', 'lace-top');
  const stage = add(root, 'div', 'stage');

  const statusBadge = add(stage, 'div', 'status-badge', '连接中…');

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

  return { statusBadge, chatLog, input, sendBtn, dreamBtn, modelStage };
}
