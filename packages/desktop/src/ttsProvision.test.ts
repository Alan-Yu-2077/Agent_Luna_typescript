import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  buildManifest,
  INFERENCE_REQUIREMENTS,
  PYTHON_CANDIDATES,
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
  python?: string | null; // null = no 3.9-3.11 interpreter on this machine
  ffmpeg?: boolean; // the SYSTEM ffmpeg binary (torchcodec decodes through it)
  compiler?: boolean; // a C compiler (jieba_fast/pyopenjtalk are sdist-only)
  hashes?: Record<string, string>; // path → the sha256 the fake reports for it
  manifest?: Artifact[]; // so the fake can honour the REAL manifest's declared hashes
}) {
  const files = new Map<string, number>(Object.entries(o.preFiles ?? {}));
  const texts = new Map<string, string>();
  // path → the sha the ARTIFACT declares, so a fake download of the real manifest verifies cleanly.
  const shaByPath = new Map<string, string>();
  const calls = { downloads: [] as Array<{ url: string; resumeFrom: number }>, extracts: [] as string[], execs: [] as string[] };
  let failedOnce = false;
  const seams: ProvisionSeams = {
    platform: o.platform ?? 'darwin',
    freeDiskBytes: () => o.freeDisk ?? 50_000_000_000,
    findPython: () => (o.python === undefined ? 'python3.11' : o.python),
    findFfmpeg: () => (o.ffmpeg === false ? null : '/opt/homebrew/bin/ffmpeg'),
    hasCompiler: () => o.compiler !== false,
    sha256: (p) => o.hashes?.[p] ?? shaByPath.get(p) ?? 'GOODHASH',
    fs: {
      exists: (p) => files.has(p) || texts.has(p),
      remove: (p) => {
        files.delete(p);
        texts.delete(p);
      },
      size: (p) => files.get(p) ?? 0,
      mkdirp: () => {},
      rename: (from, to) => {
        const s = files.get(from) ?? 0;
        files.delete(from);
        files.set(to, s);
        const sha = shaByPath.get(from);
        if (sha) {
          shaByPath.delete(from);
          shaByPath.set(to, sha); // a cached file re-verifies against the same hash
        }
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
      const declared = (o.manifest ?? MINI).find((a) => a.url === url)?.sha256;
      if (declared) shaByPath.set(partPath, declared);
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
      // Extraction "creates" the runtime tree — every path `validating` now checks (v0.37.12: it
      // checks the model FILES and G2PW and the venv, not just two directory names).
      files.set(join(DIRS.runtimeDir, 'api_v2.py'), 1);
      const pre = join(DIRS.runtimeDir, 'GPT_SoVITS', 'pretrained_models');
      files.set(join(pre, 'chinese-roberta-wwm-ext-large', 'pytorch_model.bin'), 1);
      files.set(join(pre, 'chinese-hubert-base', 'pytorch_model.bin'), 1);
      files.set(join(DIRS.runtimeDir, 'GPT_SoVITS', 'text', 'G2PWModel'), 1);
      files.set(join(DIRS.runtimeDir, 'nltk_data', 'corpora', 'cmudict'), 1);
      return Promise.resolve();
    },
    exec: (command, args) => {
      calls.execs.push(`${command} ${args.join(' ')}`);
      if (args.includes('venv')) files.set(join(DIRS.runtimeDir, '.venv', 'bin', 'python'), 1);
      return Promise.resolve();
    },
  };
  return { seams, calls, texts, files };
}

const MINI: Artifact[] = [
  { name: 'code', url: 'https://x/code.tar.gz', dest: '.', sizeBytes: 0, sha256: 'GOODHASH', archive: 'tar.gz', stripPrefix: 'c' },
  { name: 'model.bin', url: 'https://x/model.bin', dest: 'GPT_SoVITS/pretrained_models/m/model.bin', sizeBytes: 100, sha256: 'GOODHASH' },
];
// The real code keys the cache on name+URL — tests that pre-seed downloads must use the same name.
const cached = (a: Artifact): string => {
  let h = 5381;
  for (let i = 0; i < a.url.length; i++) h = ((h * 33) ^ a.url.charCodeAt(i)) >>> 0;
  return join(DIRS.downloadsDir, `${a.name.replace(/[/\\ ]/g, '_')}.${h.toString(36)}`);
};

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
    // the venv is built with the DISCOVERED 3.9-3.11 interpreter, never a bare `python3`
    expect(world.calls.execs[0]).toBe('python3.11 -m venv .venv');
    // v0.37.12: OUR inference list, never the upstream requirements.txt (numba==0.56.4 refuses py3.11)
    expect(world.calls.execs.some((c) => c.includes('luna-requirements.txt'))).toBe(true);
    expect(world.calls.execs.every((c) => !c.includes(' requirements.txt'))).toBe(true);
    expect(world.calls.execs.some((c) => c.includes('pip install torch>=2.4,<2.14'))).toBe(true);
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
        [cached(MINI[1]!)]: 100, // already complete
        [cached(MINI[0]!) + '.part']: 40, // half-downloaded archive
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
    expect(world.files.has(cached(MINI[0]!))).toBe(false); // never renamed → never trusted
  });

  test('a file already at its final path is trusted — the rename IS the commit', async () => {
    const world = fakeWorld({
      preFiles: { [cached(MINI[0]!)]: 100, [cached(MINI[1]!)]: 100 },
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
    const manifest = buildManifest({ platform: 'win32' });
    const world = fakeWorld({ platform: 'win32', manifest });
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

  // v0.37.10: the roberta dir upstream publishes is EXACTLY these three. v0.37.9 claimed every
  // manifest URL was HEAD-checked, but only the size-bearing binaries were — the four zero-size BERT
  // companions (tokenizer_config / special_tokens_map / added_tokens / vocab.txt) were never probed,
  // and all four 404, hard-failing the install at the first one. Pin the set so they cannot creep back.
  test('roberta requests only the three files the host actually serves', () => {
    const roberta = buildManifest({ platform: 'darwin' })
      .filter((a) => a.name.startsWith('roberta/'))
      .map((a) => a.name.slice('roberta/'.length))
      .sort();
    expect(roberta).toEqual(['config.json', 'pytorch_model.bin', 'tokenizer.json']);
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

// v0.37.12: the venv needs python 3.9-3.11. The reference machine's own `python3` is 3.14 (no torch
// wheels), so a hardcoded `python3` was a guaranteed failure — AFTER a ~1.6 GB download.
describe('runProvision — the python gate', () => {
  test('no compatible python → fails in PREFLIGHT, before a single byte is downloaded', async () => {
    const world = fakeWorld({ python: null });
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('preflight');
    expect(final.error).toContain('3.9');
    expect(world.calls.downloads.length).toBe(0); // the whole point: nothing downloaded
    expect(world.calls.execs.length).toBe(0);
  });

  test('the discovered interpreter is the one the venv is built with (never `python3`)', async () => {
    const world = fakeWorld({ python: 'python3.10' });
    const { final } = await run(world);
    expect(final.stage).toBe('ready');
    expect(world.calls.execs[0]).toBe('python3.10 -m venv .venv');
    expect(world.calls.execs.every((c) => !c.startsWith('python3 '))).toBe(true);
  });

  test('win32 needs no system python — the 整合包 ships its own', async () => {
    const world = fakeWorld({ platform: 'win32', python: null });
    const { final } = await run(world);
    expect(final.stage).toBe('ready'); // not blocked by the python gate
    expect(world.calls.execs.length).toBe(0);
  });
});

describe('the venv recipe (v0.37.12)', () => {
  test('linux takes the CPU torch index — PyPI\'s linux torch is a ~2.5 GB CUDA build', async () => {
    const world = fakeWorld({ platform: 'linux' });
    await run(world);
    const torchCmd = world.calls.execs.find((c) => c.includes('torch'))!;
    expect(torchCmd).toContain('--index-url https://download.pytorch.org/whl/cpu');
  });
  test('macOS does NOT use the CPU index (PyPI already ships the right wheel)', async () => {
    const world = fakeWorld({ platform: 'darwin' });
    await run(world);
    const torchCmd = world.calls.execs.find((c) => c.includes('torch'))!;
    expect(torchCmd).not.toContain('index-url');
  });
  // Both halves of this were settled by a REAL install, not by reading requirements.txt: the excluded
  // ones never appear in api_v2's import chain, and gradio — which looks like pure WebUI weight — is
  // load-bearing (tools/my_utils.py imports it, and TTS.py imports tools). Guessing got it backwards.
  test('the list excludes the training-only weight, and keeps the deps a real boot proved necessary', () => {
    for (const dead of ['funasr', 'modelscope', 'faster', 'tensorboard']) {
      expect(INFERENCE_REQUIREMENTS.toLowerCase()).not.toContain(dead);
    }
    for (const needed of [
      'transformers', 'librosa', 'pyopenjtalk', 'onnxruntime', 'fastapi',
      'gradio', // not optional, despite appearances
      'matplotlib', // AR/modules/lr_schedulers.py imports pyplot at module scope
      'split-lang', // text/LangSegmenter
      'huggingface-hub>=0.26,<1', // gradio's latest pulls hub 1.x, which transformers rejects
    ]) {
      expect(INFERENCE_REQUIREMENTS).toContain(needed);
    }
    expect(INFERENCE_REQUIREMENTS).toContain('numba>=0.59'); // NOT the py3.11-hostile 0.56.4
  });
});

// v0.37.12: found by SYNTHESIZING — the install "succeeded" and then every synth 400'd with
// "TorchCodec is required". torchcodec decodes through the system ffmpeg binary.
describe('runProvision — the ffmpeg gate', () => {
  test('no system ffmpeg → fails in PREFLIGHT, before downloading', async () => {
    const world = fakeWorld({ ffmpeg: false });
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('preflight');
    expect(final.error).toContain('FFmpeg');
    expect(world.calls.downloads.length).toBe(0);
  });
  test('win32 needs no system ffmpeg — the 整合包 bundles one', async () => {
    const world = fakeWorld({ platform: 'win32', ffmpeg: false });
    expect((await run(world)).final.stage).toBe('ready');
  });
  test('torchcodec is installed WITH the torch trio (ceilinged), not left unpinned in the list', () => {
    expect(INFERENCE_REQUIREMENTS).not.toContain('torchcodec'); // moved to the torch install command
  });
});

// v0.37.12 (adversarial audit): HuggingFace GZIPS the small JSONs, so content-length is ABSENT and
// the length check silently no-ops. A 200 that is a sign-in page would be committed as tokenizer.json
// and cached FOREVER (an existing file was never re-verified), pass validating (which only stats
// directories), report `ready`, and crash api_v2 on a parse error with no way back.
describe('download integrity (the cache-poisoning hole)', () => {
  test('a 200 whose CONTENT is wrong fails loudly and is never committed — even with no content-length', async () => {
    const world = fakeWorld({ hashes: {} }); // sha256() returns 'GOODHASH' by default…
    // …so make the fake report a DIFFERENT hash for whatever lands: an HTML sign-in page.
    const seams = world.seams;
    const realSha = seams.sha256;
    seams.sha256 = (p: string) => (p.endsWith('.part') ? 'HTML-SIGNIN-PAGE' : realSha(p));
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('downloading');
    expect(final.error).toContain('checksum');
    expect(world.files.has(cached(MINI[0]!))).toBe(false); // NOT cached — retry can actually recover
  });

  test('a cached file whose hash no longer matches is re-downloaded, not trusted', async () => {
    const world = fakeWorld({ preFiles: { [cached(MINI[1]!)]: 100 } });
    const seams = world.seams;
    let firstLook = true;
    seams.sha256 = (p: string) => {
      if (p === cached(MINI[1]!) && firstLook) {
        firstLook = false;
        return 'STALE-GARBAGE'; // the poisoned cache entry
      }
      return 'GOODHASH';
    };
    const { final } = await run(world);
    expect(final.stage).toBe('ready');
    expect(world.calls.downloads.some((d) => d.url === 'https://x/model.bin')).toBe(true); // re-fetched
  });

  test('the cache key includes the URL — a manifest that repoints a name cannot reuse the old file', async () => {
    const moved: Artifact[] = [{ ...MINI[1]!, url: 'https://NEW-HOST/model.bin' }];
    const world = fakeWorld({ preFiles: { [cached(MINI[1]!)]: 100 } }); // the OLD host's file
    await run(world, moved);
    expect(world.calls.downloads.some((d) => d.url === 'https://NEW-HOST/model.bin')).toBe(true);
  });

  test('a .part at or past the remote size restarts instead of retrying into a 416 forever', async () => {
    const world = fakeWorld({ preFiles: { [cached(MINI[1]!) + '.part']: 500 } }); // > sizeBytes 100
    await run(world);
    const dl = world.calls.downloads.find((d) => d.url === 'https://x/model.bin');
    expect(dl?.resumeFrom).toBe(0); // NOT 500 (a Range beyond EOF is a permanent 416)
  });
});

describe('validating checks every load-bearing piece (v0.37.12)', () => {
  test('a marker that claims ready with no venv is caught, not spawned into a crash-loop', async () => {
    const world = fakeWorld({});
    const seams = world.seams;
    const realExists = seams.fs.exists;
    seams.fs.exists = (p: string) => (p.includes('.venv') ? false : realExists(p));
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('validating');
    expect(final.error).toContain('python venv');
  });
});

// v0.37.13: the "clean room" wasn't. It inherited the reference machine's ~/nltk_data (June) and
// pyopenjtalk's cached dictionary, so English synthesis appeared to work. Under a FAKE HOME it dies:
//   g2p_en → LookupError: Resource 'cmudict' not found   (nltk does not even auto-download it)
describe('language data (v0.37.13 — the fake-HOME findings)', () => {
  test('the corpora ship as CHECKSUMMED artifacts, not an opaque nltk.download() at install time', () => {
    const m = buildManifest({ platform: 'darwin' });
    const nltk = m.filter((a) => a.name.startsWith('nltk/'));
    expect(nltk.map((a) => a.name)).toContain('nltk/cmudict'); // without it English G2P raises
    expect(nltk.every((a) => a.sha256 && a.archive === 'zip')).toBe(true);
    expect(nltk.find((a) => a.name === 'nltk/cmudict')!.dest).toBe('nltk_data/corpora');
  });
  test('every artifact carries a sha256 EXCEPT the GitHub tarball (GitHub does not guarantee byte-stability)', () => {
    for (const plat of ['darwin', 'linux', 'win32'] as const) {
      for (const a of buildManifest({ platform: plat })) {
        if (a.url.includes('github.com/RVC-Boss')) expect(a.sha256).toBeUndefined(); // structural check instead
        else expect(a.sha256).toBeTruthy();
      }
    }
  });
  test('validating fails if the English corpus is missing — it is not optional', async () => {
    const world = fakeWorld({});
    const seams = world.seams;
    const realExists = seams.fs.exists;
    seams.fs.exists = (p: string) => (p.includes('cmudict') ? false : realExists(p));
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.error).toContain('English');
  });
});


// v0.37.15 (re-audit): python floor 3.10 + torch ceilings + candidate list hygiene.
describe('re-audit fixes', () => {
  test('the venv uses the DISCOVERED interpreter, and torch is CEILINGED (was unpinned)', async () => {
    const world = fakeWorld({ python: 'python3.10' });
    await run(world);
    expect(world.calls.execs[0]).toBe('python3.10 -m venv .venv');
    const torch = world.calls.execs.find((c) => c.includes('pip install torch'))!;
    expect(torch).toContain('torch>=2.4,<2.14');
    expect(torch).toContain('torchcodec>=0.4,<0.16');
  });

  test('a 3.9-only machine fails preflight (modern torch dropped 3.9) — no half-built venv', async () => {
    const world = fakeWorld({ python: null });
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('preflight');
    expect(final.error).toContain('3.10');
    expect(world.calls.execs.length).toBe(0);
  });

  test('PYTHON_CANDIDATES never offers 3.9 nor the bare system python3', () => {
    for (const c of PYTHON_CANDIDATES) {
      expect(c).not.toContain('3.9');
      expect(c).not.toBe('/usr/bin/python3');
      expect(c).not.toBe('python3');
    }
    expect(PYTHON_CANDIDATES.some((c) => c.includes('3.11'))).toBe(true);
    expect(PYTHON_CANDIDATES.some((c) => c.includes('3.10'))).toBe(true);
  });
});

// v0.37.16 (re-audit): the two blockers the completed audit confirmed past v0.37.15.
describe('compiler preflight + GitHub-tarball resilience', () => {
  test('no C compiler → fails in PREFLIGHT, before the ~1.6 GB download (jieba_fast/pyopenjtalk are sdist-only)', async () => {
    const world = fakeWorld({ compiler: false });
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('preflight');
    expect(final.error).toMatch(/compile|xcode-select|build-essential/i);
    expect(world.calls.downloads.length).toBe(0);
  });

  test('win32 needs no compiler — the 整合包 ships prebuilt', async () => {
    const world = fakeWorld({ platform: 'win32', compiler: false });
    expect((await run(world)).final.stage).toBe('ready');
  });

  test('the GitHub source tarball is NOT sha256-pinned (GitHub recompression would flip it)', () => {
    const tarball = buildManifest({ platform: 'darwin' }).find((a) => a.url.includes('github.com/RVC-Boss'))!;
    expect(tarball.sha256).toBeUndefined();
    expect(tarball.archive).toBe('tar.gz'); // integrity is structural: a non-gzip body fails extract
  });

  test('a failed extract deletes the cached archive so retry re-downloads (no permanent wedge)', async () => {
    const world = fakeWorld({});
    world.seams.extract = () => Promise.reject(new Error('not in gzip format'));
    const codePath = cached(MINI[0]!);
    world.files.set(codePath, 100); // pretend the tarball is already downloaded
    const { final } = await run(world);
    expect(final.stage).toBe('failed');
    expect(final.failedStage).toBe('extracting');
    expect(world.files.has(codePath)).toBe(false); // deleted → a retry re-fetches, not re-fails
  });
});
