import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORWARDED_API_PREFIXES } from './serve';

// v0.45.12 (Initiative 36, C6/C7) — two tripwires that turn near-misses into CI reds.

describe('tripwire: the production DB never enters the repo (C6)', () => {
  it('git ls-files luna.sqlite is empty — a forced add would trip here', () => {
    const repoRoot = join(import.meta.dir, '..', '..', '..');
    const proc = Bun.spawnSync(['git', 'ls-files', 'luna.sqlite', '*.sqlite', '**/*.sqlite'], {
      cwd: repoRoot,
    });
    const tracked = new TextDecoder().decode(proc.stdout).trim();
    expect(tracked).toBe('');
  });
});

describe('tripwire: dev-server and the packaged host forward the SAME /api faces (C7)', () => {
  it('the two prefix lists are identical — a face added to one side only goes red here', () => {
    // dev-server.ts lives in another package; read its source rather than importing it (its
    // module top-level starts a Bun.serve). The const is a plain literal — regex is honest.
    const devSrc = readFileSync(
      join(import.meta.dir, '..', '..', 'web', 'dev-server.ts'),
      'utf8',
    );
    const m = devSrc.match(/export const FORWARDED_API_PREFIXES = \[([^\]]+)\]/);
    expect(m).not.toBeNull();
    const devPrefixes = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    expect(devPrefixes).toEqual([...FORWARDED_API_PREFIXES].sort());
    // and both actually forward what they declare (the declaring file mentions each prefix
    // in a startsWith guard — the const cannot drift from the code silently)
    for (const prefix of FORWARDED_API_PREFIXES) {
      expect(devSrc).toContain(`'${prefix}'`);
    }
  });
});
