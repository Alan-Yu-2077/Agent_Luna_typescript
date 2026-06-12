// Generic StateGraph: N is the union of non-terminal node names; every node
// returns the next node or 'end'. Used by the turn loop (TurnNode) and the
// dream cycle (DreamNode) — one orchestration shape, one trace seam.
export type NodeFn<S, N extends string> = (state: S) => Promise<N | 'end'>;

export type Graph<S, N extends string> = Record<N, NodeFn<S, N>>;

export type TransitionHook<S, N extends string> = (
  from: N | '_',
  to: N | 'end',
  state: S,
) => void;

export async function runGraph<S, N extends string>(
  graph: Graph<S, N>,
  start: N,
  state: S,
  onTransition?: TransitionHook<S, N>,
): Promise<void> {
  let current: N | 'end' = start;
  onTransition?.('_', current, state);
  while (current !== 'end') {
    const from: N = current;
    const next: N | 'end' = await graph[from](state);
    onTransition?.(from, next, state);
    current = next;
  }
}

export type TurnNode =
  | 'parse_input'
  | 'build_request'
  | 'open_stream'
  | 'dispatch_tools'
  | 'append_results'
  | 'finalize';

export type NodeName = TurnNode | 'end';
