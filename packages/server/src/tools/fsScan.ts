// Ignore-aware filesystem scan shared by list_files + grep (Initiative 8,
// v0.15.0). A built-in ignore set plus .gitignore-derived entries keep tree walks
// out of vendored / build / VCS noise. Deliberately small: full gitignore glob
// semantics are out of scope — we honor the built-in set always and treat each
// non-glob .gitignore line as a path-segment match (the 90% case).

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Always-ignored directory/segment names — VCS, deps, build output, virtualenvs.
export const BUILTIN_IGNORE_DIRS = new Set<string>([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.DS_Store',
]);

// Binary-ish extensions skipped by grep's content scan + list_files' default.
export const BINARY_EXTENSIONS = new Set<string>([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.mp3', '.wav', '.flac', '.ogg', '.m4a',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.pdf', '.zip', '.gz', '.tar', '.tgz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.wasm', '.so', '.dylib', '.dll', '.bin', '.exe', '.o', '.a',
  '.sqlite', '.db', '.pyc',
]);

export type IgnoreMatcher = (relPath: string, isDir: boolean) => boolean;

// Build an ignore matcher rooted at `root`. Combines the built-in set with simple
// .gitignore lines (literal segment names; glob lines that contain `*` are
// reduced to their non-glob basename when possible, else skipped).
export function buildIgnore(root: string): IgnoreMatcher {
  const extra = new Set<string>();
  const gi = join(root, '.gitignore');
  if (existsSync(gi)) {
    try {
      const lines = readFileSync(gi, 'utf8').split('\n');
      for (const raw of lines) {
        const line = raw.trim();
        if (line.length === 0 || line.startsWith('#') || line.startsWith('!')) continue;
        const cleaned = line.replace(/^\/+/, '').replace(/\/+$/, '');
        if (cleaned.length === 0 || cleaned.includes('*') || cleaned.includes('/')) continue;
        extra.add(cleaned);
      }
    } catch {
      /* unreadable .gitignore → built-in set only */
    }
  }
  return (relPath, _isDir) => {
    const segments = relPath.split(sep);
    for (const seg of segments) {
      if (BUILTIN_IGNORE_DIRS.has(seg)) return true;
      if (extra.has(seg)) return true;
    }
    return false;
  };
}

export type WalkEntry = { abs: string; rel: string; type: 'file' | 'dir' };

export type WalkOptions = {
  recursive: boolean;
  includeHidden: boolean;
  maxEntries: number;
  ignore: IgnoreMatcher;
  // Security-sensitive callers (grep's content scan) skip symlinked entries
  // entirely, so a symlink planted in the tree can't surface a file outside it.
  // Mirrors ripgrep's default (no --follow). Default false (list_files shows them).
  excludeSymlinks?: boolean;
};

// Breadth-first walk yielding entries until maxEntries, then setting truncated.
// Symlinked dirs are not descended into (loop / escape safety).
export async function walk(
  root: string,
  opts: WalkOptions,
): Promise<{ entries: WalkEntry[]; truncated: boolean }> {
  const entries: WalkEntry[] = [];
  const queue: string[] = [root];
  let truncated = false;

  while (queue.length > 0) {
    const dir = queue.shift()!;
    let listing: Array<{ name: string; isFile: boolean; isDir: boolean; isSymlink: boolean }>;
    try {
      const { readdir } = await import('node:fs/promises');
      const dirents = await readdir(dir, { withFileTypes: true });
      listing = dirents.map((d) => ({
        name: d.name,
        isFile: d.isFile(),
        isDir: d.isDirectory(),
        isSymlink: d.isSymbolicLink(),
      }));
    } catch {
      continue;
    }

    for (const ent of listing) {
      if (!opts.includeHidden && ent.name.startsWith('.')) continue;
      const abs = join(dir, ent.name);
      const rel = relative(root, abs) || ent.name;
      if (opts.ignore(rel, ent.isDir)) continue;
      if (opts.excludeSymlinks && ent.isSymlink) continue;

      const type: 'file' | 'dir' = ent.isDir ? 'dir' : 'file';
      if (entries.length >= opts.maxEntries) {
        truncated = true;
        return { entries, truncated };
      }
      entries.push({ abs, rel, type });

      if (ent.isDir && !ent.isSymlink && opts.recursive) {
        queue.push(abs);
      }
    }
  }

  return { entries, truncated };
}
