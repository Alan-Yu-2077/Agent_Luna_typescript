// Where the Live2D avatar model lives. No model ships with the repo (bring-your-own), so this resolves
// an INSTALLED one, in precedence order:
//   1. localStorage 'luna:model-url' — an explicit per-browser override (the desktop picker writes it)
//   2. window.lunaConfig.modelUrl — injected by the desktop preload (LUNA_MODEL_URL)
//   3. undefined — no avatar configured; the sink short-circuits to the empty state (no 404 probe)
// Pure + injectable so it unit-tests.
import { lunaConfig, type LunaConfig } from '../lunaConfig';

export function resolveModelUrl(
  opts: { storage?: Pick<Storage, 'getItem'> | null; config?: LunaConfig } = {},
): string | undefined {
  const storage = 'storage' in opts ? opts.storage : safeLocalStorage();
  const fromStorage = storage?.getItem('luna:model-url');
  if (fromStorage && fromStorage.trim() !== '') return fromStorage;

  const config = opts.config ?? lunaConfig();
  const fromConfig = config?.modelUrl;
  if (fromConfig && fromConfig.trim() !== '') return fromConfig;

  return undefined;
}

function safeLocalStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage disabled (private mode / sandboxed) — fall through to config
  }
}
