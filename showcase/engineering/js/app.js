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
      `<span class="rb-name">${R.llm.label}</span><span class="rb-sub">${R.llm.sub}</span>`, 0.2);

    /* Agent system：被分解的那个 */
    wire(svg, S.box(CX - AW / 2, AY, AW, AH, s(), 2), 'box box-agent', 0.3);
    el(stage, 'div', 'rootbox', { left: CX - AW / 2 + 'px', top: AY + 'px', width: AW + 'px', height: AH + 'px' },
      `<span class="rb-name agent">${R.agent.label}</span><span class="rb-sub">${R.agent.sub}</span>`, 0.42);

    /* IN / OUT：直角回路，它们之间仅有的两条边 */
    const IL = CX - AW / 2 - 96, IR = CX + AW / 2 + 96;
    wire(svg, S.elbow([[CX - AW / 2, AY + AH / 2], [IL, AY + AH / 2], [IL, LY + LH / 2], [CX - LW / 2 - 8, LY + LH / 2]], s(), 1.6), 'edge thick', 0.5);
    wire(svg, S.arrowAt(CX - LW / 2 - 40, LY + LH / 2, CX - LW / 2 - 6, LY + LH / 2, 9), 'edge thick head', 0.74);
    el(stage, 'div', 'io-pill', { left: IL - 208 + 'px', top: 196 + 'px' },
      `<span class="io-k">${R.inLabel}</span><span class="io-v">${R.inSub}</span>`, 0.62);

    wire(svg, S.elbow([[CX + LW / 2, LY + LH / 2], [IR, LY + LH / 2], [IR, AY + AH / 2], [CX + AW / 2 + 8, AY + AH / 2]], s(), 1.6), 'edge thick', 0.56);
    wire(svg, S.arrowAt(CX + AW / 2 + 40, AY + AH / 2, CX + AW / 2 + 6, AY + AH / 2, 9), 'edge thick head', 0.8);
    el(stage, 'div', 'io-pill right', { left: IR + 18 + 'px', top: 196 + 'px' },
      `<span class="io-k">${R.outLabel}</span><span class="io-v">${R.outSub}</span>`, 0.68);

    el(stage, 'div', 'aside-note', { left: '40px', top: '54px', maxWidth: '260px' }, R.aside, 0.9);

    /* 六支向下扇开，叶子全展开 */
    M.branches.forEach((b, i) => {
      const x = COLS[i];
      const d0 = 0.85 + i * 0.08;
      wire(svg, S.elbow([[CX, 394], [CX, 452], [x + 60, 452], [x + 60, HEAD_Y - 34]], s(), 1.6), 'stem', d0);

      el(stage, 'div', 'branch' + (b.star ? ' star' : ''), { left: x + 'px', top: HEAD_Y - 26 + 'px' },
        `<span class="br-name">${b.name}${b.star ? ' <i class="star">★</i>' : ''}</span>` +
          `<span class="br-en">${b.en}</span><span class="br-dim">${b.dim}</span>`, d0 + 0.1);

      const railX = x + 8;
      const last = LEAF_Y + (b.leaves.length - 1) * LEAF_STEP;
      wire(svg, S.line(railX, LEAF_Y - 22, railX, last + 4, s(), 1.2), 'stem', d0 + 0.16);
      b.leaves.forEach((lf, j) => {
        const y = LEAF_Y + j * LEAF_STEP;
        wire(svg, S.line(railX, y, railX + 12, y, s(), 0.8), 'tick', d0 + 0.2 + j * 0.04);
        const leaf = el(stage, 'button', 'leaf openable', { left: railX + 18 + 'px', top: y - 12 + 'px' },
          `<span class="lf-name">${lf.label}</span>`, d0 + 0.22 + j * 0.04);
        leaf.type = 'button';
        leaf.addEventListener('click', () => openDeck(lf.label, b.name + ' · ' + b.dim, leaf));
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
        `<span class="ln-name">${ln.name}</span><span class="ln-sub">${ln.sub}</span>`, 0.1 + i * 0.05);
      if (ln.id) {
        lab.type = 'button';
        lab.addEventListener('click', () => openDeck(ln.name, ln.deck || '', lab));
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
        `<span class="sp-name">${st.label}</span>` + (st.meta ? `<span class="sp-meta">${st.meta}</span>` : ''), d0 + 0.05);
      if (!st.opaque) {
        node.type = 'button';
        node.addEventListener('click', () => openDeck(st.label, '时序 · ' + (st.meta || ''), node));
      }
    });

    F.arrows.forEach((a, i) => {
      const d0 = 0.9 + i * 0.05;
      const p = a.pts;
      wire(svg, S.line(p[0][0], p[0][1], p[1][0], p[1][1], s(), 1.4), 'edge' + (a.style === 'dashed' ? ' dashed' : ''), d0);
      wire(svg, S.arrowAt(p[0][0], p[0][1], p[1][0], p[1][1], 9), 'edge head', d0 + 0.18);
      if (a.label) el(stage, 'div', 'arrow-label', { left: a.at[0] + 'px', top: a.at[1] + 'px' }, a.label, d0 + 0.2);
    });

    F.loops.forEach((lp, i) => {
      wire(svg, S.elbow(lp.pts.map((p) => p.slice()), s(), 1.6),
        'edge loop-inner' + (lp.style === 'dashed' ? ' dashed' : ''), 1.5 + i * 0.12);
      const q = lp.pts, n = q.length;
      wire(svg, S.arrowAt(q[n - 2][0], q[n - 2][1], q[n - 1][0], q[n - 1][1], 9), 'edge head loop-inner', 1.7 + i * 0.12);
      el(stage, 'div', 'arrow-label loop', { left: lp.at[0] + 'px', top: lp.at[1] + 'px' }, lp.label, 1.7 + i * 0.12);
    });

    el(stage, 'div', 'aside-note', { left: F.note.x + 'px', top: F.note.y + 'px', maxWidth: '640px' }, F.note.text, 1.9);
  }

  /* ══ 扉页 ═══════════════════════════════════════════════ */
  (function prologue() {
    const p = M.prologue;
    document.getElementById('proEyebrow').textContent = p.eyebrow;
    document.getElementById('proH').innerHTML = p.heading;
    document.getElementById('proSub').textContent = p.sub;
    document.getElementById('proBody').innerHTML =
      `<p><span class="ph">${p.lead}</span></p><div class="pro-cols">` +
      p.cards.map((c) => `<div class="pro-card"><h4>${c.title}</h4><p>${c.body}</p></div>`).join('') +
      `</div><p>${p.tail}</p>`;
    document.getElementById('footnote').textContent = M.footnote;
  })();

  /* ══ L3 · 翻页式幻灯 ════════════════════════════════════ */
  const deck = document.getElementById('deck');
  const scrim = document.getElementById('scrim');
  const deckBody = document.getElementById('deckBody');
  const pager = document.getElementById('pager');
  let page = 0;
  let activeNode = null;

  function openDeck(title, meta, node) {
    document.getElementById('deckEyebrow').textContent = '构件详页';
    document.getElementById('deckTitle').textContent = title;
    document.getElementById('deckMeta').textContent = meta || '';
    deckBody.innerHTML = M.deckPages
      .map((p, n) => `<section class="slide"><h3><i>0${n + 1}</i>${p.title}</h3>${p.html}</section>`)
      .join('');
    pager.innerHTML = M.deckPages
      .map((p, n) => `<button class="pdot" type="button" data-p="${n}" title="${p.title}">0${n + 1}</button>`)
      .join('');
    pager.querySelectorAll('.pdot').forEach((d) => d.addEventListener('click', () => go(+d.dataset.p)));
    page = 0;
    show(0);
    if (activeNode) activeNode.removeAttribute('aria-current');
    activeNode = node;
    node.setAttribute('aria-current', 'true');
    deck.hidden = false;
    scrim.hidden = false;
    deck.classList.add('enter');
    requestAnimationFrame(() => requestAnimationFrame(() => deck.classList.remove('enter')));
    fitAll();
    document.getElementById('deckClose').focus();
  }
  function show(n, dir) {
    const slides = deckBody.querySelectorAll('.slide');
    slides.forEach((sl, i) => {
      sl.classList.toggle('on', i === n);
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
    const next = Math.max(0, Math.min(M.deckPages.length - 1, n));
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
  fitAll();
})();
