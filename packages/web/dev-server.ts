import { join } from 'node:path';
import index from './index.html';

// Dev server for the web app: Bun bundles the HTML entry (+ its TS/pixi), and
// this fetch fallback serves the vendored Cubism core + yumi model assets
// statically from public/ (pixi-live2d-display fetches them at runtime by URL).
// `bun <html>` alone cannot serve those runtime-fetched files.
const PUBLIC = join(import.meta.dir, 'public');
const port = Number(Bun.env['PORT'] ?? 5173);
// Origin serving the (reused, as-is) GPT-SoVITS proxy. Unset → TTS degrades to silence.
const TTS_UPSTREAM = Bun.env['LUNA_TTS_PROXY'];

Bun.serve({
  port,
  routes: { '/': index },
  async fetch(req) {
    const { pathname, search } = new URL(req.url);
    // Forward the GPT-SoVITS proxy (Python side, reused as-is) when configured.
    if (pathname.startsWith('/api/gpt-sovits/')) {
      if (!TTS_UPSTREAM) return new Response('tts upstream not configured', { status: 502 });
      try {
        const init: RequestInit = { method: req.method };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          init.body = await req.text();
          init.headers = { 'content-type': req.headers.get('content-type') ?? 'application/json' };
        }
        return await fetch(`${TTS_UPSTREAM}${pathname}${search}`, init);
      } catch {
        return new Response('tts upstream unreachable', { status: 502 });
      }
    }
    const file = Bun.file(join(PUBLIC, pathname));
    if (await file.exists()) return new Response(file);
    return new Response('not found', { status: 404 });
  },
});

console.log(`[luna-web] dev server on http://localhost:${port}`);
