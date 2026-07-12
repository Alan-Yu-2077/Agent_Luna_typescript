import { describe, expect, test } from 'bun:test';
import {
  collectValues,
  createWizardNav,
  nextLabelKey,
  probeFieldsFor,
  probeGateAction,
  STEP_GUIDES,
  wizardSteps,
} from './setupWizard';
import { SETUP_COPY } from './setupCopy';

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

describe('walkthrough guides (v0.35.4)', () => {
  test('every step has a guide whose text + link labels resolve in the copy table', () => {
    for (const step of wizardSteps()) {
      const guide = STEP_GUIDES[step.id];
      expect(SETUP_COPY[guide.textKey], `text for ${step.id}`).toBeDefined();
      for (const link of guide.links) {
        expect(SETUP_COPY[link.labelKey], `label for ${link.href}`).toBeDefined();
        expect(link.href.startsWith('https://')).toBe(true);
      }
    }
  });

  test('link audit: each vendor console + resource link appears exactly once', () => {
    const hrefs = Object.values(STEP_GUIDES).flatMap((g) => g.links.map((l) => l.href));
    const expected = [
      'https://console.anthropic.com',
      'https://platform.openai.com/api-keys',
      'https://app.tavily.com',
      'https://dev.qweather.com',
      'https://b23.tv/NOg9J41',
      'https://www.live2d.com/en/learn/sample/',
      'https://b23.tv/cTW61p1',
      'https://github.com/RVC-Boss/GPT-SoVITS',
    ];
    for (const url of expected) expect(hrefs.filter((h) => h === url).length, url).toBe(1);
    expect(hrefs.length).toBe(expected.length);
  });
});

describe('probe gate (v0.35.1)', () => {
  test('Next on a filled, untested step probes first — the skip-confirm branch', () => {
    expect(probeGateAction(true, 'none')).toBe('probe');
  });
  test('empty fields, a passed probe, or an armed failure all advance', () => {
    expect(probeGateAction(false, 'none')).toBe('advance');
    expect(probeGateAction(true, 'ok')).toBe('advance');
    expect(probeGateAction(true, 'fail')).toBe('advance'); // second click = continue anyway
  });
  test('a failed probe relabels Next as continue-anyway', () => {
    expect(nextLabelKey('fail', false)).toBe('wizard.continueAnyway');
    expect(nextLabelKey('none', false)).toBe('wizard.next');
    expect(nextLabelKey('ok', true)).toBe('wizard.finish');
  });
});

describe('probeFieldsFor', () => {
  test('embedding: null without a key; full trio (with defaults) once the key is set', () => {
    const values = new Map<string, string>([
      ['LUNA_EMBEDDING_MODEL', 'text-embedding-3-large'],
      ['LUNA_EMBEDDING_BASE_URL', 'https://api.openai.com'],
    ]);
    expect(probeFieldsFor('embedding', values)).toBeNull();
    values.set('LUNA_EMBEDDING_API_KEY', 'sk-e');
    expect(probeFieldsFor('embedding', values)).toEqual({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-e',
      model: 'text-embedding-3-large',
    });
  });
  test('weather: either field filled triggers the probe (so a lone key gets the host hint)', () => {
    expect(probeFieldsFor('weather', new Map())).toBeNull();
    expect(probeFieldsFor('weather', new Map([['LUNA_WEATHER_API_KEY', 'k']]))).toEqual({
      apiKey: 'k',
      apiHost: '',
    });
  });
  test('search: key or nothing', () => {
    expect(probeFieldsFor('search', new Map())).toBeNull();
    expect(probeFieldsFor('search', new Map([['LUNA_WEB_SEARCH_API_KEY', ' tvly-1 ']]))).toEqual({
      apiKey: 'tvly-1',
    });
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
