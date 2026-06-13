import { z } from 'zod';

export const TracePhase = z.enum(['started', 'progress', 'final']);
export type TracePhase = z.infer<typeof TracePhase>;

const base = {
  schema_v: z.literal(1),
  trace_id: z.string(),
  turn_id: z.string(),
  session_id: z.string(),
  t_ms: z.number().int().nonnegative(),
};

export const NodeTraceEvent = z.object({
  ...base,
  kind: z.literal('node'),
  node_from: z.string(),
  node_to: z.string(),
  payload: z.unknown().optional(),
});

export const ToolTraceEvent = z.object({
  ...base,
  kind: z.literal('tool'),
  call_id: z.string(),
  tool_name: z.string(),
  phase: TracePhase,
  payload: z.unknown().optional(),
});

export const OutboundTraceEvent = z.object({
  ...base,
  kind: z.literal('outbound'),
  server_event_type: z.string(),
  payload: z.unknown().optional(),
});

export const OverflowTraceEvent = z.object({
  ...base,
  kind: z.literal('overflow'),
  dropped_count: z.number().int().nonnegative(),
});

// A judgment recorded for a turn (Initiative 4). `surface` names the decision
// site (e.g. 'intent_no_act'), `decision`/`reason` are the override-not-depend
// audit trail, `evidence` carries detector specifics. Off the hot path.
export const DecisionTraceEvent = z.object({
  ...base,
  kind: z.literal('decision'),
  surface: z.string(),
  decision: z.string(),
  reason: z.string(),
  evidence: z.record(z.unknown()).optional(),
});

export const TraceEvent = z.discriminatedUnion('kind', [
  NodeTraceEvent,
  ToolTraceEvent,
  OutboundTraceEvent,
  OverflowTraceEvent,
  DecisionTraceEvent,
]);
export type TraceEvent = z.infer<typeof TraceEvent>;

export const TRACE_SCHEMA_V = 1;
