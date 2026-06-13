import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { Session } from '../turn/session';
import { runTurn } from '../turn/runTurn';

// The proactive framing — a USER-role stage direction (never system: the
// v0.27.1 hoisting lesson). She woke on her own; acting via tools is the point,
// and speaking is optional. The companion-opener constraint (ported from Python
// proactive.py) keeps her from opening with status/check-in questions IF she
// does reach out.
const PROACTIVE_DIRECTIVE =
  '(You woke on your own — no one just spoke to you. This is your own moment. You may reflect, ' +
  'recall something, save or revise a memory, look something up, or simply sit with a thought — ' +
  'calling a tool is acting, and you do not have to say anything at all. If, and only if, you ' +
  'genuinely have something worth bringing to the user, you may reach out — but never open with a ' +
  'status or check-in question (在吗 / 吃了吗 / 到哪了 / 怎么不理我); start from a real thought, a ' +
  'small self-disclosure, or a fresh topic. If nothing is worth doing or saying, do nothing.)';

export type RunProactiveOptions = {
  session: Session;
  cycleId: string;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
};

// A proactive turn is a normal runTurn with the proactive framing + the full
// registry + `proactiveTurn: true` (silence allowed). Returns whether she spoke.
export async function runProactiveTurn(
  opts: RunProactiveOptions,
): Promise<{ spoke: boolean }> {
  opts.emit({ type: 'proactive.started', cycle_id: opts.cycleId });
  const state = await runTurn({
    session: opts.session,
    turnId: `proactive:${opts.cycleId}`,
    userText: PROACTIVE_DIRECTIVE,
    provider: opts.provider,
    registry: opts.registry,
    emit: opts.emit,
    proactiveTurn: true,
  });
  const spoke = state.messageTexts.length > 0;
  opts.emit({ type: 'proactive.finished', cycle_id: opts.cycleId, spoke });
  return { spoke };
}
