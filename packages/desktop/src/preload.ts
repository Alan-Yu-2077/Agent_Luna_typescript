import { contextBridge, ipcRenderer } from 'electron';

// v0.26.2: the pet-mode bridge — the renderer hit-tests the cursor (petHitTest.ts) and tells the
// shell whether the window should take the mouse or pass clicks through to the desktop. The only
// exposed surface; contextIsolation stays on.
contextBridge.exposeInMainWorld('lunaPet', {
  setIgnore: (ignore: boolean): void => {
    ipcRenderer.send('luna:set-ignore-mouse', ignore === true);
  },
  // v0.27.0: the settings-panel pet toggle — the shell persists the choice and rebuilds the window
  // (transparent/frame are creation-time-only options).
  setPetMode: (on: boolean): void => {
    ipcRenderer.send('luna:set-pet-mode', on === true);
  },
});
