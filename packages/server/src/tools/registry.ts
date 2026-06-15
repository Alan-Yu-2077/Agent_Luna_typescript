import type { ToolName } from '@luna/protocol';
import type { Tool } from './defineTool';
import { editTool } from './builtin/edit';
import { enterDreamTool } from './builtin/enter_dream';
import { grepTool } from './builtin/grep';
import { listFilesTool } from './builtin/list_files';
import { messageTool } from './builtin/message';
import { multiEditTool } from './builtin/multi_edit';
import { readFileTool } from './builtin/read_file';
import { recallTool } from './builtin/recall';
import { rememberTool } from './builtin/remember';
import { timeNowTool } from './builtin/time_now';
import { writeFileTool } from './builtin/write_file';

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
