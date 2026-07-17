// v0.38.0: platform-correct child-process env assembly, extracted from main.ts so the win32
// semantics (the compiled sidecar's `.exe`, the PATH delimiter, the 'Path' vs 'PATH' env key) are
// unit-testable off the electron-coupled boot path. Every function takes `platform` explicitly so a
// mac test can assert the Windows shape and vice-versa.

// bun's `--compile` emits `luna-server.exe` on win32; the resolved name + the electron-builder
// extraResources entry must agree or an Explorer launch ENOENTs.
export function serverBinName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'luna-server.exe' : 'luna-server';
}

// The env's canonical PATH key. win32 stores it as 'Path' (lookups are case-insensitive there);
// spreading process.env then writing a separate 'PATH' would leave the child with two conflicting
// vars. Find the existing key by case-insensitive match, defaulting to 'Path'.
export function pathKeyFor(platform: NodeJS.Platform, env: Record<string, string | undefined>): string {
  if (platform !== 'win32') return 'PATH';
  return Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'Path';
}

// The child's PATH value: the ffmpeg dir (if discovered) prepended so torchcodec finds it, then the
// parent PATH, then the homebrew dirs on darwin ONLY — joined on the platform delimiter (';' win32,
// ':' elsewhere). Pure: uses the `platform` param's delimiter, never the host's node:path delimiter.
export function childPathValue(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  ffmpegDir: string | null,
): string {
  const key = pathKeyFor(platform, env);
  const extraDirs = platform === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin'] : [];
  return [...(ffmpegDir ? [ffmpegDir] : []), env[key] ?? '', ...extraDirs]
    .filter(Boolean)
    .join(platform === 'win32' ? ';' : ':');
}
