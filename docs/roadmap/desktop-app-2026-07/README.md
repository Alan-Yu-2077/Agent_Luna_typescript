# Initiative 19 — Desktop app (Luna lives on your screen)

> **Status: 📋 PLANNED.** Priority: after Initiatives 17 (proactive) + 18 (collapsible UI). Version
> range: **v0.26.0 – v0.26.2** (3 versions). Branch: `feat/weather-perception`. Master index:
> [`../README.md`](../README.md).
> **Recommended shell: Electron (v1), for engine certainty.** Tauri v2 deferred as a footprint
> optimization behind a mandatory WKWebView go/no-go gate (see The hard part).
> **Deployment: single-machine — the Bun server is bundled + spawned locally** (Alan's choice,
> 2026-07-01), so Luna is one double-clickable app, not a browser tab against a hand-started server.

## The idea

Take the web frontend out of the browser and make Luna a **desktop application** — ultimately a
floating, always-on-top, transparent-background **companion** who lives on the screen, not in a tab.
The verified reality (below) is that this is **mostly packaging, not a rewrite**: Live2D already runs
on `pixi.js v7` WebGL + a **local** Cubism Core WASM blob over a **transparent** canvas, the frontend
couples to the server through **one WS URL**, and the only browser API that genuinely breaks is
geolocation. A desktop shell (Electron) wraps the existing `packages/web` almost verbatim, bundles the
Bun server as a spawned sidecar, and adds a transparent pet window.

## Why this shape / relationship to Initiative 18

This is the **home** for Initiative 18 (Collapsible companion UI). Init 18's collapsed mode — model
glided to center, replies as a beside-model bubble stack, a bottom input bar — is exactly a
transparent desktop-pet window. Init 18 is shell-agnostic pure `packages/web` (browser *and* desktop);
Init 19 gives it a real window to live in. Build order: Init 18 first (the UX, in the browser where
iteration is fast), then Init 19 (the shell). They compose; neither blocks the other.

## Scope honesty (this is NOT "zero backend" like Init 18)

Init 19 is a **packaging** initiative. It adds a new `packages/desktop` (Electron), a production build
step in `packages/web`, and needs **small, logic-free plumbing** in `packages/server` — env-driven
paths for the bundled app (SQLite location, config/secrets location, port). **No agent-logic change.**
The Live2D rendering + audio pipeline + GPT-SoVITS proxy stay as-is (consistent with the Frontend LD,
which this initiative *extends* from "web controller" to "packaged desktop shell" — recorded in
v0.26.1).

## Locked design decisions referenced

- **Frontend scope LD** (`REWRITE_CONTEXT.md:42`): *"TS-port `agent-app.js` controller only — Live2D
  rendering + audio pipeline + GPT-SoVITS proxy stay as-is."* → Init 19 **extends** this: the same
  frontend, now wrapped in a desktop shell. Live2D/audio/TTS internals are untouched; the shell is
  additive. Amendment recorded in v0.26.1.
- **Single-user LD** (`REWRITE_CONTEXT.md:40`): *"Luna is a companion; multi-user is not a v2 goal."*
  → A single-machine desktop app with a locally-spawned server is squarely on-design.
- **Wire LD** (`REWRITE_CONTEXT.md:37`): *"Single WebSocket per session."* → The desktop app talks to
  the locally-spawned server over the same one WS (`ws://127.0.0.1:8787`); no new channel.

## Verified architectural facts

Grounded in direct source reads + a 5-agent research pass (Tauri, Electron, licensing, port-surface) +
an adversarial "will Live2D drive in a webview" verifier (2026-07-01).

**Rendering is portable and desktop-ready:**
- Renderer = `pixi.js v7` WebGL/WebGL2 (`cubismRuntime.ts:9-16,39-45`); the canvas is already
  **transparent** (`backgroundAlpha:0`, `cubismRuntime.ts:41`) → a transparent window shows Luna over
  the desktop with no code change.
- Cubism Core is a **local, self-contained, inlined-WASM** blob (`public/live2dcubismcore.min.js`,
  loaded via `<script>` at `cubismRuntime.ts:22`); models are local (`public/models/yumi/`). **No
  network, no external `.wasm` fetch** → works offline in a packaged app.
- WebAudio/TTS needs **no shim** — the AudioContext gesture-unlock is already implemented
  (`webAudioSink.ts:31-37`); no `getUserMedia`/`speechSynthesis`/`Notification`/`clipboard` anywhere.

**The port surface (mostly plumbing):**
- **No production build exists** — `dev-server.ts` serves via Bun's runtime HTML bundler + static
  `public/` + a `/api/gpt-sovits/` proxy (`dev-server.ts:2,19,23-37`); `packages/web/package.json` has
  no build script. → add `bun build packages/web/index.html --production --outdir=dist` + a copy-`public`
  step. Bun's own bundler; no Vite needed.
- **The #1 desktop break:** the WS URL is `ws://${location.hostname}:${WS_PORT}` (`app.ts:23-24`, port
  from `?ws=` ?? `8787`). Under `file://`/`tauri://` this is wrong; served over a **fixed loopback HTTP
  origin** (`http://127.0.0.1:PORT`) it resolves to `ws://127.0.0.1:8787` and **keeps working
  unchanged** — the argument for a loopback-origin shell. Make it explicitly config-driven anyway.
- **All runtime assets are absolute-root URLs** (`/models/yumi/*` `pixiLive2DSink.ts:78`,
  `/live2dcubismcore.min.js` `cubismRuntime.ts:22`, `/api/gpt-sovits` `ttsClient.ts` / `app.ts:45`) →
  a fixed loopback HTTP origin keeps them resolving with zero code change.
- **The one real API rewrite:** `geo.ts` uses `navigator.geolocation.getCurrentPosition`
  (`geo.ts:16-28`) for weather location; it silently no-ops where the API is absent/unconfigured (Tauri
  WKWebView has none; Electron's needs a provider key). → a native location shim, or lean on the
  server's `LUNA_LAT_LON` fallback. (Note: the stable instance currently relies on browser GPS —
  desktop changes that path.)
- **`localStorage`** holds all settings + model pos/zoom (`luna:*`, `luna:live2d:pos/zoom`) — no shim,
  but the **origin must be pinned** (fixed port) or they silently reset each launch.
- **Server** is WS-only (`426` on plain HTTP), `LUNA_PORT ?? 8787`, binds `127.0.0.1`
  (`main.ts:40,185-201`). Three processes are orchestrated by `scripts/dev-all.ts` today (TTS proxy +
  server + web) → **the desktop shell replaces `dev-all.ts` as the supervisor**.

## Licensing (the real distribution gate — personal use is free and clear)

- **Personal single-user desktop use is unambiguously fine, zero action** beyond the base EULAs already
  accepted downloading the SDK.
- **Cubism Core** is proprietary but designated **"Redistributable Code"** (file header + Live2D EULA)
  — shippable inside the app if you retain the Live2D copyright header, don't relicense it, and don't
  imply Live2D endorsement.
- **Cubism SDK Release/Publication License:** individuals + small-scale (**< ~10M JPY annual sales**)
  are **exempt** from the agreement and payment.
- **Keep Luna a single fixed model** (no user model import/generation) so it stays a normal app and
  **not an "Expandable Application"** (which would need Live2D review + a revenue model regardless of
  size). This is the one product constraint to respect.
- **`pixi.js` + `pixi-live2d-display` = MIT** (retain notices).
- **⚠ The sharpest gate: the "yumi" model art's OWN license.** Its provenance is unknown and — from the
  Chinese-named expressions (星星眼/爱心眼/…) — almost certainly a **third-party/custom model, not an
  official Live2D sample**. Redistribution of the `.moc3`/textures is governed by whoever made it, not
  by Live2D. **Confirm yumi's license before ANY distribution.** (Irrelevant for personal use.)

## The hard part

- **Shell = engine certainty vs footprint** (the adversarial verdict, `conditional`). Both engines
  render the stack, but Tauri's WKWebView is a **new engine surface** for *this exact* pixi-live2d-
  display 0.5.0-beta + inlined-WASM Cubism Core + transparent context — no project guarantees THIS
  model/plugin combo, and the residual risks (WASM instantiation surface, transparent-canvas
  premultiplied-alpha, context-loss re-upload) are all **engine risks Electron eliminates** by shipping
  the same Chromium the app already runs in. **→ Electron for v1.** Tauri (~5MB vs ~150MB, ~half the
  RAM) is a real footprint win, deferred behind an explicit **"yumi renders + drives + transparent in
  the *packaged* WKWebView build"** go/no-go gate.
- **Background suspension is the sharpest pet-specific failure mode** (default-on, both shells): a pet
  sits *occluded* most of the time, and the webview throttles/suspends `requestAnimationFrame` when
  hidden/occluded → Luna's pixi ticker freezes (breathing/idle/lipsync stop) and the WebGL/AudioContext
  can be torn down. Must be **explicitly disabled** (Electron: `backgroundThrottling:false` + handle
  occlusion `visibilityState`; Tauri: `backgroundThrottling:"disabled"`, macOS 14+).
- **Transparency can be lost in the *packaged* build** while working in dev (both shells) — verify the
  `.app`/`.dmg`, not just `dev`; avoid vibrancy; set `html/body` transparent before first paint.
- **Premultiplied-alpha over a transparent canvas** — Cubism draws premultiplied; mismatched pixi alpha
  attributes give dark halos at the model edges against the desktop. Surfaces only after the transparent
  port; code-solvable, must be verified.
- **Single-machine packaging discipline:** `bun build --compile` the server + the static/TTS-proxy host
  into sidecars, supervise them from the shell (start order, health, **kill children on quit**), move
  SQLite + config/secrets to **app-data** (never bundle plaintext keys), code-sign the sidecars (mac
  notarization/Gatekeeper), keep the ~5GB GPT-SoVITS Python TTS **external** + optional (boot degrades).
- **Click-through is whole-window only** on macOS (both shells) — a pet needs renderer hit-testing to
  toggle `setIgnoreMouseEvents(true,{forward:true})` on/off by region, reconciled with
  `pixiLive2DSink`'s full-canvas drag/zoom/gaze handlers (`pixiLive2DSink.ts:163-238`).

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.26.0](v0.26.0-port-foundation-smoke.md) | v0.26.0 | Port foundation + Electron rendering smoke test: static build, fixed loopback-origin serve, config-driven WS URL, plain Electron window that proves **yumi renders + drives + WS connects** (server still hand-started) | High | nothing | 📋 PLANNED |
| [v0.26.1](v0.26.1-single-machine-app.md) | v0.26.1 | Single-machine app: `bun build --compile` server + static/TTS-proxy sidecars, Electron supervises them (kill-on-quit), SQLite + secrets in **app-data**, electron-builder packaging + signing; amend the Frontend LD | High | v0.26.0 | 📋 PLANNED |
| [v0.26.2](v0.26.2-desktop-pet-window.md) | v0.26.2 | Desktop-pet window: transparent + always-on-top + frameless, **background-throttling off**, click-through hit-testing, geo shim, premultiplied-alpha + packaged-transparency verification; **Initiative 19 close** | Medium | v0.26.1 | 📋 PLANNED |

## Acceptance criteria for the whole initiative

- [ ] Luna runs as a **double-clickable desktop app** (no browser, no hand-started server); yumi renders
      + drives (breathing/idle/lipsync) + chat works end-to-end.
- [ ] The bundled Bun server spawns on launch and is killed on quit; SQLite + config live in app-data;
      no plaintext secret ships in the bundle.
- [ ] A transparent, always-on-top pet window shows Luna over the desktop **in the packaged build**;
      she keeps animating when the window is occluded (no ticker freeze).
- [ ] Click-through passes clicks to the desktop around Luna while her body + the input bar stay
      interactive.
- [ ] Weather location works via a desktop-appropriate path (native shim or `LUNA_LAT_LON`).
- [ ] `packages/web` still runs in a browser (no regression); `bun test` + `tsc` green.
- [ ] Frontend LD amendment recorded in `REWRITE_CONTEXT.md`.

## Open questions to settle at build time (do not block start)

- **Electron vs Tauri (the #1 fork).** Recommend **Electron for v1** (engine certainty for THIS Live2D
  stack, per the adversarial verdict); Tauri deferred as a footprint optimization behind a packaged-
  WKWebView go/no-go. If Alan wants the ~5MB Tauri footprint from the start, v0.26.0's smoke test
  becomes the go/no-go and the shell files change — the port foundation (build, WS URL, asset pinning,
  geo) is **shell-agnostic** either way.
- **Secrets/config UX.** How the yunwu/embedding/weather/Tavily keys reach the bundled app: a first-run
  settings screen, or a user-edited config file in app-data. (Personal use: a config file is simplest.)
- **Geo:** native CoreLocation shim vs. just leaning on `LUNA_LAT_LON`. (The latter is zero-code; the
  former restores live GPS.)
- **Distribution?** If it stays personal-only, licensing is a non-issue. Any distribution requires
  confirming the **yumi model license** first (see Licensing).
