import type Anthropic from '@anthropic-ai/sdk';
import { Mutex } from '../tools/mutex';
import { lastUserTurnMs, listRecentL2, listSessionIds, loadSession } from '../memory/sessionStore';

// A single todo item on the session's plan spine (Initiative 8, v0.15.3). The
// plan is the visible, revisable scaffold for multi-step code work — set/update/
// get via the `plan` tool, surfaced to the web UI as a tool.progress payload.
export type PlanItem = {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'done';
};

export type Session = {
  id: string;
  history: Anthropic.MessageParam[];
  turnSeq: number;
  activeTurn: string | null;
  // AbortController for the in-flight REACTIVE turn — aborted on client disconnect
  // (ws.handleClose) so an orphaned turn stops instead of running to completion.
  // null when no reactive turn is in flight; proactive/continuation never set it.
  activeTurnAbort: AbortController | null;
  pendingDream: string | null;
  // The current plan (session-scoped, NOT persisted — a fresh process starts
  // with no plan, like wakePending).
  plan: PlanItem[];
  rollingSummary: string;
  windowLowWater: number;
  // True until the first turn after process boot — drives the wake scene
  // block. Deliberately NOT persisted: a restart genuinely is a fresh wake.
  wakePending: boolean;
  // wall-clock of the last USER turn (not proactive — her own activity is lull
  // anchoring, tracked via cadence). Init to boot time so she never
  // proactive-fires until a fresh idle gap elapses. Since Initiative 21 (v0.29.0)
  // this drives ONLY the escalation reset (a user reply → engaged); the silence
  // gap itself reads lastActivityMs.
  lastUserMs: number;
  // wall-clock of the last conversation activity in the channel — a user message
  // OR any Luna reply (reactive / continuation / proactive). The single silence
  // idle-timer (Initiative 21, v0.29.0): silenceGap = now - lastActivityMs, bumped
  // by markActivity() at every user message + every reply-producing turn finalize.
  // Replaces the old lastUserMs-based gap so she stops interrupting a conversation
  // seconds after she herself finished replying. Monotonic; never moves backwards.
  lastActivityMs: number;
  // Wall-clock when this in-memory session was created (process boot / first
  // touch). NOT persisted — a restart is genuinely a new session, so "this
  // session: started Nm ago" resets per process (Initiative 12, v0.19.0).
  sessionStartMs: number;
  mutex: Mutex;
};

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    const persisted = loadSession(id);
    s = {
      id,
      history: persisted?.history ?? [],
      turnSeq: persisted?.turnSeq ?? 0,
      activeTurn: null,
      activeTurnAbort: null,
      pendingDream: null,
      plan: [],
      rollingSummary: persisted?.rollingSummary ?? '',
      windowLowWater: persisted?.windowLowWater ?? 0,
      wakePending: true,
      lastUserMs: Date.now(),
      lastActivityMs: Date.now(),
      sessionStartMs: Date.now(),
      mutex: new Mutex(),
    };
    sessions.set(id, s);
  }
  return s;
}

// Active session ids (the heartbeat iterates these). Single-user today, but
// kept as a list so the scheduler doesn't hardcode 'default'.
export function activeSessionIds(): string[] {
  return [...sessions.keys()];
}

// Boot warm-up (Initiative 14, v0.21.6): load the persisted sessions into the
// in-memory map so the proactive scheduler — which only iterates activeSessionIds()
// (the in-memory map) — considers them right after a restart instead of staying
// dead until the next user message. Restore lastUserMs from the last real user
// turn so the idle-gap / deep-absence math reflects the true last interaction,
// not boot time (which would otherwise reset the gap on every restart).
export function preloadSessions(): void {
  for (const id of listSessionIds()) {
    const s = getSession(id);
    const last = lastUserTurnMs(id);
    if (last != null) s.lastUserMs = last;
    // Seed the silence idle-timer from the last L2 turn of ANY kind (the same source
    // proactiveTurn.lastInteractionMs uses) so a restart doesn't reset the gap to boot
    // time; fall back to the user anchor when there's no turn history.
    const lastActivity = listRecentL2(id, 1)[0]?.t_ms ?? s.lastUserMs;
    s.lastActivityMs = lastActivity;
  }
}

// The silence idle-timer bump (Initiative 21, v0.29.0). Monotonic — a clock only moves
// forward, so an out-of-order stamp (e.g. the turn-start mark arriving after a later
// finalize) never rewinds the gap.
export function markActivity(s: Session, nowMs: number): void {
  if (nowMs > s.lastActivityMs) s.lastActivityMs = nowMs;
}

export function resetSessions(): void {
  sessions.clear();
}
