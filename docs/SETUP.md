# Setup — bring your own model & voice

Luna ships with **no avatar model and no voice weights** — you supply your own. A fresh clone runs
text-only with a zero-setup browser voice; this guide covers adding an avatar and (optionally) a
higher-quality voice.

## The guided way (desktop app) — recommended

Since v0.35, the **desktop app's first launch opens a setup wizard** (中文/English) that covers this
entire guide interactively: chat API key (with a live connection test), memory embeddings, Tavily web
search, QWeather weather (each with a real "test this key" probe and links to the exact registration
consoles), then **drag-and-drop installs** for a Live2D model folder and a GPT-SoVITS voice pack —
the voice step can **download + deploy GPT-SoVITS itself and start the voice server for you**
(managed: crash-restart + clean shutdown included), and a live badge flips green when the voice is
up. Re-run it anytime from **Settings → Setup wizard → Re-run…**. `LUNA_SETUP_WIZARD=0` in
`luna.env` restores the minimal three-field screen.

Everything below is the manual/advanced path — the web-only (browser) flow, headless setups, and
what the wizard writes under the hood.

## 0. Minimum run (text only)

```sh
bun install
cp .env.example .env    # set ANTHROPIC_API_KEY (or an OpenAI-compatible gateway — see .env.example)
bun run dev             # server + web at http://localhost:5173
```

That's a complete, talking Luna: chat works, and she speaks with the browser's built-in voice (Web
Speech API — no download, no backend). The avatar area shows a friendly "No avatar installed" card
until you add a model.

## 1. Install a Live2D model

### Where to get one (free / redistributable)

- The **Live2D sample models** (Cubism free models) — https://www.live2d.com/en/learn/sample/
- **Booth.pm** and **VRoid Hub** have many free Live2D models — check each model's license before use.

You need a **Cubism 3+ / Live2D 4** model: a folder containing at least a `.model3.json` manifest, a
`.moc3`, a `textures/` atlas, and usually `.physics3.json` / motion files.

### Web (drop-in)

1. Copy the model folder into `packages/web/public/models/`, e.g.
   `packages/web/public/models/hana/hana.model3.json`.
2. Point Luna at it — in the browser devtools console (or your app's storage):
   ```js
   localStorage.setItem('luna:model-url', '/models/hana/hana.model3.json');
   ```
3. Refresh. She renders.

### Desktop (folder picker)

In the packaged desktop app, click **"Choose model folder…"** on the empty-avatar card and pick your
model folder. The app copies it into its user-data dir, remembers it (`LUNA_MODEL_URL`), and reloads.

### The expression-preset caveat (honest limitation)

Luna's expression map (`packages/web/src/live2d/paramMap.ts`) was tuned for one specific reference
model. A stock model will get **head turn, gaze-follow, and mouth/lip-sync**, but **blink, brows,
cheek, and tongue** parameters may no-op until someone writes a per-model preset (the parameter IDs
differ between models). The avatar works and emotes; it just won't use every expression channel out of
the box. Per-model presets are a planned follow-up.

## 2. Voice options

Set the backend in `.env` (or per-browser via `localStorage['luna:tts-backend']`): `browser` (default)
| `http` (self-hosted GPT-SoVITS) | `none` (silent).

### Browser (default, zero setup)

`LUNA_TTS_BACKEND=browser` — the Web Speech API. Works immediately, quality varies by OS/browser.

### GPT-SoVITS (custom cloned voice) — one-click in the desktop app

The highest-quality option, and since v0.37 the desktop wizard can do ALL of it — no terminal:

1. **Voice step → "Download & deploy GPT-SoVITS"** — Luna downloads the runtime (≈2 GB on
   macOS/Linux; the official ~5.7 GB 整合包 on Windows), resumable across quits, and validates it.
   On CN networks set `LUNA_TTS_HF_MIRROR=https://hf-mirror.com` in `luna.env` first. (While the
   per-OS installer is being validated this button is behind `LUNA_TTS_PROVISION=1`.)
2. **Drag your voice pack in** (the weights + reference-clip folder, e.g. from a creator's netdisk
   link) — Luna installs it, writes the api_v2 config, and **starts + supervises the voice server
   herself** (`LUNA_TTS_MANAGED=1`): crash-restart, clean shutdown, no orphaned process. The badge
   flips green; Test voice speaks.
3. Later, **drop a new pack anywhere on the running app** to swap voices — a confirm chip applies it.

On every launch the app shows a loading page until the voice has genuinely cold-started, then enters
(skippable after ~20s — a broken voice never locks you out). If an utterance ever can't be spoken
(the server is restarting), it falls back to the browser voice for that sentence instead of being
dropped.

#### Advanced: bring your own runtime / server

Point the wizard's "Advanced: choose an existing GPT-SoVITS folder" at your checkout (with
`LUNA_TTS_MANAGED=1` Luna launches it for you), or run the server entirely yourself — docker
(`services/tts/docker-compose.yml`) or a manual `api_v2.py` — and Luna just forwards to it:

```sh
LUNA_TTS_BACKEND=http
LUNA_TTS_URL=http://127.0.0.1:9880
LUNA_TTS_REF_AUDIO=/absolute/path/to/your-reference.wav   # as seen by the api_v2 server
LUNA_TTS_PROMPT_TEXT=the exact transcript of that reference clip
LUNA_TTS_TEXT_LANG=auto            # or zh / en / ja …
```

The forward maps a reply to an api_v2 `POST /tts` using these params; the browser only supplies the
text. A remote `LUNA_TTS_URL` is never managed — Luna only ever spawns a loopback server she
provisioned or you pointed her at.

### Other backends

Any HTTP TTS that returns audio can sit behind the same `http` backend if it speaks the api_v2 `/tts`
shape — or adapt the small translator in `packages/web/src/tts/apiV2.ts`. Popular self-hosted options:
**Piper** (fast, CPU), **Kokoro**, or a cloud endpoint like OpenAI `/v1/audio/speech`.

## 3. Everything else

`.env.example` documents the full configuration surface — model, provider/gateway, memory, proactive
agency, perception (time/weather), and voice — with sensible defaults. Copy it to `.env` and edit.
