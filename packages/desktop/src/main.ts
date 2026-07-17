import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { defaultDistDir, startWebHost, WEB_PORT } from './serve';
import { readTtsEnv } from '../../web/src/tts/apiV2';
import { ENV_TEMPLATE, parseEnvFile } from './envfile';
import { readShellSettings, writeShellSettings } from './shellSettings';
import {
  classifyProbe,
  filterWizardFields,
  mergeEnvFile,
  needsOnboarding,
  wizardFlagEnabled,
  wizardPrefill,
  type ProbeVerdict,
} from './onboarding';
import {
  coreLocationFixAsync,
  formatLatLon,
  movedBeyond,
  parseLatLon,
  resolveDesktopLocation,
  type LatLon,
} from './location';
import { createPetDrag, type PetDrag } from './petDrag';
import { petWindowOptions } from './petWindow';
import { createSupervisor, waitForPort, type Supervisor } from './supervisor';
import { childPathValue, pathKeyFor, serverBinName } from './childEnv';
import { resolveBootMode, resolveDevLauncher, resolveSidecarDb, shouldAttach } from './backend';
import { probeEmbedding, probeSearch, probeWeather } from './probes';
import { installModelFolder } from './modelInstall';
import {
  generateTtsYaml,
  installVoicePack,
  scanVoicePack,
  startCommand,
  validateRuntimeDir,
  validateVoicePack,
} from './voicePack';
import {
  buildTtsArgv,
  pickWeight,
  resolveManagedCheckout,
  resolveManagedRuntime,
  type ManagedRuntime,
  type VoiceProcState,
} from './ttsRuntime';
import { buildManifest, killProvisioners, realSeams, runProvision, type ProvisionStatus } from './ttsProvision';

// v0.26.1 (Initiative 19): the single-machine app. The shell OWNS the whole runtime: it reads the
// user's keys from app-data (never the bundle), spawns the compiled luna-server sidecar against an
// app-data SQLite, serves the web build on the pinned loopback origin, waits for the server port,
// opens the window — and kills the sidecar on quit. LUNA_SMOKE=1 runs the same flow headless
// (hidden window + DOM probe + exit code) so the packaged app is verifiable without a desktop.

const SMOKE = process.env['LUNA_SMOKE'] === '1';
// v0.28.8: the app UNIFIES with the web backend. The canonical WS port is SHARED with `bun run dev`
// (8787), so the desktop window and the browser tab are the same Luna on the same DB. On boot the
// app probes this port: if a backend is already up it ATTACHES (no second sidecar, no second DB);
// only when nothing is listening does it spawn its own, now against the shared repo DB. The packaged
// SMOKE keeps its own port (8790) so a verification run never collides with a live dev server.
const SERVER_PORT = Number(process.env['LUNA_DESKTOP_WS_PORT'] ?? (SMOKE ? 8790 : 8787));
// v0.37.5: the loopback web host needs the same smoke isolation as the WS port — WEB_PORT (5177) is
// pinned for localStorage stability, so a smoke run while the real app is open hit EADDRINUSE and
// wedged before the probe (found the first time a smoke ran alongside a live instance).
const DESKTOP_WEB_PORT = Number(process.env['LUNA_DESKTOP_WEB_PORT'] ?? (SMOKE ? 5178 : WEB_PORT));
// v0.26.2: pet mode — transparent, frameless, always-on-top, region click-through. v0.27.0: the
// settings-panel toggle (persisted in settings.json) is the authority once used; LUNA_PET_MODE in
// luna.env / the env is only the initial default. Windowed mode stays the fallback.
let petMode = process.env['LUNA_PET_MODE'] === '1';

// v0.35.7: an isolated-userData override for smokes/screenshots/tests — macOS ignores $HOME for
// Application Support, so without this a "fresh machine" smoke silently reads the REAL profile
// (and once put private chat history into a docs screenshot). Set before anything touches paths.
const userDataOverride = process.env['LUNA_USER_DATA_DIR'];
if (userDataOverride) app.setPath('userData', userDataOverride);

type Paths = {
  userData: string;
  db: string;
  // v0.28.8: the shared repo DB (<repoRoot>/luna.sqlite) — the one Luna the web backend uses. On a
  // build==run machine this resolves (inlined __dirname three-up); a distributed build falls back to
  // the app-data `db` (see resolveSidecarDb).
  sharedDb: string;
  envFile: string;
  serverBin: string;
  migrationsDir: string;
  personaFile: string;
  webDist: string;
  userModelsDir: string;
};

function resolvePaths(): Paths {
  const userData = app.getPath('userData');
  // Dev (electron . from packages/desktop): resources live in the repo. Packaged: in resourcesPath.
  const res = app.isPackaged ? process.resourcesPath : join(__dirname, '..');
  const repo = join(__dirname, '..', '..');
  return {
    userData,
    db: join(userData, 'luna.sqlite'),
    // <repoRoot>/luna.sqlite — same file the server defaults to (server/src/main.ts). __dirname is
    // inlined at build as packages/desktop/src, so three up is the repo root.
    sharedDb: join(__dirname, '..', '..', '..', 'luna.sqlite'),
    envFile: join(userData, 'luna.env'),
    serverBin: app.isPackaged
      ? join(res, serverBinName(process.platform))
      : join(res, 'bin', serverBinName(process.platform)),
    migrationsDir: app.isPackaged
      ? join(res, 'migrations')
      : join(repo, 'server', 'src', 'migrations'),
    personaFile: app.isPackaged
      ? join(res, 'persona', 'default.md')
      : join(repo, 'server', 'persona', 'default.md'),
    webDist: app.isPackaged ? join(res, 'web') : defaultDistDir(__dirname),
    userModelsDir: join(userData, 'models'), // bring-your-own Live2D models the picker installs here
  };
}

// First run: write the key template so luna.env documents every field for power users. v0.28.0:
// the blocking "go edit a file, then restart" dialog is gone — the setup screen (below) collects
// the keys instead. The app still boots either way; no secret ever ships in the bundle.
function ensureUserConfig(p: Paths): Record<string, string> {
  mkdirSync(p.userData, { recursive: true });
  mkdirSync(p.userModelsDir, { recursive: true }); // so the static host can serve an installed model
  if (!existsSync(p.envFile)) writeFileSync(p.envFile, ENV_TEMPLATE);
  return parseEnvFile(readFileSync(p.envFile, 'utf8'));
}

// The renderer's boot config, injected by the preload as window.lunaConfig. Read fresh from luna.env
// (over process.env) so a just-installed model / changed voice is picked up on the next window load.
function currentLunaConfig(): { modelUrl?: string; ttsBackend?: string; ttsUrl?: string } {
  const env: Record<string, string | undefined> = paths
    ? { ...process.env, ...parseEnvFile(readFileSync(paths.envFile, 'utf8')) }
    : process.env;
  return { modelUrl: env['LUNA_MODEL_URL'], ttsBackend: env['LUNA_TTS_BACKEND'], ttsUrl: env['LUNA_TTS_URL'] };
}

// v0.35.4 (Initiative 25 close): the wizard is the DEFAULT setup experience; LUNA_SETUP_WIZARD=0 is
// the one-release escape hatch to the v0.28 single card. Read fresh (like currentLunaConfig) so a
// luna.env flip applies on the next setup-window load — the v0.34.15 lesson: the main process's
// process.env never carries luna.env values by itself.
function wizardEnabled(): boolean {
  const env: Record<string, string | undefined> = paths
    ? { ...process.env, ...parseEnvFile(readFileSync(paths.envFile, 'utf8')) }
    : process.env;
  return wizardFlagEnabled(env['LUNA_SETUP_WIZARD']);
}

function sidecarEnv(p: Paths, userEnv: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {
    // PATH etc. for the child; the user's keys OVERRIDE inherited vars, never the reverse.
    ...(process.env as Record<string, string>),
    ...userEnv,
    LUNA_PORT: String(SERVER_PORT),
    // v0.28.8: spawn against the SHARED repo DB (one Luna) — falls back to app-data under SMOKE or a
    // distributed build. When we ATTACH to a running backend instead, this sidecar never starts.
    LUNA_DB_PATH: resolveSidecarDb({ sharedDb: p.sharedDb, userDb: p.db, smoke: SMOKE }),
    LUNA_MIGRATIONS_DIR: p.migrationsDir,
    LUNA_PERSONA_PATH: p.personaFile,
  };
  // First-run degradation is the SHELL's job: an empty key would throw in the SDK constructor and
  // crash-loop the sidecar. A placeholder lets the app boot (the avatar renders if installed, the
  // window explains); turns fail politely until the real key lands in luna.env.
  if (!env['ANTHROPIC_API_KEY']) env['ANTHROPIC_API_KEY'] = 'sk-not-configured';
  // The smoke must exit promptly: the graceful shutdown dream (SIGTERM → up to 120s of memory
  // consolidation) would hold the inherited stdout pipe open long after app.exit.
  if (SMOKE) env['LUNA_SHUTDOWN_DREAM'] = '0';
  return env;
}

let supervisor: Supervisor | null = null;
let paths: Paths | null = null;
// v0.37.0 (Initiative 27): the managed-voice child — Luna spawns + supervises GPT-SoVITS api_v2
// herself when LUNA_TTS_MANAGED=1. Separate from the server sidecar supervisor; killed on the same
// quit paths. `ttsProcState` feeds /api/tts/health so the boot gate can tell "starting" from "down"
// (it is only consulted while the upstream is unreachable, so a stale value never masks a live one).
let ttsSupervisor: Supervisor | null = null;
let ttsProcState: VoiceProcState = 'idle';

// v0.37.2 (标准 1): the one-click installer's live snapshot. `inFlight` distinguishes "running" from
// a resumable parked state after a quit/failure — the wizard's button continues either.
let provisionStatus: ProvisionStatus = { stage: 'idle', pct: 0, bytesDone: 0, bytesTotal: 0 };
let provisionInFlight = false;

function freshUserEnv(p: Paths): Record<string, string | undefined> {
  return { ...process.env, ...parseEnvFile(readFileSync(p.envFile, 'utf8')) };
}

function hydrateProvisionStatus(p: Paths): void {
  if (provisionInFlight || provisionStatus.stage !== 'idle') return;
  const marker = join(p.userData, 'tts', 'provision.json');
  if (!existsSync(marker)) return;
  try {
    const m = JSON.parse(readFileSync(marker, 'utf8')) as { state?: string; error?: string };
    if (m.state === 'ready') provisionStatus = { stage: 'ready', pct: 100, bytesDone: 0, bytesTotal: 0 };
    else if (m.state === 'failed')
      provisionStatus = { stage: 'failed', pct: 0, bytesDone: 0, bytesTotal: 0, ...(m.error ? { error: m.error } : {}) };
    else if (typeof m.state === 'string' && m.state !== 'idle')
      provisionStatus = { stage: 'downloading', pct: 0, bytesDone: 0, bytesTotal: 0 }; // parked mid-install
  } catch {
    /* unreadable marker — stay idle */
  }
}

// findFfmpeg spawns `ffmpeg -version`; a swap re-creates the supervisor, so memoize the probe rather
// than re-spawning on the UI thread each time (the path does not change within a session).
let ffmpegPath: string | null | undefined;
function cachedFfmpeg(): string | null {
  if (ffmpegPath === undefined) ffmpegPath = realSeams().findFfmpeg();
  return ffmpegPath;
}

function createTtsSupervisor(rt: ManagedRuntime): Supervisor {
  const argv = buildTtsArgv(rt);
  console.log(`[luna-desktop] managed tts (${rt.kind}): ${argv.command} ${argv.args.join(' ')}`);
  // v0.37.12: api_v2 decodes the reference clip through torchcodec, which SHELLS OUT to ffmpeg — and a
  // Finder-launched .app hands its children a minimal PATH (/usr/bin:/bin) with no /opt/homebrew/bin.
  // Discover ffmpeg the same way the installer does and put its directory on the child's PATH, or the
  // voice installs perfectly and then 400s on every single utterance.
  const ffmpeg = cachedFfmpeg();
  // nltk looks in $HOME and the venv, never in the checkout — point it at the corpora the installer
  // put IN the runtime, or English G2P raises LookupError on a machine that has no ~/nltk_data.
  const nltkData = join(rt.checkout, 'nltk_data');
  // v0.38.0: win32's PATH separator is ';' and its env key is 'Path' (case-variant) — a hardcoded
  // ':' fused the ffmpeg dir onto the first real entry, and a separate 'PATH' key left the child
  // with two conflicting vars. childEnv assembles the value + resolves the one true key per platform.
  const pathKey = pathKeyFor(process.platform, process.env);
  const childPath = childPathValue(process.platform, process.env, ffmpeg ? dirname(ffmpeg) : null);
  return createSupervisor({
    command: argv.command,
    args: argv.args,
    cwd: argv.cwd,
    env: {
      ...(process.env as Record<string, string>),
      [pathKey]: childPath,
      ...(existsSync(nltkData) ? { NLTK_DATA: nltkData } : {}),
    },
    onEvent: (e) => {
      if (e === 'started') ttsProcState = 'starting';
      else if (e === 'restarting') ttsProcState = 'restarting';
      else if (e === 'gave-up') ttsProcState = 'gave-up';
      console.log(`[luna-desktop] managed tts: ${e}`);
    },
  });
}

async function maybeStartManagedTts(p: Paths): Promise<void> {
  if (SMOKE) return; // smokes are voiceless — a python child would wedge the headless run
  const rt = resolveManagedRuntime(freshUserEnv(p), { userData: p.userData });
  if (!rt) return;
  // An api_v2 already on the port (the owner's own instance, another app) is adopted, never doubled.
  if (await waitForPort(rt.port, 800)) {
    console.log(`[luna-desktop] managed tts: adopting external api_v2 on 127.0.0.1:${rt.port}`);
    return;
  }
  ttsSupervisor = createTtsSupervisor(rt);
  ttsSupervisor.start();
}

// v0.37.3: hot-swap the managed voice onto a freshly installed pack. The supervisor's argv is fixed
// at creation (the yaml path changed), so swap = stop the old child + create a new supervisor.
// Returns whether the new voice came up within the wait (the wizard badge keeps polling either way).
async function swapManagedTts(rt: ManagedRuntime): Promise<boolean> {
  if (SMOKE) return false;
  ttsSupervisor?.stop();
  ttsSupervisor = null;
  ttsProcState = 'idle';
  // Still listening after our stop = an EXTERNAL api_v2 owns the port (the owner's own instance) —
  // adopt it; its weights are its owner's business, never ours to restart.
  if (await waitForPort(rt.port, 800)) {
    console.log(`[luna-desktop] managed tts: external api_v2 on 127.0.0.1:${rt.port} — pack installed, not restarting it`);
    return true;
  }
  ttsSupervisor = createTtsSupervisor(rt);
  ttsSupervisor.start();
  return await waitForPort(rt.port, 60_000);
}
// v0.35.0: true when we ATTACHED to an already-running backend (bun run dev) — the wizard submit
// must not "restart" a sidecar we never started (it would race the external server for the port).
let attachedToExternal = false;

// Bun inlines __dirname as the SOURCE dir (packages/desktop/src) at compile time (see the preload
// note below), so the repo root — where scripts/ lives — is three up (used by the dev launcher).
const REPO_ROOT = join(__dirname, '..', '..', '..');

// v0.28.3: serialize onboarding submits — ipcMain.handle does NOT serialize concurrent awaits, so a
// double-invoke (DevTools, or a fast double-click that beats setBusy) could double-restart the
// sidecar + build two app windows. The renderer disables its buttons; this is the belt.
let onboardingInFlight = false;

function createWindow(mode: 'app' | 'setup' = 'app'): BrowserWindow {
  // The setup screen is always a normal window (a transparent/frameless pet window makes no sense
  // for a form) — pet framing only applies to the actual app.
  const usePet = petMode && mode !== 'setup';
  const win = new BrowserWindow({
    // Pet mode opens as a LANDSCAPE rectangle (the owner's chosen shape, ~4:3 — measured 641×480 off a
    // hand-sized window), not the old tall portrait; it can still be resized (petWindowOptions min).
    width: usePet ? 640 : 1280,
    height: usePet ? 480 : 860,
    show: !SMOKE,
    // Pet mode: she floats over the desktop — transparent/frameless/always-on-top, and (v0.28.2)
    // RESIZABLE with a min size so the whole pet scales by dragging the window edge.
    ...(usePet ? petWindowOptions() : {}),
    webPreferences: {
      // NOT join(__dirname, ...): bun inlines __dirname as the SOURCE dir (packages/desktop/src)
      // at compile time, but preload.cjs ships in dist/ (and in app.asar/dist/ when packaged) — so
      // the __dirname path pointed at a nonexistent src/preload.cjs and the bridge SILENTLY never
      // loaded (pet click-through + the pet toggle both dead). app.getAppPath() is the real bundle
      // root in both dev (packages/desktop) and packaged (…/app.asar). The preload-error listener
      // below turns any future miss back into a loud failure.
      preload: join(app.getAppPath(), 'dist', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // A companion must keep animating when covered/hidden — the pet failure mode reproduced live
      // during Initiative 18's preview (a hidden tab froze the pixi beat).
      backgroundThrottling: false,
    },
  });
  win.webContents.on('preload-error', (_e, path, error) => {
    console.error(`[luna-desktop] PRELOAD ERROR at ${path}: ${error.message}`);
  });
  // v0.35.4: the wizard's walkthrough cards link vendor consoles + resource pages. Those must open
  // in the system browser, never as a bare Electron child window (and non-https never opens at all).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (usePet) {
    win.setAlwaysOnTop(true, 'floating');
    // v0.28.2: NO per-pixel click-through anymore. The window takes the mouse normally — her body is
    // a `-webkit-app-region: drag` handle (move the pet), the bar/buttons are `no-drag` (clickable),
    // and the window edges resize (resizable:true). This trades the v0.26.2 "click through her
    // transparent margins to the desktop" nicety for real move/resize — the thing actually asked for.
    // petHitTest.ts + luna:set-ignore-mouse are kept intact for a possible future hybrid.
  }
  const url =
    mode === 'setup'
      ? `http://127.0.0.1:${DESKTOP_WEB_PORT}/?setup=1`
      : `http://127.0.0.1:${DESKTOP_WEB_PORT}/?ws=${SERVER_PORT}${usePet ? '&pet=1' : ''}`;
  void win.loadURL(url);
  return win;
}

ipcMain.on('luna:set-ignore-mouse', (event, ignore: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore === true, { forward: true });
});

// v0.28.6: manual pet-window drag (replaces `-webkit-app-region: drag`, which swallowed every
// mousedown before the DOM saw it — nothing inside the pet was clickable). The renderer decides
// what a drag is (pointerdown on her body + movement) and streams TOTAL deltas from the drag
// start; the shell moves the window. Ordinary clicks never enter this path.
let petDrag: PetDrag | null = null;
ipcMain.on('luna:pet-drag-start', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  petDrag = createPetDrag({
    getPosition: () => {
      const [x, y] = win.getPosition();
      return [x ?? 0, y ?? 0];
    },
    setPosition: (x, y) => win.setPosition(x, y),
  });
  petDrag.begin();
});
ipcMain.on('luna:pet-drag-move', (_event, dx: unknown, dy: unknown) => {
  if (typeof dx === 'number' && typeof dy === 'number') petDrag?.move(dx, dy);
});
ipcMain.on('luna:pet-drag-end', () => {
  petDrag?.end();
  petDrag = null;
});

// v0.27.0: pet mode toggled from the settings panel. transparent/frame are immutable after window
// creation, so the flip is: persist the choice, build the replacement window, THEN close the old
// one — closing first would fire window-all-closed and take the sidecar (and the app) down.
ipcMain.on('luna:set-pet-mode', (_event, on: unknown) => {
  const next = on === true;
  if (next === petMode || !paths) return;
  petMode = next;
  writeShellSettings(paths.userData, { petMode: next });
  const fresh = createWindow();
  for (const w of BrowserWindow.getAllWindows()) {
    if (w !== fresh) w.close();
  }
});

// v0.28.0: the first-run setup screen. The renderer collects base URL + key + model and the SHELL
// (not the renderer, not the sidecar) tests + writes them — the key rides one IPC direction and is
// never returned. The probe is a minimal authenticated request to the Anthropic-protocol endpoint
// (the Claude happy path); classifyProbe turns the outcome into a user-facing verdict.
async function probeConnection(baseUrl: string, apiKey: string, model: string): Promise<ProbeVerdict> {
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
    });
    return classifyProbe(res.status);
  } catch {
    return classifyProbe(null); // DNS / connect failure → bad URL
  }
}

type OnboardingFields = { baseUrl?: unknown; apiKey?: unknown; model?: unknown };
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

ipcMain.handle('luna:onboarding-probe', async (_event, raw: OnboardingFields) => {
  return probeConnection(asStr(raw?.baseUrl), asStr(raw?.apiKey), asStr(raw?.model));
});

// v0.35.1: the wizard's optional-step probes. Main-process-side like the chat probe — the key rides
// one IPC direction and only the {ok, error?} verdict returns.
type ProviderFields = Record<string, unknown>;
ipcMain.handle('luna:probe-embedding', async (_event, raw: ProviderFields) =>
  probeEmbedding({ baseUrl: asStr(raw?.['baseUrl']), apiKey: asStr(raw?.['apiKey']), model: asStr(raw?.['model']) }),
);
ipcMain.handle('luna:probe-search', async (_event, raw: ProviderFields) =>
  probeSearch({ apiKey: asStr(raw?.['apiKey']) }),
);
ipcMain.handle('luna:probe-weather', async (_event, raw: ProviderFields) =>
  probeWeather({ apiKey: asStr(raw?.['apiKey']), apiHost: asStr(raw?.['apiHost']) }),
);

ipcMain.handle('luna:onboarding-submit', async (_event, raw: OnboardingFields): Promise<ProbeVerdict> => {
  if (!paths) return { ok: false, error: 'Not ready — try again in a moment.' };
  if (onboardingInFlight) return { ok: false, error: 'Setup already in progress…' };
  onboardingInFlight = true;
  try {
    const baseUrl = asStr(raw?.baseUrl);
    const apiKey = asStr(raw?.apiKey);
    const model = asStr(raw?.model);
    // Test first — a bad key never gets persisted.
    const verdict = await probeConnection(baseUrl, apiKey, model);
    if (!verdict.ok) return verdict;
    const merged = mergeEnvFile(readFileSync(paths.envFile, 'utf8'), {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_API_KEY: apiKey,
      LUNA_MODEL: model,
    });
    writeFileSync(paths.envFile, merged);
    // Apply the keys live: re-spawn the sidecar against the new env (it may never have started).
    supervisor?.restart(sidecarEnv(paths, parseEnvFile(merged)));
    const up = await waitForPort(SERVER_PORT);
    if (!up) return { ok: false, error: 'Saved, but the server did not start. Check the logs.' };
    // Swap the setup window for the real app window (createWindow reads the resolved petMode).
    const fresh = createWindow('app');
    for (const w of BrowserWindow.getAllWindows()) if (w !== fresh) w.close();
    return { ok: true };
  } finally {
    onboardingInFlight = false;
  }
});

// Synchronous boot-config read for the preload (window.lunaConfig). sendSync is a one-time read at
// window load, so blocking is fine.
ipcMain.on('luna:get-config', (event) => {
  event.returnValue = currentLunaConfig();
});

ipcMain.on('luna:wizard-enabled', (event) => {
  event.returnValue = wizardEnabled();
});

// v0.35.0: re-enter setup — one setup window at most, focus an existing one instead of stacking.
// v0.35.6: extracted so the native menu + failure dialogs share it: the wizard must stay reachable
// even when a bad config leaves the renderer broken or the backend dead (no irreversible states).
function openSetupWindow(): void {
  const existing = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('setup=1'));
  if (existing) {
    existing.focus();
    return;
  }
  createWindow('setup');
}

ipcMain.on('luna:open-setup', () => {
  openSetupWindow();
});

// v0.35.6: the always-available escape hatch — a NATIVE menu item (⌘,) opens the setup wizard even
// if the renderer is a white screen. Standard roles keep copy/paste/devtools working.
function installAppMenu(): void {
  const setupItem = {
    label: 'Setup Wizard… / 重新配置',
    accelerator: 'CmdOrCtrl+,',
    click: (): void => openSetupWindow(),
  };
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { label: 'Setup', submenu: [setupItem] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// v0.35.0: the wizard's wide submit — every step's collected fields in ONE call, whitelisted
// (filterWizardFields drops anything the wizard doesn't manage), chat probe-first when chat fields
// are present (a bad key is never persisted, v0.28.0 rule), ONE luna.env merge + ONE sidecar
// restart at the end. Values ride this one direction; the verdict never echoes them.
ipcMain.handle('luna:wizard-submit', async (_event, raw: unknown): Promise<ProbeVerdict> => {
  if (!paths) return { ok: false, error: 'Not ready — try again in a moment.' };
  if (onboardingInFlight) return { ok: false, error: 'Setup already in progress…' };
  onboardingInFlight = true;
  try {
    const fields = filterWizardFields(raw);
    const baseUrl = fields['ANTHROPIC_BASE_URL'];
    const apiKey = fields['ANTHROPIC_API_KEY'];
    if (baseUrl !== undefined || apiKey !== undefined) {
      if (!baseUrl || !apiKey) return { ok: false, error: 'Enter a base URL and an API key.' };
      const verdict = await probeConnection(baseUrl, apiKey, fields['LUNA_MODEL'] ?? '');
      if (!verdict.ok) return verdict;
    }
    const merged = mergeEnvFile(readFileSync(paths.envFile, 'utf8'), fields);
    writeFileSync(paths.envFile, merged);
    // Attached to an externally-started backend (bun run dev): its keys come from the repo .env,
    // not luna.env — write only, no sidecar to restart. Shell-read values (model/tts) still apply
    // via the window swap below.
    if (!attachedToExternal) {
      supervisor?.restart(sidecarEnv(paths, parseEnvFile(merged)));
      const up = await waitForPort(SERVER_PORT);
      if (!up) return { ok: false, error: 'Saved, but the server did not start. Check the logs.' };
    }
    const fresh = createWindow('app');
    for (const w of BrowserWindow.getAllWindows()) if (w !== fresh) w.close();
    return { ok: true };
  } finally {
    onboardingInFlight = false;
  }
});

// v0.35.2: model install goes through ONE shared core (modelInstall.ts) — the picker and the
// wizard's drag-and-drop are just two entrances. On success, reload only NON-setup windows: the
// app window must re-inject lunaConfig so the model renders, but reloading the setup window would
// blow the wizard back to step 1 (a v0.35.0 flow bug this version fixes).
// Reload every NON-setup window so the renderer re-reads lunaConfig (model/voice backend) and
// rebuilds. The setup window is left alone — it swaps itself when onboarding finishes.
function reloadAppWindows(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.webContents.getURL().includes('setup=1')) w.reload();
  }
}

function installModelAndReload(src: string): { ok: boolean; modelUrl?: string; error?: string } {
  if (!paths) return { ok: false, error: 'Not ready — try again in a moment.' };
  const result = installModelFolder(src, { modelsDir: paths.userModelsDir, envFile: paths.envFile });
  if (result.ok) {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.webContents.getURL().includes('setup=1')) w.reload();
    }
  }
  return result;
}

// "Choose model folder…": pick a Live2D model dir via the native dialog.
ipcMain.handle('luna:choose-model', async (): Promise<{ ok: boolean; modelUrl?: string; error?: string }> => {
  const picked = dialog.showOpenDialogSync({
    title: 'Choose a Live2D model folder',
    properties: ['openDirectory'],
  });
  const src = picked?.[0];
  if (!src) return { ok: false, error: 'cancelled' };
  return installModelAndReload(src);
});

// v0.35.2: the wizard drop zone — the preload resolves the dropped File to a real path
// (webUtils.getPathForFile) and only the path string crosses IPC.
ipcMain.handle('luna:install-model-path', async (_event, raw: unknown) => {
  const src = asStr(raw);
  if (!src) return { ok: false, error: 'No folder received.' };
  return installModelAndReload(src);
});

// ── v0.35.3: the voice-pack flow (canonical GPT-SoVITS standard) ──────────────────────────────────

ipcMain.handle('luna:scan-voice-pack', async (_event, raw: unknown) => {
  const root = asStr(raw);
  if (!root || !existsSync(root) || !statSync(root).isDirectory())
    return { ok: false, error: 'That is not a folder.' };
  const scan = scanVoicePack(root);
  const valid = validateVoicePack(scan);
  if (!valid.ok) return valid;
  // Prefill the transcript textarea when the pack ships one (reference clips usually do).
  let transcriptPreview = '';
  const firstTxt = scan.transcripts[0];
  if (firstTxt) {
    try {
      transcriptPreview = readFileSync(firstTxt, 'utf8').trim().slice(0, 500);
    } catch {
      /* unreadable transcript — the user types it instead */
    }
  }
  return { ok: true, root, scan, transcriptPreview };
});

ipcMain.handle('luna:choose-tts-runtime', async () => {
  const picked = dialog.showOpenDialogSync({
    title: 'Choose your GPT-SoVITS folder',
    properties: ['openDirectory'],
  });
  const dir = picked?.[0];
  if (!dir) return { ok: false, error: 'cancelled' };
  const check = validateRuntimeDir(dir);
  if (!check.ok) return check;
  return { ok: true, dir, venv: !!check.venvPython };
});

type VoiceInstallRaw = Record<string, unknown>;
ipcMain.handle('luna:install-voice-pack', async (_event, raw: VoiceInstallRaw) => {
  if (!paths) return { ok: false, error: 'Not ready — try again in a moment.' };
  const root = asStr(raw?.['root']);
  const picks = {
    gptCkpt: asStr(raw?.['gptCkpt']),
    sovitsPth: asStr(raw?.['sovitsPth']),
    referenceWav: asStr(raw?.['referenceWav']),
    ...(asStr(raw?.['transcriptTxt']) !== '' ? { transcriptTxt: asStr(raw?.['transcriptTxt']) } : {}),
  };
  // The picks must come from the scanned pack — a stray absolute path can't smuggle files in.
  const inRoot = (p: string): boolean => p === '' || p.startsWith(root.endsWith(sep) ? root : root + sep);
  if (!root || !inRoot(picks.gptCkpt) || !inRoot(picks.sovitsPth) || !inRoot(picks.referenceWav))
    return { ok: false, error: 'Picked files must come from the dropped folder — re-scan it.' };
  const installed = installVoicePack(root, picks, {
    ttsDir: join(paths.userData, 'tts'),
    envFile: paths.envFile,
    promptText: asStr(raw?.['promptText']),
    promptLang: asStr(raw?.['promptLang']),
    textLang: asStr(raw?.['textLang']),
  });
  if (!installed.ok || !installed.packDir || !installed.gptCkpt || !installed.sovitsPth) return installed;

  // v0.37.3 (managed): generate the yaml against the MANAGED checkout and hot-swap the voice child —
  // no runtime picker, no copy-paste command. Not managed → the legacy BYO command path below.
  const envNow = freshUserEnv(paths);
  if (envNow['LUNA_TTS_MANAGED'] === '1') {
    const co = resolveManagedCheckout(envNow, { userData: paths.userData });
    if (co) {
      const managedYaml = join(installed.packDir, 'tts_infer.runtime.yaml');
      writeFileSync(
        managedYaml,
        generateTtsYaml({ checkout: co.checkout, gptCkpt: installed.gptCkpt, sovitsPth: installed.sovitsPth }),
      );
      const rt = resolveManagedRuntime(envNow, { userData: paths.userData });
      if (rt) {
        const ready = await swapManagedTts(rt);
        // v0.37.15 (audit): the renderer built its audio sink from LUNA_TTS_BACKEND at load. Arming
        // MANAGED + starting api_v2 is invisible to a window still on the browser voice — the cloned
        // voice runs but nothing plays it, while packDrop cheerfully says "✓ Voice swapped". Switch
        // the backend and reload the running (non-setup) windows so they rebuild as the http sink.
        writeFileSync(paths.envFile, mergeEnvFile(readFileSync(paths.envFile, 'utf8'), { LUNA_TTS_BACKEND: 'http' }));
        reloadAppWindows();
        return { ok: true, refAudio: installed.refAudio, managed: true, ready };
      }
    }
    // Managed but no launchable runtime yet (provision mid-flight / gone): the weights + env are in;
    // the provision flow's copy tells the order. Deliberately no command in managed mode.
    return { ok: true, refAudio: installed.refAudio, managed: true, ready: false };
  }

  // With a validated GPT-SoVITS checkout we can produce the exact runtime config + launch command
  // (the reference-instance form). Without one, the weights are installed and luna.env is set —
  // the user picks the runtime later and re-installs to get the command.
  const runtimeDir = asStr(raw?.['runtimeDir']);
  let command: string | undefined;
  let yamlPath: string | undefined;
  if (runtimeDir !== '') {
    const check = validateRuntimeDir(runtimeDir);
    if (!check.ok) return { ok: false, error: check.error };
    yamlPath = join(installed.packDir, 'tts_infer.runtime.yaml');
    writeFileSync(
      yamlPath,
      generateTtsYaml({ checkout: runtimeDir, gptCkpt: installed.gptCkpt, sovitsPth: installed.sovitsPth }),
    );
    command = startCommand({ checkout: runtimeDir, yamlPath, ...(check.venvPython ? { venvPython: check.venvPython } : {}) });
    writeFileSync(
      paths.envFile,
      mergeEnvFile(readFileSync(paths.envFile, 'utf8'), { LUNA_TTS_RUNTIME_DIR: runtimeDir }),
    );
  }
  return { ok: true, refAudio: installed.refAudio, command, yamlPath };
});

// v0.37.12: write the runtime yaml for every installed pack that has none, then start the voice.
// Called when provisioning completes, because a pack installed before the runtime existed left only
// its weights behind — no yaml, hence no launchable runtime, hence no voice, with nothing to tell
// the user why.
async function adoptInstalledPacks(p: Paths): Promise<void> {
  const env = freshUserEnv(p);
  const co = resolveManagedCheckout(env, { userData: p.userData });
  if (!co) return;
  const ttsDir = join(p.userData, 'tts');
  if (!existsSync(ttsDir)) return;
  for (const entry of readdirSync(ttsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'runtime' || entry.name === 'downloads') continue;
    const packDir = join(ttsDir, entry.name);
    const yamlPath = join(packDir, 'tts_infer.runtime.yaml');
    if (existsSync(yamlPath)) continue; // already adopted
    const gptCkpt = firstFileByExt(join(packDir, 'GPT'), '.ckpt');
    const sovitsPth = firstFileByExt(join(packDir, 'SoVITS'), '.pth');
    if (!gptCkpt || !sovitsPth) continue;
    writeFileSync(yamlPath, generateTtsYaml({ checkout: co.checkout, gptCkpt, sovitsPth }));
    console.log(`[luna-desktop] adopted the voice pack installed before the runtime: ${entry.name}`);
  }
  const rt = resolveManagedRuntime(freshUserEnv(p), { userData: p.userData });
  if (rt) await swapManagedTts(rt);
}

function firstFileByExt(dir: string, ext: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const f = pickWeight(readdirSync(dir), ext);
  return f ? join(dir, f) : undefined;
}

// v0.37.8: what is already configured, so "Re-run setup" preserves it instead of overwriting it
// with the stock defaults. Secret VALUES never cross the bridge — only their key names do.
ipcMain.handle('luna:wizard-prefill', () => {
  if (!paths) return { values: {}, configured: [] };
  return wizardPrefill(parseEnvFile(readFileSync(paths.envFile, 'utf8')));
});

// v0.37.2 (标准 1): the one-click GPT-SoVITS installer. Start kicks (or resumes — the engine skips
// complete artifacts and finishes .part files) and returns immediately; the wizard polls status.
ipcMain.handle('luna:provision-status', () => {
  if (paths) hydrateProvisionStatus(paths);
  return { ...provisionStatus, inFlight: provisionInFlight };
});
ipcMain.handle('luna:provision-start', () => {
  if (!paths) return { ok: false, error: 'Not ready — try again in a moment.' };
  const p = paths;
  const env = freshUserEnv(p);
  // v0.37.9: ON by default. A one-click install that first needs you to hand-edit a config file is
  // not one-click — it is the terminal step this initiative exists to delete, wearing a disguise.
  // LUNA_TTS_PROVISION=0 is the opt-OUT.
  if (env['LUNA_TTS_PROVISION'] === '0') return { ok: false, error: 'One-click deploy is disabled (LUNA_TTS_PROVISION=0).' };
  if (provisionInFlight) return { ok: true };
  provisionInFlight = true;
  const ttsDir = join(p.userData, 'tts');
  const dirs = { ttsDir, runtimeDir: join(ttsDir, 'runtime'), downloadsDir: join(ttsDir, 'downloads') };
  const mirror = (env['LUNA_TTS_HF_MIRROR'] ?? '').trim();
  const manifest = buildManifest({ platform: process.platform, ...(mirror !== '' ? { hfBase: mirror } : {}) });
  void runProvision(dirs, manifest, realSeams(), (s) => {
    provisionStatus = s;
  })
    .then((final) => {
      provisionStatus = final;
      if (final.stage === 'ready') {
        // Arm managed mode so the FIRST pack drop can spawn the voice. The backend deliberately stays
        // browser until a pack lands — a runtime with no pack has no timbre to speak with (Open Q4).
        writeFileSync(p.envFile, mergeEnvFile(readFileSync(p.envFile, 'utf8'), { LUNA_TTS_MANAGED: '1' }));
        // v0.37.12: the drop-zone sits right next to the deploy button, so a pack is very often
        // installed BEFORE the runtime exists. Its yaml could not be written then (there was no
        // checkout to point at) — and nothing ever wrote it afterwards, so the voice would never
        // start, silently, forever. Adopt any already-installed pack now that a runtime exists.
        void adoptInstalledPacks(p);
      }
    })
    .finally(() => {
      provisionInFlight = false;
    });
  return { ok: true };
});

async function smokeProbe(win: BrowserWindow): Promise<void> {
  await new Promise((r) => setTimeout(r, 6000));
  const probe = (await win.webContents.executeJavaScript(
    `(() => {
      // v0.27.1: open the settings panel so we can assert the server-driven rows + the pet toggle
      // actually rendered inside the packaged shell (the desktop-specific wiring a page probe misses).
      document.querySelector('.settings-panel')?.classList.add('on');
      const petInput = [...document.querySelectorAll('.settings-panel label')]
        .find((l) => l.textContent.includes('Desktop pet'))?.querySelector('input');
      return JSON.stringify({
        canvas: !!document.querySelector('.model-stage canvas'),
        placeholder: !!document.querySelector('.model-placeholder'),
        headX: document.querySelector('.model-stage')?.style.getPropertyValue('--luna-head-x') || null,
        wsStatus: document.querySelector('.status-badge')?.dataset.status || null,
        pet: document.body.classList.contains('pet'),
        bodyBgImage: getComputedStyle(document.body).backgroundImage,
        collapsed: !!document.querySelector('.luna-app.collapsed'),
        bridgeSetPetMode: typeof window.lunaPet?.setPetMode,
        petRowVisible: petInput ? getComputedStyle(petInput.closest('label')).display !== 'none' : false,
        serverRows: document.querySelectorAll('.server-settings .setting-row').length,
        // v0.28.6: manual drag bridge (replaced -webkit-app-region, which ate every click) — the
        // pet go/no-go asserts the drag surface exists AND no drag region hijacks the DOM.
        bridgeDrag: typeof window.lunaPet?.dragStart,
        noAppRegion: getComputedStyle(document.querySelector('.model-stage')).getPropertyValue('-webkit-app-region') !== 'drag',
      });
    })()`,
  )) as string;
  const p = JSON.parse(probe) as {
    canvas: boolean;
    placeholder: boolean;
    headX: string | null;
    wsStatus: string | null;
    pet: boolean;
    bodyBgImage: string;
    bridgeSetPetMode: string;
    petRowVisible: boolean;
    serverRows: number;
    bridgeDrag: string;
    noAppRegion: boolean;
  };
  const shotPath = process.env['LUNA_SMOKE_OUT'];
  if (shotPath) {
    await new Promise((r) => setTimeout(r, 500)); // let the v0.36.4 settings panel finish gliding in (--m-soft)
    const shot = await win.webContents.capturePage();
    writeFileSync(shotPath, shot.toPNG());
  }
  // The packaged go/no-go: rendering alive AND the WS actually connected to the spawned sidecar.
  // In pet mode additionally: the pet class landed, the striped room is gone (transparent body),
  // the window is RESIZABLE, and her body is a drag region while the bar is not (v0.28.2).
  const petWindowOk =
    !petMode || (win.isResizable() && p.bridgeDrag === 'function' && p.noAppRegion);
  const petOk = !petMode || (p.pet && p.bodyBgImage === 'none' && petWindowOk);
  // v0.27.2: the preload bridge must be live (setPetMode exposed → the pet toggle row renders).
  // This is exactly the check that would have caught the __dirname preload-path bug earlier.
  const bridgeOk = p.bridgeSetPetMode === 'function' && p.petRowVisible;
  // No model ships by default (OSS), so the stage is two-tier: a bare boot showing the empty-state
  // placeholder PASSES; the head-anchor render check only applies WHEN a model actually mounted a
  // canvas. (The WS + pet + bridge checks always hold — they prove the packaged shell wired up.)
  const rendered = p.canvas && p.headX !== null;
  const stageOk = rendered || (!p.canvas && p.placeholder);
  const ok = stageOk && p.wsStatus === 'open' && petOk && bridgeOk;
  console.log(JSON.stringify({ ok, rendered, ...p }));
  supervisor?.stop();
  app.exit(ok ? 0 : 1);
}

void app.whenReady().then(async () => {
  const p = resolvePaths();
  paths = p;
  const userEnv = ensureUserConfig(p);
  installAppMenu(); // before any window — the ⌘, escape hatch must exist from the first frame

  // v0.33.0: our window loads ONLY Luna's own pinned-loopback bundle, so permission requests come
  // from trusted local content — grant them. Crucially geolocation, which Electron denies by
  // default, leaving the webview's navigator.geolocation → client.geo → weather path silently dead
  // on the desktop. Set before any window loads.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);

  // v0.33.0: the desktop webview has no browser GPS, so resolve a location from the Mac itself
  // (CoreLocationCLI → system timezone) and inject it as LUNA_LAT_LON before the sidecar spawns, so
  // weather mounts at boot. A manual luna.env value is respected (returns null). v0.37.17: the
  // accurate fix persists to LUNA_LAT_LON_AUTO — persisting into LUNA_LAT_LON itself made our own
  // cache read as a manual pin on the next boot, freezing the location after the first fix.
  const manualPin = parseLatLon(userEnv['LUNA_LAT_LON'] ?? '') != null;
  const loc = resolveDesktopLocation(userEnv);
  if (loc) {
    userEnv['LUNA_LAT_LON'] = formatLatLon(loc);
    console.log(`[luna-desktop] location ${userEnv['LUNA_LAT_LON']} (via ${loc.source})`);
    if (loc.persist) {
      try {
        writeFileSync(
          p.envFile,
          mergeEnvFile(readFileSync(p.envFile, 'utf8'), { LUNA_LAT_LON_AUTO: userEnv['LUNA_LAT_LON'] }),
        );
      } catch (e) {
        console.warn('[luna-desktop] could not persist location to luna.env:', e);
      }
    }
  }

  // v0.37.17: keep the location LIVE while the app runs. Every 10 minutes re-ask CoreLocation
  // (async — the sync exec would freeze all windows for up to 3s); a real move (>~55 m) is pushed
  // to every window, whose renderer forwards it over its WS as client.geo — the server's runtime
  // location beats the env fallback, so weather follows the machine without a restart. Never runs
  // over a manual pin (the operator's word stays final).
  if (!manualPin && process.platform === 'darwin') {
    let lastFix: LatLon | null = loc && loc.source !== 'timezone' ? { lat: loc.lat, lon: loc.lon } : null;
    setInterval(() => {
      void coreLocationFixAsync().then((fix) => {
        if (!fix || !movedBeyond(lastFix, fix)) return;
        lastFix = fix;
        const s = formatLatLon(fix);
        console.log(`[luna-desktop] location moved → ${s}`);
        for (const w of BrowserWindow.getAllWindows()) w.webContents.send('luna:geo-fix', fix);
        try {
          writeFileSync(p.envFile, mergeEnvFile(readFileSync(p.envFile, 'utf8'), { LUNA_LAT_LON_AUTO: s }));
        } catch {
          // best-effort cache — the push above already delivered the fix
        }
      });
    }, 600_000).unref();
  }

  if (userEnv['LUNA_PET_MODE'] === '1') petMode = true;
  const shell = readShellSettings(p.userData);
  if (typeof shell.petMode === 'boolean') petMode = shell.petMode;
  // Voice is bring-your-own: the static host forwards /api/tts/* to a GPT-SoVITS api_v2 backend. The
  // upstream config lives in luna.env — NOT in this process's process.env (the v0.34.15 lesson) — so
  // it's threaded in as a per-request GETTER (v0.35.3): a wizard voice-pack install or a hand edit
  // applies on the very next /api/tts call, no host restart. Unset → the forward 502s and the app
  // runs voiceless / with browser voice. It also serves any picker-installed model from userData/models.
  startWebHost(
    p.webDist,
    DESKTOP_WEB_PORT,
    () => readTtsEnv({ ...process.env, ...parseEnvFile(readFileSync(p.envFile, 'utf8')) }),
    p.userModelsDir,
    () => (ttsSupervisor ? ttsProcState : null),
  );
  supervisor = createSupervisor({
    command: p.serverBin,
    env: sidecarEnv(p, userEnv),
    onEvent: (e) => console.log(`[luna-desktop] sidecar: ${e}`),
  });

  // v0.28.8: is a backend already listening on the canonical port (e.g. `bun run dev`)? If so, ATTACH
  // — our window becomes another client of that one Luna. We spawn no sidecar, and skip onboarding (the
  // running server already holds the keys); the static host above still serves our own frontend and
  // forwards /api/tts to the configured api_v2 backend. The renderer connects to `?ws=${SERVER_PORT}`
  // either way, so both paths land on the same backend + DB.
  const attached = shouldAttach({ portListening: await waitForPort(SERVER_PORT, 800), smoke: SMOKE });
  const dev = SMOKE ? null : resolveDevLauncher({ repoRoot: REPO_ROOT, env: process.env });
  // v0.35.5: ONE boot-mode decision, with SETUP ahead of the dev launcher. Before this, any machine
  // where the app was built from a still-present checkout (i.e. every `bun run app` user) took the
  // dev branch first and NEVER saw onboarding — a fresh clone booted a keyless dev stack instead of
  // the wizard. Precedence: attach → setup → dev → sidecar (pure, tested in backend.test.ts).
  const mode = resolveBootMode({
    attached,
    needsOnboarding: needsOnboarding(userEnv),
    smoke: SMOKE,
    skipOnboarding: process.env['LUNA_SKIP_ONBOARDING'] === '1',
    devAvailable: dev !== null,
  });

  // v0.37.0: the managed voice child starts in every APP mode (attach/dev/sidecar) but never during
  // setup (no config to manage yet) and never under SMOKE. Non-blocking — the boot gate covers the
  // model-load wait on the web side.
  if (mode !== 'setup') void maybeStartManagedTts(p);

  if (mode === 'attach') {
    attachedToExternal = true;
    console.log(`[luna-desktop] attaching to existing backend on 127.0.0.1:${SERVER_PORT}`);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    return;
  }

  // v0.28.0: no real key yet → the setup screen (the wizard since v0.35.4) instead of the app, and
  // DON'T spawn a backend yet — the submit handler starts the sidecar once real keys land.
  if (mode === 'setup') {
    createWindow('setup');
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow('setup');
    });
    return;
  }

  // v0.28.9: keys exist and a source checkout + bun are present — launch the WHOLE dev stack
  // (`bun scripts/dev-all.ts` = server 8787 + web 5173) so one click brings everything up and the
  // browser shares this same Luna. LUNA_PROACTIVE follows luna.env (dev-all defaults it off).
  if (mode === 'dev' && dev) {
    console.log(`[luna-desktop] launching full dev stack: ${dev.bun} ${dev.script}`);
    supervisor = createSupervisor({
      command: dev.bun,
      args: [dev.script],
      cwd: dev.cwd,
      env: {
        ...(process.env as Record<string, string>),
        LUNA_PROACTIVE: userEnv['LUNA_PROACTIVE'] ?? '0',
        // v0.33.0: pass the Mac-resolved location through so the dev-all server also boots with it
        // (dev-all reads the repo .env, which usually has no LUNA_LAT_LON).
        ...(userEnv['LUNA_LAT_LON'] ? { LUNA_LAT_LON: userEnv['LUNA_LAT_LON'] } : {}),
      },
      onEvent: (e) => console.log(`[luna-desktop] dev-all: ${e}`),
    });
    supervisor.start();
    const up = await waitForPort(SERVER_PORT);
    if (!up) {
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        message: 'Luna\'s dev stack did not start',
        detail: `No response on 127.0.0.1:${SERVER_PORT}. Check that bun + the repo are present (or set LUNA_BUN_PATH in ${p.envFile}).`,
        buttons: ['Open Setup', 'Close'],
        defaultId: 0,
      });
      if (choice === 0) {
        openSetupWindow();
        return;
      }
    }
    createWindow(); // dev never runs under SMOKE (resolveBootMode caller), so no smoke probe here
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    return;
  }

  supervisor.start();
  const up = await waitForPort(SERVER_PORT);
  if (!up && !SMOKE) {
    // v0.35.6: the classic "bad config bricked the backend" moment — hand the user the way back
    // to the wizard right here instead of pointing at a file path.
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      message: 'Luna\'s server did not start',
      detail: `No response on 127.0.0.1:${SERVER_PORT}. Check ${p.envFile} and the logs — or re-run the setup wizard to fix the configuration.`,
      buttons: ['Open Setup', 'Close'],
      defaultId: 0,
    });
    if (choice === 0) {
      openSetupWindow();
      return;
    }
  }
  // v0.35.4: LUNA_SMOKE_SETUP probes the WIZARD in the packaged shell (fresh-machine E2E for the
  // default-on flip) instead of the app window. '1' = step 1; 'voice' = walk to the voice step.
  const setupMode = process.env['LUNA_SMOKE_SETUP'];
  const smokeSetup = SMOKE && (setupMode === '1' || setupMode === 'voice');
  const win = createWindow(smokeSetup ? 'setup' : 'app');
  if (SMOKE) void (smokeSetup ? smokeSetupProbe(win) : smokeProbe(win));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// The wizard go/no-go: the packaged setup window mounts the six-step wizard (default-on flag), the
// first step is the chat card, and the language toggle is live. Asserted from the real bundle.
// LUNA_SMOKE_SETUP=voice additionally walks to the voice step (http mode) before probing, and
// LUNA_SMOKE_OUT captures a PNG — the docs/README screenshots come from the real packaged wizard.
async function smokeSetupProbe(win: BrowserWindow): Promise<void> {
  await new Promise((r) => setTimeout(r, 4000));
  if (process.env['LUNA_SMOKE_SETUP'] === 'voice') {
    await win.webContents.executeJavaScript(
      `(() => {
        const click = (txt) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent === txt); if (b) b.click(); return !!b; };
        const key = [...document.querySelectorAll('input')].find(i => i.type === 'password');
        if (key) { key.value = 'sk-preview'; key.dispatchEvent(new Event('input')); }
        click('Next') || click('下一步');
        for (let i = 0; i < 4; i++) click('Skip') || click('跳过');
        const http = [...document.querySelectorAll('.wizard-radio-row input')].find(i => i.value === 'http');
        if (http) http.click();
      })()`,
    );
    await new Promise((r) => setTimeout(r, 600));
  }
  const probe = (await win.webContents.executeJavaScript(
    `(() => JSON.stringify({
      wizard: !!document.querySelector('.setup-card.wizard'),
      dots: document.querySelectorAll('.wizard-dot').length,
      step: document.querySelector('.wizard-step-title')?.textContent || null,
      guide: !!document.querySelector('.wizard-guide'),
      langBtn: !!document.querySelector('.setup-lang-btn'),
    }))()`,
  )) as string;
  const shotPath = process.env['LUNA_SMOKE_OUT'];
  if (shotPath) {
    const shot = await win.webContents.capturePage();
    writeFileSync(shotPath, shot.toPNG());
  }
  const p = JSON.parse(probe) as { wizard: boolean; dots: number; step: string | null; guide: boolean; langBtn: boolean };
  const ok = p.wizard && p.dots === 6 && !!p.step && p.guide && p.langBtn;
  console.log(JSON.stringify({ ok, ...p }));
  supervisor?.stop();
  app.exit(ok ? 0 : 1);
}

// Kill the sidecar on every exit path — an orphan luna-server would hold the port + the DB lock,
// and an orphan api_v2 would hold 9880 (v0.37.0: the managed voice child dies on the same paths).
app.on('before-quit', () => {
  supervisor?.stop();
  ttsSupervisor?.stop();
  killProvisioners(); // v0.37.15: don't orphan a pip/torch download mid-install
});
app.on('window-all-closed', () => {
  supervisor?.stop();
  ttsSupervisor?.stop();
  killProvisioners();
  app.quit();
});
