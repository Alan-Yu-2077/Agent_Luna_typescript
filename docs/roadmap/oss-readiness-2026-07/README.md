# Initiative 24 — OSS Readiness (v0.34.0 – v0.34.8)

> **Status: 📋 PLANNED.** Priority: next (the public release gate). Version range **v0.34.0 – v0.34.8**.
> Master: [`../README.md`](../README.md). **Supersedes the cancelled Initiative 7** (`oss-packaging-2026-06/`,
> v0.14.x — which planned to *bundle* GPT-SoVITS TTS; this initiative reverses that to *remove* it).

## The idea

Bring `Agent_Luna_typescript` from a single-owner private repo to a **legally clean, machine-portable,
PII-free open-source project a stranger can clone and run**. The blocker is not secrets — a 21-agent
audit (`OSS_READINESS_AUDIT.md`, internal) confirmed **secrets-in-source = 0** and `.env`/`luna.sqlite`
never committed. The blockers are: no LICENSE; a bundled un-relicensable Live2D avatar (`yumi`) + a
private-repo-coupled TTS; the owner's real name/handle/hobbies baked into runtime prompts, test
fixtures, comments, and a first-run box that funnels new users' API keys to the owner's private
`yunwu.ai` proxy; a homebrew-only sqlite path that silently breaks semantic recall off the owner's
laptop; and internal dev diaries presuming one named owner. This initiative scrubs all of it, replaces
the bundled avatar + voice with a **bring-your-own onboarding**, and ends with an owner-gated
**publish to a fresh public repo** (`Luna-ts`) — so the public history starts clean by construction and
the private repo is never rewritten.

## Why now / priority

Everything else is shippable in place; this is the one initiative that gates **public** existence.
It is staged so the working-tree work (v0.34.0–v0.34.7) lands and is validated first, gated by a real
clean-clone dry-run, and the **publish** (v0.34.8) is quarantined at the end behind an explicit owner
go-ahead. Because the OSS repo (`Luna-ts`) is brand-new, there is no irreversible force-push — publishing
a clean tree to an empty repo is fully reversible (delete + re-publish).

## Owner decisions locked (2026-07-09, this initiative)

1. **LICENSE = MIT** (root), with an explicit **carve-out** excluding `packages/web/public/live2dcubismcore.min.js`
   (Live2D Proprietary Software License, © Live2D Inc.) from the MIT grant.
2. **yumi Live2D model — REMOVED** from the tree (not relicensed). New users bring their own model.
3. **TTS — the `neoru` voice weights are NOT distributed; the rest is config-driven BYO** (owner
   refinement 2026-07-09). The `neoru` weights are the owner's private custom voice (like yumi) and are
   never in this repo anyway. The TTS *integration is kept*, de-personalized (drop the private-sibling
   default), and v0.34.7 ships a **`services/tts/` config** (docker-compose / setup + a config template)
   that lets users download GPT-SoVITS (MIT, self-hostable) + a base/own voice at runtime — weights
   never committed. A zero-setup **browser TTS** is the new default.
4. **`docs/` internal diaries + `.claude/` author tooling — REMOVED** from the public tree; a scrubbed
   `ARCHITECTURE.md` + high-level `ROADMAP.md` are extracted in their place.
5. **Two-repo model (confirmed 2026-07-09): OSS ships as a NEW repo — `github.com/Alan-Yu-2077/Luna-ts`
   (freshly created, empty).** The scrubbed tree is published there as a **fresh clean initial commit**
   → zero PII history *by construction*. The private `Agent_Luna_typescript` (all history, yumi, `neoru`,
   private soul) **stays private, untouched** — no force-push, no rewrite. `~/Desktop/Agent_Luna_oss`
   (this clone, branch `oss-prep`) is the **OSS working folder**, remote `oss` → `Luna-ts`. This dissolves
   the old irreversible-history-rewrite step: v0.34.8 becomes a **publish**, not a rewrite.

## Verified architectural facts (from the Phase-A verification workflow, cited to the clone @ v0.33.2)

- **The empty-`models/` build trap** — `packages/web/package.json:12` `build:assets` runs
  `cp -R public/models dist/models`, and `public/models/` contains **only** `yumi/`. Deleting `yumi/`
  empties `public/models/`; git drops empty dirs → a fresh clone has no `public/models/` → the `cp`
  exits non-zero → `bun run build` fails → cascades to `packages/desktop` pack + `smoke:packaged`.
  **The #1 hard failure of a naive `rm`** — v0.34.6 must fix the copy + ship a tracked keeper.
- **Runtime already degrades gracefully with no model** — `packages/web/src/live2d/pixiLive2DSink.ts:90`
  is the *sole* hardcoded model URL (`?? '/models/yumi/yumi.model3.json'`); a 404 throws → caught at
  `:104-110` → returns null → `app.ts:82-89` keeps the console sink; chat/voice/dream/WS/settings all
  keep working. The **no-model UX surface already exists**: `layout.ts:180-183` `.model-placeholder`
  (but its copy leaks 'yumi' + a dev-era version string). `packages/desktop/src/smoke.ts:27-44` asserts
  a canvas rendered → **its verdict must be relaxed** for the no-model case or every OSS build reads
  as a regression.
- **Live2D Cubism Core stays** — `packages/web/public/live2dcubismcore.min.js` is a *separate*
  proprietary SDK (`cubismRuntime.ts:22`), required for ANY model incl. a BYO one; it is not deleted,
  it is carved out of MIT + covered by `THIRD_PARTY_LICENSES`.
- **The private-gateway funnel** — `packages/web/src/ui/setupView.ts:55`: `yunwu.ai` is both the
  **default value and placeholder** of the API-base field; a click-through new user sends their key to
  the owner's proxy. Highest-severity behavioral item.
- **The real functional bug** — `packages/server/src/memory/recall/vecRuntime.ts:5` hardcodes one
  Apple-Silicon-homebrew `libsqlite3.dylib` with **no env override** → `sqlite-vec` never loads off a
  brew-arm64 machine → semantic recall silently degrades to slow TS-cosine for every non-owner user.
- **Text-only degrade is safe** — with no TTS backend, `webAudioSink.ts:82` excludes 502/503/504 from
  its failure latch and returns null, so text keeps working; the `mutedUntil` latch only trips after 5
  *hard* failures. Any audio-sink refactor must preserve the 502-retryable exclusion.
- **New desktop plumbing is net-new** — the BYO-model onboarding needs a preload injection of
  `LUNA_MODEL_URL` into `window.lunaConfig`, a `dialog.showOpenDialog` model-folder picker IPC, and
  `startWebHost` serving a `userData/models` dir. None exist today (v0.34.7). Heed the v0.27.2
  `__dirname`→`app.getAppPath()` preload-path lesson so the injected bridge actually loads.
- **The canonical repo URL is a prerequisite** for v0.34.0 (`package.json.repository`), v0.34.1
  (User-Agent), and v0.34.5 (README) — see Open Questions.

## The hard part

- **Asset removal is a build-graph edit, not a delete** (v0.34.6): the delete, the copy-resilience fix,
  the tracked keeper, the smoke-verdict relaxation, and the TTS-wiring teardown must land **atomically**
  or `bun run build` / `bun test` / `pack` go red.
- **Fixtures assert the PII they contain** (v0.34.1/2/4): the owner name/`yunwu.ai`/Chinese strings are
  used as *both* arrange inputs and expected outputs; a one-sided find/replace fails `bun test`. Rename
  input **and** expectation together, per test. The acceptance gate is a **grep sweep**
  (`grep -rn -e Alan -e Shion -e yunwu packages/`), not the audit's enumerated line list (which undercounts).
- **Publishing is the one-way-ish moment** (v0.34.8): going public is a decision, but because `Luna-ts`
  is a fresh empty repo the mechanics are reversible (delete + re-publish) — the risk is a leak slipping
  through, which the clean-clone dry-run + history greps gate against. The private repo is never touched.

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.34.0](v0.34.0-legal-foundation.md) | v0.34.0 | Legal foundation — LICENSE + THIRD_PARTY_LICENSES + pkg fields | Low | none | 📋 |
| [v0.34.1](v0.34.1-pii-scrub.md) | v0.34.1 | PII scrub — name/handle/appId/UA (working tree) | Medium | v0.34.0 | 📋 |
| [v0.34.2](v0.34.2-de-yunwu.md) | v0.34.2 | De-yunwu — kill the private-gateway default | Medium | v0.34.0 | 📋 |
| [v0.34.3](v0.34.3-portable-paths.md) | v0.34.3 | Portable paths — dylib probe + abs-path scrub | Medium | v0.34.0 | 📋 |
| [v0.34.4](v0.34.4-locale-neutral.md) | v0.34.4 | Locale neutralization + weather config docs | Low | v0.34.0 | 📋 |
| [v0.34.5](v0.34.5-docs-restructure.md) | v0.34.5 | Docs restructure — remove diaries/.claude, extract clean docs | Low | v0.34.1, v0.34.3 | 📋 |
| [v0.34.6](v0.34.6-asset-removal.md) | v0.34.6 | Asset removal — delete yumi + TTS coupling, build resilience | **High** | v0.34.0 | 📋 |
| [v0.34.7](v0.34.7-byo-onboarding.md) | v0.34.7 | New-user onboarding — BYO model + optional BYO voice | **High** | v0.34.6, v0.34.5, v0.34.2 | 📋 |
| [v0.34.8](v0.34.8-publish.md) | v0.34.8 | Publish to `Luna-ts` (fresh clean history, owner-gated) | Medium | v0.34.7 | 📋 🔒 |

## Acceptance criteria (whole initiative)

- [ ] `LICENSE` (MIT + Live2D carve-out) + `THIRD_PARTY_LICENSES` present; all five `package.json` carry
      `license`/`repository`.
- [ ] `grep -rn -e Alan -e "Alan-Yu-2077" -e Shion -e yunwu -e /Users/alanyu2077 packages/ scripts/ *.md`
      returns **0** in the public tree (docs/.claude removed).
- [ ] `bun test` green, `tsc --noEmit` clean (protocol/server/web/desktop), `bun run build` + desktop
      `pack` + `smoke:packaged` **all pass with no bundled model**.
- [ ] `setupView` API-base default is neutral (`api.anthropic.com`/empty); `vecRuntime` loads sqlite-vec
      on a non-homebrew env via `LUNA_SQLITE_LIB`.
- [ ] **Clean-clone dry-run passes** (the hard gate — "务必确保开源用户拉下来能够成功配置"): a FRESH
      clone in a scratch dir with **no private sibling present**, following ONLY `docs/SETUP.md`, reaches a
      running Luna — headless with just an Anthropic key (text-only + browser voice), then a rendered BYO
      model + a working GPT-SoVITS voice via `services/tts/` — with **zero** dependency on `../../Agent_Luna`
      or any owner file (`grep -rn "Agent_Luna/TTS\|gpt-sovits-service" packages/ scripts/ services/` → 0).
- [ ] (v0.34.8, owner-gated) the clean tree is published to `Luna-ts` as a fresh initial commit; its
      full history greps clean (name/handle/abs-paths/yunwu/yumi/`neoru` → 0); secrets 0.

## Open questions blocking start

- ~~The canonical public repo URL~~ — **RESOLVED (2026-07-09): `https://github.com/Alan-Yu-2077/Luna-ts`**
  (a fresh, empty public repo). Feeds v0.34.0 (`package.json.repository`), v0.34.1 (User-Agent), v0.34.5
  (README). The private repo stays `Agent_Luna_typescript`.
- ~~git-history strategy~~ — **RESOLVED: publish the clean tree to the fresh `Luna-ts` as a new clean
  initial commit** (no history to purge; the private repo is never rewritten). v0.34.8 is now a publish.
- **Rename `Luna` / project identity?** The OSS repo is named `Luna-ts`; keep the package name `Luna`
  unless the owner wants a rename (out of scope, but the repo name feeds README + package names).
- ~~The GPT-SoVITS glue vendoring question~~ — **RESOLVED (2026-07-09): no vendoring.** The private glue
  (`gpt-sovits-service.js` + `gpt-sovits-manager.js`, ~400 lines, spawns the backend + holds the `neoru`
  ref audio) is NOT copied in. v0.34.7 rewrites the forward to speak GPT-SoVITS's **own `api_v2` HTTP
  server directly**; the user runs GPT-SoVITS via `services/tts/docker-compose.yml`. Nothing owner-private
  ships. Owner directive: **务必确保开源用户拉下来能够成功配置** → v0.34.7 is gated by a real clean-clone
  dry-run (clone with no sibling present → SETUP.md → model rendering + voice working).
