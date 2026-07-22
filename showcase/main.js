// Luna TV — channel wiring. To add a channel, append one entry here and drop
// the matching video into showcase/videos/ (the filename is the `video` field).
// All strings are bilingual: {zh, en} pairs picked by the current language.
const CHANNELS = [
  {
    id: 'rag',
    no: '01',
    name: 'RAG',
    sub: { zh: '检索召回', en: 'Hybrid recall' },
    icon: '🔎',
    video: 'videos/rag.mp4',
    blurb: {
      zh: 'RAG 频道:混合召回 —— 词法检索 + 向量余弦相似度,按时近度与显著度加权。旧记忆需要时才被想起,不常驻上下文。',
      en: 'RAG channel: hybrid recall — lexical search + vector cosine similarity, blended with recency and salience weights. Old memories are recalled on demand instead of living in the context window.',
    },
  },
  {
    id: 'memory',
    no: '02',
    name: 'Memory',
    sub: { zh: '三层记忆', en: 'Layered memory' },
    icon: '📚',
    video: 'videos/memory.mp4',
    blurb: {
      zh: 'Memory 频道:L1 滚动窗口 / L2 耐久回合 / L3 长期事实与灵魂文件,对话间隙的"梦境整理"把经历固化成记忆。',
      en: 'Memory channel: an L1 rolling window / L2 durable turns / L3 long-lived facts and a soul file — "dream consolidation" between conversations turns experience into memory.',
    },
  },
  {
    id: 'tool',
    no: '03',
    name: 'Tool',
    sub: { zh: '工具调用', en: 'Streaming tools' },
    icon: '🧰',
    video: 'videos/tool.mp4',
    blurb: {
      zh: 'Tool 频道:流式工具调用 —— started / progress / finished 逐事件直播,配合并发策略与能力门控的完整性护栏。',
      en: 'Tool channel: streaming tool calls — started / progress / finished events broadcast live, with concurrency policies and capability gates as integrity rails.',
    },
  },
  {
    id: 'web',
    no: '04',
    name: 'Web',
    sub: { zh: '联网感知', en: 'Web sense' },
    icon: '🌐',
    video: 'videos/web.mp4',
    blurb: {
      zh: 'Web 频道:web_search 搜索与 web_fetch 安全抓取(带缓存),时间与天气作为环境感知融进对话。',
      en: 'Web channel: web_search plus safe, cached web_fetch — and time and weather flow into the conversation as ambient perception.',
    },
  },
];

const I18N = {
  zh: {
    htmlLang: 'zh-CN',
    title: 'Luna TV · 能力展示',
    tagline: '陪伴型 AI 智能体 · 能力展示频道',
    welcome: '欢迎来到 Luna TV,选一个频道看看我会做什么吧 ~',
    sideLabel: 'Channels · 栏目',
    nsTitle: '节目准备中',
    nsHint: (file) => `把 <code>showcase/${file}</code> 放进仓库就会开播`,
    nsHintGeneric: '把演示视频放进 showcase/videos/ 就会开播',
    footNote: '按 1–4 或 ↑↓ 换台 · 视频文件命名见 showcase/videos/README.md',
    volTip: '静音 / 取消静音',
    volAria: '静音开关',
    tuneTip: '下一个频道',
    tuneAria: '切换到下一个频道',
    channelsAria: '频道列表',
    langBtn: 'EN',
    langAria: 'Switch to English',
  },
  en: {
    htmlLang: 'en',
    title: 'Luna TV · Capability Showcase',
    tagline: 'A companion AI agent · her capabilities, on air',
    welcome: 'Welcome to Luna TV — pick a channel and see what I can do ~',
    sideLabel: 'Channels',
    nsTitle: 'Coming soon',
    nsHint: (file) => `Drop <code>showcase/${file}</code> into the repo to go on air`,
    nsHintGeneric: 'Drop demo videos into showcase/videos/ to go on air',
    footNote: 'Press 1–4 or ↑/↓ to change channels · video naming: showcase/videos/README.md',
    volTip: 'Mute / unmute',
    volAria: 'Toggle mute',
    tuneTip: 'Next channel',
    tuneAria: 'Tune to the next channel',
    channelsAria: 'Channel list',
    langBtn: '中文',
    langAria: '切换到中文',
  },
};

// language: ?lang= param > saved choice > browser language
const LANG_KEY = 'lunaTV:lang';
const urlLang = new URLSearchParams(location.search).get('lang');
const savedLang = localStorage.getItem(LANG_KEY);
let lang =
  urlLang === 'en' || urlLang === 'zh'
    ? urlLang
    : savedLang === 'en' || savedLang === 'zh'
      ? savedLang
      : (navigator.language || 'en').toLowerCase().startsWith('zh')
        ? 'zh'
        : 'en';

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
const langBtn = $('#langBtn');

let current = -1;
let switchTimer = 0;
const subEls = [];
const buttons = CHANNELS.map((c, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'channel-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `
    <span class="ch-icon">${c.icon}</span>
    <span class="ch-text">
      <span class="ch-title">${c.name}</span>
      <span class="ch-sub">${c.sub[lang]}</span>
    </span>
    <span class="ch-no">CH·${c.no}</span>`;
  btn.addEventListener('click', () => switchTo(i));
  subEls.push(btn.querySelector('.ch-sub'));
  listEl.append(btn);
  return btn;
});

function popNarration(text) {
  narration.textContent = text;
  narration.classList.remove('pop');
  void narration.offsetWidth;
  narration.classList.add('pop');
}

function showNoSignal(channel) {
  noSignalHint.innerHTML = I18N[lang].nsHint(channel.video);
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
  popNarration(c.blurb[lang]);

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

// repaint every localized string for the current language
function applyLang() {
  const t = I18N[lang];
  document.documentElement.lang = t.htmlLang;
  document.title = t.title;
  $('#tagline').textContent = t.tagline;
  $('#sideLabel').textContent = t.sideLabel;
  $('#nsTitle').textContent = t.nsTitle;
  $('#footNote').textContent = t.footNote;
  listEl.setAttribute('aria-label', t.channelsAria);
  knobVol.title = t.volTip;
  knobVol.setAttribute('aria-label', t.volAria);
  knobTune.title = t.tuneTip;
  knobTune.setAttribute('aria-label', t.tuneAria);
  langBtn.textContent = t.langBtn;
  langBtn.setAttribute('aria-label', t.langAria);
  subEls.forEach((el, i) => (el.textContent = CHANNELS[i].sub[lang]));
  noSignalHint.innerHTML = current >= 0 ? t.nsHint(CHANNELS[current].video) : t.nsHintGeneric;
  popNarration(current >= 0 ? CHANNELS[current].blurb[lang] : t.welcome);
}

langBtn.addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  localStorage.setItem(LANG_KEY, lang);
  // a manual toggle outranks a shared ?lang= link — drop the param so reloads keep the choice
  if (urlLang) {
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    history.replaceState(null, '', url);
  }
  applyLang();
});

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

// power on: localize the chrome, CRT blip once, tune to CH·01 without autoplay
applyLang();
screen.classList.add('power-on');
screen.addEventListener('animationend', () => screen.classList.remove('power-on'), { once: true });
switchTo(0, { play: false });
