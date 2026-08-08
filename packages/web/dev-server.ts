import { join } from 'node:path';
import index from './index.html';
import { planTtsForward, readTtsEnv } from './src/tts/apiV2';

// Dev server for the web app: Bun bundles the HTML entry (+ its TS/pixi), and
// this fetch fallback serves the vendored Cubism core + any installed model assets
// statically from public/ (pixi-live2d-display fetches them at runtime by URL).
// `bun <html>` alone cannot serve those runtime-fetched files.
const PUBLIC = join(import.meta.dir, 'public');
const port = Number(Bun.env['PORT'] ?? 5173);
// Voice is bring-your-own: /api/tts/* translates to a GPT-SoVITS api_v2 backend at LUNA_TTS_URL.
// Unset → the forward answers 502 and the app degrades to silence.
const TTS_ENV = readTtsEnv(Bun.env as unknown as Record<string, string | undefined>);

// v0.45.12 (C7): the /api faces this dev server forwards to the sidecar. MUST stay in lockstep
// with serve.ts (the packaged host) — the parity test in packages/desktop compares the two
// lists, so forgetting one side goes red in CI instead of red on the owner's machine (the
// v0.45.6 "flag that never arrived" class of bug).
export const FORWARDED_API_PREFIXES = ['/api/tts/', '/api/data/', '/api/music/'] as const;

Bun.serve({
  port,
  // A voice backend can load a large model on the first /speak, which far exceeds Bun's
  // default 10s idleTimeout — without this the proxied request is killed mid-synth
  // ("request timed out after 10 seconds"). 255s is Bun's max; covers a cold load.
  idleTimeout: 255,
  routes: { '/': index },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    // Translate /api/tts/{speak,health} directly into a GPT-SoVITS api_v2 call — no owner glue.
    // v0.44.2: proxy the data surface to the dev sidecar so a plain-browser session reads her real
    // diaries/skills/dreams same-origin (the packaged app's serve.ts does the same).
    // v0.45.6: /api/music/* rides the same proxy — the player card lives in dev mode too (this
    // server IS what the packaged app serves in dev-all mode; without the route the card's first
    // poll 404s and permanently unmounts). Content-type passes through, so artwork JPEGs survive.
    if (pathname.startsWith('/api/data/') || pathname.startsWith('/api/music/')) {
      const target = `http://127.0.0.1:${Bun.env['LUNA_PORT'] ?? 8787}${pathname}${new URL(req.url).search}`;
      try {
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
        const upstream = await fetch(target, {
          method: req.method,
          ...(body !== undefined ? { body } : {}),
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        return new Response(await upstream.arrayBuffer(), {
          status: upstream.status,
          headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
        });
      } catch {
        return new Response('data upstream unreachable', { status: 502 });
      }
    }
    if (pathname.startsWith('/api/tts/')) {
      const subpath = pathname.slice('/api/tts/'.length);
      const body = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
      const plan = planTtsForward(subpath, body, TTS_ENV);
      if (plan.kind === 'error') return new Response(plan.message, { status: plan.status });
      try {
        if (plan.kind === 'health') {
          await fetch(plan.url, { signal: AbortSignal.timeout(5000) }); // reachable? any response is alive
          return Response.json({ backend: { ready: true, state: 'ready' } });
        }
        const upstream = await fetch(plan.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: plan.body,
          signal: AbortSignal.timeout(600_000), // covers a cold api_v2 model load
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { 'content-type': upstream.headers.get('content-type') ?? 'audio/wav' },
        });
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
