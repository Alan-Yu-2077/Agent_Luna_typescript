import { describe, expect, test } from 'bun:test';
import { detectSetupLang, makeT, SETUP_COPY } from './setupCopy';

describe('detectSetupLang (v0.35.0)', () => {
  test('a stored choice wins over the navigator language', () => {
    expect(detectSetupLang('zh-CN', 'en')).toBe('en');
    expect(detectSetupLang('en-US', 'zh')).toBe('zh');
  });
  test('zh-* navigator languages default to zh, everything else to en', () => {
    expect(detectSetupLang('zh-CN', null)).toBe('zh');
    expect(detectSetupLang('zh-TW', null)).toBe('zh');
    expect(detectSetupLang('en-GB', null)).toBe('en');
    expect(detectSetupLang('ja-JP', null)).toBe('en');
    expect(detectSetupLang(undefined, null)).toBe('en');
  });
  test('a corrupt stored value falls back to navigator detection', () => {
    expect(detectSetupLang('zh-CN', 'fr')).toBe('zh');
  });
});

describe('setup copy table', () => {
  test('every key has BOTH zh and en (parity — no half-translated wizard)', () => {
    for (const [key, entry] of Object.entries(SETUP_COPY)) {
      expect(entry.zh.length, `zh missing for ${key}`).toBeGreaterThan(0);
      expect(entry.en.length, `en missing for ${key}`).toBeGreaterThan(0);
    }
  });
  test('t() resolves the chosen language and falls back to the key when unknown', () => {
    expect(makeT('zh')('wizard.next')).toBe('下一步');
    expect(makeT('en')('wizard.next')).toBe('Next');
    expect(makeT('en')('no.such.key')).toBe('no.such.key');
  });
});
