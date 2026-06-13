import { z } from 'zod';
import { defineTool } from '../defineTool';
import { retrieve } from '../../memory/recall/recall';
import { getMemoryDb } from '../../memory/sessionStore';

// Agentic memory search (Initiative 4, v0.8.3, resolves Open Q #9). The
// complement to the automatic recall injection shipped in v0.4.x: Luna decides
// to "think back" and queries her own memory. Flat root-object input (v0.5.2
// gateway rule). Reuses the shipped hybrid retrieve() — no new retrieval code.
const Input = z.object({
  query: z.string().min(1).describe('what to search your memory for, in natural language'),
  scope: z
    .enum(['facts', 'timeline', 'both'])
    .optional()
    .describe('facts = durable things you know; timeline = past conversation; default both'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('how many hits to return (default 5)'),
});

const RecallHit = z.object({
  id: z.string(),
  source: z.enum(['l2', 'l3']),
  text: z.string(),
  score: z.number(),
  when_ms: z.number(),
});

const Output = z.object({
  hits: z.array(RecallHit),
});

const DEFAULT_LIMIT = 5;

export const recallTool = defineTool({
  name: 'recall',
  description:
    'Search your own long-term memory by meaning. Use it when the user references something you ' +
    'feel you should already know but do not have in front of you — recall before answering. ' +
    'Returns ranked snippets from your durable facts and past conversation.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  timeoutMs: 4000,
  summarize: (out) => `${out.hits.length} hit${out.hits.length === 1 ? '' : 's'}`,
  execute: async function* (input, ctx) {
    if (!getMemoryDb()) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: 'memory not configured',
        recoverable: false,
      };
      return;
    }
    const limit = input.limit ?? DEFAULT_LIMIT;
    const scope: 'facts' | 'timeline' | 'both' = input.scope ?? 'both';
    // over-fetch a little so scope filtering still fills the limit
    const raw = await retrieve(ctx.sessionId, input.query, { k: limit * 2 });
    const filtered = raw.filter((h) =>
      scope === 'both' ? true : scope === 'facts' ? h.source === 'l3' : h.source === 'l2',
    );
    const hits = filtered.slice(0, limit).map((h) => ({
      id: h.id,
      source: h.source,
      text: h.text,
      score: h.score,
      when_ms: h.t_ms,
    }));
    yield { kind: 'ok', data: { hits } };
  },
});
