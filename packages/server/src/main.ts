import { join } from 'node:path';
import { handleClose, handleMessage, handleOpen, setRuntime, type WSData } from './ws';
import { AnthropicProvider } from './provider/anthropic';
import { builtinRegistry } from './tools/registry';
import { closeDb, migrate, openDb } from './sql';
import { TraceStore } from './trace/store';
import { setTraceStore } from './trace/instrument';

const port = Number(process.env['LUNA_PORT'] ?? 8787);

const db = openDb(Bun.env['LUNA_DB_PATH'] ?? './luna.sqlite');
const version = migrate(db, join(import.meta.dir, 'trace', 'migrations'));
setTraceStore(new TraceStore(db));
console.log(`[luna-server] sqlite ready (schema v${version})`);

process.on('SIGTERM', () => {
  closeDb(db);
  process.exit(0);
});

if (Bun.env['ANTHROPIC_API_KEY']) {
  setRuntime({ provider: new AnthropicProvider(), registry: builtinRegistry });
  console.log(
    `[luna-server] provider: ${Bun.env['LUNA_MODEL'] ?? 'claude-opus-4-8'} via ${Bun.env['ANTHROPIC_BASE_URL'] ?? 'https://api.anthropic.com'}`,
  );
} else {
  console.warn('[luna-server] ANTHROPIC_API_KEY not set — chat.send disabled');
}

const server = Bun.serve<WSData>({
  port,
  fetch(req, srv) {
    if (srv.upgrade(req, { data: { sessionId: 'default' } })) return;
    return new Response('luna-server: WebSocket only', { status: 426 });
  },
  websocket: {
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  },
});

console.log(`[luna-server] listening on ws://${server.hostname}:${server.port}`);
