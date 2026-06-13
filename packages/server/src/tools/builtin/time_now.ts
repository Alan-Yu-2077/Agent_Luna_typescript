import { z } from 'zod';
import { defineTool } from '../defineTool';

const Input = z.object({});

const Output = z.object({
  iso: z.string(),
  unix_ms: z.number().int().nonnegative(),
  tz: z.string(),
});

export const timeNowTool = defineTool({
  name: 'time_now',
  description: 'Returns the current time as ISO 8601 + unix milliseconds + IANA timezone.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 1000,
  summarize: (out) => `${out.iso} (${out.tz})`,
  execute: async function* () {
    yield {
      kind: 'ok',
      data: {
        iso: new Date().toISOString(),
        unix_ms: Date.now(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  },
});
