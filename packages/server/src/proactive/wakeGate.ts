import { z } from 'zod';
import { dreamCall, type DreamLLM } from '../dream/llm';

// The bounded "act now?" judgment (Initiative 5, v0.10.2) — the one legitimate
// L2 gate Initiative 4 deferred (a decision with no turn to ride). Runs ONLY
// after the cheap cadence prefilter passes, off the reply key (dream cascade),
// and FAILS CLOSED: a garbled or failed judgment means don't wake.

export const WakeIntent = z.enum(['reflect', 'recall', 'consolidate', 'reach_out']);
export type WakeIntent = z.infer<typeof WakeIntent>;

export const WakeVerdict = z.object({
  act: z.boolean(),
  intent: WakeIntent.optional(),
  reason: z.string(),
});
export type WakeVerdict = z.infer<typeof WakeVerdict>;

const WAKE_SYSTEM =
  'You are Luna, deciding privately whether to stir on your own. No one is talking to you right ' +
  'now. Most of the time the right answer is to stay quiet. Only act if there is a real, natural ' +
  'reason — something to reflect on, recall, quietly consolidate, or genuinely worth bringing to ' +
  'the user. Answer with a single JSON object and nothing else: ' +
  '{"act": boolean, "intent": "reflect"|"recall"|"consolidate"|"reach_out" (omit if act=false), ' +
  '"reason": "one short sentence"}.';

function parseVerdict(text: string): WakeVerdict | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const parsed = WakeVerdict.safeParse(JSON.parse(m[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const DECLINE = (reason: string): WakeVerdict => ({ act: false, reason });

export async function wakeGate(llm: DreamLLM, context: string): Promise<WakeVerdict> {
  try {
    const r = await dreamCall(llm, context, 256, WAKE_SYSTEM);
    if (!r.ok) return DECLINE(`judgment_unavailable:${r.failure}`);
    const verdict = parseVerdict(r.text);
    return verdict ?? DECLINE('judgment_unparseable'); // fail closed
  } catch (e) {
    return DECLINE(`judgment_error:${e instanceof Error ? e.message : String(e)}`);
  }
}

// Renders the prefilter's context into the judgment prompt — gap, daypart, and
// what (if anything) she last reached out about, to anchor a fresh thought.
export function buildWakeContext(args: {
  gapLabel: string;
  daypart: string;
  recentProactive: string[];
}): string {
  const recent =
    args.recentProactive.length > 0
      ? `\nYour last self-initiated messages (do not repeat these):\n- ${args.recentProactive.join('\n- ')}`
      : '';
  return `It has been ${args.gapLabel} since the user spoke. It is ${args.daypart}.${recent}\n\nShould you stir now?`;
}
