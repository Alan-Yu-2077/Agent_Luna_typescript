import { describe, expect, test } from 'bun:test';
import { createReturnGate } from './returnGate';

describe('the polite disconnect (v0.44.1)', () => {
  test('idle → the disconnect runs immediately', () => {
    const gate = createReturnGate();
    let ran = 0;
    gate.request(() => ran++);
    expect(ran).toBe(1);
  });

  test('mid-turn → deferred until turn.result, then exactly once', () => {
    const gate = createReturnGate();
    let ran = 0;
    gate.onEvent({ type: 'turn.started' });
    gate.request(() => ran++);
    expect(ran).toBe(0); // she is mid-sentence — not yet
    gate.onEvent({ type: 'reply.token' }); // unrelated traffic must not trigger it
    expect(ran).toBe(0);
    gate.onEvent({ type: 'turn.result' });
    expect(ran).toBe(1);
    gate.onEvent({ type: 'turn.result' }); // a later turn end must not re-run it
    expect(ran).toBe(1);
  });

  // A proactive turn deliberately emits no turn.started (v0.33.2) — tracking only the reactive pair
  // would cut her off exactly when she chose to speak unprompted.
  test('a proactive turn defers the same way', () => {
    const gate = createReturnGate();
    let ran = 0;
    gate.onEvent({ type: 'proactive.started' });
    gate.request(() => ran++);
    expect(ran).toBe(0);
    gate.onEvent({ type: 'proactive.finished' });
    expect(ran).toBe(1);
  });

  test('an error frame settles the flight — a turn that died must not wedge the return forever', () => {
    const gate = createReturnGate();
    let ran = 0;
    gate.onEvent({ type: 'turn.started' });
    gate.request(() => ran++);
    gate.onEvent({ type: 'error' });
    expect(ran).toBe(1);
  });

  test('a request with no pending flight after an earlier deferral is immediate again', () => {
    const gate = createReturnGate();
    let first = 0;
    let second = 0;
    gate.onEvent({ type: 'turn.started' });
    gate.request(() => first++);
    gate.onEvent({ type: 'turn.result' });
    expect(first).toBe(1);
    gate.request(() => second++);
    expect(second).toBe(1);
  });

  test('inFlight reads honestly', () => {
    const gate = createReturnGate();
    expect(gate.inFlight()).toBe(false);
    gate.onEvent({ type: 'turn.started' });
    expect(gate.inFlight()).toBe(true);
    gate.onEvent({ type: 'turn.result' });
    expect(gate.inFlight()).toBe(false);
  });
});
