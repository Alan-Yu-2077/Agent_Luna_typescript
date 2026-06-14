# Initiative 7 — Open-source packaging + one-command startup (v0.14.0 – v0.14.2)

> **Status: 📋 PLANNED.** Priority: next after Initiative 6 (the body, ✅). Version range
> **v0.14.0 – v0.14.2**. Master: [`../README.md`](../README.md).

## The idea

Make Agent_Luna a real open-source project that **anyone can `git clone` and run on their own
machine (macOS / Linux / Windows) with one command — including yumi's voice.** Today the repo runs
only on Alan's machine because (a) there's no launcher, (b) the GPT-SoVITS TTS lives entirely outside
the repo (in the Python project), and (c) the repo lacks OSS hygiene (no LICENSE, a stale README).
This initiative bundles the TTS service into the repo as a separate-but-co-located process, gives one
command that starts the whole stack, and brings the repo to open-source-ready.

## Locked design decisions (this initiative — confirmed with Alan)

1. **TTS = GPT-SoVITS only (yumi's real voice).** Alan explicitly chose her real voice over a
   "lightweight zero-dependency default," accepting that **one-command therefore requires Docker +
   a first-run ~5 GB weights download**. The researched lightweight alternatives (Kokoro, sherpa-onnx,
   browser SpeechSynthesis) were **considered and rejected** — no lightweight engine can reproduce
   yumi's GPT-SoVITS-cloned voice, and the clone is not portable across engines.
2. **TTS is a separate service, bundled in the repo:** `services/tts/gpt-sovits/` (a `docker-compose.yml`
   referencing the community image + native `install` scripts as a fallback). **Weights/images are
   fetched at runtime, never committed.**
3. **One command** (`bun run dev` / `bun start`) starts `packages/server` (8787) + `packages/web`
   (5173) + the GPT-SoVITS sidecar together. **Docker is the default sidecar path** (so users need no
   Python); native install is the alternative.
4. **The TS dev-server drives the sidecar directly.** `packages/web/dev-server.ts` already proxies
   `/api/gpt-sovits/*`; this initiative makes it translate the app's `{text, voice}` into GPT-SoVITS
   `api_v2` (`/tts`) — letting us **drop the separate Python Node proxy** and stay self-contained.
5. **OSS hygiene is in scope:** `LICENSE` (MIT), a **rewritten README**, a complete `.env.example`,
   `THIRD_PARTY_LICENSES`, secret-scanning, and `.gitignore models/`.

## Locked design decisions referenced (REWRITE_CONTEXT.md)

- **Frontend scope / TTS "stay as-is"** (REWRITE_CONTEXT:42, :193): *"Live2D rendering + audio pipeline
  + GPT-SoVITS proxy stay as-is (cost/benefit)"*; *"TTS pipeline (Node proxy + Python GPT-SoVITS
  sidecar). **Untouched**."* — **Evolution, not contradiction:** the GPT-SoVITS **engine** is still
  not rewritten (reused as-is, MIT). What changes is its **packaging**: from "external + untouched"
  to "**bundled in the repo + one-command**," and the thin Node proxy's *translation* moves into the
  TS dev-server. Capture this as a refinement of the locked decision.
- **LD #9 (everything-as-tool)** — `voice_params` ride in the `message` envelope; the backend computes
  no TTS (REWRITE_CONTEXT:104). Unchanged — packaging doesn't touch the wire contract.

## Verified architectural facts (TS source, 2026-06-14)

1. `packages/web/dev-server.ts` forwards `/api/gpt-sovits/*` → `Bun.env['LUNA_TTS_PROXY']` raw
   ([`dev-server.ts:11,19,27`](../../../packages/web/dev-server.ts)). v0.14.0 makes this translate to
   `api_v2` instead of raw-forwarding to a Python proxy.
2. `packages/web/src/audio/ttsClient.ts` POSTs `{text, voice, provider}` to `<base>/speak` and returns
   a WAV ArrayBuffer ([`ttsClient.ts:9-15`](../../../packages/web/src/audio/ttsClient.ts)) — the
   client contract stays; only the server side of the proxy changes.
3. Root scripts today: `dev:server` = `bun run packages/server/src/main.ts`, `dev:web` =
   `bun packages/web/dev-server.ts` ([`package.json:7-8`](../../../package.json)). No `dev`/`start`
   launcher yet; `concurrently` is the planned add.
4. Repo OSS state: **no `LICENSE`**; `README.md` is stale ("scaffolding only … No runtime code yet");
   `.env` is gitignored + not tracked (no secret leak); vendored model assets in
   `packages/web/public/` total **7.7 MB** (committed, acceptable). `.gitignore` covers `.env` +
   `node_modules` + `*.sqlite` but not `models/`.

## Verified external facts (research workflow, 2026-06-14 — cited, web-checked)

- GPT-SoVITS: **MIT code + MIT weights**; HF `lj1995/GPT-SoVITS` ≈ **5.3 GB** (single files up to
  769 MB / 821 MB) → **cannot be vendored in git** (GitHub free Git-LFS = 1 GiB storage + 1 GiB/mo
  bandwidth; one clone blows the quota) → weights fetch at runtime (HF / HF-Mirror / ModelScope).
- Realistic distribution: community Docker image `xxxxrt666/gpt-sovits` (~9.8 GB runtime, before
  weights) **or** `install.sh --device <CU126|CU128|ROCM|MPS|CPU>` / `install.ps1`.
- "CPU = unusable" is a myth: Apple-Silicon M4 RTF ≈ **0.53** (faster than real-time); slowness is real
  mainly on older x86. The blocker is the **PyTorch + 5 GB + Python-3.10 setup burden**, not speed.
- Rejected alternatives (for the record): Coqui XTTS-v2 (non-commercial license + abandoned), F5-TTS
  (weights CC-BY-NC), edge-tts (Microsoft **cloud**, not self-hosted).

## Python parity notes (reference — `/Users/alanyu2077/Desktop/Agent_Luna`)

The reused engine: GPT-SoVITS `api_v2.py` (default `127.0.0.1:9880`, `/tts`); the Node proxy +
voice config in `TTS/server/gpt-sovits-service.js` + `TTS/browser/config.js` (voice id
`neuro-v2-e24`). `api_v2` request body: `{ text, text_lang, ref_audio_path, prompt_text, prompt_lang,
media_type:'wav', streaming_mode, ... }` → WAV. **Divergence:** we bundle this into THIS repo's
`services/tts/gpt-sovits/` and drive it from the TS dev-server (translating `{text,voice}` → that
body), rather than depending on the Python project's Node proxy.

## The hard part (recurring principles)

1. **Weights never enter git.** Every plan that touches models fetches them at runtime to a
   `.gitignore`d `models/` (or lets the Docker image fetch them). Document size + a GFW mirror.
2. **"One command" must stay literally one command** cross-platform — wire everything under a single
   `bun run dev`; the Docker prerequisite is the only thing the user installs first.
3. **Honesty in the README.** The quickstart must state the Docker + ~5 GB prerequisite up front — no
   "it just works" that then needs a 5 GB download.
4. **Live TTS is unverifiable in this dev environment** (no Docker + 5 GB here). Each plan verifies
   what it can in-repo (request translation, launcher wiring, compose validity, secret scans) and
   marks the full `docker compose up → hear yumi` flow as **owner-verified**.
5. **No secrets, ever.** A secret scan + `.env`-only-as-`.env.example` is a release gate.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.14.0](v0.14.0-bundle-tts.md) | v0.14.0 | Bundle GPT-SoVITS as `services/tts/gpt-sovits/` (docker-compose) + dev-server translates `{text,voice}`→`api_v2` (drop the Python proxy) | High | Initiative 6 | 📋 |
| [v0.14.1](v0.14.1-one-command.md) | v0.14.1 | Cross-platform one-command launcher (`bun run dev`/`start` via `concurrently`) + `bun run setup` (pull image + yumi voice model) | Medium | v0.14.0 | 📋 |
| [v0.14.2](v0.14.2-oss-hygiene.md) | v0.14.2 | OSS hygiene: MIT `LICENSE`, README rewrite, `.env.example`, `THIRD_PARTY_LICENSES`, secret-scan, `.gitignore models/` + **Initiative 7 close** | Low | v0.14.1 | 📋 |

## Acceptance criteria for the whole initiative

- [ ] With Docker installed, `git clone` → `bun install` → **one command** brings up server + web +
      GPT-SoVITS, and Luna speaks **in yumi's voice** in the browser (owner-verified with Docker).
- [ ] The TS dev-server talks to GPT-SoVITS `api_v2` directly; the Python Node proxy is no longer a
      dependency. `ttsClient` is unchanged.
- [ ] No model weights in git; `models/` is gitignored; weights fetch at runtime with a documented
      mirror fallback.
- [ ] `LICENSE` (MIT) present; README rewritten (quickstart + prereqs + features + architecture +
      one-command); `.env.example` complete; `THIRD_PARTY_LICENSES` lists GPT-SoVITS + pixi-live2d +
      yumi model terms.
- [ ] Secret scan clean (no key in tree or history); `tsc` + `bun test` still green.
- [ ] Cross-platform: the one command works on macOS/Linux/Windows (Windows graceful-shutdown caveat
      documented).

## Open questions blocking start (settle at build time)

1. **yumi's voice model hosting** — where does the fine-tuned `neuro-v2-e24` model (+ reference audio)
   live for OSS users to fetch (HF / ModelScope), and is base GPT-SoVITS + a reference clip enough, or
   is a custom fine-tuned checkpoint required? (Gates v0.14.0's voice config + v0.14.1's setup.)
2. **Docker-only vs native fallback** for the default one-command — Docker is the recommended default;
   decide whether to also ship/support the native `install.sh`/`install.ps1` path day one.
3. **Drop the Python Node proxy entirely** (translate in dev-server) vs keep it as an option.
4. **Windows graceful shutdown** of the multi-process launcher (Node runners can't SIGTERM cleanly on
   Windows — decide the acceptable behavior + document).
