// A1 (v0.16.1): a monotonic counter bumped whenever the durable memory that
// feeds the cached system block changes — L3 facts (add/forget) and core memory
// (update). The turn loop memoizes its rendered system block against this epoch
// (TurnState.systemBlock / systemBlockEpoch) and re-renders only when memory
// actually changed mid-turn (e.g. a `remember` tool call), instead of rebuilding
// it — 6 DB queries + an L1-contract string build — on every tool iteration.
let epoch = 0;

export function memoryEpoch(): number {
  return epoch;
}

export function bumpMemoryEpoch(): void {
  epoch += 1;
}
