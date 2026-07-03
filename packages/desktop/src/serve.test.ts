import { afterAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWebHost } from './serve';

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

// A stand-in for scripts/tts-proxy.cjs: /health returns JSON, /speak echoes its body as audio bytes.
// /api/admin is a sibling endpoint OUTSIDE the /api/gpt-sovits/ subtree — a successful path-traversal
// escape would reach it, so the guard test asserts it stays unreachable.
function startFakeTts(): Server {
  return createServer((req, res) => {
    if (req.url === '/api/admin') {
      res.writeHead(200).end('SECRET');
      return;
    }
    if (req.url === '/api/gpt-sovits/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
      return;
    }
    if (req.url === '/api/gpt-sovits/speak') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'audio/wav' });
        res.end(Buffer.concat(chunks));
      });
      return;
    }
    res.writeHead(404).end('nope');
  }).listen(0, '127.0.0.1');
}

describe('startWebHost TTS forwarding (v0.28.7)', () => {
  it('forwards a GET /api/gpt-sovits/* request to the upstream', async () => {
    const ttsPort = await portOf(startFakeTts());
    const web = await portOf(startWebHost(mkDist(), 0, `http://127.0.0.1:${ttsPort}`));
    const res = await fetch(`http://127.0.0.1:${web}/api/gpt-sovits/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ready' });
  });

  it('forwards a POST body and passes binary audio back verbatim', async () => {
    const ttsPort = await portOf(startFakeTts());
    const web = await portOf(startWebHost(mkDist(), 0, `http://127.0.0.1:${ttsPort}`));
    const res = await fetch(`http://127.0.0.1:${web}/api/gpt-sovits/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '你好' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/wav');
    expect(await res.text()).toBe(JSON.stringify({ text: '你好' }));
  });

  it('502s a /api/gpt-sovits/* request when no upstream is configured', async () => {
    const web = await portOf(startWebHost(mkDist(), 0));
    const res = await fetch(`http://127.0.0.1:${web}/api/gpt-sovits/health`);
    expect(res.status).toBe(502);
  });

  it('502s when the configured upstream is unreachable', async () => {
    // Port 1 is never listening — the forward's fetch rejects → 502, never a hang.
    const web = await portOf(startWebHost(mkDist(), 0, 'http://127.0.0.1:1'));
    const res = await fetch(`http://127.0.0.1:${web}/api/gpt-sovits/health`);
    expect(res.status).toBe(502);
  });

  it('still serves static files and guards path traversal', async () => {
    const web = await portOf(startWebHost(mkDist(), 0));
    const index = await fetch(`http://127.0.0.1:${web}/`);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('luna');
    const escape = await fetch(`http://127.0.0.1:${web}/../../etc/passwd`);
    expect(escape.status).toBe(404);
  });

  it('blocks an encoded ..%2f traversal out of the /api/gpt-sovits/ subtree', async () => {
    const ttsPort = await portOf(startFakeTts());
    const web = await portOf(startWebHost(mkDist(), 0, `http://127.0.0.1:${ttsPort}`));
    // Decodes to /api/gpt-sovits/../admin → would resolve to the sibling /api/admin on the upstream.
    const res = await fetch(`http://127.0.0.1:${web}/api/gpt-sovits/..%2fadmin`);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toBe('SECRET');
    // The legit route under the subtree still forwards.
    const ok = await fetch(`http://127.0.0.1:${web}/api/gpt-sovits/health`);
    expect(ok.status).toBe(200);
  });
});
