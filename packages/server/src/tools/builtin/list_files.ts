import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { buildIgnore, walk } from '../fsScan';

// Tree listing + glob (Initiative 8, v0.15.0). Read-only navigation primitive —
// ignore-aware (built-in set + .gitignore), optionally recursive, optional glob
// filter. Port of Python list_files. Routed through the sandbox so a listing
// can't enumerate a secret directory.
const Input = z.object({
  path: z
    .string()
    .optional()
    .describe('directory to list (default: workspace root)'),
  recursive: z.boolean().optional().describe('descend into subdirectories (default false)'),
  glob: z
    .string()
    .optional()
    .describe('glob filter applied to the path relative to the listed dir, e.g. **/*.ts'),
  include_hidden: z.boolean().optional().describe('include dotfiles/dotdirs (default false)'),
  max_entries: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe('cap on returned entries (default 1000)'),
});

const Entry = z.object({
  path: z.string(),
  type: z.enum(['file', 'dir']),
});

const Output = z.object({
  root: z.string(),
  entries: z.array(Entry),
  truncated: z.boolean(),
});

const DEFAULT_MAX = 1000;

export const listFilesTool = defineTool({
  name: 'list_files',
  description:
    'List files and directories under a path, ignore-aware (.git, node_modules, build output, ' +
    '.gitignore). Set recursive to walk the tree; pass a glob to filter. Use this to locate where ' +
    'something lives before reading it.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 8000,
  summarize: (out) => {
    const files = out.entries.filter((e) => e.type === 'file').length;
    const dirs = out.entries.length - files;
    return `${out.entries.length} entries (${files} files, ${dirs} dirs)${out.truncated ? ', truncated' : ''}`;
  },
  execute: async function* (input) {
    const target = input.path ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'read');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `list_files: ${gate.reason}`, recoverable: false };
      return;
    }

    const root = gate.resolved;
    const ignore = buildIgnore(root);
    const maxEntries = input.max_entries ?? DEFAULT_MAX;

    let walked: { entries: { abs: string; rel: string; type: 'file' | 'dir' }[]; truncated: boolean };
    try {
      // Over-walk a little when a glob will filter, so the cap reflects matches.
      walked = await walk(root, {
        recursive: input.recursive ?? false,
        includeHidden: input.include_hidden ?? false,
        maxEntries: input.glob ? Math.min(maxEntries * 4, 20000) : maxEntries,
        ignore,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `list_files: ${message}`, recoverable: true };
      return;
    }

    let entries = walked.entries;
    let truncated = walked.truncated;

    if (input.glob) {
      const glob = new Bun.Glob(input.glob);
      entries = entries.filter((e) => glob.match(e.rel));
    }

    if (entries.length > maxEntries) {
      entries = entries.slice(0, maxEntries);
      truncated = true;
    }

    yield {
      kind: 'ok',
      data: {
        root,
        entries: entries.map((e) => ({ path: e.rel, type: e.type })),
        truncated,
      },
    };
  },
});
