import type { ServerWebSocket } from 'bun';
import { ClientEvent, ToolName, assertNever } from '@luna/protocol';
import { setRuntimeLocation } from './turn/temporalContext';
import { startWeatherRefresh } from './tools/web/weather/snapshot';
import type { ServerEvent, ToolEvent } from '@luna/protocol';
import { outbound } from './outbound';
import { dispatchToolCalls } from './tools/dispatcher';
import { builtinRegistry, type ToolRegistry } from './tools/registry';
import type { Provider } from './provider/types';
import { getSession, type Session } from './turn/session';
import { listL2 } from './memory/sessionStore';
import { runTurn } from './turn/runTurn';
import { runProactiveTurn } from './proactive/proactiveTurn';
import { proactiveEnabled } from './proactive/cadence';
import { maybeScheduleContinuation } from './proactive/continuation';
import { dreamStatus, isDreaming, wake } from './dream/dreamState';
import { runDreamCycle } from './dream/cycle';
import type { DreamLLM } from './dream/llm';

export type WSData = { sessionId: string };

export type Runtime = { provider: Provider; registry: ToolRegistry; dreamLlm?: DreamLLM };

let runtime: Runtime | null = null;

export function setRuntime(r: Runtime | null): void {
  runtime = r;
}

function safeEmit(ws: ServerWebSocket<WSData>): (e: ServerEvent) => void {
  return (e) => {
    try {
      outbound(ws, e);
    } catch {
      /* socket may be gone; dream/turn continues for persistence */
    }
  };
}

function startDream(ws: ServerWebSocket<WSData>, session: Session): void {
  if (!runtime?.dreamLlm) {
    outbound(ws, {
      type: 'error',
      code: 'runtime_not_configured',
      message: 'no provider configured; dream unavailable',
    });
    return;
  }
  const cycle = runDreamCycle({
    sessionId: session.id,
    llm: runtime.dreamLlm,
    emit: safeEmit(ws),
  });
  // enterDream runs synchronously inside runDreamCycle before its first await,
  // so the gate state is already accurate here.
  if (isDreaming()) {
    const status = dreamStatus();
    outbound(ws, {
      type: 'dream.status',
      is_dreaming: status.is_dreaming,
      current_step: status.current_step,
      last_dream_ms: status.last_dream_ms,
    });
  }
  void cycle.then((r) => {
    if (!r.ok) {
      safeEmit(ws)({ type: 'error', code: 'dream_failed', message: r.error });
    }
  });
}

// Connected sockets, so the server-side proactive scheduler (v0.10.3) can push
// bubbles over the existing WS without a per-connection handle. A proactive
// turn with no listener still runs (memory persists); its output lands in L2.
const activeSockets = new Set<ServerWebSocket<WSData>>();

export function broadcast(e: ServerEvent): void {
  for (const ws of activeSockets) {
    try {
      outbound(ws, e);
    } catch {
      /* socket may be gone; other listeners + persistence continue */
    }
  }
}

export function handleOpen(ws: ServerWebSocket<WSData>): void {
  activeSockets.add(ws);
  // Replay the persisted conversation so a browser refresh rehydrates the chat
  // log. The L2 timeline is the clean per-turn user/assistant text with real
  // turn times; cap the most-recent slice so the frame stays bounded.
  const turns = listL2(ws.data.sessionId, { limit: 2000 })
    .map((r) => ({ user_text: r.user_text, assistant_text: r.assistant_text, t_ms: r.t_ms }))
    .filter((t) => t.user_text !== '' || t.assistant_text !== '')
    .slice(-300);
  if (turns.length > 0) outbound(ws, { type: 'history', turns });
  console.log(`[ws] open ${ws.remoteAddress} session=${ws.data.sessionId} history=${turns.length}`);
}

export function handleClose(
  ws: ServerWebSocket<WSData>,
  code: number,
  reason: string,
): void {
  activeSockets.delete(ws);
  // Abort an in-flight reactive turn only when the LAST listener is gone (a browser
  // refresh opens its new socket before closing the old, so this won't fire then),
  // so a disconnected client's turn stops instead of streaming to completion.
  if (activeSockets.size === 0) {
    getSession(ws.data.sessionId).activeTurnAbort?.abort('client disconnected');
  }
  console.log(`[ws] close ${ws.remoteAddress} code=${code} reason=${reason}`);
}

export function handleMessage(
  ws: ServerWebSocket<WSData>,
  raw: string | Buffer,
): void {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    outbound(ws, {
      type: 'error',
      code: 'invalid_event',
      message: 'invalid JSON',
    });
    return;
  }

  const parsed = ClientEvent.safeParse(json);
  if (!parsed.success) {
    outbound(ws, {
      type: 'error',
      code: 'invalid_event',
      message: parsed.error.message,
    });
    return;
  }

  const event = parsed.data;
  switch (event.type) {
    case 'ping':
      outbound(ws, {
        type: 'pong',
        seq: event.seq,
        server_time_ms: Date.now(),
      });
      return;
    case 'client.geo':
      // GPS from the browser (Initiative 14, v0.21.3) — the user's actual location,
      // used for weather ahead of the LUNA_LAT_LON env fallback.
      setRuntimeLocation(event.lat, event.lon);
      // v0.21.4: the location usually arrives AFTER boot (the GPS grant), when
      // startWeatherRefresh already no-op'd for lack of a location — (re)start the
      // background refresher now (idempotent) so the ambient snapshot actually warms.
      startWeatherRefresh();
      return;
    case 'dev.dispatch_tool':
      if (Bun.env['LUNA_DEV_TOOLS'] !== '1') {
        outbound(ws, {
          type: 'error',
          code: 'invalid_event',
          message: 'dev.dispatch_tool is gated by LUNA_DEV_TOOLS=1',
        });
        return;
      }
      void runDevDispatch(ws, event.call_id, event.tool_name, event.input);
      return;
    case 'chat.send': {
      if (isDreaming()) {
        outbound(ws, {
          type: 'error',
          code: 'dreaming',
          message: 'Luna is dreaming — send dream.wake to wake her',
        });
        return;
      }
      if (!runtime) {
        outbound(ws, {
          type: 'error',
          code: 'runtime_not_configured',
          message: 'no provider configured; chat.send unavailable',
        });
        return;
      }
      const session = getSession(ws.data.sessionId);
      if (session.activeTurn !== null) {
        outbound(ws, {
          type: 'error',
          code: 'turn_in_progress',
          message: `turn ${session.activeTurn} is still running`,
        });
        return;
      }
      session.lastUserMs = Date.now(); // resets the proactive idle gap
      const { provider, registry } = runtime; // narrowed by the guard above
      const turnId = event.turn_id ?? `${session.id}:turn:${session.turnSeq}`;
      const emit = safeEmit(ws);
      // Per-reactive-turn abort: handleClose aborts this if the client disconnects,
      // so an orphaned turn stops instead of running to completion against upstream.
      const ac = new AbortController();
      session.activeTurnAbort = ac;
      void runTurn({
        session,
        turnId,
        userText: event.text,
        provider,
        registry,
        emit,
        signal: ac.signal,
      })
        .then(() => {
          // enter_dream is a pending intent: the cycle starts only after the
          // triggering turn fully finalized — never overlapping any part of it.
          if (session.pendingDream !== null) {
            session.pendingDream = null;
            startDream(ws, session);
            return;
          }
          // Self-continuation (v0.11.0): maybe add one more thought after a pause —
          // skipped if no client is connected when it fires (don't burn a turn no
          // one sees).
          maybeScheduleContinuation({
            session,
            provider,
            registry,
            emit: broadcast,
            hasListener: () => activeSockets.size > 0,
          });
        })
        .catch((e) => {
          // a turn-finalize or continuation-scheduling failure must never crash
          // the connection / surface as an unhandled rejection
          console.error('[ws] chat.send post-turn failed:', e);
        })
        .finally(() => {
          if (session.activeTurnAbort === ac) session.activeTurnAbort = null;
        });
      return;
    }
    case 'dream.enter': {
      const session = getSession(ws.data.sessionId);
      if (session.activeTurn !== null) {
        outbound(ws, {
          type: 'error',
          code: 'turn_in_progress',
          message: 'cannot enter dream while a turn is running',
        });
        return;
      }
      startDream(ws, session);
      return;
    }
    case 'dream.wake': {
      const result = wake();
      if (!result.ok) {
        outbound(ws, { type: 'error', code: result.error, message: `wake rejected: ${result.error}` });
        return;
      }
      const status = dreamStatus();
      outbound(ws, {
        type: 'dream.status',
        is_dreaming: status.is_dreaming,
        current_step: status.current_step,
        last_dream_ms: status.last_dream_ms,
      });
      return;
    }
    case 'proactive.fire': {
      // Manual trigger (v0.10.0). Gated by the kill switch (default ON since
      // v0.11.0; LUNA_PROACTIVE=0 disables).
      if (!proactiveEnabled()) {
        outbound(ws, {
          type: 'error',
          code: 'proactive_disabled',
          message: 'proactive turns are disabled (LUNA_PROACTIVE=0)',
        });
        return;
      }
      if (isDreaming()) {
        outbound(ws, { type: 'error', code: 'dreaming', message: 'Luna is dreaming' });
        return;
      }
      if (!runtime) {
        outbound(ws, {
          type: 'error',
          code: 'runtime_not_configured',
          message: 'no provider configured; proactive unavailable',
        });
        return;
      }
      const session = getSession(ws.data.sessionId);
      // A proactive turn never overlaps a user turn (same activeTurn guard that
      // serializes chat.send / dream.enter).
      if (session.activeTurn !== null) {
        outbound(ws, {
          type: 'error',
          code: 'turn_in_progress',
          message: `turn ${session.activeTurn} is still running`,
        });
        return;
      }
      void runProactiveTurn({
        session,
        cycleId: `${session.id}:${Date.now()}`,
        provider: runtime.provider,
        registry: runtime.registry,
        emit: safeEmit(ws),
      }).catch((e) => {
        console.error('[ws] proactive.fire failed:', e);
      });
      return;
    }
    default:
      assertNever(event);
  }
}

async function runDevDispatch(
  ws: ServerWebSocket<WSData>,
  call_id: string,
  tool_name: ToolName,
  input: unknown,
): Promise<void> {
  const session = getSession(ws.data.sessionId);
  try {
    for await (const evt of dispatchToolCalls(
      [{ call_id, tool_name, input }],
      { sessionId: session.id, sessionMutex: session.mutex },
      builtinRegistry,
    )) {
      forwardToolEvent(ws, evt);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    outbound(ws, {
      type: 'error',
      code: 'dispatch_failure',
      message,
    });
  }
}

function forwardToolEvent(ws: ServerWebSocket<WSData>, evt: ToolEvent): void {
  switch (evt.kind) {
    case 'started':
      outbound(ws, {
        type: 'tool.started',
        call_id: evt.call_id,
        tool_name: ToolName.parse(evt.tool_name),
        input: evt.input,
      });
      return;
    case 'progress':
      outbound(ws, {
        type: 'tool.progress',
        call_id: evt.call_id,
        tool_name: ToolName.parse(evt.tool_name),
        payload: evt.payload,
      });
      return;
    case 'final':
      outbound(ws, {
        type: 'tool.finished',
        call_id: evt.call_id,
        result: evt.result,
      });
      return;
    default:
      assertNever(evt);
  }
}
