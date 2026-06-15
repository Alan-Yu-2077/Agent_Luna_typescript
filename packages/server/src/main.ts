import { join } from 'node:path';
import { broadcast, handleClose, handleMessage, handleOpen, setRuntime, type WSData } from './ws';
import { startScheduler } from './proactive/scheduler';
import { AnthropicProvider } from './provider/anthropic';
import {
  builtinRegistry,
  codeWriteEnabled,
  messageRegistry,
  shellEnabled,
  withCodeWrite,
  withShell,
} from './tools/registry';
import { closeDb, migrate, openDb } from './sql';
import { TraceStore } from './trace/store';
import { setTraceStore } from './trace/instrument';
import { traceViewerHandler } from './trace/viewer';
import { workspaceHandler } from './workspace/workspace';
import { devChatHandler } from './devchat/devchat';
import { setMemoryDb } from './memory/sessionStore';
import { initCustomSqlite } from './memory/recall/vecRuntime';
import { bootReconcile } from './dream/dreamState';

const port = Number(process.env['LUNA_PORT'] ?? 8787);

// Must precede ANY Database construction (process-global, once) — enables
// extension loading for sqlite-vec on macOS.
initCustomSqlite();

// Pin the DB to the repo root regardless of cwd (../../../ from packages/server/src),
// so launching from a subdirectory can't silently create a second empty luna.sqlite.
const db = openDb(Bun.env['LUNA_DB_PATH'] ?? join(import.meta.dir, '..', '..', '..', 'luna.sqlite'));
const version = migrate(db, join(import.meta.dir, 'migrations'));
const traceStore = new TraceStore(db);
setTraceStore(traceStore);
if (Bun.env['LUNA_PERSIST'] !== '0') {
  setMemoryDb(db);
}
bootReconcile();
console.log(`[luna-server] sqlite ready (schema v${version})`);

const viewerEnabled = Bun.env['LUNA_VIEWER'] !== '0';

process.on('SIGTERM', () => {
  closeDb(db);
  process.exit(0);
});

// Defense-in-depth: a stray rejection from a fire-and-forget path (a turn,
// proactive cycle, or dream) must log, never terminate the companion process.
process.on('unhandledRejection', (reason) => {
  console.error('[luna-server] unhandled rejection:', reason);
});

if (Bun.env['ANTHROPIC_API_KEY']) {
  const provider = new AnthropicProvider();
  const summarizerKey = Bun.env['LUNA_SUMMARIZER_API_KEY'];
  // Dream cascade: summarizer-key provider first (never competes with the main
  // reply key's quota), default provider as fallback.
  const dreamLlm = summarizerKey
    ? { primary: new AnthropicProvider({ apiKey: summarizerKey }), fallback: provider }
    : { primary: provider, fallback: null };
  // LD #9 mode switch, read once at boot: registry content IS the mode —
  // everything downstream derives it from the registry, never from env.
  // Default ON since v0.7.0; LUNA_MESSAGE_TOOL=0 is the text-path escape hatch.
  const messageMode = Bun.env['LUNA_MESSAGE_TOOL'] !== '0';
  // Code-write tools (v0.15.1) layer on iff LUNA_CODE_WRITE != 0 (default ON).
  // Composed once at boot so the registry — not an env read in the hot loop —
  // is the source of truth for "can Luna write files".
  const writeMode = codeWriteEnabled();
  // Shell + verify loop (v0.15.2) layers on iff LUNA_SHELL != 0 (default ON).
  const shellMode = shellEnabled();
  const registry = withShell(withCodeWrite(messageMode ? messageRegistry : builtinRegistry));
  setRuntime({ provider, registry, dreamLlm });
  console.log(
    `[luna-server] provider: ${Bun.env['LUNA_MODEL'] ?? 'claude-opus-4-8'} via ${Bun.env['ANTHROPIC_BASE_URL'] ?? 'https://api.anthropic.com'}${summarizerKey ? ' (+summarizer key)' : ''}${messageMode ? ' [message-tool mode]' : ''}${writeMode ? ' [code-write]' : ''}${shellMode ? ' [shell]' : ''}`,
  );
  // Proactive heartbeat (v0.10.3). The timer runs always; each tick no-ops
  // unless LUNA_PROACTIVE=1 (re-read per tick, so the kill switch toggles
  // without a restart). Bubbles push to all connected sockets.
  startScheduler({ provider, registry, dreamLlm, emit: broadcast });
} else {
  console.warn('[luna-server] ANTHROPIC_API_KEY not set — chat.send disabled');
}

const server = Bun.serve<WSData>({
  port,
  async fetch(req, srv) {
    if (viewerEnabled) {
      const viewerResponse = traceViewerHandler(req, traceStore);
      if (viewerResponse) return viewerResponse;
      const workspaceResponse = await workspaceHandler(req);
      if (workspaceResponse) return workspaceResponse;
      const chatResponse = devChatHandler(req);
      if (chatResponse) return chatResponse;
    }
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
