import { describe, expect, test } from 'bun:test';
import { collectValues, createWizardNav, wizardSteps } from './setupWizard';

describe('wizardSteps (v0.35.0)', () => {
  test('six steps in onboarding order, chat first and required', () => {
    const steps = wizardSteps();
    expect(steps.map((s) => s.id)).toEqual(['chat', 'embedding', 'search', 'weather', 'avatar', 'voice']);
    expect(steps[0]?.optional).toBe(false);
    expect(steps.slice(1).every((s) => s.optional)).toBe(true);
  });

  test('field keys are exactly the luna.env keys the shell whitelist manages', () => {
    const keys = wizardSteps().flatMap((s) => s.fields.map((f) => f.key));
    expect(keys).toEqual([
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_API_KEY',
      'LUNA_MODEL',
      'LUNA_EMBEDDING_MODEL',
      'LUNA_EMBEDDING_API_KEY',
      'LUNA_EMBEDDING_BASE_URL',
      'LUNA_WEB_SEARCH_API_KEY',
      'LUNA_WEATHER_API_KEY',
      'LUNA_WEATHER_API_HOST',
      'LUNA_LAT_LON',
      'LUNA_TTS_URL',
    ]);
  });

  test('key fields render as password inputs (never shoulder-surfable)', () => {
    for (const f of wizardSteps().flatMap((s) => s.fields)) {
      if (f.key.endsWith('_API_KEY')) expect(f.type).toBe('password');
    }
  });
});

describe('createWizardNav', () => {
  test('walks forward and back with clamped edges', () => {
    const nav = createWizardNav(3);
    expect(nav.state()).toMatchObject({ index: 0, atFirst: true, atLast: false });
    expect(nav.back().index).toBe(0); // clamped
    expect(nav.next().index).toBe(1);
    expect(nav.next()).toMatchObject({ index: 2, atLast: true });
    expect(nav.next().index).toBe(2); // clamped
    expect(nav.back().index).toBe(1);
  });
});

describe('collectValues', () => {
  test('trims and drops empties so a skipped field never clobbers an existing luna.env line', () => {
    const values = new Map<string, string>([
      ['ANTHROPIC_API_KEY', '  sk-k  '],
      ['LUNA_WEATHER_API_KEY', '   '],
      ['LUNA_MODEL', ''],
    ]);
    expect(collectValues(values)).toEqual({ ANTHROPIC_API_KEY: 'sk-k' });
  });

  test('returns a plain object union of every step the user filled', () => {
    const values = new Map<string, string>([
      ['ANTHROPIC_API_KEY', 'sk'],
      ['LUNA_WEB_SEARCH_API_KEY', 'tvly'],
      ['LUNA_TTS_BACKEND', 'http'],
    ]);
    expect(Object.keys(collectValues(values)).length).toBe(3);
  });
});
