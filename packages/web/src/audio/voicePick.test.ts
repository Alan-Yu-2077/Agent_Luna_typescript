import { describe, expect, test } from 'bun:test';
import { detectVoiceLang, pickVoice, type VoiceLike } from './voicePick';

// v0.37.12: the zero-setup voice used to be the OS default — on macOS/EN a deep male voice behind a
// girl's avatar. These pin the choice: language-matched, female-preferred, and NEVER a known man.

const v = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({ name, lang, ...extra });

// A realistic macOS EN voice list — `Alex` is the classic system default (and male).
const MAC_EN: VoiceLike[] = [
  v('Alex', 'en-US', { default: true, localService: true }),
  v('Fred', 'en-US', { localService: true }),
  v('Samantha', 'en-US', { localService: true }),
  v('Daniel', 'en-GB', { localService: true }),
];
const MAC_ZH: VoiceLike[] = [
  v('Ting-Ting', 'zh-CN', { localService: true }),
  v('Li-mu', 'zh-CN', { localService: true }),
  v('Mei-Jia', 'zh-TW', { localService: true }),
];
const WIN: VoiceLike[] = [
  v('Microsoft David - English (United States)', 'en-US', { default: true }),
  v('Microsoft Zira - English (United States)', 'en-US'),
  v('Microsoft Huihui - Chinese (Simplified)', 'zh-CN'),
];

describe('detectVoiceLang', () => {
  test('Han → zh-CN, kana → ja-JP, latin → en-US', () => {
    expect(detectVoiceLang('晚安,好好睡')).toBe('zh-CN');
    expect(detectVoiceLang('おやすみ')).toBe('ja-JP');
    expect(detectVoiceLang('Good night, Alan.')).toBe('en-US');
  });
  test('mixed CJK + latin follows the CJK (she is speaking 中文 with a loanword)', () => {
    expect(detectVoiceLang('我在跑 GPT-SoVITS 呢')).toBe('zh-CN');
  });
});

describe('pickVoice — never a man behind her face', () => {
  test('macOS EN: picks Samantha, NOT the male system default (Alex)', () => {
    expect(pickVoice(MAC_EN, 'en-US')?.name).toBe('Samantha');
  });
  test('macOS ZH: picks Ting-Ting, not Li-mu', () => {
    expect(pickVoice(MAC_ZH, 'zh-CN')?.name).toBe('Ting-Ting');
  });
  test('Windows: picks Zira/Huihui, never David', () => {
    expect(pickVoice(WIN, 'en-US')?.name).toContain('Zira');
    expect(pickVoice(WIN, 'zh-CN')?.name).toContain('Huihui');
  });
  test('exact locale beats same-language other region', () => {
    expect(pickVoice(MAC_ZH, 'zh-CN')?.lang).toBe('zh-CN'); // not the zh-TW Mei-Jia
  });
  test('an unknown-gender voice is preferred over a KNOWN male one', () => {
    const list = [v('Alex', 'en-US', { default: true }), v('Nova', 'en-US')];
    expect(pickVoice(list, 'en-US')?.name).toBe('Nova');
  });
  test('ONLY male voices for the language → null (speak with none rather than as a man)', () => {
    expect(pickVoice([v('Alex', 'en-US'), v('Fred', 'en-US')], 'en-US')).toBeNull();
  });
  test('no voice for the language → null (never read 中文 with an English engine)', () => {
    expect(pickVoice(MAC_EN, 'zh-CN')).toBeNull();
  });
  test('an empty list (getVoices() not loaded yet) → null, never a throw', () => {
    expect(pickVoice([], 'en-US')).toBeNull();
  });
  test('an explicit user override wins outright, by exact name or substring', () => {
    expect(pickVoice(MAC_EN, 'en-US', 'Fred')?.name).toBe('Fred');
    expect(pickVoice(WIN, 'en-US', 'huihui')?.name).toContain('Huihui');
  });
});

// The substring trap that this file's own first draft fell into.
describe('pickVoice — the substring traps', () => {
  test("'man' must not match Sa-MAN-tha, and 'male' must not match Fe-MALE", () => {
    const list: VoiceLike[] = [v('Samantha', 'en-US'), v('Google US English Female', 'en-US')];
    expect(pickVoice(list, 'en-US')).not.toBeNull(); // neither is a man
    expect(pickVoice([v('Samantha', 'en-US')], 'en-US')?.name).toBe('Samantha');
    expect(pickVoice([v('Google US English Female', 'en-US')], 'en-US')?.name).toContain('Female');
  });
  test("'alex' must not swallow Alexandra", () => {
    expect(pickVoice([v('Alexandra', 'en-US')], 'en-US')?.name).toBe('Alexandra');
    expect(pickVoice([v('Alex', 'en-US')], 'en-US')).toBeNull();
  });
  test('an ambiguous novelty voice is usable when nothing better exists', () => {
    expect(pickVoice([v('Reed', 'en-US')], 'en-US')?.name).toBe('Reed');
  });
});
