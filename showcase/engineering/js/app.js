/* ═══════════════════════════════════════════════════════════════
   两张图 + 一叠幻灯片。

   图一 · 结构：根是一对 —— LLM（点不开的黑盒）与 Agent system；
              六支从 Agent system 向下扇开，叶子全展开，不折叠。
   图二 · 时序：一条消息的一生，五条泳道（用户 / harness / LLM /
              工具 / 存储），两条回边让它在中间打转。
   L3   · 详页：翻页式，每页落笔一次。

   落笔顺序（这页最要紧的细节）：先干后枝，先枝后叶。
   ═══════════════════════════════════════════════════════════════ */

(function () {
  const M = window.LUNA_MAP;

  /* ── 中英切换 ─────────────────────────────────────────
     所有可显示的串都可以写成 {zh, en}；写成纯字符串的照旧，
     这样双语可以逐块迁移，不用一次改完。 */
  const LANGS = ['zh', 'en'];
  let LANG = (() => {
    try { const v = localStorage.getItem('luna:lang'); if (LANGS.includes(v)) return v; } catch {}
    return (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  })();
  const t = (v) => (v == null ? '' : typeof v === 'string' ? v : v[LANG] ?? v.zh ?? v.en ?? '');
  const S = window.Sketch;
  const NS = 'http://www.w3.org/2000/svg';

  function mkSvg(host, w, h) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'wires');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    host.appendChild(svg);
    return svg;
  }
  function wire(svg, d, cls, delay) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls || '');
    svg.appendChild(p);
    const len = p.getTotalLength ? p.getTotalLength() : 400;
    p.style.setProperty('--len', len);
    p.style.setProperty('--d', (delay || 0) + 's');
    return p;
  }
  function el(host, tag, cls, style, html, delay) {
    const n = document.createElement(tag);
    n.className = cls;
    Object.assign(n.style, style);
    if (html !== undefined) n.innerHTML = html;
    if (delay !== undefined) n.style.setProperty('--d', delay + 's');
    host.appendChild(n);
    return n;
  }
  function hatch(svg, defs, id, x, y, w, h, seed, d0) {
    defs.insertAdjacentHTML(
      'beforeend',
      `<clipPath id="${id}"><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}"/></clipPath>`,
    );
    for (let k = 0; k < 8; k++) {
      const off = -h + (k * (w + h)) / 7;
      wire(svg, S.line(x + off, y + h, x + off + h, y, seed + k * 3, 0.9), 'hatch', d0 + k * 0.02)
        .setAttribute('clip-path', `url(#${id})`);
    }
  }

  /* ══ 机制小图：和主图共用原语，所以手感与落笔动画一致 ═══ */
  function drawFigure(host, fig) {
    /* 内层按图的原始尺寸摆放，外层整体 scale —— SVG 与 HTML 必须一起缩，
       否则线在缩、字不缩，就会错位（第一版就是这么坏的）。 */
    const inner = document.createElement('div');
    inner.className = 'mf-inner';
    inner.style.width = fig.w + 'px';
    inner.style.height = fig.h + 'px';
    host.appendChild(inner);

    const svg = mkSvg(inner, fig.w, fig.h);
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    let seed = 91;
    const s = () => (seed += 23);

    (fig.boxes || []).forEach((b, i) => {
      const d0 = 0.05 + i * 0.06;
      wire(svg, S.box(b.x, b.y, b.w, b.h, s(), b.kind === 'blackbox' ? 1.8 : 1.4),
        'box ' + (b.kind ? 'box-' + b.kind : ''), d0);
      if (b.kind === 'blackbox') {
        hatch(svg, defs, 'mf' + i + '-' + Math.random().toString(36).slice(2, 6), b.x, b.y, b.w, b.h, s(), d0 + 0.04);
      }
      el(inner, 'div', 'mf-box', { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' },
        `<span class="mf-title">${t(b.title)}</span>` + (b.sub ? `<span class="mf-sub">${t(b.sub)}</span>` : ''), d0 + 0.1);
    });

    /* 边一多（主张图里成排的 tick），固定 0.06 的间隔会让最后一笔等到两秒后。
       ≤20 条边时结果与原来逐字相同，只有超过才压缩。 */
    const eStep = Math.min(0.06, 1.2 / Math.max(1, (fig.edges || []).length));
    (fig.edges || []).forEach((e, i) => {
      const d0 = 0.3 + i * eStep;
      const p = e.pts;
      const d = p.length > 2 ? S.elbow(p.map((q) => q.slice()), s(), 1.2) : S.line(p[0][0], p[0][1], p[1][0], p[1][1], s(), 1.2);
      wire(svg, d, 'edge ' + (e.style || ''), d0);
      if (e.head !== false) {
        const n = p.length;
        wire(svg, S.arrowAt(p[n - 2][0], p[n - 2][1], p[n - 1][0], p[n - 1][1], 7), 'edge head ' + (e.style || ''), d0 + 0.16);
      }
      if (e.label) el(inner, 'div', 'mf-elabel', { left: e.at[0] + 'px', top: e.at[1] + 'px' }, t(e.label), d0 + 0.2);
    });

    (fig.labels || []).forEach((l, i) => {
      el(inner, 'div', 'mf-label tone-' + (l.tone || 'edge'),
        { left: l.x + 'px', top: l.y + 'px', maxWidth: (l.w || 200) + 'px' }, t(l.text), 0.5 + i * 0.05);
    });

    const fitFig = () => {
      const sc = Math.min(1, (host.clientWidth || fig.w) / fig.w);
      inner.style.transform = `scale(${sc})`;
      host.style.height = fig.h * sc + 'px';
    };
    fitFig();
    window.addEventListener('resize', fitFig);
    host.__fit = fitFig;

    void host.offsetWidth;
    host.classList.add('drawing');
  }

  /* ══ 图一 · 结构树 ══════════════════════════════════════ */
  function buildTree(stage) {
    const W = 1760, CX = 880;
    const COLS = [150, 420, 690, 960, 1230, 1500];
    const HEAD_Y = 500, LEAF_Y = 556, LEAF_STEP = 34;
    const maxLeaves = Math.max(...M.branches.map((b) => b.leaves.length));
    const H = LEAF_Y + maxLeaves * LEAF_STEP + 60;

    stage.style.width = W + 'px';
    stage.style.height = H + 'px';
    stage.dataset.w = W;
    stage.dataset.h = H;
    const svg = mkSvg(stage, W, H);
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    let seed = 3;
    const s = () => (seed += 17);
    const R = M.root;

    /* LLM：方盒 + 斜线，点不开 */
    const LW = 224, LH = 86, LY = 56;
    const AW = 268, AH = 96, AY = 298;
    wire(svg, S.box(CX - LW / 2, LY, LW, LH, s(), 2.2), 'box box-blackbox', 0.05);
    hatch(svg, defs, 'llmclip', CX - LW / 2, LY, LW, LH, s(), 0.12);
    el(stage, 'div', 'rootbox opaque', { left: CX - LW / 2 + 'px', top: LY + 'px', width: LW + 'px', height: LH + 'px' },
      `<span class="rb-name">${t(R.llm.label)}</span><span class="rb-sub">${t(R.llm.sub)}</span>`, 0.2);

    /* Agent system：被分解的那个 */
    wire(svg, S.box(CX - AW / 2, AY, AW, AH, s(), 2), 'box box-agent', 0.3);
    el(stage, 'div', 'rootbox', { left: CX - AW / 2 + 'px', top: AY + 'px', width: AW + 'px', height: AH + 'px' },
      `<span class="rb-name agent">${t(R.agent.label)}</span><span class="rb-sub">${t(R.agent.sub)}</span>`, 0.42);

    /* IN / OUT：直角回路，它们之间仅有的两条边 */
    const IL = CX - AW / 2 - 96, IR = CX + AW / 2 + 96;
    wire(svg, S.elbow([[CX - AW / 2, AY + AH / 2], [IL, AY + AH / 2], [IL, LY + LH / 2], [CX - LW / 2 - 8, LY + LH / 2]], s(), 1.6), 'edge thick', 0.5);
    wire(svg, S.arrowAt(CX - LW / 2 - 40, LY + LH / 2, CX - LW / 2 - 6, LY + LH / 2, 9), 'edge thick head', 0.74);
    el(stage, 'div', 'io-pill', { left: IL - 208 + 'px', top: 196 + 'px' },
      `<span class="io-k">${t(R.inLabel)}</span><span class="io-v">${t(R.inSub)}</span>`, 0.62);

    wire(svg, S.elbow([[CX + LW / 2, LY + LH / 2], [IR, LY + LH / 2], [IR, AY + AH / 2], [CX + AW / 2 + 8, AY + AH / 2]], s(), 1.6), 'edge thick', 0.56);
    wire(svg, S.arrowAt(CX + AW / 2 + 40, AY + AH / 2, CX + AW / 2 + 6, AY + AH / 2, 9), 'edge thick head', 0.8);
    el(stage, 'div', 'io-pill right', { left: IR + 18 + 'px', top: 196 + 'px' },
      `<span class="io-k">${t(R.outLabel)}</span><span class="io-v">${t(R.outSub)}</span>`, 0.68);

    el(stage, 'div', 'aside-note', { left: '40px', top: '54px', maxWidth: '260px' }, t(R.aside), 0.9);

    /* 六支向下扇开，叶子全展开 */
    M.branches.forEach((b, i) => {
      const x = COLS[i];
      const d0 = 0.85 + i * 0.08;
      wire(svg, S.elbow([[CX, 394], [CX, 452], [x + 60, 452], [x + 60, HEAD_Y - 34]], s(), 1.6), 'stem', d0);

      el(stage, 'div', 'branch' + (b.star ? ' star' : ''), { left: x + 'px', top: HEAD_Y - 26 + 'px' },
        `<span class="br-name">${t(b.name)}${b.star ? ' <i class="star">★</i>' : ''}</span>` +
          `<span class="br-en">${b.en}</span><span class="br-dim">${b.dim}</span>`, d0 + 0.1);

      const railX = x + 8;
      const last = LEAF_Y + (b.leaves.length - 1) * LEAF_STEP;
      wire(svg, S.line(railX, LEAF_Y - 22, railX, last + 4, s(), 1.2), 'stem', d0 + 0.16);
      b.leaves.forEach((lf, j) => {
        const y = LEAF_Y + j * LEAF_STEP;
        wire(svg, S.line(railX, y, railX + 12, y, s(), 0.8), 'tick', d0 + 0.2 + j * 0.04);
        const leaf = el(stage, 'button', 'leaf openable', { left: railX + 18 + 'px', top: y - 12 + 'px' },
          `<span class="lf-name">${t(lf.label)}</span>`, d0 + 0.22 + j * 0.04);
        leaf.type = 'button';
        leaf.addEventListener('click', () => openDeck(lf.id, t(lf.label), t(b.name) + ' · ' + b.dim, leaf));
      });
    });
  }

  /* ══ 图二 · 时序泳道 ════════════════════════════════════ */
  function buildFlow(stage) {
    const F = M.flow;
    stage.style.width = F.w + 'px';
    stage.style.height = F.h + 'px';
    stage.dataset.w = F.w;
    stage.dataset.h = F.h;
    const svg = mkSvg(stage, F.w, F.h);
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    let seed = 41;
    const s = () => (seed += 19);

    F.lanes.forEach((ln, i) => {
      wire(svg, S.line(F.laneX0, ln.y, F.w - 50, ln.y, s(), 1), 'lane-line', 0.08 + i * 0.05);
      const lab = el(stage, ln.id ? 'button' : 'div', 'lane-label' + (ln.id ? ' openable' : ''),
        { left: '30px', top: ln.y - 22 + 'px' },
        `<span class="ln-name">${t(ln.name)}</span><span class="ln-sub">${t(ln.sub)}</span>`, 0.1 + i * 0.05);
      if (ln.id) {
        lab.type = 'button';
        lab.addEventListener('click', () => openDeck(ln.id, t(ln.name), t(ln.deck), lab));
      }
    });

    F.steps.forEach((st, i) => {
      const d0 = 0.4 + i * 0.05;
      if (st.opaque) {
        const w = 78, h = 30;
        wire(svg, S.box(st.x - w / 2, st.y - h / 2, w, h, s(), 1.6), 'box box-blackbox', d0);
        hatch(svg, defs, 'fl' + i, st.x - w / 2, st.y - h / 2, w, h, s(), d0 + 0.04);
      } else {
        wire(svg, S.line(st.x, st.y - 7, st.x, st.y + 7, s(), 0.8), 'tick', d0);
      }
      const node = el(stage, st.opaque ? 'div' : 'button',
        'step' + (st.opaque ? ' opaque' : ' openable'), { left: st.x + 'px', top: st.y - 46 + 'px' },
        `<span class="sp-name">${t(st.label)}</span>` + (st.meta ? `<span class="sp-meta">${t(st.meta)}</span>` : ''), d0 + 0.05);
      if (!st.opaque) {
        node.type = 'button';
        node.addEventListener('click', () => openDeck(st.id, t(st.label), t(st.meta), node));
      }
    });

    F.arrows.forEach((a, i) => {
      const d0 = 0.9 + i * 0.05;
      const p = a.pts;
      wire(svg, S.line(p[0][0], p[0][1], p[1][0], p[1][1], s(), 1.4), 'edge' + (a.style === 'dashed' ? ' dashed' : ''), d0);
      wire(svg, S.arrowAt(p[0][0], p[0][1], p[1][0], p[1][1], 9), 'edge head', d0 + 0.18);
      if (a.label) el(stage, 'div', 'arrow-label', { left: a.at[0] + 'px', top: a.at[1] + 'px' }, t(a.label), d0 + 0.2);
    });

    F.loops.forEach((lp, i) => {
      wire(svg, S.elbow(lp.pts.map((p) => p.slice()), s(), 1.6),
        'edge loop-inner' + (lp.style === 'dashed' ? ' dashed' : ''), 1.5 + i * 0.12);
      const q = lp.pts, n = q.length;
      wire(svg, S.arrowAt(q[n - 2][0], q[n - 2][1], q[n - 1][0], q[n - 1][1], 9), 'edge head loop-inner', 1.7 + i * 0.12);
      el(stage, 'div', 'arrow-label loop', { left: lp.at[0] + 'px', top: lp.at[1] + 'px' }, t(lp.label), 1.7 + i * 0.12);
    });

    el(stage, 'div', 'aside-note', { left: F.note.x + 'px', top: F.note.y + 'px', maxWidth: '640px' }, t(F.note.text), 1.9);
  }

  /* ══ 扉页 ═══════════════════════════════════════════════ */
  function paintPrologue() {
    const p = M.prologue;
    document.getElementById('proEyebrow').textContent = t(p.eyebrow);
    document.getElementById('proH').innerHTML = t(p.heading);
    document.getElementById('proSub').textContent = t(p.sub);
    document.getElementById('proBody').innerHTML =
      `<p><span class="ph">${t(p.lead)}</span></p><div class="pro-cols">` +
      p.cards.map((c) => `<div class="pro-card"><h4>${t(c.title)}</h4><p>${t(c.body)}</p></div>`).join('') +
      `</div><p>${t(p.tail)}</p>`;
    document.getElementById('footnote').textContent = t(M.footnote);
  }
  paintPrologue();

  /* ══ L3 · 翻页式幻灯 ════════════════════════════════════ */
  const deck = document.getElementById('deck');
  const scrim = document.getElementById('scrim');
  const deckBody = document.getElementById('deckBody');
  const pager = document.getElementById('pager');
  let page = 0;
  let activeNode = null;

  const PAGE_ORDER = [
    { key: 'claim', title: { zh: '主张', en: 'Claim' } },
    { key: 'mechanism', title: { zh: '机制', en: 'Mechanism' } },
    { key: 'contract', title: { zh: '契约', en: 'Contract' } },
    { key: 'code', title: { zh: '代码', en: 'Code' } },
    { key: 'decision', title: { zh: '决策', en: 'Decision' } },
  ];
  const KV = {
    exposes: { zh: '暴露', en: 'Exposes' },
    depends: { zh: '依赖', en: 'Depends' },
    boundary: { zh: '边界', en: 'Boundary' },
    invariant: { zh: '不变量', en: 'Invariant' },
  };
  const DKV = {
    why: { zh: '为什么', en: 'Why' },
    rejected: { zh: '被拒绝的方案', en: 'Rejected' },
    cost: { zh: '代价', en: 'Cost' },
  };

  function renderPage(key, v) {
    if (key === 'contract') {
      return Object.keys(KV).filter((k) => v[k]).map((k) =>
        `<p class="kv"><span>${t(KV[k])}</span>${t(v[k])}</p>`).join('');
    }
    if (key === 'decision') {
      return '<ul>' + Object.keys(DKV).filter((k) => v[k]).map((k) =>
        `<li><b>${t(DKV[k])}</b>　${t(v[k])}</li>`).join('') + '</ul>';
    }
    if (key === 'code') {
      const loc = v.file + (v.lines ? ':' + v.lines : '');
      return `<p class="code-loc">${loc}</p><pre class="code">${escapeHtml(v.snippet)}</pre>` +
        (v.note ? `<p>${t(v.note)}</p>` : '');
    }
    return `<p>${t(v)}</p>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  }

  let deckId = null;
  function openDeck(id, title, meta, node) {
    deckId = id;
    const d = (M.decks || {})[id];
    const pages = PAGE_ORDER.filter((p) => d && d[p.key]);
    document.getElementById('deckEyebrow').textContent = LANG === 'zh' ? '构件详页' : 'Component';
    document.getElementById('deckTitle').textContent = title;
    document.getElementById('deckMeta').textContent = meta || '';

    if (pages.length === 0) {
      deckBody.innerHTML = `<section class="slide on"><p class="todo">${
        LANG === 'zh' ? '〔这一件的内容还没写〕' : '[not written yet]'
      }</p></section>`;
      pager.innerHTML = '';
    } else {
      deckBody.innerHTML = pages
        .map((p, n) => {
          /* 机制图在正文之前（先看形状再读解释）；主张图在正文之后
             ——那句话是结论，图是紧跟着的举证。 */
          const mech = p.key === 'mechanism' && d.figure ? '<div class="mf-stage" data-fig="mech"></div>' : '';
          const claimFig =
            p.key === 'claim' && d.claimFigure ? '<div class="mf-stage cf-stage" data-fig="claim"></div>' : '';
          return `<section class="slide"><h3><i>0${n + 1}</i>${t(p.title)}</h3>${mech}${renderPage(p.key, d[p.key])}${claimFig}</section>`;
        })
        .join('');
      deckBody.querySelectorAll('[data-fig]').forEach((h) => {
        h.__fig = h.dataset.fig === 'claim' ? d.claimFigure : d.figure; // 翻到时才画
      });
      pager.innerHTML = pages
        .map((p, n) => `<button class="pdot" type="button" data-p="${n}" title="${t(p.title)}">0${n + 1}</button>`)
        .join('');
      pager.querySelectorAll('.pdot').forEach((b) => b.addEventListener('click', () => go(+b.dataset.p)));
    }
    page = 0;
    show(0);
    if (activeNode) activeNode.removeAttribute('aria-current');
    activeNode = node;
    node.setAttribute('aria-current', 'true');
    deck.hidden = false;
    scrim.hidden = false;
    deck.classList.add('enter');
    /* rAF 在后台标签页里不保证触发——只靠它的话，切走再切回来会看到一个
       opacity:0 的空面板。补一个定时器兜底，两条路径都只是移除同一个类。 */
    requestAnimationFrame(() => requestAnimationFrame(() => deck.classList.remove('enter')));
    setTimeout(() => deck.classList.remove('enter'), 120);
    fitAll();
    document.getElementById('deckClose').focus();
  }

  function show(n, dir) {
    const slides = deckBody.querySelectorAll('.slide');
    slides.forEach((sl, i) => {
      sl.classList.toggle('on', i === n);
      if (i === n) {
        const host = sl.querySelector('[data-fig]');
        if (host && host.__fig && !host.__drawn) {
          host.__drawn = true;
          drawFigure(host, host.__fig);
        }
      }
      if (i === n) {
        sl.classList.remove('from-left', 'from-right');
        void sl.offsetWidth;
        sl.classList.add(dir === 'prev' ? 'from-left' : 'from-right');
      }
    });
    pager.querySelectorAll('.pdot').forEach((d, i) => d.setAttribute('aria-current', String(i === n)));
    document.getElementById('prev').disabled = n === 0;
    document.getElementById('next').disabled = n === slides.length - 1;
  }
  function go(n) {
    const total = deckBody.querySelectorAll('.slide').length;
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === page) return;
    const dir = next < page ? 'prev' : 'next';
    page = next;
    show(page, dir);
  }
  function closeDeck() {
    deck.hidden = true;
    scrim.hidden = true;
    if (activeNode) {
      activeNode.removeAttribute('aria-current');
      activeNode.focus();
      activeNode = null;
    }
    fitAll();
  }
  document.getElementById('prev').addEventListener('click', () => go(page - 1));
  document.getElementById('next').addEventListener('click', () => go(page + 1));
  document.getElementById('deckClose').addEventListener('click', closeDeck);
  scrim.addEventListener('click', closeDeck);
  document.addEventListener('keydown', (e) => {
    if (deck.hidden) return;
    if (e.key === 'Escape') closeDeck();
    if (e.key === 'ArrowLeft') go(page - 1);
    if (e.key === 'ArrowRight') go(page + 1);
  });

  /* ══ 装配两张图 ═════════════════════════════════════════ */
  const stages = [];
  const treeStage = document.getElementById('treeStage');
  const flowStage = document.getElementById('flowStage');
  buildTree(treeStage);
  buildFlow(flowStage);
  stages.push(treeStage, flowStage);

  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('drawing'); io.unobserve(e.target); } }),
    { threshold: 0.12 },
  );
  stages.forEach((s) => io.observe(s));

  const langBtn = document.getElementById('langBtn');
  function paintLang() {
    langBtn.textContent = LANG === 'zh' ? 'EN' : '中文';
    langBtn.setAttribute('aria-label', LANG === 'zh' ? 'Switch to English' : '切换到中文');
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      const k = n.dataset.i18n;
      n.textContent = (M.ui[k] || {})[LANG] || '';
    });
  }
  langBtn.addEventListener('click', () => {
    LANG = LANG === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem('luna:lang', LANG); } catch {}
    paintLang();
    paintPrologue();
    treeStage.textContent = '';
    flowStage.textContent = '';
    buildTree(treeStage);
    buildFlow(flowStage);
    treeStage.classList.add('drawing');
    flowStage.classList.add('drawing');
    if (!deck.hidden) closeDeck();
    fitAll();
  });

  /* ── 顶栏跳转：自己驱动的平滑滚动 ─────────────────────
     停在顶栏下方而不是被它盖住；距离越远走得越久（有上限）；
     系统开了「减少动态效果」就直接落位。 */
  (function smoothJump() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    document.querySelectorAll('.jump a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        const bar = document.querySelector('.topbar');
        const pad = (bar ? bar.getBoundingClientRect().height : 0) + 14;
        const se = document.scrollingElement || document.documentElement;
        const from = se.scrollTop;
        const to = Math.max(0, Math.min(
          se.scrollHeight - se.clientHeight,
          from + target.getBoundingClientRect().top - pad,
        ));
        const done = () => history.replaceState(null, '', a.getAttribute('href'));
        if (reduce.matches || Math.abs(to - from) < 2) {
          window.scrollTo({ top: to, behavior: 'instant' });
          done();
          return;
        }
        const dur = Math.min(900, Math.max(380, Math.abs(to - from) * 0.6));
        const t0 = performance.now();
        let finished = false;
        const land = () => {
          if (finished) return;
          finished = true;
          window.scrollTo({ top: to, behavior: 'instant' });
          done();
        };
        const step = (now) => {
          if (finished) return;
          const p = Math.min(1, (now - t0) / dur);
          window.scrollTo({ top: from + (to - from) * ease(p), behavior: 'instant' });
          if (p < 1) requestAnimationFrame(step);
          else land();
        };
        requestAnimationFrame(step);
        /* 兜底：有些环境（后台标签、被节流的嵌入窗格）根本不跑动画帧，
           那样 step 一次都不会被调用，点了等于没反应。到点还没走完就直接落位。 */
        setTimeout(land, dur + 220);
      });
    });
  })();

  const pro = document.getElementById('prologue');
  document.getElementById('flip').addEventListener('click', () => {
    pro.hidden = true;
    treeStage.classList.add('drawing');
    fitAll();
  });
  document.getElementById('proBtn').addEventListener('click', () => { pro.hidden = false; });

  function fitAll() {
    const deckW = deck.hidden ? 0 : Math.min(560, window.innerWidth * 0.94) + 26;
    stages.forEach((stage) => {
      const wrap = stage.parentElement;
      const w = +stage.dataset.w, h = +stage.dataset.h;
      const avail = Math.max(320, wrap.clientWidth - 8 - deckW);
      const sc = Math.min(1, Math.max(0.5, avail / w));
      stage.style.transform = `scale(${sc})`;
      wrap.style.height = h * sc + 8 + 'px';
    });
  }
  window.addEventListener('resize', fitAll);
  paintLang();
  fitAll();
})();
