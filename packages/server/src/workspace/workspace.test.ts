import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { workspaceHandler } from './workspace';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { getSoul } from '../memory/soulStore';

// S2 (v0.16.0): the mutating /_workspace routes must require LUNA_DEV_TOOLS=1.
// The gate is checked before any DB access, so these need no memory DB.

const prev = Bun.env['LUNA_DEV_TOOLS'];
afterEach(() => {
  if (prev === undefined) delete Bun.env['LUNA_DEV_TOOLS'];
  else Bun.env['LUNA_DEV_TOOLS'] = prev;
});

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('workspace mutating-route gate', () => {
  test('passes through non-/_workspace requests', async () => {
    const res = await workspaceHandler(new Request('http://localhost/something'));
    expect(res).toBeNull();
  });

  test('/reset is 403 without LUNA_DEV_TOOLS', async () => {
    delete Bun.env['LUNA_DEV_TOOLS'];
    const res = await workspaceHandler(post('/_workspace/api/reset', { confirm: true }));
    expect(res?.status).toBe(403);
  });

  test('/edit is 403 without LUNA_DEV_TOOLS', async () => {
    delete Bun.env['LUNA_DEV_TOOLS'];
    const res = await workspaceHandler(
      post('/_workspace/api/edit', { action: 'delete', table: 'l2_turns', rowid: 1 }),
    );
    expect(res?.status).toBe(403);
  });

  test('/reset passes the gate with LUNA_DEV_TOOLS=1 (no 403)', async () => {
    Bun.env['LUNA_DEV_TOOLS'] = '1';
    const res = await workspaceHandler(post('/_workspace/api/reset', { confirm: true }));
    // Past the gate: whatever the DB outcome, it is not the gate's 403.
    expect(res?.status).not.toBe(403);
  });

  test('read-only /all is not gated by LUNA_DEV_TOOLS', async () => {
    delete Bun.env['LUNA_DEV_TOOLS'];
    const res = await workspaceHandler(new Request('http://localhost/_workspace/api/all'));
    expect(res).not.toBeNull();
    expect(res?.status).not.toBe(403);
  });

  test('soul read /soul GET is not gated; the writes are (403 without dev tools)', async () => {
    delete Bun.env['LUNA_DEV_TOOLS'];
    const read = await workspaceHandler(new Request('http://localhost/_workspace/api/soul'));
    expect(read?.status).not.toBe(403);
    const save = await workspaceHandler(post('/_workspace/api/soul', { fixed: 'x' }));
    expect(save?.status).toBe(403);
    const reseed = await workspaceHandler(post('/_workspace/api/soul/reseed', { confirm: true }));
    expect(reseed?.status).toBe(403);
  });
});

describe('workspace skills panel (v0.32.3)', () => {
  let db: Database;
  afterEach(() => {
    setMemoryDb(null);
    db.close(false);
  });

  test('GET /skills is open; POST is dev-tools-gated; writes go through the audited store', async () => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);

    delete Bun.env['LUNA_DEV_TOOLS'];
    const read = await workspaceHandler(new Request('http://localhost/_workspace/api/skills'));
    expect(read?.status).not.toBe(403);
    const gated = await workspaceHandler(
      post('/_workspace/api/skills', { action: 'save', name: 'x', description: 'd', body: 'b' }),
    );
    expect(gated?.status).toBe(403);

    Bun.env['LUNA_DEV_TOOLS'] = '1';
    const saved = await workspaceHandler(
      post('/_workspace/api/skills', { action: 'save', name: 'owner-skill', description: 'd', body: 'b' }),
    );
    expect(saved?.status).toBe(200);
    const { getSkill } = await import('../skills/skillStore');
    expect(getSkill('owner-skill')!.source).toBe('owner');

    const dep = await workspaceHandler(post('/_workspace/api/skills', { action: 'deprecate', name: 'owner-skill' }));
    expect(dep?.status).toBe(200);
    expect(getSkill('owner-skill')!.deprecated_ms).toBeGreaterThan(0);
    const res = await workspaceHandler(post('/_workspace/api/skills', { action: 'restore', name: 'owner-skill' }));
    expect(res?.status).toBe(200);
    expect(getSkill('owner-skill')!.deprecated_ms).toBe(0);

    const payload = (await (
      await workspaceHandler(new Request('http://localhost/_workspace/api/skills'))
    )!.json()) as { skills: Array<{ name: string; audit: unknown[] }>; writable: boolean };
    expect(payload.writable).toBe(true);
    const row = payload.skills.find((s) => s.name === 'owner-skill')!;
    expect(row.audit.length).toBeGreaterThan(0); // the lifecycle left an audit tail
  });
});

describe('workspace soul editor (v0.31.0)', () => {
  let db: Database;
  afterEach(() => {
    setMemoryDb(null);
    db.close(false);
  });

  test('POST /soul writes the owner-edited fixed core through to the soul', async () => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
    Bun.env['LUNA_DEV_TOOLS'] = '1';

    const res = await workspaceHandler(
      post('/_workspace/api/soul', { fixed: 'owner core', self: 'becoming', bond: 'trusting' }),
    );
    expect(res?.status).toBe(200);
    const soul = getSoul();
    expect(soul.fixed_text).toBe('owner core');
    expect(soul.evolving_self).toBe('becoming');
    expect(soul.evolving_bond).toBe('trusting');
  });
});
