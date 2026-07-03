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

// v0.28.4: the hard safety net's budgets. The fold is the intended bound, but ANY bookkeeping
// drift used to stall it silently and the window then grew without limit — the 390K-token-turn
// incident (~$1/turn on plain chat). These caps bound the verbatim tail NO MATTER WHAT upstream
// state says; when they engage, folding is lagging and we log it. Cuts land on turn starts only.
function tailMaxMsgs(): number {
  return Number(Bun.env['LUNA_L1_TAIL_MAX_MSGS'] ?? 300);
}
function tailMaxChars(): number {
  return Number(Bun.env['LUNA_L1_TAIL_MAX_CHARS'] ?? 120_000);
}

// A turn start is a plain user message (no tool_result blocks) — the only safe cut point: cutting
// anywhere else can orphan a tool_result from its tool_use and the API rejects the request.
function isTurnStart(m: Anthropic.MessageParam): boolean {
  if (m.role !== 'user') return false;
  if (typeof m.content === 'string') return true;
  return Array.isArray(m.content) && !m.content.some((b) => b.type === 'tool_result');
}

// Bound the tail by message count AND serialized size, cutting at the EARLIEST turn start that
// fits both budgets. If even the newest turn start is over budget (one monster turn), cut there
// anyway — one oversized turn beats the whole history.
export function hardTrimTail(
  msgs: Anthropic.MessageParam[],
  maxMsgs: number,
  maxChars: number,
): Anthropic.MessageParam[] {
  let chars = 0;
  let cut = -1; // earliest turn start within budget
  let lastStart = -1; // newest turn start seen (fallback)
  for (let i = msgs.length - 1; i >= 0; i--) {
    chars += JSON.stringify(msgs[i]!.content).length;
    const over = msgs.length - i > maxMsgs || chars > maxChars;
    if (over && cut !== -1) break;
    if (isTurnStart(msgs[i]!)) {
      if (lastStart === -1) lastStart = i;
      if (over) break;
      cut = i;
    }
  }
  const at = cut !== -1 ? cut : lastStart;
  if (at <= 0) return msgs;
  console.warn(`[l1] hard trim engaged: dropped ${at} leading messages (fold is lagging)`);
  return msgs.slice(at);
}

// The bounded view sent to the model: [structured-digest?] + verbatim tail.
// session.history itself is never truncated — it is the in-memory mirror of the
// L2 ground truth, and the fold only ever reads verbatim content.
export function buildActiveContext(session: Session): Anthropic.MessageParam[] {
  // v0.16.3: collapse older tool-result payloads in the assembled context (keeps
  // the most-recent ones full + the tool_use records intact). Non-mutating.
  const clean = (msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] =>
    cleanHistoryEnabled() ? collapseOldToolResults(msgs) : msgs;
  const bound = (msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] =>
    hardTrimTail(msgs, tailMaxMsgs(), tailMaxChars());

  if (!windowEnabled()) {
    return clean(session.history); // explicit opt-out (LUNA_L1_WINDOW=0): genuinely unbounded
  }
  if (session.windowLowWater === 0) {
    return bound(clean(session.history));
  }
  let tail = session.history.slice(session.windowLowWater);
  // v0.28.4: a drifted low-water can land mid-turn (history edits shift message counts across
  // restarts); a tail starting inside a tool_use/tool_result pair 400s. Align to the next turn
  // start before sending.
  const firstStart = tail.findIndex(isTurnStart);
  if (firstStart > 0) tail = tail.slice(firstStart);
  if (session.rollingSummary.length === 0) return bound(clean(tail));
  const summaryMsg: Anthropic.MessageParam = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `<conversation_summary>\n${session.rollingSummary.trim()}\n</conversation_summary>`,
      },
    ],
  };
  return [summaryMsg, ...bound(clean(tail))];
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

  // Walk to the L2 row where the verbatim window currently begins. The watermark SHOULD land
  // exactly on a row boundary — but history edits (e.g. v0.27.4's corrective-directive stripping)
  // shift message counts across restarts, and the old `cum !== windowLowWater → bail` guard turned
  // that one-off drift into a PERMANENTLY stalled fold: the window then grew unbounded (the
  // 390K-token-turn incident). v0.28.4: heal instead — snap the fold base to the row boundary just
  // crossed (≥ the stored watermark; the few messages in between stay in L2, recallable, but skip
  // the digest once) and let the commit re-align window_low_water to a true boundary.
  let cum = 0;
  let foldedRows = 0;
  while (foldedRows < rows.length && cum < session.windowLowWater) {
    cum += msgCount(rows[foldedRows]!);
    foldedRows += 1;
  }
  if (cum !== session.windowLowWater) {
    console.warn(
      `[l1] fold watermark drifted (stored ${session.windowLowWater}, row boundary ${cum}) — healing`,
    );
  }

  const keep = recentTurns();
  const unfoldedTurns = rows.length - foldedRows;
  if (unfoldedTurns <= keep + foldBatchTurns()) return null;

  const toFold = unfoldedTurns - keep; // bring the window back to RECENT_TURNS
  const anchor = anchorImportance();
  let newLowWater = cum; // the healed, row-aligned base (== stored watermark when no drift)
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
