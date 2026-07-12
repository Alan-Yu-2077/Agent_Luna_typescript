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

// v0.35.4: the walkthrough-card copy — registration guidance per the reference instance's vendors.
// Keys are referenced from setupWizard's STEP_GUIDES; the parity test above covers them too.
Object.assign(SETUP_COPY, {
  'guide.chat': {
    zh: '注册 Anthropic 后在控制台创建 API key,粘贴到下面;官方 base URL 保持不变。用中转/网关的话,换成网关的 base URL 和 key 即可。key 只保存在你本机的配置文件里,不会上传。',
    en: 'Create an API key in the Anthropic Console and paste it below; keep the official base URL. Using a gateway? Swap in its base URL and key. Your key is stored only in a local config file — it never leaves this machine.',
  },
  'guide.chat.link': { zh: 'Anthropic 控制台', en: 'Anthropic Console' },
  'guide.embedding': {
    zh: '记忆的"语义联想"用 OpenAI 兼容的 embedding 接口。在 OpenAI 平台创建 key(或用网关,改 base URL)。跳过也能用:她仍会记住,但回忆退化为关键词匹配。',
    en: "Semantic memory recall uses an OpenAI-compatible embeddings endpoint. Create a key on the OpenAI platform (or point the base URL at a gateway). Skipping is fine: she still remembers, but recall degrades to keyword matching.",
  },
  'guide.embedding.link': { zh: 'OpenAI API keys', en: 'OpenAI API keys' },
  'guide.search': {
    zh: '联网搜索用 Tavily。注册后在控制台拿 API key(免费额度约每月 1000 次)。不填的话,搜索工具不会挂载——她无法查网上的新信息。',
    en: 'Web search uses Tavily. Register and grab an API key from its console (free tier ≈ 1000 calls/month). Without a key the search tool is not mounted — she cannot look things up online.',
  },
  'guide.search.link': { zh: 'Tavily 控制台', en: 'Tavily console' },
  'guide.weather': {
    zh: '天气用和风天气(QWeather):注册 → 控制台新建项目 → 拿 KEY,并在"设置"里抄下你账户专属的 API Host(形如 xxxx.qweatherapi.com——老的共享域名会报 Invalid Host)。不填 key 会自动落到免费的 Open-Meteo,国内精度略差。位置在 macOS 上会自动获取,也可手动填。',
    en: "Weather uses QWeather: register → create a project in the console → grab the KEY, and copy your account's dedicated API host from Settings (xxxx.qweatherapi.com — the legacy shared hosts answer Invalid Host). No key = automatic fallback to the free Open-Meteo. Location auto-fills on macOS, or type it manually.",
  },
  'guide.weather.link': { zh: '和风天气控制台', en: 'QWeather console' },
  'guide.avatar': {
    zh: '还没有立绘?视频里有一只免费的 Live2D 小狗模型(7Apoi 等作者发布,可直播使用、须署名、禁转卖)——照视频从网盘下载、解压,然后把整个文件夹拖进下面的虚线框。任何标准 Live2D 模型文件夹(含 .model3.json)都可以。',
    en: 'No avatar yet? The linked video shares a free Live2D puppy model (by 7Apoi & co — streaming OK, credit required, no resale). Download from the video\'s netdisk link, unzip, then drag the whole folder into the dashed box below. Any standard Live2D folder (with a .model3.json) works.',
  },
  'guide.avatar.link.pack': { zh: '免费小狗模型(B站视频)', en: 'Free puppy model (bilibili)' },
  'guide.avatar.link.samples': { zh: 'Live2D 官方示例模型', en: 'Live2D official samples' },
  'guide.voice': {
    zh: '自定义音色分两步:① 装 GPT-SoVITS 运行时——macOS/Linux 克隆官方仓库并建好环境;Windows 可直接用视频里的整合包。② 从视频网盘下载音色权重包,解压后拖进下面的虚线框。装好后,复制生成的那条命令到终端启动语音服务,徽章变绿就能试听。',
    en: 'A custom voice takes two parts: ① the GPT-SoVITS runtime — clone the official repo (macOS/Linux) or use the video\'s bundled package (Windows). ② the voice weights pack from the video\'s netdisk link — unzip and drag the folder into the dashed box. After install, run the generated command in a terminal; the badge turns green and you can test it.',
  },
  'guide.voice.link.pack': { zh: 'Neuro/Evil 音色包(B站视频)', en: 'Neuro/Evil voice pack (bilibili)' },
  'guide.voice.link.runtime': { zh: 'GPT-SoVITS 官方仓库', en: 'GPT-SoVITS (official repo)' },
} satisfies CopyTable);
