import { describe, expect, test } from 'bun:test';
import { ENV_TEMPLATE, parseEnvFile } from './envfile';

describe('parseEnvFile (v0.26.1)', () => {
  test('parses KEY=VALUE, skips comments and blanks, strips quotes', () => {
    const parsed = parseEnvFile(
      '# comment\n\nANTHROPIC_API_KEY=sk-abc\nLUNA_MODEL="claude-sonnet-4-6"\nX=\'quoted\'\nnoequals\n=novalue\n',
    );
    expect(parsed).toEqual({
      ANTHROPIC_API_KEY: 'sk-abc',
      LUNA_MODEL: 'claude-sonnet-4-6',
      X: 'quoted',
    });
  });

  test('values may contain = (split on the first only)', () => {
    expect(parseEnvFile('URL=https://x.test/?a=1&b=2')).toEqual({
      URL: 'https://x.test/?a=1&b=2',
    });
  });

  test('the first-run template parses cleanly with empty values', () => {
    const parsed = parseEnvFile(ENV_TEMPLATE);
    expect(parsed['ANTHROPIC_API_KEY']).toBe('');
    expect(parsed['LUNA_MODEL']).toBe('claude-sonnet-4-6');
  });
});
