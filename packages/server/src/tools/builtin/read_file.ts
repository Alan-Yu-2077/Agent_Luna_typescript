import { z } from 'zod';
import { defineTool } from '../defineTool';

const Input = z.object({
  path: z.string().min(1),
});

const Output = z.object({
  content: z.string(),
  lines: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

const MAX_CONTENT_BYTES = 32 * 1024;

export const readFileTool = defineTool({
  name: 'read_file',
  description: 'Reads a UTF-8 text file. Output content is truncated beyond 32KB.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 5000,
  summarize: (out) => {
    const preview = out.content.slice(0, 200).replace(/\s+/g, ' ').trim();
    const tail = out.content.length > 200 ? '...' : '';
    const truncated = out.truncated ? ' (truncated)' : '';
    return `${out.lines} lines${truncated}: ${preview}${tail}`;
  },
  execute: async function* (input) {
    let raw: string;
    try {
      raw = await Bun.file(input.path).text();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `read_file: ${message}`,
        recoverable: true,
      };
      return;
    }

    const truncated = raw.length > MAX_CONTENT_BYTES;
    const content = truncated ? raw.slice(0, MAX_CONTENT_BYTES) : raw;
    const lines = content.split('\n').length;

    yield {
      kind: 'ok',
      data: { content, lines, truncated },
    };
  },
});
