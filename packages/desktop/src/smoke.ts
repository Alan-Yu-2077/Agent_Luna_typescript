import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDistDir, startWebHost } from './serve';

// v0.26.0 (Initiative 19): the automated rendering go/no-go — does the WHOLE stack (dist bundle →
// loopback origin → pixi v7 WebGL → Cubism Core WASM → yumi) render inside Electron's Chromium?
// Runs a HIDDEN window (never pops on Alan's desktop) with backgroundThrottling OFF (a hidden
// window otherwise freezes rAF — the exact pet failure mode), pointed at a DEAD ws port (8899) so
// the smoke can never touch the stable server on :8787. Probes the DOM + captures a PNG, prints one
// JSON line, exits 0/1.

const SMOKE_PORT = 5178; // distinct from the app's pinned 5177 so a running app never collides
const OUT = process.env['LUNA_SMOKE_OUT'] ?? join(app.getPath('temp'), 'luna-desktop-smoke.png');

async function run(): Promise<void> {
  startWebHost(defaultDistDir(__dirname), SMOKE_PORT);
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  await win.loadURL(`http://127.0.0.1:${SMOKE_PORT}/?ws=8899`);
  // Boot gate (TTS probe 502s → ~900ms) + Live2D runtime + model load + a few render frames.
  await new Promise((r) => setTimeout(r, 6000));
  const probe = (await win.webContents.executeJavaScript(
    `JSON.stringify({
      app: !!document.querySelector('.luna-app'),
      canvas: !!document.querySelector('.model-stage canvas'),
      placeholderGone: !document.querySelector('.model-placeholder'),
      headX: document.querySelector('.model-stage')?.style.getPropertyValue('--luna-head-x') || null,
      collapseBtn: !!document.querySelector('.collapse-btn'),
      wsStatus: document.querySelector('.status-badge')?.dataset.status || null,
    })`,
  )) as string;
  const shot = await win.webContents.capturePage();
  writeFileSync(OUT, shot.toPNG());
  const p = JSON.parse(probe) as { canvas: boolean; placeholderGone: boolean; headX: string | null };
  // Rendering verdict: the pixi canvas mounted, the placeholder was replaced, and the per-frame
  // head-anchor beat is alive (it only gets set by a real beforeModelUpdate tick).
  const ok = p.canvas && p.placeholderGone && p.headX !== null;
  console.log(JSON.stringify({ ok, out: OUT, ...JSON.parse(probe) }));
  app.exit(ok ? 0 : 1);
}

void app.whenReady().then(() => {
  run().catch((e) => {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    app.exit(1);
  });
});
