import { getMemoryDb, listRecentL2 } from '../sessionStore';
import { listFacts } from '../l3Store';
import { listRecentDiaries } from '../diaries';
import { listSkills, skillEmbedText, skillsRecallMounted } from '../../skills/skillStore';
import { relativeLabel } from '../../turn/temporalContext';
import {
  cosine,
  embedCacheKey,
  embeddingEnabled,
  fetchEmbedClient,
  fromBlob,
  toBlob,
  type EmbedClient,
} from './embed';
import { lexicalScore } from './lexical';

const RETRIEVAL_K = Number(Bun.env['LUNA_MEMORY_RETRIEVAL_K'] ?? 18);
// Relevance floor (v0.34.11): the top LUNA_RECALL_FLOOR_N candidates by PURE cosine (≥
// LUNA_RECALL_FLOOR_MIN_COS) are guaranteed a slot regardless of recency. The GA recency term
// otherwise dominates — an 8-day-old turn's recency 1/(1+8)≈0.11 vs a fresh ~1.0 swamps a modest
// cosine edge, so a decisively-relevant OLD memory ranks far below k. This is the retrieve-then-rerank
// guarantee: it kicks in ONLY when a high-cosine old memory would be buried (for a normal query the
// top-cosine candidates are already the recent ones → no-op), and no-ops when cosine is unavailable.
// Both knobs are read per-call (below) so a live tune / a test takes effect without a restart.
// Caps the cold-cache embedding work a single turn may do; the rest of the
// candidates fall back to lexical-only for this turn. Dream's rag_refresh
// (v0.5.0) is the bulk pre-warmer.
const MAX_EMBED_PER_TURN = 64;
const L2_CANDIDATE_LIMIT = 500;
const DIARY_CANDIDATE_LIMIT = Number(Bun.env['LUNA_DIARY_CANDIDATE_LIMIT'] ?? 30);

// v0.17.1: Generative-Agents recall score = α·recency + β·importance + γ·relevance
// (Park et al.). Weights default to the GA baseline (equal); tune via env.
const W_RECENCY = Number(Bun.env['LUNA_RECALL_W_RECENCY'] ?? 1);
const W_IMPORTANCE = Number(Bun.env['LUNA_RECALL_W_IMPORTANCE'] ?? 1);
const W_RELEVANCE = Number(Bun.env['LUNA_RECALL_W_RELEVANCE'] ?? 1);
// Default normalized importance for candidates without a per-turn salience score.
const DEFAULT_IMPORTANCE = 0.4;
const DIARY_IMPORTANCE = 0.7; // diaries are distilled summaries — inherently salient
// v0.32.1: a skill exists BECAUSE it proved reusable — slightly above diary.
const SKILL_IMPORTANCE = 0.75;
const SKILL_CANDIDATE_LIMIT = 500;
// Skills are RELEVANCE-GATED into recall (review fix): without this, a fresh skill
// scored (recency 1.0 + importance 0.75 + 0)/3 = 0.58 with ZERO query relevance —
// outranking genuinely relevant older memories and flooding the k=12 hot-path block
// after a save burst. A skill hit requires real signal: token overlap (lex > 0) or
// a cosine at least this high (paraphrase reach; env-tunable for embedding spaces
// with a high unrelated-pair baseline).
const SKILL_MIN_COS = Number(Bun.env['LUNA_SKILL_RECALL_MIN_COS'] ?? 0.5);

export type RecallSource = 'l2' | 'l3' | 'diary' | 'skills';

export type Hit = {
  source: RecallSource;
  id: string;
  text: string;
  score: number;
  t_ms: number;
};

let embedClient: EmbedClient = fetchEmbedClient;

export function setEmbedClientForTests(client: EmbedClient | null): void {
  embedClient = client ?? fetchEmbedClient;
}

function cachedEmbedding(hash: string): Float32Array | null {
  const db = getMemoryDb();
  if (!db) return null;
  const row = db.prepare('SELECT embedding FROM embeddings_cache WHERE hash = ?').get(hash) as {
    embedding: Uint8Array;
  } | null;
  return row ? fromBlob(row.embedding) : null;
}

function storeEmbedding(hash: string, vec: Float32Array): void {
  const db = getMemoryDb();
  if (!db) return;
  db.prepare(
    'INSERT INTO embeddings_cache (hash, dim, embedding) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING',
  ).run(hash, vec.length, toBlob(vec));
}

// D1 (v0.16.2): the `vec0`/`vec_cache` virtual table was written on every
// embedding store but NEVER queried — retrieval is (and stays) the TS cosine in
// `retrieve()` below. That dead write path + the orphaned virtual table are
// removed. The `sqlite-vec` dependency + the boot-time extension loader are kept
// inert because Initiative 10's larger corpus (a ~100-turn window + diary
// candidates) may wire a real vec0 KNN there; the full dep decision is deferred
// to that joint call rather than removed-then-readded.

// Kept as a no-op for the test API (callers reset recall state between cases).
export function resetRecallStateForTests(): void {}

// ── retrieval ─────────────────────────────────────────────────────────────────

// `importance` is the 0–1 normalized salience used by the GA recall score (v0.17.1).
type Candidate = {
  source: RecallSource;
  id: string;
  text: string;
  t_ms: number;
  importance: number;
};

// Normalize a 1–5 turn salience score to 0–1; unrated → DEFAULT_IMPORTANCE.
function imp01(score: number | null): number {
  return score == null ? DEFAULT_IMPORTANCE : Math.min(1, Math.max(0, (score - 1) / 4));
}

function collectCandidates(sessionId: string): Candidate[] {
  const out: Candidate[] = [];
  // A2: fetch only the most-recent L2_CANDIDATE_LIMIT rows (was: pull up to
  // 10 000 then slice the last 500).
  for (const row of listRecentL2(sessionId, L2_CANDIDATE_LIMIT)) {
    out.push({
      source: 'l2',
      id: String(row.id),
      text: `${row.user_text}\n${row.assistant_text}`,
      t_ms: row.t_ms,
      importance: imp01(row.importance),
    });
  }
  for (const fact of listFacts()) {
    out.push({
      source: 'l3',
      id: fact.id,
      text: fact.text,
      t_ms: fact.created_ms,
      importance: DEFAULT_IMPORTANCE,
    });
  }
  // v0.17.1: diaries are recall candidates. (rag_refresh pre-warms their vectors —
  // keyed by embedCacheKey since v0.32.1, matching what scoreCosine reads.)
  for (const d of listRecentDiaries(DIARY_CANDIDATE_LIMIT)) {
    out.push({
      source: 'diary',
      id: `${d.kind}:${d.period_key}`,
      text: d.text,
      t_ms: d.generated_ms,
      importance: DIARY_IMPORTANCE,
    });
  }
  // v0.32.1 (Initiative 23): active skills surface by MEANING in recall — the
  // candidate text is name+description (the retrieval key, never the body; the L1
  // clause routes her to recall_skill for the full procedure). Gated on the
  // boot-frozen mount truth (set by main.ts beside the registry composition), so a
  // live LUNA_SKILLS pin can never surface pointers to an unmounted recall_skill.
  // t_ms is created_ms — when she LEARNED it (verified_ms is a maintenance stamp a
  // re-verify moves, which would lie in the "when it happened" recall label).
  if (skillsRecallMounted()) {
    for (const s of listSkills(SKILL_CANDIDATE_LIMIT)) {
      out.push({
        source: 'skills',
        id: `skill:${s.name}`,
        text: skillEmbedText(s),
        t_ms: s.created_ms,
        importance: SKILL_IMPORTANCE,
      });
    }
  }
  return out;
}

// Recency as a 0–1 decay over age in days (GA recency term).
function recencyScore(tMs: number, now: number): number {
  const ageDays = Math.max(0, (now - tMs) / 86_400_000);
  return 1 / (1 + ageDays);
}

export async function retrieve(
  sessionId: string,
  query: string,
  // P1 (v0.16.1): embedBudgetMs bounds the embedding network work so a cold
  // cache can't block the caller (the hot-path auto-recall) past the budget —
  // on timeout the turn scores lexical-only. Set by parse_input under
  // LUNA_RECALL_ASYNC; the agentic recall tool leaves it unset (full embed).
  // `sources` (v0.20.5) filters candidates BEFORE ranking so the k limit applies
  // per-scope — the agentic recall tool passes it for scoped queries so a burst of
  // recent off-scope rows can't starve the wanted source out of the top-k. Default
  // (undefined) = all sources → the hot-path auto-injection is byte-identical.
  opts?: { k?: number; embedBudgetMs?: number; sources?: ReadonlyArray<RecallSource> },
): Promise<Hit[]> {
  const k = opts?.k ?? RETRIEVAL_K;
  const all = collectCandidates(sessionId);
  const candidates = opts?.sources ? all.filter((c) => opts.sources!.includes(c.source)) : all;
  if (candidates.length === 0) return [];
  const now = Date.now();

  const lexScores = candidates.map((c) => lexicalScore(query, c.text));

  const nullScores = (): (number | null)[] => candidates.map(() => null);

  // Cosine scoring against the embedding cache (may make 1–2 network calls on a
  // cold cache). Returns all-null on any failure → lexical-only fallback.
  const scoreCosine = async (): Promise<(number | null)[]> => {
    try {
      const queryHash = embedCacheKey(query);
      let queryVec = cachedEmbedding(queryHash);
      if (!queryVec) {
        const [v] = await embedClient([query]);
        if (v) {
          storeEmbedding(queryHash, v);
          queryVec = v;
        }
      }
      if (!queryVec) return nullScores();
      // Embedding-cache keys are model-namespaced (v0.20.5), so a model swap
      // re-embeds rather than reusing a stale-dim vector. (The stored L2
      // content_hash is content-only and no longer doubles as the embed key.)
      const hashes = candidates.map((c) => embedCacheKey(c.text));
      const vecs: (Float32Array | null)[] = hashes.map((h) => cachedEmbedding(h));

      const missingIdx = vecs
        .map((v, i) => (v === null ? i : -1))
        .filter((i) => i >= 0)
        .slice(0, MAX_EMBED_PER_TURN);
      if (missingIdx.length > 0) {
        const fresh = await embedClient(missingIdx.map((i) => candidates[i]!.text));
        fresh.forEach((v, j) => {
          const idx = missingIdx[j]!;
          storeEmbedding(hashes[idx]!, v);
          vecs[idx] = v;
        });
      }
      // Length guard: a stale-dim cached vec scores as a non-match, not NaN.
      return vecs.map((v) => (v && v.length === queryVec!.length ? cosine(queryVec!, v) : null));
    } catch {
      return nullScores();
    }
  };

  let cosScores: (number | null)[] = nullScores();
  if (embeddingEnabled() && getMemoryDb()) {
    if (opts?.embedBudgetMs && opts.embedBudgetMs > 0) {
      // The losing (still-running) scoreCosine keeps populating the cache for
      // the next turn; this turn proceeds lexical-only past the budget.
      cosScores = await Promise.race([
        scoreCosine(),
        new Promise<(number | null)[]>((r) =>
          setTimeout(() => r(nullScores()), opts.embedBudgetMs),
        ),
      ]);
    } else {
      cosScores = await scoreCosine();
    }
  }

  // v0.17.1: Generative-Agents ranking — α·recency + β·importance + γ·relevance.
  // relevance is the existing cosine/lexical blend (clamped 0–1); recency and
  // importance are 0–1. Equal weights by default (GA baseline); tune via env
  // (lower W_RECENCY/W_IMPORTANCE if recall surfaces too much recent/salient-but-
  // off-topic material).
  const sumW = W_RECENCY + W_IMPORTANCE + W_RELEVANCE || 1;
  const hits: Hit[] = candidates.map((c, i) => {
    const lex = lexScores[i]!;
    const cos = cosScores[i];
    const blended = cos !== null && cos !== undefined ? 0.7 * cos + 0.3 * lex : lex;
    const rel = Math.min(1, Math.max(0, blended));
    // v0.32.1 (review fix): a skill is a PROCEDURAL pointer, not an episode — it
    // enters recall only on real relevance signal, and its created_ms is metadata,
    // not an event time, so the recency term is zeroed (same denominator, so
    // dropping the term is never an advantage). Kills the save-burst flood and the
    // re-verify recency-renewal vector.
    if (c.source === 'skills') {
      const eligible = lex > 0 || (cos !== null && cos !== undefined && cos >= SKILL_MIN_COS);
      const score = eligible ? (W_IMPORTANCE * c.importance + W_RELEVANCE * rel) / sumW : 0;
      return { source: c.source, id: c.id, text: c.text, t_ms: c.t_ms, score };
    }
    // normalize back to ~0–1 so the floor + downstream consumers are weight-stable
    const score =
      (W_RECENCY * recencyScore(c.t_ms, now) + W_IMPORTANCE * c.importance + W_RELEVANCE * rel) /
      sumW;
    return { source: c.source, id: c.id, text: c.text, t_ms: c.t_ms, score };
  });

  const eligible = hits
    .map((h, i) => ({ h, cos: cosScores[i] }))
    .filter((x) => x.h.score > 0.05);
  const byScore = [...eligible].sort((a, b) => b.h.score - a.h.score).map((x) => x.h);

  // Relevance floor: the top floorN by pure cosine (≥ floorMinCos) are guaranteed ahead of the
  // recency-blended fill, so a decisively-relevant old memory isn't dropped below k. All-null cosine
  // (embedding off / budget timeout) → empty floor → byScore only (byte-identical to the prior path).
  const floorN = Number(Bun.env['LUNA_RECALL_FLOOR_N'] ?? 3);
  const floorMinCos = Number(Bun.env['LUNA_RECALL_FLOOR_MIN_COS'] ?? 0.35);
  const floor: Hit[] =
    floorN > 0
      ? eligible
          .filter((x): x is { h: Hit; cos: number } => typeof x.cos === 'number' && x.cos >= floorMinCos)
          .sort((a, b) => b.cos - a.cos)
          .slice(0, floorN)
          .map((x) => x.h)
      : [];

  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const h of [...floor, ...byScore]) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push(h);
    if (out.length >= k) break;
  }
  return out;
}

// v0.19.1 (Initiative 12, B): under LUNA_RECALL_TIME_LABELS, tag each recalled
// candidate with a TS-computed relative-time label and present the selected set
// in chronological order (oldest→newest) — the true fix for the "yesterday" drift
// (a dating-a-past-event error). Selection stays by the GA score (untouched); this
// is presentation only. Flag off → byte-identical to before.
export function renderRecallBlock(hits: Hit[], nowMs = Date.now()): string | null {
  if (hits.length === 0) return null;
  // v0.27.5: neutralize any literal <memory>/</memory> in stored text so a
  // retrieved line can't close the fence early (then the rest of the block +
  // the user message would read as un-fenced top-level content). Collapse
  // newlines, then clip.
  const clip = (t: string): string =>
    t
      .replace(/\n+/g, ' / ')
      .replace(/<\/?memory\s*>/gi, (m) => m.replace(/[<>]/g, ''))
      .slice(0, 300);
  // v0.27.5: a shared "you were handed this, you didn't recall it" framing —
  // honors the persona's told-vs-remembered seam (default.md Memory Condition),
  // so injected memory isn't presented as firsthand recollection.
  const LEAD =
    'From your memory — surfaced by the system from past conversations and notes; ' +
    'real context, but you were handed it, not recalling it fresh';
  // Default ON since v0.19.2; LUNA_RECALL_TIME_LABELS=0 opts out.
  if (Bun.env['LUNA_RECALL_TIME_LABELS'] === '0') {
    const lines = hits.map((h) => `- ${clip(h.text)}`);
    return `<memory>\n${LEAD}:\n${lines.join('\n')}\n</memory>`;
  }
  const ordered = [...hits].sort((a, b) => a.t_ms - b.t_ms); // oldest → newest for display
  const lines = ordered.map((h) => `- [${relativeLabel(h.t_ms, nowMs)}] ${clip(h.text)}`);
  // The trust clause is scoped to the [bracket] TIME LABEL (TS-computed), not the
  // recalled content — she should still correct a past error, just not recompute
  // the timing.
  return `<memory>\n${LEAD}. Each [bracket] tag is when it happened — trust the timing, don't recompute it:\n${lines.join('\n')}\n</memory>`;
}
