import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { resolveTtsBackend } from './ttsBackend';

// v0.43.14 — the browser voice is deleted, and this test is what keeps it deleted.
//
// Type narrowing catches the code that USES it, but not a re-import, not a resurrected copy, and —
// the half that actually bit during this change — not a DOCUMENT or a config template that still
// promises a zero-setup voice we no longer ship. The first draft of this guard scanned two source
// directories and passed while `envfile.ts` was still minting `LUNA_TTS_BACKEND=browser` into every
// new install and three docs were still calling it the default. So the sweep is repo-wide, and it
// covers prose, not just identifiers.

const REPO = join(import.meta.dir, '../../../..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'release', 'bin', 'public', 'Archive']);
// Where the browser voice is still allowed to be NAMED: the history that explains why it is gone.
// `docs/` is excluded wholesale — DEVELOPMENT.md and the roadmap are the record of the removal, and
// a changelog that cannot mention what it removed is a changelog that lies.
// `.claude/skills/` joins it for the same reason (v0.45.18): the orientation map carries a table of
// DEAD concepts precisely so someone who still remembers one can search the term and find the
// correction. A map forbidden from naming what it is correcting cannot correct anyone.
const ALLOWED = ['/docs/', '/CHANGELOG.md', '/.claude/skills/'];

function sourceFiles(dir: string, exts: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

// Windows walks with backslashes; every allowlist and needle here speaks '/' — normalise once.
// (The Windows CI leg CAUGHT this guard's own portability bug, which is exactly why that leg stays.)
const rel = (f: string): string => f.slice(REPO.length).replaceAll('\\', '/');

function hits(needle: string, exts: readonly string[]): string[] {
  return sourceFiles(REPO, exts)
    .filter((f) => !rel(f).endsWith('/packages/web/src/audio/browserVoiceRetired.test.ts'))
    .filter((f) => !ALLOWED.some((a) => rel(f).includes(a)))
    .filter((f) => readFileSync(f, 'utf8').includes(needle))
    .map(rel);
}

const CODE = ['.ts', '.tsx'] as const;
const CODE_AND_PROSE = ['.ts', '.tsx', '.md', '.example', '.json', '.html', '.css'] as const;

describe('the browser voice stays retired (v0.43.14)', () => {
  test('no module references the deleted sink or its voice picker', () => {
    for (const needle of ['WebSpeechSink', 'webSpeechSink', 'voicePick', 'pickVoice']) {
      expect(hits(needle, CODE)).toEqual([]);
    }
  });

  test('the Web Speech API is never touched again', () => {
    for (const needle of ['speechSynthesis', 'SpeechSynthesisUtterance']) {
      expect(hits(needle, CODE)).toEqual([]);
    }
  });

  test('nothing reads the retired browser-voice preference key', () => {
    // Unquoted, so `getItem("luna:voice")` and a `const KEY = 'luna:voice'` indirection both count.
    expect(hits('luna:voice', CODE)).toEqual([
      // The one permitted mention: boot CLEARS the stale key, exactly as v0.36.0 did for
      // `luna:reduce-motion`. If this list grows, something started reading it again.
      '/packages/web/src/app.ts',
    ]);
  });

  // The half the first draft missed. A config template or a setup guide that still names a backend
  // the code cannot honour is a promise the app breaks on first launch.
  test('no config template or document still offers browser as a backend', () => {
    expect(hits('LUNA_TTS_BACKEND=browser', CODE_AND_PROSE)).toEqual([]);
    // The migration test is the one thing that MUST construct the retired value — proving a legacy
    // 'browser' reads as silence is impossible without writing it down once.
    expect(hits("ttsBackend: 'browser'", CODE_AND_PROSE)).toEqual([
      '/packages/web/src/audio/ttsBackend.test.ts',
    ]);
  });

  // Naming it and PROMISING it are different things, and no needle can tell them apart. So the
  // files allowed to say the words are enumerated exactly: each one explains why the voice is gone.
  // Adding to this list is a deliberate act, which is the whole point — the first draft of this
  // guard had no prose sweep at all and four live promises sailed through it.
  test('the only places that still name the browser voice are the ones explaining its removal', () => {
    const HISTORICAL = [
      '/packages/web/src/app.ts', // the comment on the rung that replaced it
      '/packages/web/src/audio/ttsBackend.ts', // why the union lost a member
      '/packages/web/src/audio/webAudioSink.ts', // what onUnspoken used to feed
      '/packages/web/src/audio/webAudioSink.test.ts', // the ladder tests' header
      '/packages/web/src/ui/setupWizard.ts', // why the default is 'none'
    ];
    for (const needle of ['browser voice', 'browser TTS', 'zero-setup browser', '浏览器语音']) {
      for (const file of hits(needle, CODE_AND_PROSE)) {
        expect(HISTORICAL).toContain(file);
      }
    }
  });

  // The type is the real guard, but it only guards code. This pins the RESOLVED behaviour so a
  // future widening of the union has to face the question deliberately.
  test("'browser' is not a backend any input can produce", () => {
    const store = (m: Record<string, string>): Pick<Storage, 'getItem'> => ({ getItem: (k) => m[k] ?? null });
    for (const raw of ['browser', 'Browser', 'BROWSER', 'web-speech', '']) {
      expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': raw }), config: {} })).not.toBe('browser');
    }
  });
});
