// Normalized string similarity in [0,1] (1 = identical) via Levenshtein edit
// distance over the longer string. Used by the dream's persona step (v0.21.7) to
// drop a near-identical core-memory rewrite — the model tends to re-emit prose that
// is ~97% the same instead of returning null, which would otherwise churn the audit
// log + cache epoch every dream. Cheap: runs once per dream on two ≤400-char fields.
export function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  // Two-row DP. Both rows are fully populated each pass, so the `?? 0` reads below
  // only satisfy noUncheckedIndexedAccess (every index is in-bounds); values fit in
  // u32 easily (fields are ≤400 chars).
  const n = b.length;
  let prev = new Uint32Array(n + 1);
  let curr = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}
