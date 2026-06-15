import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { locateSymbol } from '../../code/symbolLocator';

// find_symbol (Initiative 8, v0.15.3) — hybrid locate: ripgrep candidates →
// tree-sitter verify. Returns structured defs/refs (file+line+signature), with
// `verified` telling the caller whether a same-name comment/string false
// positive was excluded. Read-only + jailed. Behind LUNA_REPO_MAP (default ON).
const Input = z.object({
  name: z.string().min(1).describe('the exact symbol name to locate (function, class, type, …)'),
  kind: z
    .enum(['def', 'ref', 'any'])
    .optional()
    .describe("what to return: 'def' (definitions), 'ref' (uses), or 'any' (both, default)"),
  path: z.string().optional().describe('directory to search (default: the workspace root)'),
});

const Def = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  kind: z.enum(['function', 'class', 'interface', 'type', 'enum', 'method', 'variable']),
  signature: z.string(),
  verified: z.boolean(),
});

const Ref = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  verified: z.boolean(),
});

const Output = z.object({
  definitions: z.array(Def),
  references: z.array(Ref),
  verified: z.boolean(),
  truncated: z.boolean(),
});

export const findSymbolTool = defineTool({
  name: 'find_symbol',
  description:
    'Locate a symbol by exact name: returns its definitions (file, line, signature) and references. ' +
    'Hybrid — ripgrep finds candidates, tree-sitter confirms each is a real def/ref (a same-name token ' +
    'in a comment or string is excluded). When a grammar is missing it degrades to ripgrep-only, marked ' +
    'verified:false. Use it before reading a whole file to jump straight to the definition.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 20000,
  summarize: (out) =>
    `${out.definitions.length} def${out.definitions.length === 1 ? '' : 's'}, ${out.references.length} ref${out.references.length === 1 ? '' : 's'}${out.verified ? '' : ' (some unverified)'}`,
  execute: async function* (input) {
    const target = input.path ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'read');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `find_symbol: ${gate.reason}`, recoverable: false };
      return;
    }

    let result;
    try {
      result = await locateSymbol({ name: input.name, root: gate.resolved, kind: input.kind });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `find_symbol: ${message}`, recoverable: true };
      return;
    }

    yield {
      kind: 'ok',
      data: {
        definitions: result.definitions,
        references: result.references,
        verified: result.verified,
        truncated: result.truncated,
      },
    };
  },
});
