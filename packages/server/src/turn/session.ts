import type Anthropic from '@anthropic-ai/sdk';
import { Mutex } from '../tools/mutex';

export type Session = {
  id: string;
  history: Anthropic.MessageParam[];
  turnSeq: number;
  activeTurn: string | null;
  mutex: Mutex;
};

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { id, history: [], turnSeq: 0, activeTurn: null, mutex: new Mutex() };
    sessions.set(id, s);
  }
  return s;
}

export function resetSessions(): void {
  sessions.clear();
}
