import { z } from 'zod';
import { defineTool } from '../defineTool';

const Input = z.object({
  kind: z.enum(['fact', 'preference', 'moment']),
  text: z.string().min(1),
});

const Output = z.object({
  stored: z.literal(true),
  id: z.string(),
});

type RememberedItem = z.infer<typeof Input> & { id: string; t_ms: number };

const sessionStore = new Map<string, RememberedItem[]>();
let counter = 0;

export function resetRememberStore(): void {
  sessionStore.clear();
  counter = 0;
}

export function getRememberStore(sessionId: string): RememberedItem[] {
  return sessionStore.get(sessionId) ?? [];
}

export const rememberTool = defineTool({
  name: 'remember',
  description:
    'Stores a memory item (fact, preference, or moment) keyed to the current session. In-memory only — v0.4 will move this to SQLite.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  timeoutMs: 1000,
  summarize: (out) => `Stored as ${out.id}`,
  execute: async function* (input, ctx) {
    counter += 1;
    const id = `${ctx.sessionId}:${counter}`;
    const item: RememberedItem = { ...input, id, t_ms: Date.now() };
    const list = sessionStore.get(ctx.sessionId) ?? [];
    list.push(item);
    sessionStore.set(ctx.sessionId, list);
    yield {
      kind: 'ok',
      data: { stored: true as const, id },
    };
  },
});
