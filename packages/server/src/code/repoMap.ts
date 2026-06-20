// Repo map (Initiative 8, v0.15.3) — an Aider-style ranked, token-bounded
// outline of a codebase's symbols. Parse each source file (cache-aware), build a
// graph where an edge means "file A references a symbol defined in file B",
// PageRank the graph, and emit the most central definitions first up to a token
// budget. The outline is ADVISORY: every claim is verifiable with read_file, so
// a heuristic mis-rank is a quality issue, not a safety one.

import { statSync } from 'node:fs';
import { relative } from 'node:path';
import { buildIgnore, walk, BINARY_EXTENSIONS } from '../tools/fsScan';
import { extname } from 'node:path';
import { extractSymbols, type SymbolDef } from './symbols';
import { grammarForPath } from './treeSitter';
import { getCached, putCached, type CachedFile } from './repoMapCache';

export type RepoMapEntry = {
  symbol: string;
  kind: SymbolDef['kind'];
  file: string; // workspace-relative
  line: number;
  exported: boolean;
  score: number;
};

export type RepoMapResult = {
  entries: RepoMapEntry[];
  files_scanned: number;
  files_parsed: number; // files actually parsed this run (cache misses)
  truncated: boolean; // token budget cut the outline short
  verified: boolean; // true iff EVERY parsed file used tree-sitter
};

const DEFAULT_MAX_TOKENS = 1500;
const MAX_FILES = 4000;
// ~4 chars/token is the usual rough rule; each rendered line is one entry.
const CHARS_PER_TOKEN = 4;

// Injectable mtime/clock so the cache test is deterministic.
export type StatFn = (path: string) => { mtimeMs: number; size: number };
const defaultStat: StatFn = (path) => {
  const s = statSync(path);
  return { mtimeMs: s.mtimeMs, size: s.size };
};

export type BuildOptions = {
  root: string;
  maxTokens?: number;
  focus?: string; // a path fragment or symbol name to bias ranking toward
  statFn?: StatFn;
  nowMs?: number;
  abortSignal?: AbortSignal; // dispatcher timeout/abort → stop the parse loop
};

type ParsedFile = {
  abs: string;
  rel: string;
  defs: SymbolDef[];
  refNames: Set<string>;
  verified: boolean;
  fromCache: boolean;
};

async function parseFile(
  abs: string,
  rel: string,
  statFn: StatFn,
  nowMs: number,
): Promise<ParsedFile | null> {
  let stat: { mtimeMs: number; size: number };
  try {
    stat = statFn(abs);
  } catch {
    return null;
  }

  const cached = getCached(abs, stat.mtimeMs, stat.size);
  if (cached) {
    return {
      abs,
      rel,
      defs: cached.defs,
      refNames: new Set(cached.refs.map((r) => r.name)),
      verified: cached.verified,
      fromCache: true,
    };
  }

  let source: string;
  try {
    source = await Bun.file(abs).text();
  } catch {
    return null;
  }

  const syms = await extractSymbols(abs, source);
  const value: CachedFile = { defs: syms.defs, refs: syms.refs, verified: syms.verified };
  putCached(abs, stat.mtimeMs, stat.size, value, nowMs);

  return {
    abs,
    rel,
    defs: syms.defs,
    refNames: new Set(syms.refs.map((r) => r.name)),
    verified: syms.verified,
    fromCache: false,
  };
}

// PageRank-ish: distribute rank over the def→referencing-file graph. A symbol
// referenced by many (and by high-rank) files scores higher. We rank at the
// file level then attribute a file's rank to its defs, biased by export status.
function rankFiles(parsed: ParsedFile[]): Map<string, number> {
  const n = parsed.length;
  const rank = new Map<string, number>();
  if (n === 0) return rank;

  // Map a symbol name → the set of files that DEFINE it (a name can be defined
  // in more than one file; the reference is split across them).
  const defSites = new Map<string, string[]>();
  for (const f of parsed) {
    for (const d of f.defs) {
      const arr = defSites.get(d.name);
      if (arr) arr.push(f.abs);
      else defSites.set(d.name, [f.abs]);
    }
  }

  for (const f of parsed) rank.set(f.abs, 1 / n);
  const damping = 0.85;
  for (let iter = 0; iter < 12; iter++) {
    const next = new Map<string, number>();
    for (const f of parsed) next.set(f.abs, (1 - damping) / n);
    for (const f of parsed) {
      // count how many references this file makes to defined-elsewhere symbols
      const targets: string[] = [];
      for (const name of f.refNames) {
        const sites = defSites.get(name);
        if (!sites) continue;
        for (const site of sites) {
          if (site !== f.abs) targets.push(site);
        }
      }
      if (targets.length === 0) continue;
      const share = (damping * (rank.get(f.abs) ?? 0)) / targets.length;
      for (const t of targets) next.set(t, (next.get(t) ?? 0) + share);
    }
    for (const [k, v] of next) rank.set(k, v);
  }
  return rank;
}

export async function buildRepoMap(opts: BuildOptions): Promise<RepoMapResult> {
  const statFn = opts.statFn ?? defaultStat;
  const nowMs = opts.nowMs ?? Date.now();
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

  const ignore = buildIgnore(opts.root);
  const { entries: walkEntries } = await walk(opts.root, {
    recursive: true,
    includeHidden: false,
    maxEntries: MAX_FILES,
    ignore,
  });

  const sourceFiles = walkEntries.filter(
    (e) =>
      e.type === 'file' &&
      grammarForPath(e.abs) !== null &&
      !BINARY_EXTENSIONS.has(extname(e.abs).toLowerCase()),
  );

  const parsed: ParsedFile[] = [];
  let filesParsed = 0;
  for (const e of sourceFiles) {
    if (opts.abortSignal?.aborted) break; // timeout/abort — stop parsing the tree
    const pf = await parseFile(e.abs, relative(opts.root, e.abs), statFn, nowMs);
    if (pf) {
      parsed.push(pf);
      if (!pf.fromCache) filesParsed += 1;
    }
  }

  const rank = rankFiles(parsed);

  const focusLower = opts.focus?.toLowerCase();
  const candidates: RepoMapEntry[] = [];
  for (const f of parsed) {
    const fileRank = rank.get(f.abs) ?? 0;
    for (const d of f.defs) {
      let score = fileRank * (d.exported ? 1.5 : 1);
      if (focusLower) {
        if (f.rel.toLowerCase().includes(focusLower) || d.name.toLowerCase().includes(focusLower)) {
          score *= 4;
        }
      }
      candidates.push({
        symbol: d.name,
        kind: d.kind,
        file: f.rel,
        line: d.line,
        exported: d.exported,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);

  // token budget: each entry costs ~ its rendered-line length in chars / 4.
  const entries: RepoMapEntry[] = [];
  let charBudget = maxTokens * CHARS_PER_TOKEN;
  let truncated = false;
  for (const c of candidates) {
    const cost = renderLine(c).length + 1;
    if (charBudget - cost < 0) {
      truncated = candidates.length > entries.length;
      break;
    }
    charBudget -= cost;
    entries.push(c);
  }

  const verified = parsed.length > 0 && parsed.every((f) => f.verified);

  return {
    entries,
    files_scanned: sourceFiles.length,
    files_parsed: filesParsed,
    truncated,
    verified,
  };
}

export function renderLine(e: RepoMapEntry): string {
  const exp = e.exported ? 'export ' : '';
  return `${e.file}:${e.line}  ${exp}${e.kind} ${e.symbol}`;
}

// Render the outline as a token-bounded tree grouped by file. Appended with a
// truncation marker when the budget cut it short.
export function renderRepoMap(result: RepoMapResult): string {
  if (result.entries.length === 0) return '(no symbols found)';
  const byFile = new Map<string, RepoMapEntry[]>();
  for (const e of result.entries) {
    const arr = byFile.get(e.file);
    if (arr) arr.push(e);
    else byFile.set(e.file, [e]);
  }
  const lines: string[] = [];
  for (const [file, syms] of byFile) {
    lines.push(file);
    for (const s of syms.sort((a, b) => a.line - b.line)) {
      const exp = s.exported ? 'export ' : '';
      lines.push(`  ${s.line}: ${exp}${s.kind} ${s.symbol}`);
    }
  }
  if (result.truncated) lines.push('… (truncated to token budget — narrow with focus)');
  return lines.join('\n');
}
