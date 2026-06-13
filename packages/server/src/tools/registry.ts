import type { ToolName } from '@luna/protocol';
import type { Tool } from './defineTool';
import { enterDreamTool } from './builtin/enter_dream';
import { messageTool } from './builtin/message';
import { readFileTool } from './builtin/read_file';
import { rememberTool } from './builtin/remember';
import { timeNowTool } from './builtin/time_now';

// Partial: `message` is mounted conditionally (LUNA_MESSAGE_TOOL), so a
// registry without it must typecheck. Missing tools resolve to tool_not_found
// in the dispatcher — that path predates this and is tested.
export type ToolRegistry = Partial<Record<ToolName, Tool>>;

export const builtinRegistry: ToolRegistry = {
  time_now: timeNowTool,
  read_file: readFileTool,
  remember: rememberTool,
  enter_dream: enterDreamTool,
};

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
