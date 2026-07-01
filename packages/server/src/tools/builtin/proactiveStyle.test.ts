import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../../sql';
import { setMemoryDb } from '../../memory/sessionStore';
import { loadStyle } from '../../proactive/style';
import { setProactiveStyleTool } from './proactiveStyle';

const ctx = () => ({ sessionId: 'default', callId: 'c1', abortSignal: new AbortController().signal });

async function run(input: unknown): Promise<{ kind: string; data?: unknown }[]> {
  const events: { kind: string; data?: unknown }[] = [];
  for await (const e of setProactiveStyleTool.execute(input as never, ctx())) {
    events.push(e as { kind: string; data?: unknown });
  }
  return events;
}

let db: Database;
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
  setMemoryDb(db);
});
afterEach(() => {
  setMemoryDb(null);
  db.close(false);
});

describe('set_proactive_style tool (v0.24.2)', () => {
  test('is safe to run in a proactive turn + advertises the fixed safety bound', () => {
    expect(setProactiveStyleTool.proactiveRisk).toBe('safe');
    expect(setProactiveStyleTool.description).toContain('cannot exceed');
  });

  test('setting activeness persists it and echoes ok', async () => {
    const events = await run({ activeness: 'clingy' });
    const ok = events.find((e) => e.kind === 'ok')?.data as { ok: boolean; activeness: string };
    expect(ok.ok).toBe(true);
    expect(ok.activeness).toBe('clingy');
    expect(loadStyle().activeness).toBe('clingy');
  });

  test('setting voice notes persists them (trimmed) without changing activeness', async () => {
    await run({ activeness: 'aloof' });
    await run({ voice_notes: '  quiet, dry, a little wry  ' });
    expect(loadStyle()).toEqual({ activeness: 'aloof', voiceNotes: 'quiet, dry, a little wry' });
  });
});
