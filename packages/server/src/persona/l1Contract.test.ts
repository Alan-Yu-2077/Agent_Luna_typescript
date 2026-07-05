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

  test('base keeps locate-first + plan; the map clause is gated on repo_map mount (v0.27.5)', () => {
    const base = renderL1Contract();
    expect(base).toContain('locate first'); // list_files/grep/read_file always mounted
    expect(base).toContain('set a plan first'); // plan always mounted
    expect(base).not.toContain('find_symbol'); // gated off with no repo_map
    expect(base).not.toContain('repo_map');
    const withMap = renderL1Contract(false, false, false, false, false, false, true);
    expect(withMap).toContain('find_symbol');
    expect(withMap).toContain('repo_map');
  });

  test('code-write + shell clauses are gated on their own mounts (v0.27.5)', () => {
    const off = renderL1Contract();
    expect(off).not.toContain('edit and multi_edit refuse'); // read-before-edit clause
    expect(off).not.toContain('typecheck or run_tests'); // run-and-verify clause

    const codeWrite = renderL1Contract(false, false, false, false, true, false, false);
    expect(codeWrite).toContain('edit and multi_edit refuse');
    expect(codeWrite).not.toContain('typecheck or run_tests'); // shell still off

    const shell = renderL1Contract(false, false, false, false, false, true, false);
    expect(shell).toContain('typecheck or run_tests');
    expect(shell).not.toContain('edit and multi_edit refuse'); // code-write still off

    // per-variant byte-stable (cache invariant)
    expect(renderL1Contract(false, false, false, false, true, false, false)).toBe(codeWrite);
  });

  test('web clause is gated on web_search being mounted (v0.18.0)', () => {
    const off = renderL1Contract(false);
    const on = renderL1Contract(true);
    expect(off).not.toContain('search the live web');
    expect(on).toContain('search the live web');
    // commitment-to-act for the web (the 嘴上说手没动 fix)
    expect(on).toContain('THIS SAME turn');
    // each variant is byte-stable across calls (per-variant cache invariant)
    expect(renderL1Contract(true)).toBe(on);
    expect(renderL1Contract(false)).toBe(off);
  });

  test('skills clause is gated on the skills mount, in two shelf-honest variants (v0.32.0)', () => {
    const off = renderL1Contract();
    expect(off).not.toContain('skill shelf');
    expect(off).not.toContain('skill library');

    // mounted + shelf visible → the shelf variant
    const withShelf = renderL1Contract(false, false, false, false, false, false, false, true, true);
    expect(withShelf).toContain('skill shelf');
    expect(withShelf).toContain('listed by name in your context');
    expect(withShelf).toContain('recall_skill');
    expect(withShelf).toContain('save_skill');
    expect(withShelf).toContain('facts go to remember');

    // mounted but shelf suppressed (LUNA_SKILL_SHELF=0 / LUNA_MEMORY_INJECT=0) → the
    // library variant: still teaches recall/save, never asserts an in-context listing
    const noShelf = renderL1Contract(false, false, false, false, false, false, false, true, false);
    expect(noShelf).toContain('skill library');
    expect(noShelf).not.toContain('listed by name in your context');
    expect(noShelf).toContain('recall_skill');
    expect(noShelf).toContain('save_skill');

    // distinct memo-key segments — no collision across the three variants
    expect(withShelf).not.toBe(noShelf);
    expect(noShelf).not.toBe(off);
    expect(renderL1Contract(false, false, false, false, false, false, false, true, true)).toBe(
      withShelf,
    );
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

  test('LUNA_L1_CONTRACT=0: contract absent from the system core', async () => {
    Bun.env['LUNA_L1_CONTRACT'] = '0'; // default is ON since v0.9.0
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
        text.indexOf('This is who you are'),
      );
    }
  });
});
