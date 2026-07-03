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

// v0.28.0: the first-run setup bridge. The renderer collects base URL + key + model; the SHELL
// tests + writes them to luna.env and restarts the sidecar. The key rides one direction only — the
// verdict coming back carries {ok, error?}, never the key. Its presence also tells the renderer it
// is inside the desktop shell (a plain browser has no lunaSetup).
type SetupFields = { baseUrl: string; apiKey: string; model: string };
type SetupVerdict = { ok: boolean; error?: string };
contextBridge.exposeInMainWorld('lunaSetup', {
  probe: (fields: SetupFields): Promise<SetupVerdict> =>
    ipcRenderer.invoke('luna:onboarding-probe', fields),
  submit: (fields: SetupFields): Promise<SetupVerdict> =>
    ipcRenderer.invoke('luna:onboarding-submit', fields),
});
