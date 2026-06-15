import { afterEach, describe, expect, test } from 'bun:test';
import { workspaceHandler } from './workspace';

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
    const res = await workspaceHandler(post('/_workspace/api/edit', { action: 'delete', table: 'l2_turns', rowid: 1 }));
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
});
