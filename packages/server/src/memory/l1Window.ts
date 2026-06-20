import type Anthropic from '@anthropic-ai/sdk';
import type { Provider } from '../provider/types';
import type { Session } from '../turn/session';
import { commitFold, getMemoryDb, listL2, type L2Row } from './sessionStore';
import { cleanHistoryEnabled, collapseOldToolResults } from './cleanHistory';

// v0.17.0 (Initiative 10): the verbatim window is measured in TURNS, not messages
// (reversing PR #3's identified unit drift). A "turn" = one L2 row (a user message
// + its clean assistant reply group). ~100 clean turns ≈ ~20k tokens because
// v0.16.3 stripped thinking + collapsed tool I/O. Read per-call so the env knob
// (range 40–150) takes effect live without a redeploy.
function recentTurns(): number {
  return Number(Bun.env['LUNA_L1_RECENT_TURNS'] ?? 100);
}
function foldBatchTurns(): number {
  return Number(Bun.env['LUNA_L1_FOLD_BATCH_TURNS'] ?? 10);
}
// Hard cap on the structured rolling digest (replaces the old unbounded
// `rolling_summary` growth). A few hundred tokens.
function summaryMaxChars(): number {
  return Number(Bun.env['LUNA_L1_SUMMARY_MAX_CHARS'] ?? 3000);
}
// Turns rated at or above this importance (1–5) are flagged salient to the
// compressor so their specifics resist over-summarization (importance anchors).
function anchorImportance(): number {
  return Number(Bun.env['LUNA_L1_ANCHOR_IMPORTANCE'] ?? 4);
}

export function windowEnabled(): boolean {
  return Bun.env['LUNA_L1_WINDOW'] !== '0';
}

function msgCount(row: L2Row): number {
  return (JSON.parse(row.raw_json) as object[]).length;
}

// The bounded view sent to the model: [structured-digest?] + verbatim tail.
// session.history itself is never truncated — it is the in-memory mirror of the
// L2 ground truth, and the fold only ever reads verbatim content.
export function buildActiveContext(session: Session): Anthropic.MessageParam[] {
  // v0.16.3: collapse older tool-result payloads in the assembled context (keeps
  // the most-recent ones full + the tool_use records intact). Non-mutating.
  const clean = (msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] =>
    cleanHistoryEnabled() ? collapseOldToolResults(msgs) : msgs;

  if (!windowEnabled() || session.windowLowWater === 0) {
    return clean(session.history);
  }
  const tail = session.history.slice(session.windowLowWater);
  if (session.rollingSummary.length === 0) return clean(tail);
  const summaryMsg: Anthropic.MessageParam = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `<conversation_summary>\n${session.rollingSummary.trim()}\n</conversation_summary>`,
      },
    ],
  };
  return [summaryMsg, ...clean(tail)];
}

type FoldedTurn = { text: string; salient: boolean };
type FoldPlan = {
  folded: FoldedTurn[];
  newLowWater: number;
};

// Chooses whole L2 turns to fold so the boundary always lands at a turn start
// (never splitting a tool_use / tool_result pair). Fold decision is TURN-based:
// keep the last RECENT_TURNS verbatim, fold older ones once they exceed the
// window by a batch. Fold input comes from L2 columns (verbatim) — never from a
// prior summary directly; the compressor receives the running digest + the new
// turns and re-derives a BOUNDED digest (v0.17.0 oscillating compression).
export function planFold(session: Session): FoldPlan | null {
  if (!getMemoryDb()) return null;
  const rows = listL2(session.id);
  if (rows.length === 0) return null;

  // Walk to the L2 row where the verbatim window currently begins (cumulative
  // message count must equal windowLowWater, or the bookkeeping drifted — bail).
  let cum = 0;
  let foldedRows = 0;
  while (foldedRows < rows.length && cum < session.windowLowWater) {
    cum += msgCount(rows[foldedRows]!);
    foldedRows += 1;
  }
  if (cum !== session.windowLowWater) return null;

  const keep = recentTurns();
  const unfoldedTurns = rows.length - foldedRows;
  if (unfoldedTurns <= keep + foldBatchTurns()) return null;

  const toFold = unfoldedTurns - keep; // bring the window back to RECENT_TURNS
  const anchor = anchorImportance();
  let newLowWater = session.windowLowWater;
  const folded: FoldedTurn[] = [];
  for (let i = 0; i < toFold; i++) {
    const row = rows[foldedRows + i]!;
    newLowWater += msgCount(row);
    folded.push({
      text: `User: ${row.user_text}\nLuna: ${row.assistant_text}`,
      salient: (row.importance ?? 0) >= anchor,
    });
  }
  if (folded.length === 0) return null;
  return { folded, newLowWater };
}

function compressSystem(): string {
  return (
    'You maintain a compact, structured memory digest of a long conversation. You are given the ' +
    'CURRENT DIGEST and some OLDER EXCHANGES now being folded into it. Produce the UPDATED digest ' +
    'under these rules:\n' +
    '- Keep four labelled sections: Key facts · Decisions · Open threads · Emotional beats.\n' +
    '- Merge the older exchanges into the existing sections; condense redundancy.\n' +
    '- Exchanges marked [salient] hold idiosyncratic, important detail — preserve their specifics ' +
    'near-verbatim; you may condense unmarked ones aggressively.\n' +
    `- Hard limit: keep the whole digest under ${summaryMaxChars()} characters. If over, drop the ` +
    'least important unmarked details first; never drop a [salient] specific.\n' +
    '- Third person, past tense. Output only the digest.'
  );
}

function buildCompressPrompt(currentDigest: string, folded: FoldedTurn[]): string {
  const older = folded.map((f) => (f.salient ? `[salient] ${f.text}` : f.text)).join('\n\n');
  const digest = currentDigest.trim().length > 0 ? currentDigest.trim() : '(empty — first fold)';
  return `CURRENT DIGEST:\n${digest}\n\nOLDER EXCHANGES TO FOLD IN:\n${older}`;
}

export async function maybeFold(session: Session, provider: Provider): Promise<boolean> {
  if (!windowEnabled() || !getMemoryDb()) return false;
  const plan = planFold(session);
  if (!plan) return false;
  const expected = session.windowLowWater;

  const result = await provider.complete({
    system: compressSystem(),
    messages: [{ role: 'user', content: buildCompressPrompt(session.rollingSummary, plan.folded) }],
    maxTokens: 1024,
  });
  // Bounded: the digest is re-derived whole and hard-capped, so repeated folds
  // never grow it unboundedly (the regression vs the old append-only summary).
  let digest = result.text.trim();
  // An empty digest (complete() returned only thinking / hit max_tokens / a
  // transient blip) must NOT overwrite rolling_summary with '' and advance the
  // low-water mark — that silently shrinks active context. Skip; retry next fold.
  if (!digest) return false;
  const cap = summaryMaxChars();
  if (digest.length > cap) digest = digest.slice(0, cap);

  const landed = commitFold(session.id, digest, plan.newLowWater, expected);
  if (landed && session.windowLowWater === expected) {
    session.rollingSummary = digest;
    session.windowLowWater = plan.newLowWater;
  }
  return landed;
}
