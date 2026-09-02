/* ═══════════════════════════════════════════════════════════════
   手绘几何 —— 抖动的线、抖动的框、带弯的连线。

   全部走**种子化**伪随机：同一个 seed 永远画出同一条线，所以这张
   图每次打开都一模一样。这是刻意的——一张每次刷新都在变形的图，
   看起来像"我会用某个图库"，而不是"我设计了一张图"。
   ═══════════════════════════════════════════════════════════════ */

window.Sketch = (function () {
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** 两点之间的一条手抖直线。amp = 偏离直线的最大像素。 */
  function line(x1, y1, x2, y2, seed, amp = 1.6, segs = 0) {
    const r = rng(seed);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const n = segs || Math.max(2, Math.round(len / 58));
    const nx = -dy / len;
    const ny = dx / len;
    let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const o = i === n ? 0 : (r() - 0.5) * 2 * amp;
      const px = x1 + dx * t + nx * o;
      const py = y1 + dy * t + ny * o;
      const pt = (i - 0.5) / n;
      const po = (r() - 0.5) * 2 * amp;
      const cx = x1 + dx * pt + nx * po;
      const cy = y1 + dy * pt + ny * po;
      d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    return d;
  }

  /** 四条手抖直线围成的框（不是 rect —— rect 太直，不像手画的）。 */
  function box(x, y, w, h, seed, amp = 1.5) {
    const seg = (ax, ay, bx, by, s) => line(ax, ay, bx, by, s, amp).replace(/^M[^Q]*/, ` L ${ax} ${ay}`);
    return (
      line(x, y, x + w, y, seed, amp) +
      seg(x + w, y, x + w, y + h, seed + 7) +
      seg(x + w, y + h, x, y + h, seed + 13) +
      seg(x, y + h, x, y, seed + 21) +
      ' Z'
    );
  }

  /** 带弯的连线，bend 是弯出去的像素（正数向右/上）。 */
  function curve(x1, y1, x2, y2, bend, seed) {
    const r = rng(seed);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const cx = mx + bend + (r() - 0.5) * 4;
    const cy = my - bend * 0.45 + (r() - 0.5) * 4;
    return `M ${x1} ${y1} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
  }

  /** 直角折线（用于回流环：下 → 横 → 上），转角处带圆角。 */
  function elbow(pts, seed, amp = 1.4, radius = 22) {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      const nxt = pts[i + 1];
      if (!nxt) {
        d += line(px, py, cx, cy, seed + i * 5, amp).replace(/^M[^Q]*/, '');
        break;
      }
      // 提前 radius 停下，用一段二次曲线拐过去
      const inDir = [Math.sign(cx - px), Math.sign(cy - py)];
      const outDir = [Math.sign(nxt[0] - cx), Math.sign(nxt[1] - cy)];
      const ax = cx - inDir[0] * radius;
      const ay = cy - inDir[1] * radius;
      const bx = cx + outDir[0] * radius;
      const by = cy + outDir[1] * radius;
      d += line(px, py, ax, ay, seed + i * 5, amp).replace(/^M[^Q]*/, '');
      d += ` Q ${cx} ${cy} ${bx} ${by}`;
      pts[i] = [bx, by];
    }
    return d;
  }

  /** 一个小箭头（两笔），指向 dir: 'up' | 'right' | 'left' | 'down'。 */
  function arrowHead(x, y, dir, size = 9) {
    const m = {
      up: [[-size, size], [size, size]],
      down: [[-size, -size], [size, -size]],
      right: [[-size, -size], [-size, size]],
      left: [[size, -size], [size, size]],
    }[dir];
    return `M ${x + m[0][0]} ${y + m[0][1]} L ${x} ${y} L ${x + m[1][0]} ${y + m[1][1]}`;
  }

  /** 手抖椭圆（根节点用）——采样成闭合路径，同样种子化。 */
  function ellipse(cx, cy, rx, ry, seed, amp = 2) {
    const r = rng(seed);
    const n = 26;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const k = 1 + (r() - 0.5) * 2 * (amp / 100);
      pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
    }
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const a = pts[i % n];
      const b = pts[(i + 1) % n];
      d += ` Q ${a[0].toFixed(1)} ${a[1].toFixed(1)} ${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
    }
    return d + ' Z';
  }

  /** 顺着线的真实角度画箭头——四方向版本给斜线配的头是歪的。 */
  function arrowAt(x1, y1, x2, y2, size = 9) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const s1 = a + Math.PI - 0.4;
    const s2 = a + Math.PI + 0.4;
    return (
      `M ${(x2 + Math.cos(s1) * size).toFixed(1)} ${(y2 + Math.sin(s1) * size).toFixed(1)}` +
      ` L ${x2.toFixed(1)} ${y2.toFixed(1)}` +
      ` L ${(x2 + Math.cos(s2) * size).toFixed(1)} ${(y2 + Math.sin(s2) * size).toFixed(1)}`
    );
  }

  return { rng, line, box, curve, elbow, arrowHead, arrowAt, ellipse };
})();
