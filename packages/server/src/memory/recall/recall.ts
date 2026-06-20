import { getMemoryDb, listRecentL2 } from '../sessionStore';
import { listFacts } from '../l3Store';
import { listRecentDiaries } from '../diaries';
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

const RETRIEVAL_K = Number(Bun.env['LUNA_MEMORY_RETRIEVAL_K'] ?? 12);
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

export type Hit = {
  source: 'l2' | 'l3' | 'diary';
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
  source: 'l2' | 'l3' | 'diary';
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
  // v0.17.1: diaries are now recall candidates — their rag_refresh embeddings
  // (keyed by contentHash(text)) finally become retrievable (fixes the dead-work
  // finding); hash is computed on the fly like L3.
  for (const d of listRecentDiaries(DIARY_CANDIDATE_LIMIT)) {
    out.push({
      source: 'diary',
      id: `${d.kind}:${d.period_key}`,
      text: d.text,
      t_ms: d.generated_ms,
      importance: DIARY_IMPORTANCE,
    });
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
  opts?: { k?: number; embedBudgetMs?: number; sources?: ReadonlyArray<'l2' | 'l3' | 'diary'> },
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
    // normalize back to ~0–1 so the floor + downstream consumers are weight-stable
    const score =
      (W_RECENCY * recencyScore(c.t_ms, now) + W_IMPORTANCE * c.importance + W_RELEVANCE * rel) /
      sumW;
    return { source: c.source, id: c.id, text: c.text, t_ms: c.t_ms, score };
  });

  return hits
    .filter((h) => h.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// v0.19.1 (Initiative 12, B): under LUNA_RECALL_TIME_LABELS, tag each recalled
// candidate with a TS-computed relative-time label and present the selected set
// in chronological order (oldest→newest) — the true fix for the "yesterday" drift
// (a dating-a-past-event error). Selection stays by the GA score (untouched); this
// is presentation only. Flag off → byte-identical to before.
export function renderRecallBlock(hits: Hit[], nowMs = Date.now()): string | null {
  if (hits.length === 0) return null;
  const clip = (t: string): string => t.replace(/\n+/g, ' / ').slice(0, 300);
  // Default ON since v0.19.2; LUNA_RECALL_TIME_LABELS=0 opts out.
  if (Bun.env['LUNA_RECALL_TIME_LABELS'] === '0') {
    const lines = hits.map((h) => `- ${clip(h.text)}`);
    return `<memory>\nThings you might be remembering right now (from past conversations and notes):\n${lines.join('\n')}\n</memory>`;
  }
  const ordered = [...hits].sort((a, b) => a.t_ms - b.t_ms); // oldest → newest for display
  const lines = ordered.map((h) => `- [${relativeLabel(h.t_ms, nowMs)}] ${clip(h.text)}`);
  return `<memory>\nThings you might be recalling (each tagged with when it happened — trust these, don't recompute):\n${lines.join('\n')}\n</memory>`;
}
