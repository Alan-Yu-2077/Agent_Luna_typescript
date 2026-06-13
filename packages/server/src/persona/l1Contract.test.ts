import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { renderL1Contract } from './l1Contract';

const savedL1 = Bun.env['LUNA_L1_CONTRACT'];

beforeEach(() => {
  resetSessions();
});

afterEach(() => {
  if (savedL1 === undefined) delete Bun.env['LUNA_L1_CONTRACT'];
  else Bun.env['LUNA_L1_CONTRACT'] = savedL1;
});

describe('renderL1Contract', () => {
  test('is deterministic', () => {
    expect(renderL1Contract()).toBe(renderL1Contract());
  });

  test('states the four pillars', () => {
    const c = renderL1Contract();
    expect(c).toContain('Calling the tool IS the act'); // commitment-to-act
    expect(c).toContain('depth the moment asks'); // proportionality
    expect(c).toContain('backstage'); // no-leak
    expect(c).toContain('honest about what you can actually do'); // capability honesty
  });
});

function endRound(text: string): ProviderEvent[] {
  return [
    { kind: 'text_delta', text },
    {
      kind: 'message_stop',
      stopReason: 'end_turn',
      toolUses: [],
      assistantContent: [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  ];
}

function systemText(req: { system: unknown }): string {
  return JSON.stringify(req.system);
}

describe('L1 contract in the system core (runTurn)', () => {
  async function twoTurns(): Promise<MockProvider> {
    const session = getSession('l1');
    const provider = new MockProvider([endRound('one'), endRound('two')]);
    const opts = { session, provider, registry: builtinRegistry, emit: () => {} };
    await runTurn({ ...opts, turnId: 't1', userText: 'hi' });
    await runTurn({ ...opts, turnId: 't2', userText: 'again' });
    return provider;
  }

  test('flag on: contract present and byte-identical across no-change turns', async () => {
    Bun.env['LUNA_L1_CONTRACT'] = '1';
    const provider = await twoTurns();
    const sys1 = systemText(provider.requests[0]!);
    const sys2 = systemText(provider.requests[1]!);
    expect(sys1).toContain('Calling the tool IS the act');
    expect(sys1).toBe(sys2); // cache invariant
  });

  test('flag off (default): contract absent from the system core', async () => {
    delete Bun.env['LUNA_L1_CONTRACT'];
    const provider = await twoTurns();
    expect(systemText(provider.requests[0]!)).not.toContain('Calling the tool IS the act');
  });

  test('contract sits inside the single cached block, before the persona reference', async () => {
    Bun.env['LUNA_L1_CONTRACT'] = '1';
    const session = getSession('l1-order');
    const provider = new MockProvider([endRound('one')]);
    await runTurn({ session, turnId: 't1', userText: 'hi', provider, registry: builtinRegistry, emit: () => {} });
    const sys = provider.requests[0]!.system;
    expect(Array.isArray(sys)).toBe(true);
    if (Array.isArray(sys)) {
      // one block, one cache breakpoint
      expect(sys.length).toBe(1);
      const text = (sys[0] as { text: string }).text;
      expect(text.indexOf('How you think on a turn')).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('How you think on a turn')).toBeLessThan(
        text.indexOf('active runtime persona reference'),
      );
    }
  });
});
