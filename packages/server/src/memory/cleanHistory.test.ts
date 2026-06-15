import { describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import { collapseOldToolResults, stripThinking } from './cleanHistory';

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
