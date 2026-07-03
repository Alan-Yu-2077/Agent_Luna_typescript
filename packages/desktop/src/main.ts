import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDistDir, startWebHost, WEB_PORT } from './serve';
import { ENV_TEMPLATE, parseEnvFile } from './envfile';
import { readShellSettings, writeShellSettings } from './shellSettings';
import { classifyProbe, mergeEnvFile, needsOnboarding, type ProbeVerdict } from './onboarding';
import { petWindowOptions } from './petWindow';
import { createSupervisor, waitForPort, type Supervisor } from './supervisor';
import { resolveTtsConfig, ttsProxyScript, type TtsConfig } from './tts';

// v0.26.1 (Initiative 19): the single-machine app. The shell OWNS the whole runtime: it reads the
// user's keys from app-data (never the bundle), spawns the compiled luna-server sidecar against an
// app-data SQLite, serves the web build on the pinned loopback origin, waits for the server port,
// opens the window — and kills the sidecar on quit. LUNA_SMOKE=1 runs the same flow headless
// (hidden window + DOM probe + exit code) so the packaged app is verifiable without a desktop.

// The desktop app's own server port — deliberately NOT 8787, so a dev instance and the app coexist.
const SERVER_PORT = Number(process.env['LUNA_DESKTOP_WS_PORT'] ?? 8790);
const SMOKE = process.env['LUNA_SMOKE'] === '1';
// v0.26.2: pet mode — transparent, frameless, always-on-top, region click-through. v0.27.0: the
// settings-panel toggle (persisted in settings.json) is the authority once used; LUNA_PET_MODE in
// luna.env / the env is only the initial default. Windowed mode stays the fallback.
let petMode = process.env['LUNA_PET_MODE'] === '1';

type Paths = {
  userData: string;
  db: string;
  envFile: string;
  serverBin: string;
  migrationsDir: string;
  personaFile: string;
  webDist: string;
};

function resolvePaths(): Paths {
  const userData = app.getPath('userData');
  // Dev (electron . from packages/desktop): resources live in the repo. Packaged: in resourcesPath.
  const res = app.isPackaged ? process.resourcesPath : join(__dirname, '..');
  const repo = join(__dirname, '..', '..');
  return {
    userData,
    db: join(userData, 'luna.sqlite'),
    envFile: join(userData, 'luna.env'),
    serverBin: app.isPackaged ? join(res, 'luna-server') : join(res, 'bin', 'luna-server'),
    migrationsDir: app.isPackaged
      ? join(res, 'migrations')
      : join(repo, 'server', 'src', 'migrations'),
    personaFile: app.isPackaged
      ? join(res, 'persona', 'default.md')
      : join(repo, 'server', 'persona', 'default.md'),
    webDist: app.isPackaged ? join(res, 'web') : defaultDistDir(__dirname),
  };
}

// First run: write the key template so luna.env documents every field for power users. v0.28.0:
// the blocking "go edit a file, then restart" dialog is gone — the setup screen (below) collects
// the keys instead. The app still boots either way; no secret ever ships in the bundle.
function ensureUserConfig(p: Paths): Record<string, string> {
  mkdirSync(p.userData, { recursive: true });
  if (!existsSync(p.envFile)) writeFileSync(p.envFile, ENV_TEMPLATE);
  return parseEnvFile(readFileSync(p.envFile, 'utf8'));
}

function sidecarEnv(p: Paths, userEnv: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {
    // PATH etc. for the child; the user's keys OVERRIDE inherited vars, never the reverse.
    ...(process.env as Record<string, string>),
    ...userEnv,
    LUNA_PORT: String(SERVER_PORT),
    LUNA_DB_PATH: p.db,
    LUNA_MIGRATIONS_DIR: p.migrationsDir,
    LUNA_PERSONA_PATH: p.personaFile,
  };
  // First-run degradation is the SHELL's job: an empty key would throw in the SDK constructor and
  // crash-loop the sidecar. A placeholder lets the app boot (yumi renders, the window explains);
  // turns fail politely until the real key lands in luna.env.
  if (!env['ANTHROPIC_API_KEY']) env['ANTHROPIC_API_KEY'] = 'sk-not-configured';
  // The smoke must exit promptly: the graceful shutdown dream (SIGTERM → up to 120s of memory
  // consolidation) would hold the inherited stdout pipe open long after app.exit.
  if (SMOKE) env['LUNA_SHUTDOWN_DREAM'] = '0';
  return env;
}

let supervisor: Supervisor | null = null;
let paths: Paths | null = null;
// v0.28.6: the local GPT-SoVITS proxy, spawned as a second supervised sidecar when the module is
// present. Non-critical — a missing proxy just means muted, so we never block the app on it.
let ttsSupervisor: Supervisor | null = null;
let ttsCfg: TtsConfig | null = null;
let ttsProxyPath = '';

// Bun inlines __dirname as the SOURCE dir (packages/desktop/src) at compile time (see the preload
// note below), so the repo root — where scripts/ and the sibling Agent_Luna/TTS live — is three up.
// In a packaged app these paths don't exist; resolveTtsConfig's availability probe degrades to muted.
const REPO_ROOT = join(__dirname, '..', '..', '..');

// Spawn the TTS proxy via Electron-as-node (ELECTRON_RUN_AS_NODE) so we don't depend on `bun` being
// on PATH in a packaged app — tts-proxy.cjs is plain CJS. Idempotent + guarded; a no-op under SMOKE
// (the smoke must exit fast and never load a 5GB model) or when the proxy/module isn't present.
function maybeStartTts(): void {
  if (SMOKE || ttsSupervisor || !ttsCfg?.available || !existsSync(ttsProxyPath)) return;
  ttsSupervisor = createSupervisor({
    command: process.execPath,
    args: [ttsProxyPath],
    env: {
      ...(process.env as Record<string, string>),
      ELECTRON_RUN_AS_NODE: '1',
      LUNA_TTS_DIR: ttsCfg.dir,
      LUNA_TTS_PORT: String(ttsCfg.port),
    },
    onEvent: (e) => console.log(`[luna-desktop] tts: ${e}`),
  });
  ttsSupervisor.start();
}
// v0.28.3: serialize onboarding submits — ipcMain.handle does NOT serialize concurrent awaits, so a
// double-invoke (DevTools, or a fast double-click that beats setBusy) could double-restart the
// sidecar + build two app windows. The renderer disables its buttons; this is the belt.
let onboardingInFlight = false;

function createWindow(mode: 'app' | 'setup' = 'app'): BrowserWindow {
  // The setup screen is always a normal window (a transparent/frameless pet window makes no sense
  // for a form) — pet framing only applies to the actual app.
  const usePet = petMode && mode !== 'setup';
  const win = new BrowserWindow({
    width: usePet ? 560 : 1280,
    height: usePet ? 900 : 860,
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
      ? `http://127.0.0.1:${WEB_PORT}/?setup=1`
      : `http://127.0.0.1:${WEB_PORT}/?ws=${SERVER_PORT}${usePet ? '&pet=1' : ''}`;
  void win.loadURL(url);
  return win;
}

ipcMain.on('luna:set-ignore-mouse', (event, ignore: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore === true, { forward: true });
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
    maybeStartTts();
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
        headX: document.querySelector('.model-stage')?.style.getPropertyValue('--luna-head-x') || null,
        wsStatus: document.querySelector('.status-badge')?.dataset.status || null,
        pet: document.body.classList.contains('pet'),
        bodyBgImage: getComputedStyle(document.body).backgroundImage,
        collapsed: !!document.querySelector('.luna-app.collapsed'),
        bridgeSetPetMode: typeof window.lunaPet?.setPetMode,
        petRowVisible: petInput ? getComputedStyle(petInput.closest('label')).display !== 'none' : false,
        serverRows: document.querySelectorAll('.server-settings .setting-row').length,
        // v0.28.2: her body is a window-drag region; the input bar opts back out.
        modelDrag: getComputedStyle(document.querySelector('.model-stage')).getPropertyValue('-webkit-app-region'),
        barNoDrag: getComputedStyle(document.querySelector('.chat-input-row')).getPropertyValue('-webkit-app-region'),
      });
    })()`,
  )) as string;
  const p = JSON.parse(probe) as {
    canvas: boolean;
    headX: string | null;
    wsStatus: string | null;
    pet: boolean;
    bodyBgImage: string;
    bridgeSetPetMode: string;
    petRowVisible: boolean;
    serverRows: number;
    modelDrag: string;
    barNoDrag: string;
  };
  const shotPath = process.env['LUNA_SMOKE_OUT'];
  if (shotPath) {
    await new Promise((r) => setTimeout(r, 200)); // let the just-opened settings panel paint
    const shot = await win.webContents.capturePage();
    writeFileSync(shotPath, shot.toPNG());
  }
  // The packaged go/no-go: rendering alive AND the WS actually connected to the spawned sidecar.
  // In pet mode additionally: the pet class landed, the striped room is gone (transparent body),
  // the window is RESIZABLE, and her body is a drag region while the bar is not (v0.28.2).
  const petWindowOk =
    !petMode || (win.isResizable() && p.modelDrag === 'drag' && p.barNoDrag === 'no-drag');
  const petOk = !petMode || (p.pet && p.bodyBgImage === 'none' && petWindowOk);
  // v0.27.2: the preload bridge must be live (setPetMode exposed → the pet toggle row renders).
  // This is exactly the check that would have caught the __dirname preload-path bug earlier.
  const bridgeOk = p.bridgeSetPetMode === 'function' && p.petRowVisible;
  const ok = p.canvas && p.headX !== null && p.wsStatus === 'open' && petOk && bridgeOk;
  console.log(JSON.stringify({ ok, ...p }));
  supervisor?.stop();
  ttsSupervisor?.stop();
  app.exit(ok ? 0 : 1);
}

void app.whenReady().then(async () => {
  const p = resolvePaths();
  paths = p;
  const userEnv = ensureUserConfig(p);
  if (userEnv['LUNA_PET_MODE'] === '1') petMode = true;
  const shell = readShellSettings(p.userData);
  if (typeof shell.petMode === 'boolean') petMode = shell.petMode;
  ttsCfg = resolveTtsConfig(process.env, REPO_ROOT);
  ttsProxyPath = ttsProxyScript(REPO_ROOT);
  startWebHost(p.webDist, WEB_PORT, ttsCfg.available ? ttsCfg.upstream : undefined);
  supervisor = createSupervisor({
    command: p.serverBin,
    env: sidecarEnv(p, userEnv),
    onEvent: (e) => console.log(`[luna-desktop] sidecar: ${e}`),
  });

  // v0.28.0: first run with no real key → show the setup screen instead of the app, and DON'T spawn
  // the sidecar yet (the submit handler starts it once real keys land). SMOKE + LUNA_SKIP_ONBOARDING
  // bypass the gate (the smoke's placeholder key must reach the app, not the form).
  const onboard =
    needsOnboarding(userEnv) && !SMOKE && process.env['LUNA_SKIP_ONBOARDING'] !== '1';
  if (onboard) {
    createWindow('setup');
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow('setup');
    });
    return;
  }

  supervisor.start();
  maybeStartTts();
  const up = await waitForPort(SERVER_PORT);
  if (!up && !SMOKE) {
    dialog.showMessageBoxSync({
      type: 'warning',
      message: 'Luna\'s server did not start',
      detail: `No response on 127.0.0.1:${SERVER_PORT}. Check ${p.envFile} and the logs.`,
    });
  }
  const win = createWindow();
  if (SMOKE) void smokeProbe(win);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Kill the sidecars on every exit path — an orphan luna-server would hold the port + the DB lock,
// an orphan TTS proxy would hold its port + the GPT-SoVITS backend.
app.on('before-quit', () => {
  supervisor?.stop();
  ttsSupervisor?.stop();
});
app.on('window-all-closed', () => {
  supervisor?.stop();
  ttsSupervisor?.stop();
  app.quit();
});
