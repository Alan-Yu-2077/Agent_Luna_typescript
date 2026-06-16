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

// Web-lookup intent phrasings (Initiative 11, v0.18.0). Matched against the
// thinking summary to detect the web-specific 嘴上说手没动 defection: thinking
// decided to search the web, but the turn ended with no web_search call. Audit-
// only (no forced retry — Python deferred it pending data; same here), so
// breadth is acceptable. Kept WEB-SHAPED (search/网上/联网/上网) on purpose: bare
// 查一下 / 查询 are generic lookup verbs the L1 contract treats as discharged by
// recall / read_file too, so matching them flagged honest non-web turns and
// poisoned the very dataset this audit collects (v0.18.x review fix).
export const WEB_INTENT_PATTERNS: readonly RegExp[] = [
  /搜索|搜一下|搜一搜|上网查|上网搜|联网搜|联网查|网上查|网上搜/,
  /\b(?:search (?:the web|online|for)|web ?search|look (?:it|this|that) up|google (?:it|this|that)|do a (?:web )?search)\b/i,
];

// Returns the first matched lookup keyword, or null. Pure.
export function detectWebSearchIntentNoCall(thinking: string): string | null {
  for (const re of WEB_INTENT_PATTERNS) {
    const m = re.exec(thinking);
    if (m) return m[0];
  }
  return null;
}

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

// v0.9.0 tuning, from two false-positive classes recorded by the v0.8.0/v0.8.1
// audit on real turns:
//   - negated verbs ("我真查不到" = I genuinely can't check) — an honest decline
//   - capability/conditional offers ("我立刻就能读" = I could read it, if…) — an offer
// Neither is a present-tense promise the model is failing to keep, so they are
// filtered out of message_intent.
const NEGATION_AFTER = /^(?:不[到了行]|没)/;
const CAPABILITY_MODAL = /能|会|可以|能够/;

function isRealPromise(matched: string, after: string): boolean {
  if (NEGATION_AFTER.test(after)) return false; // verb followed by 不到/没… → can't
  if (CAPABILITY_MODAL.test(matched)) return false; // 能/可以/会 + verb → could, not will
  return true;
}

function firstPromiseMatch(text: string): string | null {
  for (const re of PROMISE_PATTERNS) {
    // global so a false-positive first hit doesn't mask a real promise later
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length);
      if (isRealPromise(m[0], after)) return m[0];
      if (m.index === g.lastIndex) g.lastIndex++; // avoid zero-width loop
    }
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
  // v0.18.0: whether web_search was mounted this turn. The web intent-no-call
  // audit only fires when it was — you cannot defect on a tool you do not have.
  webSearchMounted?: boolean;
  // v0.18.2 read/write boundary: this turn pulled untrusted web content (a
  // web_search / web_fetch call) AND fired a surface-risk (irreversible) tool.
  // Both true → a web_to_action decision trace (detection only, no hard gate).
  webContentThisTurn?: boolean;
  surfaceActionThisTurn?: boolean;
};

// Synchronous, gated, never throws into the turn (override-not-depend). Records
// one `decision` trace when a defection is detected. No LLM call anywhere.
export function runDefectionAudit(s: AuditState): DefectionResult {
  // default ON since v0.9.0; LUNA_DECISION_AUDIT=0 opts out
  if (Bun.env['LUNA_DECISION_AUDIT'] === '0') return { defected: false };
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
    // Web-search intent-no-call audit (v0.18.0): a separate decision surface,
    // independent of the generic defection above. Fires only when web_search was
    // mounted, no web_search call fired this turn, and the thinking shows a web-
    // lookup intent. Zero cost on success turns. No forced retry.
    // Fire only on a TRUE 嘴上说手没动: web_search mounted, thinking shows a
    // web-lookup intent, and the turn acted via NO tool at all. A turn that
    // discharged the intent through ANY tool — recall (which the L1 web clause
    // explicitly blesses), web_fetch, read_file, grep… — has acted, so it is not
    // a web-search defection. Mirrors detectDefection's actedViaTool short-circuit
    // (line 98); !actedViaAnyTool already subsumes the old !includes('web_search').
    const actedViaAnyTool = s.toolNamesThisTurn.some((n) => n !== 'message');
    if (s.webSearchMounted === true && !actedViaAnyTool) {
      const keyword = detectWebSearchIntentNoCall(s.thinking);
      if (keyword) {
        trace({
          schema_v: 1,
          kind: 'decision',
          trace_id: s.turnId,
          turn_id: s.turnId,
          session_id: s.sessionId,
          t_ms: Date.now(),
          surface: 'web_search_intent_no_call',
          decision: 'defected',
          reason: keyword,
          evidence: {
            matched_keyword: keyword,
            thinking_tail: s.thinking.slice(-200),
            called_tools: s.toolNamesThisTurn,
          },
        });
      }
    }
    // Read/write trust boundary (v0.18.2): a turn that read untrusted web content
    // and then fired an irreversible/surface-risk tool. Recorded as an observable
    // pattern (a hard gate only if the data later shows abuse — LD #14 discipline).
    if (s.webContentThisTurn === true && s.surfaceActionThisTurn === true) {
      trace({
        schema_v: 1,
        kind: 'decision',
        trace_id: s.turnId,
        turn_id: s.turnId,
        session_id: s.sessionId,
        t_ms: Date.now(),
        surface: 'web_to_action',
        decision: 'observed',
        reason: 'surface-risk tool fired in a turn that read untrusted web content',
        evidence: { called_tools: s.toolNamesThisTurn },
      });
    }
    return result;
  } catch {
    // an audit must never fail a turn
    return { defected: false };
  }
}
