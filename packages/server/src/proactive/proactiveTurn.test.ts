import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';
import { resetProactiveOpenersForTests, runProactiveTurn } from './proactiveTurn';

function msgRound(calls: { id: string; input: unknown }[]): ProviderEvent {
  const toolUses = calls.map((c) => ({ id: c.id, name: 'message', input: c.input }));
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses,
    assistantContent: toolUses.map((t) => ({
      type: 'tool_use',
      id: t.id,
      name: t.name,
      input: t.input,
    })) as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function toolRound(id: string, name: string, input: unknown): ProviderEvent {
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses: [{ id, name, input }],
    assistantContent: [{ type: 'tool_use', id, name, input }] as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

const endRound: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

let db: Database;
let store: TraceStore;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  db.exec(readFileSync(join(import.meta.dir, '..', 'migrations', '0001_traces.sql'), 'utf8'));
  store = new TraceStore(db);
  setTraceStore(store);
  delete Bun.env['LUNA_TRACE'];
  resetSessions();
});

afterEach(() => {
  setTraceStore(null);
  delete Bun.env['LUNA_TRACE'];
  db.close(false);
});

async function fire(provider: MockProvider): Promise<{ result: { spoke: boolean }; events: ServerEvent[] }> {
  const events: ServerEvent[] = [];
  const result = await runProactiveTurn({
    session: getSession('default'),
    cycleId: 'c1',
    provider,
    registry: messageRegistry,
    emit: (e) => events.push(e),
  });
  return { result, events };
}

describe('runProactiveTurn', () => {
  test('silent outcome: acts via a tool, sends no message → no empty-reply retry, spoke=false', async () => {
    const provider = new MockProvider([
      [toolRound('rf1', 'remember', { action: 'add', category: 'key_moments', text: '今天很安静' })],
      [endRound], // ends without a message — a legitimate silent proactive turn
    ]);
    const { result, events } = await fire(provider);

    expect(result.spoke).toBe(false);
    // exactly 2 rounds: no empty-reply guard retry was injected
    expect(provider.requests.length).toBe(2);
    const finished = events.find((e) => e.type === 'proactive.finished') as { spoke: boolean };
    expect(finished.spoke).toBe(false);
    // the silent outcome is traced
    const silent = store
      .getEventsByTurn('proactive:c1')
      .some((e) => JSON.parse(e.payload_json).payload?.proactive_silent === true);
    expect(silent).toBe(true);
  });

  test('does NOT emit turn.started — only proactive.started (v0.33.2 barge-in fix)', async () => {
    // turn.started makes the frontend stop the prior reply's still-playing TTS (barge-in),
    // so a 💭 continuation was cutting off the message it followed. A proactive turn must
    // announce itself only via proactive.started.
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '突然想到你。', is_final: true } }])],
      [endRound],
    ]);
    const { events } = await fire(provider);
    expect(events.some((e) => e.type === 'proactive.started')).toBe(true);
    expect(events.some((e) => e.type === 'turn.started')).toBe(false);
  });

  test('speaking outcome: sends a message → spoke=true, turn.result carries the text', async () => {
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '突然想到你，就来打个招呼。', is_final: true } }])],
      [endRound],
    ]);
    const { result, events } = await fire(provider);

    expect(result.spoke).toBe(true);
    const turnResult = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(turnResult.text).toBe('突然想到你，就来打个招呼。');
    expect(events.find((e) => e.type === 'proactive.started')).toBeTruthy();
    expect((events.find((e) => e.type === 'proactive.finished') as { spoke: boolean }).spoke).toBe(true);
  });

  test('emits proactive.started before any turn activity and proactive.finished last', async () => {
    const provider = new MockProvider([[endRound]]);
    const { events } = await fire(provider);
    expect(events[0]!.type).toBe('proactive.started');
    expect(events[events.length - 1]!.type).toBe('proactive.finished');
  });

  test('integrity guards still apply to a message a proactive turn DOES send', async () => {
    // promises an act in a message but calls no tool → guard should still fire
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '我马上去查一下。', is_final: true } }])],
      [endRound], // promised, no tool → integrity guard retries (not the empty guard)
      [msgRound([{ id: 'm2', input: { text: '算了，没什么要紧的。', is_final: true } }])],
      [endRound],
    ]);
    const { events } = await fire(provider);
    const corrected = store
      .getEventsByTurn('proactive:c1')
      .some((e) => {
        const p = JSON.parse(e.payload_json);
        return p.surface === 'integrity_guard' && p.decision === 'corrected';
      });
    expect(corrected).toBe(true);
    expect(events.find((e) => e.type === 'turn.result')).toBeTruthy();
    delete Bun.env['LUNA_INTEGRITY_GUARD'];
  });
});

function userText(req: { messages: Anthropic.MessageParam[] }): string {
  return req.messages
    .filter((m) => m.role === 'user')
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b) => (b as { type: string }).type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n');
}

describe('runProactiveTurn — ladder scenario framing (v0.24.0)', () => {
  test('a scenario framing carries the scenario body + the companion constraint, not the old intent directive', async () => {
    const provider = new MockProvider([[endRound]]);
    await runProactiveTurn({
      session: getSession('default'),
      cycleId: 'c1',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'renudge',
    });
    const t = userText(provider.requests[0]!);
    expect(t).toContain('LIGHTER'); // the renudge restraint body
    expect(t).toContain('check up on him'); // COMPANION_OPENER_CONSTRAINT
    expect(t).toContain('在吗'); // a named banned opener
    expect(t).not.toContain('You woke on your own'); // NOT the old `spontaneous` intent directive
  });

  test('anti-repeat: a spoken opener is fed back into the next scenario framing', async () => {
    resetProactiveOpenersForTests();
    await runProactiveTurn({
      session: getSession('default'),
      cycleId: 'c1',
      provider: new MockProvider([
        [msgRound([{ id: 'm1', input: { text: 'the window looks orange tonight', is_final: true } }])],
        [endRound],
      ]),
      registry: messageRegistry,
      emit: () => {},
      scenario: 'idle_nudge',
    });
    const provider2 = new MockProvider([[endRound]]);
    await runProactiveTurn({
      session: getSession('default'),
      cycleId: 'c2',
      provider: provider2,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'idle_nudge',
    });
    const t = userText(provider2.requests[0]!);
    expect(t).toContain("Don't reopen"); // the anti-repeat clause is present
    expect(t).toContain('the window looks orange tonight'); // and quotes her prior opener
  });
});
