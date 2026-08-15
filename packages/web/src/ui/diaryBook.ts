import {
  DataDiaries,
  DataDreams,
  type DiaryEntry,
  type DreamRecord,
  type DreamStep,
} from '@luna/protocol';

// v0.44.3 — the diary book. What she writes by day and what she digests by night are the same
// evening's two faces, so they share one book (D7): a two-page spread, calendar left, content
// right, with a Diary|Dream switch on days that have both. Read-only by decision — it is HER
// writing, and an edited diary is no longer something she wrote.
//
// The split follows the workbench convention: everything above `mountDiaryBook` is pure data the
// tests drive; the mount is DOM assembly over it (verified in the real renderer).

// ── day mapping ──────────────────────────────────────────────────────────────────────────────

// Local day, deliberately: "the night of the 31st" is the owner's clock, not UTC's.
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type BookDay = { diary?: DiaryEntry; dreams: DreamRecord[] };
export type BookIndex = {
  days: Map<string, BookDay>;
  // Every day with anything to show, newest first — the calendar lights exactly these (M8: the 28
  // diaries skip days, so the data decides the lit set, never a range).
  litDays: string[];
  diaryCount: number;
};

export function buildBookIndex(diaries: DiaryEntry[], dreams: DreamRecord[]): BookIndex {
  const days = new Map<string, BookDay>();
  const dayOf = (key: string): BookDay => {
    let d = days.get(key);
    if (!d) {
      d = { dreams: [] };
      days.set(key, d);
    }
    return d;
  };
  let diaryCount = 0;
  for (const e of diaries) {
    // Only day diaries live on the calendar; week/month digests have no single day to sit on.
    if (e.kind !== 'day') continue;
    dayOf(e.period_key).diary = e;
    diaryCount++;
  }
  for (const dream of dreams) {
    dayOf(localDayKey(dream.started_ms)).dreams.push(dream);
  }
  const litDays = [...days.keys()].sort().reverse();
  return { days, litDays, diaryCount };
}

// ── calendar ─────────────────────────────────────────────────────────────────────────────────

export type CalendarCell = {
  day: number | null; // null = leading/trailing blank
  key: string | null;
  hasDiary: boolean;
  hasDream: boolean;
};

export function monthGrid(year: number, month0: number, index: BookIndex): CalendarCell[] {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < first.getDay(); i++)
    cells.push({ day: null, key: null, hasDiary: false, hasDream: false });
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${`${month0 + 1}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
    const entry = index.days.get(key);
    cells.push({
      day,
      key,
      hasDiary: entry?.diary !== undefined,
      hasDream: (entry?.dreams.length ?? 0) > 0,
    });
  }
  return cells;
}

// Arrow keys travel between LIT days only (the grey ones are not places).
export function nextLitDay(
  litDays: readonly string[],
  current: string,
  delta: 1 | -1,
): string | null {
  if (litDays.length === 0) return null;
  const i = litDays.indexOf(current);
  if (i < 0) return litDays[0] ?? null;
  const next = i + delta;
  if (next < 0 || next >= litDays.length) return current;
  return litDays[next] ?? current;
}

// ── the dream translation layer (M10) ────────────────────────────────────────────────────────
// `steps[]` is a consolidation pipeline, not prose. The book renders "what she did that night" —
// stating actions and counts only, never ascribing feelings: anything more would be writing her
// diary for her. The exact wording below is a first draft for the owner to review (README OQ1).

const num = (detail: string, pattern: RegExp): string | null => pattern.exec(detail)?.[1] ?? null;

export function translateStep(s: DreamStep): string {
  if (s.status === 'skipped') {
    if (s.step === 'refine_layer1') return '略过——没什么要折叠的。';
    return `略过了${stepNoun(s.step)}。`;
  }
  switch (s.step) {
    case 'rate_salience': {
      const n = num(s.detail, /rated (\d+)/);
      return n ? `回看了 ${n} 个瞬间。` : '回看了这段日子。';
    }
    case 'refine_semantic': {
      const removed = num(s.detail, /removed (\d+)/);
      const added = num(s.detail, /added (\d+)/);
      if (removed !== null && added !== null) return `放下了 ${removed} 件事，记住了 ${added} 件。`;
      return '整理了心里的事。';
    }
    case 'memory_audit': {
      const removed = num(s.detail, /removed (\d+)/);
      const added = num(s.detail, /added (\d+)/);
      if (removed !== null && added !== null)
        return `整理了记忆的抽屉（−${removed} / +${added}）。`;
      return '整理了记忆的抽屉。';
    }
    case 'refine_layer1':
      return '把散着的对话折叠归档了。';
    case 'persona_update':
      return `对自己的认识动了动（${s.detail || 'self'}）。`;
    case 'run_diaries': {
      const n = num(s.detail, /(\d+) diar/);
      return n ? `写下了 ${n} 篇日记。` : '写了日记。';
    }
    case 'distill_skills': {
      const name = /new:([\w-]+)/.exec(s.detail)?.[1];
      return name ? `学会了一件新事：${name}。` : '沉淀了一项技能。';
    }
    case 'rag_refresh':
      return '翻新了回忆的书签。';
    default:
      // A step this table has never met renders RAW rather than crashing or vanishing — a future
      // dream stage shows up as itself until someone writes it a line.
      return `${s.step}: ${s.detail || s.status}`;
  }
}

function stepNoun(step: string): string {
  switch (step) {
    case 'rate_salience':
      return '回看';
    case 'run_diaries':
      return '写日记';
    case 'distill_skills':
      return '技能沉淀';
    default:
      return step;
  }
}

export const DREAM_BROKE = '这个梦断掉了。';

export function dreamNarrative(record: DreamRecord): { broken: boolean; lines: string[] } {
  if (record.aborted || record.steps.length === 0) return { broken: true, lines: [DREAM_BROKE] };
  return { broken: false, lines: record.steps.map(translateStep) };
}

// ── the page-turn queue ──────────────────────────────────────────────────────────────────────
// One turn at a time; a click landing mid-turn queues (latest wins — the reader wants where they
// pointed LAST, not a replay of every misclick between).

export function createTurnQueue(runTurn: (to: string, done: () => void) => void): {
  request: (to: string) => void;
  turning: () => boolean;
} {
  let turning = false;
  let pending: string | null = null;
  const start = (to: string): void => {
    turning = true;
    runTurn(to, () => {
      turning = false;
      if (pending !== null) {
        const next = pending;
        pending = null;
        start(next);
      }
    });
  };
  return {
    request: (to) => {
      if (turning) pending = to;
      else start(to);
    },
    turning: () => turning,
  };
}

// ── formatting ───────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

export function pageHeading(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return dayKey;
  return `${y}年${m}月${d}日`;
}

// ── fetch + mount ────────────────────────────────────────────────────────────────────────────

export const TURN_MS = 1600;
export const HALF_TURN_MS = 1000;
const SKELETON_MIN_MS = 300;

async function loadBook(fetchFn: typeof fetch): Promise<BookIndex> {
  const [diariesRes, dreamsRes] = await Promise.all([
    fetchFn('/api/data/diaries'),
    fetchFn('/api/data/dreams'),
  ]);
  if (!diariesRes.ok || !dreamsRes.ok) throw new Error('data surface unreachable');
  const diaries = DataDiaries.parse(await diariesRes.json());
  const dreams = DataDreams.parse(await dreamsRes.json());
  return buildBookIndex(diaries.entries, dreams.dreams);
}

export function mountDiaryBook(doc: Document, fetchFn: typeof fetch = fetch): HTMLElement {
  const book = doc.createElement('div');
  book.className = 'diary-book';
  const skeleton = doc.createElement('div');
  skeleton.className = 'book-skeleton';
  for (let i = 0; i < 5; i++) skeleton.appendChild(doc.createElement('div'));
  book.appendChild(skeleton);

  const openedAt = Date.now();
  void loadBook(fetchFn)
    .then((index) => {
      const wait = Math.max(0, SKELETON_MIN_MS - (Date.now() - openedAt));
      setTimeout(() => {
        skeleton.remove();
        assemble(doc, book, index);
      }, wait);
    })
    .catch(() => {
      skeleton.remove();
      const err = doc.createElement('p');
      err.className = 'book-empty';
      err.textContent = '现在取不到她的日记——她的后端没有在跑。';
      book.appendChild(err);
    });
  return book;
}

function assemble(doc: Document, book: HTMLElement, index: BookIndex): void {
  if (index.litDays.length === 0) {
    const empty = doc.createElement('p');
    empty.className = 'book-empty';
    empty.textContent = '这本还是空的——她还没写下第一篇。';
    book.appendChild(empty);
    return;
  }

  let currentDay = index.litDays[0]!;
  let face: 'diary' | 'dream' = index.days.get(currentDay)?.diary ? 'diary' : 'dream';
  const [y0, m0] = currentDay.split('-').map((v) => Number.parseInt(v, 10));
  let viewYear = y0!;
  let viewMonth0 = m0! - 1;

  const spread = doc.createElement('div');
  spread.className = 'book-spread';
  const left = doc.createElement('section');
  left.className = 'book-page left';
  const right = doc.createElement('section');
  right.className = 'book-page right';
  const spine = doc.createElement('div');
  spine.className = 'book-spine';
  spread.append(left, spine, right);
  book.appendChild(spread);

  // ── right page ──
  const renderContent = (target: HTMLElement): void => {
    target.replaceChildren();
    const entry = index.days.get(currentDay);
    const heading = doc.createElement('h3');
    heading.className = 'book-date';
    heading.textContent = pageHeading(currentDay);
    target.appendChild(heading);

    const hasBoth = entry?.diary !== undefined && (entry?.dreams.length ?? 0) > 0;
    if (hasBoth) {
      const sw = doc.createElement('div');
      sw.className = 'book-face-switch';
      for (const f of ['diary', 'dream'] as const) {
        const b = doc.createElement('button');
        b.type = 'button';
        b.textContent = f === 'diary' ? '日记' : '梦境';
        b.classList.toggle('on', face === f);
        b.addEventListener('click', () => {
          if (face === f || halfTurning) return;
          halfTurn(f);
        });
        sw.appendChild(b);
      }
      target.appendChild(sw);
    }

    const body = doc.createElement('div');
    body.className = 'book-body';
    if (face === 'diary' && entry?.diary) {
      const p = doc.createElement('p');
      p.textContent = entry.diary.text;
      body.appendChild(p);
    } else {
      for (const dream of entry?.dreams ?? []) {
        const n = dreamNarrative(dream);
        const block = doc.createElement('div');
        block.className = `book-dream${n.broken ? ' broken' : ''}`;
        for (const line of n.lines) {
          const p = doc.createElement('p');
          p.textContent = line;
          block.appendChild(p);
        }
        body.appendChild(block);
      }
    }
    target.appendChild(body);

    const foot = doc.createElement('div');
    foot.className = 'book-foot';
    const nth = index.litDays.length - index.litDays.indexOf(currentDay);
    foot.textContent = `第 ${nth} / ${index.litDays.length} 页`;
    target.appendChild(foot);
  };

  // ── page turn (E): the old face rotates away around the spine while the new content already
  // sits beneath it. Compositor-only (transform/opacity); will-change mounts only for the turn.
  const queue = createTurnQueue((to, done) => {
    const overlay = doc.createElement('section');
    overlay.className = 'book-page right turning';
    overlay.innerHTML = right.innerHTML;
    spread.appendChild(overlay);
    currentDay = to;
    const e = index.days.get(to);
    face = e?.diary ? 'diary' : 'dream';
    renderContent(right);
    renderCalendar();
    requestAnimationFrame(() => overlay.classList.add('away'));
    setTimeout(() => {
      overlay.remove();
      done();
    }, TURN_MS);
  });

  let halfTurning = false;
  const halfTurn = (to: 'diary' | 'dream'): void => {
    halfTurning = true;
    right.classList.add('half');
    setTimeout(() => {
      face = to;
      renderContent(right);
      right.classList.remove('half');
      setTimeout(() => {
        halfTurning = false;
      }, HALF_TURN_MS / 2);
    }, HALF_TURN_MS / 2);
  };

  // ── left page (calendar) ──
  const renderCalendar = (): void => {
    left.replaceChildren();
    const head = doc.createElement('div');
    head.className = 'book-cal-head';
    const prev = doc.createElement('button');
    prev.type = 'button';
    prev.textContent = '‹';
    const label = doc.createElement('span');
    label.textContent = `${MONTHS[viewMonth0]} ${viewYear}`;
    const next = doc.createElement('button');
    next.type = 'button';
    next.textContent = '›';
    prev.addEventListener('click', () => {
      viewMonth0 -= 1;
      if (viewMonth0 < 0) {
        viewMonth0 = 11;
        viewYear -= 1;
      }
      renderCalendar();
    });
    next.addEventListener('click', () => {
      viewMonth0 += 1;
      if (viewMonth0 > 11) {
        viewMonth0 = 0;
        viewYear += 1;
      }
      renderCalendar();
    });
    head.append(prev, label, next);
    left.appendChild(head);

    const grid = doc.createElement('div');
    grid.className = 'book-cal-grid';
    let monthCount = 0;
    for (const cell of monthGrid(viewYear, viewMonth0, index)) {
      const el = doc.createElement('button');
      el.type = 'button';
      el.className = 'book-cal-cell';
      if (cell.day === null) {
        el.classList.add('blank');
        el.tabIndex = -1;
      } else {
        el.textContent = String(cell.day);
        const lit = cell.hasDiary || cell.hasDream;
        if (lit) monthCount++;
        el.classList.toggle('lit', lit);
        el.classList.toggle('current', cell.key === currentDay);
        if (cell.hasDiary) el.classList.add('has-diary');
        if (cell.hasDream) el.classList.add('has-dream');
        if (!lit) el.tabIndex = -1;
        else {
          el.dataset['day'] = cell.key ?? '';
          el.addEventListener('click', () => {
            if (cell.key && cell.key !== currentDay) queue.request(cell.key);
          });
        }
      }
      grid.appendChild(el);
    }
    left.appendChild(grid);

    const foot = doc.createElement('div');
    foot.className = 'book-foot';
    foot.textContent = `本月 ${monthCount} 篇 · 共 ${index.diaryCount} 篇日记`;
    left.appendChild(foot);
  };

  // Keyboard: arrows travel the lit days, Enter turns.
  book.tabIndex = 0;
  let focusDay = currentDay;
  book.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const to = nextLitDay(index.litDays, focusDay, e.key === 'ArrowLeft' ? 1 : -1);
      if (to) {
        focusDay = to;
        const [yy, mm] = to.split('-').map((v) => Number.parseInt(v, 10));
        viewYear = yy!;
        viewMonth0 = mm! - 1;
        renderCalendar();
        left.querySelector(`[data-day="${to}"]`)?.classList.add('focus');
      }
      e.preventDefault();
    } else if (e.key === 'Enter' && focusDay !== currentDay) {
      queue.request(focusDay);
      e.preventDefault();
    }
  });

  renderCalendar();
  renderContent(right);
}
