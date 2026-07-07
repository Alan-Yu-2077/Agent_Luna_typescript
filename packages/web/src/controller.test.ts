import { describe, expect, test } from 'bun:test';
import type { MessageDelivery, ServerEvent } from '@luna/protocol';
import { createController } from './controller';
import type { BubbleView, ChipKind } from './bubbles';
import { safeHttpHref } from './bubbles';
import type { AudioSink, Live2DSink } from './sinks';

type Call = [string, ...unknown[]];

function harness() {
  const calls: Call[] = [];
  // typing-indicator states kept OUT of `calls` (like audioStops) so the exact-
  // equality `calls` assertions stay stable while we assert the dots separately.
  const thinking: boolean[] = [];
  const view: BubbleView = {
    open: (id) => calls.push(['open', id]),
    append: (id, t) => calls.push(['append', id, t]),
    finalize: (id, t) => calls.push(['finalize', id, t]),
    discard: (id) => calls.push(['discard', id]),
    chip: (kind: ChipKind, text, href?: string) => calls.push(['chip', kind, text, href]),
    renderHistory: (turns) => calls.push(['history', turns]),
    setThinking: (on) => thinking.push(on),
  };
  const states: string[] = [];
  const live2d: Live2DSink = {
    setExpression: (k, e) => calls.push(['expr', k, e]),
    setState: (s) => states.push(s),
    setMouth: () => {},
    clear: () => calls.push(['clear']),
  };
  const spoken: string[] = [];
  const audioStops: number[] = []; // kept OUT of `calls` so exact-equality tests stay stable
  const audio: AudioSink = {
    speak: async (t) => {
      spoken.push(t);
    },
    stop: () => {
      audioStops.push(1);
    },
  };
  const { handle } = createController({ view, live2d, audio });
  const lastThinking = () => thinking[thinking.length - 1];
  return { handle, calls, spoken, states, audioStops, thinking, lastThinking };
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

  test('a failed message delivery (validation) discards the preview SILENTLY (no leaked error)', () => {
    const h = harness();
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle({ type: 'tool.progress', call_id: 'm1', tool_name: 'message', payload: { text_delta: '太长了…' } });
    h.handle({
      type: 'tool.finished',
      call_id: 'm1',
      result: { kind: 'err', code: 'validation_failed', message: 'too long', recoverable: true },
    });
    expect(h.calls).toContainEqual(['discard', 'm1']);
    expect(h.calls.some((c) => c[0] === 'chip' && c[1] === 'error')).toBe(false); // backstage
  });

  test('a message rejected at input-validation (NO tool.started) is still silent, not a raw-error chip', () => {
    const h = harness();
    // input-validation failures emit only tool.progress (streaming) + tool.finished{err}
    h.handle({ type: 'tool.progress', call_id: 'm9', tool_name: 'message', payload: { text_delta: 'a very long clause…' } });
    h.handle({
      type: 'tool.finished',
      call_id: 'm9',
      result: { kind: 'err', code: 'validation_failed', message: 'input: [{ ...ZodError... }]', recoverable: true },
    });
    expect(h.calls).toContainEqual(['discard', 'm9']);
    expect(h.calls.some((c) => c[0] === 'chip')).toBe(false); // no failure chip at all
  });

  // v0.21.10 — the model occasionally stutters: two `message` calls with identical
  // text. Drop the verbatim repeat instead of rendering + speaking it twice.
  test('a verbatim-duplicate consecutive message is discarded, not shown/spoken twice', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle(okMessage('m1', delivery({ text: 'Still here.' })));
    h.handle({ type: 'tool.started', call_id: 'm2', tool_name: 'message', input: {} });
    h.handle(okMessage('m2', delivery({ text: 'Still here.' })));
    expect(h.calls).toContainEqual(['finalize', 'm1', 'Still here.']);
    expect(h.calls).toContainEqual(['discard', 'm2']); // the stutter is dropped
    expect(h.calls).not.toContainEqual(['finalize', 'm2', 'Still here.']);
    expect(h.spoken).toEqual(['Still here.']); // spoken exactly once
  });

  test('distinct consecutive messages both render (no false dedup)', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle(okMessage('m1', delivery({ text: 'First.' })));
    h.handle({ type: 'tool.started', call_id: 'm2', tool_name: 'message', input: {} });
    h.handle(okMessage('m2', delivery({ text: 'Second.' })));
    expect(h.calls).toContainEqual(['finalize', 'm1', 'First.']);
    expect(h.calls).toContainEqual(['finalize', 'm2', 'Second.']);
    expect(h.spoken).toEqual(['First.', 'Second.']);
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

  // v0.20.3 — barge-in: a new reactive turn stops the prior turn's draining speech.
  test('turn.started cuts off prior speech via audio.stop (barge-in)', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    expect(h.audioStops.length).toBe(1);
  });

  // v0.20.3 — text-mode reply bubble is finalized on turn.result, so consecutive
  // replies do NOT merge into one ever-growing bubble.
  test('each text-mode turn opens a FRESH reply bubble (prior one finalized)', () => {
    const h = harness();
    const result = (turn: string, text: string): ServerEvent => ({
      type: 'turn.result',
      turn_id: turn,
      text,
      finish_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'reply.token', turn_id: 't1', text: 'first' });
    h.handle(result('t1', 'first'));
    h.handle({ type: 'turn.started', turn_id: 't2' });
    h.handle({ type: 'reply.token', turn_id: 't2', text: 'second' });
    expect(h.calls.filter((c) => c[0] === 'open' && c[1] === 'reply').length).toBe(2);
    expect(h.calls.filter((c) => c[0] === 'finalize' && c[1] === 'reply').length).toBe(1);
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

  test('continuation vs ladder proactive get distinct glyphs (💭 vs 🌱) — v0.33.1', () => {
    const h = harness();
    h.handle({ type: 'proactive.started', cycle_id: 'default:1783' }); // ladder / scheduler
    h.handle({ type: 'proactive.started', cycle_id: 'default:cont:1783' }); // self-continuation
    const glyphs = h.calls
      .filter((c) => c[0] === 'chip' && c[1] === 'proactive')
      .map((c) => c[2] as string);
    expect(glyphs[0]).toContain('🌱'); // ladder opener → seedling
    expect(glyphs[0]).not.toContain('💭');
    expect(glyphs[1]).toContain('💭'); // continuation → second-thought
    expect(glyphs[1]).not.toContain('🌱');
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

describe('frontend controller — persistent typing indicator (v0.21.9)', () => {
  const result = (turn: string): ServerEvent => ({
    type: 'turn.result',
    turn_id: turn,
    text: 'done',
    finish_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  });

  test('dots show on turn.started, persist across a tool, hide while streaming, return between messages, vanish on result', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    expect(h.lastThinking()).toBe(true); // thinking before she says anything

    // a non-message tool runs → dots STAY (she's still working)
    h.handle({ type: 'tool.started', call_id: 'r1', tool_name: 'recall', input: {} });
    expect(h.lastThinking()).toBe(true);
    h.handle({ type: 'tool.finished', call_id: 'r1', result: { kind: 'ok', data: {}, summary: '2 hits' } });
    expect(h.lastThinking()).toBe(true);

    // a message bubble streams → dots DOWN (the streaming text is its own signal)
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    expect(h.lastThinking()).toBe(false);
    // message finalizes but the turn is NOT over → dots come BACK (she may say more)
    h.handle(okMessage('m1', delivery({ text: '第一句' })));
    expect(h.lastThinking()).toBe(true);

    // turn ends → dots gone for good
    h.handle(result('t1'));
    expect(h.lastThinking()).toBe(false);
  });

  test('text-mode streaming hides the dots; turn.result clears them', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'reply.token', turn_id: 't1', text: 'Hi' });
    expect(h.lastThinking()).toBe(false); // streaming text replaces the dots
    h.handle(result('t1'));
    expect(h.lastThinking()).toBe(false);
  });

  test('a proactive turn shows then clears the dots (no turn.result is emitted)', () => {
    const h = harness();
    h.handle({ type: 'proactive.started', cycle_id: 'c1' });
    expect(h.lastThinking()).toBe(true);
    h.handle({ type: 'proactive.finished', cycle_id: 'c1', spoke: true });
    expect(h.lastThinking()).toBe(false);
  });

  // Regression for the review's medium finding: reflectTyping() gates on
  // messageBubbles.size, so a leaked id (dropped tool.finished / reconnect) must not
  // wedge the dots OFF on later turns — state resets at every boundary.
  test('a dropped message tool.finished does not wedge the dots OFF on the next turn', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle(result('t1')); // turn ends; m1's tool.finished was lost
    h.handle({ type: 'turn.started', turn_id: 't2' });
    expect(h.lastThinking()).toBe(true); // not stuck off by the leaked m1 id
  });

  test('a reconnect (history) mid-message-turn resets stale state so dots still work', () => {
    const h = harness();
    h.handle({ type: 'turn.started', turn_id: 't1' });
    h.handle({ type: 'tool.started', call_id: 'm1', tool_name: 'message', input: {} });
    h.handle({ type: 'history', turns: [] }); // WS reconnect resends history
    expect(h.lastThinking()).toBe(false); // no turn in flight after a reconnect
    h.handle({ type: 'turn.started', turn_id: 't2' });
    expect(h.lastThinking()).toBe(true);
  });
});

describe('frontend controller — web citations (v0.18.2)', () => {
  test('turn.result citations render as source chips', () => {
    const h = harness();
    h.handle({
      type: 'turn.result',
      turn_id: 't1',
      text: 'answer',
      finish_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
      citations: [
        { url: 'https://a.example/x', title: 'Alpha' },
        { url: 'https://b.example/y', title: '' },
      ],
    });
    const sources = h.calls.filter((c) => c[0] === 'chip' && c[1] === 'source');
    expect(sources.length).toBe(2);
    expect(String(sources[0]![2])).toContain('Alpha'); // title is the visible label
    expect(sources[0]![3]).toBe('https://a.example/x'); // url rides as the clickable href
    expect(sources[1]![3]).toBe('https://b.example/y');
  });

  test('safeHttpHref allows http/https, rejects javascript:/data:/garbage (XSS guard)', () => {
    expect(safeHttpHref('https://example.com/p')).toBe('https://example.com/p');
    expect(safeHttpHref('http://x.test/')).toBe('http://x.test/');
    expect(safeHttpHref('javascript:alert(1)')).toBeNull();
    expect(safeHttpHref('data:text/html,<script>')).toBeNull();
    expect(safeHttpHref('not a url')).toBeNull();
  });

  test('turn.result without citations renders no source chip', () => {
    const h = harness();
    h.handle({
      type: 'turn.result',
      turn_id: 't2',
      text: 'hi',
      finish_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    expect(h.calls.filter((c) => c[1] === 'source').length).toBe(0);
  });
});

describe('frontend controller — settings.state (v0.27.1)', () => {
  test('settings.state routes to onSettings; absent callback is a no-op', () => {
    const seen: string[][] = [];
    const h = harness();
    const noopView: BubbleView = {
      open: () => {},
      append: () => {},
      finalize: () => {},
      discard: () => {},
      chip: () => {},
      setThinking: () => {},
    };
    const withCb = createController({
      view: noopView,
      live2d: { setExpression: () => {}, setState: () => {}, setMouth: () => {}, clear: () => {} },
      audio: { speak: async () => {}, stop: () => {} },
      onSettings: (s) => seen.push(s.map((x) => `${x.key}=${x.value}:${x.source}`)),
    });
    const state = {
      type: 'settings.state' as const,
      settings: [
        {
          key: 'proactive.enabled',
          label: 'Proactive messages',
          hint: '',
          category: 'Companion',
          kind: 'boolean' as const,
          value: '1',
          source: 'default' as const,
          restart_required: false,
        },
      ],
    };
    withCb.handle(state);
    expect(seen).toEqual([['proactive.enabled=1:default']]);
    h.handle(state); // no onSettings dep — must not throw
  });
});
