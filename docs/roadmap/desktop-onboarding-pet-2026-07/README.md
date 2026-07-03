# Initiative 20 — Desktop first-run & pet ergonomics (v0.28.0 – v0.28.2)

> **Status: PLANNED.** Priority: next after the v0.27.x settings surface (shipped ad hoc via
> `luna-ts-dev`). Version range **v0.28.0 – v0.28.2**. Master index:
> [`docs/roadmap/README.md`](../README.md).

## The idea

The desktop app (Initiative 19) ships, but two rough edges block a real user from living with it.
**(1) First run is a text-file chore** — the shell writes a `luna.env` template and pops a dialog
that says "go edit this file, then restart." A new user shouldn't touch a dotfile to type a URL and
a key. **(2) Pet mode can't be moved or resized** — the window is transparent/frameless/always-on-top
with per-pixel click-through, so there's no title bar to drag and no visible edge to resize; the
model *itself* is draggable + scroll-zoomable, which is the wrong lever (it moves her *inside* a
fixed window). This initiative gives first-run a **guided setup screen** that writes the keys and
restarts the sidecar, and reworks pet interaction so **the window is the thing you move and resize**
while **the model is fixed as a half-body portrait** that simply fills whatever window size you pick.

## Why prioritized

Both are adoption blockers surfaced by real use this session: the grok experiment forced repeated
`luna.env` edits + restarts (onboarding pain), and Alan's verdict on pet mode was "无法拖动或缩放
窗口，这点还是很伤." Neither needs new backend/runtime work — they're shell + web-frontend UX, so
they slot cleanly above the v0.27.x settings work without touching the turn/memory/proactive core.

## Locked design decisions referenced

- **Frontend scope LD (amended v0.26.1, `REWRITE_CONTEXT.md:42`)**: the packaged desktop shell
  (`packages/desktop`, Electron) owns app-data — the SQLite DB via `LUNA_DB_PATH` and **the keys in
  `userData/luna.env`, never bundled**. Onboarding writes to exactly this file; it does not invent a
  new secret store, and it never puts a key on a wire.
- **v0.27.1 settings surface (shipped)**: the `settings.set`/`settings.state` wire + `settings/registry.ts`
  are **secret-free by construction** (the registry rejects any env matching `KEY|TOKEN|SECRET`). Onboarding
  therefore uses a **separate shell-only IPC** for keys — it must not route them through the settings wire.

## Verified architectural facts

Onboarding (the shell, `packages/desktop`):
- First-run today: `ensureUserConfig()` (`packages/desktop/src/main.ts:55`) = `if (!existsSync(p.envFile))`
  → `writeFileSync(p.envFile, ENV_TEMPLATE)` + a **blocking** `dialog.showMessageBoxSync` telling the user
  to edit the file and restart. Then `parseEnvFile(readFileSync(...))` (`src/envfile.ts`) returns the env.
- The sidecar boots with `sidecarEnv()` (`main.ts:70`) which injects a **placeholder** `ANTHROPIC_API_KEY =
  'sk-not-configured'` (`main.ts:83`) when the real key is absent, so the app boots but every turn fails.
- The supervisor (`src/supervisor.ts`) exposes **`start()` / `stop()` only** (`type Supervisor`, `supervisor.ts:26`),
  spawned once in `app.whenReady()` (`main.ts:159`). There is **no `restart()`** — applying new keys today
  needs a full app relaunch.
- The env template `ENV_TEMPLATE` (`src/envfile.ts`) already enumerates the fields onboarding must collect:
  `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `LUNA_MODEL`, embedding keys, weather keys, `LUNA_LAT_LON`,
  `LUNA_PET_MODE`.
- Shell↔renderer IPC precedent exists: `ipcMain.on('luna:set-ignore-mouse', …)` + `ipcMain.on('luna:set-pet-mode', …)`
  (`main.ts:116,124`) with a `contextBridge` in `src/preload.ts` (`lunaPet.setIgnore` / `setPetMode`). Onboarding
  adds a new channel in the same shape.

Pet ergonomics (the web frontend + the shell window):
- Pet window options (`main.ts:94`): `width: petMode ? 560 : 1280, height: petMode ? 900 : 860`, and when pet:
  `{ transparent: true, frame: false, hasShadow: false, alwaysOnTop: true }`. **No `resizable` set** ⇒ Electron
  default `true`, but frameless + click-through defeats the invisible resize border and there's no title bar to move.
- Click-through: `win.setIgnoreMouseEvents(true, { forward: true })` (`main.ts:110`); the renderer's `petHitTest.ts`
  toggles it per `pointermove` — interactive over her body-bbox / bar / buttons, pass-through elsewhere (`app.ts` pet block).
- `fit()` (`packages/web/src/live2d/pixiLive2DSink.ts:114`): `baseScale = (hostH * 0.92) / model.height` — a **full-body**
  fit centered in the host. A half-body portrait needs a different scale (fill width) + a **top anchor** (crop at the waist).
- Model drag: **unconditional** `pointerdown`/`pointermove` on the canvas → persisted offset (`sink:224–246`, `luna:live2d:pos`).
  Zoom: **unconditional** `wheel` → persisted multiplier (`sink:280–285`, `luna:live2d:zoom`). Both need a pet gate.
- `fit()` re-runs on `globalThis 'resize'` (`sink:134`) — so a window resize already re-fits the model; half-body fit
  inherits this for free.
- Pet CSS: `body.pet { background: none }` + `.luna-app.pet` strips the room (`theme.css:454+`). `-webkit-app-region: drag`
  can attach to the pet model area to make her body a window-move handle; the input bar + dream/settings buttons need
  `-webkit-app-region: no-drag`.

## The hard part

**Secrets never leave the shell.** Onboarding collects a key in the renderer and must hand it to the
main process over IPC to write `luna.env` — the key must never touch the `settings.*` wire, never get
persisted anywhere but `userData/luna.env`, and never be echoed back to the renderer after write. The
plan keeps a hard wall between the secret-free settings surface (v0.27.1) and the shell-only key IPC.

**Click-through vs. window drag/resize is a real conflict.** `setIgnoreMouseEvents(true,{forward})`
makes the window ignore the mouse everywhere except her body — but window *edges* (for resize) live in
the ignored transparent margin, and `-webkit-app-region: drag` needs the region to actually receive
events. v0.28.2 must reconcile: either narrow the ignore region to exclude an edge strip, or drop
per-pixel pass-through in favor of "her body = drag, margins = resize" — a deliberate trade the plan
picks explicitly (per-pixel click-through was a v0.26.2 nicety, not a requirement).

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [First-run onboarding](v0.28.0-first-run-onboarding.md) | v0.28.0 | Setup screen → writes `luna.env` → restarts sidecar; keys stay file-only | Medium | nothing | PLANNED |
| [Pet model fixed half-body](v0.28.1-pet-half-body-fixed.md) | v0.28.1 | `fit()` half-body framing in pet mode + disable model drag/zoom | Low | nothing | PLANNED |
| [Pet window move + resize](v0.28.2-pet-window-move-resize.md) | v0.28.2 | Drag-region window move + `resizable` + click-through reconciliation | Medium | v0.28.1 | PLANNED |

## Acceptance criteria for the whole initiative

- [ ] A fresh install (empty `userData`) opens a setup screen; entering a base URL + key and clicking
      Save writes `luna.env` and produces a working chat turn **without hand-editing a file or a manual
      full-app relaunch**.
- [ ] The API key never appears in any `settings.state` frame, any trace, or any renderer-readable
      surface after it's saved.
- [ ] In pet mode the model is a fixed half-body portrait: dragging on her body does **not** move the
      model within the window, and the scroll wheel does **not** zoom the model.
- [ ] In pet mode the user can **move** the pet by dragging her, and **resize** the window; the model
      re-fits (stays a centered half-body) at any window size.
- [ ] Windowed (non-pet) mode is unchanged: model drag + scroll-zoom still work; no onboarding gate
      once configured.
- [ ] `bun test` green; `tsc` ×4 clean; the packaged smoke still passes (extended to assert the new
      pet-interaction wiring, mirroring the v0.27.2 `bridgeSetPetMode` check).

## Open questions blocking start

None block v0.28.0/v0.28.1. For v0.28.2, one design call to confirm at build time: **keep per-pixel
click-through with a resize-edge exception, or drop it for "body = move, margins = resize"?** The plan
recommends the latter (simpler, matches "整体可缩放"); flagged there for Alan's confirmation before implementing.
