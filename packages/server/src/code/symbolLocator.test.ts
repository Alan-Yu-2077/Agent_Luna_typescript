import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GrepRunner } from '../tools/builtin/grep';
import { locateSymbol } from './symbolLocator';
import { forceRegexFallbackForTests } from './symbols';
import { resetTreeSitterForTests } from './treeSitter';

let tmp: string;

beforeEach(() => {
  resetTreeSitterForTests();
  forceRegexFallbackForTests(false);
  tmp = mkdtempSync(join(tmpdir(), 'luna-locate-'));
  mkdirSync(join(tmp, 'src'), { recursive: true });
});

afterEach(() => {
  forceRegexFallbackForTests(false);
  rmSync(tmp, { recursive: true, force: true });
});

describe('locateSymbol — hybrid (ripgrep candidate → tree-sitter verify)', () => {
  test('finds a definition and its references', async () => {
    writeFileSync(
      join(tmp, 'src', 'def.ts'),
      'export function dispatchToolCalls(x: number) { return x; }\n',
    );
    writeFileSync(
      join(tmp, 'src', 'use.ts'),
      'import { dispatchToolCalls } from "./def";\n' + 'const r = dispatchToolCalls(1);\n',
    );

    const res = await locateSymbol({ name: 'dispatchToolCalls', root: tmp });
    expect(res.verified).toBe(true);
    expect(res.definitions.length).toBe(1);
    expect(res.definitions[0]!.kind).toBe('function');
    expect(res.definitions[0]!.signature).toContain('dispatchToolCalls');
    // references: the import + the call site in use.ts (the def's own name node
    // is excluded). At minimum the call-site reference is present.
    expect(res.references.length).toBeGreaterThanOrEqual(1);
    expect(res.references.some((r) => r.file.endsWith('use.ts'))).toBe(true);
    expect(res.references.every((r) => r.verified)).toBe(true);
  });

  test('a same-name token in a comment is EXCLUDED by the tree-sitter pass', async () => {
    // ripgrep alone would match the comment line; tree-sitter must not count it.
    writeFileSync(
      join(tmp, 'src', 'commented.ts'),
      '// widget is mentioned here in a comment widget widget\n' +
        '/* and widget in a block comment too */\n' +
        'export function widget() { return 1; }\n' +
        'const real = widget();\n',
    );

    const res = await locateSymbol({ name: 'widget', root: tmp });
    expect(res.verified).toBe(true);
    // exactly one definition (line 3), no comment-line false positive
    expect(res.definitions.length).toBe(1);
    expect(res.definitions[0]!.line).toBe(3);
    // references must NOT include the comment lines (1, 2)
    const refLines = res.references.map((r) => r.line);
    expect(refLines).not.toContain(1);
    expect(refLines).not.toContain(2);
    // the real call site (line 4) is a reference
    expect(refLines).toContain(4);
  });

  test('kind:"def" returns only definitions', async () => {
    writeFileSync(join(tmp, 'src', 'k.ts'), 'export class Engine {}\nconst e = Engine;\n');
    const res = await locateSymbol({ name: 'Engine', root: tmp, kind: 'def' });
    expect(res.definitions.length).toBe(1);
    expect(res.references.length).toBe(0);
  });
});

describe('locateSymbol — grammar-absent fallback', () => {
  test('with tree-sitter forced off, candidates return marked verified:false', async () => {
    forceRegexFallbackForTests(true);
    writeFileSync(
      join(tmp, 'src', 'def.ts'),
      'export function thing() { return 1; }\nconst u = thing();\n',
    );

    const res = await locateSymbol({ name: 'thing', root: tmp });
    expect(res.verified).toBe(false);
    // it still returns candidates (degrade, never hard-fail)
    expect(res.references.length).toBeGreaterThanOrEqual(1);
    expect(res.references.every((r) => r.verified === false)).toBe(true);
  });

  test('a file with no grammar (e.g. .py) degrades to unverified candidates', async () => {
    writeFileSync(join(tmp, 'src', 'thing.py'), 'def thing():\n    return thing\n');
    // inject a deterministic grep runner so the test does not depend on rg/ext
    const runner: GrepRunner = async () => ({
      hits: [
        { path: join(tmp, 'src', 'thing.py'), line: 1, col: 5, text: 'def thing():' },
        { path: join(tmp, 'src', 'thing.py'), line: 2, col: 12, text: '    return thing' },
      ],
      total: 2,
    });
    const res = await locateSymbol({ name: 'thing', root: tmp, grepRunner: runner });
    expect(res.verified).toBe(false);
    expect(res.references.length).toBe(2);
    expect(res.references.every((r) => r.verified === false)).toBe(true);
  });
});
