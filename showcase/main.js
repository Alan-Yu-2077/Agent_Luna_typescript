// Luna TV — channel wiring. To add a channel, append one entry here and drop
// the matching video into showcase/videos/ (the filename is the `video` field).
const CHANNELS = [
  {
    id: 'rag',
    no: '01',
    name: 'RAG',
    sub: '检索召回',
    icon: '🔎',
    video: 'videos/rag.mp4',
    blurb:
      'RAG 频道:混合召回 —— 词法检索 + 向量余弦相似度,按时近度与显著度加权。旧记忆需要时才被想起,不常驻上下文。',
  },
  {
    id: 'memory',
    no: '02',
    name: 'Memory',
    sub: '三层记忆',
    icon: '📚',
    video: 'videos/memory.mp4',
    blurb:
      'Memory 频道:L1 滚动窗口 / L2 耐久回合 / L3 长期事实与灵魂文件,对话间隙的"梦境整理"把经历固化成记忆。',
  },
  {
    id: 'tool',
    no: '03',
    name: 'Tool',
    sub: '工具调用',
    icon: '🧰',
    video: 'videos/tool.mp4',
    blurb:
      'Tool 频道:流式工具调用 —— started / progress / finished 逐事件直播,配合并发策略与能力门控的完整性护栏。',
  },
  {
    id: 'web',
    no: '04',
    name: 'Web',
    sub: '联网感知',
    icon: '🌐',
    video: 'videos/web.mp4',
    blurb:
      'Web 频道:web_search 搜索与 web_fetch 安全抓取(带缓存),时间与天气作为环境感知融进对话。',
  },
];

const SWITCH_MS = 320; // static-burst duration ≈ --m-soft, slightly padded

const $ = (sel) => document.querySelector(sel);
const listEl = $('#channelList');
const player = $('#player');
const screen = $('#screen');
const noSignal = $('#noSignal');
const noSignalHint = $('#noSignalHint');
const chChip = $('#chChip');
const chName = $('#chName');
const narration = $('#narration');
const knobVol = $('#knobVol');
const knobTune = $('#knobTune');

let current = -1;
let switchTimer = 0;
const buttons = CHANNELS.map((c, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'channel-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `
    <span class="ch-icon">${c.icon}</span>
    <span class="ch-text">
      <span class="ch-title">${c.name}</span>
      <span class="ch-sub">${c.sub}</span>
    </span>
    <span class="ch-no">CH·${c.no}</span>`;
  btn.addEventListener('click', () => switchTo(i));
  listEl.append(btn);
  return btn;
});

function showNoSignal(channel) {
  noSignalHint.innerHTML = `把 <code>showcase/${channel.video}</code> 放进仓库就会开播`;
  noSignal.classList.remove('hidden');
  player.classList.add('hidden');
}
function showVideo() {
  noSignal.classList.add('hidden');
  player.classList.remove('hidden');
}

player.addEventListener('error', () => {
  if (current >= 0) showNoSignal(CHANNELS[current]);
});
player.addEventListener('loadeddata', showVideo);

function switchTo(i, opts = {}) {
  const { play = true } = opts;
  if (i === current) return;
  current = i;
  const c = CHANNELS[i];

  buttons.forEach((b, j) => {
    b.classList.toggle('active', j === i);
    b.setAttribute('aria-pressed', String(j === i));
  });
  chChip.textContent = `CH·${c.no}`;
  chName.textContent = c.name;

  // re-pop the narration bubble
  narration.textContent = c.blurb;
  narration.classList.remove('pop');
  void narration.offsetWidth;
  narration.classList.add('pop');

  // analog snow, then tune in
  screen.classList.add('switching');
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => {
    screen.classList.remove('switching');
    player.src = c.video;
    player.load();
    if (play) player.play().catch(() => {});
  }, SWITCH_MS);
}

// knobs: VOL toggles mute, TUNE steps to the next channel — each click turns the dial
let volTurns = 0;
let tuneTurns = 0;
knobVol.addEventListener('click', () => {
  volTurns += 1;
  player.muted = !player.muted;
  knobVol.classList.toggle('muted', player.muted);
  knobVol.style.transform = `rotate(${volTurns * 120}deg)`;
});
knobTune.addEventListener('click', () => {
  tuneTurns += 1;
  knobTune.style.transform = `rotate(${tuneTurns * 90}deg)`;
  switchTo((current + 1) % CHANNELS.length);
});

// keyboard: 1..n jumps, arrows step
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const digit = Number.parseInt(e.key, 10);
  if (digit >= 1 && digit <= CHANNELS.length) switchTo(digit - 1);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    switchTo((current + 1) % CHANNELS.length);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    switchTo((current - 1 + CHANNELS.length) % CHANNELS.length);
  }
});

// power on: CRT blip once, tune to CH·01 without autoplay (browser policy + politeness)
screen.classList.add('power-on');
screen.addEventListener('animationend', () => screen.classList.remove('power-on'), { once: true });
switchTo(0, { play: false });
