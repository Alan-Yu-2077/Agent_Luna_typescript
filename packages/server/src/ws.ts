import type { ServerWebSocket } from 'bun';
import { ClientEvent, ToolName, assertNever } from '@luna/protocol';
import type { ServerEvent, ToolEvent } from '@luna/protocol';
import { outbound } from './outbound';
import { dispatchToolCalls, getSessionMutex } from './tools/dispatcher';
import { builtinRegistry, type ToolRegistry } from './tools/registry';
import type { Provider } from './provider/types';
import { getSession } from './turn/session';
import { runTurn } from './turn/runTurn';

export type WSData = { sessionId: string };

export type Runtime = { provider: Provider; registry: ToolRegistry };

let runtime: Runtime | null = null;

export function setRuntime(r: Runtime | null): void {
  runtime = r;
}

export function handleOpen(ws: ServerWebSocket<WSData>): void {
  console.log(`[ws] open ${ws.remoteAddress} session=${ws.data.sessionId}`);
}

export function handleClose(
  ws: ServerWebSocket<WSData>,
  code: number,
  reason: string,
): void {
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
      const turnId = event.turn_id ?? `${session.id}:turn:${session.turnSeq}`;
      void runTurn({
        session,
        turnId,
        userText: event.text,
        provider: runtime.provider,
        registry: runtime.registry,
        emit: (e: ServerEvent) => {
          try {
            outbound(ws, e);
          } catch {
            /* socket may be gone mid-turn; turn still completes for history */
          }
        },
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
  const sessionMutex = getSessionMutex(ws.data.sessionId);
  try {
    for await (const evt of dispatchToolCalls(
      [{ call_id, tool_name, input }],
      { sessionId: ws.data.sessionId, sessionMutex },
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
