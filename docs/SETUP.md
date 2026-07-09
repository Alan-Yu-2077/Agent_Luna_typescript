# Setup — bring your own model & voice

Luna ships with **no avatar model and no voice weights** — you supply your own. A fresh clone runs
text-only with a zero-setup browser voice; this guide covers adding an avatar and (optionally) a
higher-quality voice.

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

### GPT-SoVITS via `api_v2` (bring your own voice)

The highest-quality option. **You run GPT-SoVITS yourself** and Luna's `/api/tts` forward talks to its
`api_v2` HTTP server directly — no glue code, no vendored Python. **No voice weights ship with Luna;
bring or train your own** (or use a GPT-SoVITS base voice).

```sh
# 1. Put your GPT-SoVITS weights under services/tts/pretrained_models/ and a reference clip under
#    services/tts/voice/ (both are git-ignored — nothing is committed).
# 2. Pick an image / build the upstream repo (see services/tts/docker-compose.yml), then:
docker compose -f services/tts/docker-compose.yml up
```

Then in `.env`:

```sh
LUNA_TTS_BACKEND=http
LUNA_TTS_URL=http://127.0.0.1:9880
LUNA_TTS_REF_AUDIO=/workspace/voice/your-reference.wav   # path INSIDE the container
LUNA_TTS_PROMPT_TEXT=the exact transcript of that reference clip
LUNA_TTS_TEXT_LANG=auto            # or zh / en / ja …
```

The forward maps a reply to an api_v2 `POST /tts` using these params; the browser only supplies the
text.

### Other backends

Any HTTP TTS that returns audio can sit behind the same `http` backend if it speaks the api_v2 `/tts`
shape — or adapt the small translator in `packages/web/src/tts/apiV2.ts`. Popular self-hosted options:
**Piper** (fast, CPU), **Kokoro**, or a cloud endpoint like OpenAI `/v1/audio/speech`.

## 3. Everything else

`.env.example` documents the full configuration surface — model, provider/gateway, memory, proactive
agency, perception (time/weather), and voice — with sensible defaults. Copy it to `.env` and edit.
