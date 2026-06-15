// Shared edit core (Initiative 8, v0.15.1) — the matcher + unified-diff +
// CRLF-handling logic that `edit`, `multi_edit`, and `write_file` lean on.
//
// Ported from Python Luna `edit_file` (`filesystem.py:_find_edit_match`,
// `unified_diff_for_text`). Kept LLM-free and pure so the edit tools stay a thin
// I/O shell around tested string logic.

// --- CRLF handling -----------------------------------------------------------
//
// We normalize a file to LF before matching/replacing (so an `old_string` the
// model copied from a numbered LF read still matches a CRLF-on-disk file), then
// restore CRLF on write if the original used it. CRLF is therefore *preserved*
// end-to-end; the model never has to know the file's line ending.
export function usesCrlf(raw: string): boolean {
  return raw.includes('\r\n');
}

export function toLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function restoreEol(text: string, crlf: boolean): string {
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

// --- match (exact → whitespace-tolerant fuzzy) -------------------------------

export type MatchResult =
  | { found: true; matched: string; count: number; fuzzed: boolean }
  | { found: false };

// Find `oldText` in `content` (both LF-normalized). Exact substring first; on
// miss, a whitespace-tolerant line-window match (each line compared stripped) —
// the Python `_find_edit_match` port. `fuzzed` is true when the returned
// `matched` text is NOT a verbatim substring (i.e. only the stripped-line pass
// found it), so the caller can REPORT it (a silent wrong-fuzz is the dangerous
// case). `matched` is always a verbatim slice of `content`, safe to `replace`.
export function findEditMatch(content: string, oldText: string): MatchResult {
  if (oldText.length > 0 && content.includes(oldText)) {
    return { found: true, matched: oldText, count: countOccurrences(content, oldText), fuzzed: false };
  }

  const oldLines = oldText.split('\n');
  if (oldLines.length === 0) return { found: false };
  const strippedOld = oldLines.map((l) => l.trim());

  const contentLines = content.split('\n');
  const candidates: string[] = [];
  for (let i = 0; i + strippedOld.length <= contentLines.length; i++) {
    const window = contentLines.slice(i, i + strippedOld.length);
    if (window.map((l) => l.trim()).join('\n') === strippedOld.join('\n')) {
      candidates.push(window.join('\n'));
    }
  }
  if (candidates.length > 0) {
    // Dedup identical windows so the occurrence count matches what `replace` sees.
    const first = candidates[0]!;
    return { found: true, matched: first, count: countOccurrences(content, first), fuzzed: true };
  }
  return { found: false };
}

export function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// Replace the first (or all) occurrence(s) of `matched` with `replacement` in
// `content`. String `replace`/`replaceAll` would re-interpret `$` in the
// replacement; we splice by index instead so arbitrary code is inserted verbatim.
export function applyReplacement(
  content: string,
  matched: string,
  replacement: string,
  all: boolean,
): string {
  if (matched.length === 0) return content;
  if (!all) {
    const idx = content.indexOf(matched);
    if (idx === -1) return content;
    return content.slice(0, idx) + replacement + content.slice(idx + matched.length);
  }
  let out = '';
  let rest = content;
  let idx = rest.indexOf(matched);
  while (idx !== -1) {
    out += rest.slice(0, idx) + replacement;
    rest = rest.slice(idx + matched.length);
    idx = rest.indexOf(matched);
  }
  return out + rest;
}

// --- unified diff ------------------------------------------------------------

const DIFF_MAX_LINES = 400;

// A compact unified diff (LF-normalized inputs) via a Myers LCS. Used purely for
// the human-/model-readable `diff` field in every edit result — auditable change.
// Truncates to DIFF_MAX_LINES so a huge rewrite can't blow the tool result.
export function unifiedDiff(path: string, before: string, after: string): string {
  if (before === after) return '';
  const a = before.length === 0 ? [] : before.split('\n');
  const b = after.length === 0 ? [] : after.split('\n');
  const ops = diffLines(a, b);

  const out: string[] = [`--- ${path}`, `+++ ${path}`];
  let truncated = false;
  for (const op of ops) {
    if (out.length - 2 >= DIFF_MAX_LINES) {
      truncated = true;
      break;
    }
    if (op.kind === 'eq') out.push(` ${op.line}`);
    else if (op.kind === 'del') out.push(`-${op.line}`);
    else out.push(`+${op.line}`);
  }
  if (truncated) out.push(`@@ diff truncated at ${DIFF_MAX_LINES} lines @@`);
  return out.join('\n');
}

type DiffOp = { kind: 'eq' | 'del' | 'add'; line: string };

// Longest-common-subsequence line diff (DP table). Inputs are bounded by the
// truncation above + the file sizes we edit, so the O(n*m) table is fine.
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'eq', line: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ops.push({ kind: 'del', line: a[i]! });
      i++;
    } else {
      ops.push({ kind: 'add', line: b[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ kind: 'del', line: a[i++]! });
  while (j < m) ops.push({ kind: 'add', line: b[j++]! });
  return ops;
}

// A "closest match" hint for a not-found old_string (Python `_not_found_result`
// port, simplified): the line window with the best stripped-line overlap, so the
// model can see how its target drifted from reality.
export function closestMatchHint(content: string, oldText: string): string | undefined {
  const lines = content.split('\n');
  const oldLines = oldText.split('\n');
  const window = oldLines.length;
  if (lines.length === 0 || window === 0) return undefined;

  let bestRatio = 0;
  let bestStart = 0;
  const limit = Math.max(1, lines.length - window + 1);
  for (let i = 0; i < limit; i++) {
    const ratio = lineOverlapRatio(oldLines, lines.slice(i, i + window));
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestStart = i;
    }
  }
  if (bestRatio < 0.5) return undefined;
  return `closest match near line ${bestStart + 1} (similarity ${bestRatio.toFixed(2)})`;
}

// Fraction of `a` lines (stripped) that appear in `b` (stripped) — a cheap
// SequenceMatcher.ratio() stand-in good enough for a hint.
function lineOverlapRatio(a: string[], b: string[]): number {
  const bStripped = b.map((l) => l.trim());
  const remaining = [...bStripped];
  let hits = 0;
  for (const line of a.map((l) => l.trim())) {
    const idx = remaining.indexOf(line);
    if (idx !== -1) {
      hits += 1;
      remaining.splice(idx, 1);
    }
  }
  const denom = a.length + b.length;
  return denom === 0 ? 0 : (2 * hits) / denom;
}
