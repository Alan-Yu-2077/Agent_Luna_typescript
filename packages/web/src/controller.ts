import { MessageDelivery, assertNever, type ServerEvent } from '@luna/protocol';
import type { BubbleView } from './bubbles';
import type { AudioSink, Live2DSink } from './sinks';

// The frontend consumption controller (Initiative 6, first pass) — the TS port
// of the Python agent-app.js event consumer, modeled on its handler switch but
// consuming the new WS ServerEvent union instead of SSE+poll. Pure logic: no
// DOM, no WebSocket — it drives a BubbleView + Live2D/Audio sinks, all
// interfaces, so it is fully testable and the rendering/audio pipelines plug in
// later. Speech is the `message` tool (LD #9): a bubble per message call_id,
// streamed via tool.progress, finalized from the MessageDelivery envelope.

export type ControllerDeps = {
  view: BubbleView;
  live2d: Live2DSink;
  audio: AudioSink;
};

// synthetic bubble id for text-mode (LUNA_MESSAGE_TOOL=0) reply.token streaming
const TEXT_BUBBLE = 'reply';

export function createController(deps: ControllerDeps): { handle: (e: ServerEvent) => void } {
  // call_ids that opened as message-tool bubbles (vs other tools → chips)
  const messageBubbles = new Set<string>();
  let textStreaming = false;

  function handle(e: ServerEvent): void {
    switch (e.type) {
      case 'pong':
        return;

      case 'history':
        deps.view.renderHistory?.(
          e.turns.map((t) => ({ userText: t.user_text, assistantText: t.assistant_text, tMs: t.t_ms })),
        );
        return;

      case 'turn.started':
        textStreaming = false;
        deps.live2d.setState('thinking');
        return;

      case 'reply.token':
        if (!textStreaming) {
          deps.view.open(TEXT_BUBBLE);
          textStreaming = true;
        }
        deps.view.append(TEXT_BUBBLE, e.text);
        return;

      case 'tool.started':
        if (e.tool_name === 'message') {
          messageBubbles.add(e.call_id);
          deps.view.open(e.call_id);
          deps.live2d.setState('speaking');
        } else {
          deps.view.chip('tool', `🔧 ${e.tool_name}…`);
        }
        return;

      case 'tool.progress':
        if (e.tool_name === 'message' && e.payload && typeof e.payload === 'object') {
          // Track the call here too: input-validation failures yield NO tool.started
          // (the dispatcher rejects before it), so without this a rejected message
          // would fall through to the generic-tool error branch and leak the raw
          // ZodError as a chip. Streaming a message means it's a message call.
          messageBubbles.add(e.call_id);
          const delta = (e.payload as { text_delta?: unknown }).text_delta;
          if (typeof delta === 'string') deps.view.append(e.call_id, delta);
        }
        return;

      case 'tool.finished': {
        if (messageBubbles.has(e.call_id)) {
          messageBubbles.delete(e.call_id);
          if (e.result.kind === 'ok') {
            const parsed = MessageDelivery.safeParse(e.result.data);
            if (parsed.success) {
              const d = parsed.data;
              deps.view.finalize(e.call_id, d.text);
              if (d.expression) deps.live2d.setExpression(d.expression, d.emotion);
              void deps.audio.speak(d.text, d.voice_params);
            } else {
              deps.view.finalize(e.call_id, ''); // delivery shape unexpected — degrade, don't crash
            }
          } else {
            // A message that failed validation (e.g. a too-long clause) is internal
            // retry machinery — the model re-says it shorter. Discard the half-
            // streamed preview SILENTLY; never leak the raw error to the user (the
            // L1 "keep the machinery backstage" rule).
            deps.view.discard(e.call_id);
          }
          return;
        }
        // a non-message tool
        if (e.result.kind === 'ok') deps.view.chip('tool', `🔧 ${e.result.summary || 'done'}`);
        else deps.view.chip('error', `Failed: ${e.result.message}`);
        return;
      }

      case 'turn.result':
        // Message bubbles + reply.token already rendered the visible reply; the
        // turn.result text is the canonical join. Surface any web sources she used
        // this turn as source cards (Initiative 11, v0.18.2) so she cites visibly.
        if (e.citations && e.citations.length > 0) {
          for (const c of e.citations) {
            // The url rides as a (scheme-validated) href so the chip is clickable,
            // not baked into the label text (v0.18.3).
            deps.view.chip('source', `🔗 ${c.title || c.url}`, c.url);
          }
        }
        textStreaming = false;
        deps.live2d.setState('neutral');
        return;

      case 'dream.status':
        deps.view.chip(
          'dream',
          e.is_dreaming
            ? `🌙 dreaming${e.current_step ? ` · ${e.current_step}` : ''}`
            : '☀️ awake',
        );
        deps.live2d.setState(e.is_dreaming ? 'sleeping' : 'neutral');
        return;

      case 'dream.step':
        deps.view.chip('dream', `🌙 ${e.step} → ${e.status}${e.detail ? ` · ${e.detail}` : ''}`);
        return;

      case 'proactive.started':
        deps.view.chip('proactive', '🌱 …');
        return;

      case 'proactive.finished':
        if (!e.spoke) deps.view.chip('proactive', '🌱 (quietly did something)');
        return;

      case 'error':
        deps.view.chip('error', `⚠ ${e.code}: ${e.message}`);
        return;

      default:
        assertNever(e);
    }
  }

  return { handle };
}
