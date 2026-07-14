import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { planTtsForward, readTtsEnv, type TtsEnv } from '../../web/src/tts/apiV2';
import type { VoiceProcState } from './ttsRuntime';

// v0.26.0 (Initiative 19): the pinned loopback static host for the packages/web production build.
// A REAL http origin (not file:// / a custom protocol) so the app's absolute-root asset fetches
// (/models, /live2dcubismcore.min.js) and localStorage (all luna:* settings) keep working unchanged.
// Standalone module so it can compile into a sidecar unchanged. /api/tts/* translates directly to a
// bring-your-own GPT-SoVITS api_v2 backend (LUNA_TTS_URL) — no owner glue; mirrors dev-server.ts. With
// no upstream configured it keeps the 502 (→ the boot gate degrades to muted / the browser voice).

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
  '.woff2': 'font/woff2', // v0.36.0: Bun emits a hashed ZCOOLKuaiLe woff2 into dist root
};

export const WEB_PORT = 5177; // pinned — a floating port would silently reset every luna:* setting

export function startWebHost(
  distDir: string,
  port = WEB_PORT,
  // v0.35.3: accepts a GETTER so the tts upstream is re-read per request — installing a voice pack
  // (or hand-editing luna.env) applies on the next /api/tts call with no host restart. A plain
  // TtsEnv still works (tests, dev callers); the v0.34.15 stale-process.env class dies here.
  ttsEnv: TtsEnv | (() => TtsEnv) = readTtsEnv(process.env),
  userModelsDir?: string,
  // v0.37.0: the managed-voice supervisor's state — lets /api/tts/health answer "starting" (wait,
  // Luna owns the child and it's coming) instead of a bare 502 while api_v2 loads. null = not managed.
  voiceState: () => VoiceProcState | null = () => null,
): Server {
  const root = resolve(distDir);
  const currentTtsEnv = typeof ttsEnv === 'function' ? ttsEnv : (): TtsEnv => ttsEnv;
  // A bring-your-own model installed by the desktop picker lands here (userData/models); it's served at
  // /models/* AHEAD of the bundled webDist so an installed avatar wins over the (empty) bundled one.
  const modelsRoot = userModelsDir ? resolve(userModelsDir) : null;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/tts/')) {
      // The forward CONSTRUCTS the api_v2 target from a fixed path (never from the request path), so a
      // traversal like `/api/tts/..%2fadmin` decodes to an unknown subpath → 404, never reaching the
      // upstream. No path-based SSRF surface remains.
      void forwardTts(req, res, pathname.slice('/api/tts/'.length), currentTtsEnv(), voiceState);
      return;
    }
    if (modelsRoot && pathname.startsWith('/models/') && serveModel(modelsRoot, pathname, res)) return;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  // A voice backend can load a large model on the first /speak; the synth response can take minutes on
  // a cold start. Node's default requestTimeout (5min) is borderline — bump it so the warm-up isn't
  // killed mid-flight (dev-server.ts raises Bun's idleTimeout for the same reason).
  server.requestTimeout = 600_000;
  server.listen(port, '127.0.0.1');
  return server;
}

// Translate a /api/tts/{speak,health} request into a direct GPT-SoVITS api_v2 call. Buffers the body
// both ways — audio is a few hundred KB and this is a single local user, so streaming buys nothing. A
// dead/absent or stalled upstream → 502, which the boot gate + webAudioSink already treat as "no
// voice, stay muted".
async function forwardTts(
  req: IncomingMessage,
  res: ServerResponse,
  subpath: string,
  ttsEnv: TtsEnv,
  voiceState: () => VoiceProcState | null = () => null,
): Promise<void> {
  const body = req.method === 'GET' || req.method === 'HEAD' ? '' : (await readBody(req)).toString('utf8');
  const plan = planTtsForward(subpath, body, ttsEnv);
  if (plan.kind === 'error') {
    res.writeHead(plan.status).end(plan.message);
    return;
  }
  try {
    if (plan.kind === 'health') {
      // Any upstream response = alive-and-loaded (api_v2 loads its models BEFORE binding the port —
      // verified on the reference instance). Unreachable + a MANAGED child in flight = "starting":
      // the boot gate should wait, not enter muted (v0.37.0/v0.37.1 — the 'unavailable' semantic
      // switch). Unreachable + not managed stays a bare 502 (BYO: a server may never come).
      try {
        await fetch(plan.url, { signal: AbortSignal.timeout(5000) });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ backend: { ready: true, state: 'ready' } }));
      } catch {
        const vs = voiceState();
        if (vs === 'starting' || vs === 'restarting' || vs === 'gave-up') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ backend: { ready: false, state: vs } }));
        } else {
          res.writeHead(502).end('tts upstream unreachable');
        }
      }
      return;
    }
    // Bound the upstream wait — server.requestTimeout does NOT abort an in-flight fetch. 600s covers a
    // cold api_v2 model load; a timeout aborts → the catch below answers 502.
    const upstream = await fetch(plan.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: plan.body,
      signal: AbortSignal.timeout(600_000),
    });
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'audio/wav',
    });
    res.end(audio);
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

// Serve a /models/* file from the user's installed-models dir (traversal-guarded). Returns false when
// the file isn't there, so the caller falls through to the bundled webDist (and then 404).
function serveModel(modelsRoot: string, pathname: string, res: ServerResponse): boolean {
  const file = resolve(modelsRoot, '.' + pathname.slice('/models'.length));
  if (!file.startsWith(modelsRoot) || !existsSync(file) || !statSync(file).isFile()) return false;
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
  return true;
}

// packages/desktop/dist/main.cjs → ../../web/dist
export function defaultDistDir(fromDir: string): string {
  return join(fromDir, '..', '..', 'web', 'dist');
}
