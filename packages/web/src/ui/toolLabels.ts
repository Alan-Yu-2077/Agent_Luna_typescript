import { ToolName } from '@luna/protocol';

// Presentation mapping: the controller emits tool chips as `🔧 <tool_name>…`
// (started) / `🔧 <summary>` (finished). The friendly per-tool label is a
// view concern, so it lives here rather than in the controller — keeping the
// shared controller untouched. Unknown text falls through stripped.
const CUTE: Partial<Record<ToolName, string>> = {
  recall: '翻了翻记忆 🔖',
  remember: '记在心里了 💭',
  read_file: '读了点东西 📖',
  time_now: '看了看时间 🕐',
  enter_dream: '准备进入梦境 🌙',
  message: '说了句话 💬',
  repo_map: '看了看代码地图 🗺️',
  find_symbol: '找到了代码位置 🔎',
  plan: '更新了计划 📋',
  save_skill: '保存了一项技能 🧠',
  recall_skill: '回忆起一项技能 💡',
  propose_self_edit: '提出了一次自我修改 ✍️',
  web_search: '搜了搜网页 🔍',
  web_fetch: '读了一个网页 🌐',
  list_files: '翻了翻文件 📂',
  grep: '搜了搜代码 🔍',
  edit: '改了一个文件 ✏️',
  multi_edit: '改了一个文件 ✏️',
  write_file: '写入了一个文件 📝',
  shell: '运行了一条命令 💻',
  typecheck: '做了类型检查 ✅',
  run_tests: '跑了一遍测试 🧪',
  lint: '检查了代码格式 🎨',
};

function strip(s: string): string {
  return s
    .replace(/^🔧\s*/, '')
    .replace(/…+$/, '')
    .trim();
}

export function toolCardLabel(chipText: string): string {
  const stripped = strip(chipText);
  // Exact match only: a START chip is `🔧 <tool_name>…`, so the stripped text IS
  // the tool name. A substring `includes` (the old code) mislabeled `recall_skill`
  // as `recall` and rewrote any FINISH summary that merely contained a tool-name
  // substring. A finish summary is free text → not a ToolName → its stripped form.
  const parsed = ToolName.safeParse(stripped);
  if (parsed.success) return CUTE[parsed.data] ?? stripped;
  return stripped;
}
