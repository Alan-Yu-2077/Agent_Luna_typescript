// v0.44.1 — the polite disconnect. ← Menu closes the session, but never mid-sentence: if a turn is
// in flight, the disconnect waits for its end. No new state machine — this just watches the turn
// lifecycle events the wire already carries, including the proactive pair (a proactive turn
// deliberately emits no `turn.started`, v0.33.2, so tracking only the reactive pair would cut her
// off exactly when she chose to speak unprompted).

type LifecycleEvent = { type: string };

export function createReturnGate(): {
  onEvent: (e: LifecycleEvent) => void;
  request: (disconnect: () => void) => void;
  inFlight: () => boolean;
} {
  let inFlight = false;
  let pending: (() => void) | null = null;

  const settle = (): void => {
    inFlight = false;
    if (pending) {
      const run = pending;
      pending = null;
      run();
    }
  };

  return {
    onEvent: (e) => {
      if (e.type === 'turn.started' || e.type === 'proactive.started') inFlight = true;
      // `error` settles too: if a turn died on an error frame, waiting for a `turn.result` that may
      // never come would wedge the return forever — disconnecting after an error is still polite.
      else if (e.type === 'turn.result' || e.type === 'proactive.finished' || e.type === 'error') settle();
    },
    request: (disconnect) => {
      if (inFlight) pending = disconnect;
      else disconnect();
    },
    inFlight: () => inFlight,
  };
}
