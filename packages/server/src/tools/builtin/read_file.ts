import { z } from 'zod';
import { defineTool } from '../defineTool';
import { contentHash, resolveInWorkspace } from '../workspace';

// Windowed read (Initiative 8, v0.15.0): the SWE-agent ACI shape — a 1-indexed
// line window so a huge file can't blow context, line-numbered content so the
// model can address exact lines, and a content_hash that v0.15.1's edit tool
// compares against (optimistic concurrency). Routed through the workspace
// sandbox (read access → secrets blocked, evaluator firewall readable).
const Input = z.object({
  path: z.string().min(1).describe('file path (absolute, ~-relative, or relative to the workspace)'),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('1-indexed first line to read (default 1)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .describe('how many lines to read (default 800, hard cap 2000)'),
});

const Output = z.object({
  content: z.string(),
  start_line: z.number().int().nonnegative(),
  end_line: z.number().int().nonnegative(),
  total_lines: z.number().int().nonnegative(),
  truncated: z.boolean(),
  content_hash: z.string(),
});

const DEFAULT_LIMIT = 800;
const HARD_CAP = 2000;

export const readFileTool = defineTool({
  name: 'read_file',
  description:
    'Read a UTF-8 text file as a numbered line window. Give offset/limit to page through a large ' +
    'file; output is line-numbered so you can cite exact lines. Returns total_lines and a ' +
    'content_hash. Locate first (list_files/grep), then read the exact lines — do not guess paths.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 5000,
  summarize: (out) =>
    `lines ${out.start_line}-${out.end_line} of ${out.total_lines}${out.truncated ? ' (more follow)' : ''}`,
  execute: async function* (input) {
    const gate = resolveInWorkspace(input.path, 'read');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `read_file: ${gate.reason}`, recoverable: false };
      return;
    }

    let raw: string;
    try {
      raw = await Bun.file(gate.resolved).text();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // ENOENT and friends stay recoverable: the model can re-target the path.
      yield { kind: 'err', code: 'execution_exception', message: `read_file: ${message}`, recoverable: true };
      return;
    }

    const content_hash = contentHash(raw);
    const allLines = raw.split('\n');
    const total_lines = allLines.length;

    const offset = input.offset ?? 1;
    const requested = Math.min(input.limit ?? DEFAULT_LIMIT, HARD_CAP);

    if (offset > total_lines) {
      yield {
        kind: 'ok',
        data: {
          content: '',
          start_line: total_lines,
          end_line: total_lines,
          total_lines,
          truncated: false,
          content_hash,
        },
      };
      return;
    }

    const startIdx = offset - 1;
    const endIdx = Math.min(startIdx + requested, total_lines);
    const windowLines = allLines.slice(startIdx, endIdx);
    const truncated = endIdx < total_lines;

    const width = String(endIdx).length;
    const numbered = windowLines
      .map((line, i) => `${String(startIdx + i + 1).padStart(width, ' ')}\t${line}`)
      .join('\n');

    yield {
      kind: 'ok',
      data: {
        content: numbered,
        start_line: offset,
        end_line: endIdx,
        total_lines,
        truncated,
        content_hash,
      },
    };
  },
});
