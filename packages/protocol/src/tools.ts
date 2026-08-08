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
  // default ON since v0.18.3's DNS pin (LUNA_WEB_FETCH=0 is the off switch;
  // stale opt-in wording corrected v0.45.13).
  'web_fetch',
  // Initiative 14 (v0.21.0) — current weather for the configured location
  // (Open-Meteo, no key). Read-only; default ON since v0.21.2 but gated on a
  // configured LUNA_LAT_LON (dormant until set).
  'weather',
  // Initiative 32 (v0.45.0) — what he is playing (macOS Now Playing via the resident
  // provider). Read-only ⇒ the tool opts into proactiveRisk:'safe'. OPT-IN: LUNA_MUSIC=1
  // on darwin, dormant otherwise.
  'music_now',
  // Initiative 32 (v0.45.0) — control his playback (play/pause/toggle/next/prev).
  // Deliberately NOT risk-marked ⇒ fail-closed 'surface' in proactive turns: she must
  // speak before touching his music.
  'music_control',
  // Initiative 34 (v0.45.9) — browse his listening history in the local library
  // (search/top/history/playlists). Read-only (D3) ⇒ 'safe'.
  'music_library',
  // Initiative 34 (v0.45.9) — re-read the current track's cached lyrics (zero network,
  // the read-once-burn block's safety net). Read-only ⇒ 'safe'.
  'music_lyrics',
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
