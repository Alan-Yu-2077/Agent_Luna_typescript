import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDistDir, startWebHost, WEB_PORT } from './serve';
import { ENV_TEMPLATE, parseEnvFile } from './envfile';
import { createSupervisor, waitForPort, type Supervisor } from './supervisor';

// v0.26.1 (Initiative 19): the single-machine app. The shell OWNS the whole runtime: it reads the
// user's keys from app-data (never the bundle), spawns the compiled luna-server sidecar against an
// app-data SQLite, serves the web build on the pinned loopback origin, waits for the server port,
// opens the window — and kills the sidecar on quit. LUNA_SMOKE=1 runs the same flow headless
// (hidden window + DOM probe + exit code) so the packaged app is verifiable without a desktop.

// The desktop app's own server port — deliberately NOT 8787, so a dev instance and the app coexist.
const SERVER_PORT = Number(process.env['LUNA_DESKTOP_WS_PORT'] ?? 8790);
const SMOKE = process.env['LUNA_SMOKE'] === '1';
// v0.26.2: pet mode — transparent, frameless, always-on-top, region click-through. Toggled by
// LUNA_PET_MODE=1 in luna.env (or the env); the windowed mode stays the default + the fallback.
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

// First run: write the key template and point the user at it. The app still boots (yumi renders);
// turns fail until the keys are filled — no secret ever ships in the bundle.
function ensureUserConfig(p: Paths): Record<string, string> {
  mkdirSync(p.userData, { recursive: true });
  if (!existsSync(p.envFile)) {
    writeFileSync(p.envFile, ENV_TEMPLATE);
    if (!SMOKE) {
      dialog.showMessageBoxSync({
        type: 'info',
        message: 'Welcome to Luna',
        detail: `First run: fill in your API keys, then restart Luna.\n\n${p.envFile}`,
      });
    }
  }
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

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: petMode ? 560 : 1280,
    height: petMode ? 900 : 860,
    show: !SMOKE,
    // Pet mode: she floats over the desktop — transparent, frameless, shadowless, always on top.
    ...(petMode ? { transparent: true, frame: false, hasShadow: false, alwaysOnTop: true } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // A companion must keep animating when covered/hidden — the pet failure mode reproduced live
      // during Initiative 18's preview (a hidden tab froze the pixi beat).
      backgroundThrottling: false,
    },
  });
  if (petMode) {
    win.setAlwaysOnTop(true, 'floating');
    // Start pass-through; the renderer's hit-test (petHitTest.ts) opts the window back in whenever
    // the cursor is over her body / the bar. forward:true keeps mousemove flowing while ignoring.
    win.setIgnoreMouseEvents(true, { forward: true });
  }
  void win.loadURL(`http://127.0.0.1:${WEB_PORT}/?ws=${SERVER_PORT}${petMode ? '&pet=1' : ''}`);
  return win;
}

ipcMain.on('luna:set-ignore-mouse', (event, ignore: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore === true, { forward: true });
});

async function smokeProbe(win: BrowserWindow): Promise<void> {
  await new Promise((r) => setTimeout(r, 6000));
  const probe = (await win.webContents.executeJavaScript(
    `JSON.stringify({
      canvas: !!document.querySelector('.model-stage canvas'),
      headX: document.querySelector('.model-stage')?.style.getPropertyValue('--luna-head-x') || null,
      wsStatus: document.querySelector('.status-badge')?.dataset.status || null,
      pet: document.body.classList.contains('pet'),
      bodyBgImage: getComputedStyle(document.body).backgroundImage,
      collapsed: !!document.querySelector('.luna-app.collapsed'),
    })`,
  )) as string;
  const p = JSON.parse(probe) as {
    canvas: boolean;
    headX: string | null;
    wsStatus: string | null;
    pet: boolean;
    bodyBgImage: string;
  };
  const shotPath = process.env['LUNA_SMOKE_OUT'];
  if (shotPath) {
    const shot = await win.webContents.capturePage();
    writeFileSync(shotPath, shot.toPNG());
  }
  // The packaged go/no-go: rendering alive AND the WS actually connected to the spawned sidecar.
  // In pet mode additionally: the pet class landed and the striped room is gone (transparent body).
  const petOk = !petMode || (p.pet && p.bodyBgImage === 'none');
  const ok = p.canvas && p.headX !== null && p.wsStatus === 'open' && petOk;
  console.log(JSON.stringify({ ok, ...p }));
  supervisor?.stop();
  app.exit(ok ? 0 : 1);
}

void app.whenReady().then(async () => {
  const p = resolvePaths();
  const userEnv = ensureUserConfig(p);
  if (userEnv['LUNA_PET_MODE'] === '1') petMode = true;
  startWebHost(p.webDist);
  supervisor = createSupervisor({
    command: p.serverBin,
    env: sidecarEnv(p, userEnv),
    onEvent: (e) => console.log(`[luna-desktop] sidecar: ${e}`),
  });
  supervisor.start();
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

// Kill the sidecar on every exit path — an orphan would hold the port + the DB lock.
app.on('before-quit', () => supervisor?.stop());
app.on('window-all-closed', () => {
  supervisor?.stop();
  app.quit();
});
