import type { ToolName } from '@luna/protocol';
import type { Tool } from './defineTool';
import { editTool } from './builtin/edit';
import { enterDreamTool } from './builtin/enter_dream';
import { findSymbolTool } from './builtin/find_symbol';
import { grepTool } from './builtin/grep';
import { lintTool } from './builtin/lint';
import { listFilesTool } from './builtin/list_files';
import { messageTool } from './builtin/message';
import { multiEditTool } from './builtin/multi_edit';
import { planTool } from './builtin/plan';
import { proposeSelfEditTool } from './builtin/propose_self_edit';
import { readFileTool } from './builtin/read_file';
import { recallTool } from './builtin/recall';
import { recallSkillTool } from './builtin/recall_skill';
import { saveSkillTool } from './builtin/save_skill';
import { rememberTool } from './builtin/remember';
import { repoMapTool } from './builtin/repo_map';
import { runTestsTool } from './builtin/run_tests';
import { shellTool } from './builtin/shell';
import { timeNowTool } from './builtin/time_now';
import { typecheckTool } from './builtin/typecheck';
import { writeFileTool } from './builtin/write_file';
import { webSearchTool } from './web/web_search';

// Partial: `message` is mounted conditionally (LUNA_MESSAGE_TOOL), so a
// registry without it must typecheck. Missing tools resolve to tool_not_found
// in the dispatcher — that path predates this and is tested.
export type ToolRegistry = Partial<Record<ToolName, Tool>>;

export const builtinRegistry: ToolRegistry = {
  time_now: timeNowTool,
  read_file: readFileTool,
  remember: rememberTool,
  enter_dream: enterDreamTool,
  // agentic memory search — always mounted (LD #10), complements auto-injection
  recall: recallTool,
  // code-agent read/navigation (Initiative 8, v0.15.0). Read-only + jailed via
  // workspace.ts → ship on by default, no feature flag.
  list_files: listFilesTool,
  grep: grepTool,
  // the plan/todo spine (Initiative 8, v0.15.3) — cheap, safe, session-scoped.
  // Ships on always (owner: "plan ships on"); no flag.
  plan: planTool,
};

// Code-write tools (Initiative 8, v0.15.1) — edit / multi_edit / write_file.
// These MUTATE the user's files, so they are gated behind LUNA_CODE_WRITE
// (per-version flag, OWNER DECISION = default ON; `=0` is the off switch). The
// jail (resolveInWorkspace write → secrets + evaluator firewall), read-before-
// edit, uniqueness, and optimistic concurrency are the in-tool guardrails.
export const writeTools: ToolRegistry = {
  edit: editTool,
  multi_edit: multiEditTool,
  write_file: writeFileTool,
};

// Default ON (owner: enable-all-after-E2E); LUNA_CODE_WRITE=0 turns writing off.
export function codeWriteEnabled(): boolean {
  return Bun.env['LUNA_CODE_WRITE'] !== '0';
}

// Compose a base registry with the write tools iff the flag is on. Used at boot
// (main.ts) so the registry content — not an env read in the turn loop — is the
// single source of truth for "can Luna write files this session".
export function withCodeWrite(base: ToolRegistry): ToolRegistry {
  return codeWriteEnabled() ? { ...base, ...writeTools } : { ...base };
}

// Shell + verify loop (Initiative 8, v0.15.2). `shell` is the single most
// dangerous surface in the rewrite, so it lands on its own flag (LUNA_SHELL).
// The verify tools (typecheck/run_tests/lint) EXECUTE through the same spawner,
// so they mount with shell under the same flag (OWNER DECISION #5: "the verify
// tools mount with the edit/shell tools"). In-tool guardrails: the deny-regex +
// interactive block (shellDeny.ts), the sensitive-path block on cwd + command
// text (resolveInWorkspace execute), proactiveRisk:'surface', timeout +
// process-tree kill + output cap, and session-serial concurrency.
export const shellTools: ToolRegistry = {
  shell: shellTool,
  typecheck: typecheckTool,
  run_tests: runTestsTool,
  lint: lintTool,
};

// Default ON (owner: enable-all-after-E2E); LUNA_SHELL=0 turns the execute
// surface (shell + verify loop) off.
export function shellEnabled(): boolean {
  return Bun.env['LUNA_SHELL'] !== '0';
}

// Compose a base registry with the shell + verify tools iff the flag is on.
export function withShell(base: ToolRegistry): ToolRegistry {
  return shellEnabled() ? { ...base, ...shellTools } : { ...base };
}

// Repo map + hybrid symbol locator (Initiative 8, v0.15.3). Read-only + jailed
// (like grep/list), but they carry the tree-sitter WASM load + the SQLite cache,
// so they sit behind their own flag (LUNA_REPO_MAP) — OWNER DECISION #4: default
// ON (the `=0` is the off switch), the plan's "0 until verified" superseded.
export const repoMapTools: ToolRegistry = {
  repo_map: repoMapTool,
  find_symbol: findSymbolTool,
};

// Default ON (owner: enable-all-after-E2E); LUNA_REPO_MAP=0 turns the map +
// locator tools off (the `plan` tool is unaffected — it ships in builtinRegistry).
export function repoMapEnabled(): boolean {
  return Bun.env['LUNA_REPO_MAP'] !== '0';
}

// Compose a base registry with the repo-map + locator tools iff the flag is on.
export function withRepoMap(base: ToolRegistry): ToolRegistry {
  return repoMapEnabled() ? { ...base, ...repoMapTools } : { ...base };
}

// Skill library (Initiative 8, v0.15.4) — save_skill (verify-before-persist) +
// recall_skill. Skills are DATA the model reuses on recall, never auto-executed
// code. Behind LUNA_SKILLS (OWNER DECISION #4: default ON; `=0` is the off switch).
export const skillTools: ToolRegistry = {
  save_skill: saveSkillTool,
  recall_skill: recallSkillTool,
};

export function skillsEnabled(): boolean {
  return Bun.env['LUNA_SKILLS'] !== '0';
}

export function withSkills(base: ToolRegistry): ToolRegistry {
  return skillsEnabled() ? { ...base, ...skillTools } : { ...base };
}

// Propose-only self-edit (Initiative 8, v0.15.4) — the bounded self-evolution
// surface. It NEVER writes; the evaluator firewall (resolveInWorkspace 'write')
// hard-rejects any proposed edit to the code that judges/sandboxes/gates Luna, so
// it cannot disable its own guardrails even when enabled. Behind LUNA_SELF_EDIT
// (default ON; propose-only ⇒ harmless even on — a human applies every diff).
export const selfEditTools: ToolRegistry = {
  propose_self_edit: proposeSelfEditTool,
};

export function selfEditEnabled(): boolean {
  return Bun.env['LUNA_SELF_EDIT'] !== '0';
}

export function withSelfEdit(base: ToolRegistry): ToolRegistry {
  return selfEditEnabled() ? { ...base, ...selfEditTools } : { ...base };
}

// Web search (Initiative 11, v0.18.0) — client-side live-web lookup. Unlike the
// code tools (default ON), this is a network + real-credit-cost surface, so it
// ships default OFF behind LUNA_WEB_SEARCH and is flipped on only in v0.18.2
// after cost is measured. Read-only ⇒ proactiveRisk:'safe' (set on the tool).
export const webSearchTools: ToolRegistry = {
  web_search: webSearchTool,
};

// Default OFF (cost/abuse surface — opposite polarity to the code tools);
// LUNA_WEB_SEARCH=1 mounts web_search this session.
export function webSearchEnabled(): boolean {
  return Bun.env['LUNA_WEB_SEARCH'] === '1';
}

// Compose a base registry with web_search iff the flag is on. Wired at boot in
// main.ts so the registry — not an env read in the turn loop — is the source of
// truth for "can Luna search the web this session".
export function withWebSearch(base: ToolRegistry): ToolRegistry {
  return webSearchEnabled() ? { ...base, ...webSearchTools } : { ...base };
}

// Registry-derived mode check (mirrors isMessageMode): the L1 web clause + the
// intent-no-call audit key off whether web_search is actually mounted, never an
// env read.
export function isWebSearchMode(registry: ToolRegistry): boolean {
  return registry.web_search !== undefined;
}

// The LD #9 everything-as-tool surface. Mode selection happens once at boot
// (main.ts reads LUNA_MESSAGE_TOOL); everywhere else derives the mode from
// the registry itself — single source of truth, no env reads in the turn loop.
export const messageRegistry: ToolRegistry = {
  ...builtinRegistry,
  message: messageTool,
};

export function isMessageMode(registry: ToolRegistry): boolean {
  return registry.message !== undefined;
}
