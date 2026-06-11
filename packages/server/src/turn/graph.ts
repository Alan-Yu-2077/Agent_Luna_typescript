export type NodeName =
  | 'parse_input'
  | 'build_request'
  | 'open_stream'
  | 'dispatch_tools'
  | 'append_results'
  | 'finalize'
  | 'end';

export type NodeFn<S> = (state: S) => Promise<NodeName>;

export type Graph<S> = Record<Exclude<NodeName, 'end'>, NodeFn<S>>;

export type TransitionHook<S> = (from: NodeName | '_', to: NodeName, state: S) => void;

export async function runGraph<S>(
  graph: Graph<S>,
  start: Exclude<NodeName, 'end'>,
  state: S,
  onTransition?: TransitionHook<S>,
): Promise<void> {
  let current: NodeName = start;
  onTransition?.('_', current, state);
  while (current !== 'end') {
    const next = await graph[current](state);
    onTransition?.(current, next, state);
    current = next;
  }
}
