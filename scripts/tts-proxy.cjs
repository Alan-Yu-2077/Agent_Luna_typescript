// Standalone HTTP wrapper that gives a local GPT-SoVITS service its own listener so the one-command
// dev launcher can bring voice up alongside the TS server + web. Voice is bring-your-own: point
// LUNA_TTS_DIR at a GPT-SoVITS install that exposes `server/gpt-sovits-service.js` (whose handleHttp
// routes /api/gpt-sovits/{health,voices,speak,diagnostics} and manages the api_v2 backend). Local use
// only; if LUNA_TTS_DIR is unset the launcher never spawns this — the app runs voiceless.

const http = require('http');
const path = require('path');

const ttsDir = process.env.LUNA_TTS_DIR;
const port = Number(process.env.LUNA_TTS_PORT || 8788);
if (!ttsDir) {
  console.error('[tts-proxy] LUNA_TTS_DIR not set — point it at a GPT-SoVITS install, or run without voice.');
  process.exit(1);
}

let GptSovitsService;
try {
  ({ GptSovitsService } = require(path.join(ttsDir, 'server', 'gpt-sovits-service.js')));
} catch (err) {
  console.error(`[tts-proxy] cannot load GPT-SoVITS service from ${ttsDir}: ${err.message}`);
  console.error('[tts-proxy] set LUNA_TTS_DIR to the local TTS module, or run without voice.');
  process.exit(1);
}

const service = new GptSovitsService({ configPath: path.join(ttsDir, 'config', 'gpt-sovits.json') });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await service.handleHttp(req, res);
    if (!handled) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"not found"}');
    }
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String((err && err.message) || err) }));
  }
});

server.listen(port, () => {
  console.log(`gpt-sovits proxy on http://localhost:${port}  (TTS dir: ${ttsDir})`);
});

function shutdown() {
  try {
    service.stop();
  } catch {
    /* ignore */
  }
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
