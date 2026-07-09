import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { defaultDistDir, startWebHost, WEB_PORT } from './serve';
import { ENV_TEMPLATE, parseEnvFile } from './envfile';
import { readShellSettings, writeShellSettings } from './shellSettings';
import { classifyProbe, mergeEnvFile, needsOnboarding, type ProbeVerdict } from './onboarding';
import { formatLatLon, resolveDesktopLocation } from './location';
import { createPetDrag, type PetDrag } from './petDrag';
import { petWindowOptions } from './petWindow';
import { createSupervisor, waitForPort, type Supervisor } from './supervisor';
import { resolveDevLauncher, resolveSidecarDb, shouldAttach } from './backend';

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
// v0.26.2: pet mode — transparent, frameless, always-on-top, region click-through. v0.27.0: the
// settings-panel toggle (persisted in settings.json) is the authority once used; LUNA_PET_MODE in
// luna.env / the env is only the initial default. Windowed mode stays the fallback.
let petMode = process.env['LUNA_PET_MODE'] === '1';

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
    serverBin: app.isPackaged ? join(res, 'luna-server') : join(res, 'bin', 'luna-server'),
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

// "Choose model folder…": pick a Live2D model dir, verify it has a *.model3.json, copy it into
// userData/models, persist LUNA_MODEL_URL, and reload so the preload re-injects window.lunaConfig.
ipcMain.handle('luna:choose-model', async (): Promise<{ ok: boolean; modelUrl?: string; error?: string }> => {
  if (!paths) return { ok: false, error: 'Not ready — try again in a moment.' };
  const picked = dialog.showOpenDialogSync({
    title: 'Choose a Live2D model folder',
    properties: ['openDirectory'],
  });
  const src = picked?.[0];
  if (!src) return { ok: false, error: 'cancelled' };
  const manifest = readdirSync(src).find((f) => f.endsWith('.model3.json'));
  if (!manifest) return { ok: false, error: 'No .model3.json found in that folder.' };
  const name = basename(src);
  cpSync(src, join(paths.userModelsDir, name), { recursive: true });
  const modelUrl = `/models/${name}/${manifest}`;
  writeFileSync(paths.envFile, mergeEnvFile(readFileSync(paths.envFile, 'utf8'), { LUNA_MODEL_URL: modelUrl }));
  for (const w of BrowserWindow.getAllWindows()) w.reload(); // re-inject lunaConfig → the model renders
  return { ok: true, modelUrl };
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
    await new Promise((r) => setTimeout(r, 200)); // let the just-opened settings panel paint
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

  // v0.33.0: our window loads ONLY Luna's own pinned-loopback bundle, so permission requests come
  // from trusted local content — grant them. Crucially geolocation, which Electron denies by
  // default, leaving the webview's navigator.geolocation → client.geo → weather path silently dead
  // on the desktop. Set before any window loads.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);

  // v0.33.0: the desktop webview has no browser GPS, so resolve a location from the Mac itself
  // (CoreLocationCLI → system timezone) and inject it as LUNA_LAT_LON before the sidecar spawns, so
  // weather mounts at boot. A manual luna.env value is respected (returns null); an accurate
  // CoreLocation fix is persisted so it sticks + shows in the settings panel.
  const loc = resolveDesktopLocation(userEnv);
  if (loc) {
    userEnv['LUNA_LAT_LON'] = formatLatLon(loc);
    console.log(`[luna-desktop] location ${userEnv['LUNA_LAT_LON']} (via ${loc.source})`);
    if (loc.persist) {
      try {
        writeFileSync(
          p.envFile,
          mergeEnvFile(readFileSync(p.envFile, 'utf8'), { LUNA_LAT_LON: userEnv['LUNA_LAT_LON'] }),
        );
      } catch (e) {
        console.warn('[luna-desktop] could not persist location to luna.env:', e);
      }
    }
  }

  if (userEnv['LUNA_PET_MODE'] === '1') petMode = true;
  const shell = readShellSettings(p.userData);
  if (typeof shell.petMode === 'boolean') petMode = shell.petMode;
  // Voice is bring-your-own: the static host forwards /api/tts/* to a GPT-SoVITS api_v2 backend read
  // from env (LUNA_TTS_URL). Unset → the forward 502s and the app runs voiceless / with browser voice.
  // It also serves any picker-installed model from userData/models (undefined ttsEnv → env default).
  startWebHost(p.webDist, WEB_PORT, undefined, p.userModelsDir);
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
  if (attached) {
    console.log(`[luna-desktop] attaching to existing backend on 127.0.0.1:${SERVER_PORT}`);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    return;
  }

  // v0.28.9: nothing is up — start the backend ourselves. On a source checkout with bun reachable,
  // launch the WHOLE dev stack (`bun scripts/dev-all.ts` = server 8787 + web 5173) so one click brings
  // everything up and the browser shares this same Luna. dev-all reads the repo `.env` for keys, so we
  // skip onboarding here; LUNA_PROACTIVE follows luna.env (dev-all defaults it off). SMOKE + no-bun/
  // no-repo fall through to the self-contained sidecar.
  const dev = SMOKE ? null : resolveDevLauncher({ repoRoot: REPO_ROOT, env: process.env });
  if (dev) {
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
      dialog.showMessageBoxSync({
        type: 'warning',
        message: 'Luna\'s dev stack did not start',
        detail: `No response on 127.0.0.1:${SERVER_PORT}. Check that bun + the repo are present (or set LUNA_BUN_PATH in ${p.envFile}).`,
      });
    }
    createWindow(); // dev never runs under SMOKE (see the guard above), so no smoke probe here
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    return;
  }

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

// Kill the sidecar on every exit path — an orphan luna-server would hold the port + the DB lock.
app.on('before-quit', () => {
  supervisor?.stop();
});
app.on('window-all-closed', () => {
  supervisor?.stop();
  app.quit();
});
