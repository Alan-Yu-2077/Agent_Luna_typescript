import type { TraceStore } from './store';
import { lazyHtml } from '../devHtml';

const indexHtml = lazyHtml(import.meta.dir, 'viewer', 'index.html');

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  });
}

// Returns a Response for any /_trace* path, or null to let the caller fall
// through to the WS upgrade. Read-only; shares the boot Database via store.
export function traceViewerHandler(req: Request, store: TraceStore): Response | null {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/_trace') {
    return new Response(indexHtml(), { headers: { 'content-type': 'text/html' } });
  }
  if (path === '/_trace/api/turns') {
    const limit = Number(url.searchParams.get('limit') ?? 50);
    return json({ turns: store.listTurns(Number.isFinite(limit) ? limit : 50) });
  }
  if (path === '/_trace/api/events') {
    const turnId = url.searchParams.get('turn_id');
    if (!turnId) return json({ events: [] });
    const rows = store.getEventsByTurn(turnId);
    const events = rows.map((r) => ({ kind: r.kind, t_ms: r.t_ms, payload: JSON.parse(r.payload_json) }));
    return json({ events });
  }
  if (path.startsWith('/_trace')) {
    return new Response('not found', { status: 404 });
  }
  return null;
}
