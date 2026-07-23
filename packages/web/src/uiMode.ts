// v0.39.2: which front end to build.
//   'full'  — Luna as designed: a Live2D avatar with voice, and the chat panel beside her.
//   'agent' — the same brain with nothing but the conversation: no model stage, no avatar install,
//             no voice. The setup wizard's first step, for people who want the agent and not the pet.
// Chosen in the wizard and persisted to luna.env (LUNA_UI_MODE), so the choice survives restarts and
// there is exactly ONE source of truth — switching modes means re-running the wizard, not a toggle
// that could disagree with the config. Precedence mirrors resolveModelUrl / resolveTtsBackend:
//   `?agent` (a browser-only preview escape hatch, like ?pet / ?wizard) → localStorage → config → full.
// Pure + injectable so it unit-tests.
import { lunaConfig, type LunaConfig } from './lunaConfig';

export type UiMode = 'full' | 'agent';

export function resolveUiMode(
  opts: { storage?: Pick<Storage, 'getItem'> | null; config?: LunaConfig; search?: string } = {},
): UiMode {
  const search = opts.search ?? (typeof location !== 'undefined' ? location.search : '');
  if (new URLSearchParams(search).has('agent')) return 'agent';

  const storage = 'storage' in opts ? opts.storage : safeLocalStorage();
  const fromStorage = storage?.getItem('luna:ui-mode');
  if (fromStorage === 'agent' || fromStorage === 'full') return fromStorage;

  const config = opts.config ?? lunaConfig();
  return config?.uiMode === 'agent' ? 'agent' : 'full';
}

function safeLocalStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage disabled (private mode / sandboxed) — fall through to config
  }
}
