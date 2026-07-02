import { app, BrowserWindow } from 'electron';
import { defaultDistDir, startWebHost, WEB_PORT } from './serve';

// v0.26.0 (Initiative 19): the minimal Electron shell — serve the web production build over the
// pinned loopback origin and open one plain window on it. The server on :8787 is still hand-started
// this version (v0.26.1 compiles + spawns it as a supervised sidecar); LUNA_WS_PORT points the shell
// at a different server for isolated testing. Plain window chrome — the transparent always-on-top
// pet window is v0.26.2.

const wsPort = process.env['LUNA_WS_PORT'] ?? '8787';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // A companion must keep animating when covered/hidden — the desktop research's sharpest
      // pet-specific failure mode, and reproduced live during Initiative 18's preview (a hidden tab
      // froze the pixi beat: breathing + the bubble head-anchor both dead until foregrounded).
      backgroundThrottling: false,
    },
  });
  void win.loadURL(`http://127.0.0.1:${WEB_PORT}/?ws=${wsPort}`);
}

void app.whenReady().then(() => {
  startWebHost(defaultDistDir(__dirname));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
