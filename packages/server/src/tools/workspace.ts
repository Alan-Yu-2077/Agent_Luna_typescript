// Workspace sandbox (Initiative 8, v0.15.0) — the single safety boundary every
// file/shell tool routes through.
//
// OWNER DECISION (overrides the v0.15.0 plan's root-jail design): there is NO
// root jail. read/write/execute may touch ANY absolute or relative path on the
// machine EXCEPT a sensitive-path blocklist. LUNA_WORKSPACE_ROOT is only the
// default cwd for relative paths / shell — not a confinement. The blocklist is
// therefore the *only* guardrail, so it is comprehensive and exhaustively tested.
//
// Two tiers:
//   - SECRETS — rejected for read + write + execute. Credentials and key
//     material that Luna has no business reading or mutating, ever.
//   - EVALUATOR FIREWALL — rejected for write + execute (read is allowed). The
//     files that judge/sandbox/gate Luna (tests, lint/ts config, the shell
//     deny-regex, this sandbox itself, the humanity caps, the safety gate, the
//     L1 contract, this blocklist). The DGM safeguard: she must never be able to
//     WRITE the code that judges/sandboxes/gates her.
//
// resolveInWorkspace canonicalizes (realpath where the path exists, else realpath
// the nearest existing ancestor + rejoin) and rejects on a blocklist hit. It does
// NOT confine to a root.

import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

export type Access = 'read' | 'write' | 'execute';

export type ResolveOk = { ok: true; resolved: string };
export type ResolveErr = { ok: false; reason: string };
export type ResolveResult = ResolveOk | ResolveErr;

// Default cwd for relative paths and shell. NOT a jail.
export function workspaceRoot(): string {
  return Bun.env['LUNA_WORKSPACE_ROOT'] ?? process.cwd();
}

function home(): string {
  return Bun.env['HOME'] ?? homedir();
}

// Secret directories: any path *inside* these is rejected for every access.
function secretDirs(): string[] {
  const h = home();
  return [
    join(h, '.ssh'),
    join(h, '.aws'),
    join(h, '.gnupg'),
    join(h, '.config', 'gcloud'),
    join(h, '.password-store'),
    join(h, 'Library', 'Keychains'),
    // browser profile dirs (cookies, saved passwords, session tokens)
    join(h, 'Library', 'Application Support', 'Google', 'Chrome'),
    join(h, 'Library', 'Application Support', 'Firefox'),
    join(h, '.config', 'google-chrome'),
    join(h, '.mozilla', 'firefox'),
  ];
}

// Secret single files: exact-path rejects for every access.
function secretFiles(): string[] {
  const h = home();
  return [
    join(h, '.docker', 'config.json'),
    join(h, '.npmrc'),
    join(h, '.netrc'),
  ];
}

// Secret filename / suffix patterns (matched on the basename), rejected for every
// access wherever they live: .env / .env.* , *.pem , *.key , id_rsa* .
function isSecretBasename(base: string): boolean {
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (base.endsWith('.pem') || base.endsWith('.key')) return true;
  if (base.startsWith('id_rsa')) return true;
  return false;
}

// Evaluator-firewall files (DGM safeguard): the code/config that judges, sandboxes
// or gates Luna. Read is allowed; write + execute are rejected. Resolved relative
// to the server package so the guard holds regardless of cwd.
//
// `*.test.ts`, `tsconfig*.json`, prettier/lint config are matched by pattern
// (basename) since they are many; the named source files are matched by realpath.
function evaluatorFiles(): string[] {
  // import.meta.dir = packages/server/src/tools
  const toolsDir = import.meta.dir;
  const serverSrc = resolve(toolsDir, '..');
  const repoRoot = resolve(serverSrc, '..', '..', '..');
  return [
    join(toolsDir, 'workspace.ts'), // this sandbox itself
    join(serverSrc, 'persona', 'humanity.ts'),
    join(serverSrc, 'persona', 'l1Contract.ts'),
    join(serverSrc, 'tools', 'shellDeny.ts'), // shell deny-regex source (v0.15.2)
    // safetyGate* — both the module and any sibling variants live here:
    join(serverSrc, 'proactive', 'safetyGate.ts'),
    // this blocklist file (alias of workspace.ts, kept explicit for intent):
    join(toolsDir, 'workspace.ts'),
    // prettier/lint/ts root configs:
    join(repoRoot, 'tsconfig.base.json'),
    join(repoRoot, '.prettierrc'),
    join(repoRoot, '.prettierrc.json'),
    join(repoRoot, 'eslint.config.js'),
    join(repoRoot, '.eslintrc.json'),
  ];
}

function isEvaluatorBasename(base: string): boolean {
  if (base.endsWith('.test.ts')) return true;
  if (base.startsWith('tsconfig') && base.endsWith('.json')) return true;
  if (base === '.prettierrc' || (base.startsWith('.prettierrc') && base.endsWith('.json'))) {
    return true;
  }
  if (base === '.eslintrc.json' || base === 'eslint.config.js' || base === 'eslint.config.mjs') {
    return true;
  }
  return false;
}

function basename(p: string): string {
  const parts = p.split(sep);
  return parts[parts.length - 1] ?? p;
}

// Is `child` equal to, or nested under, `dir`? Boundary-safe: "/a/bc" is NOT
// under "/a/b". Both args must already be absolute + normalized.
function isWithin(child: string, dir: string): boolean {
  if (child === dir) return true;
  const base = dir.endsWith(sep) ? dir : dir + sep;
  return child.startsWith(base);
}

// Canonicalize: realpath if the path exists; else realpath the nearest existing
// ancestor and rejoin the remaining segments. This resolves symlinks (so a
// symlink *into* a sensitive dir is caught) without requiring the leaf to exist
// (write targets and ENOENT reads must still resolve).
function canonicalize(absInput: string): string {
  if (existsSync(absInput)) {
    try {
      return realpathSync(absInput);
    } catch {
      return absInput;
    }
  }
  let dir = absInput;
  const tail: string[] = [];
  while (dir !== sep && !existsSync(dir)) {
    const b = basename(dir);
    tail.unshift(b);
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  let real = dir;
  if (existsSync(dir)) {
    try {
      real = realpathSync(dir);
    } catch {
      real = dir;
    }
  }
  return tail.length > 0 ? join(real, ...tail) : real;
}

export function resolveInWorkspace(path: string, access: Access): ResolveResult {
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, reason: 'empty path' };
  }

  // Relative paths anchor to the workspace root (default cwd), not the process
  // cwd — so a stray relative path is deterministic.
  const expanded = path.startsWith('~/') ? join(home(), path.slice(2)) : path;
  const abs = isAbsolute(expanded) ? resolve(expanded) : resolve(workspaceRoot(), expanded);
  const resolved = canonicalize(abs);
  const base = basename(resolved);

  // --- SECRETS: reject for read + write + execute ---
  if (isSecretBasename(base)) {
    return { ok: false, reason: `blocked: secret file pattern (${base})` };
  }
  for (const f of secretFiles()) {
    if (resolved === canonicalize(f)) {
      return { ok: false, reason: `blocked: secret file (${base})` };
    }
  }
  for (const d of secretDirs()) {
    if (isWithin(resolved, canonicalize(d))) {
      return { ok: false, reason: `blocked: secret directory (${d})` };
    }
  }

  // --- EVALUATOR FIREWALL: reject for write + execute only (read allowed) ---
  if (access !== 'read') {
    if (isEvaluatorBasename(base)) {
      return { ok: false, reason: `blocked: evaluator firewall (${base}) is read-only to Luna` };
    }
    for (const f of evaluatorFiles()) {
      if (resolved === canonicalize(f)) {
        return {
          ok: false,
          reason: `blocked: evaluator firewall (${base}) — Luna cannot write the code that judges her`,
        };
      }
    }
  }

  return { ok: true, resolved };
}

// sha256 of UTF-8 text — the optimistic-concurrency token v0.15.1's edit tool
// will compare against (expected_hash) before a write.
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
