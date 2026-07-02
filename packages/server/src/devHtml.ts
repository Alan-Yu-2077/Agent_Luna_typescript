import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// v0.26.1: dev-surface HTML is read lazily + degradingly. A compiled sidecar (`bun build --compile`)
// has a VIRTUAL import.meta.dir — a top-level readFileSync crashed the binary at import time. The
// dev viewers (/_chat, /_trace, /_workspace) simply degrade to a stub page in that build; running
// from source is unchanged (first request reads + caches the real file).
const STUB =
  '<!doctype html><meta charset="utf-8"><p>dev page unavailable in this build</p>';

export function lazyHtml(...segments: string[]): () => string {
  let cached: string | null = null;
  return () => {
    if (cached !== null) return cached;
    try {
      cached = readFileSync(join(...segments), 'utf8');
    } catch {
      cached = STUB;
    }
    return cached;
  };
}
