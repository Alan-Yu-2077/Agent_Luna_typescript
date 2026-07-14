import { describe, expect, test } from 'bun:test';
import { WIZARD_KEYS, classifyProbe, filterWizardFields, mergeEnvFile, needsOnboarding, wizardFlagEnabled, wizardPrefill } from './onboarding';
import { parseEnvFile } from './envfile';

describe('wizardFlagEnabled (v0.35.4 default flip)', () => {
  test('the wizard is the default; =0 is the one-release escape hatch', () => {
    expect(wizardFlagEnabled(undefined)).toBe(true);
    expect(wizardFlagEnabled('')).toBe(true);
    expect(wizardFlagEnabled('1')).toBe(true);
    expect(wizardFlagEnabled('0')).toBe(false);
  });
});

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
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      LUNA_MODEL: 'claude-opus-4-8',
    });
    const parsed = parseEnvFile(merged);
    expect(parsed['ANTHROPIC_API_KEY']).toBe('sk-real');
    expect(parsed['ANTHROPIC_BASE_URL']).toBe('https://api.anthropic.com');
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

  test('a value with an embedded newline cannot inject a second KEY= line (v0.28.3 review)', () => {
    const merged = mergeEnvFile('ANTHROPIC_API_KEY=\n', {
      ANTHROPIC_API_KEY: 'sk-abc\nLUNA_WEB_SEARCH_API_KEY=stolen',
    });
    const parsed = parseEnvFile(merged);
    // the newline is stripped → the payload can't become its own key; the whole thing stays one value
    expect(parsed['LUNA_WEB_SEARCH_API_KEY']).toBeUndefined();
    expect(merged).not.toContain('\nLUNA_WEB_SEARCH_API_KEY=stolen');
    expect(merged.split('\n').filter((l) => l.startsWith('ANTHROPIC_API_KEY=')).length).toBe(1);
  });
});

describe('filterWizardFields (v0.35.0)', () => {
  test('keeps only whitelisted keys — anything else is dropped, never persisted', () => {
    const out = filterWizardFields({
      ANTHROPIC_API_KEY: 'sk-k',
      LUNA_WORKSPACE_ROOT: '/tmp/evil',
      RANDOM_KEY: 'y',
      LUNA_SQLITE_LIB: '/evil.dylib',
    });
    expect(out).toEqual({ ANTHROPIC_API_KEY: 'sk-k' });
  });

  test('trims values and drops empties so a blank field never clobbers luna.env', () => {
    const out = filterWizardFields({
      ANTHROPIC_BASE_URL: '  https://api.anthropic.com  ',
      LUNA_WEATHER_API_KEY: '   ',
      LUNA_MODEL: '',
    });
    expect(out).toEqual({ ANTHROPIC_BASE_URL: 'https://api.anthropic.com' });
  });

  test('non-string and non-object inputs are ignored safely', () => {
    expect(filterWizardFields({ ANTHROPIC_API_KEY: 42, LUNA_MODEL: null })).toEqual({});
    expect(filterWizardFields(null)).toEqual({});
    expect(filterWizardFields('ANTHROPIC_API_KEY=x')).toEqual({});
  });

  test('every wizard key survives the filter (whitelist is not lossy for its own set)', () => {
    const all: Record<string, string> = {};
    for (const k of WIZARD_KEYS) all[k] = 'v';
    expect(Object.keys(filterWizardFields(all)).sort()).toEqual([...WIZARD_KEYS].sort());
  });

  test('a filtered map through mergeEnvFile cannot inject lines (composes with sanitize)', () => {
    const fields = filterWizardFields({ ANTHROPIC_API_KEY: 'sk-a\nLUNA_PET_MODE=1' });
    const merged = mergeEnvFile('ANTHROPIC_API_KEY=\n', fields);
    expect(parseEnvFile(merged)['LUNA_PET_MODE']).toBeUndefined();
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


describe('bug scenario: baseUrl with = characters', () => {
  test('complete end-to-end: merge, write, read back URL with query params', () => {
    // Simulate the exact scenario from the bug claim
    const baseUrl = 'https://x.com?a=1&b=2';
    const apiKey = 'sk-valid';
    const model = 'claude-opus-4-8';
    
    // Step 1: probeConnection succeeds (mocked as passed above)
    // Step 2: mergeEnvFile is called with unescaped URL
    const template = `# Luna desktop configuration
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=
LUNA_MODEL=claude-sonnet-4-6
`;
    
    const merged = mergeEnvFile(template, {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_API_KEY: apiKey,
      LUNA_MODEL: model,
    });
    
    // Step 3: file is written (simulated by the merged string)
    // Step 4: sidecarEnv calls parseEnvFile to read the merged content
    const parsed = parseEnvFile(merged);
    
    // Verify the file is NOT corrupted — values must parse exactly
    expect(parsed['ANTHROPIC_BASE_URL']).toBe(baseUrl);
    expect(parsed['ANTHROPIC_API_KEY']).toBe(apiKey);
    expect(parsed['LUNA_MODEL']).toBe(model);
  });
});

// v0.37.8: the prefill's secret custody — the renderer learns THAT a key is set, never WHAT it is.
describe('wizardPrefill', () => {
  test('returns non-secret values verbatim and secrets as names only', () => {
    const { values, configured } = wizardPrefill({
      ANTHROPIC_API_KEY: 'sk-super-secret',
      ANTHROPIC_BASE_URL: 'https://gw.example',
      LUNA_MODEL: 'claude-opus-4-8',
      LUNA_TTS_BACKEND: 'http',
    });
    expect(values['ANTHROPIC_BASE_URL']).toBe('https://gw.example');
    expect(values['LUNA_MODEL']).toBe('claude-opus-4-8');
    expect(values['LUNA_TTS_BACKEND']).toBe('http');
    expect(configured).toContain('ANTHROPIC_API_KEY');
    expect(JSON.stringify({ values, configured })).not.toContain('sk-super-secret');
  });

  test('an unset key appears nowhere (a fresh install prefills nothing)', () => {
    const { values, configured } = wizardPrefill({ ANTHROPIC_API_KEY: '   ' });
    expect(Object.keys(values).length).toBe(0);
    expect(configured.length).toBe(0);
  });

  test('a key outside the wizard whitelist is never leaked', () => {
    const { values } = wizardPrefill({ LUNA_SECRET_INTERNAL: 'x', LUNA_MODEL: 'm' });
    expect(values['LUNA_SECRET_INTERNAL']).toBeUndefined();
    expect(values['LUNA_MODEL']).toBe('m');
  });
});
