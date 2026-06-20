// Hybrid symbol locator (Initiative 8, v0.15.3) — SICA's design: ripgrep
// produces cheap candidate lines, then tree-sitter CONFIRMS each candidate is a
// real def/ref (not a comment/string/substring) and attaches the enclosing
// signature. If a grammar is missing for a file, that file's candidates degrade
// to ripgrep-only, clearly marked `verified:false` — never a hard fail.

import { relative } from 'node:path';
import { runGrep, type GrepRunner, type GrepHit } from '../tools/builtin/grep';
import { extractSymbols, type SymbolKind } from './symbols';
import { grammarForPath } from './treeSitter';

export type LocateKind = 'def' | 'ref' | 'any';

export type FoundDef = {
  file: string;
  line: number;
  kind: SymbolKind;
  signature: string;
  verified: boolean;
};

export type FoundRef = {
  file: string;
  line: number;
  verified: boolean;
};

export type LocateResult = {
  definitions: FoundDef[];
  references: FoundRef[];
  verified: boolean; // true iff EVERY candidate file was tree-sitter-verified
  truncated: boolean;
};

const CAND_CAP = 400;
// identifier word-boundary regex so `dispatchToolCalls` does not match
// `dispatchToolCallsX`. Escaped at the call site.
function wordRegex(name: string): string {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `\\b${esc}\\b`;
}

export type LocateOptions = {
  name: string;
  root: string;
  kind?: LocateKind;
  grepRunner?: GrepRunner; // injected in tests (rg-absent / deterministic)
  readFile?: (abs: string) => Promise<string>;
  abortSignal?: AbortSignal; // dispatcher timeout/abort → cancel the rg candidate scan
};

async function defaultRead(abs: string): Promise<string> {
  return Bun.file(abs).text();
}

export async function locateSymbol(opts: LocateOptions): Promise<LocateResult> {
  const kind = opts.kind ?? 'any';
  const read = opts.readFile ?? defaultRead;

  const { hits, total } = await runGrep(
    {
      query: wordRegex(opts.name),
      root: opts.root,
      regex: true,
      caseSensitive: true,
      cap: CAND_CAP,
      abortSignal: opts.abortSignal,
    },
    opts.grepRunner,
  );

  // Group candidate hits by file so we parse each file at most once.
  const byFile = new Map<string, GrepHit[]>();
  for (const h of hits) {
    const arr = byFile.get(h.path);
    if (arr) arr.push(h);
    else byFile.set(h.path, [h]);
  }

  const definitions: FoundDef[] = [];
  const references: FoundRef[] = [];
  let allVerified = true;

  for (const [absPath, fileHits] of byFile) {
    const rel = relative(opts.root, absPath) || absPath;
    const hasGrammar = grammarForPath(absPath) !== null;

    if (!hasGrammar) {
      // ripgrep-only fallback for this file: emit unverified refs (and treat
      // each candidate as a possible def we cannot confirm).
      allVerified = false;
      for (const h of fileHits) {
        references.push({ file: rel, line: h.line, verified: false });
      }
      continue;
    }

    let source: string;
    try {
      source = await read(absPath);
    } catch {
      // unreadable → fall back to the raw candidate lines, unverified
      allVerified = false;
      for (const h of fileHits) references.push({ file: rel, line: h.line, verified: false });
      continue;
    }

    const syms = await extractSymbols(absPath, source);
    if (!syms.verified) {
      // grammar present on disk but the runtime failed → unverified candidates
      allVerified = false;
      for (const h of fileHits) references.push({ file: rel, line: h.line, verified: false });
      continue;
    }

    // tree-sitter-verified: keep only defs/refs whose name equals the query.
    for (const d of syms.defs) {
      if (d.name !== opts.name) continue;
      if (kind === 'ref') continue;
      definitions.push({
        file: rel,
        line: d.line,
        kind: d.kind,
        signature: d.signature,
        verified: true,
      });
    }
    if (kind !== 'def') {
      const defLines = new Set(
        syms.defs.filter((d) => d.name === opts.name).map((d) => d.line),
      );
      for (const r of syms.refs) {
        if (r.name !== opts.name) continue;
        if (defLines.has(r.line)) continue; // the def's own name node is not a "reference"
        references.push({ file: rel, line: r.line, verified: true });
      }
    }
  }

  definitions.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  references.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  return {
    definitions,
    references,
    verified: allVerified,
    truncated: total > hits.length,
  };
}
