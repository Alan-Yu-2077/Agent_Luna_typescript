import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { BINARY_EXTENSIONS, buildIgnore, walk } from '../fsScan';
import { extname } from 'node:path';

// Regex/literal code search (Initiative 8, v0.15.0). Port of Python search_code.
// Primary path: a ripgrep subprocess (rg --json) for speed; graceful fallback to
// a JS scanner if rg is absent or fails. Results are capped + shaped
// ("showing N of M") so a broad query can't blow context. Routed through the
// sandbox.
const Input = z.object({
  query: z.string().min(1).describe('search pattern (literal by default; set regex:true for regex)'),
  path: z.string().optional().describe('directory or file to search (default: workspace root)'),
  regex: z.boolean().optional().describe('treat query as a regular expression (default false)'),
  case_sensitive: z.boolean().optional().describe('match case (default false)'),
  glob: z.string().optional().describe('restrict to files matching this glob, e.g. **/*.ts'),
  max_results: z.number().int().min(1).max(2000).optional().describe('cap on matches (default 200)'),
});

const Match = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  col: z.number().int().positive(),
  text: z.string(),
});

const Output = z.object({
  matches: z.array(Match),
  truncated: z.boolean(),
  shown: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const DEFAULT_MAX = 200;
const MAX_LINE_LEN = 500;

export type GrepHit = { path: string; line: number; col: number; text: string };
export type GrepRequest = {
  query: string;
  root: string;
  regex: boolean;
  caseSensitive: boolean;
  glob?: string;
  cap: number;
};
export type GrepRunResult = { hits: GrepHit[]; total: number };
export type GrepRunner = (req: GrepRequest) => Promise<GrepRunResult>;

// --- ripgrep runner (primary) ---
export const ripgrepRunner: GrepRunner = async (req) => {
  const args = ['--json', '--column', '--no-heading'];
  if (!req.caseSensitive) args.push('--ignore-case');
  if (!req.regex) args.push('--fixed-strings');
  if (req.glob) args.push('--glob', req.glob);
  // hard ceiling guards memory; we still report `total` from rg's stats line.
  args.push('--max-count', String(Math.max(req.cap * 4, req.cap)));
  args.push('--', req.query, req.root);

  const proc = Bun.spawn(['rg', ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  // rg exit 2 = actual error (bad regex, missing binary surfaced by Bun throw);
  // exit 1 = no matches (not an error). Treat >1 as a failure → caller falls back.
  if (proc.exitCode !== null && proc.exitCode > 1) {
    throw new Error(`rg exited ${proc.exitCode}`);
  }

  const hits: GrepHit[] = [];
  let total = 0;
  for (const lineStr of stdout.split('\n')) {
    if (lineStr.length === 0) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(lineStr);
    } catch {
      continue;
    }
    const rec = obj as { type?: string; data?: Record<string, unknown> };
    if (rec.type !== 'match' || !rec.data) continue;
    const data = rec.data as {
      path?: { text?: string };
      line_number?: number;
      lines?: { text?: string };
      submatches?: Array<{ start?: number }>;
    };
    total += 1;
    if (hits.length >= req.cap) continue;
    const path = data.path?.text ?? '';
    const line = data.line_number ?? 0;
    const col = (data.submatches?.[0]?.start ?? 0) + 1;
    const text = (data.lines?.text ?? '').replace(/\n$/, '').slice(0, MAX_LINE_LEN);
    if (line > 0) hits.push({ path, line, col, text });
  }
  return { hits, total };
};

// --- JS fallback runner (rg absent) — same shape, ignore-aware walk + regex ---
export const jsRunner: GrepRunner = async (req) => {
  const ignore = buildIgnore(req.root);
  const flags = req.caseSensitive ? 'g' : 'gi';
  const pattern = req.regex ? req.query : req.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    throw new Error(`invalid regex: ${e instanceof Error ? e.message : String(e)}`);
  }
  const glob = req.glob ? new Bun.Glob(req.glob) : null;

  const { entries } = await walk(req.root, {
    recursive: true,
    includeHidden: false,
    maxEntries: 50000,
    ignore,
    excludeSymlinks: true, // a symlink-to-secret must not be read via the content scan
  });

  const hits: GrepHit[] = [];
  let total = 0;
  for (const ent of entries) {
    if (ent.type !== 'file') continue;
    if (BINARY_EXTENSIONS.has(extname(ent.abs).toLowerCase())) continue;
    if (glob && !glob.match(ent.rel)) continue;
    // Per-file secret gate (mirrors read_file): canonicalize realpaths the entry,
    // so even a symlink that slipped through is rejected if it lands on a secret.
    if (!resolveInWorkspace(ent.abs, 'read').ok) continue;

    let text: string;
    try {
      text = await Bun.file(ent.abs).text();
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] ?? '';
      re.lastIndex = 0;
      const m = re.exec(lineText);
      if (m) {
        total += 1;
        if (hits.length < req.cap) {
          hits.push({
            path: ent.abs,
            line: i + 1,
            col: m.index + 1,
            text: lineText.slice(0, MAX_LINE_LEN),
          });
        }
      }
    }
  }
  return { hits, total };
};

// Resolve to a single grep run: try rg, fall back to JS on any failure. Exposed
// for tests so the runner can be injected (rg-absent path).
export async function runGrep(req: GrepRequest, primary?: GrepRunner): Promise<GrepRunResult> {
  const runner = primary ?? ripgrepRunner;
  try {
    return await runner(req);
  } catch {
    return jsRunner(req);
  }
}

let injectedRunner: GrepRunner | null = null;
export function setGrepRunnerForTests(runner: GrepRunner | null): void {
  injectedRunner = runner;
}

export const grepTool = defineTool({
  name: 'grep',
  description:
    'Search file contents by literal text or regex, ignore-aware. Returns matches with file, line, ' +
    'column and the matching line. Capped and reported as "shown of total". Use it to locate code ' +
    'before reading the exact lines.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 15000,
  summarize: (out) =>
    `${out.shown} of ${out.total} match${out.total === 1 ? '' : 'es'}${out.truncated ? ' (truncated)' : ''}`,
  execute: async function* (input) {
    const target = input.path ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'read');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `grep: ${gate.reason}`, recoverable: false };
      return;
    }

    const cap = input.max_results ?? DEFAULT_MAX;
    const req: GrepRequest = {
      query: input.query,
      root: gate.resolved,
      regex: input.regex ?? false,
      caseSensitive: input.case_sensitive ?? false,
      glob: input.glob,
      cap,
    };

    let result: GrepRunResult;
    try {
      result = await runGrep(req, injectedRunner ?? undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `grep: ${message}`, recoverable: true };
      return;
    }

    yield {
      kind: 'ok',
      data: {
        matches: result.hits,
        truncated: result.total > result.hits.length,
        shown: result.hits.length,
        total: result.total,
      },
    };
  },
});
