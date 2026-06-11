import type { ServerWebSocket } from 'bun';
import { ServerEvent } from '@luna/protocol';

export function outbound(ws: ServerWebSocket<unknown>, event: ServerEvent): void {
  const validated = ServerEvent.parse(event);
  ws.send(JSON.stringify(validated));
}
