import { DataSkills, type SkillRecord } from '@luna/protocol';

// v0.44.4 — the skills page. The star of this page is not the body (that is an operating manual she
// wrote for herself) but the GROWTH RECORD: what she learned, how often it gets used, when last —
// and above all WHICH ones she taught herself. Read-only: her skills are managed by the dream's
// distillation and the owner panel; this page only looks.

export type SkillGroups = { active: SkillRecord[]; retired: SkillRecord[] };

// Alive ones first, most-recently-used leading; the retired fold to the bottom by retirement date.
export function groupSkills(skills: SkillRecord[]): SkillGroups {
  const active = skills.filter((s) => s.deprecated_ms === 0).sort((a, b) => b.last_used_ms - a.last_used_ms);
  const retired = skills.filter((s) => s.deprecated_ms > 0).sort((a, b) => b.deprecated_ms - a.deprecated_ms);
  return { active, retired };
}

// The interesting distinction (M9): 'saved' and 'dream' are HERS — self-taught, whether saved
// mid-conversation or distilled by a night's consolidation. Everything else was installed.
export function selfTaught(source: string): boolean {
  return source === 'saved' || source === 'dream';
}

export function relativeTime(ms: number, now: number): string {
  if (ms <= 0) return '还没用过';
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function mountSkillsPage(doc: Document, fetchFn: typeof fetch = fetch): HTMLElement {
  const page = doc.createElement('div');
  page.className = 'skills-page';

  void fetchFn('/api/data/skills')
    .then(async (res) => {
      if (!res.ok) throw new Error('unreachable');
      const { skills } = DataSkills.parse(await res.json());
      assemble(doc, page, groupSkills(skills));
    })
    .catch(() => {
      const err = doc.createElement('p');
      err.className = 'skills-empty';
      err.textContent = '现在取不到她的技能——她的后端没有在跑。';
      page.appendChild(err);
    });
  return page;
}

function assemble(doc: Document, page: HTMLElement, groups: SkillGroups): void {
  if (groups.active.length === 0 && groups.retired.length === 0) {
    const empty = doc.createElement('p');
    empty.className = 'skills-empty';
    empty.textContent = '她还没攒下自己的技能。';
    page.appendChild(empty);
    return;
  }

  let openCard: HTMLElement | null = null;
  const card = (s: SkillRecord, retired: boolean): HTMLElement => {
    const el = doc.createElement('article');
    el.className = `skill-card${selfTaught(s.source) ? ' self-taught' : ''}${retired ? ' retired' : ''}`;
    const head = doc.createElement('button');
    head.type = 'button';
    head.className = 'skill-head';
    const name = doc.createElement('span');
    name.className = 'skill-name';
    name.textContent = selfTaught(s.source) ? `✦ ${s.name}` : s.name;
    const desc = doc.createElement('span');
    desc.className = 'skill-desc';
    desc.textContent = s.description;
    const meta = doc.createElement('span');
    meta.className = 'skill-meta';
    meta.textContent = retired
      ? `已退役 · ${relativeTime(s.deprecated_ms, Date.now()).replace('还没用过', '')}`
      : `用过 ${s.used_count} 次 · ${relativeTime(s.last_used_ms, Date.now())}`;
    head.append(name, desc, meta);
    const body = doc.createElement('pre');
    body.className = 'skill-body';
    body.textContent = s.body;
    body.hidden = true;
    // One card open at a time — the page is a shelf, not an accordion orchestra.
    head.addEventListener('click', () => {
      const opening = body.hidden;
      if (openCard && openCard !== el) {
        openCard.querySelector('.skill-body')?.setAttribute('hidden', '');
        openCard.classList.remove('open');
      }
      body.hidden = !opening;
      el.classList.toggle('open', opening);
      openCard = opening ? el : null;
    });
    el.append(head, body);
    return el;
  };

  for (const s of groups.active) page.appendChild(card(s, false));
  if (groups.retired.length > 0) {
    const h = doc.createElement('h3');
    h.className = 'skills-retired-head';
    h.textContent = '退役';
    page.appendChild(h);
    for (const s of groups.retired) page.appendChild(card(s, true));
  }
}
