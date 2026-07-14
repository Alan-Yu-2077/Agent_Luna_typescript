// v0.37.2 (Initiative 27): the one-click GPT-SoVITS provisioner — download, deploy, validate, mark
// ready. Reproduces the owner's verified reference recipe (roberta + hubert + G2PW + lid.176 +
// the 20240821v2 checkout + a venv) on macOS/Linux, and the official 整合包 on Windows. Staged,
// resumable (`.part` + Range), disk-preflighted, and persisted to provision.json after every
// transition so a mid-install quit resumes. The engine is pure over injected seams (tests run it
// headlessly); `realSeams()` provides the node implementations. Every executed command is built from
// vetted constants + resolved paths — never anything derived from user content (the voicePack
// no-execute discipline, extended).

import { spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type ArchiveKind = 'zip' | '7z' | 'tar.gz';

export type Artifact = {
  name: string;
  url: string;
  // where the payload lands inside the runtime checkout; archives extract here, plain files copy here
  dest: string;
  // v0.37.9: a PROGRESS HINT ONLY (measured from the real hosts 2026-07-14), never an integrity gate.
  // 0 = unknown. Completion is verified against the SERVER's content-length for that download, so a
  // hint that rots only skews the bar. (v0.37.2 hard-failed on a hardcoded-size mismatch, and the
  // roberta constant had been copied from the reference instance's fp32 file — 1.3 GB — while this
  // host serves 651 MB: the very first real run would have failed forever.)
  sizeBytes: number;
  archive?: ArchiveKind;
  stripPrefix?: string; // top-level dir inside the archive to strip while extracting
};

const HF_DEFAULT = 'https://huggingface.co';
const CODE_TAG = '20240821v2'; // matches the Windows 整合包 v2-240821 generation and the reference instance

// The scripted recipe's model set is exactly what the reference instance loads for a CUSTOM voice:
// roberta + hubert (yaml custom section) + G2PW + lid.176 (text frontend). The multi-GB gsv
// pretrained checkpoints are NOT needed — a custom voice supplies its own t2s/vits weights.
// These three are the ENTIRE roberta directory upstream publishes; tokenizer.json is the fast
// tokenizer's self-contained definition (vocab included), so the usual BERT companions
// (tokenizer_config / special_tokens_map / added_tokens / vocab.txt) do not exist on the host and
// 404 — listing them hard-failed every install at the first one.
const ROBERTA_FILES: Array<[string, number]> = [
  ['config.json', 0],
  ['pytorch_model.bin', 651_225_145],
  ['tokenizer.json', 0],
];
const HUBERT_FILES: Array<[string, number]> = [
  ['config.json', 0],
  ['preprocessor_config.json', 0],
  ['pytorch_model.bin', 188_811_417],
];

export function buildManifest(o: { platform: NodeJS.Platform; hfBase?: string }): Artifact[] {
  const hf = (o.hfBase ?? HF_DEFAULT).replace(/\/+$/, '');
  if (o.platform === 'win32') {
    return [
      {
        name: 'GPT-SoVITS 整合包 (v2-240821)',
        url: `${hf}/lj1995/GPT-SoVITS-windows-package/resolve/main/GPT-SoVITS-v2-240821.7z`,
        dest: '.',
        sizeBytes: 5_744_891_255,
        archive: '7z',
        stripPrefix: 'GPT-SoVITS-v2-240821',
      },
    ];
  }
  const models = 'GPT_SoVITS/pretrained_models';
  return [
    {
      name: 'GPT-SoVITS code (20240821v2)',
      url: `https://github.com/RVC-Boss/GPT-SoVITS/archive/refs/tags/${CODE_TAG}.tar.gz`,
      dest: '.',
      sizeBytes: 0,
      archive: 'tar.gz',
      stripPrefix: `GPT-SoVITS-${CODE_TAG}`,
    },
    ...ROBERTA_FILES.map(
      ([f, size]): Artifact => ({
        name: `roberta/${f}`,
        url: `${hf}/lj1995/GPT-SoVITS/resolve/main/chinese-roberta-wwm-ext-large/${f}`,
        dest: `${models}/chinese-roberta-wwm-ext-large/${f}`,
        sizeBytes: size,
      }),
    ),
    ...HUBERT_FILES.map(
      ([f, size]): Artifact => ({
        name: `hubert/${f}`,
        url: `${hf}/lj1995/GPT-SoVITS/resolve/main/chinese-hubert-base/${f}`,
        dest: `${models}/chinese-hubert-base/${f}`,
        sizeBytes: size,
      }),
    ),
    {
      name: 'G2PWModel',
      // v0.37.9: the URL GPT-SoVITS' own install docs point at. (v0.37.2 used a paddlespeech bcebos
      // path that is simply DEAD — it never resolved, so the install could not have completed. This
      // one is an HF URL, so LUNA_TTS_HF_MIRROR covers it for CN networks too.) The zip's top-level
      // IS `G2PWModel/`, so it extracts into text/ with no prefix to strip.
      url: `${hf}/XXXXRT/GPT-SoVITS-Pretrained/resolve/main/G2PWModel.zip`,
      dest: 'GPT_SoVITS/text',
      sizeBytes: 588_856_634,
      archive: 'zip',
    },
    {
      name: 'lid.176.bin',
      url: 'https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin',
      dest: `${models}/fast_langdetect/lid.176.bin`,
      sizeBytes: 131_266_198,
    },
  ];
}

export type ProvisionStage =
  | 'idle'
  | 'preflight'
  | 'downloading'
  | 'extracting'
  | 'materializing'
  | 'venv'
  | 'validating'
  | 'ready'
  | 'failed';

export type ProvisionStatus = {
  stage: ProvisionStage;
  pct: number; // bytes-weighted while downloading, coarse elsewhere
  bytesDone: number;
  bytesTotal: number;
  artifact?: string;
  error?: string;
  failedStage?: ProvisionStage;
};

export type ProvisionFs = {
  exists(p: string): boolean;
  size(p: string): number;
  mkdirp(p: string): void;
  rename(from: string, to: string): void;
  copy(from: string, to: string): void;
  writeText(p: string, s: string): void;
  readText(p: string): string;
};

export type ProvisionSeams = {
  fs: ProvisionFs;
  download(
    url: string,
    partPath: string,
    resumeFrom: number,
    onBytes: (done: number, total: number) => void,
  ): Promise<void>;
  extract(archive: string, kind: ArchiveKind, destDir: string, stripPrefix?: string): Promise<void>;
  exec(command: string, args: string[], cwd: string): Promise<void>;
  freeDiskBytes(dir: string): number;
  platform: NodeJS.Platform;
};

export type ProvisionDirs = {
  ttsDir: string; // provision.json lives here (the marker ttsRuntime reads)
  runtimeDir: string; // <ttsDir>/runtime — the checkout being assembled
  downloadsDir: string; // <ttsDir>/downloads — artifacts + .part files (resume survives quits)
};

const MIN_FREE_BYTES = 10_000_000_000; // GB-scale downloads + a venv; fail fast, not at 90%

type Marker = { state: string; stage?: ProvisionStage; error?: string; extracted?: string[]; venvDone?: boolean };

function readMarker(dirs: ProvisionDirs, fs: ProvisionFs): Marker {
  const p = join(dirs.ttsDir, 'provision.json');
  if (!fs.exists(p)) return { state: 'idle' };
  try {
    return JSON.parse(fs.readText(p)) as Marker;
  } catch {
    return { state: 'idle' };
  }
}

function writeMarker(dirs: ProvisionDirs, fs: ProvisionFs, m: Marker): void {
  fs.mkdirp(dirs.ttsDir);
  fs.writeText(join(dirs.ttsDir, 'provision.json'), JSON.stringify(m, null, 2));
}

export async function runProvision(
  dirs: ProvisionDirs,
  manifest: Artifact[],
  seams: ProvisionSeams,
  onStatus: (s: ProvisionStatus) => void,
): Promise<ProvisionStatus> {
  const { fs } = seams;
  const marker = readMarker(dirs, fs);
  if (marker.state === 'ready') {
    const done: ProvisionStatus = { stage: 'ready', pct: 100, bytesDone: 0, bytesTotal: 0 };
    onStatus(done);
    return done;
  }
  const extracted = new Set(marker.extracted ?? []);
  let venvDone = marker.venvDone === true;

  const totalKnown = manifest.reduce((n, a) => n + a.sizeBytes, 0);
  const st: ProvisionStatus = { stage: 'preflight', pct: 0, bytesDone: 0, bytesTotal: totalKnown };
  const push = (patch: Partial<ProvisionStatus>): void => {
    Object.assign(st, patch);
    onStatus({ ...st });
  };
  const persist = (state: string, extra: Partial<Marker> = {}): void =>
    writeMarker(dirs, fs, { state, extracted: [...extracted], venvDone, ...extra });
  const fail = (stage: ProvisionStage, error: string): ProvisionStatus => {
    persist('failed', { stage, error });
    push({ stage: 'failed', failedStage: stage, error });
    return { ...st };
  };

  try {
    push({ stage: 'preflight' });
    fs.mkdirp(dirs.downloadsDir);
    fs.mkdirp(dirs.runtimeDir);
    if (seams.freeDiskBytes(dirs.ttsDir) < MIN_FREE_BYTES)
      return fail('preflight', `Need ~${Math.round(MIN_FREE_BYTES / 1e9)} GB free disk for the voice runtime.`);

    // ── download (resumable). The rename .part → final IS the commit: a file at `finalPath` is, by
    // construction, one that finished and matched what the server promised. v0.37.9: completion is
    // checked against the SERVER's content-length for this download, never against a hardcoded size
    // (which was wrong for roberta and would have failed every real install forever). A chunked
    // response (GitHub archives send no content-length) reports total 0 → nothing to check.
    persist('downloading');
    push({ stage: 'downloading' });
    let doneBytes = 0;
    for (const a of manifest) {
      const finalPath = join(dirs.downloadsDir, a.name.replace(/[/\\ ]/g, '_'));
      if (!fs.exists(finalPath)) {
        const part = `${finalPath}.part`;
        const resumeFrom = fs.exists(part) ? fs.size(part) : 0;
        push({ artifact: a.name });
        let served = 0; // the server's own content-length for this transfer
        await seams.download(a.url, part, resumeFrom, (got, total) => {
          served = total;
          push({
            bytesDone: doneBytes + got,
            bytesTotal: Math.max(st.bytesTotal, doneBytes + total),
            pct: st.bytesTotal > 0 ? Math.min(99, Math.round(((doneBytes + got) / st.bytesTotal) * 100)) : 0,
          });
        });
        if (served > 0 && fs.size(part) !== served)
          return fail('downloading', `${a.name}: truncated (${fs.size(part)} of ${served} bytes) — retry to resume.`);
        fs.rename(part, finalPath);
      }
      doneBytes += fs.size(finalPath);
      push({ bytesDone: doneBytes });
    }

    // ── extract archives / materialize plain files into the runtime layout ──
    persist('extracting');
    push({ stage: 'extracting', pct: 99 });
    for (const a of manifest) {
      if (!a.archive || extracted.has(a.name)) continue;
      const finalPath = join(dirs.downloadsDir, a.name.replace(/[/\\ ]/g, '_'));
      const destDir = a.dest === '.' ? dirs.runtimeDir : join(dirs.runtimeDir, a.dest);
      fs.mkdirp(destDir);
      push({ artifact: a.name });
      await seams.extract(finalPath, a.archive, destDir, a.stripPrefix);
      extracted.add(a.name);
      persist('extracting');
    }
    persist('materializing');
    push({ stage: 'materializing' });
    for (const a of manifest) {
      if (a.archive) continue;
      const finalPath = join(dirs.downloadsDir, a.name.replace(/[/\\ ]/g, '_'));
      const dest = join(dirs.runtimeDir, a.dest);
      fs.mkdirp(dirname(dest));
      if (!fs.exists(dest) || (a.sizeBytes > 0 && fs.size(dest) !== a.sizeBytes)) fs.copy(finalPath, dest);
    }

    // ── venv (scripted platforms only — the 整合包 ships its own runtime python) ──
    if (seams.platform !== 'win32' && !venvDone) {
      persist('venv');
      push({ stage: 'venv', artifact: 'python venv + requirements' });
      await seams.exec('python3', ['-m', 'venv', '.venv'], dirs.runtimeDir);
      const pip = join(dirs.runtimeDir, '.venv', 'bin', 'python');
      await seams.exec(pip, ['-m', 'pip', 'install', '-r', 'requirements.txt'], dirs.runtimeDir);
      venvDone = true;
      persist('venv');
    }

    // ── validate: the same launchability bar ttsRuntime enforces before spawning ──
    push({ stage: 'validating' });
    const pre = join(dirs.runtimeDir, 'GPT_SoVITS', 'pretrained_models');
    const launchable =
      fs.exists(join(dirs.runtimeDir, 'api_v2.py')) &&
      fs.exists(join(pre, 'chinese-roberta-wwm-ext-large')) &&
      fs.exists(join(pre, 'chinese-hubert-base'));
    if (!launchable) return fail('validating', 'Runtime incomplete after install — retry, or use manual placement.');

    persist('ready');
    push({ stage: 'ready', pct: 100 });
    return { ...st };
  } catch (e) {
    return fail(st.stage === 'failed' ? 'downloading' : st.stage, e instanceof Error ? e.message : String(e));
  }
}

// ── real seams (node implementations; only fakes run in tests) ──

// Structural child type — same workaround as supervisor.ts: bun-types' node:child_process shim
// doesn't surface EventEmitter's `on` on ChildProcess; the runtime object satisfies this shape.
type ProcLike = {
  stderr: { on(ev: 'data', cb: (d: Buffer) => void): unknown } | null;
  on(ev: 'error', cb: (e: Error) => void): unknown;
  on(ev: 'exit', cb: (code: number | null) => void): unknown;
};

function runProc(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((res, rej) => {
    // WHY as unknown as: see ProcLike — bun-types shim gap, runtime shape is correct.
    const c = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] }) as unknown as ProcLike;
    let err = '';
    c.stderr?.on('data', (d) => (err += d.toString()));
    c.on('error', (e) => rej(new Error(`${cmd}: ${e.message}`)));
    c.on('exit', (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} ${args[0] ?? ''} exited ${code}: ${err.slice(0, 300)}`)),
    );
  });
}

export function realSeams(): ProvisionSeams {
  return {
    platform: process.platform,
    fs: {
      exists: (p) => existsSync(p),
      size: (p) => statSync(p).size,
      mkdirp: (p) => mkdirSync(p, { recursive: true }),
      rename: (from, to) => renameSync(from, to),
      copy: (from, to) => {
        rmSync(to, { force: true });
        writeFileSync(to, readFileSync(from));
      },
      writeText: (p, s) => writeFileSync(p, s),
      readText: (p) => readFileSync(p, 'utf8'),
    },
    freeDiskBytes: (dir) => {
      const s = statfsSync(dir);
      return Number(s.bavail) * Number(s.bsize);
    },
    async download(url, partPath, resumeFrom, onBytes) {
      const headers: Record<string, string> = resumeFrom > 0 ? { range: `bytes=${resumeFrom}-` } : {};
      const r = await fetch(url, { headers, redirect: 'follow' });
      if (r.status !== 200 && r.status !== 206) throw new Error(`${url}: HTTP ${r.status}`);
      // A 200 to a Range request means the server restarted the payload — start the file over.
      const appending = resumeFrom > 0 && r.status === 206;
      const total = (appending ? resumeFrom : 0) + Number(r.headers.get('content-length') ?? 0);
      const ws = createWriteStream(partPath, { flags: appending ? 'a' : 'w' });
      let done = appending ? resumeFrom : 0;
      if (!r.body) throw new Error(`${url}: empty body`);
      const reader = r.body.getReader();
      try {
        for (;;) {
          const { done: eof, value } = await reader.read();
          if (eof) break;
          if (value) {
            await new Promise<void>((res, rej) => ws.write(value, (err) => (err ? rej(err) : res())));
            done += value.byteLength;
            onBytes(done, total);
          }
        }
      } finally {
        await new Promise<void>((res) => ws.end(() => res()));
      }
    },
    async extract(archive, kind, destDir, stripPrefix) {
      // System extractors via vetted argv (never a shell): tar handles tar.gz everywhere and zip on
      // Windows (bsdtar); ditto covers zip on macOS; 7z needs a system 7-Zip on Windows — absent →
      // a clear error steering to manual placement (recorded limitation).
      const strip = stripPrefix ? ['--strip-components', '1'] : [];
      if (kind === 'tar.gz') return runProc('tar', ['-xzf', archive, '-C', destDir, ...strip]);
      if (kind === 'zip') {
        if (process.platform === 'darwin' && !stripPrefix) return runProc('ditto', ['-x', '-k', archive, destDir]);
        return runProc('tar', ['-xf', archive, '-C', destDir, ...strip]); // bsdtar reads zip on mac + win
      }
      // 7z (the Windows 整合包). 7z has no --strip-components — hoist the top folder afterwards.
      for (const bin of ['7z', '7za', '7zr']) {
        try {
          await runProc(bin, ['x', archive, `-o${destDir}`, '-y']);
          if (stripPrefix) {
            const top = join(destDir, stripPrefix);
            if (existsSync(top)) {
              const { readdirSync, rmdirSync } = await import('node:fs');
              for (const entry of readdirSync(top)) renameSync(join(top, entry), join(destDir, entry));
              rmdirSync(top);
            }
          }
          return;
        } catch (e) {
          if (!(e instanceof Error) || !e.message.includes('ENOENT')) throw e;
        }
      }
      throw new Error(
        'The Windows package needs 7-Zip to unpack. Install it from 7-zip.org and click retry — ' +
          'the download is already saved, so it resumes instantly.',
      );
    },
    exec: (command, args, cwd) => runProc(command, args, cwd),
  };
}
