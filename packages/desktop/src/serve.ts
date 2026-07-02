import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

// v0.26.0 (Initiative 19): the pinned loopback static host for the packages/web production build.
// A REAL http origin (not file:// / a custom protocol) so the app's absolute-root asset fetches
// (/models, /live2dcubismcore.min.js) and localStorage (all luna:* settings) keep working unchanged.
// Standalone module so v0.26.1 can compile it into a sidecar unchanged. The /api/gpt-sovits proxy
// stub mirrors dev-server.ts's no-upstream behavior (502 → the boot gate degrades to muted).

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.moc3': 'application/octet-stream',
};

export const WEB_PORT = 5177; // pinned — a floating port would silently reset every luna:* setting

export function startWebHost(distDir: string, port = WEB_PORT): Server {
  const root = resolve(distDir);
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (pathname.startsWith('/api/gpt-sovits/')) {
      res.writeHead(502).end('tts upstream not configured');
      return;
    }
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

// packages/desktop/dist/main.cjs → ../../web/dist
export function defaultDistDir(fromDir: string): string {
  return join(fromDir, '..', '..', 'web', 'dist');
}
