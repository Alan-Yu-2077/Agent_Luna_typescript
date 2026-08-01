import { lunaConfig, type LunaConfig } from '../lunaConfig';

// Which voice backend the browser uses:
//   'none' — silent (the explicit voice-off toggle, and the DEFAULT when nothing is configured)
//   'http' — the self-hosted GPT-SoVITS backend via the /api/tts forward
//
// v0.43.14 removed a third value, 'browser' (the Web Speech API). It was the zero-setup default of
// the distribution era — "a fresh install speaks with no setup" — and once distribution was retired
// (v0.41.0) its only remaining behaviour was to cut in with a completely foreign voice whenever
// api_v2 hiccuped. She now has exactly one voice: either she speaks in it, or she does not speak.
//
// Precedence: the luna:tts=0 off-toggle wins; then localStorage 'luna:tts-backend'; then the
// desktop-injected config; else 'none'. Pure + injectable so it unit-tests.
export type TtsBackend = 'none' | 'http';

export function resolveTtsBackend(
  opts: { storage?: Pick<Storage, 'getItem'> | null; config?: LunaConfig } = {},
): TtsBackend {
  const storage = 'storage' in opts ? opts.storage : safeLocalStorage();
  if (storage?.getItem('luna:tts') === '0') return 'none'; // explicit off wins

  const config = opts.config ?? lunaConfig();
  const raw = storage?.getItem('luna:tts-backend') ?? config?.ttsBackend;
  // A persisted 'browser' from before v0.43.14 falls through to 'none' along with everything else
  // the union no longer admits. Silence is the honest reading of a value whose feature is gone;
  // promoting it to 'http' would hand an unconfigured install a backend it has no server for.
  if (raw === 'none' || raw === 'http') return raw;
  return 'none';
}

function safeLocalStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
