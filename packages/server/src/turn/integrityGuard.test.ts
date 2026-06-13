import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn } from './runTurn';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';

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
    assistantContent: [
      { type: 'tool_use', id, name, input },
    ] as unknown as Anthropic.ContentBlock[],
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
const savedGuard = Bun.env['LUNA_INTEGRITY_GUARD'];

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
  if (savedGuard === undefined) delete Bun.env['LUNA_INTEGRITY_GUARD'];
  else Bun.env['LUNA_INTEGRITY_GUARD'] = savedGuard;
  delete Bun.env['LUNA_DECISION_AUDIT'];
  delete Bun.env['LUNA_TRACE'];
  db.close(false);
});

async function turn(turnId: string, provider: MockProvider): Promise<ServerEvent[]> {
  const events: ServerEvent[] = [];
  await runTurn({
    session: getSession('default'),
    turnId,
    userText: '在吗',
    provider,
    registry: messageRegistry,
    emit: (e) => events.push(e),
  });
  return events;
}

function directivesInRequests(provider: MockProvider): string {
  return JSON.stringify(provider.requests.map((r) => r.messages));
}

function decisions(turnId: string): { decision: string; kind: string }[] {
  return store
    .getEventsByTurn(turnId)
    .filter((e) => e.kind === 'decision')
    .map((e) => {
      const p = JSON.parse(e.payload_json);
      return { decision: p.decision, kind: p.evidence?.kind };
    });
}

describe('is_final promise guard', () => {
  test('is_final:false then end → one corrective retry, then closes cleanly', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '我看看啊', is_final: false } }])],
      [endRound], // stops while "more coming" → guard fires
      [msgRound([{ id: 'm2', input: { text: '就是想问你好。', is_final: true } }])],
      [endRound],
    ]);
    const events = await turn('t1', provider);
    expect(provider.requests.length).toBe(4);
    expect(directivesInRequests(provider)).toContain('is_final:false');
    const ds = decisions('t1');
    expect(ds.filter((d) => d.decision === 'corrected' && d.kind === 'is_final_promise').length).toBe(1);
    const result = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(result.text).toBe('我看看啊\n就是想问你好。');
  });

  test('persistently is_final:false → corrected once then degraded, no infinite loop', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '先说一句', is_final: false } }])],
      [endRound],
      [msgRound([{ id: 'm2', input: { text: '再说一句', is_final: false } }])],
      [endRound],
    ]);
    await turn('t2', provider);
    expect(provider.requests.length).toBe(4); // 1 retry, then degrade — not more
    const ds = decisions('t2');
    expect(ds.some((d) => d.decision === 'corrected')).toBe(true);
    expect(ds.some((d) => d.decision === 'degraded')).toBe(true);
  });
});

describe('intent-without-act guard', () => {
  test('promised in message, no tool → double-exit retry; acting on retry closes clean', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '我马上去查一下。', is_final: true } }])],
      [endRound], // promised, no tool → guard fires
      [toolRound('rf1', 'read_file', { path: 'README.md' })], // acts on retry
      [msgRound([{ id: 'm2', input: { text: '查到了，没什么特别的。', is_final: true } }])],
      [endRound],
    ]);
    const events = await turn('t3', provider);
    expect(directivesInRequests(provider)).toContain('follow through');
    const ds = decisions('t3');
    expect(ds.filter((d) => d.decision === 'corrected' && d.kind === 'message_intent').length).toBe(1);
    // no degrade — the retry acted, so the watermark slice sees no fresh defection
    expect(ds.some((d) => d.decision === 'degraded')).toBe(false);
    expect(events.find((e) => e.type === 'turn.result')).toBeTruthy();
  });

  test('false positive safety: promised AND acted same round → no guard', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [
        msgRound([{ id: 'm1', input: { text: '我去查一下。', is_final: true } }]),
      ],
      [toolRound('rf1', 'read_file', { path: 'README.md' })],
      [endRound],
    ]);
    await turn('t4', provider);
    // 3 rounds = no retry injected (acted, so not a defection)
    expect(provider.requests.length).toBe(3);
    expect(decisions('t4').some((d) => d.decision === 'corrected')).toBe(false);
  });

  test('thinking-only promise (summarized) never drives a retry', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [
        { kind: 'thinking_delta', text: '用户问天气，我应该用工具查一下。' },
        msgRound([{ id: 'm1', input: { text: '今天我看不到外面，你那边怎么样？', is_final: true } }]),
      ],
      [endRound],
    ]);
    await turn('t5', provider);
    expect(provider.requests.length).toBe(2); // no retry
    expect(decisions('t5').some((d) => d.decision === 'corrected')).toBe(false);
  });
});

describe('flag-off parity', () => {
  test('guard + audit off → v0.8.1 behavior exactly (no retries, no decision traces)', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '0'; // both default ON since v0.9.0
    Bun.env['LUNA_DECISION_AUDIT'] = '0';
    const provider = new MockProvider([
      [msgRound([{ id: 'm1', input: { text: '我马上去查。', is_final: false } }])],
      [endRound],
    ]);
    await turn('t6', provider);
    // no guard retry: 2 rounds, turn settles with the one bubble
    expect(provider.requests.length).toBe(2);
    expect(decisions('t6').length).toBe(0);
  });

  test('empty-reply guard still works with the integrity flag off (v0.6.2 preserved)', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '0'; // empty guard is independent of this flag
    const provider = new MockProvider([
      [endRound], // no message at all → empty-reply guard (always on in message mode)
      [msgRound([{ id: 'm1', input: { text: '在的。', is_final: true } }])],
      [endRound],
    ]);
    const events = await turn('t7', provider);
    expect(provider.requests.length).toBe(3); // empty guard retried once
    const result = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(result.text).toBe('在的。');
  });
});

describe('multi-reason bound (each reason corrects once, turn still terminates)', () => {
  test('empty then promise in one turn → two distinct corrections, bounded, clean close', async () => {
    Bun.env['LUNA_INTEGRITY_GUARD'] = '1';
    const provider = new MockProvider([
      [endRound], // empty → empty-reply guard retries
      [msgRound([{ id: 'm1', input: { text: '我先说一句', is_final: false } }])],
      [endRound], // stopped while is_final:false → promise guard retries
      [msgRound([{ id: 'm2', input: { text: '好啦，就这些。', is_final: true } }])],
      [endRound],
    ]);
    const events = await turn('t8', provider);
    expect(provider.requests.length).toBe(5); // empty(+1) + promise(+1), then terminates
    const ds = decisions('t8');
    expect(ds.filter((d) => d.decision === 'corrected' && d.kind === 'is_final_promise').length).toBe(1);
    const result = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(result.text).toBe('我先说一句\n好啦，就这些。');
  });
});
