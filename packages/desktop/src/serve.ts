import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

// v0.26.0 (Initiative 19): the pinned loopback static host for the packages/web production build.
// A REAL http origin (not file:// / a custom protocol) so the app's absolute-root asset fetches
// (/models, /live2dcubismcore.min.js) and localStorage (all luna:* settings) keep working unchanged.
// Standalone module so v0.26.1 can compile it into a sidecar unchanged. v0.28.7: /api/gpt-sovits/*
// forwards to a configured TTS upstream (the shell spawns the local GPT-SoVITS proxy) — mirroring
// dev-server.ts; with no upstream it keeps the 502 (→ the boot gate degrades to muted).

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

export function startWebHost(distDir: string, port = WEB_PORT, ttsUpstream?: string): Server {
  const root = resolve(distDir);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/gpt-sovits/')) {
      if (!ttsUpstream) {
        res.writeHead(502).end('tts upstream not configured');
        return;
      }
      // Build the target from the DECODED pathname so URL normalization collapses `..` segments,
      // then re-check the result still sits under /api/gpt-sovits/. A raw startsWith on the decoded
      // path is bypassable: `/api/gpt-sovits/..%2fadmin` passes it, yet fetch would resolve the `..`
      // and escape the subtree. Query is forwarded verbatim.
      const target = new URL(pathname, ttsUpstream);
      target.search = url.search;
      if (!target.pathname.startsWith('/api/gpt-sovits/')) {
        res.writeHead(400).end('bad tts path');
        return;
      }
      void forwardTts(req, res, target.toString());
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
  // GPT-SoVITS loads a ~5GB model on the first /speak; the synth response can take minutes on a cold
  // start. Node's default requestTimeout (5min) is borderline — bump it so the warm-up isn't killed
  // mid-flight (dev-server.ts raises Bun's idleTimeout for the same reason).
  server.requestTimeout = 600_000;
  server.listen(port, '127.0.0.1');
  return server;
}

// Forward a /api/gpt-sovits/* request to the local proxy. Buffers the body both ways — audio is a
// few hundred KB and this is a single local user, so streaming plumbing buys nothing. A dead/absent
// or stalled proxy → 502, which the boot gate + webAudioSink already treat as "no voice, stay muted".
async function forwardTts(req: IncomingMessage, res: ServerResponse, target: string): Promise<void> {
  try {
    const init: RequestInit = { method: req.method };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await readBody(req);
      init.headers = { 'content-type': req.headers['content-type'] ?? 'application/json' };
    }
    // Bound the upstream wait — server.requestTimeout does NOT abort an in-flight fetch, so a proxy
    // that accepts then never responds would hang the handler forever. 600s covers the cold model
    // load; a timeout aborts → the catch below answers 502.
    init.signal = AbortSignal.timeout(600_000);
    const upstream = await fetch(target, init);
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(502).end('tts upstream unreachable');
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// packages/desktop/dist/main.cjs → ../../web/dist
export function defaultDistDir(fromDir: string): string {
  return join(fromDir, '..', '..', 'web', 'dist');
}
