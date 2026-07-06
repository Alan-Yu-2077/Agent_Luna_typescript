import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn } from './runTurn';

// v0.32.4 — after a message marked is_final:true (and nothing else that round), the
// turn short-circuits to finalize instead of spending a trailing model round while
// `activeTurn` stays locked (the "chat looks stopped but the turn is still running →
// the next send bounces with turn_in_progress" bug).

function msgStop(uses: { id: string; name: string; input: unknown }[]): ProviderEvent {
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses: uses,
    assistantContent: uses.map((u) => ({
      type: 'tool_use',
      id: u.id,
      name: u.name,
      input: u.input,
    })) as unknown as Anthropic.ContentBlock[],
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

async function run(turnId: string, provider: MockProvider): Promise<ServerEvent[]> {
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

describe('is_final short-circuit (v0.32.4)', () => {
  beforeEach(() => {
    resetSessions();
    delete Bun.env['LUNA_INTEGRITY_GUARD'];
  });
  afterEach(() => resetSessions());

  test('message(is_final:true) ends the turn WITHOUT a trailing model round', async () => {
    // Two rounds scripted, but only the first should ever be requested.
    const provider = new MockProvider([
      [msgStop([{ id: 'm1', name: 'message', input: { text: '就这样啦', is_final: true } }])],
      [endRound],
    ]);
    const events = await run('t1', provider);
    expect(provider.requests.length).toBe(1); // the trailing endRound was NOT requested
    expect(getSession('default').activeTurn).toBeNull(); // wedge window closed
    expect(events.some((e) => e.type === 'turn.result')).toBe(true);
    expect(events.some((e) => e.type === 'tool.finished' && e.result.kind === 'ok')).toBe(true);
  });

  test('message(is_final:false) still runs the trailing round (more is coming)', async () => {
    const provider = new MockProvider([
      [msgStop([{ id: 'm1', name: 'message', input: { text: '先说一句', is_final: false } }])],
      [msgStop([{ id: 'm2', name: 'message', input: { text: '再补一句', is_final: true } }])],
      [endRound],
    ]);
    await run('t2', provider);
    // false → not short-circuited → the 2nd message round runs; THAT one is
    // is_final:true + message-only → it short-circuits → exactly 2 requests.
    expect(provider.requests.length).toBe(2);
  });

  test('a real action tool this round is NOT short-circuited even with a final message', async () => {
    const provider = new MockProvider([
      [
        msgStop([
          { id: 'm1', name: 'message', input: { text: '现在几点', is_final: true } },
          { id: 'tn', name: 'time_now', input: {} },
        ]),
      ],
      [endRound],
    ]);
    await run('t3', provider);
    expect(provider.requests.length).toBe(2); // the action tool's result needed a round
  });
});
