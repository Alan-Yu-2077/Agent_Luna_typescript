import { afterEach, describe, expect, test } from 'bun:test';
import { isLintable, lintContent, lintOnWriteEnabled, lintSummary } from './lintOnWrite';

const savedFlag = Bun.env['LUNA_LINT_ON_WRITE'];

afterEach(() => {
  if (savedFlag === undefined) delete Bun.env['LUNA_LINT_ON_WRITE'];
  else Bun.env['LUNA_LINT_ON_WRITE'] = savedFlag;
});

describe('lintOnWrite — isLintable', () => {
  test('TS/JS family is lintable; others skip', () => {
    for (const f of ['a.ts', 'a.tsx', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs']) {
      expect(isLintable(f)).toBe(true);
    }
    for (const f of ['a.json', 'a.md', 'a.py', 'a.txt', 'README']) {
      expect(isLintable(f)).toBe(false);
    }
  });
});

describe('lintOnWrite — diagnostics', () => {
  test('clean TS yields no diagnostics', () => {
    expect(lintContent('a.ts', 'export const x: number = 1;\n')).toEqual([]);
  });

  test('a syntactically broken TS file returns at least one diagnostic with a message', () => {
    const diags = lintContent('a.ts', 'const x = ;\n');
    expect(diags.length).toBeGreaterThan(0);
    expect(typeof diags[0]!.message).toBe('string');
    expect(diags[0]!.message.length).toBeGreaterThan(0);
  });

  test('multiple syntax errors surface multiple diagnostics with positions', () => {
    const diags = lintContent('a.ts', 'function f( { return 1 }\n');
    expect(diags.length).toBeGreaterThan(0);
    // AggregateError path carries position info per BuildMessage
    const withLine = diags.find((d) => typeof d.line === 'number');
    expect(withLine).toBeDefined();
  });

  test('JSX parses under the tsx loader (no false positive)', () => {
    expect(lintContent('a.tsx', 'const el = <div className="x">hi</div>;\nexport {};\n')).toEqual([]);
  });

  test('a non-lintable extension is never parsed (returns [])', () => {
    // deliberately-invalid "TS" but a .json extension → skipped
    expect(lintContent('a.json', 'const x = ;')).toEqual([]);
  });

  test('type errors are NOT caught (fast syntactic parse only, not full tsc)', () => {
    // a type error is valid syntax → the fast parse passes (full tsc is v0.15.2)
    expect(lintContent('a.ts', 'const x: number = "string";\n')).toEqual([]);
  });
});

describe('lintOnWrite — flag', () => {
  test('LUNA_LINT_ON_WRITE=0 disables linting (returns [])', () => {
    Bun.env['LUNA_LINT_ON_WRITE'] = '0';
    expect(lintOnWriteEnabled()).toBe(false);
    expect(lintContent('a.ts', 'const x = ;\n')).toEqual([]);
  });

  test('default (unset) is ON', () => {
    delete Bun.env['LUNA_LINT_ON_WRITE'];
    expect(lintOnWriteEnabled()).toBe(true);
  });
});

describe('lintOnWrite — summary', () => {
  test('summary suffix reflects the count', () => {
    expect(lintSummary([])).toBe('');
    expect(lintSummary([{ message: 'x' }])).toContain('1 lint issue');
    expect(lintSummary([{ message: 'x' }, { message: 'y' }])).toContain('2 lint issues');
  });
});
