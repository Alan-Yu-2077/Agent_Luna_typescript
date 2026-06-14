import { ToolName } from '@luna/protocol';

// Presentation mapping: the controller emits tool chips as `🔧 <tool_name>…`
// (started) / `🔧 <summary>` (finished). The friendly per-tool label is a
// view concern, so it lives here rather than in the controller — keeping the
// shared controller untouched. Unknown text falls through stripped.
const CUTE: Partial<Record<ToolName, string>> = {
  recall: '翻了翻记忆 🔖',
  remember: '记在心里了 💭',
  read_file: '读了点东西 📖',
  time_now: '看了下时间 🕐',
  enter_dream: '准备做个梦 🌙',
  message: '说了句话 💬',
};

function strip(s: string): string {
  return s.replace(/^🔧\s*/, '').replace(/…+$/, '').trim();
}

export function toolCardLabel(chipText: string): string {
  for (const name of ToolName.options) {
    if (chipText.includes(name)) return CUTE[name] ?? name;
  }
  return strip(chipText);
}
