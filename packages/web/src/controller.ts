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
  // Whether a reactive OR proactive turn is in flight. Drives the persistent typing
  // indicator (v0.21.9): the dots stay up for the WHOLE turn — through tool runs and
  // between consecutive messages — and vanish only when the turn ends, so the user
  // can tell she hasn't finished and doesn't cut her off mid-turn. Hidden while a
  // visible bubble is actively streaming (the streaming text is its own signal).
  let turnActive = false;
  function reflectTyping(): void {
    deps.view.setThinking(turnActive && !textStreaming && messageBubbles.size === 0);
  }
  // Clear all turn-local tracking. Called at every turn boundary + on reconnect so a
  // dropped/mismatched event can't strand state (a leaked messageBubbles id would
  // keep size>0 and wedge the dots off; a stuck textStreaming would hide them).
  function resetTurnState(): void {
    messageBubbles.clear();
    textStreaming = false;
    turnActive = false;
  }

  function handle(e: ServerEvent): void {
    switch (e.type) {
      case 'pong':
        return;

      case 'history':
        deps.view.renderHistory?.(
          e.turns.map((t) => ({ userText: t.user_text, assistantText: t.assistant_text, tMs: t.t_ms })),
        );
        // A reconnect resends the full history; renderHistory wipes the view but not
        // this closure's turn-local state — reset it so a turn interrupted by the drop
        // can't leave the typing dots wedged off afterward (v0.21.9 review).
        resetTurnState();
        reflectTyping();
        return;

      case 'turn.started':
        // Barge-in: a new reactive turn (user just sent) cuts off any still-draining
        // speech from the previous turn so replies don't stack up behind a backlog.
        // (proactive turns emit proactive.started, not turn.started — they don't
        // interrupt themselves.)
        deps.audio.stop();
        // Reset at the boundary so a leaked id from a PRIOR turn (a dropped
        // tool.finished) can't keep messageBubbles non-empty and wedge the dots off.
        resetTurnState();
        turnActive = true;
        deps.live2d.setState('thinking');
        reflectTyping();
        return;

      case 'reply.token':
        if (!textStreaming) {
          deps.view.open(TEXT_BUBBLE);
          textStreaming = true;
        }
        deps.view.append(TEXT_BUBBLE, e.text);
        reflectTyping();
        return;

      case 'tool.started':
        if (e.tool_name === 'message') {
          messageBubbles.add(e.call_id);
          deps.view.open(e.call_id);
          deps.live2d.setState('speaking');
        } else {
          deps.view.chip('tool', `🔧 ${e.tool_name}…`);
        }
        reflectTyping();
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
          // The message bubble closed; if the turn is still going (more tools/messages
          // to come), bring the typing dots back so she still reads as "not finished".
          reflectTyping();
          return;
        }
        // a non-message tool
        if (e.result.kind === 'ok') deps.view.chip('tool', `🔧 ${e.result.summary || 'done'}`);
        else deps.view.chip('error', `Failed: ${e.result.message}`);
        reflectTyping();
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
        // Text-mode (LUNA_MESSAGE_TOOL=0): finalize + stamp the synthetic reply
        // bubble so the NEXT turn opens a fresh one. Without this, open() no-ops on
        // the existing id and consecutive replies merge into one growing bubble.
        if (textStreaming) deps.view.finalize(TEXT_BUBBLE, e.text);
        resetTurnState();
        deps.live2d.setState('neutral');
        reflectTyping(); // turn over → dots down
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
        turnActive = true;
        reflectTyping();
        return;

      case 'proactive.finished':
        // A proactive turn never emits turn.result, so it must clear state here or
        // the dots would hang forever after she speaks unprompted (latent pre-v0.21.9
        // bug, when app.ts only hid on turn.result).
        resetTurnState();
        reflectTyping();
        if (!e.spoke) deps.view.chip('proactive', '🌱 (quietly did something)');
        return;

      case 'error':
        // Discard any half-streamed message bubble whose tool.finished won't arrive,
        // then reset so neither an orphan bubble nor a leaked id lingers (review).
        for (const id of messageBubbles) deps.view.discard(id);
        resetTurnState();
        deps.view.chip('error', `⚠ ${e.code}: ${e.message}`);
        reflectTyping();
        return;

      default:
        assertNever(e);
    }
  }

  return { handle };
}
