import { describe, expect, test } from 'bun:test';
import { changedFields, maskKey, MODULE_CARDS, probeFieldsFor } from './modulesConfig';
import { diffLines, hasChanges } from './personaEditor';

describe('maskKey — recognisable, never retypeable (v0.44.6)', () => {
  test('the sk-gt6U…wxyz shape', () => {
    expect(maskKey('sk-gt6U1234567890abcdwxyz')).toBe('sk-gt6U…wxyz');
  });
  test('short values collapse to one visible char', () => {
    expect(maskKey('abc')).toBe('a…');
  });
  test('empty reads 未配置, not an empty mask', () => {
    expect(maskKey('')).toBe('未配置');
    expect(maskKey('   ')).toBe('未配置');
  });
});

describe('changedFields — only what changed reaches mergeEnvFile', () => {
  test('untouched and blank fields never ride along', () => {
    const edits = new Map([
      ['LUNA_MODEL', 'claude-opus-5'],
      ['ANTHROPIC_BASE_URL', '   '], // blanked in the UI — must NOT clobber the stored value
    ]);
    expect(changedFields(MODULE_CARDS, edits)).toEqual({ LUNA_MODEL: 'claude-opus-5' });
  });

  test('a key outside every card is ignored even if present in the edit map', () => {
    const edits = new Map([['LUNA_TTS_URL', 'http://x']]);
    expect(changedFields(MODULE_CARDS, edits)).toEqual({});
  });
});

describe('probeFieldsFor — each card probes with exactly its own fields', () => {
  const valueOf = (key: string): string => `<${key}>`;
  test('the chat card carries base/key/model', () => {
    const chat = MODULE_CARDS.find((c) => c.id === 'chat')!;
    expect(probeFieldsFor(chat, valueOf)).toEqual({
      baseUrl: '<ANTHROPIC_BASE_URL>',
      apiKey: '<ANTHROPIC_API_KEY>',
      model: '<LUNA_MODEL>',
    });
  });
  test('the weather card carries key + host (the post-2024 per-account host lesson)', () => {
    const weather = MODULE_CARDS.find((c) => c.id === 'weather')!;
    expect(probeFieldsFor(weather, valueOf)).toEqual({
      apiKey: '<LUNA_WEATHER_API_KEY>',
      apiHost: '<LUNA_WEATHER_API_HOST>',
    });
  });
});

describe('the module card shape', () => {
  test('every secret field is marked — the mask discipline is declared, not remembered', () => {
    const secrets = MODULE_CARDS.flatMap((c) => c.fields.filter((f) => f.secret).map((f) => f.key));
    expect(secrets.sort()).toEqual(
      ['ANTHROPIC_API_KEY', 'LUNA_EMBEDDING_API_KEY', 'LUNA_WEATHER_API_KEY', 'LUNA_WEB_SEARCH_API_KEY'].sort(),
    );
  });
});

describe('diffLines — the save preview (v0.44.6)', () => {
  test('unchanged, removed and added lines classify in document order', () => {
    const diff = diffLines('a\nb\nc', 'a\nc\nd');
    expect(diff).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'same', text: 'c' },
      { kind: 'added', text: 'd' },
    ]);
  });
  test('identical texts have no changes — the save button refuses a no-op', () => {
    expect(hasChanges(diffLines('x\ny', 'x\ny'))).toBe(false);
    expect(hasChanges(diffLines('x', 'x\ny'))).toBe(true);
  });
});
