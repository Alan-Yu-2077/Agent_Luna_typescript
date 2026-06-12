import type { ToolName } from '@luna/protocol';
import type { Tool } from './defineTool';
import { enterDreamTool } from './builtin/enter_dream';
import { readFileTool } from './builtin/read_file';
import { rememberTool } from './builtin/remember';
import { timeNowTool } from './builtin/time_now';

export type ToolRegistry = Record<ToolName, Tool>;

export const builtinRegistry: ToolRegistry = {
  time_now: timeNowTool,
  read_file: readFileTool,
  remember: rememberTool,
  enter_dream: enterDreamTool,
};
