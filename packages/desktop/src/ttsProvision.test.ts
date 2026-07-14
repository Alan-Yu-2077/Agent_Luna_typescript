import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  buildManifest,
  runProvision,
  type Artifact,
  type ProvisionDirs,
  type ProvisionSeams,
  type ProvisionStatus,
} from './ttsProvision';

const DIRS: ProvisionDirs = { ttsDir: '/ud/tts', runtimeDir: '/ud/tts/runtime', downloadsDir: '/ud/tts/downloads' };

// A tiny in-memory world: files carry sizes; downloads "write" bytes; extract/exec record calls.
function fakeWorld(o: {
  preFiles?: Record<string, number>; // path → size
  freeDisk?: number;
  failDownloadOnce?: string; // artifact url substring that fails on its FIRST attempt
  platform?: NodeJS.Platform;
  truncate?: number; // the server promises this many bytes…
  shortBytes?: number; // …but only this many land (a truncated transfer)
}) {
  const files = new Map<string, number>(Object.entries(o.preFiles ?? {}));
  const texts = new Map<string, string>();
  const calls = { downloads: [] as Array<{ url: string; resumeFrom: number }>, extracts: [] as string[], execs: [] as string[] };
  let failedOnce = false;
  const seams: ProvisionSeams = {
    platform: o.platform ?? 'darwin',
    freeDiskBytes: () => o.freeDisk ?? 50_000_000_000,
    fs: {
      exists: (p) => files.has(p) || texts.has(p),
      size: (p) => files.get(p) ?? 0,
      mkdirp: () => {},
      rename: (from, to) => {
        const s = files.get(from) ?? 0;
        files.delete(from);
        files.set(to, s);
      },
      copy: (from, to) => files.set(to, files.get(from) ?? 0),
      writeText: (p, s) => texts.set(p, s),
      readText: (p) => {
        const t = texts.get(p);
        if (t === undefined) throw new Error(`no text at ${p}`);
        return t;
      },
    },
    download: (url, partPath, resumeFrom, onBytes) => {
      calls.downloads.push({ url, resumeFrom });
      if (o.failDownloadOnce && url.includes(o.failDownloadOnce) && !failedOnce) {
        failedOnce = true;
        return Promise.reject(new Error('network reset'));
      }
      // `total` is the FULL final size (what the server's content-length implies), not the remainder —
      // same contract realSeams honours: total = resumeFrom + content-length.
      const total = o.truncate ?? 100;
      onBytes(total, total);
      files.set(partPath, o.shortBytes ?? 100); // what actually landed on disk
      return Promise.resolve();
    },
    extract: (archive) => {
      calls.extracts.push(archive);
      // extraction "creates" the runtime tree the validator checks
      files.set(join(DIRS.runtimeDir, 'api_v2.py'), 1);
      files.set(join(DIRS.runtimeDir, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large'), 1);
      files.set(join(DIRS.runtimeDir, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base'), 1);
      return Promise.resolve();
    },
    exec: (command, args) => {
      calls.execs.push(`${command} ${args.join(' ')}`);
      return Promise.resolve();
    },
  };
  return { seams, calls, texts, files };
}

const MINI: Artifact[] = [
  { name: 'code', url: 'https://x/code.tar.gz', dest: '.', sizeBytes: 0, archive: 'tar.gz', stripPrefix: 'c' },
  { name: 'model.bin', url: 'https://x/model.bin', dest: 'GPT_SoVITS/pretrained_models/m/model.bin', sizeBytes: 100 },
];

async function run(world: ReturnType<typeof fakeWorld>, manifest = MINI) {
  const stages: string[] = [];
  const final = await runProvision(DIRS, manifest, world.seams, (s: ProvisionStatus) => stages.push(s.stage));
  return { final, stages };
}

describe('runProvision — stage machine', () => {
  test('happy path: preflight → downloading → extracting → materializing → venv → validating → ready', async () => {
    const world = fakeWorld({});
    const { final, stages } = await run(world);
    expect(final.stage).toBe('ready');
    expect(stages[0]).toBe('preflight');
    expect(stages).toContain('downloading');
    expect(stages).toContain('venv');
    expect(stages[stages.length - 1]).toBe('ready');
    // provision.json ends ready — the marker ttsRuntime's provisionReady reads
    expect(JSON.parse(world.texts.get(join(DIRS.ttsDir, 'provision.json'))!).state).toBe('ready');
    // the venv recipe ran in the runtime dir with vetted commands only
    expect(world.calls.execs[0]).toContain('python3 -m venv');
    expect(world.calls.execs[1]).toContain('pip install -r requirements.txt');
  });

  test('preflight fails fast on low disk — nothing downloads', async () => {
    const world = fakeWorld({ freeDisk: 1_000_000 });
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('preflight');
    expect(world.calls.downloads.length).toBe(0);
  });

  test('resume: a complete artifact is skipped; a .part resumes from its byte offset', async () => {
    const world = fakeWorld({
      preFiles: {
        [join(DIRS.downloadsDir, 'model.bin')]: 100, // already complete (size matches)
        [join(DIRS.downloadsDir, 'code') + '.part']: 40, // half-downloaded archive
      },
    });
    const { final } = await run(world);
    expect(final.stage).toBe('ready');
    const urls = world.calls.downloads.map((d) => d.url);
    expect(urls).not.toContain('https://x/model.bin'); // skipped
    const code = world.calls.downloads.find((d) => d.url === 'https://x/code.tar.gz');
    expect(code?.resumeFrom).toBe(40); // resumed, not restarted
  });

  // v0.37.9: integrity is checked against the SERVER's content-length, never a hardcoded size (the
  // hardcoded roberta size was WRONG and would have failed every real install forever).
  test('a truncated transfer fails loudly and does NOT commit the file', async () => {
    const world = fakeWorld({ truncate: 100, shortBytes: 60 }); // server promised 100, only 60 landed
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('downloading');
    expect(final.error).toContain('truncated');
    expect(world.files.has(join(DIRS.downloadsDir, 'code'))).toBe(false); // never renamed → never trusted
  });

  test('a file already at its final path is trusted — the rename IS the commit', async () => {
    const world = fakeWorld({
      preFiles: { [join(DIRS.downloadsDir, 'code')]: 100, [join(DIRS.downloadsDir, 'model.bin')]: 100 },
    });
    const { final } = await run(world);
    expect(final.stage).toBe('ready');
    expect(world.calls.downloads.length).toBe(0); // nothing re-downloaded
  });

  test('a network failure fails the run with a persisted marker; a rerun completes the remainder', async () => {
    const world = fakeWorld({ failDownloadOnce: 'model.bin' });
    const first = await run(world);
    expect(first.final.stage).toBe('failed');
    expect(JSON.parse(world.texts.get(join(DIRS.ttsDir, 'provision.json'))!).state).toBe('failed');
    const second = await run(world); // same world — completed artifacts survive
    expect(second.final.stage).toBe('ready');
    // the code archive downloaded once, not twice (its final file survived the failed run)
    expect(world.calls.downloads.filter((d) => d.url.includes('code')).length).toBe(1);
  });

  test('an already-ready marker short-circuits to ready without re-running anything', async () => {
    const world = fakeWorld({});
    await run(world);
    const before = world.calls.downloads.length;
    const again = await run(world);
    expect(again.final.stage).toBe('ready');
    expect(world.calls.downloads.length).toBe(before);
  });

  test('win32: single 整合包 artifact, no venv stage', async () => {
    const world = fakeWorld({ platform: 'win32' });
    const manifest = buildManifest({ platform: 'win32' });
    expect(manifest.length).toBe(1);
    expect(manifest[0]!.archive).toBe('7z');
    const { final, stages } = await run(world, manifest);
    expect(final.stage).toBe('ready');
    expect(stages).not.toContain('venv');
    expect(world.calls.execs.length).toBe(0);
  });
});

describe('buildManifest', () => {
  test('mac recipe = code + roberta + hubert + G2PW + lid.176 — all https, no gsv pretrained', () => {
    const m = buildManifest({ platform: 'darwin' });
    expect(m.every((a) => a.url.startsWith('https://'))).toBe(true);
    const names = m.map((a) => a.name).join(' ');
    expect(names).toContain('code');
    expect(names).toContain('roberta/pytorch_model.bin');
    expect(names).toContain('hubert/pytorch_model.bin');
    expect(names).toContain('G2PWModel');
    expect(names).toContain('lid.176.bin');
    expect(names).not.toContain('gsv'); // the lean recipe — custom voices bring their own weights
  });

  test('the CN mirror override covers every HF download — including G2PW', () => {
    const m = buildManifest({ platform: 'darwin', hfBase: 'https://hf-mirror.com' });
    const roberta = m.find((a) => a.name.startsWith('roberta/'))!;
    expect(roberta.url.startsWith('https://hf-mirror.com/')).toBe(true);
    // v0.37.9: G2PW moved from a DEAD bcebos path to the URL GPT-SoVITS' own docs use — an HF one,
    // so the mirror now reaches it too (it did not before, and the old URL did not resolve at all).
    const g2pw = m.find((a) => a.name === 'G2PWModel')!;
    expect(g2pw.url).toBe('https://hf-mirror.com/XXXXRT/GPT-SoVITS-Pretrained/resolve/main/G2PWModel.zip');
    expect(m.some((a) => a.url.includes('bcebos'))).toBe(false); // the dead host is gone
  });

  test('every size hint is either 0 (unknown) or a real measured length — never a guess', () => {
    for (const a of [...buildManifest({ platform: 'darwin' }), ...buildManifest({ platform: 'win32' })]) {
      expect(a.sizeBytes === 0 || a.sizeBytes > 1000).toBe(true);
    }
  });
});
