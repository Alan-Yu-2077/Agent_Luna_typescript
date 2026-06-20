// Tree-sitter loader (Initiative 8, v0.15.3). Lazily initializes the
// web-tree-sitter runtime and loads vendored per-language .wasm grammars
// (TS+TSX+JS first — Open Q #4). Everything here degrades gracefully: if the
// runtime or a grammar fails to load, `loadLanguageFor` returns null and the
// caller falls back to ripgrep-only / regex extraction (the plan's never-hard-
// fail contract). No grammar is bundled into the type system — the language
// handle is opaque (the web-tree-sitter Language).

import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Language, Parser as ParserType } from 'web-tree-sitter';

// The grammars we vendor. TS-first per Open Q #4; others added on demand.
export type GrammarKey = 'typescript' | 'tsx' | 'javascript';

// Map a file extension to a vendored grammar. Returns null for anything we do
// not have a grammar for (caller falls back).
export function grammarForPath(path: string): GrammarKey | null {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.jsx':
      return 'javascript';
    default:
      return null;
  }
}

function vendorDir(): string {
  // import.meta.dir = packages/server/src/code → ../../vendor/tree-sitter
  return join(import.meta.dir, '..', '..', 'vendor', 'tree-sitter');
}

function wasmPathFor(key: GrammarKey): string {
  return join(vendorDir(), `tree-sitter-${key}.wasm`);
}

// Runtime init is process-once. We hold the promise so concurrent callers share
// a single init; a failed init is cached as "runtime unavailable" (null Parser
// ctor) so we degrade instead of re-throwing on every call.
let initPromise: Promise<typeof ParserType | null> | null = null;

async function ensureRuntime(): Promise<typeof ParserType | null> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod = await import('web-tree-sitter');
        await mod.Parser.init();
        return mod.Parser;
      } catch {
        return null;
      }
    })();
  }
  return initPromise;
}

// Per-grammar language cache + a per-grammar "tried and failed" marker so a
// missing/corrupt .wasm is not re-loaded every call.
const langCache = new Map<GrammarKey, Language>();
const langFailed = new Set<GrammarKey>();

// Per-grammar Parser pool. A Parser is a WASM-heap allocation; constructing one
// per parsed file (and never delete()-ing it) leaks the emscripten heap across a
// long-lived server. Parsing is sequential, so a single reused parser per grammar
// is safe (and skips the per-file constructor cost). delete()-d on reset only.
const parserCache = new Map<GrammarKey, ParserType>();

async function loadLanguage(key: GrammarKey): Promise<Language | null> {
  const cached = langCache.get(key);
  if (cached) return cached;
  if (langFailed.has(key)) return null;

  const wasm = wasmPathFor(key);
  if (!existsSync(wasm)) {
    langFailed.add(key);
    return null;
  }
  try {
    const mod = await import('web-tree-sitter');
    const lang = await mod.Language.load(wasm);
    langCache.set(key, lang);
    return lang;
  } catch {
    langFailed.add(key);
    return null;
  }
}

export type LoadedParser = { parser: ParserType; grammar: GrammarKey };

// Build a parser bound to the grammar for `path`, or null if we have no grammar
// for it / the runtime/grammar failed to load. Callers MUST treat null as
// "tree-sitter unavailable" and fall back, never as an error.
export async function loadParserFor(path: string): Promise<LoadedParser | null> {
  const grammar = grammarForPath(path);
  if (!grammar) return null;

  const pooled = parserCache.get(grammar);
  if (pooled) return { parser: pooled, grammar };

  const ParserCtor = await ensureRuntime();
  if (!ParserCtor) return null;

  const lang = await loadLanguage(grammar);
  if (!lang) return null;

  try {
    const parser = new ParserCtor();
    parser.setLanguage(lang);
    parserCache.set(grammar, parser);
    return { parser, grammar };
  } catch {
    return null;
  }
}

// Test seam: forget all cached runtime/grammar state so a test can exercise the
// cold path (or the grammar-absent fallback by pointing vendorDir at nothing).
export function resetTreeSitterForTests(): void {
  initPromise = null;
  langCache.clear();
  langFailed.clear();
  for (const parser of parserCache.values()) {
    try {
      parser.delete();
    } catch {
      /* runtime already torn down */
    }
  }
  parserCache.clear();
}
