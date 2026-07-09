import { lunaConfig, type LunaConfig } from '../lunaConfig';

// Which voice backend the browser uses:
//   'none'    — silent (the explicit voice-off toggle, luna:tts=0)
//   'browser' — the zero-setup Web Speech API voice (the DEFAULT: a fresh install speaks with no setup)
//   'http'    — a self-hosted GPT-SoVITS backend via the /api/tts forward (opt-in, needs LUNA_TTS_URL)
// Precedence: the luna:tts=0 off-toggle wins; then localStorage 'luna:tts-backend'; then the
// desktop-injected config; else 'browser'. Pure + injectable so it unit-tests.
export type TtsBackend = 'none' | 'browser' | 'http';

export function resolveTtsBackend(
  opts: { storage?: Pick<Storage, 'getItem'> | null; config?: LunaConfig } = {},
): TtsBackend {
  const storage = 'storage' in opts ? opts.storage : safeLocalStorage();
  if (storage?.getItem('luna:tts') === '0') return 'none'; // explicit off wins

  const config = opts.config ?? lunaConfig();
  const raw = storage?.getItem('luna:tts-backend') ?? config?.ttsBackend;
  if (raw === 'none' || raw === 'browser' || raw === 'http') return raw;
  return 'browser'; // zero-setup default
}

function safeLocalStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
