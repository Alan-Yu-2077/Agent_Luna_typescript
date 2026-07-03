import { describe, expect, test } from 'bun:test';
import { classifyProbe, mergeEnvFile, needsOnboarding } from './onboarding';
import { parseEnvFile } from './envfile';

describe('needsOnboarding', () => {
  test('true when the key is absent, empty, or the placeholder', () => {
    expect(needsOnboarding({})).toBe(true);
    expect(needsOnboarding({ ANTHROPIC_API_KEY: '' })).toBe(true);
    expect(needsOnboarding({ ANTHROPIC_API_KEY: '   ' })).toBe(true);
    expect(needsOnboarding({ ANTHROPIC_API_KEY: 'sk-not-configured' })).toBe(true);
  });

  test('false once a real key is present', () => {
    expect(needsOnboarding({ ANTHROPIC_API_KEY: 'sk-real-123' })).toBe(false);
  });
});

describe('mergeEnvFile', () => {
  test('replaces an existing key in place, preserving comments + unrelated keys', () => {
    const existing = [
      '# my config',
      'ANTHROPIC_API_KEY=',
      'ANTHROPIC_BASE_URL=',
      'LUNA_MODEL=claude-sonnet-4-6',
      '',
      '# weather',
      'LUNA_LAT_LON=31.23,121.47',
      'LUNA_PET_MODE=1',
    ].join('\n');
    const merged = mergeEnvFile(existing, {
      ANTHROPIC_API_KEY: 'sk-real',
      ANTHROPIC_BASE_URL: 'https://yunwu.ai',
      LUNA_MODEL: 'claude-opus-4-8',
    });
    const parsed = parseEnvFile(merged);
    expect(parsed['ANTHROPIC_API_KEY']).toBe('sk-real');
    expect(parsed['ANTHROPIC_BASE_URL']).toBe('https://yunwu.ai');
    expect(parsed['LUNA_MODEL']).toBe('claude-opus-4-8');
    // untouched
    expect(parsed['LUNA_LAT_LON']).toBe('31.23,121.47');
    expect(parsed['LUNA_PET_MODE']).toBe('1');
    expect(merged).toContain('# my config');
    expect(merged).toContain('# weather');
  });

  test('appends a key that had no existing line', () => {
    const merged = mergeEnvFile('# empty config\n', { ANTHROPIC_API_KEY: 'sk-x' });
    expect(parseEnvFile(merged)['ANTHROPIC_API_KEY']).toBe('sk-x');
    expect(merged).toContain('# empty config');
  });

  test('does not touch a commented-out key of the same name', () => {
    const merged = mergeEnvFile('#ANTHROPIC_API_KEY=old\n', { ANTHROPIC_API_KEY: 'new' });
    // the commented line stays; the real value is appended
    expect(merged).toContain('#ANTHROPIC_API_KEY=old');
    expect(parseEnvFile(merged)['ANTHROPIC_API_KEY']).toBe('new');
  });

  test('a re-run overwrites the previously-written value without duplicating the line', () => {
    const first = mergeEnvFile('ANTHROPIC_API_KEY=\n', { ANTHROPIC_API_KEY: 'sk-1' });
    const second = mergeEnvFile(first, { ANTHROPIC_API_KEY: 'sk-2' });
    expect(parseEnvFile(second)['ANTHROPIC_API_KEY']).toBe('sk-2');
    expect(second.split('\n').filter((l) => l.startsWith('ANTHROPIC_API_KEY=')).length).toBe(1);
  });
});

describe('classifyProbe', () => {
  test('2xx and 400 mean authenticated + reached the model → ok', () => {
    expect(classifyProbe(200).ok).toBe(true);
    expect(classifyProbe(400).ok).toBe(true); // request-shape detail (max_tokens), auth passed
  });
  test('401/403 → key rejected', () => {
    expect(classifyProbe(401)).toMatchObject({ ok: false });
    expect(classifyProbe(403).ok).toBe(false);
    expect(classifyProbe(401).error).toContain('key');
  });
  test('404 → base URL / endpoint', () => {
    expect(classifyProbe(404).ok).toBe(false);
    expect(classifyProbe(404).error).toContain('base URL');
  });
  test('null (fetch threw) → unreachable URL', () => {
    expect(classifyProbe(null).ok).toBe(false);
    expect(classifyProbe(null).error).toContain('URL');
  });
  test('other non-2xx (5xx/429) → surfaced, not ok', () => {
    expect(classifyProbe(500).ok).toBe(false);
    expect(classifyProbe(429).ok).toBe(false);
  });
});
