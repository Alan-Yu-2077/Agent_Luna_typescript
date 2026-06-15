// Humanity hard caps — ported from Python humanity_rules.json. TS code is the
// config (no JSON file). v0.6.0 states them as prompt guidance; v0.6.1 turns
// them into Zod schema on the message tool input (the actual enforcement).
//
// All three caps are English-tuned (v0.13.12). The Python originals were CJK-tuned
// (1 char ≈ 1 morpheme); English packs ~4–5 chars per word, so the CJK numbers
// rejected most natural English replies and triggered validation retry-storms (the
// "超限率太高" report). These values keep Luna "a spoken presence, not an essay"
// — a few short sentences — while letting natural English through without a fight.
export const MAX_CHARS = 280; // ~50 words total — a long text message, not a paragraph
export const MAX_SENTENCES = 5; // one thought at a time, with a little headroom
export const MAX_CLAUSE_CHARS = 150; // ~25 words — a long spoken clause, still not a run-on

// Python: re.split(r"[。！？!?]+|\n+") — CJK sentence punctuation + ASCII !? +
// newlines, consecutive marks collapse into one boundary.
export function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?]+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Python split only on clause punctuation [，,；;：:], which let "a。b" count as
// one clause. We also break on sentence punctuation — a clause never spans a
// sentence boundary (strictly-more-correct port, noted in the v0.6.0 plan).
export function splitClauses(text: string): string[] {
  return text
    .split(/[，,；;：:。！？!?]+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function longestClauseLength(text: string): number {
  return splitClauses(text).reduce((max, c) => Math.max(max, c.length), 0);
}

export function renderHumanityBlock(): string {
  return (
    'How you speak: like a real spoken presence, not an essay and not a service desk. ' +
    `HARD LIMITS for every reply: at most ${MAX_CHARS} characters in total, at most ` +
    `${MAX_SENTENCES} sentences, and no single clause longer than ${MAX_CLAUSE_CHARS} characters. ` +
    'No lists, no headings, no markdown formatting in replies. One thought at a time.'
  );
}
