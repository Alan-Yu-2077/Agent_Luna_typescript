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
  'wizard.continueAnyway': { zh: '仍然继续', en: 'Continue anyway' },
  'wizard.nothingToTest': { zh: '还没填写要测试的 key。', en: 'Nothing to test yet — fill in a key first.' },

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
  'step.weather.provider.qweather': { zh: '天气源:和风天气(QWeather)', en: 'Weather source: QWeather' },
  'step.weather.provider.openmeteo': {
    zh: '天气源:Open-Meteo(不填 key 的免费兜底)',
    en: 'Weather source: Open-Meteo (keyless fallback)',
  },

  'step.avatar.title': { zh: 'Live2D 立绘', en: 'Live2D avatar' },
  'step.avatar.choose': { zh: '选择模型文件夹…', en: 'Choose model folder…' },
  'step.avatar.drop': { zh: '把解压后的模型文件夹拖到这里', en: 'Drag the unzipped model folder here' },
  'step.avatar.installed': { zh: '模型已安装 ✓', en: 'Model installed ✓' },
  'wizard.installing': { zh: '安装中…', en: 'Installing…' },
  'step.avatar.browserOnly': {
    zh: '模型安装仅在桌面 App 里可用。',
    en: 'Model install is only available in the desktop app.',
  },

  'step.voice.title': { zh: '语音', en: 'Voice' },
  'step.voice.browser': { zh: '浏览器语音(零配置)', en: 'Browser voice (zero setup)' },
  'step.voice.http': { zh: 'GPT-SoVITS(自定义音色)', en: 'GPT-SoVITS (custom voice)' },
  'step.voice.url': { zh: 'api_v2 地址', en: 'api_v2 URL' },
  'step.voice.drop': { zh: '把下载好的音色包文件夹拖到这里', en: 'Drag the downloaded voice pack folder here' },
  'step.voice.scanning': { zh: '扫描音色包…', en: 'Scanning the pack…' },
  'step.voice.gpt': { zh: 'GPT 权重(.ckpt)', en: 'GPT weight (.ckpt)' },
  'step.voice.sovits': { zh: 'SoVITS 权重(.pth)', en: 'SoVITS weight (.pth)' },
  'step.voice.ref': { zh: '参考音频(.wav)', en: 'Reference audio (.wav)' },
  'step.voice.transcript': { zh: '参考音频的文字内容', en: 'Transcript of the reference audio' },
  'step.voice.promptLang': { zh: '参考音频语言', en: 'Reference language' },
  'step.voice.runtime.choose': { zh: '选择 GPT-SoVITS 目录…', en: 'Choose GPT-SoVITS folder…' },
  'step.voice.runtime.none': { zh: '(未选择——选好才能生成启动命令)', en: '(not chosen — needed for the launch command)' },
  'step.voice.install': { zh: '安装音色', en: 'Install voice' },
  'step.voice.installed': { zh: '音色已安装 ✓', en: 'Voice installed ✓' },
  'step.voice.command.title': { zh: '用这条命令启动语音服务(复制到终端运行):', en: 'Start the voice server with this command:' },
  'step.voice.copy': { zh: '复制命令', en: 'Copy command' },
  'step.voice.copied': { zh: '已复制 ✓', en: 'Copied ✓' },
  'step.voice.badge.down': { zh: '语音服务未运行', en: 'Voice server not running' },
  'step.voice.badge.up': { zh: '语音服务已就绪 ✓', en: 'Voice server ready ✓' },
  'step.voice.test': { zh: '试听一句', en: 'Test voice' },
  'step.voice.test.failed': { zh: '试听失败——确认语音服务已启动。', en: 'Test failed — is the voice server running?' },
};

export function makeT(lang: SetupLang): (key: string) => string {
  return (key) => SETUP_COPY[key]?.[lang] ?? key;
}
