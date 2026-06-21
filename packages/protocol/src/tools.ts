import { z } from 'zod';

export const ToolName = z.enum([
  'time_now',
  'read_file',
  'remember',
  'enter_dream',
  'message',
  'recall',
  'list_files',
  'grep',
  'edit',
  'multi_edit',
  'write_file',
  'shell',
  'typecheck',
  'run_tests',
  'lint',
  'repo_map',
  'find_symbol',
  'plan',
  'save_skill',
  'recall_skill',
  'propose_self_edit',
  // Initiative 11 (v0.18.0) — client-side live-web search. Read-only; default ON
  // since v0.18.2 (LUNA_WEB_SEARCH=0 is the off switch; auto-degrades off with no
  // API key).
  'web_search',
  // Initiative 11 (v0.18.1) — read one URL safely (SSRF-guarded). Read-only;
  // OPT-IN (default off): LUNA_WEB_FETCH=1 mounts it (held opt-in until the
  // v0.18.3 pinned-lookup DNS fix — the rebinding defense narrows, not closes).
  'web_fetch',
  // Initiative 14 (v0.21.0) — current weather for the configured location
  // (Open-Meteo, no key). Read-only; OPT-IN (default off, LUNA_WEATHER=1) until
  // the Initiative 14 close (v0.21.2) flips it on.
  'weather',
]);
export type ToolName = z.infer<typeof ToolName>;

export const ToolErrorCode = z.enum([
  'tool_not_found',
  'validation_failed',
  'execution_exception',
  'timeout',
  'aborted',
]);
export type ToolErrorCode = z.infer<typeof ToolErrorCode>;

export const ToolResultOk = z.object({
  kind: z.literal('ok'),
  data: z.unknown(),
  summary: z.string(),
});

export const ToolResultErr = z.object({
  kind: z.literal('err'),
  code: ToolErrorCode,
  message: z.string(),
  recoverable: z.boolean(),
});

export const ToolResult = z.discriminatedUnion('kind', [ToolResultOk, ToolResultErr]);
export type ToolResult = z.infer<typeof ToolResult>;

// tool_name is the ToolName enum (matching ToolCall + the real invariant: a
// ToolEvent always originates from a registered tool's ToolCall). v0.20.9 tightened
// these from z.string(), so a dynamically-named tool can't construct one and the
// consumers' ToolName.parse narrowing is now compile-time-guaranteed, not hopeful.
export const ToolEventStarted = z.object({
  kind: z.literal('started'),
  tool_name: ToolName,
  call_id: z.string(),
  input: z.unknown(),
});

export const ToolEventProgress = z.object({
  kind: z.literal('progress'),
  tool_name: ToolName,
  call_id: z.string(),
  payload: z.unknown(),
});

export const ToolEventFinal = z.object({
  kind: z.literal('final'),
  tool_name: ToolName,
  call_id: z.string(),
  result: ToolResult,
});

export const ToolEvent = z.discriminatedUnion('kind', [
  ToolEventStarted,
  ToolEventProgress,
  ToolEventFinal,
]);
export type ToolEvent = z.infer<typeof ToolEvent>;

export const ToolCall = z.object({
  call_id: z.string(),
  tool_name: ToolName,
  input: z.unknown(),
});
export type ToolCall = z.infer<typeof ToolCall>;
