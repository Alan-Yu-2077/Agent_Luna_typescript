// v0.37.2 (Initiative 27): the one-click GPT-SoVITS provisioner — download, deploy, validate, mark
// ready. Reproduces the owner's verified reference recipe (roberta + hubert + G2PW + lid.176 +
// the pinned checkout + a venv) on EVERY platform since v0.40.0 — Windows additionally fetches its
// own CPython and a shared FFmpeg as ordinary manifest artifacts, having replaced the 8.19 GB 整合包.
// Staged, resumable (`.part` + Range), disk-preflighted, and persisted to provision.json after every
// transition so a mid-install quit resumes. The engine is pure over injected seams (tests run it
// headlessly); `realSeams()` provides the node implementations. Every executed command is built from
// vetted constants + resolved paths — never anything derived from user content (the voicePack
// no-execute discipline, extended).

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type ArchiveKind = 'zip' | 'tar.gz';

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
  // v0.37.12: the ONLY real integrity gate. Content-length is not one: HuggingFace GZIPS the small
  // JSONs, so the header is absent and the length check silently no-ops — a captive portal's 200 HTML
  // page would be committed as `tokenizer.json`, cached forever (an existing file is never
  // re-fetched), pass `validating` (which only stats directories), mark the install `ready`, and then
  // crash api_v2 on a tokenizer parse error with no way back but deleting the folder by hand.
  // Measured from the artifacts a real clean-room install downloaded and then successfully ran.
  sha256?: string;
  archive?: ArchiveKind;
  stripPrefix?: string; // top-level dir inside the archive to strip while extracting
};

const HF_DEFAULT = 'https://huggingface.co';
// v0.37.12: the tag the reference instance actually runs — identified by hashing its
// AR/modules/patched_mha_with_cache.py against every release (537c028d… matches 2025-era tags) and by
// the presence of GPT_SoVITS/sv.py, which only v2Pro has and which its import graph uses.
// The old pin (20240821v2, Aug 2024) CRASHES ON IMPORT with any modern torch:
//   patched_mha_with_cache.py:41  NameError: name 'Tuple' is not defined
// — that file annotates with names it expects torch.nn.functional to re-export, which torch stopped
// doing. Upstream fixed it by dropping the annotations; the 2025 tags carry that fix. Proven by a
// real end-to-end install: the old tag's api_v2 died at import, this one boots.
const CODE_TAG = '20250606v2pro';

// The scripted recipe's model set is exactly what the reference instance loads for a CUSTOM voice:
// roberta + hubert (yaml custom section) + G2PW + lid.176 (text frontend). The multi-GB gsv
// pretrained checkpoints are NOT needed — a custom voice supplies its own t2s/vits weights.
// These three are the ENTIRE roberta directory upstream publishes; tokenizer.json is the fast
// tokenizer's self-contained definition (vocab included), so the usual BERT companions
// (tokenizer_config / special_tokens_map / added_tokens / vocab.txt) do not exist on the host and
// 404 — listing them hard-failed every install at the first one.
const ROBERTA_FILES: Array<[string, number, string]> = [
  ['config.json', 0, '3d57de2fd7e80d0e5c8ff194f0bbb6baa10df7e43fc262a0cc71298a78b0a3e5'],
  ['pytorch_model.bin', 651_225_145, 'e53a693acc59ace251d143d068096ae0d7b79e4b1b503fa84c9dcf576448c1d8'],
  ['tokenizer.json', 0, '173796956820ea27bd14f76bf28162607ff4254807e2948253eb5b46f5bb643b'],
];
const HUBERT_FILES: Array<[string, number, string]> = [
  ['config.json', 0, 'c3e5060a1277e0f078cc6be9da4528a605dba6ece93018981fe2c820e5c7b103'],
  ['preprocessor_config.json', 0, 'dcd684124d06722947939d41ea6ae58dbf10968c60a11a29f23ddc602c64a29b'],
  ['pytorch_model.bin', 188_811_417, '24164f129c66499d1346e2aa55f183250c223161ec2770c0da3d3b08cf432d3c'],
];

// v0.40.0: where the two Windows-only payloads land inside the checkout. Both are consumed by path,
// never by PATH lookup, so provisioning never depends on — or disturbs — what the machine has.
export const WIN_PY_DIR = 'pyruntime';
export const WIN_FFMPEG_DIR = 'ffmpeg';

// v0.40.0: what Windows needs ON TOP of the scripted recipe. macOS/Linux get a Python and an ffmpeg
// from a package manager; Windows has none, and the old answer was the 8.19 GB 整合包 that bundled
// both. These are ordinary manifest artifacts, so they inherit the resumable download, the checksum
// gate, the mirror hook and the progress bar instead of needing a second mechanism. Both are fetched
// from their upstream host to the USER's machine — the same model every model file already uses —
// so Luna redistributes neither.
function windowsExtras(): Artifact[] {
  return [
    {
      // python-build-standalone's install_only build: a self-contained CPython 3.11 carrying its own
      // vcruntime140 DLLs, so no VC++ redistributable install. It is used ONLY to build the venv and
      // is never registered with the OS (no PEP 514 registry key, no PATH entry, no bin shim), so a
      // provision can't disturb whatever Python the user already has.
      name: 'CPython 3.11 (windows x86_64)',
      url: 'https://github.com/astral-sh/python-build-standalone/releases/download/20260718/cpython-3.11.15%2B20260718-x86_64-pc-windows-msvc-install_only.tar.gz',
      dest: WIN_PY_DIR,
      sizeBytes: 48_400_412,
      sha256: 'c3d782be3733f779d585633da374ff1bd92400d4d74c0c3922aee1526446096b', // the release's own SHA256SUMS
      archive: 'tar.gz',
      stripPrefix: 'python',
    },
    {
      // torchcodec does NOT shell out to ffmpeg, whatever this file used to claim: it dlopens the
      // libav* DLLs and uses `ffmpeg.exe` purely to LOCATE the directory they sit in
      // (torchcodec/_core/ops.py — shutil.which('ffmpeg') → os.add_dll_directory(its dir)). A static
      // ffmpeg.exe therefore does nothing here; it must be a SHARED build with the DLLs beside the
      // exe. n7.1 is deliberate: torchcodec probes FFmpeg majors 4-8 and BtbN's `master` build is
      // 9-dev, which loads nothing and fails on the user's first sentence.
      name: 'FFmpeg 7.1 shared (windows x64, LGPL)',
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-lgpl-shared-7.1.zip',
      dest: WIN_FFMPEG_DIR,
      sizeBytes: 62_413_211,
      // No sha256, for the same structural reason the GitHub source tarball has none: BtbN rebuilds
      // the `latest` tag DAILY, so a pinned digest rots within a day and would hard-fail every
      // install forever. Integrity is enforced by the extractor instead — a captive-portal HTML page
      // is not a valid zip, and a failed extract deletes the cached file so retry re-fetches.
      archive: 'zip',
      stripPrefix: 'ffmpeg-n7.1-latest-win64-lgpl-shared-7.1',
    },
  ];
}

export function buildManifest(o: { platform: NodeJS.Platform; hfBase?: string }): Artifact[] {
  const hf = (o.hfBase ?? HF_DEFAULT).replace(/\/+$/, '');
  const models = 'GPT_SoVITS/pretrained_models';
  return [
    // v0.40.0: Windows runs the SAME recipe as everyone else now (it used to early-return a single
    // 8.19 GB 整合包), plus its own interpreter and ffmpeg.
    ...(o.platform === 'win32' ? windowsExtras() : []),
    {
      name: `GPT-SoVITS code (${CODE_TAG})`,
      url: `https://github.com/RVC-Boss/GPT-SoVITS/archive/refs/tags/${CODE_TAG}.tar.gz`,
      dest: '.',
      sizeBytes: 0,
      // v0.37.16 (re-audit): NO sha256 here on purpose. GitHub does NOT guarantee byte-stability of
      // auto-generated source tarballs — its Jan-2023 gzip change flipped every such checksum and
      // broke Homebrew and Go's module cache. A pinned hash would be a time bomb: the day GitHub
      // recompresses, every new install hard-fails at this first artifact. Integrity is enforced
      // structurally instead — a wrong body (an HTML page) is not a valid gzip, so `tar -xzf` fails
      // loudly at the extract stage, and a failed extract deletes the cached file so retry re-fetches.
      archive: 'tar.gz',
      stripPrefix: `GPT-SoVITS-${CODE_TAG}`,
    },
    ...ROBERTA_FILES.map(
      ([f, size, sha256]): Artifact => ({
        name: `roberta/${f}`,
        url: `${hf}/lj1995/GPT-SoVITS/resolve/main/chinese-roberta-wwm-ext-large/${f}`,
        dest: `${models}/chinese-roberta-wwm-ext-large/${f}`,
        sizeBytes: size,
        sha256,
      }),
    ),
    ...HUBERT_FILES.map(
      ([f, size, sha256]): Artifact => ({
        name: `hubert/${f}`,
        url: `${hf}/lj1995/GPT-SoVITS/resolve/main/chinese-hubert-base/${f}`,
        dest: `${models}/chinese-hubert-base/${f}`,
        sizeBytes: size,
        sha256,
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
      sha256: '46292be0374a49308069233cd5c147ae4c41806558e4781a2467a31a4d8099da',
      archive: 'zip',
    },
    // v0.37.12: g2p_en's corpora. Without cmudict, the FIRST English utterance dies with
    // `LookupError: Resource 'cmudict' not found` — nltk does not even auto-download it. The
    // clean-room install missed this entirely because it inherited the reference machine's
    // ~/nltk_data (downloaded back in June). Shipped as artifacts, not as an nltk.download() call:
    // resumable, checksummed, and the voice then works offline.
    {
      name: 'nltk/cmudict',
      url: `${NLTK_BASE}/corpora/cmudict.zip`,
      dest: 'nltk_data/corpora',
      sizeBytes: 896_069,
      sha256: 'd07cca47fd72ad32ea9d8ad1219f85301eeaf4568f8b6b73747506a71fb5afd6',
      archive: 'zip',
    },
    {
      name: 'nltk/averaged_perceptron_tagger_eng',
      url: `${NLTK_BASE}/taggers/averaged_perceptron_tagger_eng.zip`,
      dest: 'nltk_data/taggers',
      sizeBytes: 1_539_115,
      sha256: '6025f530624335c67d6547d44757b357b4e79bae030a0383e9887a92c1718f0b',
      archive: 'zip',
    },
    {
      name: 'nltk/averaged_perceptron_tagger',
      url: `${NLTK_BASE}/taggers/averaged_perceptron_tagger.zip`,
      dest: 'nltk_data/taggers',
      sizeBytes: 2_526_731,
      sha256: 'e1f13cf2532daadfd6f3bc481a49859f0b8ea6432ccdcd83e6a49a5f19008de9',
      archive: 'zip',
    },
    {
      name: 'lid.176.bin',
      url: 'https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin',
      dest: `${models}/fast_langdetect/lid.176.bin`,
      sizeBytes: 131_266_198,
      sha256: '7e69ec5451bc261cc7844e49e4792a85d7f09c06789ec800fc4a44aec362764e',
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

// Cache filename = artifact name + a short digest of its URL, so a manifest URL change can never
// silently reuse the file downloaded from the old (possibly dead or wrong) host.
function cacheName(a: Artifact): string {
  let h = 5381;
  for (let i = 0; i < a.url.length; i++) h = ((h * 33) ^ a.url.charCodeAt(i)) >>> 0;
  return `${a.name.replace(/[/\\ ]/g, '_')}.${h.toString(36)}`;
}

export type ProvisionFs = {
  exists(p: string): boolean;
  remove(p: string): void;
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
  // v0.37.12: the absolute path of a GPT-SoVITS-COMPATIBLE python (3.9-3.11), or null. Hardcoding
  // `python3` shipped a guaranteed failure: the reference machine's own `python3` is 3.14, which has
  // no torch wheels — the venv stage would die AFTER a ~1.6 GB download. Discovery + a preflight
  // gate is the fix; injectable so it tests without an interpreter.
  findPython(): string | null;
  // v0.37.12: torchcodec (which torchaudio >=2.9 decodes through) and ffmpeg-python both need the
  // ffmpeg BINARY. The reference machine has it via Homebrew, so it was invisible; a clean machine
  // does not, and every synth would fail at decode time — after the whole install "succeeded".
  // Returns its absolute path (null = absent) so the api_v2 child can be given it on PATH.
  findFfmpeg(): string | null;
  // v0.37.16 (re-audit): jieba_fast AND pyopenjtalk are sdist-only on PyPI (zero wheels, every
  // version) — pip MUST compile them. A clean machine with no Xcode CLT / build-essential passes
  // every other check, downloads ~1.6 GB, then dies at the venv stage. The reference machine had CLT
  // (cc/clang), so the e2e never saw it. Probe non-invasively (xcode-select on mac — it does NOT
  // trigger the install popup that `cc` would). Windows compiles nothing (jieba_fast is shimmed,
  // pyopenjtalk excluded, every other binary dep has a win_amd64 wheel), so it needs no compiler.
  hasCompiler(): boolean;
  sha256(path: string): string; // '' when unreadable
  platform: NodeJS.Platform;
};

export type ProvisionDirs = {
  ttsDir: string; // provision.json lives here (the marker ttsRuntime reads)
  runtimeDir: string; // <ttsDir>/runtime — the checkout being assembled
  downloadsDir: string; // <ttsDir>/downloads — artifacts + .part files (resume survives quits)
};

// The floor covers downloads + the extracted tree + the venv. Measured on the scripted path:
// 1.57 GB downloads + ~1.6 GB extracted + 1.8 GB venv ≈ 5 GB, so 12 GB leaves room.
// v0.40.0: ONE floor again. Windows used to need 25 GB because it downloaded an 8.19 GB archive that
// extracted to roughly its own size; running the same recipe as everyone else, it adds only its own
// interpreter (~78 MB extracted) and ffmpeg (~140 MB) on top of the shared ~5 GB.
const MIN_FREE_BYTES = 12_000_000_000;

// GPT-SoVITS (20240821v2) pins deps whose wheels exist for 3.9-3.11 only; the reference instance runs
// Homebrew python@3.11. Ordered best-first — 3.11 is the version the working install is proven on.
// A Finder-launched .app inherits a MINIMAL PATH (/usr/bin:/bin:/usr/sbin:/sbin) — Homebrew's
// /opt/homebrew/bin is NOT on it. Probing bare names would ENOENT on a machine that HAS python 3.11,
// and fall through to the system python3 (3.9.6 on macOS). Probe absolute locations first, exactly
// as resolveDevLauncher already does for the bun binary. Bare names last, for a PATH-rich launch.
// v0.37.15 (audit): 3.11 is what the reference instance runs and what the proven venv was built on.
// 3.10 is accepted (torch/transformers/tokenizers/numba all still ship >=3.10 wheels). 3.9 is NOT:
// modern torch/transformers/tokenizers dropped it, so a 3.9 venv silently resolves DOWNGRADED
// versions (torch 2.8 + numpy 2.0 in a real test) that were never validated against the 2025 code
// tag. `/usr/bin/python3` (3.9.6 on macOS) is dropped for the same reason — better to fail preflight
// with a clear hint than to build a runtime that installs 'ready' and crash-loops.
export const PYTHON_CANDIDATES = [
  '/opt/homebrew/bin/python3.11',
  '/opt/homebrew/bin/python3.10',
  '/usr/local/bin/python3.11',
  '/usr/local/bin/python3.10',
  '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3',
  '/Library/Frameworks/Python.framework/Versions/3.10/bin/python3',
  '/usr/bin/python3.11',
  '/usr/bin/python3.10',
  'python3.11',
  'python3.10',
] as const;

// Same story for ffmpeg — and the api_v2 CHILD needs it on ITS path too (torchcodec shells out to
// it), so the discovered directory is prepended to the child's PATH by the supervisor.
export const FFMPEG_CANDIDATES = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  'ffmpeg',
] as const;

// v0.40.0: the api_v2 CHILD needs the ffmpeg DIRECTORY, because torchcodec dlopens the libav* shared
// libraries from it (it locates them via `shutil.which('ffmpeg')` → `os.add_dll_directory`). The
// provisioned Windows checkout carries its own shared build; the legacy 整合包 layouts are still
// probed so an already-provisioned v0.39 machine keeps working until it re-provisions. Absent → null,
// and system discovery covers the BYO/mac/linux cases.
export function checkoutFfmpeg(
  checkout: string,
  platform: NodeJS.Platform,
  exists: (p: string) => boolean,
): string | null {
  const names =
    platform === 'win32'
      ? [
          join(checkout, WIN_FFMPEG_DIR, 'bin', 'ffmpeg.exe'), // v0.40.0 provisioned
          join(checkout, 'runtime', 'ffmpeg.exe'), // legacy 整合包
          join(checkout, 'ffmpeg.exe'),
        ]
      : [];
  for (const n of names) if (exists(n)) return n;
  return null;
}

// v0.40.0: the interpreter the venv is built FROM. On Windows that is the provisioned CPython — the
// machine is not required to have one, and we deliberately never look for one. Pure so it tests.
export function recipePython(runtimeDir: string, platform: NodeJS.Platform, discovered: string | null): string | null {
  return platform === 'win32' ? join(runtimeDir, WIN_PY_DIR, 'python.exe') : discovered;
}

// v0.40.0: a venv's interpreter, whose location is one of the few genuine POSIX/Windows layout
// differences. Same shape as ttsRuntime.venvPython — kept in sync deliberately, since the provisioner
// WRITES what that module then launches.
export function venvPythonPath(runtimeDir: string, platform: NodeJS.Platform): string {
  return platform === 'win32'
    ? join(runtimeDir, '.venv', 'Scripts', 'python.exe')
    : join(runtimeDir, '.venv', 'bin', 'python');
}
// v0.37.12: Luna installs its OWN inference dependency set, NOT the upstream requirements.txt.
// Why: that file pins `numba==0.56.4`, whose installer refuses Python 3.11 outright ("Cannot install
// on Python version 3.11.15; only versions >=3.7,<3.11 are supported") — so `pip install -r
// requirements.txt` CANNOT succeed on the very python GPT-SoVITS recommends. It also drags in
// training/WebUI-only weight (gradio, funasr, modelscope, faster-whisper, tensorboard) that api_v2
// never imports. This list is derived from the actual import graph of api_v2 + TTS_infer_pack + text,
// and every version floor matches the reference instance's proven-working venv (py3.11, numba 0.65,
// numpy 1.26, librosa 0.10, torch 2.x). torch/torchaudio are installed separately (see below) so
// Linux can take the CPU index instead of pulling a ~2.5 GB CUDA build.
export const INFERENCE_REQUIREMENTS = `# Luna: GPT-SoVITS api_v2 INFERENCE deps. NOT the upstream requirements.txt, which pins
# numba==0.56.4 — whose installer REFUSES python 3.11 ("only versions >=3.7,<3.11 are supported"), so
# \`pip install -r requirements.txt\` cannot succeed on the python GPT-SoVITS itself recommends.
# Every line below was proven by a real end-to-end install: booting api_v2 from a runtime built with
# this list, and synthesizing audio. The version ceilings are not decoration — each one pins a
# breakage that actually happened during that run.
numpy>=1.24,<2
scipy
librosa>=0.10,<0.11
numba>=0.59
matplotlib
soundfile
# gradio's latest drags in huggingface-hub 1.x, which transformers rejects at import
# ("huggingface-hub>=0.34.0,<1.0 is required ... but found 1.23.0"). Hold it below 1.
huggingface-hub>=0.26,<1
transformers>=4.50,<5
tokenizers<1
peft
pytorch-lightning>=2.0
x-transformers
rotary-embedding-torch
sentencepiece
onnxruntime
# NOT optional, however much it looks it: tools/my_utils.py imports gradio, and TTS.py imports tools.
gradio>=4.44,<5
fastapi
uvicorn
pydantic>=2
PyYAML
tqdm
psutil
chardet
ffmpeg-python
jieba
# v0.40.0: jieba_fast is sdist-only on PyPI and there is no MSVC on a stock Windows box, so Windows
# gets the pure-Python jieba behind a shim package instead (writeJiebaShim). Measured cost: GPT-SoVITS'
# hot path is posseg.lcut, and jieba_fast's C acceleration is wired into Tokenizer.__cut_DAG only —
# NOT into POSTokenizer — so on TTS-length sentences the delta is ~0.001 ms.
jieba_fast; sys_platform != 'win32'
cn2an
pypinyin
g2p_en
nltk
wordsegment
# v0.40.0: also sdist-only, and it needs CMake + a C++ toolchain on top. Windows omits it, which is
# safe because GPT-SoVITS resolves language modules lazily (cleaner.py __import__s per language), so
# text.japanese — the only importer — never loads for zh/en. Japanese input on Windows fails the
# utterance, and the v0.37.4 ladder speaks it with the browser voice rather than dropping it.
pyopenjtalk>=0.4; sys_platform != 'win32'
fast-langdetect
# text/LangSegmenter/langsegmenter.py imports it; nothing else pulls it in
split-lang
opencc
g2pk2
ko_pron
jamo
ToJyutping
python-mecab-ko; sys_platform != 'win32'
`;

// v0.40.0: Windows never sees this — it compiles nothing (jieba_fast is shimmed, pyopenjtalk is
// excluded by marker, and every other binary dep ships a win_amd64 wheel), so the gate stays exempt
// there rather than being made MSVC-aware.
export const COMPILER_HINT =
  'GPT-SoVITS has two dependencies (jieba_fast, pyopenjtalk) that pip must compile from source on this platform, and no C compiler was found. Install one — macOS: `xcode-select --install`; Debian/Ubuntu: `sudo apt install build-essential`; Fedora: `sudo dnf groupinstall "Development Tools"` — then click retry.';
export const FFMPEG_HINT =
  'GPT-SoVITS decodes your reference clip with FFmpeg, which is not installed. Get it — macOS: `brew install ffmpeg`; Linux: `apt install ffmpeg` (or your package manager) — then click retry.';
const NLTK_BASE = 'https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages';

// v0.40.0: the Windows stand-in for jieba_fast (sdist-only, and a stock Windows box has no MSVC).
// jieba_fast is an accelerated FORK of jieba with the same surface, and plain jieba is already an
// install dependency, so the shim is a re-export — but it MUST be a package, not a module:
// chinese2.py does `import jieba_fast.posseg as psg`, which a single jieba_fast.py cannot satisfy
// (ModuleNotFoundError: 'jieba_fast' is not a package). Attribute access falls through via PEP 562
// __getattr__ rather than an enumerated re-export list, so a call site we haven't read still works.
// If this is wrong the failure is loud and immediate: TextPreprocessor imports text.chinese at
// startup, so api_v2 dies on boot rather than mis-synthesizing.
export const JIEBA_SHIM_INIT = `# Generated by Luna. jieba_fast has no Windows wheel and needs MSVC to build; jieba is the same API.
import jieba as _jieba
from jieba import *  # noqa: F401,F403


def __getattr__(name):  # PEP 562 — anything not re-exported above still resolves
    return getattr(_jieba, name)
`;

export const JIEBA_SHIM_POSSEG = `# Generated by Luna. See jieba_fast/__init__.py.
import jieba.posseg as _posseg
from jieba.posseg import *  # noqa: F401,F403


def __getattr__(name):
    return getattr(_posseg, name)
`;

// Windows venvs put site-packages at a fixed <venv>/Lib/site-packages (no python-version segment),
// which is why the shim can be placed without probing for the interpreter's version.
export function winSitePackages(runtimeDir: string): string {
  return join(runtimeDir, '.venv', 'Lib', 'site-packages');
}

export const PYTHON_HINT =
  'GPT-SoVITS needs Python 3.10 or 3.11 (3.11 recommended; 3.9 no longer works — modern torch dropped it). Install it — macOS: `brew install python@3.11`; Windows: python.org 3.11; Linux: your package manager — then click retry.';

// v0.40.0: `recipe` is what lets the recipe CHANGE. Windows machines provisioned before this version
// hold a `ready` marker over an 8.19 GB 整合包 tree with no venv and no nltk data; without a version
// here they would keep launching it forever and never see the new layout. Absent = 1.
const RECIPE = 2;
// …but the on-disk tree only CHANGED on Windows (整合包 → scripted). On macOS/Linux the recipe-1 and
// recipe-2 trees are byte-identical: the manifest is unchanged and the only requirements edits are
// `; sys_platform != 'win32'` markers that no-op off Windows. So an older POSIX marker still points
// at a launchable runtime, and invalidating it would force a pointless multi-GB re-provision plus a
// silent drop to the browser voice. This floor says "the POSIX tree has not changed since recipe 1";
// a FUTURE recipe that alters the POSIX layout must raise it to its own number.
const POSIX_TREE_UNCHANGED_SINCE = 1;
type Marker = {
  state: string;
  recipe?: number;
  stage?: ProvisionStage;
  error?: string;
  extracted?: string[];
  venvDone?: boolean;
};

// Whether a `ready` marker describes a runtime THIS version can launch. Platform-aware: Windows
// demands the exact current recipe (its tree changed shape); elsewhere any recipe back to
// POSIX_TREE_UNCHANGED_SINCE is fine (the tree did not). Pure so it unit-tests; the default platform
// keeps the callers that don't thread one honest against the host they actually run on.
export function markerIsCurrent(
  m: { state?: unknown; recipe?: unknown },
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (m.state !== 'ready') return false;
  const recipe = typeof m.recipe === 'number' ? m.recipe : 1;
  return platform === 'win32' ? recipe === RECIPE : recipe >= POSIX_TREE_UNCHANGED_SINCE && recipe <= RECIPE;
}

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
  if (markerIsCurrent(marker, seams.platform)) {
    const done: ProvisionStatus = { stage: 'ready', pct: 100, bytesDone: 0, bytesTotal: 0 };
    onStatus(done);
    return done;
  }
  // A marker from an older recipe describes a tree this version cannot use, so its resume state is
  // meaningless — start the new recipe from scratch rather than "resuming" into a foreign layout.
  const stale = marker.state === 'ready';
  const extracted = new Set(stale ? [] : (marker.extracted ?? []));
  let venvDone = !stale && marker.venvDone === true;

  const totalKnown = manifest.reduce((n, a) => n + a.sizeBytes, 0);
  const st: ProvisionStatus = { stage: 'preflight', pct: 0, bytesDone: 0, bytesTotal: totalKnown };
  const push = (patch: Partial<ProvisionStatus>): void => {
    Object.assign(st, patch);
    onStatus({ ...st });
  };
  const persist = (state: string, extra: Partial<Marker> = {}): void =>
    writeMarker(dirs, fs, { state, recipe: RECIPE, extracted: [...extracted], venvDone, ...extra });
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
    // v0.37.12: the venv needs a 3.10/3.11 python. Discover it HERE — failing after a 1.6 GB download
    // (which is what a hardcoded `python3` did on any machine whose python3 is 3.12+) is unforgivable.
    // v0.40.0: Windows brings its own (the manifest's CPython), so it is neither discovered nor
    // required — recipePython resolves to the in-tree interpreter the download stage is about to
    // place. Note it does not exist YET at preflight; nothing dereferences it until the venv stage.
    const python = recipePython(dirs.runtimeDir, seams.platform, seams.findPython());
    if (python === null) return fail('preflight', PYTHON_HINT);
    // ffmpeg: Windows gets a shared build from the manifest, so only the scripted platforms — which
    // rely on a system one — are gated here. The compiler gate is Windows-exempt for a different
    // reason since v0.40.0: it COMPILES NOTHING (jieba_fast shimmed, pyopenjtalk excluded by marker,
    // every other binary dep has a win_amd64 wheel). Do not "fix" this by un-exempting it —
    // hasCompiler() probes `cc`, which no Windows machine has, MSVC or not.
    if (seams.platform !== 'win32' && seams.findFfmpeg() === null) return fail('preflight', FFMPEG_HINT);
    if (seams.platform !== 'win32' && !seams.hasCompiler()) return fail('preflight', COMPILER_HINT);

    // ── download (resumable). The rename .part → final IS the commit: a file at `finalPath` is, by
    // construction, one that finished and matched what the server promised. v0.37.9: completion is
    // checked against the SERVER's content-length for this download, never against a hardcoded size
    // (which was wrong for roberta and would have failed every real install forever). A chunked
    // response (GitHub archives send no content-length) reports total 0 → nothing to check.
    persist('downloading');
    push({ stage: 'downloading' });
    let doneBytes = 0;
    for (const a of manifest) {
      // The cache key includes the URL: v0.37.9 moved G2PWModel off a DEAD host under an unchanged
      // name, so a name-only key would have silently reused the broken file forever.
      const finalPath = join(dirs.downloadsDir, cacheName(a));
      // A cached file is re-verified, never trusted on existence alone (see Artifact.sha256).
      if (fs.exists(finalPath) && a.sha256 && seams.sha256(finalPath) !== a.sha256) {
        fs.remove(finalPath);
      }
      if (!fs.exists(finalPath)) {
        const part = `${finalPath}.part`;
        // A .part at or past the remote size can never complete (a Range beyond EOF is a 416) —
        // start it over instead of retrying into a permanent dead end.
        const partSize = fs.exists(part) ? fs.size(part) : 0;
        const resumeFrom = a.sizeBytes > 0 && partSize >= a.sizeBytes ? 0 : partSize;
        if (resumeFrom === 0 && partSize > 0) fs.remove(part);
        push({ artifact: a.name });
        let served = 0; // the server's own content-length — absent for HF's gzipped JSONs
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
        if (a.sha256) {
          const got = seams.sha256(part);
          if (got !== a.sha256) {
            fs.remove(part); // a 200 that isn't the file (mirror error page, proxy, corruption)
            return fail(
              'downloading',
              `${a.name}: content did not match its checksum — the download server returned something else ` +
                `(a sign-in page, a mirror error). Check LUNA_TTS_HF_MIRROR, then retry.`,
            );
          }
        }
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
      const finalPath = join(dirs.downloadsDir, cacheName(a));
      const destDir = a.dest === '.' ? dirs.runtimeDir : join(dirs.runtimeDir, a.dest);
      fs.mkdirp(destDir);
      push({ artifact: a.name });
      try {
        await seams.extract(finalPath, a.archive, destDir, a.stripPrefix);
      } catch {
        fs.remove(finalPath); // a file that won't extract is useless cached — force a fresh download
        return fail('extracting', `${a.name}: could not extract (corrupt or wrong download) — retry.`);
      }
      extracted.add(a.name);
      persist('extracting');
    }
    persist('materializing');
    push({ stage: 'materializing' });
    for (const a of manifest) {
      if (a.archive) continue;
      const finalPath = join(dirs.downloadsDir, cacheName(a));
      const dest = join(dirs.runtimeDir, a.dest);
      fs.mkdirp(dirname(dest));
      if (!fs.exists(dest) || (a.sizeBytes > 0 && fs.size(dest) !== a.sizeBytes)) fs.copy(finalPath, dest);
    }

    // ── venv (every platform since v0.40.0 — Windows used to be exempt because the 整合包 shipped
    // its own embedded python; it now builds the same venv from the manifest's CPython) ──
    if (!venvDone) {
      persist('venv');
      push({ stage: 'venv', artifact: 'python venv + requirements' });
      await seams.exec(python, ['-m', 'venv', '.venv'], dirs.runtimeDir);
      const pip = venvPythonPath(dirs.runtimeDir, seams.platform);
      await seams.exec(pip, ['-m', 'pip', 'install', '--upgrade', 'pip'], dirs.runtimeDir);
      // torch on its own: PyPI's linux torch is a ~2.5 GB CUDA build, and Luna runs api_v2 on CPU.
      // v0.37.15 (audit): CEILINGS. These were unpinned, so the next torch major (which can drop an API
      // the pinned 20250606v2pro tag or torchcodec relies on) would land on every fresh install with
      // nothing to stop it. The floor/ceiling brackets the proven combo (torch 2.13 / torchaudio 2.11
      // / torchcodec 0.14) without freezing to an exact build that will vanish from the CPU index.
      const torchPkgs = ['torch>=2.4,<2.14', 'torchaudio>=2.4,<2.14', 'torchcodec>=0.4,<0.16'];
      const torchArgs =
        seams.platform === 'linux'
          ? ['-m', 'pip', 'install', '--index-url', 'https://download.pytorch.org/whl/cpu', ...torchPkgs]
          : ['-m', 'pip', 'install', ...torchPkgs];
      await seams.exec(pip, torchArgs, dirs.runtimeDir);
      // …then OUR inference list, never the upstream requirements.txt (see INFERENCE_REQUIREMENTS).
      const reqPath = join(dirs.runtimeDir, 'luna-requirements.txt');
      fs.writeText(reqPath, INFERENCE_REQUIREMENTS);
      await seams.exec(pip, ['-m', 'pip', 'install', '-r', reqPath], dirs.runtimeDir);
      // v0.40.0: Windows compiles nothing, so jieba_fast — which pip just skipped via its marker —
      // is supplied as a re-export package over plain jieba. Written AFTER the requirements install
      // so pip cannot clobber it, and into site-packages so it resolves the same way a real
      // dependency would. chinese2.py imports it at api_v2 startup, so a mistake here is loud.
      if (seams.platform === 'win32') {
        const shim = join(winSitePackages(dirs.runtimeDir), 'jieba_fast');
        fs.mkdirp(shim);
        fs.writeText(join(shim, '__init__.py'), JIEBA_SHIM_INIT);
        fs.writeText(join(shim, 'posseg.py'), JIEBA_SHIM_POSSEG);
      }
      // v0.37.12: pyopenjtalk fetches its 22.6 MB dictionary on FIRST USE — i.e. mid-conversation, over
      // the network, or not at all. Force it here, inside the install. (The nltk corpora, whose absence
      // is even worse — English G2P raises LookupError rather than downloading — are manifest artifacts
      // instead: checksummed, resumable, mirrorable, and visible in the progress bar.)
      // v0.40.0: skipped on Windows, where pyopenjtalk is not installed at all — running it there
      // would raise ImportError and fail the whole provision at the last step.
      if (seams.platform !== 'win32') {
        push({ stage: 'venv', artifact: 'language data' });
        await seams.exec(pip, ['-c', 'import pyopenjtalk; pyopenjtalk.g2p("テスト")'], dirs.runtimeDir);
      }
      venvDone = true;
      persist('venv');
    }

    // ── validate: the same launchability bar ttsRuntime enforces before spawning ──
    push({ stage: 'validating' });
    const pre = join(dirs.runtimeDir, 'GPT_SoVITS', 'pretrained_models');
    // v0.37.12: check EVERY load-bearing piece, not just the two model dirs — a marker that says
    // `ready` while the venv or G2PW is missing sends ttsRuntime off to spawn an interpreter that
    // isn't there, and the failure surfaces as a mystery voice crash-loop instead of an install error.
    // v0.40.0: no platform exemptions. Windows used to skip the venv and cmudict checks, so a partial
    // install still wrote `ready`; ttsRuntime then spawned a bare `python` off PATH, restarted three
    // times and landed in `gave-up` with nothing anywhere saying why.
    const required: Array<[string, string]> = [
      ['api_v2.py', join(dirs.runtimeDir, 'api_v2.py')],
      ['roberta', join(pre, 'chinese-roberta-wwm-ext-large', 'pytorch_model.bin')],
      ['hubert', join(pre, 'chinese-hubert-base', 'pytorch_model.bin')],
      ['G2PWModel', join(dirs.runtimeDir, 'GPT_SoVITS', 'text', 'G2PWModel')],
      ['python venv', venvPythonPath(dirs.runtimeDir, seams.platform)],
      // Without cmudict, English synthesis raises LookupError on the FIRST utterance.
      ['English pronunciation data', join(dirs.runtimeDir, 'nltk_data', 'corpora', 'cmudict')],
    ];
    if (seams.platform === 'win32') {
      // The two payloads that only Windows provisions, plus the shim without which api_v2 cannot
      // even import text.chinese. Each one's absence is a first-sentence failure, not a boot failure,
      // so nothing downstream would catch it.
      required.push(['ffmpeg libraries', join(dirs.runtimeDir, WIN_FFMPEG_DIR, 'bin', 'ffmpeg.exe')]);
      required.push(['jieba shim', join(winSitePackages(dirs.runtimeDir), 'jieba_fast', 'posseg.py')]);
    }
    const missing = required.filter(([, path]) => !fs.exists(path)).map(([name]) => name);
    if (missing.length > 0)
      return fail('validating', `Runtime incomplete after install (missing: ${missing.join(', ')}) — retry.`);

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
  stdout: { on(ev: 'data', cb: (d: Buffer) => void): unknown } | null;
  stderr: { on(ev: 'data', cb: (d: Buffer) => void): unknown } | null;
  on(ev: 'error', cb: (e: Error) => void): unknown;
  on(ev: 'exit', cb: (code: number | null) => void): unknown;
};

// v0.37.15 (audit): the provisioner's pip/torch children run for 10-30 min. If the user quits during
// the install they were orphaned — kept downloading to userData with the app gone, and the leftover
// half-built venv collided with the next launch's resume. Track live children; main.ts kills them on
// quit alongside the supervisors.
const liveProcs = new Set<ReturnType<typeof spawn>>();
export function killProvisioners(): void {
  for (const c of liveProcs) {
    try {
      c.kill();
    } catch {
      /* already gone */
    }
  }
  liveProcs.clear();
}

function runProc(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((res, rej) => {
    // v0.37.12: capture BOTH streams. pip prints its real diagnosis on stdout ("Cannot install on
    // Python version 3.11.15", the failing package, the compiler error) and only a summary on
    // stderr — this used to `ignore` stdout and truncate stderr to 300 chars, so the single most
    // likely failure of the whole flow surfaced to the user as an unactionable stub.
    // WHY as unknown as: bun-types' child_process shim gap; the runtime shape is correct.
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    liveProcs.add(child);
    const c = child as unknown as ProcLike;
    let out = '';
    c.stdout?.on('data', (d) => (out += d.toString()));
    c.stderr?.on('data', (d) => (out += d.toString()));
    c.on('error', (e) => {
      liveProcs.delete(child);
      rej(new Error(`${cmd}: ${e.message}`));
    });
    c.on('exit', (code) => {
      liveProcs.delete(child);
      if (code === 0) {
        res();
        return;
      }
      // The tail is where the real error lives (pip's traceback + "ERROR:" line), not the head.
      const tail = out.trim().split('\n').slice(-14).join('\n');
      rej(new Error(`${cmd} ${args.slice(0, 3).join(' ')} exited ${code}\n${tail}`));
    });
  });
}

export function realSeams(): ProvisionSeams {
  return {
    platform: process.platform,
    fs: {
      exists: (p) => existsSync(p),
      remove: (p) => rmSync(p, { force: true }),
      size: (p) => statSync(p).size,
      mkdirp: (p) => mkdirSync(p, { recursive: true }),
      rename: (from, to) => renameSync(from, to),
      // v0.40.0: copyFileSync, not writeFileSync(readFileSync(…)). The old shape materialized the
      // whole file in the main process — 651 MB for roberta alone, and above Node's 2 GiB buffer
      // ceiling it throws outright.
      copy: (from, to) => {
        rmSync(to, { force: true });
        copyFileSync(from, to);
      },
      writeText: (p, s) => writeFileSync(p, s),
      readText: (p) => readFileSync(p, 'utf8'),
    },
    // v0.40.0: STREAMING. `readFileSync` throws ERR_FS_FILE_TOO_LARGE above 2 GiB, and the catch
    // below turned that into '' — which never equals the expected digest, so the caller reported a
    // checksum mismatch and DELETED the .part. The 8.19 GB Windows 整合包 hit this every single time:
    // download 8 GB, throw it away, blame the server. Nothing in the current manifest exceeds 651 MB,
    // but a hash function that silently fails on big files is a trap for the next artifact.
    sha256: (p) => {
      try {
        const h = createHash('sha256');
        const fd = openSync(p, 'r');
        try {
          const buf = Buffer.allocUnsafe(1 << 20);
          for (;;) {
            const n = readSync(fd, buf, 0, buf.length, null);
            if (n === 0) break;
            h.update(buf.subarray(0, n));
          }
        } finally {
          closeSync(fd);
        }
        return h.digest('hex');
      } catch {
        return '';
      }
    },
    freeDiskBytes: (dir) => {
      const s = statfsSync(dir);
      return Number(s.bavail) * Number(s.bsize);
    },
    // Ask each candidate for its own version rather than trusting the name — `python3.11` on PATH
    // could be anything. Returns the first that self-reports 3.9-3.11.
    findFfmpeg: () => {
      for (const cand of FFMPEG_CANDIDATES) {
        try {
          if (spawnSync(cand, ['-version'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).status === 0)
            return cand;
        } catch {
          /* not here — next */
        }
      }
      return null;
    },
    hasCompiler: () => {
      try {
        if (process.platform === 'darwin') {
          // `xcode-select -p` exits 0 only when the CLT (or Xcode) is installed — and, unlike `cc`,
          // it never triggers the OS "install command line developer tools" popup on a bare machine.
          return spawnSync('xcode-select', ['-p'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).status === 0;
        }
        return spawnSync('cc', ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).status === 0;
      } catch {
        return false;
      }
    },
    findPython: () => {
      for (const cand of PYTHON_CANDIDATES) {
        try {
          const out = spawnSync(cand, ['-c', 'import sys;print("%d.%d"%sys.version_info[:2])'], {
            encoding: 'utf8',
            timeout: 5000,
            windowsHide: true,
          });
          const v = (out.stdout ?? '').trim();
          if (out.status === 0 && /^3\.(10|11)$/.test(v)) return cand;
        } catch {
          /* not on PATH — try the next */
        }
      }
      return null;
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
    // v0.40.0: the `7z` arm is gone with the 整合包 that was its only consumer, and with it the
    // bundled 7zr.exe, its fetch script, and the "install 7-Zip and retry" dead end.
    async extract(archive, kind, destDir, stripPrefix) {
      // System extractors via vetted argv (never a shell): tar handles tar.gz everywhere and zip on
      // Windows (bsdtar); ditto covers zip on macOS; unzip on Linux.
      const strip = stripPrefix ? ['--strip-components', '1'] : [];
      if (kind === 'tar.gz') return runProc('tar', ['-xzf', archive, '-C', destDir, ...strip]);
      if (process.platform === 'darwin' && !stripPrefix) return runProc('ditto', ['-x', '-k', archive, destDir]);
      // GNU tar — which IS `tar` on Linux — cannot read zip at all (bsdtar can, which is why this
      // looked fine on macOS/Windows). Linux gets unzip.
      if (process.platform === 'linux') return runProc('unzip', ['-q', '-o', archive, '-d', destDir]);
      return runProc('tar', ['-xf', archive, '-C', destDir, ...strip]); // bsdtar on mac + win
    },
    exec: (command, args, cwd) => runProc(command, args, cwd),
  };
}
