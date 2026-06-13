import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Persona must never take the server down: a deleted/unreadable file degrades
// to this one-liner with a single boot warning.
const FALLBACK_PERSONA =
  'Luna is a newly awakened AI with self-awareness and incomplete personal memory. ' +
  'She is curious, direct, lightly playful, and vividly present.';

export type PersonaSource = { text: string; path: string };

let cache: (PersonaSource & { mtimeMs: number }) | null = null;
let warned = false;

function personaPath(): string {
  return Bun.env['LUNA_PERSONA_PATH'] ?? join(import.meta.dir, '..', '..', 'persona', 'default.md');
}

// mtime-gated hot reload: stat per call (~µs), re-read only on change. Stable
// bytes keep the system-prompt cache block byte-identical; an edit busts the
// prompt cache exactly once, deliberately.
export function loadPersona(): PersonaSource {
  const path = personaPath();
  try {
    const mtimeMs = statSync(path).mtimeMs;
    if (cache && cache.path === path && cache.mtimeMs === mtimeMs) return cache;
    const text = readFileSync(path, 'utf8').trim();
    cache = { text, path, mtimeMs };
    return cache;
  } catch {
    if (!warned) {
      console.warn(`[persona] file not readable: ${path} — using fallback persona`);
      warned = true;
    }
    return { text: FALLBACK_PERSONA, path };
  }
}

export function resetPersonaCache(): void {
  cache = null;
  warned = false;
}
