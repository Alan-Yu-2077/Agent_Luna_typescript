import { trace } from '../../trace/instrument';

// Action-integrity defection detection (Initiative 4, v0.8.0). Pure + zero-LLM:
// detection is a synchronous function over what the turn already produced. The
// only consumer-visible output is one `decision` trace, recorded off the hot
// path (in runTurn's finally, before flushTrace). Observes only — correction is
// v0.8.2.

// Promise-to-act phrasings. Matched against DELIVERED MESSAGE TEXT (verbatim) —
// the user-facing promise itself. Deliberately NOT matched against thinking as
// the load-bearing signal: our thinking is display:'summarized' and may drop or
// paraphrase intent, so thinking matches are a separate audit-only tier below.
export const PROMISE_PATTERNS: readonly RegExp[] = [
  // CJK: a first-person / imminent marker, then within a short same-clause
  // window an action verb. Audit-only breadth is acceptable — v0.8.2's
  // corrective retry uses a double exit precisely because this is fuzzy.
  /(?:我|让我|马上|这就|稍等|先)[^。！？!?\n]{0,5}(?:查|搜索|搜|读|找一?下|看看|记一下|记下来?)/,
  // English
  /\bi'?ll\s+(?:search|check|look|read|find|recall|remember|see)\b/i,
  /\blet me\s+(?:search|check|look|read|find|recall|see)\b/i,
  /\b(?:going to|gonna)\s+(?:search|check|look|read|find)\b/i,
];

export type DefectionKind = 'is_final_promise' | 'message_intent' | 'thinking_intent';

export type DefectionResult =
  | { defected: false }
  | { defected: true; kind: DefectionKind; matched: string };

export type DefectionInput = {
  messageTexts: string[];
  lastIsFinal: boolean | null;
  thinking: string;
  calledToolNames: string[];
  finishReason: string;
};

function firstPromiseMatch(text: string): string | null {
  for (const re of PROMISE_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

// Confidence order: structural first, then verbatim message text, then (audit-
// only) summarized thinking. Returns the first hit.
export function detectDefection(input: DefectionInput): DefectionResult {
  const { messageTexts, lastIsFinal, thinking, calledToolNames, finishReason } = input;

  // 1. Structural: the last delivered message said "more coming" (is_final:false)
  //    yet the turn ended cleanly. Mechanically certain, no dictionary.
  if (finishReason === 'end_turn' && lastIsFinal === false) {
    return { defected: true, kind: 'is_final_promise', matched: 'is_final:false' };
  }

  const actedViaTool = calledToolNames.some((n) => n !== 'message');
  if (actedViaTool) return { defected: false };

  // 2. Message-text heuristic: a delivered bubble promised an act, none fired.
  for (const text of messageTexts) {
    const matched = firstPromiseMatch(text);
    if (matched) return { defected: true, kind: 'message_intent', matched };
  }

  // 3. Thinking heuristic (audit-only tier): low-confidence by construction
  //    (summarized). Counted, but v0.8.2 must never retry on this kind.
  const thinkingMatch = firstPromiseMatch(thinking);
  if (thinkingMatch) return { defected: true, kind: 'thinking_intent', matched: thinkingMatch };

  return { defected: false };
}

export type AuditState = {
  turnId: string;
  sessionId: string;
  messageTexts: string[];
  lastMessageIsFinal: boolean | null;
  thinking: string;
  toolNamesThisTurn: string[];
  finishReason: string;
};

// Synchronous, gated, never throws into the turn (override-not-depend). Records
// one `decision` trace when a defection is detected. No LLM call anywhere.
export function runDefectionAudit(s: AuditState): DefectionResult {
  if (Bun.env['LUNA_DECISION_AUDIT'] !== '1') return { defected: false };
  try {
    const result = detectDefection({
      messageTexts: s.messageTexts,
      lastIsFinal: s.lastMessageIsFinal,
      thinking: s.thinking,
      calledToolNames: s.toolNamesThisTurn,
      finishReason: s.finishReason,
    });
    if (result.defected) {
      trace({
        schema_v: 1,
        kind: 'decision',
        trace_id: s.turnId,
        turn_id: s.turnId,
        session_id: s.sessionId,
        t_ms: Date.now(),
        surface: 'intent_no_act',
        decision: 'defected',
        reason: result.matched,
        evidence: {
          kind: result.kind,
          matched: result.matched,
          called_tools: s.toolNamesThisTurn,
        },
      });
    }
    return result;
  } catch {
    // an audit must never fail a turn
    return { defected: false };
  }
}
