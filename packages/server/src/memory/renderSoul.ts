import { getSoul } from './soulStore';
import { FALLBACK_PERSONA } from '../persona/loader';

// Initiative 22: the DB-sourced persona block — the whole soul as one document. The fixed core
// (dev-authored, git-seeded) first, then Luna's own evolving voice fenced beneath it. Since v0.30.3
// this is THE persona block in buildSystemPrompt (the persona-file + core_memory render retired).
//
// DETERMINISTIC + TIMESTAMP-FREE — this sits inside the ONE cached system block, so its bytes must
// be identical across turns unless the soul actually changed (an updateEvolving write bumps the
// memory epoch). Never interpolate updated_ms or any per-turn value here. An empty soul (no seed
// yet / unreadable) degrades to the exact FALLBACK_PERSONA the file path uses.
export function renderSoulBlock(): string {
  const soul = getSoul();
  const fixed = soul.fixed_text.trim();
  if (fixed.length === 0) return FALLBACK_PERSONA;

  const lines: string[] = [fixed];
  const self = soul.evolving_self.trim();
  const bond = soul.evolving_bond.trim();
  if (self.length > 0 || bond.length > 0) {
    lines.push('');
    if (self.length > 0) lines.push('## Who I am becoming', self, '');
    if (bond.length > 0) lines.push('## The bond, right now', bond, '');
  }
  return lines.join('\n').trim();
}
