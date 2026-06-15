import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveInWorkspace } from '../tools/workspace';
import { buildSelfEditProposal } from './selfEdit';

const dir = mkdtempSync(join(tmpdir(), 'luna-selfedit-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const serverSrc = join(import.meta.dir, '..'); // code/ -> packages/server/src

describe('propose_self_edit (buildSelfEditProposal)', () => {
  test('a normal file → produces a diff and NEVER writes the target', () => {
    const f = join(dir, 'normal.ts');
    const original = 'export const answer = 1;\n';
    writeFileSync(f, original);

    const p = buildSelfEditProposal({ targetPath: f, oldString: 'answer = 1', newString: 'answer = 42' });
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.diff).toContain('answer = 42');
      expect(p.proposalId.length).toBeGreaterThan(0);
    }
    // propose-only: the file on disk is untouched.
    expect(readFileSync(f, 'utf8')).toBe(original);
  });

  test('KEYSTONE — the evaluator firewall hard-rejects a proposed edit (by basename)', () => {
    // *.test.ts and tsconfig*.json are blocked by basename, existence-independent.
    for (const name of ['something.test.ts', 'tsconfig.json', 'tsconfig.base.json']) {
      const p = buildSelfEditProposal({ targetPath: join(dir, name), oldString: 'x', newString: 'y' });
      expect(p.ok).toBe(false);
    }
  });

  test('KEYSTONE — the firewall rejects proposed edits to the named evaluator files', () => {
    const named = [
      ['persona', 'humanity.ts'],
      ['persona', 'l1Contract.ts'],
      ['tools', 'workspace.ts'], // the sandbox itself
      ['tools', 'shellDeny.ts'], // the shell deny-regex
      ['proactive', 'safetyGate.ts'],
    ];
    for (const rel of named) {
      const target = join(serverSrc, ...rel);
      const p = buildSelfEditProposal({ targetPath: target, oldString: 'x', newString: 'y' });
      expect(p.ok).toBe(false);
      if (!p.ok) expect(p.reason.toLowerCase()).toContain('firewall');
    }
  });

  test('the firewall is the same gate every write tool uses (read allowed, write blocked)', () => {
    const humanity = join(serverSrc, 'persona', 'humanity.ts');
    expect(resolveInWorkspace(humanity, 'read').ok).toBe(true); // she can READ her evaluator
    expect(resolveInWorkspace(humanity, 'write').ok).toBe(false); // never WRITE it
    expect(resolveInWorkspace(humanity, 'execute').ok).toBe(false);
  });
});
