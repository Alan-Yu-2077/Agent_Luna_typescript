// The skill shelf (Initiative 23, v0.32.0) — progressive disclosure, level 1: the
// names + one-line descriptions of Luna's active skills, rendered into the ONE
// cached system block so she can SEE her library every turn (the 2026-07-04 audit:
// the library was invisible — 1 save + 4 recalls in 19 days). The body stays on
// level 2: recall_skill fetches it on demand.
//
// DETERMINISTIC + TIMESTAMP-FREE: name-ordered via listShelf, no counts, no dates.
// Bytes change only on a real library change (save/deprecate/restore — each
// epoch-bumped) or, once the library exceeds the cap, on a usage tick that
// actually changes shelf membership (markUsed epoch-bumps exactly that case).

import { listShelf, shelfMax } from './skillStore';

// Defensive single-lining at the sink too (saveSkill already coerces on write, but
// a raw /_workspace grid edit bypasses the store) — a newline in a name/description
// must never let a shelf entry forge a sibling section in the cached system block.
function line(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function renderSkillShelf(): string {
  const skills = listShelf(shelfMax());
  if (skills.length === 0) return '';
  const lines = ['## Things you know how to do (your skill shelf)', ''];
  for (const s of skills) lines.push(`- ${line(s.name)} — ${line(s.description)}`);
  lines.push('', '(Before redoing one of these, recall_skill fetches the full procedure.)');
  return lines.join('\n');
}
