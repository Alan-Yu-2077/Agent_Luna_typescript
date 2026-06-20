import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentHash, resolveInWorkspace, workspaceRoot } from './workspace';

let tmp: string;
let root: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const savedHome = Bun.env['HOME'];

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'luna-ws-'));
  root = join(tmp, 'work');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'a.txt'), 'hello\n');
  Bun.env['LUNA_WORKSPACE_ROOT'] = root;
});

afterEach(() => {
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  if (savedHome === undefined) delete Bun.env['HOME'];
  else Bun.env['HOME'] = savedHome;
  rmSync(tmp, { recursive: true, force: true });
});

describe('resolveInWorkspace — no root jail, blocklist only', () => {
  test('accepts an in-root relative path', () => {
    const r = resolveInWorkspace('a.txt', 'read');
    expect(r.ok).toBe(true);
    // resolved is canonical (realpath) — on macOS /var → /private/var
    if (r.ok) expect(r.resolved).toBe(join(realpathSync(root), 'a.txt'));
  });

  test('accepts an absolute path OUTSIDE the root (no jail)', () => {
    const outside = join(tmp, 'sibling.txt');
    writeFileSync(outside, 'x');
    const r = resolveInWorkspace(outside, 'read');
    expect(r.ok).toBe(true);
  });

  test('accepts a ../-escaping path (no jail — escape is allowed)', () => {
    const outside = join(tmp, 'up.txt');
    writeFileSync(outside, 'x');
    const r = resolveInWorkspace('../up.txt', 'write');
    expect(r.ok).toBe(true);
  });

  test('empty path rejected', () => {
    expect(resolveInWorkspace('', 'read').ok).toBe(false);
  });
});

describe('resolveInWorkspace — SECRET blocklist (read + write + execute)', () => {
  test('rejects .env and .env.* for every access', () => {
    for (const name of ['.env', '.env.local', '.env.production']) {
      writeFileSync(join(root, name), 'SECRET=1');
      for (const access of ['read', 'write', 'execute'] as const) {
        expect(resolveInWorkspace(name, access).ok).toBe(false);
      }
    }
  });

  test('rejects *.pem, *.key, id_rsa* for every access', () => {
    for (const name of ['server.pem', 'tls.key', 'id_rsa', 'id_rsa.pub']) {
      writeFileSync(join(root, name), 'x');
      expect(resolveInWorkspace(name, 'read').ok).toBe(false);
      expect(resolveInWorkspace(name, 'write').ok).toBe(false);
    }
  });

  test('rejects ~/.ssh, ~/.aws, ~/.gnupg, ~/.config/gcloud as secret dirs', () => {
    const fakeHome = join(tmp, 'home');
    Bun.env['HOME'] = fakeHome;
    for (const sub of ['.ssh', '.aws', '.gnupg', join('.config', 'gcloud'), join('Library', 'Keychains')]) {
      const dir = join(fakeHome, sub);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'thing');
      writeFileSync(file, 'x');
      expect(resolveInWorkspace(file, 'read').ok).toBe(false);
      expect(resolveInWorkspace(file, 'write').ok).toBe(false);
    }
  });

  test('rejects ~/.npmrc, ~/.netrc, ~/.docker/config.json secret files', () => {
    const fakeHome = join(tmp, 'home2');
    mkdirSync(join(fakeHome, '.docker'), { recursive: true });
    Bun.env['HOME'] = fakeHome;
    writeFileSync(join(fakeHome, '.npmrc'), 'x');
    writeFileSync(join(fakeHome, '.netrc'), 'x');
    writeFileSync(join(fakeHome, '.docker', 'config.json'), '{}');
    expect(resolveInWorkspace(join(fakeHome, '.npmrc'), 'read').ok).toBe(false);
    expect(resolveInWorkspace(join(fakeHome, '.netrc'), 'read').ok).toBe(false);
    expect(resolveInWorkspace(join(fakeHome, '.docker', 'config.json'), 'read').ok).toBe(false);
  });

  test('rejects a SYMLINK that points into a secret dir', () => {
    const fakeHome = join(tmp, 'home3');
    const ssh = join(fakeHome, '.ssh');
    mkdirSync(ssh, { recursive: true });
    writeFileSync(join(ssh, 'id_ed25519'), 'PRIVATE');
    Bun.env['HOME'] = fakeHome;
    const link = join(root, 'innocent');
    symlinkSync(ssh, link);
    // realpath resolves the symlink → caught by the .ssh secret-dir rule
    const r = resolveInWorkspace(join(link, 'id_ed25519'), 'read');
    expect(r.ok).toBe(false);
  });
});

describe('resolveInWorkspace — EVALUATOR FIREWALL (write/execute blocked, read allowed)', () => {
  const serverSrc = join(import.meta.dir, '..');

  test('the sandbox file itself: read ok, write/execute blocked', () => {
    const self = join(import.meta.dir, 'workspace.ts');
    expect(resolveInWorkspace(self, 'read').ok).toBe(true);
    expect(resolveInWorkspace(self, 'write').ok).toBe(false);
    expect(resolveInWorkspace(self, 'execute').ok).toBe(false);
  });

  test('humanity.ts and l1Contract.ts: write blocked, read allowed', () => {
    for (const rel of [join('persona', 'humanity.ts'), join('persona', 'l1Contract.ts')]) {
      const f = join(serverSrc, rel);
      expect(resolveInWorkspace(f, 'read').ok).toBe(true);
      expect(resolveInWorkspace(f, 'write').ok).toBe(false);
    }
  });

  // v0.20.0 — the deny-regex enforcers, not just the deny-regex data, are firewalled.
  test('shell enforcer files (shell.ts/shellCore.ts/run_tests.ts): write blocked, read allowed', () => {
    for (const rel of [
      join('tools', 'builtin', 'shell.ts'),
      join('tools', 'shellCore.ts'),
      join('tools', 'builtin', 'run_tests.ts'),
    ]) {
      const f = join(serverSrc, rel);
      expect(resolveInWorkspace(f, 'read').ok).toBe(true);
      expect(resolveInWorkspace(f, 'write').ok).toBe(false);
      expect(resolveInWorkspace(f, 'execute').ok).toBe(false);
    }
  });

  test('any *.test.ts: write blocked, read allowed', () => {
    const f = join(root, 'foo.test.ts');
    writeFileSync(f, 'x');
    expect(resolveInWorkspace(f, 'read').ok).toBe(true);
    expect(resolveInWorkspace(f, 'write').ok).toBe(false);
    expect(resolveInWorkspace(f, 'execute').ok).toBe(false);
  });

  test('any tsconfig*.json: write blocked, read allowed', () => {
    for (const name of ['tsconfig.json', 'tsconfig.base.json', 'tsconfig.build.json']) {
      const f = join(root, name);
      writeFileSync(f, '{}');
      expect(resolveInWorkspace(f, 'read').ok).toBe(true);
      expect(resolveInWorkspace(f, 'write').ok).toBe(false);
    }
  });

  test('prettier/lint config: write blocked', () => {
    for (const name of ['.prettierrc', '.prettierrc.json', '.eslintrc.json', 'eslint.config.js']) {
      const f = join(root, name);
      writeFileSync(f, '{}');
      expect(resolveInWorkspace(f, 'write').ok).toBe(false);
    }
  });

  test('a normal source file: write allowed', () => {
    const f = join(root, 'feature.ts');
    writeFileSync(f, 'export const x = 1;');
    expect(resolveInWorkspace(f, 'write').ok).toBe(true);
    expect(resolveInWorkspace(f, 'execute').ok).toBe(true);
  });
});

// macOS/Windows filesystems are case-insensitive, so `.ENV` / `ID_RSA` / `Secret.PEM`
// / `Foo.Test.ts` name the same entry as their lowercase form. The blocklist must
// fold case on those platforms or a case-variant write target bypasses BOTH tiers —
// the load-bearing hole v0.15.1's write tool plugs into.
const caseInsensitiveFs = process.platform === 'darwin' || process.platform === 'win32';
const describeCaseFold = caseInsensitiveFs ? describe : describe.skip;

describeCaseFold('resolveInWorkspace — case-insensitive FS blocklist folding', () => {
  test('SECRET case variants are BLOCKED for write (no bypass)', () => {
    for (const name of ['.ENV', '.Env.Local', 'secret.PEM', 'private.Key', 'ID_RSA', 'ID_RSA.PUB']) {
      const r = resolveInWorkspace(name, 'write');
      expect(r.ok).toBe(false);
    }
  });

  test('SECRET case variants are BLOCKED for read + execute too', () => {
    for (const name of ['.ENV', 'Server.Pem', 'TLS.Key', 'Id_Rsa']) {
      expect(resolveInWorkspace(name, 'read').ok).toBe(false);
      expect(resolveInWorkspace(name, 'execute').ok).toBe(false);
    }
  });

  test('EVALUATOR-FIREWALL case variants are BLOCKED for write', () => {
    for (const name of ['foo.Test.ts', 'Foo.TEST.TS', 'TSConfig.json', 'tsconfig.BASE.json', '.Prettierrc']) {
      const r = resolveInWorkspace(name, 'write');
      expect(r.ok).toBe(false);
    }
  });

  test('EVALUATOR-FIREWALL case variants stay READABLE (read allowed)', () => {
    // case-folding must not over-block read access on the firewall tier
    expect(resolveInWorkspace('foo.Test.ts', 'read').ok).toBe(true);
    expect(resolveInWorkspace('TSConfig.json', 'read').ok).toBe(true);
  });

  test('a secret-DIR case variant is blocked (~/.SSH/...)', () => {
    const fakeHome = join(tmp, 'home-case');
    const ssh = join(fakeHome, '.ssh');
    mkdirSync(ssh, { recursive: true });
    writeFileSync(join(ssh, 'id_ed25519'), 'PRIVATE');
    Bun.env['HOME'] = fakeHome;
    // request the upper-case path variant; on a case-insensitive FS it is the same dir
    const r = resolveInWorkspace(join(fakeHome, '.SSH', 'id_ed25519'), 'read');
    expect(r.ok).toBe(false);
  });

  test('case folding does NOT over-block an unrelated source file', () => {
    const f = join(root, 'Feature.TS');
    writeFileSync(f, 'export const x = 1;');
    expect(resolveInWorkspace(f, 'write').ok).toBe(true);
  });
});

describe('helpers', () => {
  test('workspaceRoot reflects LUNA_WORKSPACE_ROOT', () => {
    expect(workspaceRoot()).toBe(root);
  });

  test('contentHash is stable + sensitive to change', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
    expect(contentHash('').length).toBe(64);
  });
});
