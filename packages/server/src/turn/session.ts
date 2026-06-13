import type Anthropic from '@anthropic-ai/sdk';
import { Mutex } from '../tools/mutex';
import { loadSession } from '../memory/sessionStore';

export type Session = {
  id: string;
  history: Anthropic.MessageParam[];
  turnSeq: number;
  activeTurn: string | null;
  pendingDream: string | null;
  rollingSummary: string;
  windowLowWater: number;
  // True until the first turn after process boot — drives the wake scene
  // block. Deliberately NOT persisted: a restart genuinely is a fresh wake.
  wakePending: boolean;
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
      pendingDream: null,
      rollingSummary: persisted?.rollingSummary ?? '',
      windowLowWater: persisted?.windowLowWater ?? 0,
      wakePending: true,
      mutex: new Mutex(),
    };
    sessions.set(id, s);
  }
  return s;
}

export function resetSessions(): void {
  sessions.clear();
}
