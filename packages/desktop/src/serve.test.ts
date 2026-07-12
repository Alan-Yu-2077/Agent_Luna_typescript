import { afterAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWebHost } from './serve';
import type { TtsEnv } from '../../web/src/tts/apiV2';

const servers: Server[] = [];
afterAll(() => {
  for (const s of servers) s.close();
});

async function portOf(s: Server): Promise<number> {
  servers.push(s);
  await new Promise<void>((r) => s.once('listening', r));
  const a = s.address();
  if (a && typeof a === 'object') return a.port;
  throw new Error('no port assigned');
}

function mkDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'luna-serve-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html>luna');
  return dir;
}

// A stand-in for a GPT-SoVITS api_v2 server: POST /tts echoes its body back as audio (so we can assert
// the translated payload), any other route 404s (which the health probe treats as "server alive").
// /admin is a sibling route that must stay unreachable — a path-traversal escape would hit it.
function startFakeApiV2(): Server {
  return createServer((req, res) => {
    if (req.url === '/admin') {
      res.writeHead(200).end('SECRET');
      return;
    }
    if (req.method === 'POST' && req.url === '/tts') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'audio/wav' });
        res.end(Buffer.concat(chunks));
      });
      return;
    }
    res.writeHead(404).end('nope'); // any other GET → alive, but not a recognized route
  }).listen(0, '127.0.0.1');
}

const envFor = (port: number): TtsEnv => ({ url: `http://127.0.0.1:${port}`, refAudio: '/voice/ref.wav' });

describe('startWebHost /api/tts → api_v2 forwarding', () => {
  it('health probes the api_v2 upstream and reports ready when reachable', async () => {
    const ttsPort = await portOf(startFakeApiV2());
    const web = await portOf(startWebHost(mkDist(), 0, envFor(ttsPort)));
    const res = await fetch(`http://127.0.0.1:${web}/api/tts/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ backend: { ready: true, state: 'ready' } });
  });

  it('translates /api/tts/speak into an api_v2 POST /tts and passes audio back', async () => {
    const ttsPort = await portOf(startFakeApiV2());
    const web = await portOf(startWebHost(mkDist(), 0, envFor(ttsPort)));
    const res = await fetch(`http://127.0.0.1:${web}/api/tts/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '你好' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/wav');
    const payload = JSON.parse(await res.text()) as Record<string, unknown>;
    expect(payload['text']).toBe('你好');
    expect(payload['ref_audio_path']).toBe('/voice/ref.wav'); // the BYO voice, injected server-side
  });

  it('502s when no LUNA_TTS_URL is configured', async () => {
    const web = await portOf(startWebHost(mkDist(), 0, {}));
    const res = await fetch(`http://127.0.0.1:${web}/api/tts/health`);
    expect(res.status).toBe(502);
  });

  it('v0.35.3: a ttsEnv GETTER is re-read per request — a voice install applies with no restart', async () => {
    const ttsPort = await portOf(startFakeApiV2());
    let env: TtsEnv = {}; // boots unconfigured, like a fresh install
    const web = await portOf(startWebHost(mkDist(), 0, () => env));
    expect((await fetch(`http://127.0.0.1:${web}/api/tts/health`)).status).toBe(502);
    env = { url: `http://127.0.0.1:${ttsPort}`, refAudio: '/voice/new-ref.wav' }; // the wizard installs a pack
    expect((await fetch(`http://127.0.0.1:${web}/api/tts/health`)).status).toBe(200);
    const speak = await fetch(`http://127.0.0.1:${web}/api/tts/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'fresh' }),
    });
    const payload = JSON.parse(await speak.text()) as Record<string, unknown>;
    expect(payload['ref_audio_path']).toBe('/voice/new-ref.wav'); // the NEW env, same host instance
  });

  it('502s when the configured upstream is unreachable', async () => {
    // Port 1 is never listening — the forward's fetch rejects → 502, never a hang.
    const web = await portOf(startWebHost(mkDist(), 0, { url: 'http://127.0.0.1:1', refAudio: '/r.wav' }));
    const res = await fetch(`http://127.0.0.1:${web}/api/tts/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    });
    expect(res.status).toBe(502);
  });

  it('serves an installed model from userModelsDir (ahead of webDist), traversal-guarded', async () => {
    const models = mkdtempSync(join(tmpdir(), 'luna-models-'));
    writeFileSync(join(models, 'hana.model3.json'), '{"ok":true}');
    const web = await portOf(startWebHost(mkDist(), 0, {}, models));
    const hit = await fetch(`http://127.0.0.1:${web}/models/hana.model3.json`);
    expect(hit.status).toBe(200);
    expect(await hit.json()).toEqual({ ok: true });
    // A traversal out of the models root falls through to webDist → 404, never escapes.
    const escape = await fetch(`http://127.0.0.1:${web}/models/..%2f..%2fetc%2fpasswd`);
    expect(escape.status).toBe(404);
  });

  it('still serves static files and guards path traversal', async () => {
    const web = await portOf(startWebHost(mkDist(), 0));
    const index = await fetch(`http://127.0.0.1:${web}/`);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('luna');
    const escape = await fetch(`http://127.0.0.1:${web}/../../etc/passwd`);
    expect(escape.status).toBe(404);
  });

  it('a ..%2f traversal under /api/tts/ is an unknown subpath, never forwarded to a sibling route', async () => {
    const ttsPort = await portOf(startFakeApiV2());
    const web = await portOf(startWebHost(mkDist(), 0, envFor(ttsPort)));
    // Decodes to /api/tts/../admin → an unknown subpath. The forward constructs the api_v2 URL from a
    // FIXED path, so this can never reach the upstream /admin.
    const res = await fetch(`http://127.0.0.1:${web}/api/tts/..%2fadmin`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toBe('SECRET');
    // The legit health route still works.
    const ok = await fetch(`http://127.0.0.1:${web}/api/tts/health`);
    expect(ok.status).toBe(200);
  });
});
