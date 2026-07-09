import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../../sql';
import { setMemoryDb } from '../../memory/sessionStore';
import { listFacts } from '../../memory/l3Store';
import { getSoul } from '../../memory/soulStore';
import { rememberTool } from './remember';

let db: Database;

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

type RememberInput =
  | { action: 'add'; category: string; text: string }
  | { action: 'forget'; id: string }
  | { action: 'update_self'; self_state?: string; relationship_status?: string };

async function run(input: RememberInput): Promise<{ kind: string; data?: { status: string; id?: string } }> {
  const events: unknown[] = [];
  for await (const e of rememberTool.execute(input, ctx())) events.push(e);
  return events[0] as { kind: string; data?: { status: string; id?: string } };
}

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
  setMemoryDb(db);
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
});

describe('remember tool (discriminated actions)', () => {
  test('add stores a fact', async () => {
    const e = await run({ action: 'add', category: 'core_facts', text: 'Sam codes in TS' });
    expect(e.kind).toBe('ok');
    expect(e.data?.status).toBe('added');
    expect(listFacts({ category: 'core_facts' }).length).toBe(1);
  });

  test('forget soft-deletes by id', async () => {
    const added = await run({ action: 'add', category: 'preferences', text: 'likes houseplants' });
    const e = await run({ action: 'forget', id: added.data!.id! });
    expect(e.data?.status).toBe('forgotten');
    expect(listFacts({ category: 'preferences' }).length).toBe(0);
  });

  test('update_self patches the soul evolving section (v0.30.3)', async () => {
    const e = await run({ action: 'update_self', relationship_status: 'growing closer' });
    expect(e.data?.status).toBe('self_updated');
    expect(getSoul().evolving_bond).toBe('growing closer');
  });

  test('update_self with identical values is a no-op write (the updateEvolving guard, v0.21.7)', async () => {
    await run({ action: 'update_self', self_state: 'calm', relationship_status: 'close' });
    const auditAfter = () =>
      (db.prepare('SELECT COUNT(*) c FROM soul_audit').get() as { c: number }).c;
    const before = auditAfter();
    const e = await run({ action: 'update_self', self_state: 'calm', relationship_status: 'close' });
    expect(e.data?.status).toBe('self_updated'); // the tool still reports success
    expect(auditAfter()).toBe(before); // ...but no audit row was appended (no-op)
  });

  test('unconfigured memory db → structured err, not a throw', async () => {
    setMemoryDb(null);
    const e = await run({ action: 'add', category: 'core_facts', text: 'x' });
    expect(e.kind).toBe('err');
  });

  test('summarize renders status + id', () => {
    expect(rememberTool.summarize({ status: 'added', id: 'cf_1' })).toBe('added: cf_1');
    expect(rememberTool.summarize({ status: 'self_updated' })).toBe('self_updated');
  });
});

describe('remember input schema (gateway-safe flat object)', () => {
  test('per-action requirements enforced via superRefine', () => {
    expect(rememberTool.input.safeParse({ action: 'add' }).success).toBe(false);
    expect(
      rememberTool.input.safeParse({ action: 'add', category: 'core_facts', text: 'x' }).success,
    ).toBe(true);
    expect(rememberTool.input.safeParse({ action: 'forget' }).success).toBe(false);
    expect(rememberTool.input.safeParse({ action: 'forget', id: 'cf_1' }).success).toBe(true);
    expect(rememberTool.input.safeParse({ action: 'update_self' }).success).toBe(false);
    expect(
      rememberTool.input.safeParse({ action: 'update_self', self_state: 'calm' }).success,
    ).toBe(true);
  });

  test('wrong field name ("content") → recoverable miss on the right field, not a union blob', () => {
    const r = rememberTool.input.safeParse({
      action: 'add',
      category: 'core_facts',
      content: 'wrong key',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'text')).toBe(true);
    }
  });
});
