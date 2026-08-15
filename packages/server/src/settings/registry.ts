import type { SettingKind } from '@luna/protocol';

// v0.27.1: the operator-settings whitelist. Every entry is an env-backed switch the settings
// panel may read AND write; anything not listed here is unreachable from the wire — secrets
// (API keys, base URLs) stay file-only by construction, not by filtering.
//
// defaultValue is DISPLAY-ONLY (shown when neither a user pin nor an env value exists) and must
// mirror the real default at the read site — the store never writes it into Bun.env. Booleans are
// normalized to '1'/'0' on this surface: every boolean flag in the codebase tests either
// `!== '0'` (default-ON) or `=== '1'` (default-OFF), so both forms round-trip correctly.
// restartRequired marks flags read at boot (provider/tool-registry construction) — a live set
// still persists + lands in Bun.env, but only takes effect next boot.

export type SettingSpec = {
  key: string;
  env: string;
  label: string;
  hint: string;
  category: string;
  kind: SettingKind;
  defaultValue: string;
  restartRequired?: boolean;
  min?: number;
  max?: number;
  validate?: (value: string) => string | null;
};

function validQuietHours(value: string): string | null {
  if (value.trim() === '') return null;
  const parts = value.split(',').map((s) => s.trim());
  for (const p of parts) {
    if (!/^\d{1,2}$/.test(p) || Number(p) > 23) {
      return '安静时段必须是用逗号分隔的 0–23 点（例如“0,1,2,3,4,5”）';
    }
  }
  return null;
}

function validActiveness(value: string): string | null {
  if (value.trim() === '') return null;
  return ['aloof', 'balanced', 'clingy'].includes(value.trim())
    ? null
    : '主动程度只能是 aloof、balanced 或 clingy';
}

function validLatLon(value: string): string | null {
  if (value.trim() === '') return null;
  const m = value.split(',').map((s) => Number(s.trim()));
  if (m.length !== 2 || m.some((n) => !Number.isFinite(n))) {
    return '位置必须是“纬度,经度”（例如“40.71,-74.01”）';
  }
  const [lat, lon] = m as [number, number];
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return '纬度范围是 -90..90，经度范围是 -180..180';
  return null;
}

export const SETTING_SPECS: readonly SettingSpec[] = [
  // -- Companion --------------------------------------------------------------------------
  {
    key: 'proactive.enabled',
    env: 'LUNA_PROACTIVE',
    label: '主动消息',
    hint: '你安静下来时，她可能会主动来找你',
    category: '陪伴',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'proactive.quiet_hours',
    env: 'LUNA_PROACTIVE_QUIET_HOURS',
    label: '安静时段',
    hint: '她保持安静的本地时间，用逗号分隔小时',
    category: '陪伴',
    kind: 'text',
    defaultValue: '0,1,2,3,4,5',
    validate: validQuietHours,
  },
  {
    key: 'proactive.activeness',
    env: 'LUNA_PROACTIVE_ACTIVENESS',
    label: '主动程度',
    hint: '她主动开口的积极程度：aloof、balanced 或 clingy（仍受安全限制）',
    category: '陪伴',
    kind: 'text',
    defaultValue: 'balanced',
    validate: validActiveness,
  },
  {
    key: 'selfcont.enabled',
    env: 'LUNA_SELFCONT',
    label: '追问式补充',
    hint: '她回复后可能很快再补充一句',
    category: '陪伴',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'selfcont.probability',
    env: 'LUNA_SELFCONT_PROBABILITY',
    label: '补充概率',
    hint: '0 = 从不，1 = 总是',
    category: '陪伴',
    kind: 'number',
    defaultValue: '0.35',
    min: 0,
    max: 1,
  },
  // -- Perception -------------------------------------------------------------------------
  {
    key: 'time.aware',
    env: 'LUNA_TIME_AWARE',
    label: '时间感知',
    hint: '她知道现在几点、哪一天，以及你离开了多久',
    category: '感知',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'weather.ambient',
    env: 'LUNA_WEATHER_AMBIENT',
    label: '天气感知',
    hint: '真实天气会影响她的心情和闲聊',
    category: '感知',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'weather.lat_lon',
    env: 'LUNA_LAT_LON',
    label: '位置（纬度,经度）',
    hint: '她查询天气的位置，例如“40.71,-74.01”',
    category: '感知',
    kind: 'text',
    defaultValue: '',
    validate: validLatLon,
  },
  {
    key: 'time.zone',
    env: 'LUNA_TZ',
    label: '时区',
    hint: 'IANA 时区，例如 America/New_York；留空则使用系统设置',
    category: '感知',
    kind: 'text',
    defaultValue: '',
  },
  // -- Abilities (tool registry is built at boot) ------------------------------------------
  {
    key: 'web.search',
    env: 'LUNA_WEB_SEARCH',
    label: '联网搜索',
    hint: '她可以搜索网页（需要搜索服务 API 密钥）',
    category: '能力',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'web.fetch',
    env: 'LUNA_WEB_FETCH',
    label: '读取网页',
    hint: '她可以打开并阅读 URL',
    category: '能力',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'skills.enabled',
    env: 'LUNA_SKILLS',
    label: '技能库',
    hint: '她会保存并复用已学会的流程（save_skill / recall_skill 和技能页）',
    category: '能力',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'skills.dream_distill',
    env: 'LUNA_DREAM_SKILLS',
    label: '梦境技能沉淀',
    hint: '她会在梦里把当天的重要经历沉淀成可复用技能（有记录、可撤销）',
    category: '记忆',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'weather.tool',
    env: 'LUNA_WEATHER',
    label: '查询天气',
    hint: '她可以按需查询天气预报',
    category: '能力',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'code.write',
    env: 'LUNA_CODE_WRITE',
    label: '编辑代码',
    hint: '她可以编辑工作区里的文件',
    category: '能力',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'shell.enabled',
    env: 'LUNA_SHELL',
    label: '终端命令',
    hint: '她可以在工作区里运行命令',
    category: '能力',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  // -- Memory -----------------------------------------------------------------------------
  {
    key: 'memory.inject',
    env: 'LUNA_MEMORY_INJECT',
    label: '将记忆注入上下文',
    hint: '核心记忆和召回的经历会影响她的回复',
    category: '记忆',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'dream.shutdown',
    env: 'LUNA_SHUTDOWN_DREAM',
    label: '退出时进入梦境',
    hint: '退出前整理记忆（每几小时最多一次，不是每次关闭都触发）',
    category: '记忆',
    kind: 'boolean',
    defaultValue: '1',
  },
  // -- Model ------------------------------------------------------------------------------
  {
    key: 'model.id',
    env: 'LUNA_MODEL',
    label: '模型',
    hint: '她用来思考的大语言模型；留空则使用内置默认值',
    category: '模型',
    kind: 'text',
    defaultValue: '',
    restartRequired: true,
  },
];

export function specFor(key: string): SettingSpec | undefined {
  return SETTING_SPECS.find((s) => s.key === key);
}

// Returns an error message, or null when the value is acceptable for the spec.
export function validateValue(spec: SettingSpec, value: string): string | null {
  if (spec.kind === 'boolean') {
    return value === '0' || value === '1' ? null : `${spec.label} 必须是“1”或“0”`;
  }
  if (spec.kind === 'number') {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n)) return `${spec.label} 必须是数字`;
    if (spec.min !== undefined && n < spec.min) return `${spec.label} 必须大于等于 ${spec.min}`;
    if (spec.max !== undefined && n > spec.max) return `${spec.label} 必须小于等于 ${spec.max}`;
    return null;
  }
  return spec.validate ? spec.validate(value) : null;
}
