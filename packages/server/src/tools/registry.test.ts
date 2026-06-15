import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolEvent } from '@luna/protocol';
import {
  builtinRegistry,
  codeWriteEnabled,
  repoMapEnabled,
  shellEnabled,
  withCodeWrite,
  withRepoMap,
  withShell,
} from './registry';
import { dispatchToolCalls } from './dispatcher';
import { Mutex } from './mutex';
import { markRead, resetReadTracking } from './readTracking';
import { resolveInWorkspace } from './workspace';

const savedFlag = Bun.env['LUNA_CODE_WRITE'];
const savedShell = Bun.env['LUNA_SHELL'];
const savedRepoMap = Bun.env['LUNA_REPO_MAP'];
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];

afterEach(() => {
  if (savedFlag === undefined) delete Bun.env['LUNA_CODE_WRITE'];
  else Bun.env['LUNA_CODE_WRITE'] = savedFlag;
  if (savedShell === undefined) delete Bun.env['LUNA_SHELL'];
  else Bun.env['LUNA_SHELL'] = savedShell;
  if (savedRepoMap === undefined) delete Bun.env['LUNA_REPO_MAP'];
  else Bun.env['LUNA_REPO_MAP'] = savedRepoMap;
});

describe('LUNA_CODE_WRITE flag gates the write tools', () => {
  test('default (unset) → write tools mounted', () => {
    delete Bun.env['LUNA_CODE_WRITE'];
    expect(codeWriteEnabled()).toBe(true);
    const reg = withCodeWrite(builtinRegistry);
    expect(reg.edit).toBeDefined();
    expect(reg.multi_edit).toBeDefined();
    expect(reg.write_file).toBeDefined();
  });

  test('LUNA_CODE_WRITE=0 → write tools ABSENT from the registry', () => {
    Bun.env['LUNA_CODE_WRITE'] = '0';
    expect(codeWriteEnabled()).toBe(false);
    const reg = withCodeWrite(builtinRegistry);
    expect(reg.edit).toBeUndefined();
    expect(reg.multi_edit).toBeUndefined();
    expect(reg.write_file).toBeUndefined();
    // the read-only tools are still present
    expect(reg.read_file).toBeDefined();
    expect(reg.list_files).toBeDefined();
    expect(reg.grep).toBeDefined();
  });

  test('with the flag off, a dispatched edit resolves to tool_not_found', async () => {
    Bun.env['LUNA_CODE_WRITE'] = '0';
    const reg = withCodeWrite(builtinRegistry);
    const events: ToolEvent[] = [];
    for await (const e of dispatchToolCalls(
      [{ call_id: 'c1', tool_name: 'edit', input: { path: 'x', old_string: 'a', new_string: 'b' } }],
      { sessionId: 's', sessionMutex: new Mutex() },
      reg,
    )) {
      events.push(e);
    }
    const final = events.find((e) => e.kind === 'final');
    expect(final?.kind).toBe('final');
    if (final?.kind === 'final') {
      expect(final.result.kind).toBe('err');
      if (final.result.kind === 'err') expect(final.result.code).toBe('tool_not_found');
    }
  });
});

describe('LUNA_SHELL flag gates the shell + verify tools', () => {
  test('default (unset) → shell + verify tools mounted', () => {
    delete Bun.env['LUNA_SHELL'];
    expect(shellEnabled()).toBe(true);
    const reg = withShell(builtinRegistry);
    expect(reg.shell).toBeDefined();
    expect(reg.typecheck).toBeDefined();
    expect(reg.run_tests).toBeDefined();
    expect(reg.lint).toBeDefined();
  });

  test('LUNA_SHELL=0 → shell + verify tools ABSENT from the registry', () => {
    Bun.env['LUNA_SHELL'] = '0';
    expect(shellEnabled()).toBe(false);
    const reg = withShell(builtinRegistry);
    expect(reg.shell).toBeUndefined();
    expect(reg.typecheck).toBeUndefined();
    expect(reg.run_tests).toBeUndefined();
    expect(reg.lint).toBeUndefined();
    // read-only tools unaffected
    expect(reg.read_file).toBeDefined();
    expect(reg.grep).toBeDefined();
  });

  test('with LUNA_SHELL off, a dispatched shell resolves to tool_not_found', async () => {
    Bun.env['LUNA_SHELL'] = '0';
    const reg = withShell(builtinRegistry);
    const events: ToolEvent[] = [];
    for await (const e of dispatchToolCalls(
      [{ call_id: 'c1', tool_name: 'shell', input: { command: 'echo hi' } }],
      { sessionId: 's', sessionMutex: new Mutex() },
      reg,
    )) {
      events.push(e);
    }
    const final = events.find((e) => e.kind === 'final');
    expect(final?.kind).toBe('final');
    if (final?.kind === 'final' && final.result.kind === 'err') {
      expect(final.result.code).toBe('tool_not_found');
    } else {
      throw new Error('expected a tool_not_found error');
    }
  });
});

describe('LUNA_REPO_MAP flag gates repo_map + find_symbol (plan ships on always)', () => {
  test('plan is in the base registry regardless of any flag', () => {
    expect(builtinRegistry.plan).toBeDefined();
  });

  test('default (unset) → repo_map + find_symbol mounted', () => {
    delete Bun.env['LUNA_REPO_MAP'];
    expect(repoMapEnabled()).toBe(true);
    const reg = withRepoMap(builtinRegistry);
    expect(reg.repo_map).toBeDefined();
    expect(reg.find_symbol).toBeDefined();
    expect(reg.plan).toBeDefined();
  });

  test('LUNA_REPO_MAP=0 → repo_map + find_symbol ABSENT, plan still present', () => {
    Bun.env['LUNA_REPO_MAP'] = '0';
    expect(repoMapEnabled()).toBe(false);
    const reg = withRepoMap(builtinRegistry);
    expect(reg.repo_map).toBeUndefined();
    expect(reg.find_symbol).toBeUndefined();
    // plan is unaffected by the flag (owner: "plan ships on")
    expect(reg.plan).toBeDefined();
    // read-only nav tools unaffected
    expect(reg.grep).toBeDefined();
    expect(reg.list_files).toBeDefined();
  });
});

// The safety check (b): a firewall write must be refused END-TO-END through a real
// edit tool dispatched via the registry — not just by a direct resolveInWorkspace
// unit call. This routes an `edit` of a *.test.ts file all the way through the
// dispatcher and asserts the firewall blocks it with the file untouched.
describe('evaluator firewall refusal routed THROUGH the edit tool (registry → dispatcher)', () => {
  let tmp: string;
  const SESSION = 'fw-e2e';

  beforeEach(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-fw-')));
    Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
    delete Bun.env['LUNA_CODE_WRITE'];
    resetReadTracking();
  });

  afterEach(() => {
    if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
    else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
    resetReadTracking();
    rmSync(tmp, { recursive: true, force: true });
  });

  async function dispatchEdit(path: string, oldS: string, newS: string): Promise<ToolEvent[]> {
    const reg = withCodeWrite(builtinRegistry);
    const events: ToolEvent[] = [];
    for await (const e of dispatchToolCalls(
      [{ call_id: 'c1', tool_name: 'edit', input: { path, old_string: oldS, new_string: newS } }],
      { sessionId: SESSION, sessionMutex: new Mutex() },
      reg,
    )) {
      events.push(e);
    }
    return events;
  }

  test('editing a *.test.ts is refused at the firewall (file untouched)', async () => {
    const file = join(tmp, 'guard.test.ts');
    writeFileSync(file, 'const x = 1;\n');
    // even mark it read so ONLY the firewall can be the reason it is refused
    const gate = resolveInWorkspace('guard.test.ts', 'read');
    if (gate.ok) markRead(SESSION, gate.resolved);

    const events = await dispatchEdit('guard.test.ts', 'const x = 1;', 'const x = 2;');
    const final = events.find((e) => e.kind === 'final');
    expect(final?.kind).toBe('final');
    if (final?.kind === 'final' && final.result.kind === 'err') {
      expect(final.result.message).toContain('evaluator firewall');
      expect(final.result.recoverable).toBe(false);
    } else {
      throw new Error('expected an error final event');
    }
    expect(readFileSync(file, 'utf8')).toBe('const x = 1;\n'); // never written
  });

  test('editing the sandbox file itself (workspace.ts) is refused', async () => {
    // workspace.ts lives in this same dir; reference it by absolute path
    const self = join(import.meta.dir, 'workspace.ts');
    const gate = resolveInWorkspace(self, 'read');
    if (gate.ok) markRead(SESSION, gate.resolved);
    const events = await dispatchEdit(self, 'export type Access', 'export type Hacked');
    const final = events.find((e) => e.kind === 'final');
    if (final?.kind === 'final' && final.result.kind === 'err') {
      expect(final.result.message).toContain('evaluator firewall');
    } else {
      throw new Error('expected an error final event');
    }
  });
});
