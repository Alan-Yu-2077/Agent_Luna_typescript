const STOP_TOKENS = new Set([
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'i', 'you', 'it',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'that', 'this', 'what', 'my',
  '的', '了', '是', '我', '你', '他', '她', '它', '在', '有', '和', '就',
  '不', '也', '吗', '吧', '呢', '啊', '那', '这',
]);

// ASCII words + CJK sliding bigrams — the tokenization that keeps Chinese
// recall robust without any segmenter dependency (ported approach from Python
// semantic_retrieval).
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();

  for (const m of lower.matchAll(/[a-z0-9]+/g)) {
    if (!STOP_TOKENS.has(m[0])) tokens.add(m[0]);
  }

  const cjk = lower.match(/[一-鿿぀-ヿ]+/g) ?? [];
  for (const run of cjk) {
    if (run.length === 1) {
      if (!STOP_TOKENS.has(run)) tokens.add(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      const bigram = run.slice(i, i + 2);
      tokens.add(bigram);
    }
  }
  return tokens;
}

export function lexicalScore(query: string, candidate: string): number {
  const q = tokenize(query);
  if (q.size === 0) return 0;
  const c = tokenize(candidate);
  let overlap = 0;
  for (const t of q) {
    if (c.has(t)) overlap += 1;
  }
  let score = overlap / q.size;
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length >= 2 && candidate.toLowerCase().includes(trimmed)) {
    score += 0.3;
  }
  return Math.min(score, 1);
}
