import { lazyHtml } from '../devHtml';

const chatHtml = lazyHtml(import.meta.dir, 'devchat.html');

// Dev-only chat page over the existing WS protocol. Returns null for non-/_chat
// paths so the caller falls through to the WS upgrade (same shape as the trace
// viewer). The real frontend (Live2D agent-app port) is Initiative 6.
export function devChatHandler(req: Request): Response | null {
  const url = new URL(req.url);
  if (url.pathname === '/_chat') {
    return new Response(chatHtml(), { headers: { 'content-type': 'text/html' } });
  }
  return null;
}
