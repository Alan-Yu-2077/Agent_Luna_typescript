// Skill library store (Initiative 8, v0.15.4; lifecycle Initiative 23, v0.32.0).
// Wraps the `skills` table (migrations 0009 + 0018) via the shared memory DB
// connection (getMemoryDb), exactly like l3Store / repoMapCache — when the DB is
// unset (tests without setMemoryDb, LUNA_PERSIST=0) every call no-ops (writes
// return false, reads return empty), so the tools degrade to "can't persist"
// rather than crashing.
//
// A skill is a reusable PROCEDURE the model recalls as guidance — never executed.
// v0.32.0 makes the store lifecycle-complete on the soulStore template: audit-first
// mutations (skills_audit carries the full prior state, so restoreSkill is a
// one-call undo), a byte-identical no-op guard, and a memory-epoch bump on every
// real change — required now that the skill shelf renders inside the ONE cached
// system block. `source` is the provenance of the current body ('saved' = the
// verify-gated awake tool, 'dream' = distilled, 'owner' = the workspace editor).

import { getMemoryDb } from '../memory/sessionStore';
import { bumpMemoryEpoch } from '../memory/epoch';
import { lexicalScore } from '../memory/recall/lexical';

export type SkillSource = 'saved' | 'dream' | 'owner';

export type Skill = {
  name: string;
  description: string;
  body: string;
  created_ms: number;
  verified_ms: number;
  used_count: number;
  last_used_ms: number;
  source: string;
  deprecated_ms: number;
};

const COLS =
  'name, description, body, created_ms, verified_ms, used_count, last_used_ms, source, deprecated_ms';

// The ONE embed/candidate text for a skill (v0.32.1): name + description — the
// retrieval key (the Voyager pattern), never the body. Shared by the recall
// candidate loop AND rag_refresh's pre-warm so the embedding cache key matches.
export function skillEmbedText(s: { name: string; description: string }): string {
  return `${s.name}: ${s.description}`;
}

// Boot-frozen mount truth for the recall paths (v0.32.1 review fix). The registry,
// L1 clause, and shelf are all composed ONCE at boot from skillsEnabled(); a live
// settings pin mutates Bun.env immediately even though the flag is restartRequired,
// so a call-time env read here would half-apply skills (candidates surfacing while
// recall_skill is unmounted — advertising a tool that doesn't exist). main.ts sets
// this beside the registry composition; everything recall-side reads it, never env.
let recallMounted = false;

export function setSkillsRecallMounted(on: boolean): void {
  recallMounted = on;
}

export function skillsRecallMounted(): boolean {
  return recallMounted;
}

type Db = NonNullable<ReturnType<typeof getMemoryDb>>;

function auditPrev(db: Db, prev: Skill, actor: string, nowMs: number): void {
  db.prepare(
    `INSERT INTO skills_audit (t_ms, name, prev_description, prev_body, prev_source, prev_verified_ms, prev_deprecated_ms, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nowMs,
    prev.name,
    prev.description,
    prev.body,
    prev.source,
    prev.verified_ms,
    prev.deprecated_ms,
    actor,
  );
}

// name + description render into the ONE cached system block (the shelf) as plain
// markdown lines — a newline in either would let a skill break out of its bullet
// and forge a sibling system-prompt section (the v0.32.2 review's injection sink).
// Coerce both to single lines at the write choke point; the body never renders in
// a prompt block (it travels only as recall_skill tool output — a data channel).
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// Upsert a skill. `created_ms` and the usage counters are preserved on update
// (first-seen time; an improved skill keeps its usage history); `verified_ms`
// refreshes each save — including a byte-identical one (the caller just
// re-verified; only the CONTENT no-op skips audit + epoch, since verified_ms is
// never rendered on the shelf). Saving an existing DEPRECATED skill revives it
// (the AWAKE paths' deliberate-re-save semantics; the dream's distiller applies
// its own stricter no-resurrection guard before calling in).
// Returns false when there is no DB (nothing persisted).
export function saveSkill(
  rawSkill: { name: string; description: string; body: string },
  nowMs: number,
  source: SkillSource = 'saved',
): boolean {
  const db = getMemoryDb();
  if (!db) return false;
  const skill = {
    name: oneLine(rawSkill.name),
    description: oneLine(rawSkill.description),
    body: rawSkill.body,
  };
  if (skill.name.length === 0 || skill.description.length === 0) return false;
  const prev = getSkill(skill.name);
  if (
    prev &&
    prev.deprecated_ms === 0 &&
    prev.description === skill.description &&
    prev.body === skill.body
  ) {
    // Byte-identical content — refresh the verification stamp only: no audit, no
    // epoch bump (shelf bytes are unchanged; listSkills' recency ordering is not
    // part of the cached block).
    db.prepare('UPDATE skills SET verified_ms = ? WHERE name = ?').run(nowMs, skill.name);
    return true;
  }
  if (prev) auditPrev(db, prev, source, nowMs);
  const created = prev ? prev.created_ms : nowMs;
  db.prepare(
    `INSERT INTO skills (name, description, body, created_ms, verified_ms, source, deprecated_ms)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(name) DO UPDATE SET
       description = excluded.description,
       body = excluded.body,
       verified_ms = excluded.verified_ms,
       source = excluded.source,
       deprecated_ms = 0`,
  ).run(skill.name, skill.description, skill.body, created, nowMs, source);
  bumpMemoryEpoch();
  return true;
}

// The shelf cap. Shared by markUsed (membership check) + renderSkillShelf.
export function shelfMax(): number {
  const v = Number(Bun.env['LUNA_SKILL_SHELF_MAX']);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 20;
}

// Usage trace for shelf eviction + dream deprecation. No audit ever (counts are
// housekeeping, not authored state). Usage counters DO decide shelf MEMBERSHIP
// once the library exceeds the cap, so a usage tick that actually changes what
// the shelf renders is treated as a real change (epoch bump — same class as a
// save); the common under-cap tick stays epoch-silent and byte-silent.
export function markUsed(name: string, nowMs: number): void {
  const db = getMemoryDb();
  if (!db) return;
  const cap = shelfMax();
  const before = listShelf(cap)
    .map((s) => s.name)
    .join('\n');
  db.prepare('UPDATE skills SET used_count = used_count + 1, last_used_ms = ? WHERE name = ?').run(
    nowMs,
    name,
  );
  const after = listShelf(cap)
    .map((s) => s.name)
    .join('\n');
  if (after !== before) bumpMemoryEpoch();
}

// Soft-deprecate (the L3 deleted_ms pattern): off the shelf + out of recall, but
// recoverable. No-op (false) when missing or already deprecated.
export function deprecateSkill(name: string, nowMs: number, actor: string): boolean {
  const db = getMemoryDb();
  if (!db) return false;
  const prev = getSkill(name);
  if (!prev || prev.deprecated_ms > 0) return false;
  auditPrev(db, prev, actor, nowMs);
  db.prepare('UPDATE skills SET deprecated_ms = ? WHERE name = ?').run(nowMs, name);
  bumpMemoryEpoch();
  return true;
}

// One-call undo: restore the skill to its latest audited prior state — the state
// before the last mutation, INCLUDING a restore (the current state is audited
// first with source 'restore', and the lookup reads restore rows too, so a second
// restore undoes the first — undo/redo toggle, and restores genuinely chain).
// The full prior state comes back: body, description, provenance, verified_ms
// (the old body's own verification stamp — a restored body must not wear the
// replaced version's), and deprecated_ms. No-op-guarded: restoring to a state
// identical to the current one writes nothing (no audit, no epoch bump).
export function restoreSkill(name: string, nowMs: number): Skill | null {
  const db = getMemoryDb();
  if (!db) return null;
  const prior = db
    .prepare(
      `SELECT prev_description, prev_body, prev_source, prev_verified_ms, prev_deprecated_ms
       FROM skills_audit WHERE name = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(name) as {
    prev_description: string;
    prev_body: string;
    prev_source: string;
    prev_verified_ms: number;
    prev_deprecated_ms: number;
  } | null;
  const current = getSkill(name);
  if (!prior || !current) return null;
  if (
    prior.prev_description === current.description &&
    prior.prev_body === current.body &&
    prior.prev_source === current.source &&
    prior.prev_verified_ms === current.verified_ms &&
    prior.prev_deprecated_ms === current.deprecated_ms
  ) {
    return current; // already in that state — no write, no audit, no epoch bump
  }
  auditPrev(db, current, 'restore', nowMs);
  db.prepare(
    'UPDATE skills SET description = ?, body = ?, source = ?, verified_ms = ?, deprecated_ms = ? WHERE name = ?',
  ).run(
    prior.prev_description,
    prior.prev_body,
    prior.prev_source,
    prior.prev_verified_ms,
    prior.prev_deprecated_ms,
    name,
  );
  bumpMemoryEpoch();
  return getSkill(name);
}

export function getSkill(name: string): Skill | null {
  const db = getMemoryDb();
  if (!db) return null;
  return (db.prepare(`SELECT ${COLS} FROM skills WHERE name = ?`).get(name) as Skill | null) ?? null;
}

export function listSkills(limit = 50, includeDeprecated = false): Skill[] {
  const db = getMemoryDb();
  if (!db) return [];
  const where = includeDeprecated ? '' : 'WHERE deprecated_ms = 0';
  return db
    .prepare(`SELECT ${COLS} FROM skills ${where} ORDER BY verified_ms DESC LIMIT ?`)
    .all(limit) as Skill[];
}

// The shelf: active skills, NAME-ordered (deterministic bytes — the shelf lives in
// the cached system block, and verified_ms ordering would reshuffle on every save).
// Over the cap, the most-used survive (least-used descriptions drop off the shelf,
// not out of the library — the Claude Code listing-eviction pattern), then the
// survivors render name-ordered.
export function listShelf(cap: number): Skill[] {
  const db = getMemoryDb();
  if (!db || cap < 1) return [];
  const active = db
    .prepare(`SELECT ${COLS} FROM skills WHERE deprecated_ms = 0`)
    .all() as Skill[];
  const kept =
    active.length <= cap
      ? active
      : [...active]
          .sort(
            (a, b) =>
              b.used_count - a.used_count ||
              b.last_used_ms - a.last_used_ms ||
              (a.name < b.name ? -1 : 1),
          )
          .slice(0, cap);
  return kept.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Rank skills by a lexical match of the query against name + description (reuses
// the recall layer's CJK-aware bigram scorer). Falls back to recency on an empty
// query. Ties broken by recency (the LIMIT in listSkills already orders by it).
export function searchSkills(query: string, limit = 10, includeDeprecated = false): Skill[] {
  const all = listSkills(1000, includeDeprecated);
  if (!query.trim()) return all.slice(0, limit);
  return all
    .map((s) => ({ s, score: lexicalScore(query, `${s.name} ${s.description}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.s.verified_ms - a.s.verified_ms)
    .slice(0, limit)
    .map((x) => x.s);
}
