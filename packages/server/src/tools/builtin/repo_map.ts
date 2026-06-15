import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { buildRepoMap, renderRepoMap } from '../../code/repoMap';

// repo_map (Initiative 8, v0.15.3) — an Aider-style ranked, token-bounded,
// mtime-cached outline of the codebase's symbols. Read-only + jailed → safe to
// run in a proactive turn. Behind LUNA_REPO_MAP (default ON, owner decision).
const Input = z.object({
  focus: z
    .string()
    .optional()
    .describe('a file-path fragment or symbol name to bias the ranking toward (its neighborhood)'),
  path: z
    .string()
    .optional()
    .describe('directory to map (default: the workspace root)'),
  max_tokens: z
    .number()
    .int()
    .min(100)
    .max(8000)
    .optional()
    .describe('token budget for the outline (default ~1500)'),
});

const Entry = z.object({
  symbol: z.string(),
  kind: z.enum(['function', 'class', 'interface', 'type', 'enum', 'method', 'variable']),
  file: z.string(),
  line: z.number().int().positive(),
  exported: z.boolean(),
});

const Output = z.object({
  outline: z.string(),
  entries: z.array(Entry),
  files_scanned: z.number().int().nonnegative(),
  files_parsed: z.number().int().nonnegative(),
  truncated: z.boolean(),
  verified: z.boolean(),
});

export const repoMapTool = defineTool({
  name: 'repo_map',
  description:
    'Build a ranked, token-bounded outline of the codebase: the most-referenced symbols (functions, ' +
    'classes, types) first, with file and line. Use it to orient before reading — pass focus to bias ' +
    'toward a file or symbol’s neighborhood. mtime-cached, so repeat calls are cheap.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 30000,
  summarize: (out) =>
    `${out.entries.length} symbol${out.entries.length === 1 ? '' : 's'} across ${out.files_scanned} file${out.files_scanned === 1 ? '' : 's'}${out.truncated ? ' (truncated)' : ''}${out.verified ? '' : ' (some unverified)'}`,
  execute: async function* (input) {
    const target = input.path ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'read');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `repo_map: ${gate.reason}`, recoverable: false };
      return;
    }

    let result;
    try {
      result = await buildRepoMap({
        root: gate.resolved,
        focus: input.focus,
        maxTokens: input.max_tokens,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `repo_map: ${message}`, recoverable: true };
      return;
    }

    yield {
      kind: 'ok',
      data: {
        outline: renderRepoMap(result),
        entries: result.entries.map((e) => ({
          symbol: e.symbol,
          kind: e.kind,
          file: e.file,
          line: e.line,
          exported: e.exported,
        })),
        files_scanned: result.files_scanned,
        files_parsed: result.files_parsed,
        truncated: result.truncated,
        verified: result.verified,
      },
    };
  },
});
