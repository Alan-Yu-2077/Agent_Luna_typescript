// v0.37.12: choose the browser voice DELIBERATELY. Before this, the zero-setup path spoke through
// `new SpeechSynthesisUtterance(text)` with no voice and no lang — i.e. the OS default, which on
// macOS/EN is a deep male voice. Every new user's first impression of Luna was a booming man behind
// a girl's avatar. Pure + injectable so it unit-tests without a speech engine.

export type VoiceLike = {
  name: string;
  lang: string; // BCP-47, e.g. 'zh-CN', 'en-US'
  localService?: boolean;
  default?: boolean;
};

// Curated across the engines Luna actually meets (macOS, Windows, Chrome/Edge, Electron). Matched
// case-insensitively as substrings of the voice NAME — the API exposes no gender field, so a name
// table is the only portable signal.
const FEMALE = [
  // macOS
  'samantha', 'ava', 'allison', 'susan', 'vicki', 'victoria', 'karen', 'moira', 'tessa', 'fiona',
  'serena', 'kate', 'stephanie', 'nicky', 'zoe', 'isha', 'amelie', 'anna', 'ellen', 'alice',
  'ting-ting', 'tingting', 'mei-jia', 'meijia', 'sinji', 'kyoko', 'o-ren', 'yuna', 'lekha',
  // Windows / Edge neural
  'zira', 'hazel', 'susan', 'huihui', 'xiaoxiao', 'xiaoyi', 'yaoyao', 'yunxia', 'hanhan', 'yating',
  'aria', 'jenny', 'michelle', 'ana', 'nanami', 'sonia', 'natasha', 'clara',
  // Chrome / Google
  'google 普通话', 'google 國語', 'google us english', 'google uk english female', 'google 日本語',
  // generic markers some engines use
  'female', '女', 'woman',
];

// Only names that are UNAMBIGUOUSLY male. An ambiguous novelty voice (Reed, Sandy, Flo…) belongs in
// neither table: it then scores 0 and is picked only when nothing better exists. A false entry here
// merely skips a usable voice; a MISSING entry puts a man behind her face — so err toward listing.
const MALE = [
  'alex', 'daniel', 'fred', 'tom', 'aaron', 'arthur', 'gordon', 'oliver', 'rishi',
  'ralph', 'junior', 'bruce', 'albert', 'grandpa',
  'li-mu', 'limu', 'yu-shu', 'yushu', 'otoya', 'hattori',
  'david', 'mark', 'george', 'ravi', 'yunxi', 'yunjian', 'yunyang', 'kangkang', 'guy', 'davis',
  'google uk english male',
  'male', '男', 'man',
];

// WORD-boundary, not substring: 'man' as a substring matches "Sa-man-tha" and 'male' matches
// "Fe-male" — the first draft of this file rejected Samantha as a man for exactly that reason. CJK
// markers (女/男) have no \b in JS regex, so they stay plain substring checks.
const rx = new Map<string, RegExp>();
const matches = (name: string, token: string): boolean => {
  if (!/^[\w\s'-]+$/.test(token)) return name.includes(token); // CJK marker
  let r = rx.get(token);
  if (!r) {
    r = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    rx.set(token, r);
  }
  return r.test(name);
};

const hit = (name: string, table: readonly string[]): boolean => table.some((t) => matches(name, t));

// Luna speaks 中文 and English (and the odd Japanese line). Script → the voice language to ask for.
export function detectVoiceLang(text: string): string {
  if (/[぀-ヿ]/.test(text)) return 'ja-JP'; // kana ⇒ Japanese (before Han: JP mixes both)
  if (/[一-鿿]/.test(text)) return 'zh-CN';
  if (/[가-힯]/.test(text)) return 'ko-KR';
  return 'en-US';
}

// Highest score wins; null = no acceptable voice for this language (caller then leaves the utterance
// unset rather than forcing a wrong-language voice, which would mangle the text).
export function pickVoice(voices: readonly VoiceLike[], lang: string, preferredName?: string): VoiceLike | null {
  if (voices.length === 0) return null;

  const want = lang.toLowerCase();
  const wantPrefix = want.split('-')[0] ?? want;

  // An explicit user choice wins outright, whatever we think of it.
  if (preferredName && preferredName.trim() !== '') {
    const p = preferredName.trim().toLowerCase();
    const exact = voices.find((v) => v.name.toLowerCase() === p) ?? voices.find((v) => v.name.toLowerCase().includes(p));
    if (exact) return exact;
  }

  let best: VoiceLike | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const vLang = (v.lang ?? '').toLowerCase().replace('_', '-');
    const vPrefix = vLang.split('-')[0] ?? vLang;
    // A wrong-language voice reads the text as gibberish — never eligible.
    if (vPrefix !== wantPrefix) continue;
    // A known male voice is never eligible for her — not as a fallback, not as a last resort. If the
    // machine offers nothing else for this language we return null and speak with no voice set: the
    // engine's own default may still be a man, but we will not have CHOSEN one. (An explicit
    // `preferredName` above overrides this — the user's call is the user's call.)
    if (hit(v.name, MALE)) continue;

    let score = 0;
    if (vLang === want) score += 100; // exact locale (zh-CN over zh-TW)
    else score += 40; // same language, other region
    if (hit(v.name, FEMALE)) score += 60;
    if (v.localService) score += 5; // offline-reliable in the desktop shell
    if (v.default) score -= 1; // tie-break AWAY from the OS default — that default is the bug

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}
