import { describe, expect, test } from 'bun:test';
import type { MessageDelivery, ServerEvent } from '@luna/protocol';
import { createController } from './controller';
import type { BubbleView, ChipKind } from './bubbles';
import type { AudioSink, Live2DSink } from './sinks';

type Call = [string, ...unknown[]];

function harness() {
  const calls: Call[] = [];
  const view: BubbleView = {
    open: (id) => calls.push(['open', id]),
    append: (id, t) => calls.push(['append', id, t]),
    finalize: (id, t) => calls.push(['finalize', id, t]),
    discard: (id) => calls.push(['discard', id]),
    chip: (kind: ChipKind, text) => calls.push(['chip', kind, text]),
    renderHistory: (turns) => calls.push(['history', turns]),
  };
  const states: string[] = [];
  const live2d: Live2DSink = {
    setExpression: (k, e) => calls.push(['expr', k, e]),
    setState: (s) => states.push(s),
    setMouthOpen: () => {},
    clear: () => calls.push(['clear']),
  };
  const spoken: string[] = [];
  const audio: AudioSink = {
    speak: async (t) => {
      spoken.push(t);
    },
    stop: () => {},
  };
  const { handle } = createController({ view, live2d, audio });
  return { handle, calls, spoken, states };
}

function delivery(over: Partial<MessageDelivery> = {}): MessageDelivery {
  return { text: '你好', segments: [], is_final: true, ...over };
}

const okMessage = (callId: string, data: MessageDelivery): ServerEvent => ({
  type: 'tool.finished',
  call_id: callId,
  result: { kind: 'ok', data, summary: data.text.slice(0, 30) },
});

describe('frontend controller — message-tool consumption', () => {
  test('a streamed message: open → append → finalize + expression + speak', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle({ type: 'tool.progress', call_id: 'm1', tool_name: 'message', payload: { text_delta: '想' } });
    h.handle({ type: 'tool.progress', call_id: 'm1', tool_name: 'message', payload: { text_delta: '你了' } });
    h.handle(okMessage('m1', delivery({ text: '想你了', expression: 'soft_warmth', emotion: 0.6 })));

    expect(h.calls).toEqual([
      ['open', 'm1'],
      ['append', 'm1', '想'],
      ['append', 'm1', '你了'],
      ['finalize', 'm1', '想你了'],
      ['expr', 'soft_warmth', 0.6],
    ]);
    expect(h.spoken).toEqual(['想你了']);
  });

  test('history event replays prior turns through renderHistory (mapped shape)', () => {
    const h = harness();
    h.handle({
      type: 'history',
      turns: [
        { user_text: '在吗', assistant_text: '在的', t_ms: 1000 },
        { user_text: '', assistant_text: '(自言自语)', t_ms: 2000 },
      ],
    });
    expect(h.calls).toEqual([
      [
        'history',
        [
          { userText: '在吗', assistantText: '在的', tMs: 1000 },
          { userText: '', assistantText: '(自言自语)', tMs: 2000 },
        ],
      ],
    ]);
  });

  test('two message bubbles in one turn stream independently', () => {
    const h = harness();
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle({ type: 'tool.started', call_id: 'm2', tool_name: 'message', input: {} });
    h.handle(okMessage('m1', delivery({ text: '第一句' })));
    h.handle(okMessage('m2', delivery({ text: '第二句' })));
    expect(h.calls).toContainEqual(['open', 'm1']);
    expect(h.calls).toContainEqual(['open', 'm2']);
    expect(h.calls).toContainEqual(['finalize', 'm1', '第一句']);
    expect(h.calls).toContainEqual(['finalize', 'm2', '第二句']);
  });

  test('a failed message delivery (validation) discards the preview + surfaces a re-say', () => {
    const h = harness();
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle({ type: 'tool.progress', call_id: 'm1', tool_name: 'message', payload: { text_delta: '太长了…' } });
    h.handle({
      type: 'tool.finished',
      call_id: 'm1',
      result: { kind: 'err', code: 'validation_failed', message: 'too long', recoverable: true },
    });
    expect(h.calls).toContainEqual(['discard', 'm1']);
    expect(h.calls.some((c) => c[0] === 'chip' && c[1] === 'error')).toBe(true);
  });

  test('no expression / no voice → finalize only, no live2d/audio', () => {
    const h = harness();
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle(okMessage('m1', delivery({ text: '嗯' })));
    expect(h.calls).toEqual([
      ['open', 'm1'],
      ['finalize', 'm1', '嗯'],
    ]);
    expect(h.spoken).toEqual(['嗯']); // speak is called with the text; the stub records it
  });
});

describe('frontend controller — other events', () => {
  test('reply.token (text mode) streams into the synthetic reply bubble', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'reply.token', turn_id: 't1', text: 'Hi ' });
    h.handle({ type: 'reply.token', turn_id: 't1', text: 'there' });
    expect(h.calls).toEqual([
      ['open', 'reply'],
      ['append', 'reply', 'Hi '],
      ['append', 'reply', 'there'],
    ]);
  });

  test('non-message tool → tool chips (started + finished summary)', () => {
    const h = harness();
    h.handle({ type: 'tool.started', call_id: 'r1', tool_name: 'recall', input: {} });
    h.handle({
      type: 'tool.finished',
      call_id: 'r1',
      result: { kind: 'ok', data: { hits: [] }, summary: '2 hits' },
    });
    expect(h.calls.filter((c) => c[0] === 'chip' && c[1] === 'tool').length).toBe(2);
  });

  test('dream + proactive + error events render chips', () => {
    const h = harness();
    h.handle({ type: 'dream.status', is_dreaming: true, current_step: 'memory_audit', last_dream_ms: null });
    h.handle({ type: 'dream.step', step: 'run_diaries', status: 'ok', detail: '1 diary' });
    h.handle({ type: 'proactive.started', cycle_id: 'c1' });
    h.handle({ type: 'proactive.finished', cycle_id: 'c1', spoke: false });
    h.handle({ type: 'error', code: 'dreaming', message: 'busy' });
    expect(h.calls.filter((c) => c[1] === 'dream').length).toBe(2);
    expect(h.calls.filter((c) => c[1] === 'proactive').length).toBe(2); // started + finished(silent)
    expect(h.calls.filter((c) => c[1] === 'error').length).toBe(1);
  });

  test('proactive.finished spoke:true → no chip (she spoke via bubbles)', () => {
    const h = harness();
    h.handle({ type: 'proactive.finished', cycle_id: 'c1', spoke: true });
    expect(h.calls.length).toBe(0);
  });

  test('pong is consumed without error', () => {
    const h = harness();
    h.handle({ type: 'pong', seq: 1, server_time_ms: 123 });
    expect(h.calls.length).toBe(0);
  });

  test('live2d state follows the turn + dream lifecycle', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle({
      type: 'turn.result',
      turn_id: 't1',
      text: 'hi',
      finish_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    h.handle({ type: 'dream.status', is_dreaming: true, current_step: null, last_dream_ms: null });
    h.handle({ type: 'dream.status', is_dreaming: false, current_step: null, last_dream_ms: null });
    expect(h.states).toEqual(['thinking', 'speaking', 'neutral', 'sleeping', 'neutral']);
  });
});
