import type { ServerWebSocket } from 'bun';
import { ClientEvent, assertNever } from '@luna/protocol';
import { outbound } from './outbound';

export function handleOpen(ws: ServerWebSocket<unknown>): void {
  console.log(`[ws] open ${ws.remoteAddress}`);
}

export function handleClose(
  ws: ServerWebSocket<unknown>,
  code: number,
  reason: string,
): void {
  console.log(`[ws] close ${ws.remoteAddress} code=${code} reason=${reason}`);
}

export function handleMessage(
  ws: ServerWebSocket<unknown>,
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
    default:
      assertNever(event.type);
  }
}
