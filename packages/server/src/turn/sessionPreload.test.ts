import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import {
  appendL2,
  lastUserTurnMs,
  listRecentL2,
  persistSession,
  setMemoryDb,
} from '../memory/sessionStore';
import {
  activeSessionIds,
  getSession,
  markActivity,
  preloadSessions,
  resetSessions,
} from './session';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
});
afterEach(() => {
  setMemoryDb(null);
  resetSessions();
  db.close(false);
});

describe('preloadSessions (v0.21.6 — proactive survives a restart)', () => {
  test('warms persisted sessions into the active set + restores lastUserMs', () => {
    persistSession('default', [], 1);
    appendL2({
      sessionId: 'default',
      turnId: 'default:turn:1',
      userText: 'hi',
      assistantText: 'hey',
      rawContent: [],
    });
    const userMs = listRecentL2('default', 1)[0]!.t_ms;

    resetSessions();
    expect(activeSessionIds()).toEqual([]); // a fresh boot's map is cold

    preloadSessions();
    expect(activeSessionIds()).toContain('default');
    expect(getSession('default').lastUserMs).toBe(userMs);
  });

  test('lastUserTurnMs ignores proactive turns (her own activity is not a user gap)', () => {
    const ins = db.prepare(
      'INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json, content_hash) VALUES (?,?,?,?,?,?,?)',
    );
    ins.run('default', 'default:turn:1', 1000, 'hi', 'hey', '[]', 'h');
    ins.run('default', 'proactive:default:x', 2000, '', 'thinking of you', '[]', 'h');
    expect(lastUserTurnMs('default')).toBe(1000); // the user turn, not the later proactive
  });

  test('no persisted sessions → no-op (active set stays empty)', () => {
    resetSessions();
    preloadSessions();
    expect(activeSessionIds()).toEqual([]);
  });
});

describe('markActivity + lastActivityMs (Initiative 21, v0.29.0)', () => {
  test('preload seeds lastActivityMs from the last L2 turn of ANY kind (incl. proactive)', () => {
    const ins = db.prepare(
      'INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json, content_hash) VALUES (?,?,?,?,?,?,?)',
    );
    ins.run('default', 'default:turn:1', 1000, 'hi', 'hey', '[]', 'h');
    ins.run('default', 'proactive:default:x', 2000, '', 'thinking of you', '[]', 'h');
    persistSession('default', [], 1);

    resetSessions();
    preloadSessions();
    const s = getSession('default');
    // The escalation-reset anchor ignores her proactive turn...
    expect(s.lastUserMs).toBe(1000);
    // ...but the silence idle-timer counts her proactive reply as activity (the last thing said).
    expect(s.lastActivityMs).toBe(2000);
  });

  test('markActivity is monotonic — never rewinds the clock', () => {
    const s = getSession('default');
    s.lastActivityMs = 5000;
    markActivity(s, 4000); // an out-of-order (earlier) stamp is ignored
    expect(s.lastActivityMs).toBe(5000);
    markActivity(s, 6000); // a later stamp advances it
    expect(s.lastActivityMs).toBe(6000);
  });
});
