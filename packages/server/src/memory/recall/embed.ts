const EMBED_BATCH = 64;

export type EmbedClient = (texts: string[]) => Promise<Float32Array[]>;

export function embeddingEnabled(): boolean {
  return Bun.env['LUNA_MEMORY_EMBEDDING'] !== '0' && !!Bun.env['LUNA_EMBEDDING_API_KEY'];
}

// Minimal fetch client against an OpenAI-compatible /v1/embeddings endpoint.
// Deliberately NOT the cut openai_compat adapter (that cut targeted the chat
// provider path) — chat stays on the Anthropic SDK; embeddings have no
// Anthropic API, so this thin client is the whole integration.
export const fetchEmbedClient: EmbedClient = async (texts) => {
  const base = (Bun.env['LUNA_EMBEDDING_BASE_URL'] ?? Bun.env['OPENAI_BASE_URL'] ?? '').replace(
    /\/$/,
    '',
  );
  const model = Bun.env['LUNA_EMBEDDING_MODEL'] ?? 'text-embedding-3-large';
  const key = Bun.env['LUNA_EMBEDDING_API_KEY'] ?? '';

  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const res = await fetch(`${base}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) {
      throw new Error(`embeddings endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...body.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(new Float32Array(item.embedding));
  }
  return out;
};

export function toBlob(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function fromBlob(blob: Uint8Array): Float32Array {
  // C4 (v0.16.0): a Float32Array view requires a 4-byte-aligned byteOffset; a
  // BLOB read from SQLite is not guaranteed to be aligned. If it isn't, copy the
  // bytes into a fresh (aligned) buffer instead of throwing a RangeError.
  if (blob.byteOffset % 4 === 0) {
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
  }
  return new Float32Array(blob.slice().buffer);
}

export function contentHash(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

function embeddingModel(): string {
  return Bun.env['LUNA_EMBEDDING_MODEL'] ?? 'text-embedding-3-large';
}

// Embedding-cache key: the content hash NAMESPACED by the embedding model, so a
// LUNA_EMBEDDING_MODEL swap (and thus a possible dimension change) re-embeds
// instead of reusing a stale-dim vector. Deliberately distinct from contentHash,
// which also keys L2/L3 row content_hash columns — mutating that would force a
// cache miss on every row, not just embeddings.
export function embedCacheKey(text: string): string {
  return contentHash(`${embeddingModel()}\n${text}`);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  // Length guard: a dimension mismatch (e.g. a model swap left stale-dim vectors)
  // would otherwise read past the shorter array → NaN (dim increase) or a
  // finite-but-wrong partial cosine (dim decrease). Treat it as a non-match.
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
