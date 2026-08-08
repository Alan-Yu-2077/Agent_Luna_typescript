import type { Tool } from '../tools/defineTool';

// Per-cycle action budget — a runaway-loop backstop for an unsupervised
// proactive turn (on top of MAX_TOOL_ITERATIONS, which bounds rounds). Read at
// call time so it is configurable without a restart.
// v0.45.13: 6 → 8, breathing room for a full quiet-wander chain (search 1 + fetch 2-3 +
// remember 1-2 + margin). Still the runaway backstop, not a quota — the wander DAILY budget
// (quietWork) is the product limit.
export function maxProactiveActions(): number {
  return Number(Bun.env['LUNA_PROACTIVE_MAX_ACTIONS'] ?? 8);
}

// The recoverable error a surface-risk action gets when it hasn't been
// surfaced yet (the hard gate: block → surface → execute).
export const SURFACE_FIRST_MESSAGE =
  'This is a proactive turn and the user is not here to approve in the moment. Before any ' +
  'irreversible or outside-world action, first say what you are about to do (and why) with the ' +
  'message tool — then call this tool again. Reversible things (reading, recalling, saving a ' +
  'memory, dreaming) you may just do.';

// Fail-closed: a tool counts as 'safe' (silently runnable in a proactive turn)
// ONLY if it explicitly opted in. Anything unmarked → 'surface'.
export function proactiveRiskOf(tool: Tool | undefined): 'safe' | 'surface' {
  return tool?.proactiveRisk === 'safe' ? 'safe' : 'surface';
}

// A surface-risk action is allowed iff Luna already surfaced (sent a message)
// earlier in THIS proactive cycle. Safe actions are always allowed.
export function isProactiveActionAllowed(
  risk: 'safe' | 'surface',
  surfacedThisCycle: boolean,
): boolean {
  return risk === 'safe' || surfacedThisCycle;
}
