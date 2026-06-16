import { ToolName } from '@luna/protocol';

// Presentation mapping: the controller emits tool chips as `🔧 <tool_name>…`
// (started) / `🔧 <summary>` (finished). The friendly per-tool label is a
// view concern, so it lives here rather than in the controller — keeping the
// shared controller untouched. Unknown text falls through stripped.
const CUTE: Partial<Record<ToolName, string>> = {
  recall: 'flipped through memories 🔖',
  remember: 'kept it in mind 💭',
  read_file: 'read something 📖',
  time_now: 'checked the time 🕐',
  enter_dream: 'getting ready to dream 🌙',
  message: 'said something 💬',
  repo_map: 'mapped the codebase 🗺️',
  find_symbol: 'located a symbol 🔎',
  plan: 'updated the plan 📋',
  save_skill: 'saved a skill 🧠',
  recall_skill: 'recalled a skill 💡',
  propose_self_edit: 'proposed a self-edit ✍️',
  web_search: 'searched the web 🔍',
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
