// v0.26.1: the app-data config file (`luna.env`) — the single place the packaged app reads keys
// from. Plain KEY=VALUE lines (comments/#, blanks, optional single/double quotes). The desktop
// supervisor passes the parsed map as the sidecar's environment — the server itself is unchanged,
// and no secret ever ships inside the app bundle.
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// The first-run template written to app-data. Keys empty on purpose — Luna boots (the window opens,
// the avatar renders if one is installed), but turns fail until the user fills them in. Never bundled,
// never committed.
export const ENV_TEMPLATE = `# Luna desktop configuration — fill in your keys, then restart Luna.
# (This file lives in your user data folder and is never part of the app bundle.)

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=

LUNA_MODEL=claude-sonnet-4-6
LUNA_EMBEDDING_MODEL=
LUNA_EMBEDDING_API_KEY=
LUNA_EMBEDDING_BASE_URL=

# Optional: weather / web search
LUNA_WEATHER_PROVIDER=
LUNA_WEATHER_API_KEY=
LUNA_WEATHER_API_HOST=
# Weather location (lat,lon) — auto-filled from the Mac (CoreLocation → timezone) since v0.33.0;
# set it here to override (a manual value is never changed).
LUNA_LAT_LON=
LUNA_WEB_SEARCH_PROVIDER=
LUNA_WEB_SEARCH_API_KEY=

# Avatar & voice (bring-your-own — see docs/SETUP.md). The "Choose model folder…" picker sets
# LUNA_MODEL_URL for you. Voice defaults to the browser; set LUNA_TTS_BACKEND=http + a GPT-SoVITS
# api_v2 server (services/tts) for a custom voice.
LUNA_MODEL_URL=
LUNA_TTS_BACKEND=browser
LUNA_TTS_URL=
# v0.37.0: 1 = Luna spawns + supervises the GPT-SoVITS api_v2 server herself (from the wizard-
# provisioned runtime or LUNA_TTS_RUNTIME_DIR) — no terminal. Unset/0 = bring-your-own (you run it).
LUNA_TTS_MANAGED=
# v0.37.2: 1 = enable the wizard's one-click GPT-SoVITS download & deploy (preview flag while the
# per-OS installer is validated). LUNA_TTS_HF_MIRROR overrides the HuggingFace host for CN networks
# (e.g. https://hf-mirror.com).
LUNA_TTS_PROVISION=
LUNA_TTS_HF_MIRROR=

# Pet mode: 1 = a transparent, always-on-top Luna floating over the desktop (region click-through).
# Initial default only — the in-app settings toggle ("Desktop pet") wins once used (settings.json).
LUNA_PET_MODE=
`;
