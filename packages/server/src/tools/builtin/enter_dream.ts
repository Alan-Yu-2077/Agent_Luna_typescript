import { z } from 'zod';
import { defineTool } from '../defineTool';
import { getSession } from '../../turn/session';

const Input = z.object({
  reason: z.string().optional(),
});

const Output = z.object({
  status: z.literal('pending'),
});

// Pending-intent only: the cycle must NEVER start during the live turn (the
// absolute isolation contract — closes Python's tail-race where the daemon
// thread started inside tool execution). runTurn checks pendingDream after
// finalize and starts the cycle then.
export const enterDreamTool = defineTool({
  name: 'enter_dream',
  description:
    'Choose to go to sleep and consolidate your memories (write diaries, reconcile facts, reflect on the relationship). The dream starts after you finish this reply. Use when the conversation reaches a natural pause and there is meaningful history to digest.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'safe',
  timeoutMs: 1000,
  summarize: () => 'dream pending — starts after this turn',
  execute: async function* (input, ctx) {
    const session = getSession(ctx.sessionId);
    session.pendingDream = input.reason ?? 'self-initiated';
    yield { kind: 'ok', data: { status: 'pending' as const } };
  },
});
