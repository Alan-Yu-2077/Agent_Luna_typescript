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
import { homedir, platform } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

export type Access = 'read' | 'write' | 'execute';

// macOS (APFS/HFS+ default) and Windows are case-INsensitive: `.ENV`, `Secret.PEM`,
// `ID_RSA`, `Foo.Test.ts` all name the same FS entry as their lowercase form. The
// blocklist must therefore case-fold its basename/named-file/dir comparisons on
// these platforms, or a case-variant write target slips past BOTH tiers (the
// load-bearing hole v0.15.1's write tool would plug into). Linux is case-sensitive,
// so we fold only where the FS does — never weakening Linux matching.
const CASE_INSENSITIVE_FS = platform() === 'darwin' || platform() === 'win32';

// Fold a path/basename for comparison: lowercased on case-insensitive platforms,
// untouched on case-sensitive ones.
function fold(s: string): string {
  return CASE_INSENSITIVE_FS ? s.toLowerCase() : s;
}

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

// Home-relative secret locations as path-segment arrays — the single source for
// BOTH the absolute blocklist (secretDirs/secretFiles, resolved under $HOME) AND
// the env-indirection tail check (isSecretTailPath), which matches the same
// segments regardless of how the absolute prefix was produced.
const SECRET_DIR_SEGMENTS: string[][] = [
  ['.ssh'],
  ['.aws'],
  ['.gnupg'],
  ['.config', 'gcloud'],
  ['.password-store'],
  ['Library', 'Keychains'],
  // browser profile dirs (cookies, saved passwords, session tokens)
  ['Library', 'Application Support', 'Google', 'Chrome'],
  ['Library', 'Application Support', 'Firefox'],
  ['.config', 'google-chrome'],
  ['.mozilla', 'firefox'],
  // v0.38.5 — Windows equivalents, under %USERPROFILE% (home()). Matching is case-folded on win32.
  ['AppData', 'Local', 'Google', 'Chrome', 'User Data'],
  ['AppData', 'Roaming', 'Mozilla', 'Firefox'],
  ['AppData', 'Roaming', 'gcloud'],
];
const SECRET_FILE_SEGMENTS: string[][] = [['.docker', 'config.json'], ['.npmrc'], ['.netrc']];

// Secret directories: any path *inside* these is rejected for every access.
function secretDirs(): string[] {
  const h = home();
  return SECRET_DIR_SEGMENTS.map((seg) => join(h, ...seg));
}

// Secret single files: exact-path rejects for every access.
function secretFiles(): string[] {
  const h = home();
  return SECRET_FILE_SEGMENTS.map((seg) => join(h, ...seg));
}

function endsWithSegs(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  const off = hay.length - needle.length;
  return needle.every((s, i) => hay[off + i] === s);
}

function containsSegs(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((s, j) => hay[i + j] === s)) return true;
  }
  return false;
}

// Does a raw path TOKEN (from shell command text) name a secret location by its
// TAIL, regardless of how the absolute prefix is produced? Catches env-var
// indirection — `$HOME/.aws/credentials`, `${HOME}/.ssh/id_ed25519` — that the
// absolute resolveInWorkspace blocklist misses because the resolved prefix isn't
// the real $HOME. Matches a secret-dir segment sequence anywhere, or a
// secret-file / secret-basename tail. Segment-exact, so `/project/.aws-config`
// (segment `.aws-config` ≠ `.aws`) is not over-blocked.
export function isSecretTailPath(token: string): boolean {
  const segs = token
    .split(/[/\\]+/)
    .filter((s) => s.length > 0)
    .map(fold);
  if (segs.length === 0) return false;
  if (isSecretBasename(segs[segs.length - 1]!)) return true;
  for (const fileSeg of SECRET_FILE_SEGMENTS) {
    if (endsWithSegs(segs, fileSeg.map(fold))) return true;
  }
  for (const dirSeg of SECRET_DIR_SEGMENTS) {
    if (containsSegs(segs, dirSeg.map(fold))) return true;
  }
  return false;
}

// Secret filename / suffix patterns (matched on the basename), rejected for every
// access wherever they live: .env / .env.* , *.pem , *.key , id_rsa* . On a
// case-insensitive FS the basename is folded first so `.ENV` / `Secret.PEM` /
// `ID_RSA` are caught too.
function isSecretBasename(rawBase: string): boolean {
  const base = fold(rawBase);
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
    join(serverSrc, 'tools', 'builtin', 'shell.ts'), // calls the deny-regex + secret-path scan (v0.20.0)
    join(serverSrc, 'tools', 'shellCore.ts'), // the real spawner/executor (v0.20.0)
    join(serverSrc, 'tools', 'builtin', 'run_tests.ts'), // parseBunTestOutput — save_skill's green/red oracle (v0.20.0)
    join(serverSrc, 'tools', 'web', 'safeFetch.ts'), // SSRF guard source (v0.18.1)
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

// On a case-insensitive FS the basename is folded first so `Foo.Test.ts` /
// `TSConfig.json` / `.Prettierrc` are caught too.
function isEvaluatorBasename(rawBase: string): boolean {
  const base = fold(rawBase);
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

// Full-path equality, case-folded on a case-insensitive FS so `/x/Secret.PEM`
// matches the named-file `/x/secret.pem`. Both args must already be canonical.
function pathEq(a: string, b: string): boolean {
  return fold(a) === fold(b);
}

// Is `child` equal to, or nested under, `dir`? Boundary-safe: "/a/bc" is NOT
// under "/a/b". Case-folded on a case-insensitive FS so a `~/.SSH/...` variant is
// still caught. Both args must already be absolute + normalized.
function isWithin(child: string, dir: string): boolean {
  const c = fold(child);
  const d = fold(dir);
  if (c === d) return true;
  const base = d.endsWith(sep) ? d : d + sep;
  return c.startsWith(base);
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
    if (pathEq(resolved, canonicalize(f))) {
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
      if (pathEq(resolved, canonicalize(f))) {
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
