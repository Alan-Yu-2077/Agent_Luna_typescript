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
  web_fetch: 'read a web page 🌐',
  list_files: 'looked through files 📂',
  grep: 'searched the code 🔍',
  edit: 'edited a file ✏️',
  multi_edit: 'edited a file ✏️',
  write_file: 'wrote a file 📝',
  shell: 'ran a command 💻',
  typecheck: 'type-checked ✅',
  run_tests: 'ran the tests 🧪',
  lint: 'checked formatting 🎨',
};

function strip(s: string): string {
  return s.replace(/^🔧\s*/, '').replace(/…+$/, '').trim();
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
