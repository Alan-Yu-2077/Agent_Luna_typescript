import { join } from 'node:path';
import { shouldHonorShutdown } from './shutdownRoute';
import { broadcast, handleClose, handleMessage, handleOpen, setRuntime, type WSData } from './ws';
import { fireProactiveForActiveSessions, startScheduler } from './proactive/scheduler';
import { providerFor } from './provider/factory';
import { describeCapabilities } from './provider/capabilities';
import { DEFAULT_OPENAI_MODEL, resolveModel } from './provider/registry';
import {
  builtinRegistry,
  codeWriteEnabled,
  messageRegistry,
  repoMapEnabled,
  selfEditEnabled,
  shellEnabled,
  skillsEnabled,
  weatherEnabled,
  webFetchEnabled,
  webSearchEnabled,
  withCodeWrite,
  withRepoMap,
  withSelfEdit,
  withShell,
  withSkills,
  withWeather,
  withWebFetch,
  withWebSearch,
} from './tools/registry';
import { closeDb, migrate, openDb } from './sql';
import { TraceStore } from './trace/store';
import { setTraceStore } from './trace/instrument';
import { traceViewerHandler } from './trace/viewer';
import { workspaceHandler } from './workspace/workspace';
import { devChatHandler } from './devchat/devchat';
import { setMemoryDb } from './memory/sessionStore';
import { seedSoulOnBoot } from './memory/soulSeed';
import { initCustomSqlite } from './memory/recall/vecRuntime';
import { bootReconcile, dreamStatus, isDreaming, shutdownDreamDue } from './dream/dreamState';
import { runDreamCycle } from './dream/cycle';
import { setOnWeatherRefresh, startWeatherRefresh } from './tools/web/weather/snapshot';
import { activeSessionIds, preloadSessions } from './turn/session';
import { initSettings } from './settings/store';
import { setSkillsRecallMounted } from './skills/skillStore';

const port = Number(process.env['LUNA_PORT'] ?? 8787);

// Must precede ANY Database construction (process-global, once) — enables
// extension loading for sqlite-vec on macOS.
initCustomSqlite();

// Pin the DB to the repo root regardless of cwd (../../../ from packages/server/src),
// so launching from a subdirectory can't silently create a second empty luna.sqlite.
const db = openDb(
  Bun.env['LUNA_DB_PATH'] ?? join(import.meta.dir, '..', '..', '..', 'luna.sqlite'),
);
// v0.26.1: overridable for the compiled sidecar — a `bun build --compile` binary has a virtual
// import.meta.dir, so the desktop supervisor ships migrations as resources and points here.
const version = migrate(db, Bun.env['LUNA_MIGRATIONS_DIR'] ?? join(import.meta.dir, 'migrations'));
const traceStore = new TraceStore(db);
setTraceStore(traceStore);
if (Bun.env['LUNA_PERSIST'] !== '0') {
  setMemoryDb(db);
}
// Initiative 22 (v0.30.0, dark launch): seed the soul table's fixed core
// (hash-gated) + one-time evolving migration from core_memory. Nothing reads
// the soul yet — zero runtime behavior change this version.
seedSoulOnBoot();
bootReconcile();
// v0.27.1: overlay UI-pinned settings onto Bun.env BEFORE any provider/tool-registry
// construction below — that's what makes a pinned restart-required flag (LUNA_MODEL,
// LUNA_WEB_SEARCH...) actually take effect on the next boot.
initSettings(Bun.env['LUNA_PERSIST'] !== '0' ? db : null);
// v0.21.6: warm persisted sessions into the in-memory map so the proactive
// scheduler considers them right after a restart (activeSessionIds() reads the
// in-memory map) — without this, proactive stayed dead until the next chat.
preloadSessions();
console.log(`[luna-server] sqlite ready (schema v${version})`);

const viewerEnabled = Bun.env['LUNA_VIEWER'] !== '0';

// Defense-in-depth: a stray rejection from a fire-and-forget path (a turn,
// proactive cycle, or dream) must log, never terminate the companion process.
process.on('unhandledRejection', (reason) => {
  console.error('[luna-server] unhandled rejection:', reason);
});

// v0.38.5: the graceful-shutdown trigger, set by whichever branch below owns the exit path, so the
// POST /shutdown route (loopback-only) can reach it. Defaults to a hard exit until wired.
let triggerShutdown: (reason: string) => void = () => process.exit(0);

if (Bun.env['ANTHROPIC_API_KEY']) {
  const provider = providerFor();
  const summarizerKey = Bun.env['LUNA_SUMMARIZER_API_KEY'];
  // Dream cascade: summarizer-key provider first (never competes with the main
  // reply key's quota), default provider as fallback.
  const dreamLlm = summarizerKey
    ? { primary: providerFor({ apiKey: summarizerKey }), fallback: provider }
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
  // Repo map + locator (v0.15.3) layer on iff LUNA_REPO_MAP != 0 (default ON).
  const repoMapMode = repoMapEnabled();
  // Skill library + propose-only self-edit (v0.15.4) layer on iff LUNA_SKILLS /
  // LUNA_SELF_EDIT != 0 (default ON; self-edit is propose-only so it never writes).
  const skillMode = skillsEnabled();
  // v0.32.1: freeze the same truth for the recall paths (candidates + rag_refresh
  // pre-warm) — a live LUNA_SKILLS pin must not half-apply skills before restart.
  setSkillsRecallMounted(skillMode);
  const selfEditMode = selfEditEnabled();
  // Web tools (v0.18.0 search, v0.18.1 fetch) layer on iff their flags are set.
  // v0.18.2 flips both default ON; search degrades to off when no API key.
  const webSearchMode = webSearchEnabled();
  const webFetchMode = webFetchEnabled();
  // Weather (Initiative 14, v0.21.0) layers on iff LUNA_WEATHER=1 (opt-in until
  // the v0.21.2 close flips it on). No key — the flag alone is the gate.
  const weatherMode = weatherEnabled();
  const registry = withWeather(
    withWebFetch(
      withWebSearch(
        withSelfEdit(
          withSkills(
            withRepoMap(withShell(withCodeWrite(messageMode ? messageRegistry : builtinRegistry))),
          ),
        ),
      ),
    ),
  );
  setRuntime({ provider, registry, dreamLlm });
  // Resolve the SAME way providerFor() does, so the log can't lie about the model/endpoint that
  // will actually be hit (v0.23.4 D2).
  const cfgModel =
    Bun.env['LUNA_MODEL'] && Bun.env['LUNA_MODEL'].trim() !== '' ? Bun.env['LUNA_MODEL'] : undefined;
  const proto = Bun.env['LUNA_PROVIDER'] ?? resolveModel(cfgModel ?? 'claude-opus-4-8').protocol;
  const wireModel = cfgModel ?? (proto === 'openai' ? DEFAULT_OPENAI_MODEL : 'claude-opus-4-8');
  const endpoint =
    proto === 'openai'
      ? (Bun.env['LUNA_OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1')
      : (Bun.env['ANTHROPIC_BASE_URL'] ?? 'https://api.anthropic.com');
  console.log(
    `[luna-server] provider: ${proto}/${wireModel} via ${endpoint} (${describeCapabilities(provider.capabilities)})${summarizerKey ? ' (+summarizer key)' : ''}${messageMode ? ' [message-tool mode]' : ''}${writeMode ? ' [code-write]' : ''}${shellMode ? ' [shell]' : ''}${repoMapMode ? ' [repo-map]' : ''}${skillMode ? ' [skills]' : ''}${selfEditMode ? ' [self-edit]' : ''}${webSearchMode ? ' [web-search]' : ''}${webFetchMode ? ' [web-fetch]' : ''}${weatherMode ? ' [weather]' : ''}`,
  );
  // Proactive heartbeat (v0.10.3). The timer runs always; each tick no-ops
  // unless LUNA_PROACTIVE=1 (re-read per tick, so the kill switch toggles
  // without a restart). Bubbles push to all connected sockets.
  const schedulerDeps = { provider, registry, dreamLlm, emit: broadcast };
  startScheduler(schedulerDeps);
  // Ambient weather (Initiative 14, v0.21.1): a .unref()'d background refresh of
  // the snapshot parse_input reads synchronously. No-op unless LUNA_WEATHER_AMBIENT=1
  // and LUNA_LAT_LON is set; never fetches on the reactive path.
  // v0.22.2 (Initiative 15): the weather event hook — a notable snapshot change runs one
  // proactive eval (weatherShift) at the natural instant. Gated by LUNA_PROACTIVE_EVENT_HOOKS
  // (default off); wired before startWeatherRefresh so the first refresh is covered.
  setOnWeatherRefresh(() => {
    if (Bun.env['LUNA_PROACTIVE_EVENT_HOOKS'] === '1') {
      void fireProactiveForActiveSessions(schedulerDeps).catch(() => {});
    }
  });
  startWeatherRefresh();

  // Shutdown dream (v0.21.7): on a graceful exit (Ctrl-C / SIGTERM) run one last
  // dream so the day's diary + memory consolidate before the process dies — the
  // terminal-exit equivalent of going to sleep. Best-effort + deadline-bounded; a
  // second signal forces an immediate exit. LUNA_SHUTDOWN_DREAM=0 disables it (for
  // fast dev restarts); LUNA_SHUTDOWN_DREAM_TIMEOUT_MS (default 120s) bounds the wait.
  // v0.32.5 — cooldown gate: on desktop every window close SIGTERMs the sidecar, so
  // this fired a full dream on EVERY quit. Only dream if the last one is at least
  // LUNA_SHUTDOWN_DREAM_MIN_GAP_MS old (default 6h; 0 = always, NaN/neg → default).
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) process.exit(1); // a second signal → force exit now
    shuttingDown = true;
    try {
      const rawGap = Number(Bun.env['LUNA_SHUTDOWN_DREAM_MIN_GAP_MS']);
      const minGapMs = Number.isFinite(rawGap) && rawGap >= 0 ? rawGap : 21_600_000;
      const due = shutdownDreamDue(dreamStatus().last_dream_ms, Date.now(), minGapMs);
      if (Bun.env['LUNA_SHUTDOWN_DREAM'] !== '0' && !isDreaming() && due) {
        console.log(`[luna-server] ${signal} — running a shutdown dream…`);
        const deadlineMs = Number(Bun.env['LUNA_SHUTDOWN_DREAM_TIMEOUT_MS'] ?? 120_000);
        const dreams = (async () => {
          for (const sessionId of activeSessionIds()) {
            await runDreamCycle({ sessionId, llm: dreamLlm, emit: broadcast });
          }
        })();
        await Promise.race([dreams, Bun.sleep(deadlineMs)]);
      } else if (Bun.env['LUNA_SHUTDOWN_DREAM'] !== '0' && !isDreaming() && !due) {
        console.log(`[luna-server] ${signal} — last dream too recent, skipping shutdown dream`);
      }
    } catch (e) {
      console.error('[luna-server] shutdown dream failed:', e);
    } finally {
      closeDb(db);
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  triggerShutdown = (reason) => void shutdown(reason); // POST /shutdown → the same graceful path
} else {
  console.warn('[luna-server] ANTHROPIC_API_KEY not set — chat.send disabled');
  const bye = (): void => {
    closeDb(db);
    process.exit(0);
  };
  process.on('SIGTERM', bye);
  process.on('SIGINT', bye);
  triggerShutdown = bye;
}

const server = Bun.serve<WSData>({
  port,
  // S1 (v0.16.0): bind loopback by default so WS + /_trace + /_chat + /_workspace
  // are not reachable (or driveable) off-host. LAN access is explicit opt-in via
  // LUNA_BIND_HOST=0.0.0.0. Closes S1, S2's exposure, and S3 in one line.
  hostname: Bun.env['LUNA_BIND_HOST'] ?? '127.0.0.1',
  async fetch(req, srv) {
    // v0.38.5: loopback-only graceful shutdown (the desktop shell calls this before killing the
    // sidecar on win32, where SIGTERM never arrives). Reply immediately; the dream runs async.
    const pathname = new URL(req.url).pathname;
    if (shouldHonorShutdown(req.method, pathname, Bun.env['LUNA_BIND_HOST'] ?? '127.0.0.1')) {
      console.log('[luna-server] POST /shutdown — graceful shutdown requested');
      queueMicrotask(() => triggerShutdown('http'));
      return new Response('shutting down', { status: 200 });
    }
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
    // S5 (v0.16.0): cap inbound frames. A chat.send is ≤ ~8KB (text capped at
    // 8000 chars in the schema); 1MB rejects oversized/abusive payloads while
    // leaving ample headroom for any legitimate client frame.
    maxPayloadLength: 1024 * 1024,
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  },
});

console.log(`[luna-server] listening on ws://${server.hostname}:${server.port}`);
