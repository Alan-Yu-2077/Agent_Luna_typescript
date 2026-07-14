import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { buildTtsArgv, parseLoopbackUrl, resolveManagedCheckout, resolveManagedRuntime, type RuntimeFs } from './ttsRuntime';

const UD = '/ud';
const TTS = join(UD, 'tts');
const RUNTIME = join(TTS, 'runtime');
const BYO = '/byo/GPT-SoVITS';
const PACK_YAML = { path: join(TTS, 'neuro-pack', 'tts_infer.runtime.yaml'), mtimeMs: 1000 };

function fakeFs(o: {
  files?: string[];
  provisionState?: string;
  packYamls?: Array<{ path: string; mtimeMs: number }>;
}): RuntimeFs {
  const files = new Set(o.files ?? []);
  return {
    exists: (p) => files.has(p),
    readText: (p) => {
      if (p === join(TTS, 'provision.json') && o.provisionState !== undefined)
        return JSON.stringify({ state: o.provisionState });
      throw new Error(`unexpected read: ${p}`);
    },
    listPackYamls: () => o.packYamls ?? [],
  };
}

const byoCheckoutFiles = [
  join(BYO, 'api_v2.py'),
  join(BYO, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large'),
  join(BYO, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base'),
];
const provisionedFiles = [
  join(TTS, 'provision.json'),
  join(RUNTIME, 'api_v2.py'),
  join(RUNTIME, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large'),
  join(RUNTIME, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base'),
];

describe('parseLoopbackUrl', () => {
  test('empty → the canonical local default', () => {
    expect(parseLoopbackUrl(undefined)).toEqual({ host: '127.0.0.1', port: 9880 });
    expect(parseLoopbackUrl('')).toEqual({ host: '127.0.0.1', port: 9880 });
  });
  test('loopback with a custom port parses; localhost normalizes', () => {
    expect(parseLoopbackUrl('http://127.0.0.1:9881')).toEqual({ host: '127.0.0.1', port: 9881 });
    expect(parseLoopbackUrl('http://localhost:9880/')).toEqual({ host: '127.0.0.1', port: 9880 });
  });
  test('a remote upstream is never ours to manage', () => {
    expect(parseLoopbackUrl('http://192.168.1.20:9880')).toBeNull();
    expect(parseLoopbackUrl('https://tts.example.com')).toBeNull();
  });
  test('garbage is null, never a throw', () => {
    expect(parseLoopbackUrl('not a url')).toBeNull();
  });
});

describe('resolveManagedRuntime', () => {
  test('flag off (unset or 0) → null, the never-spawn default', () => {
    const fs = fakeFs({ files: byoCheckoutFiles, packYamls: [PACK_YAML] });
    expect(resolveManagedRuntime({ LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs })).toBeNull();
    expect(
      resolveManagedRuntime({ LUNA_TTS_MANAGED: '0', LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs }),
    ).toBeNull();
  });

  test('flag on + no runtime anywhere → null (nothing to launch)', () => {
    expect(
      resolveManagedRuntime({ LUNA_TTS_MANAGED: '1' }, { userData: UD, fs: fakeFs({ packYamls: [PACK_YAML] }) }),
    ).toBeNull();
  });

  test('flag on + remote LUNA_TTS_URL → null (never manage a remote server)', () => {
    const fs = fakeFs({ files: byoCheckoutFiles, packYamls: [PACK_YAML] });
    expect(
      resolveManagedRuntime(
        { LUNA_TTS_MANAGED: '1', LUNA_TTS_URL: 'http://10.0.0.5:9880', LUNA_TTS_RUNTIME_DIR: BYO },
        { userData: UD, fs },
      ),
    ).toBeNull();
  });

  test('NO installed pack → null: GPT-SoVITS is zero-shot, never launch voiceless (browser voice until a pack drops)', () => {
    const fs = fakeFs({ files: byoCheckoutFiles, packYamls: [] });
    expect(
      resolveManagedRuntime({ LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs }),
    ).toBeNull();
  });

  test('BYO checkout + a pack resolves with its venv python and the pack yaml', () => {
    const fs = fakeFs({ files: [...byoCheckoutFiles, join(BYO, '.venv', 'bin', 'python')], packYamls: [PACK_YAML] });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO },
      { userData: UD, platform: 'darwin', fs },
    );
    expect(rt).toEqual({
      kind: 'byo',
      checkout: BYO,
      python: join(BYO, '.venv', 'bin', 'python'),
      yamlPath: PACK_YAML.path,
      host: '127.0.0.1',
      port: 9880,
    });
  });

  test('a BYO checkout missing its pretrained models is not launchable → null', () => {
    const fs = fakeFs({ files: [join(BYO, 'api_v2.py')], packYamls: [PACK_YAML] });
    expect(
      resolveManagedRuntime({ LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs }),
    ).toBeNull();
  });

  test('windows venv python path is used on win32', () => {
    const fs = fakeFs({
      files: [...byoCheckoutFiles, join(BYO, '.venv', 'Scripts', 'python.exe')],
      packYamls: [PACK_YAML],
    });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO },
      { userData: UD, platform: 'win32', fs },
    );
    expect(rt?.python).toBe(join(BYO, '.venv', 'Scripts', 'python.exe'));
  });

  test('the 整合包 embedded python (runtime/python.exe) is used on win32 when there is no venv', () => {
    const fs = fakeFs({
      files: [...provisionedFiles, join(RUNTIME, 'runtime', 'python.exe')],
      provisionState: 'ready',
      packYamls: [PACK_YAML],
    });
    const rt = resolveManagedRuntime({ LUNA_TTS_MANAGED: '1' }, { userData: UD, platform: 'win32', fs });
    expect(rt?.kind).toBe('provisioned');
    expect(rt?.python).toBe(join(RUNTIME, 'runtime', 'python.exe'));
  });

  test('no venv → bare python3 (it is on the user to have deps, same as startCommand)', () => {
    const fs = fakeFs({ files: byoCheckoutFiles, packYamls: [PACK_YAML] });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO },
      { userData: UD, platform: 'darwin', fs },
    );
    expect(rt?.python).toBe('python3');
  });

  test('a ready provisioned runtime wins over BYO', () => {
    const fs = fakeFs({
      files: [...provisionedFiles, ...byoCheckoutFiles],
      provisionState: 'ready',
      packYamls: [PACK_YAML],
    });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO },
      { userData: UD, platform: 'darwin', fs },
    );
    expect(rt?.kind).toBe('provisioned');
    expect(rt?.checkout).toBe(RUNTIME);
  });

  test('a mid-install provisioned runtime (state!=ready) falls back to BYO', () => {
    const fs = fakeFs({
      files: [...provisionedFiles, ...byoCheckoutFiles],
      provisionState: 'downloading',
      packYamls: [PACK_YAML],
    });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO },
      { userData: UD, platform: 'darwin', fs },
    );
    expect(rt?.kind).toBe('byo');
  });

  test('the newest installed pack yaml wins', () => {
    const older = { path: join(TTS, 'pack-a', 'tts_infer.runtime.yaml'), mtimeMs: 1000 };
    const newer = { path: join(TTS, 'pack-b', 'tts_infer.runtime.yaml'), mtimeMs: 2000 };
    const fs = fakeFs({ files: byoCheckoutFiles, packYamls: [older, newer] });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO },
      { userData: UD, fs },
    );
    expect(rt?.yamlPath).toBe(newer.path);
  });
});

describe('buildTtsArgv', () => {
  test('argv form — the reference-instance launch, never a shell string', () => {
    const fs = fakeFs({ files: [...byoCheckoutFiles, join(BYO, '.venv', 'bin', 'python')], packYamls: [PACK_YAML] });
    const rt = resolveManagedRuntime(
      { LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO, LUNA_TTS_URL: 'http://127.0.0.1:9881' },
      { userData: UD, platform: 'darwin', fs },
    );
    expect(rt).not.toBeNull();
    const argv = buildTtsArgv(rt!);
    expect(argv.command).toBe(join(BYO, '.venv', 'bin', 'python'));
    expect(argv.args).toEqual(['api_v2.py', '-a', '127.0.0.1', '-p', '9881', '-c', PACK_YAML.path]);
    expect(argv.cwd).toBe(BYO);
  });
});

// v0.37.3: the checkout-only resolver — what a FIRST pack install writes its yaml against.
describe('resolveManagedCheckout', () => {
  test('flag off → null; managed BYO resolves without any pack yaml', () => {
    const fs = fakeFs({ files: byoCheckoutFiles, packYamls: [] });
    expect(resolveManagedCheckout({ LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs })).toBeNull();
    expect(
      resolveManagedCheckout({ LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs }),
    ).toEqual({ kind: 'byo', checkout: BYO });
  });
  test('a ready provisioned runtime wins here too', () => {
    const fs = fakeFs({ files: [...provisionedFiles, ...byoCheckoutFiles], provisionState: 'ready', packYamls: [] });
    expect(resolveManagedCheckout({ LUNA_TTS_MANAGED: '1', LUNA_TTS_RUNTIME_DIR: BYO }, { userData: UD, fs })).toEqual(
      { kind: 'provisioned', checkout: RUNTIME },
    );
  });
});
