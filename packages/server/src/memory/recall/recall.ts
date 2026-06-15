import { getMemoryDb, listRecentL2 } from '../sessionStore';
import { listFacts } from '../l3Store';
import {
  contentHash,
  cosine,
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

export type Hit = {
  source: 'l2' | 'l3';
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

// `hash` carries the stored content_hash for L2 rows (A2, v0.16.1) so retrieve()
// reuses it instead of re-hashing; undefined → hashed on the fly (L3 facts, and
// pre-v0.16.1 L2 rows whose column is null).
type Candidate = { source: 'l2' | 'l3'; id: string; text: string; t_ms: number; hash?: string };

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
      ...(row.content_hash ? { hash: row.content_hash } : {}),
    });
  }
  for (const fact of listFacts()) {
    out.push({ source: 'l3', id: fact.id, text: fact.text, t_ms: fact.created_ms });
  }
  return out;
}

function recencyBoost(tMs: number, now: number): number {
  const ageDays = Math.max(0, (now - tMs) / 86_400_000);
  return 0.1 / (1 + ageDays);
}

export async function retrieve(
  sessionId: string,
  query: string,
  // P1 (v0.16.1): embedBudgetMs bounds the embedding network work so a cold
  // cache can't block the caller (the hot-path auto-recall) past the budget —
  // on timeout the turn scores lexical-only. Set by parse_input under
  // LUNA_RECALL_ASYNC; the agentic recall tool leaves it unset (full embed).
  opts?: { k?: number; embedBudgetMs?: number },
): Promise<Hit[]> {
  const k = opts?.k ?? RETRIEVAL_K;
  const candidates = collectCandidates(sessionId);
  if (candidates.length === 0) return [];
  const now = Date.now();

  const lexScores = candidates.map((c) => lexicalScore(query, c.text));

  const nullScores = (): (number | null)[] => candidates.map(() => null);

  // Cosine scoring against the embedding cache (may make 1–2 network calls on a
  // cold cache). Returns all-null on any failure → lexical-only fallback.
  const scoreCosine = async (): Promise<(number | null)[]> => {
    try {
      const queryHash = contentHash(query);
      let queryVec = cachedEmbedding(queryHash);
      if (!queryVec) {
        const [v] = await embedClient([query]);
        if (v) {
          storeEmbedding(queryHash, v);
          queryVec = v;
        }
      }
      if (!queryVec) return nullScores();
      // A2: reuse the stored content_hash where present (L2); hash on the fly
      // only for L3 facts and pre-v0.16.1 rows.
      const hashes = candidates.map((c) => c.hash ?? contentHash(c.text));
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
      return vecs.map((v) => (v ? cosine(queryVec!, v) : null));
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
        new Promise<(number | null)[]>((r) => setTimeout(() => r(nullScores()), opts.embedBudgetMs)),
      ]);
    } else {
      cosScores = await scoreCosine();
    }
  }

  const hits: Hit[] = candidates.map((c, i) => {
    const lex = lexScores[i]!;
    const cos = cosScores[i];
    const base = cos !== null && cos !== undefined ? 0.7 * cos + 0.3 * lex : lex;
    return { ...c, score: base + recencyBoost(c.t_ms, now) };
  });

  return hits
    .filter((h) => h.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function renderRecallBlock(hits: Hit[]): string | null {
  if (hits.length === 0) return null;
  const lines = hits.map((h) => `- ${h.text.replace(/\n+/g, ' / ').slice(0, 300)}`);
  return `<memory>\nThings you might be remembering right now (from past conversations and notes):\n${lines.join('\n')}\n</memory>`;
}
