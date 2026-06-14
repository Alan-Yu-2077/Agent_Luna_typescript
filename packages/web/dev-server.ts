import { join } from 'node:path';
import index from './index.html';

// Dev server for the web app: Bun bundles the HTML entry (+ its TS/pixi), and
// this fetch fallback serves the vendored Cubism core + yumi model assets
// statically from public/ (pixi-live2d-display fetches them at runtime by URL).
// `bun <html>` alone cannot serve those runtime-fetched files.
const PUBLIC = join(import.meta.dir, 'public');
const port = Number(Bun.env['PORT'] ?? 5173);

Bun.serve({
  port,
  routes: { '/': index },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = Bun.file(join(PUBLIC, pathname));
    if (await file.exists()) return new Response(file);
    return new Response('not found', { status: 404 });
  },
});

console.log(`[luna-web] dev server on http://localhost:${port}`);
