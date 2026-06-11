import { beforeEach, describe, expect, test } from 'bun:test';
import { getRememberStore, rememberTool, resetRememberStore } from './remember';

const ctx = (sessionId: string) => ({
  sessionId,
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

async function run(
  input: { kind: 'fact' | 'preference' | 'moment'; text: string },
  sessionId: string,
): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const e of rememberTool.execute(input, ctx(sessionId))) out.push(e);
  return out;
}

describe('remember', () => {
  beforeEach(() => {
    resetRememberStore();
  });

  test('store-then-list within same session returns the item', async () => {
    const events = await run({ kind: 'fact', text: 'sky is blue' }, 'sA');
    expect(events.length).toBe(1);
    const e = events[0] as { kind: string; data: { stored: boolean; id: string } };
    expect(e.kind).toBe('ok');
    expect(e.data.stored).toBe(true);
    expect(e.data.id.startsWith('sA:')).toBe(true);

    const stored = getRememberStore('sA');
    expect(stored.length).toBe(1);
    expect(stored[0]?.text).toBe('sky is blue');
    expect(stored[0]?.kind).toBe('fact');
  });

  test('different sessions are isolated', async () => {
    await run({ kind: 'fact', text: 'in session A' }, 'sA');
    await run({ kind: 'preference', text: 'in session B' }, 'sB');

    const a = getRememberStore('sA');
    const b = getRememberStore('sB');
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(a[0]?.text).toBe('in session A');
    expect(b[0]?.text).toBe('in session B');
  });

  test('summarize includes the id', () => {
    expect(rememberTool.summarize({ stored: true, id: 'sA:7' })).toBe('Stored as sA:7');
  });
});
