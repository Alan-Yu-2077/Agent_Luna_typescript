// v0.35.0 (Initiative 25): bilingual copy infrastructure for the setup wizard. Shell strings only —
// the per-step walkthrough cards land in v0.35.4. Keys resolve zh/en from one table so a
// completeness test can assert parity; an unknown key falls back to the key itself (visible in dev,
// caught by tests) rather than throwing mid-wizard.

export type SetupLang = 'zh' | 'en';

const LANG_STORE = 'luna:setup-lang';

export function detectSetupLang(
  navLang: string | undefined = typeof navigator !== 'undefined' ? navigator.language : undefined,
  stored: string | null = safeGet(LANG_STORE),
): SetupLang {
  if (stored === 'zh' || stored === 'en') return stored;
  return (navLang ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function persistSetupLang(lang: SetupLang): void {
  try {
    localStorage.setItem(LANG_STORE, lang);
  } catch {
    /* storage unavailable — the toggle still works for this page */
  }
}

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

type CopyTable = Record<string, { zh: string; en: string }>;

export const SETUP_COPY: CopyTable = {
  'wizard.title': { zh: '欢迎使用 Luna', en: 'Welcome to Luna' },
  'wizard.subtitle': {
    zh: '几步配好她需要的一切。每一步都可以先跳过,以后在设置里重新打开。',
    en: 'A few steps set up everything she needs. Every step can be skipped and re-run from Settings later.',
  },
  'wizard.back': { zh: '上一步', en: 'Back' },
  'wizard.next': { zh: '下一步', en: 'Next' },
  'wizard.skip': { zh: '跳过', en: 'Skip' },
  'wizard.finish': { zh: '完成并启动', en: 'Finish & Start' },
  'wizard.test': { zh: '测试连接', en: 'Test connection' },
  'wizard.testing': { zh: '测试中…', en: 'Testing…' },
  'wizard.test.ok': { zh: '连接正常 ✓', en: 'Connection works ✓' },
  'wizard.finishing': { zh: '正在保存并启动 Luna…', en: 'Saving and starting Luna…' },
  'wizard.finish.failed': { zh: '设置失败。', en: 'Setup failed.' },
  'wizard.lang': { zh: 'English', en: '中文' },
  'wizard.chat.required': { zh: '请填写 base URL 和 API key。', en: 'Enter a base URL and an API key.' },
  'wizard.optional': { zh: '(可跳过)', en: '(optional)' },

  'step.chat.title': { zh: '聊天模型', en: 'Chat model' },
  'step.chat.baseUrl': { zh: 'API base URL', en: 'API base URL' },
  'step.chat.apiKey': { zh: 'API key', en: 'API key' },
  'step.chat.model': { zh: '模型名称', en: 'Model' },

  'step.embedding.title': { zh: '记忆(embedding)', en: 'Memory (embedding)' },
  'step.embedding.model': { zh: 'Embedding 模型', en: 'Embedding model' },
  'step.embedding.apiKey': { zh: 'Embedding API key', en: 'Embedding API key' },
  'step.embedding.baseUrl': { zh: 'Embedding base URL', en: 'Embedding base URL' },

  'step.search.title': { zh: '联网搜索', en: 'Web search' },
  'step.search.apiKey': { zh: 'Tavily API key', en: 'Tavily API key' },

  'step.weather.title': { zh: '天气', en: 'Weather' },
  'step.weather.apiKey': { zh: '和风天气 key', en: 'QWeather key' },
  'step.weather.apiHost': { zh: '和风 API Host', en: 'QWeather API host' },
  'step.weather.latlon': { zh: '位置(纬度,经度)', en: 'Location (lat,lon)' },

  'step.avatar.title': { zh: 'Live2D 立绘', en: 'Live2D avatar' },
  'step.avatar.choose': { zh: '选择模型文件夹…', en: 'Choose model folder…' },
  'step.avatar.installed': { zh: '模型已安装 ✓', en: 'Model installed ✓' },
  'step.avatar.browserOnly': {
    zh: '模型安装仅在桌面 App 里可用。',
    en: 'Model install is only available in the desktop app.',
  },

  'step.voice.title': { zh: '语音', en: 'Voice' },
  'step.voice.browser': { zh: '浏览器语音(零配置)', en: 'Browser voice (zero setup)' },
  'step.voice.http': { zh: 'GPT-SoVITS(自定义音色)', en: 'GPT-SoVITS (custom voice)' },
  'step.voice.url': { zh: 'api_v2 地址', en: 'api_v2 URL' },
};

export function makeT(lang: SetupLang): (key: string) => string {
  return (key) => SETUP_COPY[key]?.[lang] ?? key;
}
