import { getMemoryDb, listL2 } from '../sessionStore';
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
import { tryLoadVec } from './vecRuntime';

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
  insertVec(hash, vec);
}

// ── vec0 fast path (proven by scripts/spike-sqlite-vec.ts) ───────────────────
// The vec0 virtual table is DERIVED data keyed to embeddings_cache.rowid —
// rebuildable, so it is created lazily at runtime rather than via the
// migration system (migrations must not depend on a loadable extension).
let vecReady: boolean | null = null;

function vecAvailable(): boolean {
  const db = getMemoryDb();
  if (!db) return false;
  if (vecReady !== null) return vecReady;
  if (!tryLoadVec(db)) {
    vecReady = false;
    return false;
  }
  try {
    const probe = db.prepare('SELECT dim FROM embeddings_cache LIMIT 1').get() as {
      dim: number;
    } | null;
    const dim = probe?.dim ?? 3072;
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_cache USING vec0(embedding float[${dim}])`);
    db.exec(
      `INSERT OR IGNORE INTO vec_cache (rowid, embedding)
       SELECT rowid, embedding FROM embeddings_cache WHERE dim = ${dim}`,
    );
    vecReady = true;
  } catch {
    vecReady = false;
  }
  return vecReady;
}

function insertVec(hash: string, vec: Float32Array): void {
  const db = getMemoryDb();
  if (!db || !vecAvailable()) return;
  try {
    const row = db.prepare('SELECT rowid FROM embeddings_cache WHERE hash = ?').get(hash) as {
      rowid: number;
    } | null;
    if (row) {
      db.prepare('INSERT OR IGNORE INTO vec_cache (rowid, embedding) VALUES (?, ?)').run(
        row.rowid,
        toBlob(vec),
      );
    }
  } catch {
    /* vec insert is an optimization; the BLOB cache row is the truth */
  }
}

export function resetRecallStateForTests(): void {
  vecReady = null;
}

// ── retrieval ─────────────────────────────────────────────────────────────────

type Candidate = { source: 'l2' | 'l3'; id: string; text: string; t_ms: number };

function collectCandidates(sessionId: string): Candidate[] {
  const out: Candidate[] = [];
  const l2 = listL2(sessionId);
  for (const row of l2.slice(-L2_CANDIDATE_LIMIT)) {
    out.push({
      source: 'l2',
      id: String(row.id),
      text: `${row.user_text}\n${row.assistant_text}`,
      t_ms: row.t_ms,
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
  opts?: { k?: number },
): Promise<Hit[]> {
  const k = opts?.k ?? RETRIEVAL_K;
  const candidates = collectCandidates(sessionId);
  if (candidates.length === 0) return [];
  const now = Date.now();

  const lexScores = candidates.map((c) => lexicalScore(query, c.text));

  let cosScores: (number | null)[] = candidates.map(() => null);
  if (embeddingEnabled() && getMemoryDb()) {
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
      if (queryVec) {
        const hashes = candidates.map((c) => contentHash(c.text));
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

        cosScores = vecs.map((v) => (v ? cosine(queryVec!, v) : null));
      }
    } catch {
      /* embedding outage → lexical-only this turn */
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
