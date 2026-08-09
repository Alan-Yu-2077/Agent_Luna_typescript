import { z } from 'zod';
import { defineTool } from '../defineTool';
import { getSession } from '../../turn/session';
import { dreamWindowOpen, parseDreamWindow } from '../../dream/dreamState';

const Input = z.object({
  reason: z.string().optional(),
});

const Output = z.object({
  status: z.literal('pending'),
});

// Pending-intent only: the cycle must NEVER start during the live turn (the
// absolute isolation contract — closes Python's tail-race where the daemon
// thread started inside tool execution). v0.45.17: the consumer is the CALLER,
// not runTurn — chat.send's `.then` for reactive turns, `runProactiveTurn`'s tail
// for proactive ones (which starts the cycle where it can and drops the intent
// where it cannot). Either way the intent never outlives its own turn.
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
    // v0.45.12 (C2): her SELF-initiated dreams obey the night window too — v0.45.7 only gated
    // the exit path, and the quiet-agency work (Initiative 35) makes silent tool use MORE
    // likely, not less. The owner's explicit menu action (ws dream.enter) stays ungated (D2).
    const window = parseDreamWindow(Bun.env['LUNA_SHUTDOWN_DREAM_WINDOW']);
    if (!dreamWindowOpen(Date.now(), window)) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message:
          `the night shift starts at ${window.startHour}:00 — dreams belong to the night. If ` +
          'something wants consolidating, `remember` the thought now and it will keep.',
        recoverable: true,
      };
      return;
    }
    const session = getSession(ctx.sessionId);
    session.pendingDream = input.reason ?? 'self-initiated';
    yield { kind: 'ok', data: { status: 'pending' as const } };
  },
});
