import type Anthropic from '@anthropic-ai/sdk';
import { Mutex } from '../tools/mutex';
import { loadSession } from '../memory/sessionStore';

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
  // anchoring, tracked via cadence). Drives the proactive idle gap. Init to
  // boot time so she never proactive-fires until a fresh idle gap elapses.
  lastUserMs: number;
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

export function resetSessions(): void {
  sessions.clear();
}
