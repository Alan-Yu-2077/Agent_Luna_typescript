import { describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  collapseOldToolResults,
  stripCorrectiveDirectives,
  stripThinking,
} from './cleanHistory';

function asMsgs(m: unknown[]): Anthropic.MessageParam[] {
  return m as Anthropic.MessageParam[];
}

describe('stripThinking', () => {
  test('drops thinking/redacted_thinking, keeps text + tool_use blocks', () => {
    const msgs = asMsgs([
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'let me think', signature: 'sig' },
          { type: 'tool_use', id: 'tu1', name: 'time_now', input: {} },
        ],
      },
    ]);
    stripThinking(msgs);
    const blocks = msgs[1]!.content as Anthropic.ContentBlock[];
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.type).toBe('tool_use');
  });

  test('a clean turn round-trips unchanged', () => {
    const msgs = asMsgs([{ role: 'assistant', content: [{ type: 'text', text: 'noon' }] }]);
    const snapshot = JSON.stringify(msgs);
    stripThinking(msgs);
    expect(JSON.stringify(msgs)).toBe(snapshot);
  });

  test('only strips from the given index onward (in-flight turn untouched)', () => {
    const msgs = asMsgs([
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 't0', signature: 's' },
          { type: 'text', text: 'a' },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 't1', signature: 's' },
          { type: 'text', text: 'b' },
        ],
      },
    ]);
    stripThinking(msgs, 1); // keep index 0 intact (simulating the in-flight turn)
    expect((msgs[0]!.content as Anthropic.ContentBlock[]).length).toBe(2); // untouched
    expect((msgs[1]!.content as Anthropic.ContentBlock[]).length).toBe(1); // thinking dropped
  });

  test('never strips an assistant message to empty', () => {
    const msgs = asMsgs([
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'only', signature: 's' }] },
    ]);
    stripThinking(msgs);
    expect((msgs[0]!.content as Anthropic.ContentBlock[]).length).toBe(1); // left as-is
  });
});

describe('collapseOldToolResults', () => {
  test('collapses old tool_result payloads, keeps recent + the tool_use_id', () => {
    // 8 messages; keepRecent=2 → collapse tool_results in the first 6.
    const msgs = asMsgs([
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'old', content: 'big payload' }],
      },
      ...Array.from({ length: 6 }, () => ({
        role: 'assistant',
        content: [{ type: 'text', text: 'x' }],
      })),
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'recent', content: 'fresh payload' }],
      },
    ]);
    const out = collapseOldToolResults(msgs, 2);
    // narrowing the union block to the tool_result shape we constructed (test-only)
    const oldBlock = (out[0]!.content as unknown[])[0] as { tool_use_id: string; content: string };
    expect(oldBlock.tool_use_id).toBe('old'); // record preserved
    expect(oldBlock.content).toBe('[tool_result elided]'); // payload collapsed
    const recentBlock = (out.at(-1)!.content as unknown[])[0] as { content: string };
    expect(recentBlock.content).toBe('fresh payload'); // recent kept full
  });

  test('non-mutating: the input array is unchanged', () => {
    const msgs = asMsgs([
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'payload' }] },
      ...Array.from({ length: 8 }, () => ({
        role: 'assistant',
        content: [{ type: 'text', text: 'x' }],
      })),
    ]);
    const before = JSON.stringify(msgs);
    collapseOldToolResults(msgs, 2);
    expect(JSON.stringify(msgs)).toBe(before);
  });
});

describe('stripCorrectiveDirectives', () => {
  const rolesOf = (m: Anthropic.MessageParam[]): string[] => m.map((x) => x.role);
  const noConsecutiveSameRole = (m: Anthropic.MessageParam[]): boolean =>
    m.every((x, i) => i === 0 || x.role !== m[i - 1]!.role);

  test('removes the directive and coalesces the flanking assistant turns, preserving tool pairing', () => {
    const dir: Anthropic.MessageParam = {
      role: 'user',
      content: [{ type: 'text', text: '(Stage direction: you said you would look something up…)' }],
    };
    const msgs = asMsgs([
      { role: 'user', content: [{ type: 'text', text: 'q' }] }, // 0
      { role: 'assistant', content: [{ type: 'text', text: 'let me check that' }] }, // 1 end_turn round
      dir, // 2 corrective (to be stripped)
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tu1', name: 'recall', input: {} },
          { type: 'text', text: 'found it' },
        ],
      }, // 3 retry round
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'hit' }] }, // 4
    ]);
    stripCorrectiveDirectives(msgs, new Set([dir]));

    expect(msgs.length).toBe(3);
    expect(rolesOf(msgs)).toEqual(['user', 'assistant', 'user']);
    expect(noConsecutiveSameRole(msgs)).toBe(true);
    // no fabricated user directive survives
    expect(JSON.stringify(msgs)).not.toContain('Stage direction');
    // the two assistant turns merged in order, keeping the tool_use
    const merged = msgs[1]!.content as Anthropic.ContentBlock[];
    expect(merged.map((b) => b.type)).toEqual(['text', 'tool_use', 'text']);
    // tool_use tu1 still precedes its tool_result tu1
    const result = (msgs[2]!.content as unknown[])[0] as { tool_use_id: string };
    expect(result.tool_use_id).toBe('tu1');
  });

  test('empty directive set is a no-op', () => {
    const msgs = asMsgs([
      { role: 'user', content: [{ type: 'text', text: 'q' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'a' }] },
    ]);
    const before = JSON.stringify(msgs);
    stripCorrectiveDirectives(msgs, new Set());
    expect(JSON.stringify(msgs)).toBe(before);
  });

  test('two directives across two corrections both go, coalescing all three assistants', () => {
    const d1: Anthropic.MessageParam = { role: 'user', content: [{ type: 'text', text: 'DIR1' }] };
    const d2: Anthropic.MessageParam = { role: 'user', content: [{ type: 'text', text: 'DIR2' }] };
    const msgs = asMsgs([
      { role: 'user', content: [{ type: 'text', text: 'q' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'A' }] },
      d1,
      { role: 'assistant', content: [{ type: 'text', text: 'B' }] },
      d2,
      { role: 'assistant', content: [{ type: 'text', text: 'C' }] },
    ]);
    stripCorrectiveDirectives(msgs, new Set([d1, d2]));

    expect(rolesOf(msgs)).toEqual(['user', 'assistant']);
    const merged = (msgs[1]!.content as Anthropic.ContentBlock[])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');
    expect(merged).toBe('ABC');
  });

  test('only touches [from, end): a same-named directive object before `from` is left alone', () => {
    const dir: Anthropic.MessageParam = { role: 'user', content: [{ type: 'text', text: 'DIR' }] };
    const msgs = asMsgs([
      dir, // 0 — before `from`, must survive
      { role: 'assistant', content: [{ type: 'text', text: 'prev' }] },
      { role: 'user', content: [{ type: 'text', text: 'q' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'a' }] },
    ]);
    stripCorrectiveDirectives(msgs, new Set([dir]), 2);
    expect(msgs.length).toBe(4);
    expect(msgs[0]).toBe(dir);
  });
});
