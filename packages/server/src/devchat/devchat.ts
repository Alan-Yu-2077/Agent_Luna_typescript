import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CHAT_HTML = readFileSync(join(import.meta.dir, 'devchat.html'), 'utf8');

// Dev-only chat page over the existing WS protocol. Returns null for non-/_chat
// paths so the caller falls through to the WS upgrade (same shape as the trace
// viewer). The real frontend (Live2D agent-app port) is Initiative 6.
export function devChatHandler(req: Request): Response | null {
  const url = new URL(req.url);
  if (url.pathname === '/_chat') {
    return new Response(CHAT_HTML, { headers: { 'content-type': 'text/html' } });
  }
  return null;
}
