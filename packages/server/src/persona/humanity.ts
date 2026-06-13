// Humanity hard caps — ported from Python humanity_rules.json. TS code is the
// config (no JSON file). v0.6.0 states them as prompt guidance; v0.6.1 turns
// them into Zod schema on the message tool input (the actual enforcement).
export const MAX_CHARS = 140;
export const MAX_SENTENCES = 4;
export const MAX_CLAUSE_CHARS = 55;

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
