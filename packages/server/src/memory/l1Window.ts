import type Anthropic from '@anthropic-ai/sdk';
import type { Provider } from '../provider/types';
import type { Session } from '../turn/session';
import { commitFold, getMemoryDb, listL2 } from './sessionStore';

const KEEP_MSGS = Number(Bun.env['LUNA_L1_KEEP_MSGS'] ?? 24);
const FOLD_MIN_BATCH_MSGS = Number(Bun.env['LUNA_L1_FOLD_BATCH_MSGS'] ?? 12);

export function windowEnabled(): boolean {
  return Bun.env['LUNA_L1_WINDOW'] !== '0';
}

// The bounded view sent to the model: [summary-as-user-message?] + verbatim tail.
// session.history itself is never truncated — it is the in-memory mirror of the
// L2 ground truth, and the fold only ever reads verbatim content.
export function buildActiveContext(session: Session): Anthropic.MessageParam[] {
  if (!windowEnabled() || session.windowLowWater === 0) {
    return session.history;
  }
  const tail = session.history.slice(session.windowLowWater);
  if (session.rollingSummary.length === 0) return tail;
  const summaryMsg: Anthropic.MessageParam = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `<conversation_summary>\n${session.rollingSummary.trim()}\n</conversation_summary>`,
      },
    ],
  };
  return [summaryMsg, ...tail];
}

type FoldPlan = {
  foldText: string;
  newLowWater: number;
};

// Chooses whole L2 turns to fold so the boundary always lands at a turn start
// (never splitting a tool_use / tool_result pair). Fold input comes from L2
// columns (verbatim full text) — NEVER from rollingSummary. That is the
// no-re-compression invariant: summaries grow by appending freshly-derived
// chunks; existing summary text is never re-summarized.
export function planFold(session: Session): FoldPlan | null {
  const verbatim = session.history.length - session.windowLowWater;
  if (verbatim <= KEEP_MSGS + FOLD_MIN_BATCH_MSGS) return null;

  const rows = listL2(session.id);
  if (rows.length === 0) return null;

  let cum = 0;
  let rowIdx = 0;
  while (rowIdx < rows.length && cum < session.windowLowWater) {
    cum += (JSON.parse(rows[rowIdx]!.raw_json) as object[]).length;
    rowIdx += 1;
  }
  if (cum !== session.windowLowWater) return null;

  const pieces: string[] = [];
  let newLowWater = session.windowLowWater;
  while (rowIdx < rows.length) {
    const row = rows[rowIdx]!;
    const msgCount = (JSON.parse(row.raw_json) as object[]).length;
    const remainingAfter = session.history.length - (newLowWater + msgCount);
    if (remainingAfter < KEEP_MSGS) break;
    pieces.push(`User: ${row.user_text}\nLuna: ${row.assistant_text}`);
    newLowWater += msgCount;
    rowIdx += 1;
  }
  if (pieces.length === 0 || newLowWater === session.windowLowWater) return null;
  return { foldText: pieces.join('\n\n'), newLowWater };
}

const FOLD_SYSTEM =
  'You compress conversation history. Summarize the following exchanges into a compact ' +
  'paragraph that preserves: facts about the user, decisions made, emotional tone shifts, ' +
  'and any open threads. Write in third person, past tense. Output only the summary.';

export async function maybeFold(session: Session, provider: Provider): Promise<boolean> {
  if (!windowEnabled() || !getMemoryDb()) return false;
  const plan = planFold(session);
  if (!plan) return false;
  const expected = session.windowLowWater;

  const result = await provider.complete({
    system: FOLD_SYSTEM,
    messages: [{ role: 'user', content: plan.foldText }],
    maxTokens: 1024,
  });
  const chunk = `\n\n${result.text.trim()}`;

  const landed = commitFold(session.id, chunk, plan.newLowWater, expected);
  if (landed && session.windowLowWater === expected) {
    session.rollingSummary += chunk;
    session.windowLowWater = plan.newLowWater;
  }
  return landed;
}
