<div align="center">

<img src="docs/assets/icon.png" width="108" alt="Luna" />

# Luna

**A desktop AI companion that lives with you — she remembers, perceives, acts, and speaks.**

An LLM brain with layered memory and dreams, proactive agency, action-integrity rails, and a
code-agent capability — embodied as a Live2D avatar with lip-synced custom voice.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/Bun-%E2%89%A5%201.2-black?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Desktop: Electron](https://img.shields.io/badge/Electron-desktop%20pet-47848F?logo=electron&logoColor=white)](packages/desktop)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**English** · [简体中文](README.zh-CN.md)

<img src="docs/assets/wizard-chat.png" width="760" alt="Luna's guided setup wizard" />

*First launch opens a bilingual guided setup — no env files, no docs required.*

</div>

---

## ✨ Features

- 🧠 **Three-layer memory + dreams** — a rolling working window, salience-scored durable turns, and
  structured long-lived facts over one SQLite file; an offline **dream cycle** consolidates the day
  into facts, diary, and distilled skills. Hybrid recall blends embeddings, keywords, recency, and a
  relevance floor so a decisively relevant old memory is never buried.
- 🌱 **Proactive agency** — she can open a conversation herself: silence-aware timing ladders,
  weather-shift and reconnect hooks, follow-up thoughts — all behind deterministic, tunable rails
  (quiet hours, outreach intensity) instead of a "message me every N minutes" loop.
- ⚡ **Streaming everything** — one WebSocket, one Zod-typed event contract shared by server and web.
  Reply tokens, tool starts/progress, memory updates all stream live; tool turns never block.
- 🛠 **Real capabilities** — web search + SSRF-guarded page reading, weather (QWeather / Open-Meteo),
  time perception, a gated code-agent (repo map, symbol search, edits), and a skills shelf she
  distills herself.
- 🎭 **Embodied** — a Live2D avatar with emotion-driven expressions, gaze follow, idle animation
  profiles, phoneme lip-sync, and a transparent always-on-top **desktop pet mode**.
- 🗣 **Your voice** — zero-setup browser TTS out of the box, or bring a GPT-SoVITS voice: drag the
  weights folder into the wizard and it writes the config and hands you the exact launch command.
- 🧙 **Guided onboarding** — a six-step bilingual (中文/English) wizard with *live* key validation
  against the real vendors, drag-and-drop avatar/voice installs, and escape hatches everywhere
  (status-bar button, native `⌘,` menu, failure dialogs) so a bad config can never strand you.
- 🔒 **Local-first** — memory is a local SQLite file, keys live in a local config only, the server
  binds loopback by default. Nothing about *her* leaves your machine.

## 🚀 Quick start

```sh
git clone https://github.com/Alan-Yu-2077/Luna-ts.git
cd Luna-ts
bun run app        # installs deps → builds → packages → puts Luna.app on your Desktop → launches
```

First launch opens the setup wizard (screenshot above). The only *required* thing is a chat API key
(Anthropic, or any compatible gateway) — every other step is optional and re-runnable from Settings.

Prefer the browser, or not on macOS?

```sh
bun install
cp .env.example .env   # set ANTHROPIC_API_KEY
bun run dev            # server + web at http://localhost:5173
```

<div align="center">
<table>
  <tr>
    <td align="center"><img src="docs/assets/wizard-voice.png" width="420" alt="Voice step: drag a GPT-SoVITS pack in" /><br/><sub>Drag a voice pack in — config + launch command generated, live health badge</sub></td>
    <td align="center"><img src="docs/assets/app-first-run.png" width="420" alt="First run: settings panel over the bring-your-own-avatar empty state" /><br/><sub>First run — she ships with no body; you bring the avatar and the voice</sub></td>
  </tr>
</table>
</div>

## 🏗 How it fits together

```mermaid
graph LR
  D[desktop shell<br/><sub>pet mode · wizard · supervision</sub>] -.hosts.-> W
  W[web<br/><sub>Live2D · lip-sync · chat UI</sub>] <-- "one WS, Zod-typed events" --> S[server<br/><sub>turns · tools · proactive rails</sub>]
  S --- M[(SQLite<br/><sub>3-layer memory · dreams · skills</sub>)]
  S -- provider seam --> L[Anthropic / OpenAI-compatible]
```

Four Bun workspace packages with a one-way dependency arrow: [`protocol`](packages/protocol) (the
shared wire contract — a wire change that isn't reflected on both sides is a *compile error*),
[`server`](packages/server) (the brain; owns all state and model calls),
[`web`](packages/web) (a thin reactive view), and [`desktop`](packages/desktop) (an optional
Electron shell). The deep dive lives in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 📚 Documentation

| Doc | What it covers |
| --- | --- |
| [`docs/SETUP.md`](docs/SETUP.md) | Bring-your-own model & voice, step by step (the wizard does this for you) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The structural map: packages, wire contract, memory, tools, proactive rails |
| [`ROADMAP.md`](ROADMAP.md) | Where things are heading, by theme |
| [`docs/history/DEVELOPMENT.md`](docs/history/DEVELOPMENT.md) | The full per-version engineering log (130+ entries) |
| [`.env.example`](.env.example) | Every configuration knob, documented |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Dev workflow, tests, conventions |

## 🧪 Development

```sh
bun test                                  # the whole suite, all packages
bun run --cwd packages/server tsc --noEmit  # per-package typecheck (server/web/desktop/protocol)
```

Tests live next to the code (`*.test.ts`), the wire contract is `as`-free, and every risky feature
lands behind a default-off env flag before its default flips. The server binds
**loopback (`127.0.0.1`) by default**; set `LUNA_BIND_HOST=0.0.0.0` only on a trusted network.

## 🤝 Contributing

Issues and PRs are welcome — [`CONTRIBUTING.md`](CONTRIBUTING.md) has the workflow, and
[`ROADMAP.md`](ROADMAP.md) lists directions where help is wanted. Good first contribution:
per-model Live2D expression presets (see the honest limitation note in
[`docs/SETUP.md`](docs/SETUP.md)).

## 📄 License

[MIT](LICENSE), with one carve-out: the vendored **Live2D Cubism Core** runtime
(`packages/web/public/live2dcubismcore.min.js`) is proprietary to Live2D Inc. and governed by its
own license. See [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES).

## ❤️ Acknowledgements

[GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) ·
[pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) ·
[Live2D Cubism](https://www.live2d.com/) ·
[Bun](https://bun.sh) · [Electron](https://electronjs.org) ·
weather by [QWeather](https://dev.qweather.com/) & [Open-Meteo](https://open-meteo.com/) ·
search by [Tavily](https://tavily.com/)
