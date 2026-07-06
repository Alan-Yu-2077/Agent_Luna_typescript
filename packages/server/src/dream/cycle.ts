import type { DreamStepStatus, ServerEvent } from '@luna/protocol';
import { runGraph, type Graph } from '../turn/graph';
import { getMemoryDb, listL2, listUnratedL2, setImportance } from '../memory/sessionStore';
import { addFact, forgetFact, listFacts } from '../memory/l3Store';
import { getSoul, updateEvolving, type EvolvingPatch } from '../memory/soulStore';
import { similarityRatio } from '../memory/similarity';
import { maybeFold } from '../memory/l1Window';
import { getSession } from '../turn/session';
import { embedCacheKey, embeddingEnabled, fetchEmbedClient, type EmbedClient } from '../memory/recall/embed';
import {
  deprecateSkill,
  getSkill,
  listShelf,
  listSkills,
  saveSkill,
  shelfMax,
  skillEmbedText,
  skillsRecallMounted,
} from '../skills/skillStore';
import { trace, flushTrace, traceEnabled } from '../trace/instrument';
import { enterDream, parkFinishedIdle, setStep } from './dreamState';
import {
  dreamCall,
  parseJsonBlock,
  MemoryPatch,
  PersonaPatch,
  SaliencePatch,
  SkillPatch,
  type DreamLLM,
} from './llm';
import {
  diaryPrompt,
  distillSkillsPrompt,
  memoryAuditPrompt,
  personaUpdatePrompt,
  refineSemanticPrompt,
  saliencePrompt,
} from './prompts';

const MAX_DIARIES_PER_CYCLE = Number(Bun.env['LUNA_DREAM_MAX_DIARIES_PER_CYCLE'] ?? 20);
const RECENT_DIALOGUE_TURNS = 30;
const MAX_SALIENCE_PER_CYCLE = Number(Bun.env['LUNA_DREAM_MAX_SALIENCE_PER_CYCLE'] ?? 40);
// v0.21.7: a persona field whose new prose is at least this similar to the current
// value is treated as "no substantive change" and dropped — the prompt asks for null
// when unchanged, but the model often re-emits a ~97%-identical rewrite anyway. The
// updateEvolving's no-op guard catches byte-identical re-emits; this catches cosmetic drift.
const PERSONA_REWRITE_SIMILARITY = Number(Bun.env['LUNA_PERSONA_REWRITE_SIMILARITY'] ?? 0.95);

function personaFieldChanged(next: string, prev: string): boolean {
  const a = next.trim();
  const b = prev.trim();
  return a !== b && similarityRatio(a, b) < PERSONA_REWRITE_SIMILARITY;
}

// v0.27.4: a literal-minded model can emit the STRING "null"/"none" (or empty)
// to mean "unchanged" instead of the JSON literal null. PersonaPatch types the
// field as a nullable string, so that sentinel would validate and overwrite a
// still-true self_state/relationship with the word "null". Coerce it back to
// null (= no change) before the change check — belt to the prompt's suspenders.
function normPersonaField(v: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === '' || t.toLowerCase() === 'null' || t.toLowerCase() === 'none' ? null : v;
}

export type DreamNode =
  | 'rate_salience'
  | 'refine_semantic'
  | 'refine_layer1'
  | 'memory_audit'
  | 'persona_update'
  | 'run_diaries'
  | 'distill_skills'
  | 'rag_refresh';

export type StepRecord = { step: DreamNode; status: DreamStepStatus; detail: string; ms: number };

export type DreamCycleState = {
  cycleId: string;
  sessionId: string;
  llm: DreamLLM;
  embedClient: EmbedClient;
  emit: (e: ServerEvent) => void;
  steps: StepRecord[];
};

const ORDER: DreamNode[] = [
  'rate_salience',
  'refine_semantic',
  'refine_layer1',
  'memory_audit',
  'persona_update',
  'run_diaries',
  // v0.32.2: distillation sits between the diaries and the embed pre-warm so a
  // freshly distilled skill is embedded in the SAME cycle (rag_refresh reads it).
  'distill_skills',
  'rag_refresh',
];

function nextNode(current: DreamNode): DreamNode | 'end' {
  const idx = ORDER.indexOf(current);
  return idx >= 0 && idx + 1 < ORDER.length ? ORDER[idx + 1]! : 'end';
}

function recentDialogue(sessionId: string, sinceMs: number | null): string {
  const rows = listL2(sessionId);
  const slice = (sinceMs ? rows.filter((r) => r.t_ms > sinceMs) : rows).slice(
    -RECENT_DIALOGUE_TURNS,
  );
  return slice.map((r) => `User: ${r.user_text}\nLuna: ${r.assistant_text}`).join('\n\n');
}

async function applyMemoryPatch(patch: MemoryPatch): Promise<string> {
  let removed = 0;
  let added = 0;
  for (const id of patch.remove_ids) {
    if (forgetFact(id)?.status === 'forgotten') removed += 1;
  }
  for (const item of patch.add) {
    if (addFact(item.category, item.text)?.status === 'added') added += 1;
  }
  return `removed ${removed}, added ${added}`;
}

async function runStep(
  s: DreamCycleState,
  step: DreamNode,
  fn: () => Promise<[DreamStepStatus, string]>,
): Promise<DreamNode | 'end'> {
  setStep(step);
  const started = Date.now();
  let status: DreamStepStatus = 'failed';
  let detail = '';
  try {
    [status, detail] = await fn();
  } catch (e) {
    status = 'failed';
    detail = e instanceof Error ? e.message : String(e);
  }
  const record: StepRecord = { step, status, detail, ms: Date.now() - started };
  s.steps.push(record);
  s.emit({ type: 'dream.step', step, status, detail });
  if (traceEnabled()) {
    trace({
      schema_v: 1,
      kind: 'node',
      trace_id: `dream:${s.cycleId}`,
      turn_id: `dream:${s.cycleId}`,
      session_id: s.sessionId,
      t_ms: Date.now(),
      node_from: step,
      node_to: nextNode(step),
      payload: record,
    });
  }
  // Per-step flush: a crash mid-cycle must not lose completed steps' traces.
  flushTrace(`dream:${s.cycleId}`);
  return nextNode(step);
}

const dreamGraph: Graph<DreamCycleState, DreamNode> = {
  // v0.17.0 (Initiative 10): rate recent unrated turns 1–5 for salience BEFORE the
  // fold (refine_layer1) uses importance to anchor salient turns against
  // over-summarization; the score also feeds recall ranking (v0.17.1).
  rate_salience: (s) =>
    runStep(s, 'rate_salience', async () => {
      const unrated = listUnratedL2(s.sessionId, MAX_SALIENCE_PER_CYCLE);
      if (unrated.length === 0) return ['skipped', 'all turns rated'];
      const call = await dreamCall(s.llm, saliencePrompt(unrated));
      if (!call.ok) return ['failed', `${call.failure}: ${call.detail}`];
      const patch = parseJsonBlock(SaliencePatch, call.text);
      if (!patch) return ['failed', 'unparseable scores'];
      // The score→turn map is positional, so a length mismatch (the model dropped
      // or inserted a score) would mis-rate every turn after the shift and write
      // those wrong scores permanently. Reject the whole patch → retried next cycle.
      if (patch.scores.length !== unrated.length) {
        return ['failed', `score/turn count mismatch (${patch.scores.length} vs ${unrated.length})`];
      }
      let rated = 0;
      // listUnratedL2 returns most-recent-first; the prompt numbered them in that
      // same order, so scores[i] maps to unrated[i].
      unrated.forEach((row, i) => {
        const score = patch.scores[i];
        if (typeof score === 'number') {
          setImportance(row.id, score);
          rated += 1;
        }
      });
      return rated > 0 ? ['ok', `rated ${rated} turns`] : ['failed', 'no scores applied'];
    }),

  refine_semantic: (s) =>
    runStep(s, 'refine_semantic', async () => {
      const facts = listFacts();
      if (facts.length === 0) return ['skipped', 'no facts to refine'];
      const call = await dreamCall(s.llm, refineSemanticPrompt(facts));
      if (!call.ok) return ['failed', `${call.failure}: ${call.detail}`];
      const patch = parseJsonBlock(MemoryPatch, call.text);
      if (!patch) return ['failed', 'unparseable patch'];
      if (patch.remove_ids.length === 0 && patch.add.length === 0)
        return ['skipped', 'nothing to change'];
      return ['ok', await applyMemoryPatch(patch)];
    }),

  refine_layer1: (s) =>
    runStep(s, 'refine_layer1', async () => {
      const session = getSession(s.sessionId);
      const landed = await maybeFold(session, s.llm.fallback ?? s.llm.primary);
      return landed ? ['ok', 'rolling summary consolidated'] : ['skipped', 'nothing to fold'];
    }),

  memory_audit: (s) =>
    runStep(s, 'memory_audit', async () => {
      const facts = listFacts();
      const dialogue = recentDialogue(s.sessionId, null);
      if (dialogue.length === 0) return ['skipped', 'no recent dialogue'];
      const call = await dreamCall(s.llm, memoryAuditPrompt(facts, dialogue));
      if (!call.ok) return ['failed', `${call.failure}: ${call.detail}`];
      const patch = parseJsonBlock(MemoryPatch, call.text);
      if (!patch) return ['failed', 'unparseable patch'];
      if (patch.remove_ids.length === 0 && patch.add.length === 0)
        return ['skipped', 'memory consistent'];
      return ['ok', await applyMemoryPatch(patch)];
    }),

  persona_update: (s) =>
    runStep(s, 'persona_update', async () => {
      const dialogue = recentDialogue(s.sessionId, null);
      if (dialogue.length === 0) return ['skipped', 'no recent dialogue'];
      // v0.30.3 (Initiative 22): the dream authors the soul's EVOLVING section (self + bond) — and
      // ONLY that section: there is no code path from here to soul.fixed_text, so the dev-authored
      // fixed core is unreachable to her (firewall, test-pinned). core_memory is retired.
      const soul = getSoul();
      const cur = { self: soul.evolving_self, rel: soul.evolving_bond };
      const call = await dreamCall(s.llm, personaUpdatePrompt(cur.self, cur.rel, dialogue));
      if (!call.ok) return ['failed', `${call.failure}: ${call.detail}`];
      const patch = parseJsonBlock(PersonaPatch, call.text);
      if (!patch) return ['failed', 'unparseable persona patch'];
      // Drop a field the model re-emitted with no substantive change (it tends to
      // re-write near-identical prose instead of returning null) so a stable identity
      // stops churning the audit log + cache epoch every dream (v0.21.7).
      const nextSelf = normPersonaField(patch.self_state);
      const nextRel = normPersonaField(patch.relationship_status);
      const doSelf = nextSelf != null && personaFieldChanged(nextSelf, cur.self);
      const doRel = nextRel != null && personaFieldChanged(nextRel, cur.rel);
      if (!doSelf && !doRel) return ['skipped', 'persona unchanged'];
      const patch2: EvolvingPatch = {};
      if (doSelf) patch2.self = nextSelf ?? undefined;
      if (doRel) patch2.bond = nextRel ?? undefined;
      updateEvolving(patch2, 'dream');
      return ['ok', [doSelf ? 'self' : '', doRel ? 'bond' : ''].filter(Boolean).join('+')];
    }),

  run_diaries: (s) =>
    runStep(s, 'run_diaries', async () => {
      const db = getMemoryDb();
      if (!db) return ['skipped', 'no memory db'];
      const rows = listL2(s.sessionId);
      if (rows.length === 0) return ['skipped', 'no timeline'];

      const byDay = new Map<string, string[]>();
      for (const r of rows) {
        const day = new Date(r.t_ms).toISOString().slice(0, 10);
        const list = byDay.get(day) ?? [];
        list.push(`User: ${r.user_text}\nLuna: ${r.assistant_text}`);
        byDay.set(day, list);
      }

      const hasDiary = db.prepare('SELECT 1 FROM diaries WHERE kind = ? AND period_key = ?');
      const insertDiary = db.prepare(
        'INSERT OR IGNORE INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)',
      );
      // v0.17.3 (option 2) + v0.21.7: today AND yesterday's day-diary are rewritten
      // on every dream — a dream during the day captures the whole day so far, and
      // the NEXT day's first dream gives yesterday one final complete pass (catching
      // anything said after the last in-day dream, before midnight) before it
      // freezes. Days older than yesterday stay write-once — complete + immutable.
      // The keys are the same UTC calendar grouping the rows use above.
      const upsertDiary = db.prepare(
        `INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, period_key) DO UPDATE SET text = excluded.text, generated_ms = excluded.generated_ms`,
      );
      const todayKey = new Date(Date.now()).toISOString().slice(0, 10);
      const yesterdayKey = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      let written = 0;

      for (const [day, pieces] of [...byDay.entries()].sort()) {
        if (written >= MAX_DIARIES_PER_CYCLE) break;
        const rewritable = day === todayKey || day === yesterdayKey;
        if (!rewritable && hasDiary.get('day', day)) continue;
        const call = await dreamCall(s.llm, diaryPrompt('day', day, pieces.join('\n\n')), 1400);
        if (!call.ok) return ['failed', `day ${day}: ${call.failure}: ${call.detail}`];
        (rewritable ? upsertDiary : insertDiary).run('day', day, call.text.trim(), Date.now());
        written += 1;
      }

      const dayDiaries = db
        .prepare("SELECT period_key, text FROM diaries WHERE kind = 'day' ORDER BY period_key ASC")
        .all() as { period_key: string; text: string }[];
      const byWeek = new Map<string, { period_key: string; text: string }[]>();
      for (const d of dayDiaries) {
        const date = new Date(`${d.period_key}T00:00:00Z`);
        const year = date.getUTCFullYear();
        const jan1 = Date.UTC(year, 0, 1);
        const week = Math.ceil(
          ((date.getTime() - jan1) / 86_400_000 + new Date(jan1).getUTCDay() + 1) / 7,
        );
        const key = `${year}-W${String(week).padStart(2, '0')}`;
        const list = byWeek.get(key) ?? [];
        list.push(d);
        byWeek.set(key, list);
      }
      for (const [week, days] of [...byWeek.entries()].sort()) {
        if (written >= MAX_DIARIES_PER_CYCLE) break;
        if (days.length < 7 || hasDiary.get('week', week)) continue;
        const source = days.map((d) => `${d.period_key}:\n${d.text}`).join('\n\n');
        const call = await dreamCall(s.llm, diaryPrompt('week', week, source), 1800);
        if (!call.ok) return ['failed', `week ${week}: ${call.failure}: ${call.detail}`];
        insertDiary.run('week', week, call.text.trim(), Date.now());
        written += 1;
      }

      // v0.17.1: monthly retrospectives — roll a month's day-diaries (≥28) into a
      // 'month' entry once, idempotent via INSERT OR IGNORE + the hasDiary check.
      const byMonth = new Map<string, { period_key: string; text: string }[]>();
      for (const d of dayDiaries) {
        const key = d.period_key.slice(0, 7); // YYYY-MM
        const list = byMonth.get(key) ?? [];
        list.push(d);
        byMonth.set(key, list);
      }
      for (const [month, days] of [...byMonth.entries()].sort()) {
        if (written >= MAX_DIARIES_PER_CYCLE) break;
        if (days.length < 28 || hasDiary.get('month', month)) continue;
        const source = days.map((d) => `${d.period_key}:\n${d.text}`).join('\n\n');
        const call = await dreamCall(s.llm, diaryPrompt('month', month, source), 2000);
        if (!call.ok) return ['failed', `month ${month}: ${call.failure}: ${call.detail}`];
        insertDiary.run('month', month, call.text.trim(), Date.now());
        written += 1;
      }

      return written > 0 ? ['ok', `${written} diaries written`] : ['skipped', 'diaries up to date'];
    }),

  // v0.32.2 (Initiative 23): dream-time skill distillation — the day's salient
  // episodes (rated by rate_salience earlier THIS cycle) become at most a capped
  // number of provenance-tagged skills. Dark-launched behind LUNA_DREAM_SKILLS
  // (default OFF; the live A/B gates the v0.32.3 flip). HARD BOUNDARIES: writes go
  // ONLY through the audited store (saveSkill/deprecateSkill, source 'dream' —
  // every one is a single restoreSkill call to undo), and this step NEVER spawns
  // the test suite (dreams can run at shutdown; save_skill's verify gate is
  // awake-tool-only — dream skills are distinguishable by provenance instead).
  distill_skills: (s) =>
    runStep(s, 'distill_skills', async () => {
      // v0.32.3: default ON after the live A/B (null-restraint + positive distillation
      // both verified against the real DB); =0 is the escape hatch. Read call-time, so
      // the settings-panel toggle applies without a restart.
      if (Bun.env['LUNA_DREAM_SKILLS'] === '0') return ['skipped', 'off (LUNA_DREAM_SKILLS=0)'];
      const db = getMemoryDb();
      if (!db) return ['skipped', 'no memory db'];
      if (!skillsRecallMounted()) return ['skipped', 'skills unmounted'];

      const dayAgo = Date.now() - 86_400_000;
      const salient = listL2(s.sessionId).filter(
        (r) => r.t_ms > dayAgo && (r.importance ?? 0) >= 4,
      );
      if (salient.length === 0) return ['skipped', 'no salient episodes today'];
      const episodes = salient
        .slice(-20)
        .map((r) => `User: ${r.user_text}\nLuna: ${r.assistant_text}`)
        .join('\n\n');

      const shelf = listShelf(shelfMax()).map((k) => ({
        name: k.name,
        description: k.description,
      }));
      const staleDaysRaw = Number(Bun.env['LUNA_SKILL_STALE_DAYS']);
      const staleMs =
        (Number.isFinite(staleDaysRaw) && staleDaysRaw > 0 ? staleDaysRaw : 30) * 86_400_000;
      const stale = listSkills(500)
        .filter((k) => k.used_count === 0 && Date.now() - k.verified_ms > staleMs)
        .map((k) => ({ name: k.name, description: k.description }));

      // 8192 output tokens: SkillPatch allows two near-cap bodies (~8k chars each) and
      // CJK runs ~1 token/char — the 2048 default truncated mid-JSON on a thorough day,
      // failing the parse forever (review finding). A still-truncated pathological patch
      // fails parse → retried next cycle, never half-applied.
      const call = await dreamCall(s.llm, distillSkillsPrompt(episodes, shelf, stale), 8192);
      if (!call.ok) return ['failed', `${call.failure}: ${call.detail}`];
      const patch = parseJsonBlock(SkillPatch, call.text);
      if (!patch) return ['failed', 'unparseable skill patch'];
      const news = patch.new ?? [];
      const merges = patch.merge ?? [];
      const deprecates = patch.deprecate ?? [];
      if (news.length === 0 && merges.length === 0 && deprecates.length === 0) {
        return ['skipped', 'nothing to distill'];
      }

      // Whole-patch structural rejection (the rate_salience exemplar): a bad shape
      // means the model misunderstood the contract — apply NOTHING, retry next cycle.
      // The dream may never RESURRECT: a deprecated name is still taken (deprecation
      // is a durable owner/dream decision; only a deliberate awake save or an owner
      // restore revives — the autonomous writer is held to the stricter rule).
      const seen = new Set<string>();
      for (const item of [...news, ...merges]) {
        if (seen.has(item.name)) {
          return ['failed', `duplicate name "${item.name}" in one patch`];
        }
        seen.add(item.name);
      }
      for (const n of news) {
        const existing = getSkill(n.name);
        if (existing) {
          return [
            'failed',
            existing.deprecated_ms === 0
              ? `new "${n.name}" collides with an active skill (must be a merge)`
              : `new "${n.name}" collides with a deprecated skill (the dream may not revive it)`,
          ];
        }
      }
      for (const m of merges) {
        const target = getSkill(m.name);
        if (!target) return ['failed', `merge target "${m.name}" does not exist`];
        if (target.deprecated_ms > 0) {
          return ['failed', `merge target "${m.name}" is deprecated (the dream may not revive it)`];
        }
      }
      const staleNames = new Set(stale.map((k) => k.name));
      for (const d of deprecates) {
        if (!staleNames.has(d)) return ['failed', `deprecate "${d}" is not a stale candidate`];
      }

      // Caps in code, never prompt-trust: at most LUNA_DREAM_SKILLS_MAX writes per
      // cycle (merges first — refining beats adding), at most one deprecation.
      // Drops are named in the detail string (no silent truncation). NaN-guarded
      // like shelfMax — Math.max(1, NaN) is NaN and slice(0, NaN) silently applies
      // ZERO writes while reporting ok (review finding).
      const maxRaw = Number(Bun.env['LUNA_DREAM_SKILLS_MAX']);
      const maxWrites = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : 2;
      const writes = [
        ...merges.map((item) => ({ kind: 'merge', item })),
        ...news.map((item) => ({ kind: 'new', item })),
      ];
      const now = Date.now();
      const applied: string[] = [];
      for (const w of writes.slice(0, maxWrites)) {
        saveSkill(w.item, now, 'dream');
        applied.push(`${w.kind}:${w.item.name}`);
      }
      if (deprecates.length > 0 && deprecateSkill(deprecates[0]!, now, 'dream')) {
        applied.push(`deprecate:${deprecates[0]}`);
      }
      const droppedWrites = Math.max(0, writes.length - maxWrites);
      const droppedDeps = Math.max(0, deprecates.length - 1);
      const dropNote =
        droppedWrites > 0 || droppedDeps > 0
          ? ` (over cap: dropped ${droppedWrites} write(s), ${droppedDeps} deprecation(s))`
          : '';
      return ['ok', `${applied.join(', ')}${dropNote}`];
    }),

  rag_refresh: (s) =>
    runStep(s, 'rag_refresh', async () => {
      const db = getMemoryDb();
      if (!db || !embeddingEnabled()) return ['skipped', 'embedding disabled'];
      const texts = new Set<string>();
      for (const r of listL2(s.sessionId)) texts.add(`${r.user_text}\n${r.assistant_text}`);
      for (const f of listFacts()) texts.add(f.text);
      const diaryRows = db.prepare('SELECT text FROM diaries').all() as { text: string }[];
      for (const d of diaryRows) texts.add(d.text);
      // v0.32.1: skills join the pre-warm — same skillEmbedText the candidate loop
      // uses, and the same mount gate (no paid embeddings for texts recall will
      // never read in a skills-off boot).
      if (skillsRecallMounted()) for (const sk of listSkills(500)) texts.add(skillEmbedText(sk));

      // v0.32.1 FIX: key by embedCacheKey (model-namespaced), matching what retrieve()
      // reads/writes — the pre-warm had keyed by contentHash since v0.20.5 split the
      // two, so every warmed vector was unreadable by recall (dead work).
      const all = [...texts];
      const missing = all.filter(
        (t) => !db.prepare('SELECT 1 FROM embeddings_cache WHERE hash = ?').get(embedCacheKey(t)),
      );
      if (missing.length === 0) return ['skipped', `cache warm (${all.length} texts)`];

      const vecs = await s.embedClient(missing);
      const insert = db.prepare(
        'INSERT INTO embeddings_cache (hash, dim, embedding) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING',
      );
      vecs.forEach((v, i) => {
        const blob = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        insert.run(embedCacheKey(missing[i]!), v.length, blob);
      });
      return ['ok', `misses_before=${missing.length} filled=${vecs.length} after=0`];
    }),
};

export type StartDreamResult = { ok: true; cycleId: string } | { ok: false; error: string };

export async function runDreamCycle(opts: {
  sessionId: string;
  llm: DreamLLM;
  emit: (e: ServerEvent) => void;
  embedClient?: EmbedClient;
}): Promise<StartDreamResult> {
  const entered = enterDream();
  if (!entered.ok) return { ok: false, error: entered.error };

  const db = getMemoryDb();
  const startedMs = Date.now();
  const state: DreamCycleState = {
    cycleId: entered.cycleId,
    sessionId: opts.sessionId,
    llm: opts.llm,
    embedClient: opts.embedClient ?? fetchEmbedClient,
    emit: opts.emit,
    steps: [],
  };

  db?.prepare(
    'INSERT INTO dream_reports (cycle_id, started_ms, ended_ms, report_json) VALUES (?, ?, NULL, ?)',
  ).run(entered.cycleId, startedMs, JSON.stringify({ steps: [] }));

  try {
    await runGraph(dreamGraph, 'rate_salience', state);
  } finally {
    db?.prepare('UPDATE dream_reports SET ended_ms = ?, report_json = ? WHERE cycle_id = ?').run(
      Date.now(),
      JSON.stringify({ steps: state.steps }),
      entered.cycleId,
    );
    parkFinishedIdle();
    state.emit({
      type: 'dream.status',
      is_dreaming: true,
      current_step: 'finished_idle',
      last_dream_ms: Date.now(),
    });
  }
  return { ok: true, cycleId: entered.cycleId };
}
