import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// v0.27.0: shell-owned settings (`userData/settings.json`) — choices the user makes in the UI that
// the SHELL must know at window-creation time (Electron's transparent/frame options are immutable
// after creation, so pet mode is a persisted choice + a window recreation, not a live style flip).
// Distinct from luna.env (user-edited keys/config) and from the server's own settings store.

export type ShellSettings = {
  petMode?: boolean;
};

export function readShellSettings(userDataDir: string): ShellSettings {
  const file = join(userDataDir, 'settings.json');
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const petMode = (parsed as Record<string, unknown>)['petMode'];
    return typeof petMode === 'boolean' ? { petMode } : {};
  } catch {
    return {}; // a corrupt file degrades to defaults; the next write heals it
  }
}

export function writeShellSettings(userDataDir: string, settings: ShellSettings): void {
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify(settings, null, 2));
}
