import type { DreamStepStatus, ServerEvent } from '@luna/protocol';
import { runGraph, type Graph } from '../turn/graph';
import { getMemoryDb, listL2, listUnratedL2, setImportance } from '../memory/sessionStore';
import { addFact, forgetFact, listFacts } from '../memory/l3Store';
import { getCore, updateCore } from '../memory/coreMemory';
import { maybeFold } from '../memory/l1Window';
import { getSession } from '../turn/session';
import {
  contentHash,
  embeddingEnabled,
  fetchEmbedClient,
  type EmbedClient,
} from '../memory/recall/embed';
import { trace, flushTrace, traceEnabled } from '../trace/instrument';
import { enterDream, parkFinishedIdle, setStep } from './dreamState';
import {
  dreamCall,
  parseJsonBlock,
  MemoryPatch,
  PersonaPatch,
  SaliencePatch,
  type DreamLLM,
} from './llm';
import {
  diaryPrompt,
  memoryAuditPrompt,
  personaUpdatePrompt,
  refineSemanticPrompt,
  saliencePrompt,
} from './prompts';

const MAX_DIARIES_PER_CYCLE = Number(Bun.env['LUNA_DREAM_MAX_DIARIES_PER_CYCLE'] ?? 20);
const RECENT_DIALOGUE_TURNS = 30;
const MAX_SALIENCE_PER_CYCLE = Number(Bun.env['LUNA_DREAM_MAX_SALIENCE_PER_CYCLE'] ?? 40);

export type DreamNode =
  | 'rate_salience'
  | 'refine_semantic'
  | 'refine_layer1'
  | 'memory_audit'
  | 'persona_update'
  | 'run_diaries'
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
      const core = getCore();
      const call = await dreamCall(
        s.llm,
        personaUpdatePrompt(core.self_state, core.relationship_status, dialogue),
      );
      if (!call.ok) return ['failed', `${call.failure}: ${call.detail}`];
      const patch = parseJsonBlock(PersonaPatch, call.text);
      if (!patch) return ['failed', 'unparseable persona patch'];
      const update: { self_state?: string; relationship_status?: string } = {};
      if (patch.self_state) update.self_state = patch.self_state;
      if (patch.relationship_status) update.relationship_status = patch.relationship_status;
      if (Object.keys(update).length === 0) return ['skipped', 'persona unchanged'];
      updateCore(update, 'dream');
      return ['ok', Object.keys(update).join('+')];
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
      // v0.17.3 (option 2): today's day-diary is rewritten on every dream, so a
      // dream during the day captures the whole day so far instead of freezing it
      // at the first dream (the old INSERT OR IGNORE lost everything after a noon
      // dream). Past days stay write-once — they are complete and immutable.
      // "Today" is the same UTC calendar key the rows are grouped under above.
      const upsertDiary = db.prepare(
        `INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, period_key) DO UPDATE SET text = excluded.text, generated_ms = excluded.generated_ms`,
      );
      const todayKey = new Date(Date.now()).toISOString().slice(0, 10);
      let written = 0;

      for (const [day, pieces] of [...byDay.entries()].sort()) {
        if (written >= MAX_DIARIES_PER_CYCLE) break;
        const isToday = day === todayKey;
        if (!isToday && hasDiary.get('day', day)) continue;
        const call = await dreamCall(s.llm, diaryPrompt('day', day, pieces.join('\n\n')), 1400);
        if (!call.ok) return ['failed', `day ${day}: ${call.failure}: ${call.detail}`];
        (isToday ? upsertDiary : insertDiary).run('day', day, call.text.trim(), Date.now());
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

  rag_refresh: (s) =>
    runStep(s, 'rag_refresh', async () => {
      const db = getMemoryDb();
      if (!db || !embeddingEnabled()) return ['skipped', 'embedding disabled'];
      const texts = new Set<string>();
      for (const r of listL2(s.sessionId)) texts.add(`${r.user_text}\n${r.assistant_text}`);
      for (const f of listFacts()) texts.add(f.text);
      const diaryRows = db.prepare('SELECT text FROM diaries').all() as { text: string }[];
      for (const d of diaryRows) texts.add(d.text);

      const all = [...texts];
      const missing = all.filter(
        (t) => !db.prepare('SELECT 1 FROM embeddings_cache WHERE hash = ?').get(contentHash(t)),
      );
      if (missing.length === 0) return ['skipped', `cache warm (${all.length} texts)`];

      const vecs = await s.embedClient(missing);
      const insert = db.prepare(
        'INSERT INTO embeddings_cache (hash, dim, embedding) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING',
      );
      vecs.forEach((v, i) => {
        const blob = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        insert.run(contentHash(missing[i]!), v.length, blob);
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
