// The config object the desktop preload injects as `window.lunaConfig` (from LUNA_MODEL_URL /
// LUNA_TTS_BACKEND / LUNA_TTS_URL). Absent in a plain browser, so every field is optional and every
// reader falls back to a localStorage override or a default.
export type LunaConfig = {
  modelUrl?: string;
  ttsBackend?: string;
  ttsUrl?: string;
};

export function lunaConfig(): LunaConfig | undefined {
  return (globalThis as { lunaConfig?: LunaConfig }).lunaConfig;
}
