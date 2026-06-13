import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { fireContinuation, shouldContinue } from './continuation';

const endRound: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

beforeEach(() => {
  resetSessions();
  Bun.env['LUNA_PROACTIVE'] = '1';
});
afterEach(() => {
  delete Bun.env['LUNA_PROACTIVE'];
  delete Bun.env['LUNA_SELFCONT'];
  delete Bun.env['LUNA_SELFCONT_PROBABILITY'];
});

describe('shouldContinue', () => {
  test('probability 1 → always continues', () => {
    Bun.env['LUNA_SELFCONT_PROBABILITY'] = '1';
    expect(shouldContinue()).toBe(true);
  });
  test('probability 0 → never continues', () => {
    Bun.env['LUNA_SELFCONT_PROBABILITY'] = '0';
    expect(shouldContinue()).toBe(false);
  });
  test('LUNA_SELFCONT=0 disables regardless of probability', () => {
    Bun.env['LUNA_SELFCONT'] = '0';
    Bun.env['LUNA_SELFCONT_PROBABILITY'] = '1';
    expect(shouldContinue()).toBe(false);
  });
  test('proactive kill switch off → no continuation', () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    Bun.env['LUNA_SELFCONT_PROBABILITY'] = '1';
    expect(shouldContinue()).toBe(false);
  });
});

describe('fireContinuation', () => {
  test('runs a continuation proactive turn when guards pass', async () => {
    const provider = new MockProvider([[endRound]]);
    const events: ServerEvent[] = [];
    await fireContinuation({
      session: getSession('default'),
      provider,
      registry: messageRegistry,
      emit: (e) => events.push(e),
    });
    expect(events.some((e) => e.type === 'proactive.started')).toBe(true);
    expect(provider.requests.length).toBeGreaterThanOrEqual(1);
  });

  test('skips while a turn is active (never overlaps)', async () => {
    const session = getSession('default');
    session.activeTurn = 'busy';
    const provider = new MockProvider([[endRound]]);
    const events: ServerEvent[] = [];
    await fireContinuation({ session, provider, registry: messageRegistry, emit: (e) => events.push(e) });
    expect(provider.requests.length).toBe(0);
    expect(events.length).toBe(0);
    session.activeTurn = null;
  });
});
