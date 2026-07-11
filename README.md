# Luna (TypeScript)

Luna is a companion agent — an LLM brain with persistent memory, proactive agency, action-integrity
rails, a code-agent capability, and an embodied front end (a Live2D avatar with voice and lip-sync). It
is built around two commitments:

1. **End-to-end response speed** — no blocking-on-tool-turn, no sleeping on the HTTP thread, no
   per-turn connection teardown. Tool use and reply text stream as they happen.
2. **A single typed contract shared by backend and frontend** — one Zod-validated event protocol, so
   the server and the web client can never silently drift apart.

The full stack ships: the agent brain (Bun + WebSocket runtime, interleaved tool-use), three-layer
SQLite memory + dream consolidation, proactive agency, action-integrity rails, a code-agent capability,
and the body — a Live2D avatar with voice and lip-sync.

## Run

```sh
bun install
cp .env.example .env    # then set ANTHROPIC_API_KEY (the only value required for a text-only run)

bun run dev             # one-command local launcher (server + web)
# or individually:
bun run dev:server      # the Bun WebSocket server
bun run dev:web         # the web front end
bun test                # the test suite
```

Open the web front end and you have a running Luna — chat works, and she speaks with the browser's
built-in voice.

**Desktop app (native window / desktop pet):**

```sh
bun run app             # build + package + launch the Electron app
```

`bun run app` installs dependencies on first run, then packages the desktop app with
`electron-builder` and launches it. It re-packages **only when a build input changed** since the last
package — an unchanged re-run launches instantly. (Set `LUNA_APP_NO_LAUNCH=1` to package without
opening the app, e.g. in CI.) Voice is bring-your-own: if you've configured `LUNA_TTS_BACKEND=http`
but your GPT-SoVITS `api_v2` isn't running, the launcher prints a reminder — it never starts it for
you (see [`docs/SETUP.md`](docs/SETUP.md)). A fresh install ships **no avatar model and no voice weights** — you bring your own; the
UI shows a friendly empty state until a Live2D model is installed. [`docs/SETUP.md`](docs/SETUP.md)
walks through installing a model and (optionally) a higher-quality voice; [`.env.example`](.env.example)
documents the full configuration surface.

The server binds **loopback (`127.0.0.1`) by default**; set `LUNA_BIND_HOST=0.0.0.0` to expose it on the
LAN (only on a trusted network).

## Layout

```
.
├── README.md
├── ARCHITECTURE.md            ← how the pieces fit
├── ROADMAP.md                 ← direction, by theme
├── LICENSE                    ← MIT (one carve-out; see below)
├── THIRD_PARTY_LICENSES       ← bundled third-party components
├── .env.example               ← the full, documented configuration surface
├── docs/SETUP.md              ← bring-your-own model & voice
├── services/tts/              ← optional self-hosted GPT-SoVITS voice (docker-compose)
└── packages/
    ├── protocol/              ← shared Zod schemas + types (the wire contract)
    ├── server/                ← Bun + WebSocket runtime (brain, memory, tools, proactive)
    ├── web/                   ← the browser front end (Live2D + audio + chat UI)
    └── desktop/               ← an Electron shell (native window, desktop pet)
```

## License

Luna is released under the [MIT License](LICENSE), with a single carve-out: the vendored Live2D Cubism
Core runtime (`packages/web/public/live2dcubismcore.min.js`) is proprietary to Live2D Inc. and is **not**
covered by the MIT grant — it is governed by Live2D's own license. See
[`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES) for details on it and other bundled components.

## Further reading

- [`docs/SETUP.md`](docs/SETUP.md) — bring-your-own model and voice, step by step.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the structural map: packages, the wire contract, memory, tools,
  proactive rails, perception, and the front end.
- [`ROADMAP.md`](ROADMAP.md) — where things are heading.
- [`.env.example`](.env.example) — the full, documented configuration surface.
