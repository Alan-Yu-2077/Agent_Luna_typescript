import { contextBridge, ipcRenderer, webUtils } from 'electron';

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
  // v0.28.6: manual window drag — pointerdown on her body starts it, dx/dy are TOTAL screen-space
  // deltas from the start. Replaces -webkit-app-region (which ate every click inside the pet).
  dragStart: (): void => {
    ipcRenderer.send('luna:pet-drag-start');
  },
  dragMove: (dx: number, dy: number): void => {
    ipcRenderer.send('luna:pet-drag-move', dx, dy);
  },
  dragEnd: (): void => {
    ipcRenderer.send('luna:pet-drag-end');
  },
  // Open a native folder picker to install a bring-your-own Live2D model; on success the shell copies
  // it into userData/models, writes LUNA_MODEL_URL, and reloads. Returns {ok, modelUrl?} | {ok:false}.
  chooseModel: (): Promise<{ ok: boolean; modelUrl?: string; error?: string }> =>
    ipcRenderer.invoke('luna:choose-model'),
  // v0.35.2: the wizard drop zone. Electron 33 removed File.path — the real path is resolved HERE
  // (webUtils needs the preload context) and only the path string crosses IPC.
  installModelFile: (file: File): Promise<{ ok: boolean; modelUrl?: string; error?: string }> =>
    ipcRenderer.invoke('luna:install-model-path', webUtils.getPathForFile(file)),
});

// Inject the desktop-resolved config (LUNA_MODEL_URL / LUNA_TTS_BACKEND / LUNA_TTS_URL) so the renderer
// can resolve its avatar + voice without env access. sendSync is fine for a one-time boot read and is
// sandbox-agnostic (a sandboxed preload has no process.env). A plain browser has no window.lunaConfig.
contextBridge.exposeInMainWorld(
  'lunaConfig',
  ipcRenderer.sendSync('luna:get-config') as { modelUrl?: string; ttsBackend?: string; ttsUrl?: string },
);

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
  // v0.35.0: the multi-step wizard. `wizard` advertises the LUNA_SETUP_WIZARD flag (renderer picks
  // the wizard vs the legacy card); wizardSubmit carries the whole whitelisted field map one way —
  // the verdict never echoes a value. openSetup re-enters setup from the Settings panel.
  wizard: ipcRenderer.sendSync('luna:wizard-enabled') === true,
  wizardSubmit: (fields: Record<string, string>): Promise<SetupVerdict> =>
    ipcRenderer.invoke('luna:wizard-submit', fields),
  openSetup: (): void => {
    ipcRenderer.send('luna:open-setup');
  },
  // v0.35.1: optional-step probes (embedding / search / weather). The kind is pinned to three fixed
  // channels here — the renderer cannot aim this at an arbitrary IPC name.
  probeProvider: (
    kind: 'embedding' | 'search' | 'weather',
    fields: Record<string, string>,
  ): Promise<SetupVerdict> => {
    const channel =
      kind === 'embedding' ? 'luna:probe-embedding' : kind === 'search' ? 'luna:probe-search' : 'luna:probe-weather';
    return ipcRenderer.invoke(channel, fields);
  },
  // v0.35.3: the voice-pack flow. Same webUtils path handoff as the model drop; scan → the user
  // confirms picks/transcript → install copies weights + writes luna.env + generates the api_v2
  // config and launch command (canonical GPT-SoVITS standard). Nothing from the pack is executed.
  scanVoicePack: (file: File): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('luna:scan-voice-pack', webUtils.getPathForFile(file)),
  installVoicePack: (args: Record<string, string>): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('luna:install-voice-pack', args),
  chooseTtsRuntime: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('luna:choose-tts-runtime'),
});
