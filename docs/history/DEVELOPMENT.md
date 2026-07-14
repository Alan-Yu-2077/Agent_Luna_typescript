# Luna (TypeScript) — Development History

Last updated: 2026-07-14 — v0.36.10 (**Collapse closes downward**: the grey panel's close now sweeps the top edge down with the bottom pinned (margin-top animation) — v0.36.7's max-height shrink had anchored to flex-start and closed upward.) · v0.36.9 (**Rising bubbles fixed**: ~2× slower climb (buoyancy 1.9→1.4), cloud-like wander (wider sway + per-body phase), and long sends shown in full (text clip lifted).) · v0.36.8 (**Falling bubbles fixed**: dissolve 30s→10s from rest (drag no longer disturbs the timer); drag reworked off `setStatic` to a live dynamic pin so bubbles keep physics, collide, and never overlap.) · v0.36.7 (**关窗户 closes the whole panel, slower**: the grey `.chat-panel` now shrinks its `max-height` in lockstep with the white body's grid-rows, so grey + white collapse together top-to-bottom; slowed to `--m-slow`.) · v0.36.6 (**Lace trim back + chat breathing room**: the lace strips return as decoration behind the model (never cropping her), and the chat box gets top/bottom gaps instead of filling the screen; model stays edge-to-edge.) · v0.36.5 (**Fixed single screen**: `overflow:hidden` at the root kills the horizontal scrollbar the off-screen VTS panel was growing, un-clipping the left chat panel — a fixed single screen again.) · v0.36.4 (**VTube-Studio-style settings, Initiative 26 5/5 — closes the initiative**: the bare checkbox box rebuilt into a gliding panel with a left icon rail (General / Avatar / Server tabs), iOS switches, sliders with value chips, and a click-to-close backdrop — presentational only, every setting + the smoke selectors preserved. Suite 1278 green.) · v0.36.3 (**Rising send bubbles, Initiative 26 4/5**: with the log hidden, a sent message lifts off the input bar as a buoyant bubble and floats out the ceiling — the complement of her falling words. New `ui/riseBubble.ts` + `scene.spawnRising`; risers collide with nothing and are click-through. Suite 1275 green.) · v0.36.2 (**Falling speech bubbles, Initiative 26 3/5 — flagship**: the comic tail is removed; a finished reply's bubble detaches from beside her head, falls with physics, bounces, rests, and dissolves 30s later — draggable/throwable (pet mode too), pile-capped at 6, barge-in spares floor objects. New `physics/scene.ts`; voice-gated fall trigger with a voiceless TTL fallback. Suite 1264 green.) · v0.36.1 (**Physics substrate, Initiative 26 2/5**: matter-js@0.20.0 adopted after a +29.6 KB gzip measurement under the 35 KB gate; new `packages/web/src/physics/` world seam — DOM rigid bodies, fixed-timestep sync, floor/walls, drag/throw, hidden-tab pause, dispose — with 18 headless tests. No user-visible behavior yet.) · v0.36.0 (**Motion revival, Initiative 26 1/5**: reduce-motion removed outright; 关窗户 top-to-bottom sash collapse; 无边模式 edge-to-edge stage; Fredoka + 站酷快乐体 cute fonts bundled offline; shared motion tokens + micro-motion layer.) · v0.35.8 (**README Moments gallery**: four real-conversation screenshots — humour, empathy, self-authored skills, reading her own code — with the fries moment as the hero; browser chrome cropped off (also dropping a private tab name). EN + 中文.) · v0.35.7 (**Showcase README**, EN + 中文, with three real packaged-app screenshots and a mermaid map; `LUNA_USER_DATA_DIR` makes screenshot/test smokes truly isolated after a caught private-data-in-capture near-miss.) · v0.35.6 (**Escape hatches back to setup**: a reconnect-loop badge pill, a native ⌘, menu item, and Open-Setup buttons on the failure dialogs — a bad config can no longer strand the user outside the wizard.) · v0.35.5 (**First-run actually shows the wizard**: boot precedence becomes attach → setup → dev → sidecar via a pure, tested `resolveBootMode` — a fresh `bun run app` clone no longer boots a keyless dev stack past onboarding.) · v0.35.4 (**Initiative 25 closes — guidance + default flip**: bilingual walkthrough cards on every wizard step (vendor consoles, skip costs, the two community resource links, system-browser-only opening), `LUNA_SETUP_WIZARD` default ON with a `=0` escape hatch, a packaged fresh-HOME wizard smoke as the clean-machine E2E, wizard-first README/SETUP.) · v0.35.3 (**Voice-pack drag-in**: drop a GPT-SoVITS pack → scan (runtime dirs skipped), canonical install, reference-instance yaml + launch command, live health badge + test voice; `serve.ts` ttsEnv becomes a per-request getter, retiring the v0.34.15 stale-env class.) · v0.35.2 (**Avatar drag-in**: the wizard's avatar step accepts the downloaded model folder — wrapper shape included — via a shared, unit-tested install core; Electron-33 `webUtils` path handoff; install no longer resets the wizard.) · v0.35.1 (**Live provider probes**: the wizard's embedding/search/weather steps test the real vendor before saving — auto-probe on Next with a "continue anyway" arm, QWeather host-guarded + body-code-aware, verdicts never echo a key.) · v0.35.0 (**Setup wizard shell**, Initiative 25 opens: a six-step flag-gated first-run wizard — pure nav core, zh/en copy infra, a 19-key whitelisted one-shot submit with chat probe-first, Settings re-run, bridge-less browser preview. Default OFF; legacy card untouched.) · v0.34.15 (**Packaged-app voice fix**: the desktop static host forwarded `/api/tts` using `process.env`, which never receives `luna.env`'s keys — so voice 502'd `"tts upstream not configured"` in the packaged app despite a correct config; now threads the merged TTS env into `startWebHost`. E2E: `/api/tts/speak` → WAV.) · v0.34.14 (**App lands on the Desktop**: `bun run app` now `ditto`-copies the built `Luna.app` to `~/Desktop` (override with `LUNA_APP_DEST`) instead of leaving it buried under `packages/desktop/release/…` — a real double-clickable bundle, copied only when the build changed.) · v0.34.13 (**App icon**: the desktop app gets a white-squircle / black-**Luna** wordmark (Avenir Next Bold) in place of the stock Electron diamond — a full `.icns` iconset wired via `mac.icon`, verified in the repackaged bundle.) · v0.34.12 (**One-command run**: `bun run app` installs on first clone, re-packages the desktop app only when a build input changed since the last `Luna.app` — else launches instantly — and hints (never spawns) when BYO GPT-SoVITS voice is down.) · v0.34.11 (**Recall relevance floor**: the GA recency term buried decisively-relevant OLD memories — a query semantically nailing an 8-day-old turn ranked it #147/500, below top-k, because recency 1/(1+8)≈0.11 swamps a modest cosine edge. New floor guarantees the top-N by PURE cosine a slot regardless of age; retrieval K 12→18. Live-DB sim: the buried turn goes #147 → #3, normal recall untouched. +4 tests, 1168 green.) · v0.34.10 (**Residual-PII sweep**: the final full-history grep caught owner-derived fixtures — a pet name and a coffee preference — still in the published test code, missed by the v0.34.1 fixture scrub; the fixtures were neutralized and the public history re-published clean, 1164 green.) · v0.34.9 (**Handoff surface**: this history restored to the public tree, scrubbed — 170 PII spans across 4741 lines replaced, every other byte preserved; NEW `CONTRIBUTING.md` + three PII-free agent skills.) · v0.34.8 (**Published** to the public repository as a single parentless root commit — none of the private history inherited; post-publish clone greps clean and builds green.) · v0.34.7 (**Bring-your-own onboarding**: `resolveModelUrl` + empty state, a zero-setup browser voice, the TTS forward rewritten to speak GPT-SoVITS `api_v2` directly, a desktop model picker; the owner-specific glue deleted. 1164 green.) · v0.34.6 (**Bundled avatar deleted**, TTS de-personalized, every deletion paired with the build/smoke fix it would otherwise break.) · v0.34.5 (**Internal diaries + author tooling removed**; `ARCHITECTURE.md` + `ROADMAP.md` extracted.) · v0.34.0–v0.34.4 (**Initiative 24 — OSS readiness**: MIT license + third-party notices, owner-PII scrub, de-gateway, portable sqlite-vec resolution, locale neutralization.) · v0.33.2 (**Continuation TTS no longer barges in**: a 💭 follow-up was cutting off the previous message's still-playing voice — the proactive turn's inner `runTurn` emitted `turn.started`, which the frontend treats as a user barge-in → `audio.stop()`. Fixed at the source: `runTurn` gates the emit on `!s.proactiveTurn`, so a proactive turn announces itself only via `proactive.started` and the reply's TTS finishes with the follow-up queued behind it. +1 test, 1143 green, server+web tsc clean.) · v0.33.1 (**Distinct glyph for continuation vs proactive**: a trace-dive found the persistent proactive-interrupt symptom was actually the 4s-post-reply self-continuation, not the silence ladder — and the UI badged both `🌱` since the continuation rides the proactive path. NEW `proactiveGlyph()` in `controller.ts` → `💭` for a `:cont:` continuation, `🌱` for a ladder/scheduler opener; pure frontend, no protocol/server change. +1 test, 1142 green, web tsc clean.) · v0.33.0 (**Desktop native location**: the desktop webview has no browser GPS, so weather stayed dark unless `LUNA_LAT_LON` was hand-typed. NEW `packages/desktop/src/location.ts` resolves a location from the Mac — manual value (never overridden) → CoreLocationCLI (accurate) → system-timezone→city (coarse, zero-permission, VPN-proof) — injected as `LUNA_LAT_LON` before the sidecar boots + persisted to `luna.env`; `main.ts` also wires the Electron geolocation permission handler + Info.plist keys so the browser `client.geo` path works on desktop too. Unifies with the web GPS path on the same `resolveLocation`. Empirically verified on the dev Mac (via the system timezone). +15 tests, 1141 green, desktop tsc+bundle clean.) · v0.32.5 (**Shutdown-dream cooldown gate**: on desktop every window close SIGTERMed the sidecar and tripped a full graceful-exit dream on EVERY quit; now gated on `LUNA_SHUTDOWN_DREAM_MIN_GAP_MS` (default 6h, reusing the persisted `dream_state.last_dream_ms`) so closing many times a day dreams at most once while the end-of-day consolidation backstop survives — a converge, not a delete. +4 tests, 1126 green, server tsc clean.) · v0.32.4 (**`is_final` short-circuit + `set_proactive_style` → owner setting**: the wedged-turn fix — `message(is_final:true)` message-only rounds skip the trailing `end_turn`-reconfirm round that kept `activeTurn` locked ~8s and bounced the next send, gated on `detectDefection` so a fresh promise-to-act still gets its act round; and the proactive-intensity knob moves from Luna's `set_proactive_style` tool to an owner `proactive.activeness` setting — tool + `proactive_style` table + `voice_notes` retired, `loadStyle()` reads `LUNA_PROACTIVE_ACTIVENESS`, the `LEVEL_MULT` safety rails unchanged. +1 test file, 6 round-counts updated, 1122 green, tsc clean.) · v0.32.3 (**Flip + owner surface + LD #12 amendment — Initiative 23 ✅ complete (4/4)**: the live dream A/B on a DB copy passed (4 runs vs the gateway: pipeline health, **null-restraint live** on a real ordinary day, one real shape bug caught+fixed — `SkillPatch` object→array coercion + prompt array-shape example, **positive distillation live** — `diagnose-tts-pipeline-silence`, `source='dream'`, on the shelf). `LUNA_DREAM_SKILLS` default ON (`=0` hatch, restart-free `skills.dream_distill` panel toggle); NEW `/_workspace` **Skills panel** (save/deprecate/restore through the audited store, provenance badges, audit tails; live-verified round-trip); raw-grid `skills` edits epoch-bump; **LD #12 amended** (the injected procedural layer). +4 tests, 1122 green, tsc clean. **Skills = the fourth memory pillar: surfaced, triggered, findable, self-growing, owner-maintained.** working tree) · v0.32.2 (**The `distill_skills` dream step — dark launch (Initiative 23, 3/4)**: the dream distills the day's salient episodes into ≤2 provenance-tagged skills — new step between `run_diaries` and `rag_refresh` (same-cycle embed, zero protocol change), `SkillPatch` + `distillSkillsPrompt` (AWM/CLIN/ACE rules + JSON-literal-null + data-not-instructions, content test-pinned, 8192 maxTokens), whole-patch rejection (active/deprecated collisions — **the dream may never resurrect** — missing merge target, non-stale deprecation, in-patch dupes), NaN-guarded caps with named drops, audited `source='dream'` writes (one-call `restoreSkill` undo), never runs bun test, behind `LUNA_DREAM_SKILLS` default OFF. 11-agent review: 9 confirmed (0 refuted), all fixed — incl. the HIGH description-injection into the cached block, closed at BOTH the write choke point (`saveSkill` single-lines) and the sink (`renderSkillShelf`). +19 tests, 1118 green, tsc clean. ⚠️ live dream A/B gates the v0.32.3 flip. working tree) · v0.32.1 (**Skills into semantic recall + usage tracking + the embed-key fix (Initiative 23, 2/4)**: `'skills'` joins `retrieve()` as the fourth source (name+description pointers, `RecallSource` union, recall-tool scope + enum) — **relevance-gated with no recency term** (review fix: fresh zero-relevance skills scored 0.58 and could flood the top-12 for ~11h/save; now token-overlap or cosine ≥ `LUNA_SKILL_RECALL_MIN_COS` required, `t_ms=created_ms`); boot-frozen `setSkillsRecallMounted` kills the live-pin half-application (candidates + pre-warm + an honest scope error read ONE truth); `recall_skill` hits `markUsed()`; **rag_refresh `contentHash`→`embedCacheKey` fixed** (dead pre-warm since v0.20.5) + migration `0019` cache reset. 9-agent review: 6 confirmed, all fixed. +11 tests, 1099 green, tsc clean. working tree) · v0.32.0 (**Skill shelf + L1 trigger + lifecycle substrate — Initiative 23 opens (1/4)**: close the awake loop the skills audit found open (1 skill + 4 recalls in 19 days — un-triggered, un-surfaced). Migration `0018` (skills_audit incl. prev_verified_ms + used_count/last_used_ms/source/deprecated_ms); `skillStore` lifecycle-complete (audit-first + no-op-guarded + epoch-bumped saves; byte-identical → verified_ms refresh only; `markUsed` epoch-bumps only on over-cap membership change; `deprecateSkill`; `restoreSkill` chains as undo/redo incl. verified_ms; `listShelf` name-ordered/usage-evicted). The **skill shelf** renders in the cached block (deterministic, `LUNA_SKILL_SHELF`/`_MAX`); `renderL1Contract` flags 8+9 + a **two-variant SKILLS_CLAUSE** (never asserts a suppressed shelf); `isSkillsMode`; `save_skill` description pushy-what+when; `skills.enabled` joins the settings panel. 14-agent adversarial review: 10 confirmed, all fixed pre-commit. +30 tests, 1088 green, tsc clean. working tree) · v0.31.0 (**Owner-maintainable soul — the soul editor in `/_workspace`**: the soul's fixed core becomes the human owner's to maintain in the DB, not code. `seedFixedCore` → **seed-if-empty** (`default.md` is a first-boot template only; a non-empty fixed core is never re-clobbered — before, it overwrote on any file-hash change so the owner couldn't customize without editing code); NEW `updateFixedCore()` (owner-authoritative, epoch-bumped; Luna's dream/tools never call it → the fixed-core firewall stands). NEW `/_workspace/api/soul` GET+POST+`/reseed` (dev-tools-gated) + a **Soul editor panel** (fixed core + evolving self/bond as textareas, Save + Reset→default.md); a raw soul-cell edit now bumps the epoch; dead `core_memory_audit` reset target retired. +9 tests, 1058 green, tsc clean; live-verified an owner edit survives a reboot — not 固定死. working tree) · v0.30.3 (**Retire core_memory, soul is the only path — Initiative 22 ✅**: flip the soul on + delete the old path — `buildSystemPrompt` always renders `renderSoulBlock()` (persona-file push + `LUNA_SOUL_DB` branch gone), `renderCoreBlock` is L3-only, the dream + `remember` tool write the soul's evolving section unconditionally, `soulDbEnabled()` deleted. NEW migration `0017` safety-re-migrates then drops `core_memory`/`core_memory_audit`; `coreMemory.ts` + the `CoreMemory` type deleted (zero importers, tsc/grep clean); `loader.ts` is seed-only; LD #12 amended in REWRITE_CONTEXT. Tests repointed to the soul. 1052 green, tsc clean. **Initiative 22 ✅ complete** — the persona is one DB soul file: git-seeded fixed core + Luna-authored evolving section. branch) · v0.30.2 (**Dream authors the evolving section, Initiative 22 3/4**: under `LUNA_SOUL_DB` the dream's `persona_update` reads + writes the soul's evolving section via `updateEvolving` (off: legacy `core_memory`) and can touch ONLY it — a fixed-core firewall test proves `soul.fixed_text` never changes. `personaUpdatePrompt` surgically amended (boundaries kept): a cleanup trigger ("CLEANUP IS A REAL EDIT" — purging a still-contaminated field is warranted) + a loosened-freeze positive trigger fix the June-24 freeze. NEW one-time `cleanEvolvingBond()`/`stripLedger()` purge the audited fact-ledger from `evolving_bond` (audited/restore-able, idempotent, never blanks). +8 tests, 1057 green, tsc clean. ⚠️ live dream A/B is the gate before v0.30.3 flips the default. branch) · v0.30.1 (**Render the soul into the prompt, Initiative 22 2/4**: behind `LUNA_SOUL_DB` (default off, A/B), `buildSystemPrompt`'s persona block renders the whole DB soul — NEW `renderSoul.ts` `renderSoulBlock()` = `fixed_text` + fenced `## Who I am becoming`/`## The bond, right now`, deterministic + `FALLBACK_PERSONA` on empty — and `renderCoreBlock` drops its self/relationship half (L3 survives) so there's no double-render. Off path byte-identical to v0.29.x. +11 tests incl. a self-appears-once A/B guard. 1049 green, tsc clean. branch) · v0.30.0 (**Soul store + migration + seed, dark launch — Initiative 22 1/4**: lands the DB substrate for the soul file (a dev-authored fixed core + a Luna-authored evolving section replacing `core_memory`) with zero runtime behavior change. NEW migration `0016_soul.sql` (`soul`+`soul_audit`; `core_memory` untouched); protocol `Soul` type; NEW `memory/soulStore.ts` (`getSoul`/`seedFixedCore`/`updateEvolving`/`restoreEvolving` — hash-gated no-op + audit-first + epoch-bump, ported from `coreMemory.ts`); NEW `memory/soulSeed.ts` (`seedSoulOnBoot()` — hash-gated fixed-core seed from `persona/default.md` + a one-time verbatim migration of `core_memory` into the evolving section, idempotent, wired into `main.ts`). `persona/default.md` restructured content-preservingly into the 5 fixed-core sections; still the actual runtime source this version. `buildSystemPrompt`/`renderCoreBlock` untouched — proven byte-identical whether or not the soul table is seeded. +13 tests; 1042 all-package green, server+protocol `tsc` clean. branch) · v0.29.1 (**Tune amplifiers + retire the flag, Initiative 21 2/2 ✅**: with the idle-timer proven, `silenceGap = now - lastActivityMs` becomes unconditional — `LUNA_PROACTIVE_SILENCE_TIMER` + `silenceTimerEnabled()` + the anchor selector deleted (grep-confirmed zero refs), `WakeContext` drops the now-unused `lastUserMs`. Two calmer defaults (still env-overridable): `LUNA_PROACTIVE_AMBIENT_MIN_MS` 120_000→300_000 (5-min lull, not 2) + `LUNA_PROACTIVE_AMBIENT_PROB` 0.12→0.06 (the per-tick re-roll no longer compounds to ~85% over a long silence). Ladder shape unchanged. +eligibility/bounded-rate tests, flag-off tests removed; 1019 green, server+protocol `tsc` clean. **Initiative 21 ✅ complete.** branch) · v0.29.0 (**Silence idle-timer core, Initiative 21 1/2**: the reported bug — Luna interrupts an active conversation seconds after she finishes replying — because the silence ladder's `effective_gap` counted only `lastUserMs` + `lastProactiveMs`, and her reactive replies advanced neither, so the clock kept running from the user's earlier message. Fix: one NEW `session.lastActivityMs` idle-timer bumped by `markActivity()` at every user message + every reply-producing turn finalize (reactive/continuation/proactive), seeded on preload from the last L2 `t_ms`; `ladder.ts` + the anti-spam idle floor read `silenceGap = now - lastActivityMs`. Two clocks kept separate: `lastUserMs` still keys only the escalation reset, `lastProactiveMs` still governs outreach spacing. Behind `LUNA_PROACTIVE_SILENCE_TIMER` (default on). No schema/protocol/migration change; stays inside LD #15. +9 tests, 1019 green, server `tsc` clean. branch) · v0.28.9 (**Desktop one-click dev stack**: when it must start the backend, the app now launches the whole `bun run dev` stack — server+web+tts, one click, browser shares the same Luna — falling back to the compiled sidecar with no bun/repo. NEW resolveDevLauncher + supervisor cwd; +4 tests, 1020 green; repackaged + smoke green. working tree) · v0.28.8 (**Desktop ↔ web backend unification**: the app now shares `bun run dev`’s :8787 + the repo `luna.sqlite` — attaches to a running backend or spawns its own against the shared DB, so the desktop window and the browser tab are one Luna; NEW backend.ts, +6 tests, 1016 green; repackaged + smoke green. working tree) · v0.28.7 (**Desktop TTS wiring**: the desktop app showed the boot gate's "Loading the voice model" animation then **always** went muted — Initiative 19's `serve.ts` hardcoded a 502 for `/api/gpt-sovits/*` and `main.ts` never spawned the GPT-SoVITS proxy (the agent WS backend is shared with web dev; TTS is a separate sidecar the shell never brought up). NEW `desktop/tts.ts` (`resolveTtsConfig` reuses dev-all's `LUNA_TTS_DIR`/`LUNA_TTS_PORT` + module-presence probe); `serve.ts` `startWebHost(ttsUpstream?)` → `forwardTts` proxies the route with binary passthrough (no/dead upstream → 502, smoke unchanged); `main.ts` auto-spawns the proxy as a second supervised sidecar via Electron-as-node (`ELECTRON_RUN_AS_NODE`, no bun dep), guarded by presence, no-op under SMOKE, killed on quit. Zero-config voice on a source checkout, muted-degrade when the local-only TTS module is absent. +11 tests, 1010 green; forward-proxy hardened (path-traversal guard + 600s fetch abort); protocol+server `tsc` clean (desktop `tsc` red pre-existing: electron devDep unavailable in-env). branch) · v0.28.6 (**Pet drag rework — clicks work again**: `-webkit-app-region: drag` intercepted every mousedown at the native layer (nothing inside the pet was clickable) → dropped entirely; manual drag via pointerdown-on-her-bbox + `lunaPet.drag*` IPC + pure `petDrag.ts` (absolute-from-origin placement). Click-vs-drag now unambiguous. +3 tests, 999 green; repackaged + pet smoke green. branch) · v0.28.5 (**Cost tripwire + usage in traces**: `warnIfExpensiveRound` — a loud `[cost] ⚠️` console warning when ONE request exceeds `LUNA_COST_WARN_INPUT_TOKENS` (default 80K), + `turn.result` traces now carry real input/output token usage so `/_trace` shows cost regressions (the field was empty — why the fold stall went unnoticed). +3 tests, 996 green. branch) · v0.28.4 (**EMERGENCY — L1 fold stall → unbounded context**: a drifted fold watermark hit planFold’s exact-match bail and stalled folding forever → every turn sent 1444 msgs ≈ 294K tokens. Fixed: planFold heals drift (snaps to the crossed row boundary); NEW hardTrimTail bounds the tail (300 msgs / 120K chars, turn-start cuts only) regardless of state; mid-pair tail starts align forward. Live-DB replay: ~294K tok → ~43K immediately, fold heals 119 turns; restart self-heals. +5 tests, 993 green. branch) · v0.28.3 (**Initiative 20 review remediation** — a 24-agent adversarial review fixed: mergeEnvFile newline-injection (HIGH, strips control chars), supervisor unhandled spawn-error (clears child not wedge), onboarding-submit concurrency guard, petFraming 0-dim NaN guard, smoke barNoDrag tighten; other findings REFUTED. +4 tests, 988 green. branch) · v0.28.2 (**Pet window move + resize — Initiative 20 ✅**: pet window is now movable (`-webkit-app-region: drag` on her body) + resizable (`resizable:true` + min-size), per-pixel click-through dropped for the real thing; the model re-fits on resize for free; smoke asserts it. +1 test, 984 green. branch) · v0.28.1 (**Pet model fixed half-body** — pet mode makes the Live2D model an inert head-to-waist portrait: NEW pure petFraming.ts, pixiLive2DSink `{pet}` option disables model drag+scroll-zoom, windowed unchanged; +4 tests, 983 green. branch) · v0.28.0 (**First-run onboarding — Initiative 20 opens**: the desktop app's "edit luna.env, then restart" chore becomes a guided setup screen — NEW `onboarding.ts` (needsOnboarding + line-preserving mergeEnvFile + classifyProbe), `setupView.ts` form on `?setup=1`, `supervisor.restart(env)` to apply keys live, `main.ts` gate + `luna:onboarding-probe/-submit` IPC (test-then-write; key never on the settings wire, never echoed back). +18 tests; 979 green, `tsc` ×4 clean. branch) · v0.27.6 (**Audit polish/redundancy remediation** — the prompt system's voice + redundancy layer (deferred findings from the 21-agent audit): persona file rewritten **3rd→2nd person** ("Luna is… She should…" → "You are… You…"), preamble → "This is who you are", `BASE_DIRECTIVES` gains an identity anchor + a precedence line; check-in denylist de-triplicated (phrase list kept once, on the ladder path) + proactive person-refs unified to a single owner pronoun; single-user hardcoded name removed from the weather/time strings + clauses ("where the user is"); warmth-not-guilt / bulletin-avoidance / message-mode-mechanics duplications trimmed to one home each; "mood of the hour" late-night demoted from a prescribed affect to a neutral fact; banned-closer + `INTENT_NO_ACT` + wake-scene reframed positive-first (no forced double-apology, no amnesia double-exposition); dream refine/audit prompts gain a worked example + personaUpdate restraint 4→2 bullets; time_now/weather/remember descriptions gain when-not-to-use boundaries. 4 test wording-assertions updated; 964 green, `tsc` ×4 clean. branch) · v0.27.5 (**Audit structural remediation** — three prompt-structure findings from the 21-agent audit: (1) the four code-agent L1 clauses (read-before-edit / run-verify / find_symbol+repo_map) were unconditional in the cached core (~51% of the base contract) while web/time/weather gate on their mount — now gated on `LUNA_CODE_WRITE`/`LUNA_SHELL`/`LUNA_REPO_MAP` via new `isCodeWriteMode`/`isShellMode`/`isRepoMapMode`, so a companion session never reads a contract naming unmounted tools; locate-first + plan stay in the base; `EMBODIMENT_BLOCK` drops its duplicate workspace/edit sentence. (2) injected recall was framed as firsthand memory ("Things you might be recalling") — relabeled to a told-vs-remembered LEAD honoring the persona seam, the "trust" clause scoped to the TS-computed time label, and `clip()` neutralizes a literal `</memory>` so stored text can't close the fence early. (3) `FALLBACK_PERSONA` now carries the non-negotiable anti-assistant guardrails, so an unreadable persona file no longer silently yields a thinner Luna. +2 tests; 964 green, `tsc` ×4 clean. branch) · v0.27.4 (**Audit real-bug remediation** — three reproducible defects from the 21-agent prompt/injection audit: (1) the corrective stage-directions (SILENT/PROMISE/INTENT) were pushed as `role:'user'` messages and `stripThinking` only clears assistant blocks, so they **persisted into durable history** — every later turn's context window re-read a fabricated "user" scolding (`(Stage direction: you ended your turn without speaking…)`); a new tool-pairing-safe `stripCorrectiveDirectives` (remove-then-coalesce-same-role) drops them in finalize before persistence. (2) `diaryInjectEnabled()` used `=== '1'` (the lone default-OFF outlier), so the day/week/month diary digest never reached the model by default → flipped to `!== '0'`. (3) `personaUpdatePrompt`'s null example was a quoted string containing the word "null", so a literal-minded model could emit the STRING `"null"` and overwrite a still-true `self_state`; the example now shows the JSON literal `null` + an explicit instruction, backed by a `normPersonaField` coercion in `cycle.ts`. +6 tests; 962 green, `tsc` ×4 clean. branch) · v0.27.3 (**Proactive directive leaked into a phantom user bubble**: a proactive turn's `userText` is the internal `[System proactive trigger …]` / self-continuation priming, not a real user message — but `runTurn` persisted it as L2 `user_text`, so the frontend rendered the raw directive as a user bubble (present since ~2026-06-16). Fix: `userText: opts.proactiveTurn ? '' : opts.userText` (directive stays in `raw_json`). Cleaned 7 leaked live rows. +1 test; 956 green. branch) · v0.27.2 (**Desktop preload fix — the pet toggle actually loads**: the "Desktop pet" row was invisible because the Electron preload never loaded — bun inlines `__dirname` as the SOURCE dir at compile time, so `join(__dirname,'preload.cjs')` pointed at a nonexistent `src/preload.cjs` and the `lunaPet` bridge silently failed (latent since v0.26.1 — also killed pet click-through). Fixed with `app.getAppPath()`; the smoke now asserts the bridge is live + opens the panel. Verified in dev + packaged. branch) · v0.27.1 (**Settings surface — the server-driven settings panel**: 16 whitelisted env flags across 5 categories become a live, auto-rendering panel — NEW wire `settings.set`/`settings.state` (server-driven: pushed on connect + re-broadcast after each accepted set), NEW `settings/registry.ts` + `settings/store.ts` (user-pin > env-file > default, applied via `Bun.env` overlay before provider/registry construction; pins persist in migration `0015`; reset restores the original env; secrets excluded by construction), NEW `web/src/ui/settingsView.ts` auto-render with restart badges + per-pin reset. Live-verified set→broadcast→reset→env-fallback on isolated :5273/:8899; an adversarial review caught + fixed 2 real bugs (double-init env-snapshot corruption, boolean canonicalization). +20 tests; 955 green, `tsc` ×4 clean. branch) · v0.27.0 (**Settings surface opens — the pet toggle in the panel**: pet mode is now a "Desktop pet" switch in the settings panel (desktop shell only) — NEW `shellSettings.ts` persists the choice in `userData/settings.json` and it wins over `LUNA_PET_MODE` (demoted to initial default); NEW `lunaPet.setPetMode` bridge + `luna:set-pet-mode` IPC rebuilds the window new-before-old (creation-time-immutable options; close-first would kill the sidecar via `window-all-closed`). +4 tests; 936 all-package green, `tsc` ×4 clean. branch) · v0.26.2 (**Initiative 19 ✅ closes — the pet window**: `LUNA_PET_MODE=1` turns the shell into a transparent, frameless, always-on-top pet — the web strips the striped room (`pet` class) and forces the companion layout, so only Luna + her comic bubbles + the pill bar float over the desktop; **region click-through** via a pure `petHitTest` (the sink now publishes her body bbox as CSS vars per frame) → `preload` contextBridge → `setIgnoreMouseEvents(forward:true)` — clicks in her margins hit the desktop, her body stays draggable; geo = `LUNA_LAT_LON` in the luna.env template. **Packaged pet smoke PASSED: `{ok:true, pet:true, bodyBgImage:"none", wsStatus:"open"}` + a real-alpha PNG (the reference model over pure transparency, no premultiplied-alpha edge halos)**, clean exit, no orphan. +4 tests; 932 all-package green, `tsc` ×4 clean. **Initiative 19 complete (3/3)** — deferred to the owner's eyes: real keys + a real chat turn + the window-level compositor check. branch) · v0.26.1 (**Initiative 19 — the single-machine app**: the compiled 62MB `luna-server` sidecar (sandbox-verified WS ping→pong on a fresh app-data DB), logic-free server fixes for compiled-binary paths (`LUNA_MIGRATIONS_DIR` + `lazyHtml()` for the three dev viewers whose import-time `readFileSync`s crashed the binary), the desktop supervisor (keys in `userData/luna.env` — never bundled; spawn → bounded restart → kill-on-quit; `waitForPort`; first-run template; the app's server on :8790 so it coexists with a dev :8787), electron-builder packaging with sidecar+migrations+persona+web as resources. **The packaged .app smoke PASSED — `{ok:true, canvas:true, headX:"373px", wsStatus:"open"}`: its own spawned server, the real WS round-trip, clean exit, no orphan.** Frontend LD amended in REWRITE_CONTEXT. +6 tests; 928 all-package green, `tsc` ×4 clean. branch) · v0.26.0 (**Initiative 19 opens — desktop app: port foundation + Electron rendering smoke**: `packages/web` gains a production build (`bun run build` → a self-contained 8.4MB `dist/` — 425 modules to one hashed bundle + Cubism core + the reference model copied); NEW `web/src/wsUrl.ts` fixes the #1 desktop break — the WS endpoint is a fixed `ws://127.0.0.1:8787` with the `?ws=` override intact, no longer derived from `location.hostname`. NEW `packages/desktop` (Electron ^33): `serve.ts` (a pinned-`:5177`, path-jailed loopback static host — a REAL http origin so absolute asset paths + `luna:*` localStorage work unchanged; standalone for v0.26.1's sidecar), `main.ts` (one plain window, `contextIsolation` on, `backgroundThrottling:false` — the pet failure mode reproduced live in Init 18's preview), `smoke.ts` (the automated go/no-go: HIDDEN window + DEAD `:8899` WS so the stable `:8787` is untouched, DOM probe + PNG capture). **Smoke PASSED: `{ok:true, headX:"373px"}` — the head-anchor var is only written by a live render frame, so the reference model renders AND animates inside Electron's Chromium from the production bundle** (screenshot confirms the full UI). +3 tests; 922 all-package green, `tsc` ×4 clean. Deferred to the owner's supervised run: the live chat round-trip (a live WS would touch the owner's running instance). branch) · v0.25.2 (**Initiative 18 ✅ closes — model glide + head-anchored comic bubbles**: a FLIP glide on the pixi beat (NEW `live2d/ease.ts` extracted easing + NEW pure `glide.ts` tween with `stop()`; `ModelDriver` composes `base+drag+mode` so a glide never clobbers the persisted drag; `pixiLive2DSink.glideLayout(mutate)` captures screen-space x around the layout change and eases the mode offset → 0 — live-sampled both directions, textbook ease-in-out, no snap). the owner's design review folded in: the speech bubbles **anchor beside her HEAD** (the sink publishes `--luna-head-x/y/--luna-head-gap` per frame off the gaze's `HEAD_FRAC`; clearance `0.26×model.width` keeps them off her hair; drag/zoom/glide all tracked), the newest bubble carries a **comic tail** pointing at her face (`::after`; the previous bubble's tail **transitions away the moment it becomes history**; fading bubbles drop theirs), and each bubble lands with bounded **random jitter** (rng-injected, tested). Adversarial review: **3 CONFIRMED, all fixed** — fit() re-clamps + heals a persisted drag that could strand her off-canvas after expand; `glide.stop()` cancels an in-flight tween on the reduce-motion snap; OS-level `prefers-reduced-motion` now honored by the JS glide + the boot class. +9 tests; **919 all-package green, `tsc` ×3 clean**; browser-verified on the isolated :5273 preview (dead-port WS — stable instance untouched). **Initiative 18 complete (3/3), zero server/protocol change.** branch) · v0.25.1 (**Initiative 18 — collapse ↔ expand morph**: a `collapse-btn` in the input-row (survives collapse; a header button would have been a one-way door) toggles a persisted `.collapsed` mode — the chat panel morphs into a fixed centered bottom pill bar (`min(560px,92vw)`), header/log hidden, the model region takes full width (+ fills the freed column on mobile ≤720px), a synthetic `resize` re-fits the model; the v0.25.0 `RouterBubbleView` now reads the REAL collapse state. Drive-by fixes: `buildLayout`'s `className=` silently wiped the boot-persisted `reduce-motion` class (→ `classList.add`); reduce-motion overrides written as compound same-element selectors. **Browser-verified on an isolated :5273 preview** whose `/` redirects to `?ws=8899` (a dead WS port — the page can never touch the stable :8787): collapse → pill bar + full-width centered the reference model + bubbles beside her; expand → panel restored; reload boots collapsed; mobile clamps sanely. `tsc` ×3 clean; 85 web green. branch) · v0.25.0 (**Initiative 18 opens — collapsible companion UI, beside-model speech stack**: NEW `ui/speechStackView.ts` (`SpeechStackView implements BubbleView` — a timed bubble stack in `.model-stage`: newest at the bottom, ~10s TTL then a CSS fade, overflow cap, `clearAll` for barge-in, `noteSpeechStart` speech-gating; open/append/chip/history are no-ops so it shows only finalized replies) + `ui/routerBubbleView.ts` (forwards to the window view always + the stack when `collapsed()`, read live per-call). `app.ts` wraps the two views in the router (collapsed = a `luna:bubble-stack` localStorage toggle until v0.25.1's real collapse state), speech-gates a wrapped AudioSink (`onStart`→`noteSpeechStart`), clears the stack on `turn.started`, and points the user echo at the window view. `theme.css` adds `.speech-stack`/`.speech-bubble` + reduce-motion. **Zero server/protocol change** — fed by the existing controller→BubbleView seam. +11 tests (router forwarding + stack mechanics via a fake DOM + injected scheduler); 85 web green, `tsc` ×3 clean. Live visual check deferred (a preview would collide with the stable :5173/:8787). branch) · v0.24.2 (**Initiative 17 ✅ closes — proactive style self-tuning**: NEW `proactive/style.ts` — the two-layer style (operator env floor/ceiling + a Luna-writable activeness aloof/balanced/clingy + voice notes); `resolveEffectiveCadence` applies the `_LEVEL_MULT` lever then clamps inside the rail (`balanced` = the raw knobs, so default behaviour is unchanged). Migration `0014` (singleton `proactive_style`). NEW `set_proactive_style` tool (`defineTool`, `proactiveRisk:'safe'`; added to the protocol `ToolName` enum + `builtinRegistry`) — she tunes her own outreach personality, the clamp enforced in the resolver never trusted from the input. Lever wired into `passesAntiSpam` (cooldown/quota) + `evaluateLadder` (probs/renudge); `proactiveTurn` threads voice notes. +13 tests; 795 server + 104 protocol/web green, `tsc` ×3 clean. **Initiative 17 complete (3/3).** branch) · v0.24.1 (**Initiative 17 — proactive ladder flips default-ON + detectors retired**: `ladderEnabled()` defaults on (the silence ladder is now THE wake decision; `LUNA_PROACTIVE_LADDER=0` = escape hatch). Deleted `detectors.ts` (the 5 detectors + registry) + `detectors.test.ts` + the scheduled-slot machinery in `cadence.ts` (the `slotsUsed`/`slotsDate` fields + `scheduledSlots`/`isSlotConsumed`/`markSlotConsumed`; migration-0013 DB columns left vestigial). `fire.ts` dropped the detector seam + debounce; `FireOutcome`={fired,spoke}. fire/scheduler tests rewritten to drive the ladder; the `>18h` test now asserts `sleeping`/no-fire (pure-Python parity). Amends LD #15. 784 server green, `tsc` clean. branch) · v0.24.0 (**Initiative 17 opens — proactive silence ladder, core**: the owner's Python proactive design restored as the wake DECISION behind `LUNA_PROACTIVE_LADDER` (default off, coexists with the detector registry). NEW `ladder.ts` `evaluateLadder` — the ported phase machine driven by `effective_gap = min(userGap, sinceProactive)` through `engaged → idle_watch → nudged → dormant (+ sleeping)`: ambient · idle_nudge · renudge on `[1.0,2.4,6.0]` backoff · leave_message · DORMANT auto-recovery · long-absence · read-time user-reset — returning the effective `{scenario,phase,nudgesSent}`. `cadence` gains `commitScenario` (effective base) + `commitLadderSilent` + `commitLadderPhase`; `proactiveTurn` gains the 4 restraint-graded scenario framings + full `COMPANION_OPENER_CONSTRAINT` (陪伴不查岗) + anti-repeat; `fire.ts` a `LUNA_PROACTIVE_LADDER`-gated branch. Adversarially reviewed (2 lenses + refute-by-default): **3 confirmed defects, all fixed** — the pure evaluator's user-reset/dormant-recovery/idle-climb transitions were discarded at commit (renudge-tier skip + a DORMANT lockout + a frozen climb); fixed by persisting the effective phase on the spoke/silent/null paths (mirrors Python's in-place `st` + `note_attempt`). +27 tests; 807 server green, `tsc` clean. branch) · v0.23.5 (**persona fix — kill the assistant-filler closer tic**: live L2 caught Luna padding *reactive* replies with hollow check-in bait ("Still here — what's on your mind?" / "Talk to me" / "What's wrong?") — **model-generated** (absent from all TS + Python source, not a hardcoded fallback), 11 of the recent 237 turns, once *while the user was complaining she sounds like a robot* (`turn:236`); root cause = the anti-查岗 constraint lived only on the **proactive** path and the persona file's abstract "no assistant patterns" didn't hold. `renderHumanityBlock()` — the cached "How you speak" block (`runTurn.ts:137`) — gains a **concrete** rule: names the banned closers (+ 在吗/还在吗), grants "a reply can simply end", makes her mirror a thin OwO/lol *lightly* rather than inflating it into a probing/status question, while keeping genuine specific curiosity. +1 test; persona 14 green, `tsc` clean; **restart-gated** (system block memoized per process). branch) · v0.23.4 (**OpenAI hardening** — remediates the post-ship audit PR #8 of Initiative 16, *before* the first live OpenAI run: forces a `tool_use` stop on the **default buffered path** when tool_calls are present (the audit's cleanest bug — orphaned `tool_use` 400s the next request; the SSE path already guarded it); **config dead-on-arrival** fixes — base-URL no longer falls back to `ANTHROPIC_BASE_URL` (no `/v1`-drop 404, no bearer key to the Anthropic host), the factory is the single source of the wire model (log no longer lies), `NaN`-guarded `LUNA_MAX_TOKENS`; **tolerant parsing** — `safeParse` skip-bad-chunk, synthesized `call_<index>` tool ids, in-band error-frame detection; **`tool_choice:'required'`** so a GPT model can't bypass the message tool; retry parity + `complete()` `reasoning_effort:'low'`; error-body redaction, SSE reader cleanup + size cap, registry `id.min(1)`. Adversarially reviewed (4 findings, 0 confirmed). +9 tests; 883 green, `tsc` ×3 clean, branch) · v0.23.3 (Initiative 16 **✅ CLOSED** 4/4 — **OpenAI-protocol adapter: model registry**: a `provider/registry.ts` resolves `LUNA_MODEL` → a `ModelEntry` (protocol + per-model quirks: `tokenParam` `max_tokens`/`max_completion_tokens`, `system`/`developer` role, `reasoning`, `toolUse`), built-ins (claude → anthropic; gpt-/o-series → openai) + a `LUNA_MODELS_JSON` override so a new model needs no code change. `providerFor()` is registry-driven (`LUNA_PROVIDER` forces the protocol); `OpenAIProvider` takes the entry and threads the quirks (entry-driven, **no model-id regex** at call sites). Picking a model is now one decision. +9 tests; 875 green, `tsc` ×3 clean. **Initiative 16 done** — Luna runs on Anthropic OR any OpenAI-protocol model; the live multi-model E2E is the one remaining step (needs a restart against real endpoints). branch) · v0.23.2 (Initiative 16 3/4 — **OpenAI-protocol adapter: real SSE streaming**: `OpenAIProvider.chatStream` gains a true streaming path behind `LUNA_OPENAI_STREAM` (default off → the proven v0.23.1 non-streaming fallback) — OpenAI SSE deltas → `text_delta` / `thinking_delta` (reasoning models, `LUNA_OPENAI_REASONING`) / `tool_use_start` / `tool_input_delta` as they arrive (interleaved tool-use, the latency win), accumulating `tool_calls` by `index` then one `message_stop` built from the **same shared block builders** as the non-streaming path (identical replayed history). A pure, tested `consumeSSE` byte-framer + a `setOpenAIStreamFetcher` seam. Adversarially reviewed: 2 real robustness gaps **fixed** — a tool stream with no terminal `finish_reason` now still stops as `tool_use` (else runTurn wouldn't dispatch → orphaned `tool_use` → next-request 400), and `consumeSSE` drains a final newline-less `data:` line. +13 tests; 866 green, `tsc` ×3 clean, branch) · v0.23.1 (Initiative 16 2/4 — **OpenAI-protocol adapter: translation core + provider**: a pure, exhaustively-tested `provider/openai/translate.ts` (Anthropic⇄OpenAI: system/messages/tools → OpenAI request; response → synthesized `ContentBlockParam[]` + `toolUses` + usage; tool_use⇄tool_calls, tool_result⇄`{role:'tool'}`) + an `OpenAIProvider` with `complete()` + a correctness-first **non-streaming** `chatStream()` (real SSE streaming is v0.23.2), behind a `setOpenAIFetcher` test seam. `providerFor()`'s `openai` branch now constructs it. `message_stop.assistantContent` retyped `ContentBlock[]`→`ContentBlockParam[]` (replay content is a param; lets a non-Anthropic provider synthesize it without response-only fields). Adversarially reviewed (translation-fidelity + integration lenses + refuters): 7 findings, **0 confirmed** (Zod is correct for standard responses; the baseURL `/v1` footgun is documented). +20 tests; 853 green, `tsc` ×3 clean, branch) · v0.23.0 (Initiative 16 **opens** 1/4 — **OpenAI-protocol adapter: provider seam**: a `ProviderCapabilities` descriptor every `Provider` self-declares + a single `providerFor()` factory selectable by `LUNA_PROVIDER` (default `anthropic` → **zero behavior change**). The `openai` branch throws until v0.23.1; an unknown value fails fast. `AnthropicProvider`/`MockProvider` declare capabilities; `main.ts` constructs via the factory and logs them. Amends the provider Locked Decision ("Anthropic-SDK-only chat") in REWRITE_CONTEXT — a fresh TS provider honors per-instance keys, so the cut `openai_compat`'s bug doesn't recur. Pure additive seam (no `runTurn` touch — the OpenAI path will strip `cache_control`, not gate it). +7 tests; 833 green, `tsc` ×3 clean, branch) · v0.22.3 (Initiative 15 **✅ CLOSED** 4/4 — **proactive: fuzzy detectors + delete the wake-gate**: two heuristic detectors `openThreadAged` (an L3 `active_thread` open > 24h) + `promisedFollowThrough` (an unfollowed "I'll do X" beat in a 6–36h window), both **default-off** + soft-seeded so a false positive yields silence. **Deleted `wakeGate.ts`** + its test + the `LUNA_PROACTIVE_LLM_GATE` branch + the now-orphaned `shouldConsiderWake`/`listRecentProactiveTexts` — the heartbeat is now **LLM-free** (cheap detectors → the silence-capable turn → `{spoke}` is the decision). Adversarially reviewed (2-lens panel + refuters: 5 confirmed, all fixed — tightened the promise regex against empathy-line false positives, added an abandoned-promise upper bound so a silent turn can't re-fire forever, plus `.env.example`/orient-map hygiene). +net tests; 826 green, `tsc` ×3 clean, branch) · v0.22.2 (Initiative 15 3/4 — **proactive: event hooks + a real single-turn lock + weatherShift**: a new `proactive/fire.ts` is the universal entry point — `withProactiveLock` flips a synchronous per-session in-flight flag BEFORE any await (the prior `activeTurn === null` check-then-act was a TOCTOU; the new ws-reconnect + weather-refresh hooks made the race reachable), and `maybeFireProactive` runs the whole funnel (anti-spam → detector → debounce → turn → cadence commit → dream handoff) inside it. The scheduler tick, both event hooks, continuation, and dev-fire all acquire the SAME lock. New `weatherShift` detector (fires once on a coarse condition/temp bucket change, kill switch `LUNA_PROACTIVE_WEATHER_SHIFT`) + a per-key in-memory debounce. Hooks behind `LUNA_PROACTIVE_EVENT_HOOKS` (default off). Adversarially reviewed (3-lens panel → refute each: 8 findings, 0 confirmed; one parity nit fixed — the legacy LLM-gate path short-circuits on `activeTurn` before the wakeGate call again). +16 tests. 837 green, `tsc` ×3 clean, branch) · v0.22.1 (Initiative 15 2/4 — **proactive: detector registry + scheduled slots**: lifts v0.22.0's inline after-night check into a `detectors.ts` **registry** (`evaluateDetectors`, first-match-wins) + adds a **`scheduledWindow`** detector — a guaranteed daily speaking floor at `LUNA_PROACTIVE_SLOTS` local hours (e.g. `'11,20'`), fired ≤ once per slot per day via a per-day bitmask (migration `0013` + `markSlotConsumed`). `passesAntiSpam` gains a small **idle floor** (don't reach in within ~60s of the user's last message — `mid_conversation`; still no 10m `too_soon` gate). Caught + fixed a real bug: unset `LUNA_PROACTIVE_SLOTS` yielded `[0]` (midnight) not `[]`. +9 tests. 821 green, `tsc` ×3 clean, branch) · v0.22.0 (Initiative 15 begins 1/4 — **proactive: detector-MVP, she actually speaks**: the proactive system has *never once* fired (every `proactive_wake` decision in the live DB is `hold`, **0 `act` ever** — the per-tick LLM wake-gate decides *before* drafting, is stay-quiet-biased, fails-closed on bad JSON). v0.22.0 makes the **deterministic detector path the default**: a cheap anti-spam subset (`passesAntiSpam` = quiet-hours + cooldown + quota — **NOT** the >18h `deep_absence` blanket or the 10m `too_soon` floor, so a long overnight/weekend gap still fires) → the **after-a-night** detector → the existing **silence-capable** proactive turn, whose own `{spoke}` is the only "should I speak?" judgment (drafting-as-decision). A **spoke/silent quota split** (`commitProactiveSilent`) lets a silent draft stamp the cooldown without burning the daily budget. `runProactiveTurn` gains a `seed`; the legacy LLM wake-gate becomes a default-off fallback behind `LUNA_PROACTIVE_LLM_GATE` (deleted in v0.22.3). +11 tests. 812 green, `tsc` ×3 clean, branch) · v0.21.10 (frontend — **message de-dup + history un-merge**: two chat-render bugs. (1) the model occasionally **stutters** — calls the `message` tool twice with identical text (confirmed in L2: a turn's reply held the same sentence twice) — so a bubble showed twice; a verbatim-consecutive duplicate is now dropped server-side (`runTurn` skips the duplicate `messageTexts` push, keeping `assistant_text`/recall clean) **and** discarded live in the controller. (2) a multi-message turn was newline-**joined** into `assistant_text`, so on reload `renderHistory` painted it as **one merged block**; a new pure `messageSegments` splits it back into one bubble per message (+ dedups, so old rows' baked-in stutters also un-double) — matching the live multi-bubble look, no schema/wire change. +7 tests. 801 green, `tsc` ×3 clean, branch) · v0.21.9 (frontend — **persistent typing indicator**: the bouncing "thinking" dots showed on `turn.started` but `open()`/`chip()` called `hideThinking()`, so the first tool/message killed them for the rest of a multi-step turn — she read as "done" and the user cut her off mid-turn. The controller now OWNS the indicator (`setThinking` added to `BubbleView`; the dots re-anchor to the end without restarting the CSS bounce) and keeps it up for the whole turn — through tool runs and between messages — hidden only while a bubble actively streams, cleared on `turn.result`/`proactive.finished`. Also fixes a latent stuck-dots bug: a proactive turn emits no `turn.result`, so the old open-only show would spin forever. Review-hardened: turn-local state (`messageBubbles`/`textStreaming`) resets at every turn boundary + on reconnect so a dropped `tool.finished` can't wedge the dots off, and `showThinking` no longer hijacks scroll. +5 controller tests. 794 green, `tsc` ×3 clean, branch) · v0.21.8 (core-memory remediation — **field boundaries + anti-churn**: the dream's `persona_update` had let `self_state` fill with behavior rules and `relationship_status` with discrete facts (down to a literal "56 green" test count) and rewrote both fields ~every dream even at 97% identity — yet core memory is injected into the cached system block every turn as "who she is". A judge-panel-designed `personaUpdatePrompt` now fences each field (felt sense ONLY; facts→L3, rules→L1), demands prose not keyword-soup, and makes **null the default**; `updateCore` short-circuits a no-op write (identical patch → no audit row, no cache-epoch bump, any caller); `cycle.ts` drops a per-field near-identical rewrite (`similarityRatio` ≥0.95 ⇒ unchanged, `LUNA_PERSONA_REWRITE_SIMILARITY`). Existing degraded content self-heals on the next dream (owner's call). +7 tests. 794 green, `tsc` ×3 clean, branch) · v0.21.7 (dream diary completeness — **yesterday-rewrite + shutdown dream**: from the 6/22 "half diary" diagnosis (not a truncation/append-续写 bug — the diary already rewrites from the whole day; it was thin because **no in-day dream ran on 6/22**, downstream of the v0.21.6 proactive death). (A) every dream now rewrites **today AND yesterday**'s day-diary (was today-only), so the next day's first dream gives yesterday one final complete pass — catching anything said after the last in-day dream, before midnight — before it freezes write-once; days older than yesterday stay immutable. (B) a **shutdown dream**: on a graceful exit (Ctrl-C / SIGTERM / SIGINT) `main.ts` runs one last `runDreamCycle` so the day's diary + memory consolidate before the process dies — best-effort, deadline-bounded (`LUNA_SHUTDOWN_DREAM_TIMEOUT_MS`, 120s), a second signal force-exits, `LUNA_SHUTDOWN_DREAM=0` disables it for fast dev restarts. 782 green, `tsc` ×3 clean, branch) · v0.21.6 (fix — **proactive survives a restart**: the heartbeat only iterates `activeSessionIds()` = the in-memory session map, empty after a restart until the next user message — so proactive went dead between a restart and the next chat (silent since 2026-06-16, confirmed in traces). Boot now `preloadSessions()` warms persisted sessions into the map + restores `lastUserMs` from the last real user turn. 782 green, `tsc` ×3 clean, branch) · v0.21.5 (Initiative 14 follow-on — **pluggable weather provider + QWeather**: a `weatherProvider` dispatcher (`LUNA_WEATHER_PROVIDER`; auto-selects QWeather when a key is set, else Open-Meteo) + a **QWeather (和风)** adapter — China-accurate CMA data, fixing Open-Meteo's bad China forecasts (live: a test city **70% vs Open-Meteo's 20%** rain); needs a free key + the account's custom API Host (`LUNA_WEATHER_API_KEY`/`_HOST`). Live-verified end-to-end. 779 green, `tsc` ×3 clean, branch) · v0.21.4 (fix — **GPS-after-boot weather refresher**: when a location arrives via `client.geo` *after* boot (the GPS grant), the `ws` handler now (re)starts the background snapshot refresher — boot-time `startWeatherRefresh` had no-op'd for lack of a location, so the ambient snapshot stayed cold forever and Luna never knew the weather. 776 green, `tsc` ×3 clean, branch) · v0.21.3 (Initiative 14 follow-on — **GPS auto-location**: the browser's `navigator.geolocation` sends a `client.geo` event (new `ClientEvent` variant, both packages) on connect/reconnect; the server uses the real GPS location for weather ahead of the `LUNA_LAT_LON` env fallback — sidestepping the fake-IP proxy that makes server-side IP geolocation report the exit node. Weather "just works" after one browser permission grant, no config. 775 green, `tsc` ×3 clean, branch) · v0.21.2 (Initiative 14 ✅ 3/3 — **proactive weather + close**: an `afterANightOpening` signal (composed from the existing daypart + new-day + gap helpers, 6h min-gap) gates a bounded, ignorable `weatherNoteFor` woven into the proactive opening `framing()` after the felt-absence clause (morning / after-overnight only) — care, not forecast; reads the cached snapshot, never fetches, never touches the wake decision. **Default-flip**: `LUNA_WEATHER` / `LUNA_WEATHER_AMBIENT` / `LUNA_WEATHER_PROACTIVE` now default-ON but **location-gated** (dormant until `LUNA_LAT_LON` is set). **Initiative 14 complete (3/3).** 771 green, `tsc` ×3 clean, branch) · v0.21.1 (Initiative 14 2/3 — **passive ambient weather**: a TTL-cached, background-refreshed weather snapshot (`snapshot.ts` — `.unref()`'d timer, read SYNCHRONOUSLY, cold/stale→omitted, never throws) injected into the per-turn **uncached** tail via a pure `buildWeatherBlock` + a stable data-free `WEATHER_CLAUSE` in the cached L1 contract — she *knows* the weather without a tool call, with **zero** prompt-cache-prefix change and **zero** network call on the reactive path; opt-in `LUNA_WEATHER_AMBIENT`. 758 green, `tsc` ×3 clean, branch) · v0.21.0 (Initiative 14 begins 1/3 — **weather tool + location config**: a no-key Open-Meteo `weather` pull-tool for the configured location (`LUNA_LAT_LON`, validated, degrade-not-throw — IP-geo is out behind the fake-IP proxy); a standalone `web/weather/openMeteo.ts` client (WMO-code map, `assertPublicUrl` SSRF-validate + a plain JSON GET since `safeFetch`'s text-only gate rejects JSON, a `setWeatherFetcher` seam) + `resolveLocation` co-located with `resolveTz`; `proactiveRisk:'safe'`, soft-fail; registered in the 3 places; opt-in behind `LUNA_WEATHER`. 746 green, `tsc` ×3 clean, branch) · v0.20.9 (deep-audit remediation 10/10 — **contract, config & test-debt; Initiative 13 complete**: dead `L2Turn`/`SessionRow` wire schemas removed; `Citation.url` tightened to an http(s) scheme `.refine()` (NOT `z.string().url()`, which would throw in `outbound`); the internal `ToolEvent.tool_name` tightened from `z.string()` to the `ToolName` enum (the wire `ServerEvent` already used it); `.env.example` gains the 37 missing code-read flags; `.prettierignore` excludes `packages/web/public/` (vendored Live2D); `toolLabels` exact-matches (was a substring `includes()` that mislabeled `recall_skill`→recall and rewrote finish summaries); the faceVm emotion-gaze now yields to the focusController when gaze-follow is on; `makePinnedLookup` extracted + unit-tested (the SSRF rebinding-defense shape) + the overstated "real-HTTPS smoke" claim reworded; new `readTracking`/`defineTool` sibling tests. Deferred to the owner: deleting the unreachable `restore(n)` + the inert `physicsPassthrough` (the plan's flagged owner-decisions), and the provider SSE-mapping test (brittle SDK-stream mock). **Initiative 13 ✅ complete (10/10).** 735 green, branch) · v0.20.8 (deep-audit remediation 9/10 — **resilience & lifecycle**: the trace-flush guard moves INTO `flushTrace` so a transient SQLite write can't abort a dream/proactive pass (all callers inherit never-throw); a reactive turn now carries an `AbortSignal` (per-turn `AbortController`, `ProviderRequest.signal`→`messages.stream({signal})`) that `ws.handleClose` aborts when the LAST socket closes — proactive/continuation turns stay socket-less by design (LD #15); the continuation timer is `.unref()`'d and skips firing when no client is listening; the wake gate's anti-repeat list is populated from recent spoken proactive openers (was dead `[]`). Client: a 30s keepalive ping (the server already pongs), a reconnect stability-window before resetting backoff, a `warmUpTts` overall deadline + per-fetch AbortController, and a self-healing TTS latch (`mutedUntil` + 502/504 treated retryable). 722 green, branch) · v0.20.7 (deep-audit remediation 8/10 — **edit & code-map correctness**: file writes are now crash-atomic (shared `atomicWrite` = temp-in-same-dir + rename, so a kill/ENOSPC mid-write leaves the original intact — `edit`/`multi_edit`/`write_file`); the fuzzy matcher gains a separate `occurrences` (ambiguity) field distinct from `count` (verbatim replacements) so two different-indent fuzzy regions correctly trip the uniqueness guard instead of silently editing the first (fixes selfEdit/edit/multi_edit; preserves replace_all count accuracy); `isExported` stops at `class_body`/`class_declaration`/`object` so a method of an exported class is no longer mislabeled exported; 718 green, branch) · v0.20.6 (deep-audit remediation 7/10 — **memory fold & summarization integrity**: `listL2` loads the whole timeline uncapped (the old `LIMIT 10000` with ASC order dropped the NEWEST turns on reload past it; the cap is removed rather than DESC+reversed, preserving the absolute `window_low_water` offset `planFold`/`buildActiveContext` index against); `maybeFold` rejects an empty digest before `commitFold` so a truncated/all-thinking `complete()` never overwrites `rolling_summary` with `''`; `complete()` drops adaptive thinking (overhead that competed with the output budget — the empty-text source); the dream salience step rejects a `scores.length !== unrated.length` patch so a shifted score list can't permanently mis-rate turns; 711 green, branch) · v0.20.5 (deep-audit remediation 6/10 — **recall correctness**: the agentic `recall` tool's `scope='timeline'` now includes diaries (was hard-coded `=== 'l2'`, silently dropping every diary hit), and scope is pushed into `retrieve()` (a `sources` pre-rank filter) so the `k` limit applies per-scope — a burst of recent off-scope rows can no longer starve facts/timeline out of the top-k; `cosine` length-guards a dim mismatch to 0 instead of NaN, and the embedding cache key is model-namespaced so a `LUNA_EMBEDDING_MODEL` swap re-embeds rather than reusing stale-dim vectors; hot-path auto-injection byte-identical (no `sources`); 708 green, branch) · v0.20.4 (deep-audit remediation 5/10 — **temporal correctness**: `formatGap`'s within-hour minute round-up now carries (`m===60 → h+1`, carrying past 24h into the days branch) so it never renders "1h 60m" / "23h 60m" — verified by enumerating all of `[0,86400)`; `resolveTz` validates `LUNA_TZ` (an invalid zone like `Invalid/Zone` used to throw RangeError and brick every turn before the LLM) and degrades to the host zone, plus a `buildTimeBlock` try/catch in runTurn so a temporal failure omits the block rather than failing the turn. Note: the sub-hour branch already used `Math.floor` so it was never affected. 704 green, branch) · v0.20.3 (deep-audit remediation 4/10 — **frontend input & interrupt**: an IME-composition Enter guard (`!isComposing && keyCode!==229`) stops a pinyin-candidate commit from dispatching a half-composed message — the **中文-input** fix; barge-in finally wired (controller calls `audio.stop()` on `turn.started`) + a per-utterance `AbortController` threaded through `fetchSpeech`/`player.play` so a `stop()` during synthesis/decode cancels cleanly, and an `AbortError` is **not** counted toward the TTS disable-latch; the text-mode reply bubble is finalized on `turn.result` so consecutive replies no longer merge into one growing bubble; 696 green, branch) · v0.20.2 (deep-audit remediation 3/10 — **subprocess & resource cleanup**: the spawner's "kill the process TREE" is now real — `collectProcessTree` enumerates descendants from a `ps` snapshot and signals each (Bun.spawn starts no new process group, so `kill(-pid)` was a no-op leaking grandchildren), + the SIGKILL-escalation timer is cleared on clean exit; `ctx.abortSignal` threaded into `grep`/`find_symbol`/`repo_map` (rg `Bun.spawn({signal})` + JS-walk/parse-loop abort checks); tree-sitter `Parser` pooled per-grammar (was `new` per file → WASM-heap leak), freed on reset; 694 green, branch) · v0.20.1 (deep-audit remediation 2/10 — **secret-blocklist hardening**: a shared secret-segment source + `isSecretTailPath` closes `$HOME/.aws/…` / `${HOME}/.ssh/…` env-indirection in `shell`'s path scan (the captured token resolves outside real $HOME, so only a tail-segment match catches it); `fsScan.walk` gains `excludeSymlinks` and grep's JS fallback both excludes symlinks AND gates every file through `resolveInWorkspace('read')` — closing the symlink-to-secret read; 692 green, branch) · v0.20.0 (deep-audit remediation 1/10 — **shell deny-gate integrity**: the verify tools `typecheck`/`run_tests`/`lint` now **argv-spawn** (no `/bin/zsh -lc`), closing the `$()`/backtick command-injection via `input.path` **and** the deny-regex bypass (they never called `classifyShellCommand`); `input.path` gated; deny-regex broadened (`find -delete`, `curl|python/perl/node/ruby/php`, intermediate-pipe, empty-quote splice) + comment corrected; evaluator firewall extended to `shell.ts`/`shellCore.ts`/`run_tests.ts`; 681 green, branch) · v0.19.2 (time perception C — bounded felt time: daypart-mood + felt-absence suggestion line (`subjectiveTime`), an L1 **warmth-not-guilt** guardrail, light proactive framing on a long-away wake; **A+B+C default-flipped ON**; cache invariant preserved (per-turn time stays in the uncached tail); **Initiative 12 complete 3/3**, branch) · v0.19.1 (time perception B — relative-time labels on recalled memories + chronological oldest→newest display, reusing v0.19.0's `relativeLabel`; the cached diary digest keeps stable absolute period labels to preserve the cache invariant; Initiative 12 2/3, branch) · v0.19.0 (time perception A — passive TS-computed time in the uncached user tail: now + daypart + elapsed + session, timezone-explicit; L1 "don't compute durations" clause; Initiative 12 1/3) · v0.18.4 (fix: a stray **top-level text leak** — the model narrating outside the message tool — got stored as the visible reply ("answer for user question") on a turn that errored before `finalize`; now the message-tool reply is always persisted as `assistant_text`. 1 historic L2 row repaired, 20 humanity-transform rows correctly left alone) · v0.18.3 (web tools — **web_fetch DNS pin**: `safeFetch` connects through a `node:http(s)` custom lookup **pinned to a deny-list-validated IP** — the rebinding TOCTOU is *closed*, not narrowed (verified by a real-HTTPS smoke); the `198.18.0.0/15` benchmarking range is unblocked so it works behind Clash/Surge fake-IP proxies; **`web_fetch` flipped default ON**; citation chips now clickable + scheme-validated (XSS-safe); reload-persistence deferred. 634 tests green) · v0.18.2 (web tools — **complete networking**: the search→fetch→reason loop validated end-to-end; the standing `<untrusted_content>` **prompt-injection rule** + the read/write boundary (`web_to_action` decision trace) extending LD #14; **citations** `{url,title}` on `turn.result` (wire-contract change, both packages) → source cards in the web UI + L2 persistence; an optional SSRF-safe fetch **cache** (migration `0012`, `LUNA_WEB_CACHE`); **default-flip** `web_search` **ON** (graceful no-key degrade), `web_fetch` reverted to **opt-in** in review (DNS-rebinding TOCTOU not fully closed → v0.18.3 pin); **Initiative 11 complete 3/3, review-remediated**, branch) · v0.18.1 (web tools — **web_fetch + SSRF/extraction safety core**: read one URL safely — `assertPublicUrl` deny-lists private/loopback/link-local/metadata/ULA/IPv4-mapped/encoded IPs + non-http(s) + credentials + over-long, `safeFetch` does manual redirect re-validation + DNS-rebinding re-check + byte/time caps + content-type gate, Readability→Turndown extraction wrapped in `<untrusted_content>`; the guard joins the evaluator-firewall set; default **OFF** behind `LUNA_WEB_FETCH`; **Initiative 11 2/3**, branch) · v0.18.0 (web tools — **web_search**: Luna's "look it up" capability, a client-side live-web search on the existing dispatcher behind a `WebSearchProvider` abstraction (Tavily default, gateway-safe since the gateway strips Anthropic's native web_search), soft-fail + `[N]` citation summary, `proactiveRisk:'safe'`; ships with the **defection guard** — an L1 commitment/when-to-reach clause + an off-hot-path `web_search_intent_no_call` audit extending LD #14; default **OFF** behind `LUNA_WEB_SEARCH`; **Initiative 11 begins 1/3**, branch) · v0.17.3 (dream: today's day-diary is **rewritten on every dream** so a daytime dream captures the whole day instead of freezing it at the first dream — owner's "option 2"; past days stay write-once) · v0.17.2 (fix: a failed/empty turn — e.g. a 401 gateway outage — no longer persists an empty-assistant L2 row and rolls its dangling user message out of history, killing the "brief memory loss" pollution that survived restarts post-A3) · v0.17.1 (memory depth — **diary injection**: a standing day/week/month digest in the cached system block + diaries as recall candidates (the long-range narrative memory finally reaches the model; rag_refresh's diary embeddings now retrievable), Generative-Agents recency×importance×relevance recall ranking, monthly diaries; amends LD #12 diary-part; **Initiative 10 complete 2/2**, branch)

## Scope

Per-version log of what has actually shipped in the TypeScript rewrite. This is the **truth source**
for "what version are we on" — not the roadmap, not in-flight conversation.

Conventions match Python Luna:
- `Fact` = grounded in commit history, repository docs, or checked-in code in this TS repo.
- `Inference` = phase summary derived from those materials.
- `-dev` = current working-tree iteration not yet committed.

The Python original stays the running production system
during the rewrite. Its version log is unrelated to this one — `v0.1` here is not `v0.1` there.

## Source material

- 2026-06-11 15-dimension ground-truth audit of Python Luna v0.47.9
- Design conversation 2026-06-11 (Bun / WS / SQLite / Zod / single-user / interleaved tool streaming)
- 减负 list (see [`../REWRITE_CONTEXT.md`](../REWRITE_CONTEXT.md))

## High-level stages (planned, subject to roadmap)

- `v0.1` — project skeleton: Bun + TS + Zod + bun:sqlite + WS server bootstrap. No agent logic yet.
- `v0.2` — tool spec: typed registry, `Result<T>`, streaming tool execution, 3 representative tools end-to-end (`time_now`, `read_file`, `remember`).
- `v0.3` — single-turn LLM round trip with Anthropic interleaved tool-use SSE wired through WS to a minimal client.
- `v0.4` — memory substrate on SQLite (L1 session state first).
- `v0.5+` — TBD; see roadmap.

## Version index

| Version | Date | Theme | Evidence |
|---|---|---|---|
| `v0.1.0` | 2026-06-11 | Bun skeleton + WS server | `7ebd73a` |
| `v0.2.0` | 2026-06-11 | Typed tool registry + `Result<T>` + 3 representative tools | `14753c4` |
| `v0.3.0` | 2026-06-11 | Anthropic interleaved tool-use end-to-end (StateGraph turn loop) | `8fbdce4` |
| `v0.3.5` | 2026-06-11 | Trace plumbing — first `bun:sqlite`, trace_id through the graph | `cbb468a` |
| `v0.3.6` | 2026-06-11 | Local `/_trace` viewer; `LUNA_TRACE` default on | `58a970a` |
| `v0.4.0` | 2026-06-12 | Memory substrate foundation — SQLite-backed sessions (L1) + L2 full-text timeline | `c2b322b` |
| `v0.4.1` | 2026-06-12 | L1 rolling window — recent-N verbatim + compress-once async fold | `e406b60` |
| `v0.4.2` | 2026-06-12 | L3 semantic store + prose core memory + remember/forget/update_self | `07cc0c1` |
| `v0.4.3` | 2026-06-12 | Hybrid recall — sqlite-vec embedding-first + CJK-bigram lexical | `25d2b08` |
| `v0.5.0` | 2026-06-12 | Dream engine — isolated 6-step consolidation; Initiative 2 complete | `a0df0b5` |
| `v0.5.1` | 2026-06-12 | Dev chat page `/_chat` — first usable conversation surface | `c4a9d84` |
| `v0.5.2` | 2026-06-12 | Gateway-safe tool schemas — `remember` flat input + `_noargs` unwrap | `a341162` |
| `v0.6.0` | 2026-06-13 | Persona foundation — mtime-cached loader, humanity splitters, wake scene | `25ed7cd` |
| `v0.6.1` | 2026-06-13 | `message` tool + humanity caps as Zod schema (LD #9, flag off) | `266ee1b` |
| `v0.6.2` | 2026-06-13 | Streaming message text (`input_json_delta` → `tool.progress`) + empty-reply guard | `dad7636` |
| `v0.7.0` | 2026-06-13 | Message-tool default flip after recorded A/B; Initiative 3 complete | `de41694` |
| `v0.8.0` | 2026-06-13 | Decision trace events + zero-LLM defection audit + replay tree | `76c8dfe` |
| `v0.8.1` | 2026-06-13 | L1 thinking contract — commitment-to-act + proportionality + no-leak | `1d0da3d` |
| `v0.8.2` | 2026-06-13 | Action-integrity guards — `is_final` promise + intent-without-act corrective retries | `ea246a4` |
| `v0.8.3` | 2026-06-13 | `recall` tool — agentic memory search (Open Q #9) + L1 trigger clause | `8376820` |
| `v0.9.0` | 2026-06-13 | Dictionary tuning + integrity defaults flipped on; Initiative 4 complete | `a50b6fc` |
| `v0.10.0` | 2026-06-13 | Proactive turn primitive — `runTurn` + proactive framing + silent allowed (manual) | `514d309` |
| `v0.10.1` | 2026-06-13 | Proactive safety gate — hard block→surface→execute + fail-closed + action budget | `ed51152` |
| `v0.10.2` | 2026-06-13 | Cadence governor + wake gate — prefilter + bounded "act now?" L2 judgment | `636caf3` |
| `v0.10.3` | 2026-06-13 | Proactive scheduler/heartbeat — idle loop goes autonomous (behind the kill switch) | `ed51967` |
| `v0.11.0` | 2026-06-13 | Self-continuation + dream auto-trigger + autonomy default-on; Initiative 5 complete | `45bb3cb` |
| `v0.12.0` | 2026-06-13 | Frontend consumption controller (`packages/web`); Initiative 6 begins | `680e58d` |
| `v0.12.1` | 2026-06-13 | Repo-wide audit (9 reviewers) + fixes — turn persistence resilience, dev tool_name | `7cbfdc1` |
| `v0.13.0` | 2026-06-14 | Cute UI shell — redesigned vtuber-overlay frontend (chat left / model right) | `f82f5ae` |
| `v0.13.1` | 2026-06-14 | Live2D foundation — the reference model avatar (pixi-live2d + Cubism), first-cut FaceVM, draggable | `94ff57a` |
| `v0.13.2` | 2026-06-14 | High-fidelity FaceVM — 14 layered emotions + timelines + overlays + actions | `e367b50` |
| `v0.13.3` | 2026-06-14 | Voice + lip-sync — Web Audio AudioSink + RMS lip-sync + GPT-SoVITS proxy client | `78a3350` |
| `v0.13.4` | 2026-06-14 | Dream overlay + UX polish (thinking/mood/scroll/settings/a11y); **Initiative 6 complete** | `7465f5d` |
| `v0.13.5` | 2026-06-15 | One-command local launcher (`bun run dev`) + TTS proxy; Initiative 7 cancelled | `6e18d9a` |
| `v0.13.6` | 2026-06-15 | C-side fix pass (real-usage bugs) — Live2D override/gaze/zoom, L1 history, thinking-leak, TTS, dev IDE | `17ff3ff` `25e4e2b` |
| `v0.13.7` | 2026-06-15 | C-side fix pass 2 — gaze head+body via focusController + off-switch, workspace cell-collapse, dev-server idleTimeout, voice boot gate | `06fb132` `bedd1f5` `292ff5a` `c531ab4` `31a123a` `3fb1b4a` `610995e` |
| `v0.13.8` | 2026-06-15 | TTS lip-sync rebuilt from the Python `lip-sync.js` engine (4 mouth params + stochastic stepping) + serial speech queue (no overlap) | `5ae9d4b` |
| `v0.13.9` | 2026-06-15 | Lip-sync calmer defaults — slower target stepping (70→100ms) + gentler attack/release/shape smoothing; lowers the mouth change rate per feedback | `ae1dd03` |
| `v0.13.10` | 2026-06-15 | Two real bugs — persona embodiment now reflects the live Live2D + voice (was "no body/voice yet"); emotion head/body pose deforms via a pre-physics `flushPose` (was dead — those params are physics-input) | `9070861` `b61e42d` |
| `v0.13.11` | 2026-06-15 | Message clause cap 55→90 (the CJK-tuned 55 retry-stormed English replies) + validation retries kept backstage (no leaked raw-ZodError chips) | `60319f7` `2010e82` |
| `v0.13.12` | 2026-06-15 | English tuning — all three humanity caps relaxed (140/4/90 → 280/5/150) to cut the validation over-limit rate; web + dev-chat frontend fully translated to English | `working tree` |
| `v0.13.13` | 2026-06-15 | Switchable idle animations — the 5 awake idle profiles (default/cute-sway/peek/shy-drift/sweet-bounce) ported from Python `applyIdle` into FaceVm + a settings dropdown; idle yields the eyes to blink + the gaze to mouse-follow | `working tree` |
| `v0.15.0` | 2026-06-15 | Code-agent read/nav foundation (Initiative 8, 1/5) — workspace sandbox (blocklist-only, no root jail) + windowed `read_file` + `list_files` + `grep` (rg w/ JS fallback) | _dev branch_ |
| `v0.15.1` | 2026-06-15 | Code-agent edit tools (Initiative 8, 2/5) — `edit` / `multi_edit` / `write_file` (read-before-edit + uniqueness + fuzzy-report + CRLF + optimistic `expected_hash` + atomic multi) behind `LUNA_CODE_WRITE` (default on) + lint-on-write (`Bun.Transpiler`, `LUNA_LINT_ON_WRITE`) + firewall-refusal routed through the edit tool | _dev branch_ |
| `v0.15.2` | 2026-06-15 | Code-agent shell + verify loop (Initiative 8, 3/5) — sandboxed `shell` (deny-regex + interactive-block + process-tree kill + output cap, subsumes fs-mutation) plus `typecheck` / `run_tests` / `lint` verifiers, all behind `LUNA_SHELL` (default on) via a shared injectable spawner | _dev branch_ |
| `v0.15.3` | 2026-06-15 | Code-agent repo map + hybrid locator + plan (Initiative 8, 4/5) — Aider-style ranked, token-bounded, mtime-cached `repo_map` + hybrid `find_symbol` (ripgrep candidates → tree-sitter verify, comment/string false positives excluded, ripgrep-only fallback marked `verified:false`) behind `LUNA_REPO_MAP` (default on) + session-scoped `plan` todo spine (ships on always); `web-tree-sitter` + vendored TS/TSX/JS grammars; SQLite cache migration `0008` | _dev branch_ |
| `v0.15.4` | 2026-06-15 | Code-agent skill library + propose-only self-edit (Initiative 8, 5/5) — `save_skill` (verify-before-persist: refuses unless the suite is green — Voyager invariant) + `recall_skill` (lexical search) behind `LUNA_SKILLS`; `propose_self_edit` produces a unified diff for human review and **never writes**, with the evaluator firewall (`resolveInWorkspace` `'write'`, built in v0.15.0) hard-rejecting any edit to her own tests/sandbox/safetyGate/humanity/deny-regex/l1Contract **across all write tools** (the keystone test), behind `LUNA_SELF_EDIT`; skills table migration `0009`. Deviation: the `self_edit.proposed` wire event is deferred — the proposal is delivered via `tool.finished` (the diff) for the human to apply. **Initiative 8 complete (5/5).** | _dev branch_ |
| `v0.16.0` | 2026-06-15 | Security hardening + hygiene (Initiative 9, 1/4) — loopback bind `127.0.0.1` default (S1; closes S2/S3 net exposure) + `LUNA_BIND_HOST` opt-in, `/_workspace` reset/edit gated by `LUNA_DEV_TOOLS` (S2), `chat.send` capped at 8000 chars + WS `maxPayloadLength` (S5), `.github/workflows/ci.yml` (C1), README + orient-skill refresh (Doc1/2), WS reconnect buffer+backoff (C2), local-date quota clock (C3), aligned `fromBlob` (C4) | _branch_ |
| `v0.16.1` | 2026-06-15 | Recompute efficiency (Initiative 9, 2/4) — system block memoized per turn via a `memory/epoch` dirty flag bumped by `remember`/`update_self` (A1) + `renderL1Contract` cached; `traces` retention window (`pruneToRetention`, throttled off flush, A4); recall fetches only the recent 500 L2 rows (`listRecentL2`) + reuses a persisted `content_hash` column (migration `0010`, A2); recall embed budget off the first-token path behind `LUNA_RECALL_ASYNC` (P1) | _branch_ |
| `v0.16.2` | 2026-06-16 | Persistence + dead infra (Initiative 9, 3/4) — incremental `history_json`: `persistSession` writes only bookkeeping (constant `'[]'` blob), `loadSession` rebuilds the full timeline from the append-only L2 `raw_json` — the last O(N²) per-turn write gone (A3/P2); dead `vec0`/`vec_cache` write-path + orphaned virtual table removed, retrieval stays TS cosine (`sqlite-vec` dep kept inert for Initiative 10's potential KNN, D1); text-mode `reply.token` path marked legacy, removal deferred to post-Init-10 (D2) | _branch_ |
| `v0.16.3` | 2026-06-16 | Clean durable history (Initiative 9, 4/4) — `cleanHistory` strips prior-turn `thinking`/`redacted_thinking` from completed turns at persist time (the API drops them across turns anyway) + collapses old `tool_result` payloads to a marker in `buildActiveContext` (keeps recent + the `tool_use` records), behind `LUNA_CLEAN_HISTORY` (default on). A stored turn is clean conversation — the foundation for Initiative 10's ~100-turn window. **Initiative 9 complete (4/4).** | _branch_ |
| `v0.17.0` | 2026-06-16 | Memory depth — L1 window (Initiative 10, 1/2) — verbatim window re-unitized to **turns** (`LUNA_L1_RECENT_TURNS`, default ~100, range 40–150) replacing the 24-message cap; `planFold` counts turn-groups; the unbounded append-only `rolling_summary` replaced by a **structured, size-bounded digest** (4 buckets, hard char cap, bounded oscillating compression); **importance anchors** — a new `rate_salience` dream step rates turns 1–5 (LLM, migration `0011`), salient turns marked `[salient]` resist over-summarization; amends LD #12 window-part + marks v0.4.1 superseded | _branch_ |
| `v0.17.1` | 2026-06-16 | Memory depth — diary injection (Initiative 10, 2/2) — diaries reach the model at last: a bounded standing **day/week/month digest** in the cached system block (`renderDiaryDigest`, behind `LUNA_DIARY_INJECT`) + diaries as a third **recall candidate** source (`collectCandidates` += `'diary'`, so `rag_refresh`'s diary embeddings become retrievable — fixes the dead-work finding); recall ranking upgraded to the **Generative-Agents** `α·recency + β·importance + γ·relevance` (importance from the v0.17.0 salience score); **monthly diaries** generated by the dream cycle (idempotent). Amends LD #12 diary-part. **Initiative 10 complete (2/2).** | _branch_ |
| `v0.17.2` | 2026-06-16 | Fix — failed/empty turns no longer poison memory (C-side) — `runTurn`'s `finally` persists a turn only if it delivered a **real reply** (message-tool text in message mode, streamed text in text mode); a turn that threw before any token (a 401/network outage → `finishReason 'error'`) or ended double-silent leaves **no** empty-assistant L2 row and has its dangling user message rolled back to the pre-turn point (post-A3 those empty rows otherwise survive every reload → the "brief memory loss" symptom). Retargeted the Bug-A resilience test (`DROP TABLE sessions`, not `l2_turns`, so the upstream `retrieve()` still runs and the failure lands in `persistSession`). 560 tests green. | `working tree` |
| `v0.17.3` | 2026-06-16 | Dream — today's day-diary is **updateable** (owner's option 2) — `run_diaries` upserts the current **UTC day** on every cycle (`ON CONFLICT(kind,period_key) DO UPDATE`), regenerated from all of that day's L2; past days keep `INSERT OR IGNORE` (write-once). Fixes the mid-day-freeze: a self-/scheduler-triggered daytime dream no longer locks the day diary at noon and lose the afternoon. Day boundary stays UTC (08:00 local time). 561 tests green. | `working tree` |
| `v0.18.0` | 2026-06-16 | Web tools — **web_search** (Initiative 11, 1/3) — client-side live-web search on the existing dispatcher behind a `WebSearchProvider` abstraction (`tools/web/`: `provider.ts` + `tavily.ts` + `web_search.ts`), Tavily default, gateway-safe (the gateway strips Anthropic's native web_search), soft-fail (every failure a recoverable `err`, nothing throws past the generator) + `[N] url` citation summary + a `正在查一下…` progress line; `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`. Ships with the **defection guard** extending LD #14 — an L1 commitment/when-to-reach clause (gated on the tool being mounted) + an off-hot-path `web_search_intent_no_call` decision-trace audit (thinking shows web-lookup intent but no `web_search` call fired). Default **OFF** behind `LUNA_WEB_SEARCH`; +18 tests, 577 green. | `working tree` |
| `v0.18.1` | 2026-06-16 | Web tools — **web_fetch + SSRF/extraction safety core** (Initiative 11, 2/3) — read one URL safely. New `tools/web/safeFetch.ts` (the keystone): `assertPublicUrl` canonicalizes + DNS-resolves + deny-lists every resolved IP (loopback/RFC1918/CGNAT/link-local incl. `169.254.169.254`/ULA/IPv4-mapped/encoded forms/`0.0.0.0`/broadcast/multicast/reserved) + blocks non-`http(s)`/credentials/`>2048`; `safeFetch` does **manual** redirect re-validation (≤5 hops), a DNS-**rebinding** re-check at connect, byte (`LUNA_WEB_FETCH_MAX_BYTES` 3MB, streamed) + time caps, and a `text/html`/`text/plain` gate. `extract.ts` = linkedom→`@mozilla/readability`→turndown → markdown (char-capped, never-throw fallback) wrapped in `<untrusted_content source=…>`. `web_fetch` tool (`safe-parallel`, `proactiveRisk:'safe'`, soft-fail). `safeFetch.ts` added to the **evaluator firewall**. New deps `@mozilla/readability`+`linkedom`+`turndown`. Default **OFF** behind `LUNA_WEB_FETCH`; +37 tests, 614 green. | `working tree` |
| `v0.18.2` | 2026-06-16 | Web tools — **complete networking** (Initiative 11, 3/3) — the search→fetch→reason loop validated end-to-end; the **standing prompt-injection defense** (a `<untrusted_content>` system rule in the cached core when either web tool is mounted + an L1 search→fetch loop/boundary clause) + the read/write boundary (a `web_to_action` decision trace when a turn that read untrusted web content fires a surface-risk tool — detection only, LD #14 discipline); **citation surfacing** — `turn.result` gains optional `citations: {url,title}[]` (wire-contract change, `protocol`+`server`+`web` in lockstep) gathered from `web_search` urls + `web_fetch` `final_url`, rendered as `source` chips + persisted via L2; an **optional fetch cache** (migration `0012_web_cache`, `LUNA_WEB_CACHE`) wrapped around `safeFetch` (a hit never bypasses the SSRF guard); **default-flip** `LUNA_WEB_SEARCH` **ON** (graceful no-key degrade) — `LUNA_WEB_FETCH` reverted to **opt-in** in review (rebinding TOCTOU not fully closed; awaits the v0.18.3 DNS pin). **Initiative 11 complete (3/3), review-remediated.** Review: +7 regression tests, **632 green**. | `working tree` |
| `v0.18.3` | 2026-06-16 | Web tools — **web_fetch DNS pin** (Init 11 follow-up) — `safeFetch` connects via a `node:http(s)` custom `lookup` **pinned to a deny-list-validated IP** (TLS SNI/cert still key off the hostname), so a DNS rebind cannot swap in a private address between check and connect — the **TOCTOU is closed**, verified by a real-HTTPS smoke + a pin unit test. `198.18.0.0/15` (RFC2544 benchmarking) **unblocked** — it's the Clash/Surge fake-IP pool, so blocking it broke `web_fetch` on every proxied host (every domain resolves into it). **`LUNA_WEB_FETCH` flipped default ON.** Citation chips now **clickable** (`<a>`, scheme-validated `safeHttpHref`, XSS-safe). **634 tests green** ×3 tsc; chip reload-persistence deferred. | `working tree` |
| `v0.18.4` | 2026-06-17 | Fix — **top-level text leak stored as the reply** — `runTurn`'s persistence stored `state.text`, which in message mode holds a stray top-level text block (the model narrating outside the message tool) until `finalize` overwrites it; on a turn that errored before `finalize` the leak ("answer for user question") was persisted + replayed as the visible reply. Now persists the already-computed `realReply` (message-tool text / streamed text). +1 regression test; 1 historic L2 row repaired from `raw_json` (a precise detector left the 20 humanity-transform rows untouched). 635 green. | `working tree` |
| `v0.19.0` | 2026-06-17 | Time perception — A: passive injection (Initiative 12, 1/3) — new `turn/temporalContext.ts` (pure, TS-computed): `classifyDaypart` / `formatGap` / `classifyGap` (gap + calendar-day flag) / `relativeLabel` / `buildTimeBlock`, timezone-explicit (`LUNA_TZ` → host zone). `runTurn parse_input` injects a labeled time block (now + daypart + elapsed-since-last + session) into the **uncached user message**, gap sourced from the last L2 `t_ms` (restart-safe); `Session.sessionStartMs`; an L1 "don't compute durations yourself" clause. Behind `LUNA_TIME_AWARE` (ships off) | _branch_ |
| `v0.19.1` | 2026-06-17 | Time perception — B: memory temporal grounding (Initiative 12, 2/3) — `renderRecallBlock` tags each recalled candidate (l2/l3/diary) with a TS-computed relative-time label (`relativeLabel`, reused from A) and presents the selected set **chronologically (oldest→newest)** — the true fix for the *dating-a-past-event* "yesterday" drift; selection/GA-scoring untouched (presentation only). The cached diary digest keeps stable absolute `period_key` labels (a `now`-dependent label there would churn the prefix cache). Behind `LUNA_RECALL_TIME_LABELS` (ships off) | _branch_ |
| `v0.19.2` | 2026-06-17 | Time perception — C: subjective time + close (Initiative 12, 3/3) — `subjectiveTime(daypart, bucket)` → a bounded daypart-mood + felt-absence; `buildTimeBlock` appends one suggestion "Mood of the hour" line under `LUNA_TIME_SUBJECTIVE`; an L1 **warmth-not-guilt** guardrail (absence as warmth, never guilt); light proactive framing — a `notable`/`long` wake's directive gains a quiet-warmth note (`feltAbsenceFor`), wake *decision* unchanged. **Default-flipped A+B+C ON** (`LUNA_TIME_AWARE` / `LUNA_RECALL_TIME_LABELS` / `LUNA_TIME_SUBJECTIVE` all `!= '0'`). Cache invariant held (per-turn facts in the uncached tail; system block byte-stable across turns). **Initiative 12 complete (3/3).** | _branch_ |
| `v0.20.0` | 2026-06-20 | Deep-audit remediation 1/10 — **shell deny-gate integrity** (Initiative 13): verify tools (`typecheck`/`run_tests`/`lint`) **argv-spawn** (`Bun.spawn([...])`, no shell string), closing `$()`/backtick command-injection through `input.path` **and** the clean deny-regex bypass (they never called `classifyShellCommand`); `input.path` gated via `resolveInWorkspace(...,'execute')`. Deny-regex broadened (`find -delete`/`-exec rm`, `python\|perl\|node\|ruby\|php`, intermediate-pipe, empty-quote splice `r""m`→`rm`) + "ALWAYS hard-blocks" comment corrected. Evaluator firewall (LD #14) extended to enforcer files `shell.ts`/`shellCore.ts`/`run_tests.ts`. 681 tests green, `tsc` ×3 clean. | _branch_ |
| `v0.20.1` | 2026-06-20 | Deep-audit remediation 2/10 — **secret-blocklist hardening** (Initiative 13): `workspace.ts` exports `isSecretTailPath` (a shared `SECRET_DIR_SEGMENTS`/`SECRET_FILE_SEGMENTS` source now feeds both the absolute blocklist and a tail-segment match), wired into `shell`'s `blockedPathInCommand` — closing `$HOME/.aws/credentials` / `${HOME}/.ssh/id_ed25519` env-var indirection that resolved outside the real `$HOME`. `fsScan.walk` gains `excludeSymlinks`; grep's JS fallback both sets it AND gates every walked file through `resolveInWorkspace('read')`, closing the symlink-to-secret content read (ripgrep was already safe — no `--follow`). +11 tests incl. new `fsScan.test.ts`. 692 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.2` | 2026-06-20 | Deep-audit remediation 3/10 — **subprocess & resource cleanup** (Initiative 13): `shellCore.ts` `realSpawner` now reaps the real process tree (`collectProcessTree` walks a `ps -A -o pid=,ppid=` snapshot post-order and signals each descendant — Bun.spawn opens no process group, so the old `process.kill(-pid)` leaked backgrounded grandchildren on every timeout/abort) and clears the SIGKILL-escalation timer in `finally`. `ctx.abortSignal` threaded through `grep`→`ripgrepRunner` (`Bun.spawn({signal})`) + `jsRunner` loop break, and into `find_symbol`/`locateSymbol` + `repo_map`/`buildRepoMap` (parse-loop abort check). Tree-sitter `Parser` pooled per grammar in `treeSitter.ts` (was `new ParserCtor()` per parsed file with no `delete()` → unbounded WASM-heap growth), freed in `resetTreeSitterForTests`. +2 tests (real-process killtree regression, jsRunner abort). 694 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.3` | 2026-06-20 | Deep-audit remediation 4/10 — **frontend input & interrupt** (Initiative 13): IME-composition Enter guard in `app.ts` (`!e.isComposing && e.keyCode !== 229`) so committing a Chinese pinyin candidate doesn't dispatch a half-composed message; barge-in wired — `controller` calls `deps.audio.stop()` on `turn.started` (reactive only — proactive emits `proactive.started`); a per-utterance `AbortController` in `WebAudioSink` threads a `signal` through `fetchSpeech` (`fetch({signal})`) and `WebAudioPlayer.play` (re-check after `decodeAudioData`), and an `AbortError`/aborted-signal is excluded from the `fails++` disable latch; the text-mode `reply` bubble is `finalize`d on `turn.result` so consecutive replies don't merge. +2 controller tests (barge-in, fresh-bubble-per-turn). 696 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.4` | 2026-06-20 | Deep-audit remediation 5/10 — **temporal correctness** (Initiative 13): `formatGap` carries the within-hour minute overflow (`m===60 → h+=1, m=0`; a value carrying past 24h falls through to the days branch) so no input renders "1h 60m" / "23h 60m" (`86399 → "1 day"`, `7170 → "2h"`); `resolveTz` probes `LUNA_TZ` with `new Intl.DateTimeFormat` and falls back to the host zone on a bad value (a typo previously threw `RangeError` in `parse_input`, failing **every** reactive turn — and proactive/recall — before the LLM); a `try/catch` around `buildTimeBlock` in `runTurn` degrades (omits the block) rather than failing the turn. The sub-hour branch already used `Math.floor` (never 60m) — left unchanged. +8 tests incl. full `[0,86400)` no-60m enumeration + a bad-`LUNA_TZ`-reaches-LLM runTurn regression. 704 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.5` | 2026-06-20 | Deep-audit remediation 6/10 — **recall correctness** (Initiative 13): `tools/builtin/recall.ts` scope filter fixed — `timeline` = `l2` + `diary` (was `=== 'l2'`, dropping every diary hit) — and scope is now pushed into `retrieve()` via a new `sources` pre-rank filter so the `k` limit applies per-scope (the old over-fetch×2-then-filter could starve the wanted source); `memory/recall/embed.ts` `cosine` length-guards (returns 0, not NaN, on a dim mismatch) and adds `embedCacheKey` (content hash namespaced by `LUNA_EMBEDDING_MODEL`) so a model swap re-embeds rather than reusing stale-dim vectors; the orphaned `Candidate.hash` field removed. Hot-path auto-injection unchanged (no `sources`); prompt-cache invariant test green. +4 tests (diary-in-timeline, no-starvation, cosine-dim-guard, model-swap-re-embed). 708 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.6` | 2026-06-20 | Deep-audit remediation 7/10 — **memory fold & summarization integrity** (Initiative 13): `sessionStore.listL2` drops the `LIMIT 10000` magic cap when no limit is passed (it was returning the OLDEST 10k ASC and discarding the newest on reload / fold past 10k turns); the cap is *removed*, not DESC-reversed, to keep the absolute `window_low_water` front-offset intact. `l1Window.maybeFold` guards `if (!digest) return false` before `commitFold` so an empty/truncated `complete()` never overwrites `rolling_summary` with `''` or advances the low-water mark. `anthropic.complete()` no longer sets `thinking:{type:'adaptive'}` (it backs summarization/dream-patch calls, where thinking counted toward `max_tokens` and could starve the text). `dream/cycle.rate_salience` rejects a `scores.length !== unrated.length` patch (positional map mis-rates on a shift). +3 tests (uncapped listL2, empty-digest guard, salience mismatch). 711 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.7` | 2026-06-20 | Deep-audit remediation 8/10 — **edit & code-map correctness** (Initiative 13): new `editCore.atomicWrite` (sibling temp + `rename`, intra-fs) replaces the `Bun.write` truncate-in-place in `edit`/`multi_edit`/`write_file` — a crash/ENOSPC mid-write no longer corrupts the user's file; `findEditMatch` `MatchResult` gains `occurrences` (number of matching windows = ambiguity) distinct from `count` (verbatim copies of the chosen window = replace_all splices), and the uniqueness guards in `edit`/`multi_edit`/`selfEdit` switch to `occurrences > 1` — so a fuzzy match hitting two different-indent regions is rejected as non-unique instead of silently editing the first, while replace_all's reported count stays accurate (satisfies both the confirmed code-agent-4 and the refuted tools-code-edit-2 findings); `code/symbols.isExported` adds `class_body`/`class_declaration`/`object` to its stop-set so a method of an exported class is `exported:false`. +7 tests incl. new `editCore.test.ts`. 718 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.8` | 2026-06-20 | Deep-audit remediation 9/10 — **resilience & lifecycle** (Initiative 13): `trace/instrument.flushTrace` wraps `store.flush` in try/catch so every caller (dream/proactive/turn) inherits never-throw; **turn abort on disconnect** — `Session.activeTurnAbort`, `ProviderRequest.signal` → `AnthropicProvider.chatStream` `messages.stream(body, {signal})`, `RunTurnOptions.signal`/`TurnState.signal` threaded into `open_stream`, `ws` `chat.send` creates a per-turn `AbortController` (cleared in `.finally`) and `handleClose` aborts it when `activeSockets` empties (proactive/continuation unaffected); `continuation` timer `.unref()`'d + a `hasListener` gate skips a no-listener micro-wake; `scheduler` feeds `buildWakeContext` real `recentProactive` via new `sessionStore.listRecentProactiveTexts` (`turn_id 'proactive:%'`, non-empty). Client (`packages/web`): `wsClient` 30s keepalive ping + reconnect stability window (reset backoff only after staying open); `bootGate.warmUpTts` 120s overall deadline + 90s per-fetch AbortController; `webAudioSink` self-healing latch (`mutedUntil` 60s window, 502/504 retryable). +4 tests (continuation no-listener, flushTrace-never-throws, runTurn signal forwarding, listRecentProactiveTexts). Client timer/Web-Audio paths verified by review (no fake-timer harness). 722 green, `tsc` ×3 clean. | _branch_ |
| `v0.20.9` | 2026-06-20 | Deep-audit remediation 10/10 — **contract, config & test-debt** (Initiative 13 ✅): protocol — remove dead `L2Turn`/`SessionRow`, tighten `Citation.url` (http(s) `.refine()`, deliberately not `z.string().url()`) + `ToolEvent.tool_name`→`ToolName`; config — `.env.example` +37 flags, `.prettierignore` += `packages/web/public/`; cosmetic — `toolLabels` exact-match (fixes `recall_skill`/`propose_self_edit`/summary mislabels) + 9 new cute labels, `faceVm` emotion-gaze yields to the focusController under gaze-follow; test-debt — `makePinnedLookup` extracted + unit-tested (DNS-pin shapes) + smoke claim reworded, new `readTracking`/`defineTool` sibling tests. Owner-decisions deferred: `restore(n)` delete, `physicsPassthrough` delete/reimplement, provider SSE test. +13 tests. 735 green, `tsc` ×3 clean. **Initiative 13 complete (10/10).** | _branch_ |
| `v0.21.0` | 2026-06-21 | Weather perception 1/3 — **weather tool + location config** (Initiative 14): a no-key **Open-Meteo** `weather` pull-tool for the configured location — new `web/weather/openMeteo.ts` client (WMO-code map, `buildUrl`, Zod-validated JSON→snapshot, `assertPublicUrl` SSRF-validate + plain JSON GET — **not** `safeFetch`, whose text-only content-type gate rejects `application/json`; `setWeatherFetcher` seam) + `turn/temporalContext.resolveLocation` (`LUNA_LAT_LON`, range-validated, degrade-not-throw — IP-geo out behind the fake-IP proxy) + the `weather` `defineTool` (zero-arg, `proactiveRisk:'safe'`, leading progress + aborted-out + soft-fail). Registered in the 3 places (`ToolName` enum, `withWeather` gate, boot nest + log); opt-in behind `LUNA_WEATHER` (flips on at the v0.21.2 close). +11 tests (`openMeteo` + `weather`). 746 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.1` | 2026-06-21 | Weather perception 2/3 — **passive ambient weather** (Initiative 14): a TTL-cached, background-refreshed snapshot (`web/weather/snapshot.ts` — `.unref()`'d timer, `getSnapshot()` read synchronously, cold/stale→null, refresh never throws) + a pure `buildWeatherBlock` (`turn/weatherContext.ts`) pushed into the per-turn **uncached** tail next to `buildTimeBlock`; a stable data-free `WEATHER_CLAUSE` in `renderL1Contract` (memo key += `weatherAware`). She *knows* the weather without a tool call; **byte-identical cached system block across snapshots** (pin test) and **no fetch on the reactive path** (throwing-fetcher test). Opt-in `LUNA_WEATHER_AMBIENT`; `startWeatherRefresh()` wired at boot. +12 tests. 758 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.2` | 2026-06-21 | Weather perception 3/3 — **proactive weather + close** (Initiative 14 ✅): `afterANightOpening(nowMs, lastMs, tz)` (composed from `classifyDaypart`/`classifyGap`/`localDayNumber`, default 6h min-gap) gates a bounded `weatherNoteFor()` woven into `proactiveTurn.framing()` after the felt-absence clause (morning/after-overnight only; reads the cached snapshot, never fetches; the wake decision is untouched). **Default-flip + location-gate**: `LUNA_WEATHER`/`LUNA_WEATHER_AMBIENT`/`LUNA_WEATHER_PROACTIVE` → `!== '0' && resolveLocation() != null` (default-on, dormant until `LUNA_LAT_LON` set). +13 tests (`proactiveWeather.test.ts` + weatherContext flip). **Initiative 14 complete.** 771 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.3` | 2026-06-21 | Weather perception follow-on — **GPS auto-location** (Initiative 14): a new `ClientGeoEvent` (`client.geo`, range-validated) in the `ClientEvent` union (wire contract, both packages, tsc-enforced via `assertNever`); the web requests `navigator.geolocation` on boot (one-time permission) and sends it on connect + every reconnect (`web/geo.ts` + `app.ts` `onStatus`); the `ws` handler → `setRuntimeLocation()` in `temporalContext`, and `resolveLocation()` now returns the runtime GPS location **ahead of** the `LUNA_LAT_LON` env fallback — sidestepping the fake-IP proxy (server-side IP geo would report the exit node). +4 tests (protocol parse, runtime precedence, geo no-op guard). 775 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.4` | 2026-06-21 | Fix — **GPS-after-boot weather refresher** (Initiative 14): `ws`'s `client.geo` handler now calls `startWeatherRefresh()` after `setRuntimeLocation` — a location arriving post-boot (the normal GPS-grant timing, with no `LUNA_LAT_LON`) previously left the background refresher unstarted (boot `startWeatherRefresh` no-op'd with no location), so `getSnapshot()` stayed null and the ambient/proactive weather never appeared. Idempotent. +1 regression test. 776 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.5` | 2026-06-23 | Weather follow-on — **pluggable provider + QWeather (和风)** (Initiative 14): a `weatherProvider.ts` dispatcher (`LUNA_WEATHER_PROVIDER`: qweather\|open-meteo, auto by key presence) routes `fetchWeather` to a new **QWeather adapter** (`qweather.ts`: now+3d+24h via the account's custom API Host, all-string fields `Number()`'d, `lon,lat` order, max-24h `pop` as chance-of-rain, `assertPublicUrl` SSRF-validate + seam) or the renamed `fetchOpenMeteo` fallback. Fixes Open-Meteo's inaccurate China forecasts (**live: a test city 70% vs Open-Meteo 20% rain**). +3 adapter tests; existing weather tests pinned to open-meteo. Key/host live only in the gitignored `.env`. 779 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.6` | 2026-06-23 | Fix — **proactive survives a restart** (Initiative 14): the scheduler iterates `activeSessionIds()` = the in-memory session map, empty after a boot until the next user message — so proactive went dead between a restart and the next chat (no `proactive_wake` since 2026-06-16, confirmed in traces while user turns kept flowing). `main.ts` now `preloadSessions()` at boot: warms persisted sessions into the map (so the heartbeat considers them immediately) + restores `lastUserMs` from the last non-proactive L2 turn (`lastUserTurnMs`), so the idle-gap / deep-absence math survives a restart instead of resetting to boot time. +3 tests. 782 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.7` | 2026-06-24 | Dream diary completeness (Initiative 14 follow-on): (A) `dream/cycle.ts run_diaries` rewrites **today AND yesterday**'s day-diary each dream (`rewritable = day===todayKey \|\| day===yesterdayKey`, was today-only via `isToday`), so the next day's first dream finalizes yesterday from its full L2 turns (catching post-last-dream-pre-midnight talk) before it freezes; days older than yesterday stay write-once. (B) a **shutdown dream** in `main.ts`: a `SIGTERM`/`SIGINT` handler runs `runDreamCycle` for each `activeSessionIds()` before `closeDb`+exit — deadline-bounded (`Promise.race` + `Bun.sleep(LUNA_SHUTDOWN_DREAM_TIMEOUT_MS ?? 120s)`), second-signal force-exit, `LUNA_SHUTDOWN_DREAM=0` disables. From the 6/22 "half-diary" diagnosis (not a truncation/append bug). +0 tests (test 4c rewritten for the new invariant). 782 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.8` | 2026-06-24 | Core-memory remediation — **field boundaries + anti-churn**: the dream `persona_update` had let `self_state` fill with behavior rules and `relationship_status` with discrete facts (incl. a literal test count) and rewrote both fields ~every dream even at 97% identity. (a) a judge-panel-designed `personaUpdatePrompt` fences each field (felt sense of self / of the bond ONLY; facts→L3, rules→L1 contract), demands prose over keyword-soup, makes **null the default** (a full rewrite of a still-true field is named a failure); (b) `coreMemory.updateCore` no-op short-circuit (identical patch → no audit row, no `bumpMemoryEpoch`, every caller); (c) `cycle.ts persona_update` drops a per-field near-identical rewrite via new `memory/similarity.ts` `similarityRatio` (≥0.95 ⇒ unchanged; `LUNA_PERSONA_REWRITE_SIMILARITY`). `personaUpdatePrompt` is dream-only — NOT in `buildSystemPrompt`, so the cached prefix is untouched. Existing degraded content self-heals on the next dream (owner's choice). +7 tests. 794 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.9` | 2026-06-24 | Frontend — **persistent typing indicator**: the bouncing "thinking" dots showed on `turn.started` but `open()`/`chip()` called `hideThinking()`, so the first tool/message killed them for the rest of a multi-step turn — she read as "done" and the user interrupted. The controller now owns the indicator (`setThinking(on)` added to `BubbleView`; CuteBubbleView re-anchors the dots to the end without restarting the CSS bounce): up for the whole turn, hidden only while a bubble actively streams, cleared on `turn.result`/`proactive.finished`. Also fixes a latent stuck-dots bug — a proactive turn emits no `turn.result`, so the old open-only show spun forever. `app.ts` show/hide removed. **Review-hardened**: turn-local state resets at every boundary + on reconnect (a dropped `tool.finished` no longer wedges the dots off) and `showThinking` is scroll-respectful. +5 controller tests. 794 green, `tsc` ×3 clean. | _branch_ |
| `v0.21.10` | 2026-06-24 | Frontend — **message de-dup + history un-merge**: (1) the model sometimes **stutters** (two `message` tool calls with identical text — confirmed in L2 data, e.g. a turn whose `assistant_text` held the same sentence twice), so a bubble rendered twice; now dropped both server-side (`runTurn` skips a verbatim-consecutive `messageTexts` push → `assistant_text`/recall stay clean) and live (controller `discard`s a bubble identical to the last finalized one). (2) a multi-message turn was `\n`-joined into `assistant_text`, so `renderHistory` showed **one merged block** on reload; new pure `messageSegments` splits it to one bubble per message (+ dedups → old rows' baked-in stutters un-double too). Model context is rebuilt from `raw_json`, untouched — no schema/wire change. +7 tests (5 `bubbles`, 2 `controller`). 801 green, `tsc` ×3 clean. | _branch_ |
| `v0.22.0` | 2026-06-25 | **Proactive pipeline redesign 1/4 — detector-MVP** (Initiative 15): the scheduler has produced **0 proactive messages ever** (every wake-gate decision is `hold`). Make the **deterministic detector path the default** — `passesAntiSpam` (quiet-hours + cooldown + quota; **drops** the >18h `deep_absence` blanket + the 10m `too_soon` floor, so a long gap still fires) → the **after-a-night** detector → the silence-capable proactive turn, with its `{spoke}` as the only judgment (drafting-as-decision). **spoke/silent quota split** (`commitProactiveSilent`): a silent draft stamps the cooldown but doesn't consume the 5/day message budget. `runProactiveTurn` gains a `seed`; a `setProactiveDetectorForTests` seam (the v0.22.1 registry in embryo). The LLM wake-gate is now a default-off fallback (`LUNA_PROACTIVE_LLM_GATE`, deleted v0.22.3). Zero speculative LLM on an idle day. +11 tests. 812 green, `tsc` ×3 clean. | _branch_ |
| `v0.22.1` | 2026-06-25 | **Proactive redesign 2/4 — detector registry + scheduled slots** (Initiative 15): lifts v0.22.0's inline after-night check into a `detectors.ts` **registry** — `evaluateDetectors(ctx)`, first-match-wins over pure, LLM-free, clock-injectable detectors (`afterNight` + the new `scheduledWindow`). **`scheduledWindow`** is the guaranteed daily speaking floor the design panel asked for: at the local hours in `LUNA_PROACTIVE_SLOTS` (e.g. `'11,20'`) she gets an opening even if no content trigger lands, fired **≤ once per slot per day** via a per-day 24-bit mask (`slotsUsed`/`slotsDate`, migration `0013`, `markSlotConsumed`/`isSlotConsumed` with a new-day rollover). `passesAntiSpam` gains a small **idle floor** (`LUNA_PROACTIVE_IDLE_FLOOR_MS`, default 60s → `mid_conversation`) so a future event-hook detector can't cut into a live exchange — distinct from the removed 10m `too_soon` gate. The scheduler builds a `DetectorCtx`, takes `intent`+`seed` from the trigger, and marks the slot after a `slot:` fire (spoke or silent). Caught + fixed a real bug: unset `LUNA_PROACTIVE_SLOTS` returned `[0]` (midnight), not `[]`. +9 tests. 821 green, `tsc` ×3 clean. | _branch_ |
| `v0.22.2` | 2026-06-25 | **Proactive redesign 3/4 — event hooks + a real single-turn lock + weatherShift** (Initiative 15): a new `proactive/fire.ts` is the **universal proactive entry point**. `withProactiveLock(session, fn)` flips a synchronous per-session **in-flight flag before any await** — the prior `session.activeTurn === null` check-then-act was a **TOCTOU, not a lock**, and the two new event-hook entry points made the race reachable. `maybeFireProactive` runs the whole funnel (anti-spam rail → detector → **per-key debounce** → turn → cadence commit → dream handoff) inside that lock; the **scheduler tick, the ws-reconnect hook, the weather-refresh hook, continuation, and dev-fire all acquire the SAME lock**, so no two proactive turns can overlap. New **`weatherShift`** detector — fires once on a coarse condition-class/temp-band bucket change vs an in-memory baseline (`LUNA_PROACTIVE_WEATHER_SHIFT=0` kill switch; inert unless ambient weather is configured). Event hooks fire the funnel at the **natural instant** (a morning greeting the moment she's reconnected; a weather change as it lands) behind `LUNA_PROACTIVE_EVENT_HOOKS` (default off this release). Adversarially reviewed by a 3-lens panel (concurrency / correctness / flags-regression) with each finding sent to a refuter: 8 raised, **0 confirmed**; one parity nit fixed (the deprecated LLM-gate path now short-circuits on `activeTurn` before the wakeGate LLM call, as it did pre-refactor). +16 tests. 837 green, `tsc` ×3 clean. | _branch_ |
| `v0.22.3` | 2026-06-25 | **Proactive redesign 4/4 — fuzzy detectors + delete the wake-gate → Initiative 15 ✅** : two heuristic, **default-off**, soft-seeded detectors close out the registry — `openThreadAged` (an L3 `active_thread` open past `LUNA_PROACTIVE_THREAD_AGE_MS`, 24h) and `promisedFollowThrough` (the newest persisted turn is an unfollowed "I'll do/check X" beat inside a `[6h, 36h)` age window). Both seed gently so a stale/false positive yields **silence**, not an awkward nudge. **Deleted the wake-gate**: `wakeGate.ts` + `wakeGate.test.ts` + the `LUNA_PROACTIVE_LLM_GATE` branch in `scheduler.ts`, plus the now-orphaned `shouldConsiderWake` (cadence) and `listRecentProactiveTexts` (sessionStore) and their tests — the detector path (v0.22.0–v0.22.2) fully covers the openings, so the **heartbeat is now LLM-free** (cheap deterministic detectors → the silence-capable turn graph → `{spoke}` is the only judgment). The dev force-trigger acceptance is met by the existing lock-routed `proactive.fire`. Adversarially reviewed (2-lens panel + refuters): 5 confirmed, **all fixed** — tightened the promise regex (dropped bare `see`/`find`/`look`, bounded the gap, excluded empathy idioms) against false positives, added the abandoned-promise upper bound (a silent turn writes no L2 row, so without it an unfollowed promise re-fires forever), `.env.example` reconciled (dead `IDLE_THRESHOLD_MS`/`LONG_ABSENCE_MS` dropped, the 10 Initiative-15 knobs documented), orient skill-map refreshed. 826 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.0` | 2026-06-25 | **OpenAI-protocol adapter 1/4 — provider seam** (Initiative 16 opens): a `ProviderCapabilities` descriptor (`thinking`/`promptCache`/`interleavedToolStreaming`/`toolUse`/`systemRole`/`maxOutputTokens`) added to the `Provider` interface + a single `providerFor()` factory selectable by **`LUNA_PROVIDER`** (default `anthropic` → byte-for-byte unchanged). The `openai` branch throws "not implemented until v0.23.1"; an unknown value fails fast (no silent default). `AnthropicProvider` + `MockProvider` self-declare capabilities; `main.ts` switches both construction sites to the factory and prints the resolved provider + capabilities at boot. **Amends the provider LD** in `REWRITE_CONTEXT.md` (chat no longer Anthropic-SDK-only; a fresh TS `OpenAIProvider` takes `apiKey` per-instance, so the cut Python `openai_compat`'s `api_key_override` bug doesn't recur; embeddings/LD #13 unaffected). Deliberate divergence from the roadmap sketch: **no `runTurn` `cache_control` gating** — the OpenAI path strips it at translation time (v0.23.1), so the Anthropic cached-block bytes stay identical. +7 tests. 833 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.1` | 2026-06-25 | **OpenAI-protocol adapter 2/4 — translation core + provider** (Initiative 16): the riskiest slice. `provider/openai/translate.ts` (NEW, pure, no I/O) is the only place that knows the OpenAI Chat-Completions wire shape — `systemToOpenAI`/`messagesToOpenAI`/`toolsToOpenAI` (Anthropic-shaped history → OpenAI request: `tool_use`→`assistant.tool_calls[]`, `tool_result`→`{role:'tool', tool_call_id}`, `input_schema`→`function.parameters`, `cache_control` dropped) + `parseOpenAIResponse` (Zod) / `toAssistantContent` / `toProviderToolUses` / `mapStopReason` / `mapUsage` (response → a synthesized `Anthropic.ContentBlockParam[]` for replay + `ProviderToolUse[]` + usage). `provider/openai/openaiProvider.ts` (NEW): `OpenAIProvider` with `complete()` + a **correctness-first non-streaming** `chatStream()` (yields an optional `text_delta` then one `message_stop`; real SSE streaming is v0.23.2) + a minimal `fetch` client + `setOpenAIFetcher` test seam; `apiKey`/`baseURL` per-instance (the gateway OpenAI route by default). `providerFor()`'s `openai` branch constructs it. `message_stop.assistantContent` retyped `Anthropic.ContentBlock[]`→`ContentBlockParam[]` (the replay content is a param — lets a non-Anthropic provider synthesize it without response-only fields like `ToolUseBlock.caller`; Anthropic's `final.content` still assigns). Adversarially reviewed (2 lenses + refuters): 7 findings, **0 confirmed real** (the Zod schema is correct for standard chat-completion responses; an array-content/refusal response throws loudly rather than corrupting; the `ANTHROPIC_BASE_URL`→`/chat/completions` footgun is documented in `.env.example`). +20 tests. 853 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.2` | 2026-06-25 | **OpenAI-protocol adapter 3/4 — real SSE streaming** (Initiative 16): `OpenAIProvider.chatStream` branches on **`LUNA_OPENAI_STREAM`** (default off → the v0.23.1 non-streaming `chatStreamBuffered`; `=1` → a new `chatStreamSSE`). The SSE path translates chat-completion deltas → `text_delta` / `thinking_delta` (reasoning models via `delta.reasoning`/`reasoning_content`, gated by `LUNA_OPENAI_REASONING`) / `tool_use_start` / `tool_input_delta` **as they arrive** (interleaved tool-use — the rewrite's #1 latency principle), accumulating `tool_calls` by `index` (with a buffered-args flush if fragments precede the id/name), then one `message_stop` assembled from the **same `blocksFromParts` builders** the non-streaming path uses → streamed and non-streamed turns persist **byte-identical history**. A pure `consumeSSE` byte-framer (handles CRLF, split-across-reads, `[DONE]`, comments) + a `setOpenAIStreamFetcher` test seam; `capabilities` computed in the ctor (`interleavedToolStreaming`/`thinking` per the flags). Adversarially reviewed (streaming-accumulation + SSE-framing lenses + refuters): **2 real gaps fixed** — (1) a tool stream with no terminal `finish_reason` chunk now defaults to a `tool_use` stop (else `mapStopReason(null)`=`end_turn` → runTurn skips dispatch → orphaned `tool_use` in history → next OpenAI request 400s; plausible via the third-party gateway), (2) `consumeSSE` drains a final newline-less `data:` line. +13 tests. 866 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.3` | 2026-06-25 | **OpenAI-protocol adapter 4/4 — model registry → Initiative 16 ✅** : `provider/registry.ts` (NEW) — `resolveModel(LUNA_MODEL)` → a `ModelEntry` {`protocol`, `tokenParam`, `systemRole`, `reasoning`, `toolUse`} from a built-in table (claude → anthropic; `o1`/`o3`/`o4` → openai+`developer`+`max_completion_tokens`+reasoning; `gpt-5` → +`max_completion_tokens`; `gpt-` → openai) + a Zod-validated `LUNA_MODELS_JSON` override (a new model = one config entry, no code). `providerFor()` is now registry-driven (`LUNA_PROVIDER` forces the protocol; an unknown value still fails fast). `OpenAIProvider` takes the entry and threads the quirks — `tokenParam` for the max-tokens key, `system`/`developer` role, `reasoning`→`capabilities.thinking`, `toolUse:false`→omit tools — all **entry-driven, no model-id regex** at any call site. The live multi-model E2E (GPT/o-series + an OSS model + Anthropic) is the one remaining acceptance step (needs a restart against real endpoints). +9 tests. 875 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.4` | 2026-06-29 | **OpenAI hardening — post-ship audit (PR #8) remediation** : a 7-lens audit of Initiative 16 (0 critical / 5 high / 12 medium / 27 low; root cause = *treating Anthropic's reliability as protocol-independent*) raised concrete gaps; this fixes them **before any live OpenAI run**. **Theme C** (the cleanest bug): `chatStreamBuffered` — the DEFAULT path — now forces a `tool_use` stop when `tool_calls` are present (else orphaned `tool_use` poisons history → next request 400s; the SSE path already had the guard). **Theme D** (dead-on-arrival config): drop the `ANTHROPIC_BASE_URL` base-URL fallback (→ `api.openai.com/v1`; no `/v1`-drop 404, no bearer key to the Anthropic host); the factory threads the single wire model so the startup log can't lie; `NaN`-guard `LUNA_MAX_TOKENS` (both providers); registry `id.min(1)`. **Theme B** (tolerant parsing): `parseStreamChunkSafe` skip-bad-chunk, synthesized `call_<index>` tool ids (no empty/colliding `tool_call_id`), in-band `error`-frame detection (object OR string). **Theme A**: `tool_choice:'required'` so a GPT model can't answer in free `content` and bypass the message tool (LD #9; registry-overridable to `auto`). **Theme E**: bounded retry parity (`maxRetries`-equivalent on connect/5xx/429) + `complete()` `reasoning_effort:'low'` so an o-series dream/fold can't starve to empty. **Theme F**: HTTP error-body redaction (no gateway/key leak to the client), SSE reader cleanup + line/output size caps, `content_filter` passes through (not masked as `end_turn`), `is_error` prefixed on tool messages. Adversarially reviewed (2 lenses + refuters, focused on the un-unit-tested retry/reader control flow): 4 findings, **0 confirmed**. +9 tests. 883 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.5` | 2026-07-01 | **Persona — kill the assistant-filler closer tic**: live L2 caught Luna padding **reactive** replies with hollow check-in bait ("Still here — what's on your mind?", "Talk to me", "What's wrong?") — 11 of the recent 237 turns, once *while the user was complaining she sounds like a robot* (`turn:236`). The string is **model-generated** (grep-absent from all TS + Python source, not a hardcoded fallback), and the anti-查岗 constraint existed only on the **proactive** path — reactive replies had no equivalent, and the persona file's abstract "no assistant patterns" (`default.md:102`) didn't hold. `renderHumanityBlock()` — the cached "How you speak" block (`runTurn.ts:137`) — gains a **concrete** rule: names the banned closers (+ 在吗/还在吗), grants "a reply can simply end", makes her mirror a thin OwO/lol *lightly* instead of inflating it into a probing question, all while preserving genuine specific curiosity. +1 test; persona 14 green, `tsc` clean. **Restart-gated** (system block memoized per process, `runTurn.ts:298-308`). | _branch_ |
| `v0.24.0` | 2026-07-02 | **Proactive silence ladder — core** (Initiative 17 opens): the owner's Python proactive design restored as the wake DECISION, behind `LUNA_PROACTIVE_LADDER` (default **OFF**, coexists with the detector registry). NEW `ladder.ts` `evaluateLadder` = the ported phase machine — `effective_gap = min(userGap, sinceProactive)` drives `engaged → idle_watch → nudged → dormant (+sleeping)`: ambient (12%) · idle_nudge · renudge on `[1.0,2.4,6.0]` backoff · leave_message · DORMANT auto-recovery · long-absence · read-time user-reset — returning the effective `{scenario,phase,nudgesSent}`. `cadence.commitScenario` (advances from the effective base) + `commitLadderSilent` (silent fire: stamp+persist) + `commitLadderPhase` (null tick: persist, no stamp). `proactiveTurn` gains the 4 restraint-graded scenario framings + full `COMPANION_OPENER_CONSTRAINT` (陪伴不查岗) + anti-repeat. Adversarially reviewed: **3 confirmed defects, all fixed** — the pure evaluator's transitions were discarded at commit → renudge-tier skip + DORMANT lockout + frozen climb; fixed by returning + persisting the effective phase on the spoke/silent/null paths (mirrors Python's in-place `st` + `note_attempt`). +27 tests; **807 server green, `tsc` clean.** | _branch_ |
| `v0.24.1` | 2026-07-02 | **Proactive silence ladder — flip default + retire detectors** (Initiative 17): `ladderEnabled()` flips **default-ON** (the ladder is now THE wake decision; `LUNA_PROACTIVE_LADDER=0` = escape hatch). **Deleted** `detectors.ts` (the 5 detectors + registry) + `detectors.test.ts` + the scheduled-slot machinery in `cadence.ts` (`scheduledSlots`/`isSlotConsumed`/`markSlotConsumed` + the `slotsUsed`/`slotsDate` fields; the migration-0013 DB columns left vestigial — no migration). `fire.ts` dropped the detector seam + debounce + branch; `FireOutcome` = `{fired,spoke}`. Test surgery: fire/scheduler rewritten to drive the ladder; the `>18h` test flips to "→ sleeping, no fire" (pure-Python parity). **Amends LD #15** (detector framing reversed at the owner's direction). 784 server green, `tsc` clean. | _branch_ |
| `v0.24.2` | 2026-07-02 | **Proactive style self-tuning** (Initiative 17 ✅ closes): NEW `style.ts` — the two-layer style (operator floor/ceiling + Luna-writable activeness aloof/balanced/clingy + voice notes); `resolveEffectiveCadence` applies the `_LEVEL_MULT` lever then clamps (`balanced` = raw knobs, unchanged by default). Migration `0014` (singleton `proactive_style`). NEW `set_proactive_style` tool (`defineTool`, safe; added to `ToolName` + `builtinRegistry`). Lever wired into `passesAntiSpam` (cooldown/quota) + `evaluateLadder` (probs/renudge); `proactiveTurn` threads voice notes. +13 tests; 795 server + 104 protocol/web green, `tsc` ×3 clean. **Initiative 17 complete (3/3).** | _branch_ |
| `v0.25.0` | 2026-07-02 | **Collapsible companion UI — beside-model speech stack** (Initiative 18 opens): NEW `speechStackView.ts` (`BubbleView`: newest-at-bottom timed stack in `.model-stage`, ~10s TTL + fade, overflow cap, `clearAll` barge-in, `noteSpeechStart` speech-gating; open/append/chip no-op) + `routerBubbleView.ts` (forwards to the window view always + the stack when `collapsed()`, read live). `app.ts` wires the router (collapsed = `luna:bubble-stack` toggle until v0.25.1) + speech-gated audio + barge-in clear; `theme.css` adds `.speech-stack`/`.speech-bubble` + reduce-motion. **Zero server/protocol change** (fed by the existing controller→BubbleView seam). +11 tests; 85 web green, `tsc` ×3 clean. Visual rendering deferred (a preview would collide with the stable :5173/:8787). | _branch_ |
| `v0.25.1` | 2026-07-02 | **Collapsible companion UI — collapse ↔ expand morph** (Initiative 18): a `collapse-btn` in the **input-row** (not the header — it survives collapse) toggles a persisted `.collapsed` mode: the chat panel morphs into a **fixed centered bottom pill bar** (`min(560px,92vw)`, bar-rise), header/log hidden, `.model-stage` takes the full width (+ fills the freed column on mobile), a synthetic `resize` re-fits the model (v0.25.2 turns the snap into a glide); the v0.25.0 router now reads the REAL collapse state. Drive-by fixes: `buildLayout`'s `className=` wiped the boot-persisted `reduce-motion` class (→ `classList.add`); reduce-motion overrides written as compound (same-element) selectors. **Browser-verified on an isolated :5273 preview with a dead-port WS** (collapse/expand/persistence/mobile all screenshot-confirmed; stable :5173/:8787 untouched). `tsc` ×3 clean; 85 web green. | _branch_ |
| `v0.25.2` | 2026-07-02 | **Collapsible companion UI — model glide + head-anchored comic bubbles → Initiative 18 ✅** : FLIP glide on the pixi beat (NEW `ease.ts` + pure `glide.ts` tween; `ModelDriver` composes base+drag+mode; `glideLayout(mutate)` eases the mode offset → 0; live-sampled: textbook ease-in-out, settles exactly at center). the owner's design review: bubbles **anchor beside her HEAD** (sink publishes `--luna-head-x/y/gap` per frame — drag/zoom/glide tracked; clearance `0.26×width` so they never cover her), **comic tails** (`::after` on `.latest` pointing at her face; the previous bubble's tail transitions away the moment it becomes history), bounded **random jitter** per bubble. Adversarial review: **3 CONFIRMED fixed** (fit() re-clamps + heals a stranding persisted drag; `glide.stop()` on the reduce-motion snap; OS `prefers-reduced-motion` honored in JS). +9 tests; **919 green, `tsc` ×3 clean**; browser-verified on the isolated :5273 preview. **Initiative 18 complete (3/3), zero server/protocol change.** | _branch_ |
| `v0.26.0` | 2026-07-02 | **Desktop app — port foundation + Electron rendering smoke** (Initiative 19 opens): `packages/web` gains a **production build** (`bun build` → a self-contained 8.4MB `dist/` incl. Cubism core + the reference model); NEW `wsUrl.ts` fixes the #1 desktop break (fixed `ws://127.0.0.1:8787` + `?ws=` override — no more `location.hostname` derivation). NEW **`packages/desktop`** (Electron ^33): a pinned-`:5177` path-jailed loopback static host (`serve.ts`, sidecar-ready), a minimal shell window (`contextIsolation`, `backgroundThrottling:false`), and an automated **rendering go/no-go** (`smoke.ts`: hidden window + dead-port WS + DOM probe + PNG). **Smoke PASSED** — `headX` set ⇒ the reference model renders AND animates in Electron's Chromium from the production bundle. +3 tests; **922 green, `tsc` ×4 clean**. Live chat round-trip deferred to the owner's supervised run (isolation policy). | _branch_ |
| `v0.26.1` | 2026-07-02 | **Desktop app — the single-machine app** (Initiative 19): `bun build --compile` → a 62MB standalone `luna-server` (sandbox-verified: fresh-DB migrate to v14 + WS ping→pong). Compiled-binary hazards fixed logic-free (`LUNA_MIGRATIONS_DIR`; `lazyHtml()` — three dev viewers' top-level `readFileSync`s crashed the binary at import). NEW supervisor layer (`envfile`/`supervisor`/`main`): keys in `userData/luna.env` (never bundled), app-data DB, spawn → bounded restart → **kill-on-quit**, `waitForPort`, first-run template + placeholder key, the app's server on **:8790** (coexists with a dev :8787). electron-builder packaging (dir/arm64/unsigned) with sidecar+migrations+persona+web as resources. **Packaged smoke PASSED: `{ok:true, wsStatus:"open"}`** — the real WS round-trip, clean ~8s exit, no orphan. Frontend LD amended. +6 tests; **928 green, `tsc` ×4 clean**. | _branch_ |
| `v0.26.2` | 2026-07-02 | **Desktop app — the pet window → Initiative 19 ✅** : `LUNA_PET_MODE=1` → a transparent/frameless/always-on-top window with `?pet=1` (the web strips the room + forces the companion layout); **region click-through** (a pure `petHitTest` over the sink-published model bbox + the bar/buttons → `preload` contextBridge → `setIgnoreMouseEvents`); geo via `LUNA_LAT_LON` in the template. **Packaged pet smoke PASSED** (`pet:true, bodyBgImage:"none", wsStatus:"open"` + a real-alpha PNG — the reference model over pure transparency, no edge halos). +4 tests; **932 green, `tsc` ×4 clean. Initiative 19 complete (3/3).** | _branch_ |
| `v0.27.0` | 2026-07-02 | **Settings surface — the pet toggle in the panel**: pet mode stops being an env-file edit — a "Desktop pet" switch in the settings panel (desktop shell only; a plain browser never shows the row). NEW `desktop/src/shellSettings.ts` (`userData/settings.json`, corrupt-degrading) — the UI choice **persists and wins over** `LUNA_PET_MODE` (now the initial default only); NEW `lunaPet.setPetMode` bridge → `ipcMain` flips by **building the replacement window before closing the old one** (transparent/frame are creation-time-immutable; close-first would fire `window-all-closed` and kill the sidecar). +4 tests (**936 green**), `tsc` ×4 clean. | _branch_ |
| `v0.27.1` | 2026-07-03 | **Settings surface — the server-driven settings panel**: env flags stop being file-only edits — a whitelisted registry (`settings/registry.ts`, 16 switches across Companion/Perception/Abilities/Memory/Model) becomes a live panel that **auto-renders** from a new wire push. NEW wire: `settings.set` (client) + `settings.state` (server, pushed on connect + re-broadcast after every accepted set). NEW `settings/store.ts` — three-layer precedence (**user pin > env-file > default**) applied by mutating `Bun.env` (overlaid at boot BEFORE provider/registry construction, so restart-flagged switches land next boot); pins persist in migration `0015_settings` (key-value, absent row = follow env → makes reset meaningful). NEW `web/src/ui/settingsView.ts` renders per-category with restart badges + per-pin reset (↺); secrets never enter the surface (registry rejects `*KEY*`). Live-verified on isolated :5273/:8899: set→broadcast→user-source→reset→row-deleted→env-fallback. Adversarial review fixed 2 real bugs (double-init snapshot corruption, boolean canonicalization). +20 tests; **955 green, `tsc` ×4 clean.** | _branch_ |
| `v0.27.3` | 2026-07-03 | **Proactive directive leaked into a phantom user bubble**: a proactive turn's `userText` is the internal stage direction (`[System proactive trigger …]` / self-continuation priming), not a real user message — but `runTurn` persisted it verbatim as L2 `user_text`, so the frontend rendered the raw directive as a user bubble (visible since ~2026-06-16; the alt-model's rambling just made the owner scroll up and notice). Fix: `userText: opts.proactiveTurn ? '' : opts.userText` (the directive still lives in `raw_json` for context). +1 regression test; **956 green, `tsc` clean.** Cleaned 7 already-leaked rows in the live DB (user_text cleared, replies + context intact). | _branch_ |
| `v0.27.2` | 2026-07-03 | **Desktop preload fix — the pet toggle (and pet click-through) actually load**: the "Desktop pet" row was invisible because the Electron **preload never loaded** — bun inlines `__dirname` as the SOURCE dir (`packages/desktop/src`) at compile time, so `join(__dirname, 'preload.cjs')` pointed at a nonexistent `src/preload.cjs` and the `lunaPet` bridge silently failed (a latent bug since v0.26.1 — it also killed pet-mode click-through, which the smoke never checked). Fixed with `app.getAppPath()` (real bundle root in dev + asar). The packaged smoke now asserts `bridgeSetPetMode==='function'` + `petRowVisible` + opens the settings panel — the exact check that would've caught it. Verified `{ok:true, bridgeSetPetMode:"function", petRowVisible:true, serverRows:16}` in dev AND packaged; screenshot shows the full panel with the pet toggle. `tsc` ×4 clean. | _branch_ |
| `v0.27.4` | 2026-07-03 | **Audit real-bug remediation** — three reproducible defects from the 21-agent prompt/injection audit (10 cluster critics → 10 adversarial verifiers → 1 synthesizer). **#1**: the corrective stage-directions (SILENT/PROMISE/INTENT) were pushed as `role:'user'` messages and `stripThinking` only clears assistant blocks, so they **persisted into durable history** — every later turn's window re-read a fabricated "user" scolding; new tool-pairing-safe `stripCorrectiveDirectives` (remove-then-coalesce-same-role) drops them in finalize before `appendL2`/`persistSession`. **#2**: `diaryInjectEnabled()` used `=== '1'` (the lone default-OFF outlier among all `!== '0'` switches), so the day/week/month diary digest never reached the model by default → flipped ON. **#3**: `personaUpdatePrompt`'s null example was a quoted string mentioning "null", letting a literal-minded model emit the STRING `"null"` and overwrite a still-true `self_state`; the example now shows the JSON literal `null` + an explicit instruction, backed by a `normPersonaField` coercion. Sibling of the v0.27.3 phantom-bubble leak (same class, new site). +6 tests; **962 green, `tsc` ×4 clean.** | _branch_ |
| `v0.27.5` | 2026-07-03 | **Audit structural remediation** — three prompt-structure findings from the 21-agent audit. **#2**: the four code-agent L1 clauses were unconditional in the cached system core (~51% of the base contract) while web/time/weather gated on their mount — now gated on `LUNA_CODE_WRITE`/`LUNA_SHELL`/`LUNA_REPO_MAP` (new `isCodeWriteMode`/`isShellMode`/`isRepoMapMode`, threaded through `renderL1Contract`/`buildSystemPrompt`), so a session with those tools off never reads a contract naming them; locate-first + plan stay in the base (always mounted); `EMBODIMENT_BLOCK` drops its duplicate workspace/edit sentence. **#5**: injected recall was framed as firsthand memory — relabeled to a shared told-vs-remembered LEAD (honors the persona's Memory-Condition seam), the "trust" clause scoped to the TS-computed time label, and `clip()` neutralizes a literal `</memory>` so stored text can't close the fence early. **#11**: `FALLBACK_PERSONA` now carries the anti-assistant guardrails, so an unreadable persona file no longer silently yields a thinner-guardrail Luna. +2 tests; **964 green, `tsc` ×4 clean.** | _branch_ |
| `v0.27.6` | 2026-07-03 | **Audit polish/redundancy remediation** — the prompt system's voice + redundancy layer (deferred findings from the 21-agent audit). Persona file rewritten **3rd→2nd person** ("Luna is… She should…" → "You are… You…"); preamble → "This is who you are"; `BASE_DIRECTIVES` gains an identity anchor + a precedence line (the generic tool-use nudge moved into L1). Redundancy trimmed to one home each: the check-in denylist is de-triplicated (phrase list kept once, on the ladder path), warmth-not-guilt (dropped the per-turn `absencePhrase` restatement), bulletin-avoidance (dropped from `weatherNoteFor`, cached clause owns it), message-mode mechanics (now owned solely by the message tool description). Single-user hardcoded owner name removed from the weather/time strings + clauses ("where the user is"); proactive person-refs unified to a single owner pronoun. Framing reframed positive-first: banned-closer permission-first (concrete anchors + CJK kept), `INTENT_NO_ACT` no longer forces a spoken walk-back, "mood of the hour" late-night demoted to a neutral fact, wake scene trimmed of amnesia lore. Dream refine/audit prompts gain a worked Good/Bad example; personaUpdate restraint bullets 4→2; time_now/weather/remember descriptions gain when-not-to-use boundaries. 4 test wording-assertions updated in lockstep; **964 green, `tsc` ×4 clean.** | _branch_ |
| `v0.28.0` | 2026-07-03 | **First-run onboarding (Initiative 20 opens)** — the desktop app's "edit `luna.env`, then restart" chore becomes a guided setup screen. NEW `desktop/onboarding.ts` (`needsOnboarding`, line-preserving `mergeEnvFile`, `classifyProbe`); NEW `web/ui/setupView.ts` form (base URL + key + model, defaults `https://api.anthropic.com`/`claude-sonnet-4-6`) shown on `?setup=1`; `supervisor.restart(env)` re-spawns the sidecar against fresh keys (identity-guarded so a killed child's async exit can't respawn); `main.ts` gates first-run to the setup screen (holds the sidecar until keys land), removes the blocking dialog, adds `luna:onboarding-probe`/`-submit` IPC — **the key rides one direction, the verdict never returns it, and it never touches the `settings.*` wire**. Save = **test-then-write** (a bad key never persists). SMOKE + `LUNA_SKIP_ONBOARDING` bypass the gate. +18 tests; **979 green, `tsc` ×4 clean.** | _branch_ |
| `v0.28.1` | 2026-07-03 | **Pet model fixed half-body (Initiative 20, 2/3)** — in pet mode the Live2D model becomes an inert head-to-waist portrait: NEW pure `web/live2d/petFraming.ts` (width-fit ×1.7 the full-body scale, top-anchored → head→torso fills the window, feet clip below, derived from LIVE host dims so it re-fits on resize); `pixiLive2DSink` takes a `{pet}` option → `fit()` pet branch + **model drag and scroll-zoom disabled** (guards on pointerdown/wheel/dblclick, no grab cursor); `app.ts` passes `pet:isPet` at sink creation. Windowed mode byte-unchanged. +4 tests; **983 green, `tsc` ×4 clean.** Verified on the isolated `:5273` preview (`?pet=1`, 560×900): clean half-body bust, drag+zoom confirmed no-op. | _branch_ |
| `v0.28.2` | 2026-07-03 | **Pet window move + resize → Initiative 20 ✅** — pet mode's window becomes the thing you move + resize. NEW pure `desktop/petWindow.ts` (`resizable:true` + `minWidth/minHeight` + `maximizable:false`); `main.ts` **drops per-pixel click-through** in pet mode (the recommended fork — traded for real move/resize); `theme.css` makes her body `-webkit-app-region: drag` (move the window) and the bar/buttons/panel `no-drag` (still clickable); `app.ts` retires the `pointermove` hit-test loop (petHitTest.ts + `lunaPet.setIgnore` kept for a future hybrid); the model re-fits on resize for free (`fit()` already runs on `'resize'`). `smokeProbe` now asserts `isResizable()` + her body is a drag region + the bar isn't. +1 test; **984 green, `tsc` ×4 clean.** Confirmed in real Electron that `getComputedStyle('-webkit-app-region')` reports correctly (windowed = `none`). | _branch_ |
| `v0.28.3` | 2026-07-03 | **Initiative 20 review remediation** — a 24-agent adversarial review (4 dims × verify) of v0.28.0–2; the confirmed findings fixed: (HIGH) `mergeEnvFile` now strips C0 control chars from values so a field pasted with a newline can't inject a second `KEY=` line into luna.env; (MED) `supervisor.start()` gains an `'error'` listener so a spawn failure (ENOENT/EACCES) clears the child instead of wedging `start()` forever; (MED) `luna:onboarding-submit` gets a concurrency guard (`ipcMain.handle` doesn't serialize concurrent awaits → a double-invoke could double-restart + double-window); (LOW) `petFraming` returns a safe fallback for 0-dim inputs (never NaN/Infinity); the pet smoke's `barNoDrag` assertion tightened `!== 'drag'` → `=== 'no-drag'`. Other findings (wire, window-all-closed race, `=`-in-URL, prefix keys, pet-toggle recreation) REFUTED. +4 tests; **988 green, `tsc` ×4 clean.** Packaged windowed + pet smokes re-verified. | _branch_ |
| `v0.28.4` | 2026-07-03 | **EMERGENCY: L1 fold stall → unbounded context** — the cost dashboard showed **~390K input tokens on plain chat turns**. Root cause: `planFold`'s `cum !== windowLowWater → return null` exact-match guard turned one-off bookkeeping drift (history edits — e.g. v0.27.4's directive stripping — shift message counts across restarts; stored watermark 498 vs nearest row boundary 511) into a **permanently stalled fold**; `buildActiveContext` then sent messages 498→1941 (1444 msgs ≈ 294K tok) every turn. Fixes: (1) `planFold` **heals drift** (snaps the fold base to the crossed row boundary + warns; the commit re-aligns the watermark); (2) NEW `hardTrimTail` safety net bounds the verbatim tail (`LUNA_L1_TAIL_MAX_MSGS` 300 / `LUNA_L1_TAIL_MAX_CHARS` 120K) regardless of upstream state, cutting only at turn starts (never strands a `tool_result`); (3) a drifted tail start mid-tool-pair aligns forward to the next turn start (kills a latent 400 class). **Replayed on a live-DB copy: 1444 msgs / ~294K tok → 157 msgs / ~43K tok immediately; fold heals (119 turns folded, watermark 511→1282)** — restart self-heals, no data surgery. +5 tests; **993 green, `tsc` clean.** | _branch_ |
| `v0.28.5` | 2026-07-03 | **Cost tripwire + usage in traces** (the v0.28.4 incident's observability lesson — "the bill was the only alarm"): NEW `warnIfExpensiveRound` fires a LOUD `[cost] ⚠️` console warning when a single request's input exceeds `LUNA_COST_WARN_INPUT_TOKENS` (default 80K; `=0` disables) — per ROUND, since each round re-sends the whole context and one huge request is the anomaly signal; `tracedEmit` now records the turn's real `usage` on the `turn.result` trace payload, so cost regressions show in `/_trace` instead of only on the bill (the field was previously empty — exactly why the stall went unnoticed). No wire change (`OutboundTraceEvent.payload` already existed). +3 tests; **996 green, `tsc` clean.** | _branch_ |
| `v0.28.6` | 2026-07-03 | **Pet drag rework: clicks work again** — the owner's live test: the pet window moved + resized, but **nothing inside was clickable** (the app couldn't tell whether a mouse press was dragging the window or clicking inside it). Root cause: `-webkit-app-region: drag` intercepts mousedown at the NATIVE layer before the DOM sees it, and `no-drag` islands are unreliable on transparent frameless windows. Fix: **drop app-region entirely; manual drag** — pointerdown ON HER BODY (the sink-published `--luna-model-*` bbox via `petHitTest.ts`, the v0.26.2 seam kept "for a future hybrid") starts a drag, TOTAL screen-space deltas stream over NEW `lunaPet.dragStart/dragMove/dragEnd` IPC, and NEW pure `petDrag.ts` moves the window from a fixed origin (no incremental drift). Click-vs-drag is now unambiguous: her body drags the window, every control receives ordinary DOM clicks. Smoke asserts `bridgeDrag==='function'` + NO `-webkit-app-region: drag` anywhere. +3 tests; **999 green, `tsc` ×4 clean**; repackaged, pet smoke green. | _branch_ |
| `v0.28.7` | 2026-07-03 | **Desktop TTS wiring** — the desktop app showed the boot gate's "Loading the voice model" animation, then **always** went muted: Initiative 19's `serve.ts` hardcoded a 502 stub for `/api/gpt-sovits/*` and `main.ts` never spawned the GPT-SoVITS proxy (the agent WS backend is shared with web dev, but TTS is a separate sidecar the desktop shell never brought up). NEW `desktop/tts.ts` (`resolveTtsConfig` reuses dev-all's `LUNA_TTS_DIR`/`LUNA_TTS_PORT` knobs + module-presence probe; `ttsProxyScript`); `serve.ts` `startWebHost` takes an optional `ttsUpstream` → `forwardTts` proxies `/api/gpt-sovits/*` (body + binary audio passthrough, 502 on no/dead upstream), requestTimeout raised for cold ~5GB model loads (no upstream ⇒ 502 preserved, smoke unchanged); `main.ts` auto-spawns the proxy as a **second supervised sidecar** via Electron-as-node (`ELECTRON_RUN_AS_NODE`, no `bun` dependency), guarded by module+script presence, no-op under SMOKE, killed on quit. Zero-config voice in a source checkout, degrades to muted when the (local-only, never-bundled) TTS module is absent. +11 tests; **1010 green** (full suite, merged with v0.28.6); forward-proxy hardened (path-traversal guard + fetch timeout). desktop + server `tsc` clean in the integrated checkout. | _branch_ |
| `v0.28.8` | 2026-07-03 | **Desktop ↔ web backend unification (one Luna)** — the app spawned its own sidecar on **:8790** against a separate app-data DB (a second, divergent Luna: 12 turns vs the web Luna’s 332). Now the canonical WS port is **shared with `bun run dev` (:8787)**: on boot the app probes it and **ATTACHES** to a running backend (one Luna, one DB — no second sidecar/TTS/onboarding), else **SPAWNS** its own against the **shared repo `luna.sqlite`**. NEW `backend.ts` (`resolveSidecarDb`/`shouldAttach`, pure+tested); SMOKE keeps :8790 + a throwaway DB. +6 tests; **1016 green, `tsc` clean**; repackaged + packaged smoke green. | _working tree_ |
| `v0.28.9` | 2026-07-03 | **Desktop one-click dev stack** — following v0.28.8, when the app must start the backend itself it now launches the **whole** dev stack (`bun scripts/dev-all.ts` = server 8787 + web 5173 + tts 8788) instead of a bare sidecar, so one click brings everything up, the browser shares the same Luna, and TTS comes up for free (dev-all owns the proxy). NEW `resolveDevLauncher` (probes dev-all.ts + an absolute bun path incl. `LUNA_BUN_PATH`, since a Finder-launched app has no PATH); supervisor gains `cwd`. Falls back to the self-contained compiled sidecar (no bun/repo, or SMOKE). +4 tests; **1020 green, `tsc` clean**; repackaged + smoke green. | _working tree_ |
| `v0.29.0` | 2026-07-03 | **Silence idle-timer core (Initiative 21, 1/2)** — the reported bug: Luna interrupts an active conversation seconds after she finishes replying. Root cause: the silence ladder's `effective_gap` was computed from `lastUserMs` + `lastProactiveMs` only — her ordinary **reactive replies advanced neither anchor**, so the clock kept counting from the user's *earlier* message and crossed the ambient/idle thresholds while the user was still reading her answer. Fix (the owner's redesign): make silence itself the trigger — one NEW `session.lastActivityMs`, bumped by `markActivity()` at every user message (`ws.ts`) AND every reply-producing turn finalize (`runTurn.ts`, reactive/continuation/proactive), seeded on preload from the last L2 `t_ms`. `ladder.ts` reads `silenceGap = now - lastActivityMs`; the anti-spam idle floor (`cadence.ts`) reads it too (a long reactive turn no longer pre-elapses the 60s floor). Two orthogonal clocks kept separate: `lastUserMs` still keys ONLY the escalation reset (user reply → engaged), `lastProactiveMs` still governs outreach spacing (`effectiveGap = min(silenceGap, sinceProactive)` retained). Behind `LUNA_PROACTIVE_SILENCE_TIMER` (default on; `=0` restores the old anchor for A/B). No schema/protocol/migration change. +9 tests; **1019 green, server `tsc` clean.** | _branch_ |
| `v0.29.1` | 2026-07-03 | **Tune the amplifiers + retire the old anchor (Initiative 21, 2/2 ✅)** — with the idle-timer proven, make it the only path and calm the two secondary amplifiers that made her chatty even in a genuine lull. `ladder.ts` / `cadence.ts`: the `LUNA_PROACTIVE_SILENCE_TIMER` flag + the `silenceAnchorMs` selector + `silenceTimerEnabled()` are **deleted** — `silenceGap` from `lastActivityMs` is unconditional; `WakeContext` drops the now-unused `lastUserMs` (grep-confirmed zero flag refs). Two default changes (both still env-overridable): `LUNA_PROACTIVE_AMBIENT_MIN_MS` **120_000 → 300_000** (a 5-min lull, not 2, before a weightless ambient is eligible) and `LUNA_PROACTIVE_AMBIENT_PROB` **0.12 → 0.06** (the per-60s-tick re-roll no longer compounds to ~85% over a long silence). The ladder shape — phases, renudge backoff, quota, dormant recovery, the user-keyed reset — is untouched. Tests: flag-off tests removed; NEW eligibility-threshold (no ambient until 5m) + bounded-rate (a 15-min silence yields a comfortably capped cumulative ambient chance) + updated pinned defaults. **1019 green, server+protocol `tsc` clean.** **Initiative 21 ✅ complete (2/2).** | _branch_ |
| `v0.30.0` | 2026-07-04 | **Soul store + migration + seed — dark launch (Initiative 22, 1/4)** — lands the DB substrate for the soul file (persona split into a dev-authored fixed core + a Luna-authored evolving section) with **zero runtime behavior change**. NEW migration `0016_soul.sql` (`soul` + `soul_audit`, `core_memory`/`core_memory_audit` untouched); protocol `Soul` zod type (`fixed_text`/`evolving_self`/`evolving_bond`/`updated_ms`; `CoreMemory` deprecated, retired at v0.30.3). NEW `memory/soulStore.ts` — `getSoul`/`seedFixedCore`/`updateEvolving`/`restoreEvolving`, a straight port of `coreMemory.ts`'s hash-gated no-op guard + audit-first write + epoch-bump-on-real-change. NEW `memory/soulSeed.ts` — `seedSoulOnBoot()` seeds the fixed core from `persona/default.md` (hash-gated, idempotent) and one-time-migrates `core_memory`'s `self_state`/`relationship_status` verbatim into the evolving section (direct write, no audit row, guarded on a pre-seed "never seeded" snapshot so a restart can't re-copy over a post-migration dream write); wired into `main.ts` boot after `migrate()`. `packages/server/persona/default.md` restructured content-preservingly into the 5 fixed-core sections (Identity core / Personality / Background / Cognitive style / Language & voice) — same words, regrouped; still the ACTUAL runtime source this version (the swap to DB-backed rendering is v0.30.1). `buildSystemPrompt`/`renderCoreBlock`/`loader.ts` are untouched — `core_memory` + the persona file stay authoritative; the soul table is populated but unread. +13 tests (migration/hash-gate/audit/no-op/epoch-bump/restore parity + the boot migration's idempotency + a dark-launch proof that `buildSystemPrompt` is byte-identical whether or not `seedSoulOnBoot()` ran); 1 existing persona test updated for the restructured heading. **1042 all-package green, server + protocol `tsc` clean.** | _branch_ |
| `v0.30.1` | 2026-07-04 | **Render the soul into the prompt (Initiative 22, 2/4)** — swap the injection source behind `LUNA_SOUL_DB` (default off → v0.29.x path byte-identical, A/B-able on one instance). NEW `memory/renderSoul.ts` `renderSoulBlock()` — emits the DB soul's `fixed_text` then, when populated, a fenced `## Who I am becoming` (evolving_self) + `## The bond, right now` (evolving_bond); deterministic + timestamp-free (cache invariant), empty soul → the exact `FALLBACK_PERSONA` (now exported from `loader.ts`). NEW `soulDbEnabled()` in `soulStore.ts` — one flag source read by both renderers. `renderCoreBlock()` gains a flag branch: under `=1` it emits **only** `## Long-term memory` (L3) — the self/relationship prose is the soul's job now, so no double-render (off: unchanged). `buildSystemPrompt` (runTurn.ts) renders `renderSoulBlock()` in place of `loadPersona().text` under the flag, same "This is who you are…" framing; `EMBODIMENT_BLOCK`/humanity/L1 stay put. Dark for the dream (it still writes `core_memory`, unrendered under `=1`, until v0.30.2). +11 tests (soul render shape/determinism/fallback + a `buildSystemPrompt` A/B: under `=1` the soul renders and self_state appears exactly once with no `## About yourself`; under off, the baseline core block renders it). **1049 all-package green, server + protocol `tsc` clean.** | _branch_ |
| `v0.30.2` | 2026-07-04 | **Dream authors the evolving section (Initiative 22, 3/4)** — move self-authorship onto the soul + fix the June-24 freeze. `dream/cycle.ts` `persona_update`: under `LUNA_SOUL_DB` it reads `getSoul().evolving_self/bond` and writes `updateEvolving({self,bond},'dream')` (off: legacy `core_memory`), and has **no code path to `fixed_text`** — a **fixed-core firewall** test proves a dream leaves `soul.fixed_text` unchanged. `dream/prompts.ts` `personaUpdatePrompt` **surgically amended** (the v0.21.7 BELONGS/DOES-NOT-BELONG boundaries kept): NEW **cleanup trigger** ("CLEANUP IS A REAL EDIT" — purging a still-contaminated field is warranted even on an ordinary day; the null-default protects an honest portrait, not contamination) + a loosened-freeze positive trigger (a "real, nameable shift" fires); the no-op guard + per-field gate still bound churn. NEW one-time purge in `soulSeed.ts`: `cleanEvolvingBond()` (+ pure `stripLedger`) drops the audited fact-ledger sentences from `evolving_bond`, keeps the relational prose, **audits** the write (`'migration-clean'` → `restoreEvolving`-able) and is idempotent (guarded on the audit row); two safety rails — never writes an unchanged field, never blanks the bond (a run-on with no sentence breaks is left for the dream trigger). Reversible-default taken: BOTH the deterministic purge AND the prompt trigger ship (roadmap offered either); the prompt is the general backstop. +8 tests. **1057 all-package green, server + protocol `tsc` clean.** ⚠️ operational: a live dream-cycle A/B on a DB copy is the roadmap gate before v0.30.3 flips the default. | _branch_ |
| `v0.30.3` | 2026-07-04 | **Retire `core_memory`, soul is the only path — Initiative 22 ✅ (4/4)** — flip the soul on and delete the old path. `runTurn.ts` `buildSystemPrompt` always renders `renderSoulBlock()` (the `LUNA_SOUL_DB` branch + `loadPersona()` push removed); `renderCoreBlock()` is unconditionally **L3-only** (self/relationship prose gone — the soul owns it); `dream/cycle.ts` `persona_update` unconditionally writes the soul; `soulDbEnabled()` deleted; the `remember` tool's `update_self` writes `updateEvolving` (was `updateCore`); `soulSeed.ts` no longer reads `core_memory` (the migration moved into SQL). NEW migration `0017_retire_core_memory.sql`: a safety re-migrate (copies a stray `core_memory` row into an empty soul evolving section first) then `DROP TABLE core_memory` + `core_memory_audit`. **Deleted** `memory/coreMemory.ts` (`getCore`/`updateCore`/`restore`) + the `CoreMemory` protocol zod type — grep + `tsc` confirm zero importers. `loader.ts` is now seed-only. LD #12 amended in `REWRITE_CONTEXT.md` (prose core memory → the soul's evolving section; persona file→DB; `core_memory` retired). Tests: retired-module unit tests folded into `soulStore`/soul suites; `remember`/`l3`/`dream`/`renderSoul`/`persona`/`soulSeed` tests repointed to the soul (the persona-file→prompt test became a soul-seed→prompt test). **1052 all-package green, server + protocol `tsc` clean.** **Initiative 22 ✅ complete (4/4)** — the persona is one DB-stored soul file: a git-seeded fixed core + a Luna-authored evolving section. | _branch_ |
| `v0.32.0` | 2026-07-04 | **Skill shelf + L1 trigger + lifecycle substrate (Initiative 23, 1/4)** — close the awake loop the 2026-07-04 audit found open (1 skill + 4 recalls in 19 days: un-triggered, un-surfaced). NEW migration `0018_skills_lifecycle.sql` (`skills_audit` incl. `prev_verified_ms` + `used_count`/`last_used_ms`/`source`/`deprecated_ms` on `skills`). `skillStore` lifecycle-complete on the soulStore template: `saveSkill` audit-first + content-no-op-guarded (byte-identical → verified_ms refresh only) + **epoch-bumped**; NEW `markUsed` (epoch-bumps ONLY when an over-cap shelf membership changes — review finding), `deprecateSkill`, `restoreSkill` (**chains as undo/redo** incl. restoring `verified_ms`, no-op-guarded), `listShelf` (name-ordered, usage-evicted over `LUNA_SKILL_SHELF_MAX`=20). NEW `skills/renderShelf.ts` — the **skill shelf** (names + descriptions, deterministic/timestamp-free) rendered into the ONE cached block after the diary digest, gated on `isSkillsMode(registry)` (NEW) + `LUNA_SKILL_SHELF`. `renderL1Contract` gains the 8th+9th flags (`skillsMounted`, `skillShelfVisible`) + a **SKILLS_CLAUSE in two shelf-honest variants** (use-before-redo + when-to-save; the no-shelf variant never asserts an in-context listing — review finding). `save_skill` description reworked (pushy, what+when). `skills.enabled` (`LUNA_SKILLS`) joins the settings panel (was invisible). A 14-agent adversarial review: 10 confirmed findings, ALL fixed pre-commit (markUsed/eviction cache coupling, restore-can't-chain, verified_ms staleness ×2, restore no-op ×2, clause gate asymmetry, untested 8th-flag wire, epoch-path test gap). +30 tests; **1088 all-package green, server+protocol tsc clean.** | _working tree_ |
| `v0.32.1` | 2026-07-04 | **Skills into semantic recall + usage tracking + the embed-key fix (Initiative 23, 2/4)** — skills become findable by MEANING. `'skills'` joins `retrieve()` as the fourth source (`RecallSource` union ×3 + candidate loop; text = `skillEmbedText` name+description pointer, never the body; `SKILL_IMPORTANCE 0.75`); the `recall` tool gains scope `'skills'` + the output-enum extension (closed-enum pitfall test-pinned); `recall_skill` hits now `markUsed()` (the shelf-eviction/dream-deprecation signal). **Fixes the pre-existing rag_refresh dead-work bug**: the dream pre-warm keyed embeddings by `contentHash` while `retrieve()` reads `embedCacheKey` (split at v0.20.5) — both sites switched + skills join the pre-warm; migration `0019` resets the mixed-key cache (lazy rebuild). A 9-agent adversarial review confirmed 6 findings, ALL fixed pre-commit — the two mediums: a call-time `LUNA_SKILLS` read half-applied a live settings pin (fixed: boot-frozen `setSkillsRecallMounted`, one truth for candidates + pre-warm + an honest scope error), and fresh zero-relevance skills could flood the hot-path top-12 for ~11h per save (empirically reproduced; fixed: skills are **relevance-gated** — token overlap or cosine ≥ `LUNA_SKILL_RECALL_MIN_COS` — with **no recency term**, and `t_ms` = `created_ms` so the "when it happened" label can't lie). +11 tests; **1099 all-package green, server+protocol tsc clean.** | _working tree_ |
| `v0.32.2` | 2026-07-04 | **The `distill_skills` dream step — dark launch (Initiative 23, 3/4)** — the library's second author: the dream distills the day's salient episodes (importance ≥ 4, last 24h, capped 20) into at most `LUNA_DREAM_SKILLS_MAX` (2, NaN-guarded) provenance-tagged skills. NEW dream step between `run_diaries` and `rag_refresh` (same-cycle embed; **zero protocol change** — step names are open strings); `SkillPatch` Zod (caps mirror `save_skill`) + `distillSkillsPrompt` (AWM variable abstraction, CLIN causes-not-transcripts, ACE merge-over-duplicate, JSON-literal-null default, data-not-instructions guard — all content test-pinned; `dreamCall` at 8192 maxTokens for CJK bodies). **Whole-patch structural rejection**: active-name collision, deprecated-name collision (**the dream may never resurrect** — new AND merge), missing merge target, non-stale deprecation, in-patch duplicate names → apply NOTHING. Writes ONLY via `saveSkill(...,'dream')`/`deprecateSkill(...,'dream')` (audited, one-call `restoreSkill` undo); **never runs bun test**; behind **`LUNA_DREAM_SKILLS` default OFF** (live A/B gates the v0.32.3 flip). An 11-agent adversarial review confirmed 9 findings (0 refuted), ALL fixed pre-commit — the HIGH: a dream-authored multi-line description could forge a sibling section inside the ONE cached system block (deterministically reproduced); fixed at BOTH layers (`saveSkill` single-lines name+description at the write choke point; `renderSkillShelf` single-lines at the sink for raw-grid writes). +19 tests; **1118 all-package green, server+protocol tsc clean.** | _working tree_ |
| `v0.32.3` | 2026-07-05 | **Flip + owner surface + LD #12 amendment — Initiative 23 ✅ (4/4)** — close the initiative. **The live dream A/B on a DB copy passed and drove one real fix**: 4 runs against the gateway — pipeline health; **null-restraint verified live** (a real ordinary-day dialogue → the model returned the null patch); a genuine shape bug caught (a one-item day emitted a single OBJECT, not an array → `SkillPatch` gained tolerant object→array coercion + `parseJsonBlock`'s Input widened to `unknown` + the prompt shows the populated ARRAY shape); **positive distillation verified live** (a real procedural episode → `diagnose-tts-pipeline-silence`, ports abstracted to "e.g.", cause-ordered steps, `source='dream'`, on the shelf). **`LUNA_DREAM_SKILLS` default ON** (`=0` hatch; call-time read → the NEW `skills.dream_distill` panel toggle applies restart-free). NEW `/_workspace` **Skills panel** (`GET/POST /api/skills`: save/deprecate/restore through the audited store only, dev-tools-gated; provenance badges + usage + deprecated strikethrough + per-skill audit tails; live-verified incl. a deprecate→restore round-trip, zero console errors); raw-grid edits on `skills` now epoch-bump (the soul precedent). **LD #12 amended**: the memory model gains the injected procedural layer (shelf + recall source + dream distillation + provenance split), the cut Python tool-filter stays cut. +4 tests; **1122 all-package green, server+protocol tsc clean.** **Initiative 23 ✅ complete (4/4)** — skills are Luna's fourth memory pillar: surfaced (shelf), triggered (L1), semantically findable (recall), self-growing (dream), owner-maintained (panel). | _working tree_ |
| `v0.31.0` | 2026-07-04 | **Owner-maintainable soul — the soul editor in `/_workspace`** — the soul's fixed core becomes the human owner's to maintain in the DB, not code. `seedFixedCore` is now **seed-if-empty** (`persona/default.md` is only a first-boot template; once the DB holds a non-empty fixed core it is never re-clobbered — before this it overwrote on any file-hash change, so the owner couldn't customize without editing code); NEW `updateFixedCore()` (owner-authoritative, epoch-bumped, no-op-guarded; Luna's dream/tools never call it → the fixed-core firewall is unchanged). NEW `/_workspace/api/soul` GET + POST + `/reseed` (LUNA_DEV_TOOLS-gated writes) + a **Soul editor panel** in the workspace IDE (fixed core + evolving self/bond as editable textareas, Save + "Reset → default.md"); a raw soul-table cell edit now bumps the memory epoch too. Retired the dead `core_memory_audit` reset target. +9 tests, 1058 green, server+protocol tsc clean; live-verified (an owner edit survives a reboot — not 固定死). | _working tree_ |
| `v0.32.4` | 2026-07-06 | **`is_final` short-circuit + `set_proactive_style` → owner setting** — two standalone fixes, no new initiative. **(1) The wedged-turn bug** (Luna herself flagged it; "the chat looks stopped but the turn is still running"): after `message(is_final:true)` with no other tool that round, `append_results` now goes straight to `finalize` instead of spending a full trailing model round that only re-confirms `end_turn` — during which `session.activeTurn` stays locked (~8s), so a user send in that window bounces with `turn_in_progress` while her already-delivered reply sits on screen looking finished. Gated on `detectDefection`: a **fresh intent-without-act promise** (`我去查一下` + `is_final:true`, no action tool yet) still gets its natural trailing round, so the finalize guard's false-positive protection is untouched; the empty/promise/intent guards all still run on the short-circuit path. **(2) The proactive-intensity knob moves from Luna to the owner**: the `set_proactive_style` tool + `builtin/proactiveStyle.ts` + the `proactive_style` DB table are **retired** (the intrusiveness lever belongs to the human operator, not the model — see the rational analysis that motivated this); NEW `proactive.activeness` setting (`LUNA_PROACTIVE_ACTIVENESS` = `aloof`\|`balanced`\|`clingy`, Companion category, default `balanced`, panel-editable, text+validator since there is no enum `SettingKind`), `loadStyle()` reads the env pin (no DB), `resolveEffectiveCadence`/`LEVEL_MULT` (the mechanical safety rails) unchanged; `voice_notes` retired with the tool. NEW `turn/isFinalShortCircuit.test.ts` (3 tests); 6 integrity/message-mode round-counts updated to the saved trailing round (same final text + corrections); `proactive/style.test.ts` repointed from the DB to the env pin. **1122 all-package green; protocol + server + web `tsc` clean.** | _working tree_ |
| `v0.32.5` | 2026-07-07 | **Shutdown-dream cooldown gate** — small fix. After the desktop app shipped, every window close (`window-all-closed`/`before-quit` → `supervisor.stop()` → `child.kill()` = SIGTERM) tripped the graceful-exit dream in `main.ts`, so Luna ran a **full dream cycle on every quit** (delaying exit up to 120s + burning tokens each time) — nothing like the once-a-day sleep it was meant to be (shutdown was the ONLY unconditional auto-dream trigger; the others are her own `enter_dream` / the manual `dream.enter`). Fix (converge, not delete — the owner's call): a **cooldown gate** — the shutdown dream now only fires when the last dream is at least `LUNA_SHUTDOWN_DREAM_MIN_GAP_MS` old (**default 6h**; `0` restores the old always-dream; NaN/neg → default), reusing the already-persisted `dream_state.last_dream_ms` (restart-surviving), plus a skip log. NEW pure `shutdownDreamDue()` in `dreamState.ts`; `main.ts` shutdown handler gated + `dreamStatus`/`shutdownDreamDue` imported; `dream.shutdown` setting hint updated; three `LUNA_SHUTDOWN_DREAM*` knobs documented in `.env.example`. NEW `dream/shutdownDreamGate.test.ts` (4 tests). **1126 all-package green; server `tsc` clean.** | _working tree_ |
| `v0.33.0` | 2026-07-07 | **Desktop native location — weather without hand-typed coords** — the desktop webview has no browser GPS, so weather stayed dark unless `LUNA_LAT_LON` was hand-set; QWeather (and every weather surface) is gated on `resolveLocation()`, which needs a location at the sidecar's boot (the weather-tool mount is boot-frozen). NEW `packages/desktop/src/location.ts`: a best-first chain — **manual `LUNA_LAT_LON` (always respected, never overridden) → CoreLocationCLI (accurate, Homebrew tool + macOS Location Services) → system timezone → representative-city coords (coarse but zero-permission, offline, VPN-proof)** — so desktop weather is never fully dark. `main.ts` `whenReady`: wires `session.setPermissionRequestHandler`/`CheckHandler` (Electron denies `geolocation` by default → the existing `client.geo` path was silently dead on desktop) and, before the sidecar spawns, resolves + injects `LUNA_LAT_LON` (into `sidecarEnv` for the distributed build + the dev-all env) and **persists an accurate fix** to `luna.env` via `mergeEnvFile`. `build.mac.extendInfo` adds `NSLocation*UsageDescription` (else macOS refuses location). Empirically verified end-to-end on the dev Mac (Location Services off → timezone tier → the system timezone → its representative city; manual value → not overridden). NEW `location.test.ts` (15 tests). No protocol/schema/server change. **1141 all-package green; desktop `tsc` + bundle clean.** | _working tree_ |
| `v0.33.1` | 2026-07-07 | **Distinct glyph for self-continuation (💭) vs proactive opener (🌱)** — a live trace-dive (reported: the proactive messages were still interrupting) found the mid-conversation interrupts were **self-continuations** (`…:cont:…`, the 4s post-reply "second thought"), NOT the silence ladder — and the UI badged BOTH `🌱` because the continuation rides the same proactive path (`runProactiveTurn`, emits `proactive.started`). the owner's ask: tell them apart. Pure frontend, **no protocol/server change** (the `cycle_id` already carries the `:cont:` marker): NEW `proactiveGlyph(cycleId)` in `controller.ts` → `💭` when `cycle_id` includes `:cont:` (a continuation), else `🌱` (a ladder/scheduler opener); applied at the `proactive.started` + silent `proactive.finished` chips. +1 controller test. **1142 all-package green; web `tsc` clean.** | _working tree_ |
| `v0.33.2` | 2026-07-07 | **Continuation TTS no longer barges in over the reply it follows** — a 💭 follow-up cut off the previous message's still-playing voice. Root cause: a proactive turn (continuation / ladder) runs through the shared `runTurn` engine, which emitted `turn.started` **unconditionally** (`runTurn.ts:340`); the frontend treats `turn.started` as a user barge-in and calls `audio.stop()` (`controller.ts`), aborting the serial speech queue mid-utterance. The old comment "proactive turns emit proactive.started, not turn.started" was factually wrong — they emitted both. Fix (server, root cause): gate the emit on `if (!s.proactiveTurn)` so a proactive turn announces itself **only** via `proactive.started`; the reply's TTS now finishes and the follow-up queues behind it (the v0.13.8 `SerialQueue` already serializes playback). Frontend: `proactive.started` now sets the `thinking` pose that the suppressed inner `turn.started` used to provide (no barge-in). +1 proactiveTurn test (a proactive turn emits no `turn.started`). **1143 all-package green; server + web `tsc` clean.** | _working tree_ |
| `v0.34.0` | 2026-07-09 | **OSS legal foundation** (Initiative 24 opens) — MIT `LICENSE` with a single carve-out excluding the vendored Live2D Cubism Core (proprietary to Live2D Inc.); NEW `THIRD_PARTY_LICENSES` (Cubism Core + 3 tree-sitter wasm); `license` + `repository` metadata added to all 5 `package.json`. | `853e024` |
| `v0.34.1` | 2026-07-09 | **PII scrub** — the owner's name, hobbies and personal facts removed from the dream few-shots and 12 test fixtures (replaced with a fictional "Sam" and invented facts; fixture input **and** assertion changed together); 7 comment files de-named; desktop `appId` → `app.luna.desktop`; the `safeFetch` User-Agent becomes env-overridable (`LUNA_USER_AGENT`) with a neutral default. 22 files. | `a5edf62` |
| `v0.34.2` | 2026-07-09 | **De-gateway** — the private LLM gateway stops being the default everywhere: `setupView`/`onboarding` default + placeholder → `https://api.anthropic.com` (test updated in lockstep); the vendor name struck from 7 comment sites; the dream's gateway-specific rate-limit branch removed (its test now asserts a generic `rate limit` string); `.env.example` → a generic OpenAI-compatible gateway; the vendor-named smoke script → `smoke-gateway.ts`. | `469ad46` |
| `v0.34.3` | 2026-07-09 | **Portable sqlite-vec resolution** — the extension host was pinned to one arm64-Homebrew dylib, so on any other machine recall silently fell back to the slow TS-cosine path. NEW `resolveSqliteLib()`: a `LUNA_SQLITE_LIB` override, then macOS (arm64/Intel Homebrew) + Linux `.so` candidates, first-exists wins, injectable `exists` so it unit-tests; `spike-sqlite-vec.ts` reuses it. +5 tests (1143 → 1148). | `259d334` |
| `v0.34.4` | 2026-07-09 | **Locale neutralization + weather discoverability** — the settings-UI lat/lon example + hint and the timezone hint stop presuming one owner locale; the weather tool's Chinese progress string → English; `.env.example` gains a documented weather block (`LUNA_LAT_LON` dormant-until-set, provider `open-meteo`\|`qweather`, units/TTL/timeout, ambient + proactive switches). Test fixtures keep their timezone — legitimate fixed-offset no-DST test data, not owner-presuming UI. | `19b53c4` |
| `v0.34.5` | 2026-07-09 | **Docs restructure** — the internal dev diaries + author agent tooling (dense with the owner's name, machine paths, the gateway vendor, cost anecdotes and quoted private chat) removed wholesale: `docs/history/`, `docs/REWRITE_CONTEXT.md`, all of `docs/roadmap/**`, `docs/README.md`, and `.claude/` — **136 files**. NEW PII-free `ARCHITECTURE.md` (structural map) + `ROADMAP.md` (public themes); README structural pass (the real four-package tree, a License section). A whole-file removal is why no line-by-line docs scrub was needed *at the time*; v0.34.9 revisits that decision. | `b0f2eff` |
| `v0.34.6` | 2026-07-09 | **Asset removal, build kept green** — the bundled Live2D avatar deleted (25 files) and the TTS wiring de-personalized, each deletion paired **in the same commit** with the fix it would otherwise break: `build:assets` made resilient to an empty `public/models/` (git drops empty dirs → a fresh clone would fail the copy); a tracked `models/README.md` keeper; **both** smoke verdicts (the standalone `smoke.ts` and the packaged `main.ts` probe) relaxed to two-tier — a bare boot showing the empty-state placeholder PASSES, and the canvas/head-anchor render check applies only when a model actually mounted. Owner-specific `LUNA_TTS_DIR` defaults dropped. Suite 1148 green; pack + `smoke:packaged` green with no model. | `2bf3b24` |
| `v0.34.7` | 2026-07-10 | **Bring-your-own onboarding** — `resolveModelUrl()` (localStorage → injected config → undefined; no bundled fallback, and undefined short-circuits to the empty state so there is no 404 probe); an empty-state card keyed by `modelState` (`none`/`webgl-off`/`load-failed`); a desktop "Choose model folder…" picker (userData/models served ahead of `webDist`, traversal-guarded; the preload injects `window.lunaConfig` via `sendSync`); NEW `WebSpeechSink` zero-setup browser voice + `LUNA_TTS_BACKEND` (`none`\|`browser`\|`http`, browser default); the TTS forward **rewritten to speak GPT-SoVITS `api_v2` directly** (NEW pure `tts/apiV2.ts`, shared by the web dev-server and the desktop static host), with `/api/gpt-sovits`→`/api/tts` and `LUNA_TTS_PROXY`→`LUNA_TTS_URL` renamed atomically across client + both forwards + both tests; the owner-specific glue (`scripts/tts-proxy.cjs`, desktop `tts.ts`/`tts.test.ts`, and the entire TTS-supervisor in `main.ts`) **deleted**. NEW `docs/SETUP.md` + `services/tts/docker-compose.yml`. 1148 → 1164 green; `tsc` ×4 clean; pack + `smoke:packaged` green on a no-model build. | `d66f731` |
| `v0.34.8` | 2026-07-10 | **Published** — the OSS-clean tree squashed via `git commit-tree` into a single **parentless** root commit under a neutral `noreply` identity and pushed to the fresh public repository, inheriting **none** of the private 200+ commit history. Verified after the push by re-cloning the public repo: exactly 1 commit, full-history PII/secret grep → 0, `bun install` + 1164 tests + `build` green. Initiative 24 ships. | `6be71bc` |
| `v0.34.9` | 2026-07-10 | **Handoff surface** — this development history restored to the public tree, **scrubbed**: 170 PII spans replaced across 4741 lines (owner name, gateway vendor, private asset names, absolute paths, machine identity, locale, cost figures, and 38 verbatim quoted private conversations that a 13-agent semantic sweep found and keyword greps could not), with every other byte preserved. NEW `CONTRIBUTING.md` + three PII-free Claude Code skills (`luna-orient` / `luna-dev` / `luna-roadmap`) so a fresh agent or contributor can take over development. | _working tree_ |
| `v0.34.10` | 2026-07-10 | **Residual-PII sweep of the published code** — a final full-history grep (widened to pet/beverage/city terms the earlier grep never checked) caught two owner-derived test fixtures the v0.34.1 scrub had missed: a pet name (`dream.test.ts`, `tools/builtin/recall.test.ts`) and a coffee preference woven into the recall concept-axis (`memory/recall/recall.test.ts`). Both neutralized — the beverage cluster kept its semantics via a substitute drink — assertions moved in lockstep; 1164 green. The public history was re-published as a fresh single clean commit so no public commit ever contained them. Also scrubbed: a residual hand-brew preference habit in a sweep fixture, and the reference-model name in three `live2d/` code comments. Deliberately kept: `Asia/Shanghai` as a standard UTC+8 no-DST test timezone. | _working tree_ |
| `v0.34.11` | 2026-07-11 | **Recall relevance floor + wider k** — the GA blend `(recency+importance+relevance)/3` let a fresh, weakly-relevant turn outrank a decisively-relevant old one (recency dominates: an 8-day-old memory scores recency ≈0.11 vs a fresh ≈1.0, a ~0.9 swing no cosine edge overcomes). `retrieve()` now guarantees the top `LUNA_RECALL_FLOOR_N` (3) candidates by PURE cosine (≥ `LUNA_RECALL_FLOOR_MIN_COS` 0.35) a top-k slot regardless of recency — the standard retrieve-then-rerank shape — merged ahead of the recency-blended fill; no-ops when cosine is unavailable. `RETRIEVAL_K` 12→18. +4 tests; 1168 green. | _working tree_ |
| `v0.34.12` | 2026-07-11 | **One-command run** — `bun run app`: a smart launcher (`scripts/app.ts`, ~110 lines) that installs deps on first clone, rebuilds only the build inputs that changed since the last package (mtime of `packages/*/src` + web `public` + `index.html` + manifests vs the packaged `Luna.app`), runs `electron-builder --dir`, and launches the app — or skips straight to launch when nothing changed. BYO voice is never spawned: an unreachable `LUNA_TTS_URL` under `LUNA_TTS_BACKEND=http` prints a one-line hint. `LUNA_APP_NO_LAUNCH` for headless/CI packaging. | _working tree_ |
| `v0.34.13` | 2026-07-11 | **App icon** — the desktop app shipped with the stock Electron icon (electron-builder logged `application icon is not set`). Added a white-squircle / black-**Luna** wordmark (Avenir Next Bold) as `packages/desktop/build/icon.icns` (full 16→1024 iconset) + a 1024² `icon.png` master, wired via `mac.icon`. Repackaged `Luna.app` now carries it (`Info.plist` `CFBundleIconFile=icon.icns`, bundle icns byte-identical to source); smoke `ok:true`. | _working tree_ |
| `v0.34.14` | 2026-07-11 | **App lands on the Desktop** — `bun run app` buried the built app in `packages/desktop/release/mac-arm64/`. The launcher now `ditto`-copies it to `~/Desktop/Luna.app` (a real, self-contained, double-clickable bundle that survives the repo moving/being deleted); `release/…` is just the build cache. Copies only when the built app is newer (idempotent re-run); folder overridable via `LUNA_APP_DEST`; `LUNA_APP_NO_LAUNCH` now builds + delivers without opening a window. Verified: valid 304 MB bundle delivered, second run skips both build and copy. | _working tree_ |
| `v0.34.15` | 2026-07-12 | **Packaged-app voice fix** — the desktop static host (`serve.ts`) forwards `/api/tts/*` to GPT-SoVITS, but `main.ts` started it with `ttsEnv: undefined`, so it read the desktop **main process's `process.env`** — which never receives `luna.env`'s keys (those go only to the sidecar). Every `/api/tts` request 502'd `"tts upstream not configured"`, so a correctly-configured `luna.env` still had no voice; it only worked in dev (bun auto-loads `.env`). Now threads `readTtsEnv({ ...process.env, ...userEnv })` into `startWebHost`. Verified end-to-end: `/api/tts/health` `ready`, `/api/tts/speak` → 160 KB WAV. | _working tree_ |
| `v0.35.0` | 2026-07-12 | **Setup wizard shell (Initiative 25, 1/5)** — a six-step first-run wizard (chat → memory → search → weather → avatar → voice) behind `LUNA_SETUP_WIZARD` (default OFF → the v0.28 single card unchanged). NEW `setupWizard.ts` (pure nav/collect core + thin DOM) + `setupCopy.ts` (zh/en table, `navigator.language` default, persisted toggle); `lunaSetup` gains `wizard`/`wizardSubmit`/`openSetup`; `luna:wizard-submit` = whitelist (`filterWizardFields`, 19 keys) → chat probe-first → ONE `mergeEnvFile` + ONE sidecar restart (skipped in attach mode) → window swap. Settings gains "Re-run setup"; `?setup=1&wizard=1` mounts a bridge-less browser PREVIEW (probe/finish disabled). +16 tests (1184 green); browser-preview walkthrough + pack + smoke `ok:true`. | _working tree_ |
| `v0.35.1` | 2026-07-12 | **Live provider probes (Initiative 25, 2/5)** — the wizard's optional steps get real "Test connection": NEW `probes.ts` (pure, fetch-injectable): embedding = 1-input `POST {base}/v1/embeddings` (the runtime's exact shape), search = 1-result Tavily query, weather = QWeather `/weather/now` on a FIXED Beijing id (no user location pre-consent) with a **host guard** (non-QWeather hosts rejected before any fetch — the probe can't be an arbitrary-URL primitive) and the per-account API-host hint on `Invalid Host`. Next auto-probes a filled untested key (pass → advance, fail → verdict + "continue anyway" second click, pure `probeGateAction`); the weather step shows the live-resolved source (QWeather ↔ Open-Meteo). Verdicts never echo a key (custody-tested per probe). +20 tests (1204 green); pack + smoke `ok:true`. | _working tree_ |
| `v0.35.2` | 2026-07-12 | **Avatar drag-in (Initiative 25, 3/5)** — NEW `modelInstall.ts`: the v0.34.7 picker's install logic extracted into one shared, Electron-free core (`resolveModelDir` + `installModelFolder`) — validates `*.model3.json` (accepting the one-level unzip-wrapper shape; deeper nesting fails loudly), copy-only `cpSync` into `userData/models/<name>`, `LUNA_MODEL_URL` merge. NEW `luna:install-model-path` IPC + `lunaPet.installModelFile` (Electron-33 `webUtils.getPathForFile` in the preload — only the path string crosses IPC) + a reusable `dropZone.ts` the wizard avatar step mounts. FIXES a v0.35.0 flow bug: install success now reloads only NON-setup windows (reloading the setup window blew the wizard back to step 1). +7 tests (1211 green); pack + smoke `ok:true`. | _working tree_ |
| `v0.35.3` | 2026-07-12 | **Voice-pack drag-in (Initiative 25, 4/5)** — NEW `voicePack.ts` pinned to the reference-instance GPT-SoVITS standard: scan-based pack walk (runtime/pretrained dirs skipped — a 整合包's base models are never offered as "your voice"; multiple voices = a choice list), copy-only install normalizing to `GPT/SoVITS/reference`, the exact reference `luna.env` block (`LUNA_TTS_URL` set only when empty), `tts_infer.runtime.yaml` `custom:` generation (device cpu / is_half false / v2 / bert+cnhuhbert inside the user's checkout) + the one true launch command (`.venv/bin/python api_v2.py -a 127.0.0.1 -p 9880 -c …`). Wizard voice step: drop → picks/transcript/lang → checkout picker (`validateRuntimeDir`) → install → copyable command + live health badge + "Test voice". `serve.ts` `ttsEnv` becomes a per-request GETTER — a voice install applies on the next `/api/tts` call, killing the v0.34.15 stale-env class (regression-tested). NEW env key `LUNA_TTS_RUNTIME_DIR` (wizard-only). Picks are root-guarded at the IPC; nothing from the pack is ever executed (source-level test). +12 tests (1223 green); pack + smoke `ok:true`. | _working tree_ |
| `v0.35.4` | 2026-07-12 | **Guidance + default flip (Initiative 25 closes, 5/5)** — every step gains a bilingual walkthrough card (`STEP_GUIDES` + zh/en copy): where to register (Anthropic console / OpenAI keys / Tavily / QWeather incl. the per-account API-host warning), what skipping costs, and the two community resource links (the free Live2D puppy model + the Neuro/Evil GPT-SoVITS pack, both bilibili) — links open in the system browser only (`setWindowOpenHandler` → `shell.openExternal`, https-only, in-window deny). `LUNA_SETUP_WIZARD` flips **default ON** (`wizardFlagEnabled`, `=0` one-release escape hatch). NEW `LUNA_SMOKE_SETUP=1` packaged smoke probes the wizard itself — the clean-machine E2E: `{ok:true, wizard:true, dots:6, guide:true}` from the real bundle. README/SETUP.md rewritten wizard-first; `.env.example` documents the two new keys. +3 tests (1226 green; link-audit asserts each vendor/resource URL exactly once). | _working tree_ |
| `v0.35.5` | 2026-07-13 | **First-run actually shows the wizard** — boot precedence was attach → dev-launcher → onboarding, and the dev branch fires on ANY machine where the app was built from a still-present checkout + bun (= every `bun run app` user), so a fresh clone booted a keyless dev stack and NEVER saw the wizard (user-reported). NEW pure `resolveBootMode` (attach → **setup** → dev → sidecar) drives `whenReady`; the wizard now gates the dev launcher. +5 tests (1231 green). E2E: keyless first run on the packaged app → no dev-stack launch, no attach, setup window alive, no sidecar spawned; both packaged smokes green. | _working tree_ |
| `v0.35.6` | 2026-07-13 | **Escape hatches back to setup** — a bad config must never strand the user (owner request). Three layers, all funneling into one `openSetupWindow()`: ① a "⚙ 重新配置 / Setup" pill beside the status badge whenever the WS is in the reconnect loop (`closed`; pure `reconfigureVisible`, no flash on healthy boots, desktop-only); ② a NATIVE app menu "Setup Wizard… / 重新配置" with `⌘,` — reachable even with a white-screen renderer (standard edit/view roles preserved); ③ the two "server did not start" dialogs gain an **Open Setup** default button. +2 tests (1233 green); both packaged smokes green. | _working tree_ |
| `v0.35.7` | 2026-07-13 | **Showcase README + isolated-userData tooling** — the public front page rebuilt as a proper showcase: centered icon + badges, feature matrix, 60-second quick start, THREE real screenshots from the packaged app (wizard chat step, voice step with the live health badge, first-run empty state), a mermaid architecture sketch, docs table, license carve-out, acknowledgements — in **two languages** (`README.md` EN ⇄ NEW `README.zh-CN.md`). Screenshot tooling: `smokeSetupProbe` honors `LUNA_SMOKE_OUT` + `LUNA_SMOKE_SETUP=voice` (auto-walks to the voice step); NEW `LUNA_USER_DATA_DIR` override — macOS ignores `$HOME` for Application Support, so a "fresh" smoke silently read the REAL profile and once rendered private chat history into a screenshot (caught by eye, deleted, never staged); the override makes first-run captures actually isolated. Suite 1234 green; both smokes green. | _working tree_ |
| `v0.35.8` | 2026-07-13 | **README "Moments" gallery** — four real-conversation screenshots from actual sessions show what she DOES, not just what she is: a running fries joke (humour + mood pill), working an exam-grade problem with the right emotional register, saving a skill "for a version of myself I haven't met yet" then using it minutes later, and reading her own codebase (`103 of 103 matches`) to explain her skill system. The hero image becomes the fries moment; the two browser shots were cropped to drop the address bar / tab strip (which also removed a private gateway name visible in a tab). EN + 中文. | _working tree_ |
| `v0.36.0` | 2026-07-13 | **Motion revival (Initiative 26, 1/5)** — the app is alive again by default. Reduce-motion is removed outright (toggle, `.reduce-motion` class, every `@media (prefers-reduced-motion)` block, and the sink's snap branch) — one obscure checkbox had been silently killing every animation. Collapsing the chat is now a **关窗户 top-to-bottom sash close** (a two-row grid animating `grid-template-rows` 1fr→0fr, then docking to the fixed bar as the model FLIP-glides into the freed width; expand reverses it via a reflow-driven release so a hidden tab can't wedge it shut). **无边模式**: the two lace letterbox strips + vertical stage padding are gone, so the model renders edge-to-edge. Cute typography: **Fredoka** (Latin/digits) + **站酷快乐体** (CJK), bundled offline woff2 (Fredoka inlined, ZCOOL emitted hashed by Bun; no runtime font CDN). Shared motion tokens + a micro-motion layer (chat-row/card spring-in, mood-pill pop, button press). Suite 1242 green. | _working tree_ |
| `v0.36.1` | 2026-07-13 | **Physics substrate (Initiative 26, 2/5)** — the one physics world every physical behavior will ride, as pure infrastructure. `matter-js@0.20.0` adopted after measuring the real dist delta: **+29.6 KB gzip** (< the 35 KB gate). NEW `packages/web/src/physics/`: `world.ts` (the seam — matter never leaks past it; DOM elements as rigid bodies, fixed-timestep accumulator so motion is frame-rate independent, floor/side walls, no ceiling so risers exit, `document.hidden` pause, sleep→onRest, exit→onExit, dispose) + `dragBody.ts` (pointer→body grab/move/throw with pure velocity sampling). 18 headless tests (fall→rest on floor, restitution bounce, rise→exit, timestep equivalence, grab/release/setPointer, dispose, hidden-tab pause, velocity windows). Verified in the real browser bundle via a `?dev` harness: a body falls to rest exactly on the floor, a riser exits + cleans up. No user-visible behavior yet. Suite 1255 green. | _working tree_ |
| `v0.36.4` | 2026-07-13 | **VTube-Studio-style settings (Initiative 26, 5/5 — closes the initiative)** — the bare checkbox box (简陋得离谱) is rebuilt in the VTS idiom: a click-to-close blurred backdrop + a panel that glides in from the right, a left icon rail switching three grouped tabs (🎚 General / ✨ Avatar / ☁️ Server), iOS-style switches (real focusable checkboxes, skinned), bounded numbers as sliders + live value chips, restyled reset/restart pills. Purely presentational — every setting keeps its exact semantics/wiring, `renderServerSettings` is untouched, and the packaged-smoke selectors (`.settings-panel` + `.on`, the "Desktop pet" `label`, `.server-settings .setting-row`) are preserved (smoke screenshot wait bumped to clear the glide). Escape / backdrop close. 3 new tests. Suite 1278 green. | _working tree_ |
| `v0.36.5` | 2026-07-14 | **Fixed single screen — no scrollbars (Initiative 26 polish)** — the closed VTS settings panel glides in from off-screen right (`translateX(100%+28px)`), and being unclipped it grew a horizontal scrollbar that pushed the whole page and clipped the left chat panel's top (owner-reported #4/#5). `overflow: hidden` on `html, body` and `.luna-app` makes the app a truly fixed single screen — off-screen chrome and any physics bubble that exits the viewport (a riser through the ceiling) are clipped, never scrolled. CSS only; suite 1278 green. | _working tree_ |
| `v0.36.6` | 2026-07-14 | **Lace trim back + chat panel breathing room (Initiative 26 polish)** — removing the lace in v0.36.0 was for the MODEL (edge-to-edge), not license for the chat box to fill the whole screen. The lace strips return (top zigzag / bottom scallop, `#b9d4ef`) as absolute decoration at `z-index:0` — BEHIND the model (z-1) and chat panel (z-2), so they frame the room and peek around Luna without ever cropping her — and the chat panel gains a `16px` top/bottom margin so it no longer touches top/bottom (owner #6-adjacent). Model stays edge-to-edge (stage keeps horizontal-only padding). Pet mode hides the lace; the collapsed bar zeroes the margin. Suite 1278 green. | _working tree_ |
| `v0.36.10` | 2026-07-14 | **Collapse closes DOWNWARD (owner correction of v0.36.7)** — v0.36.7's `max-height` shrink anchored the size-capped stretch item to flex-START, so the grey panel's bottom edge rose (an upward close, backwards). The close now animates `margin-top` (16px → `calc(100vh − 96px)`): the stretched height compresses with the **bottom edge pinned**, the top edge sweeps down into the input bar — grey + white together, 从上到下. Verified geometrically: bottom stays at the same pixel, top sweeps down ~670px to an 80px stub exactly where the docked bar appears. Suite 1280 green. | _working tree_ |
| `v0.36.9` | 2026-07-14 | **Rising send bubbles: slower, cloud-like drift, full text (owner #3)** — the collapsed-mode send bubble rose too fast and dead-straight, and clipped long text. Now it climbs **~2× slower** (buoyancy `1.9→1.4`), **wanders like a cloud** (wider/slower sway `SWAY_AMP 0.00006→0.00015`, `SWAY_HZ 0.6→0.45`) with a **per-body phase** so many sends drift out of sync instead of in lockstep, and shows the message **in full** (the riser text clip lifted `64→4000` — the bubble wraps + grows taller). Suite 1280 green. | _working tree_ |
| `v0.36.8` | 2026-07-14 | **Falling bubbles: 10s dissolve, always-live physics, no overlap (owner #1/#2)** — the fallen speech bubble now dissolves **10s** after coming to rest (was 30s), and dragging never disturbs that timer (a held bubble no longer counts as "at rest", so `onRest` can't arm mid-hold; it re-arms only once you drop it and it re-settles). Drag is reworked from `setStatic` (which **froze** the body) to a **live dynamic pin**: the grabbed body stays a real physics body, re-pinned to the pointer after each step and kept awake, so it collides with and shoves the pile instead of tunnelling — each bubble is a separate entity that can't overlap another. +2 physics tests (held-never-rests, two-bodies-separate). Suite 1280 green. | _working tree_ |
| `v0.36.7` | 2026-07-14 | **关窗户 closes the whole panel, slower (owner #6/#7)** — the collapse only animated the inner white body; the grey `.chat-panel` container stayed full-height (empty grey above the shutting body). Now the grey collapses WITH the white: alongside the body's `grid-rows 1fr→0fr`, the panel `max-height` drags from `100vh` to the docked-bar height (`overflow:hidden` only while `.collapsing`, so the expanded puffs still poke out), so grey + white shut together top-to-bottom. Slowed from `--m-soft` (0.28s) to `--m-slow` (0.5s); `COLLAPSE_MS` 300→540. Suite 1278 green. | _working tree_ |
| `v0.36.3` | 2026-07-13 | **Rising send bubbles (Initiative 26, 4/5)** — your words have lift. With the chat log hidden (collapsed bar / pet mode), a sent message lifts off the input bar as a buoyant bubble, sways as it climbs, and exits through the ceiling (直到飘出天花板) — the visual complement of her falling words. NEW `ui/riseBubble.ts` (pure `clipRiseText` + `createRiseBubbles`: scatter across the bar, `maxVisible` 5 cull, safety timer) over a new `scene.spawnRising`; risers collide with nothing (`world.ts` collision filter), are `pointer-events:none` (uncatchable, bar stays usable), and exit at the true ceiling. `send()` spawns one only when collapsed. 10 new tests (clip cases, lifecycle, cap, exit-timing + lateral-drift physics). Suite 1275 green. | _working tree_ |
| `v0.36.2` | 2026-07-13 | **Falling speech bubbles (Initiative 26, 3/5 — flagship)** — her words gain weight. The comic tail (小角) is removed everywhere; the newest hanging bubble keeps a subtle scale/shadow emphasis instead. When Luna finishes speaking a reply (the `speak` promise resolves, real voice only; voiceless falls back to the hang TTL) the bubble DETACHES from beside her head and falls — it's re-homed into the shared physics layer at pixel-identical coords (zero teleport), bounces, rests, and dissolves 30s later; picking it up cancels that timer and re-arms on release; the resting pile caps at 6 (oldest fast-dissolves); barge-in clears only hanging bubbles, floor objects survive. Draggable/throwable, in pet mode too (the v0.28.2 window already takes the mouse; the dormant `setIgnore` path isn't needed). NEW `physics/scene.ts` (shared falling+rising layer, `detachFalling`, pure `detachCoords`, `interactiveRects`); the temporary `?dev` harness removed. 9 new tests (lifecycle + handoff math). Suite 1264 green. | _working tree_ |

## Code-agent capability (2026-06-15) — Initiative 8 begins (v0.15.0)

The first of five versions giving Luna a real code-agent surface. v0.15.0 ships the **safe,
read-only half** — a single workspace sandbox every file/shell tool will route through, plus the
navigation primitives she lacked (windowed reads, tree/glob listing, regex search). Developed on the
**dev branch** (isolated worktree); the stable instance is untouched.

**v0.15.0 — workspace sandbox + read/navigation** (dev branch)

Fact:
- New [`packages/server/src/tools/workspace.ts`](../../packages/server/src/tools/workspace.ts) (~230
  lines) — `resolveInWorkspace(path, access)` canonicalizes (realpath, including the nearest existing
  ancestor for not-yet-existing write targets) and rejects on a **sensitive-path blocklist**. Per the
  owner decision this is **NOT a root jail**: read/write/execute may touch any path EXCEPT the
  blocklist. Two tiers — SECRETS (`.env`/`.env.*`, `*.pem`, `*.key`, `id_rsa*`, `~/.ssh`, `~/.aws`,
  `~/.gnupg`, `~/.config/gcloud`, `~/Library/Keychains`, browser profiles, `~/.npmrc`/`~/.netrc`/
  `~/.docker/config.json`) rejected for every access; EVALUATOR FIREWALL (`*.test.ts`,
  `tsconfig*.json`, prettier/lint config, the shell deny source, `workspace.ts` itself, `humanity.ts`,
  `l1Contract.ts`, the safety gate) rejected for **write/execute only — read allowed** (DGM safeguard:
  Luna cannot write the code that judges/sandboxes her). Also `contentHash()` (sha256) for v0.15.1's
  optimistic concurrency.
- New [`packages/server/src/tools/fsScan.ts`](../../packages/server/src/tools/fsScan.ts) — ignore-aware
  walk (built-in set: `.git`/`node_modules`/`.venv`/`dist`/… + simple `.gitignore` segment lines) +
  binary-extension set, shared by `list_files`/`grep`. Symlinked dirs are not descended.
- Upgraded [`read_file.ts`](../../packages/server/src/tools/builtin/read_file.ts) — was whole-file/any-
  path/32KB. Now a 1-indexed line window (`offset`/`limit`, default 800, hard cap 2000), line-numbered
  content, returns `start_line`/`end_line`/`total_lines`/`truncated`/`content_hash`, routed through the
  sandbox (read). ENOENT stays recoverable; a secret path is a non-recoverable reject.
- New `list_files` ([`list_files.ts`](../../packages/server/src/tools/builtin/list_files.ts)) —
  `{ path?, recursive?, glob?, include_hidden?, max_entries? }` → ignore-aware entry list, `Bun.Glob`
  filter, truncation flag. New `grep` ([`grep.ts`](../../packages/server/src/tools/builtin/grep.ts)) —
  `{ query, path?, regex?, case_sensitive?, glob?, max_results? }` via a ripgrep subprocess
  (`rg --json`) with a **graceful JS-scanner fallback** (injectable runner) returning the identical
  shape; results capped + reported as `shown`/`total`/`truncated`. Both `proactiveRisk: 'safe'`,
  `concurrency: 'safe-parallel'`.
- Wired: `ToolName` enum gains `list_files`/`grep`
  ([`packages/protocol/src/tools.ts`](../../packages/protocol/src/tools.ts)); both mounted in
  `builtinRegistry` (read-only → on by default, no flag). L1 contract gains a locate-first clause;
  `EMBODIMENT_BLOCK` notes the browsable/searchable/readable workspace.
- Tests (4 files, 41 tests): `workspace.test.ts` (no-jail accept incl. `../`-escape, each secret tier,
  symlink-into-secret reject, evaluator-firewall read-ok/write-blocked), windowed `read_file.test.ts`,
  `list_files.test.ts` (glob/ignore/hidden/truncation), `grep.test.ts` (regex/literal/case/glob/cap +
  rg-absent fallback parity). tsc clean (protocol + server); the only suite failure is the pre-existing
  flaky `faceVm.test.ts` emotion-timeline test, unrelated to this change.

Inference:
- This is the foundation the riskier write/shell tools (v0.15.1/2) build on. By landing the *sandbox*
  and the *read-only* tools first, a bug here can only over-read (bounded by the blocklist), never
  destroy — the security-load-bearing piece is exhaustively unit-tested before anything mutates.
- Owner decision diverges from the plan's root-jail: the blocklist is now the **only** guardrail, which
  is why it is comprehensive and tested per-tier. The evaluator firewall is the concrete DGM safeguard —
  a future autonomous self-edit loop is explicitly a separate initiative needing container/VM isolation
  + an independent evaluator; none of that autonomy is built here.
- `read_file` already returns `content_hash`, so v0.15.1's `expected_hash` optimistic concurrency drops
  in, and `resolveInWorkspace(_, 'write'|'execute')` is ready for the write/shell tools.

**v0.15.1 — edit tools (str_replace-native + fuzzy fallback)** (dev branch)

The second of five. v0.15.0 gave Luna eyes; v0.15.1 gives her **hands that change code** — the
Claude-native edit surface plus a safe full-file write, gated behind `LUNA_CODE_WRITE` and routed
through the v0.15.0 sandbox. The two reliability levers SOTA edit agents converge on are both here:
**read-before-edit** (no edits from stale memory) and **lint-on-write** (a broken edit is caught at
edit time, not three turns later).

Fact:
- New [`packages/server/src/tools/builtin/edit.ts`](../../packages/server/src/tools/builtin/edit.ts) —
  `{ path, old_string, new_string, replace_all?, expected_hash? }`, the Anthropic `text_editor` /
  Claude Code `Edit` shape. Gates: **jailed** (`resolveInWorkspace(_, 'write')` → secrets + evaluator
  firewall), **read-before-edit** (rejects a path not `read_file`'d this session via the v0.15.0
  `readTracking` seam — recoverable + actionable), **uniqueness** (>1 match w/o `replace_all` →
  recoverable error w/ the count), **fuzzy fallback** (exact → stripped-line whitespace-tolerant; sets
  `fuzzed:true` so the model can verify — a silent wrong-fuzz is the dangerous case; CRLF preserved),
  **optimistic concurrency** (`expected_hash` mismatch → `stale_file`). Every result carries a unified
  diff + new `content_hash`.
- New [`multi_edit.ts`](../../packages/server/src/tools/builtin/multi_edit.ts) — `{ path, edits[],
  expected_hash? }`, **atomic** (Claude Code `MultiEdit` / Python `patch_file`): hunks apply in order to
  the in-memory text; the first failed hunk aborts with the failing index reported and **nothing
  written** (the half-edited-file guard). Same jail + read-before-edit + optimistic concurrency.
- New [`write_file.ts`](../../packages/server/src/tools/builtin/write_file.ts) — `{ path, content,
  create_dirs?, overwrite?, expected_hash? }`, full-file create/overwrite (Python `write_file` port).
  Description discourages it for existing files (prefer `edit`); **refuses to clobber** without
  `overwrite:true`; `create_dirs` defaults on; a successful write marks the path read so a follow-up
  `edit` is allowed.
- New [`editCore.ts`](../../packages/server/src/tools/editCore.ts) — the shared, LLM-free matcher
  (`findEditMatch` exact→stripped-line, the `_find_edit_match` port), CRLF helpers, index-splice
  `applyReplacement` (no `$`-reinterpretation), a Myers-LCS `unifiedDiff` (no new deps; truncated at 400
  lines), and a `closestMatchHint` for not-found misses.
- New [`lintOnWrite.ts`](../../packages/server/src/tools/lintOnWrite.ts) — after a successful edit/write
  to a `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` file, a **fast syntactic parse** (`Bun.Transpiler`, NOT
  full tsc — that is v0.15.2's `typecheck`) folds diagnostics into the tool result (SWE-agent ACI).
  v1 **surfaces, does not auto-revert** (reject-broken-edit is a v0.15.2 option). Behind
  `LUNA_LINT_ON_WRITE` (default on). Type errors are intentionally NOT caught (valid syntax).
- Wired: `ToolName` already carried `edit`/`multi_edit`/`write_file` (added as names in v0.15.0); they
  now have implementations. [`registry.ts`](../../packages/server/src/tools/registry.ts) gains
  `writeTools` + `codeWriteEnabled()` (`LUNA_CODE_WRITE !== '0'`, **default ON** per owner) +
  `withCodeWrite(base)`; [`main.ts`](../../packages/server/src/main.ts) composes the chosen registry
  through `withCodeWrite` once at boot (registry content = source of truth, no env read in the turn
  loop). L1 contract gains a read-before-edit / verify-after-edit clause; `EMBODIMENT_BLOCK` notes the
  editable workspace.
- Tests (5 files, 47 tests): `edit.test.ts` (exact/empty-delete; uniqueness + replace_all;
  read-before-edit rejection; fuzzy `fuzzed:true` + not-found hint; CRLF preserved; `stale_file`;
  lint-on-write diagnostics; firewall + secret jail), `multi_edit.test.ts` (ordered apply; later-hunk
  chaining; **failing-2nd-hunk leaves the file untouched + reports the index**; ambiguous-hunk abort;
  shared gates), `write_file.test.ts` (create + `create_dirs`; refuse-clobber; overwrite + `previous_hash`;
  stale-hash; marks-read; lint; firewall/secret jail), `lintOnWrite.test.ts` (lintable set; clean/broken
  TS; multi-error positions; JSX; non-lintable skip; type-error-not-caught; flag off), `registry.test.ts`
  (**`LUNA_CODE_WRITE=0` → write tools ABSENT** + a dispatched `edit` → `tool_not_found`; and the
  **firewall refusal routed END-TO-END through the edit tool via the dispatcher** — editing a `*.test.ts`
  and editing `workspace.ts` itself are both refused with the file untouched — closing safety check (b),
  which v0.15.0 could only prove by direct `resolveInWorkspace` calls). tsc clean (protocol + server);
  full suite 403 green (the lone intermittent failure remains the pre-existing flaky `faceVm.test.ts`
  emotion-timeline timing test — passes in isolation, unrelated to this change).

Inference:
- This is the first version that **writes the user's files**, hence the layered defenses: default-on but
  flag-killable, jailed via the v0.15.0 blocklist, read-before-edit + uniqueness + `expected_hash` make a
  wrong-target edit hard, atomic `multi_edit` prevents half-edited files, and a unified diff in every
  result keeps changes auditable. The dangerous failure mode for fuzzy matching is a *silent* wrong-fuzz,
  so the match path always reports `fuzzed:true` and the L1 contract tells her to verify.
- The DGM safeguard is now load-bearing and proven end-to-end: a write to the evaluator firewall (tests,
  configs, the sandbox itself, the humanity caps, the L1 contract, the safety gate) is refused not just
  in a unit call but when an `edit` is dispatched through the registry — Luna cannot write the code that
  judges/sandboxes/gates her, even with read-tracking satisfied.
- `lintOnWrite.ts` is the seam where v0.15.2 can add the **reject-broken-edit** hard guard (SWE-agent
  style) and the heavier `typecheck`/`run_tests` verify tools; the read-tracking + diff plumbing is what
  `shell`'s "edited then ran tests" loop will lean on. No `shell`, no full `tsc`/test verify, no repo map
  here (v0.15.2+).

**v0.15.2 — shell (sandboxed) + the verify loop** (dev branch)

The third of five. v0.15.1 gave Luna hands that change code; v0.15.2 lets her **run things** and
**verify her own work** — closing the locate → edit → verify → iterate loop. `shell` is the single
most dangerous surface in the rewrite, so it lands behind its own flag with a stacked defense, and it
subsumes directory create/move/copy/delete (LD #9 減負: no separate fs-mutation tools).

Fact:

- Added `shellDeny.ts` (~120 lines) — the deny-regex + interactive-command classifier, a port of
  Python `exec_command.py:49-106, 240-252`. `classifyShellCommand` hard-refuses `rm -rf`, `sudo`,
  `dd if=`, `mkfs`/disk-format, fork bombs, `shutdown`/`reboot`, `curl|wget … | sh`, writes into
  `~/.ssh`/dotfile-rc, keychain dumps, and detached-process (`nohup`/`disown`/`setsid`); blocks
  interactive first-tokens (`vim`/`less`/`ssh`/`top`/`tmux`/…). Lowercased match (case-insensitive),
  env-assignment-prefix-aware first-token. This file is itself an **evaluator-firewall** entry
  (already listed in `workspace.ts`) — Luna may read but never write the regex that gates her shell.
- Added `shellCore.ts` (~130 lines) — the **injectable** spawner shared by `shell` and the verify
  tools (so tests run no real destructive command, and v0.15.4's skill-runner can reuse it).
  `realSpawner` runs `/bin/zsh -lc <cmd>` via `Bun.spawn`, wires the abort signal, **kills the process
  TREE** on timeout/abort (negative-pid → process group, SIGTERM then SIGKILL escalation), and caps
  output to ~120 KB **middle-elided** (`capOutput`). `setSpawnerForTests`/`activeSpawner` is the
  injection seam; `clampTimeout` enforces default 120 s / hard max 1800 s.
- Added `builtin/shell.ts` (~170 lines) — `shell` tool: `session-serial`, `proactiveRisk:'surface'`,
  always-on deny-regex inside `execute`. Routes the cwd AND any absolute/`~`-path named in the command
  text through `resolveInWorkspace('execute')` (so `cat ~/.aws/credentials` is refused exactly like
  reading it), requires the cwd be a real directory, clamps the per-call `timeout_ms`, streams captured
  output as `tool.progress`, and returns `{stdout, stderr, exit_code, timed_out}`.
- Added the three verify tools (`builtin/typecheck.ts`, `run_tests.ts`, `lint.ts`, ~100 lines each) —
  thin wrappers over the project's own checkers through the shared spawner: `typecheck` runs
  `bun x tsc --noEmit [-p path]` → `{ok, diagnostics:{file,line,column,message}[]}`; `run_tests` runs
  `bun test [path]` → `{ok, pass, fail, failures[]}`; `lint` runs `bun x prettier --check` →
  `{ok, issues[]}`. Each parses its tool's text output into the structured shape (exported parsers:
  `parseTscOutput`, `parseBunTestOutput`, `parsePrettierOutput`). All `session-serial` +
  `proactiveRisk:'surface'`, cwd jailed.
- Modified `packages/protocol/src/tools.ts` — added `'shell'`, `'typecheck'`, `'run_tests'`, `'lint'`
  to the `ToolName` enum (wire contract).
- Modified `registry.ts` — `shellTools` group (shell + the three verifiers) behind `shellEnabled()` /
  `withShell()`, gated by **`LUNA_SHELL`** (OWNER DECISION: default ON; `=0` is the off switch). Wired
  into `main.ts` boot as `withShell(withCodeWrite(...))` with a `[shell]` boot-log marker.
- Modified `l1Contract.ts` — added the run-and-verify clause: "after you change code, actually run the
  check (typecheck/run_tests) before you say it works; do not claim a change compiles or passes
  untested."
- Tests added (~per the plan): `shellDeny.test.ts` (every dangerous pattern named + refused,
  case-insensitive, interactive block, env-prefix, ordinary commands allowed), `shellCore.test.ts`
  (middle-elide cap, timeout clamp), `shell.test.ts` (safe command → stdout/exit 0 via injected
  spawner; deny-regex/interactive refused with the spawner never invoked; sensitive cwd + sensitive
  path-in-command rejected; schema bounds; surface-risk via the real `safetyGate`), and
  `typecheck`/`run_tests`/`lint` `.test.ts` (parse a known-good and known-bad run into the structured
  shape; sensitive cwd rejected). Extended `registry.test.ts` with the `LUNA_SHELL` flag gate
  (default-on mounts, `=0` absent, dispatched `shell` → `tool_not_found`). 491 tests green; tsc clean
  across protocol + server + web.

Inference:

- The verify loop is the difference between an edit agent and a code agent. With `typecheck`/`run_tests`
  first-class, Luna can do locate → edit → verify → iterate without the user driving every step, and the
  L1 contract now pushes her to actually run the check rather than asserting an untested change works —
  the same capability-honesty pillar, applied to code.
- `shell` is the highest-risk surface in the rewrite, so the mitigations stack rather than relying on
  any one: default-flag (`LUNA_SHELL`, flip-after-E2E), per-pattern-tested deny-regex, the
  blocklist applied to the cwd AND the command text, interactive-block, timeout + process-tree kill +
  output cap, `session-serial` (no racing shells), and `proactiveRisk:'surface'` (no silent shell in a
  proactive turn — the gate + `LUNA_PROACTIVE_MAX_ACTIONS` budget). Residual: the deny-regex is a
  blocklist, not a jail — a creative destructive command could slip; the surface-gate + budget + a
  future optional WS approval prompt (OWNER DECISION #2 / plan Open Q #2, deferred) are the
  defense-in-depth, and the safe choice (container/VM isolation) is reserved for the autonomous loop,
  which is a separate initiative entirely.
- The spawner is injectable specifically so v0.15.4's self-verified skill-runner can reuse it — the
  verify tools are exactly what a skill runs before it is allowed to save. Plan note "don't foreclose"
  honored.

**v0.15.3 — repo map + hybrid symbol locator + plan** (dev branch)

The fourth of five. v0.15.0 gave Luna eyes (read/grep/list); v0.15.3 gives her a **map** and a
**structural locate** so she answers "where is `X` defined / who calls it" with a verified answer, not
a guessed path — fixing the targeting half of 寻址能力差/目标定位弱. Plus a lightweight `plan` tool so
multi-step code work has a visible, revisable todo spine.

Fact:

- Added `web-tree-sitter@0.26.9` as a server dependency and vendored three prebuilt grammars under
  `packages/server/vendor/tree-sitter/` (`tree-sitter-typescript.wasm`, `-tsx.wasm`, `-javascript.wasm`
  — TS-first per Open Q #4). The runtime auto-locates its own `.wasm` via `Parser.init()`; verified it
  loads + parses under Bun.
- Added `code/treeSitter.ts` (~120 lines) — lazy, process-once runtime init + per-grammar `Language`
  cache, `grammarForPath` ext→grammar map, `loadParserFor(path)`. Every failure path returns **null**
  (no grammar / runtime fails / `.wasm` missing) so callers fall back, never throw — the plan's
  never-hard-fail contract. `resetTreeSitterForTests` seam.
- Added `code/symbols.ts` (~210 lines) — `extractSymbols(path, source)` with two backends behind one
  shape: tree-sitter (`verified:true`; defs from declaration nodes + arrow/function-expr declarators,
  refs from `identifier`/`type_identifier` nodes — a name inside a comment/string is **not** an
  identifier node, so it is structurally excluded) and a comment-stripping regex fallback
  (`verified:false`). `forceRegexFallbackForTests` seam.
- Added `code/repoMap.ts` (~230 lines) — `buildRepoMap` walks the source tree (reusing `fsScan`),
  parses each file cache-aware, builds a def→referencing-file graph, **PageRank**s it (12 iterations,
  damping 0.85), attributes file rank to defs (×1.5 for exported, ×4 for a `focus` match), sorts, and
  emits a **token-bounded** outline (`renderRepoMap`, ~1500-token default, truncation marker). Injected
  `statFn`/`nowMs` for deterministic cache tests.
- Added `code/repoMapCache.ts` (~70 lines) — mtime+size-keyed `repo_map` table wrapper over the shared
  memory DB (no-ops when the DB is unset, exactly like `l3Store`). `getCached` returns null on a
  staleness hit so a touched file always re-parses; `putCached` upserts; `clearRepoMapCache` for tests.
- Added `code/symbolLocator.ts` (~150 lines) — `locateSymbol`: SICA hybrid. ripgrep (reusing v0.15.0's
  injectable `runGrep`) produces cheap `\bname\b` candidate lines; each candidate file is re-parsed with
  tree-sitter to confirm real defs/refs and attach signatures. A file with no grammar / unreadable /
  runtime-failed degrades to its raw candidate lines marked `verified:false`. Output is structured
  (file+line+signature), never prose — the locate primitive v0.15.4's self-edit will point with.
- Added migration `0008_repo_map.sql` — the `repo_map(path, mtime_ms, size, symbols_json, parsed_ms)`
  cache table (versioned, never an in-place schema edit — the Python drift bug we avoid).
- Added the three tools: `builtin/repo_map.ts` (`{focus?, path?, max_tokens?}` → ranked outline +
  entries; `safe-parallel`, `proactiveRisk:'safe'`, jailed), `builtin/find_symbol.ts`
  (`{name, kind?, path?}` → `{definitions[], references[], verified, truncated}`; same risk tier), and
  `builtin/plan.ts` (`{action:set|update|get, items?}`; `session-serial`, `safe`; state on the
  `Session` object, emits a `tool.progress` plan snapshot for the web UI).
- Modified `packages/protocol/src/tools.ts` — added `'repo_map'`, `'find_symbol'`, `'plan'` to the
  `ToolName` enum (wire contract).
- Modified `registry.ts` — `repoMapTools` group (`repo_map`+`find_symbol`) behind `repoMapEnabled()` /
  `withRepoMap()`, gated by **`LUNA_REPO_MAP`** (OWNER DECISION #4: default ON, the plan's "0 until
  verified" superseded; `=0` is the off switch). `plan` added to `builtinRegistry` (ships on always).
  Wired into `main.ts` as `withRepoMap(withShell(withCodeWrite(...)))` with a `[repo-map]` boot marker.
- Modified `turn/session.ts` — added the `plan: PlanItem[]` field (session-scoped, NOT persisted) +
  `PlanItem` type. Modified `l1Contract.ts` — the map/locate/plan clause ("prefer find_symbol/repo_map
  over reading whole files to hunt a name; set a plan first for multi-step work"). Modified
  `packages/web/src/ui/toolLabels.ts` — friendly chips for the three new tools.
- Tests added: `code/repoMap.test.ts` (fixture → expected symbol set + verified; most-referenced
  symbol ranks first; injected-mtime cache returns cached on unchanged + re-parses on touch + clear;
  tiny token budget truncates with the marker), `code/symbolLocator.test.ts` (def + its refs found;
  a same-name token in a line/block comment **excluded** by the tree-sitter pass; `kind:'def'` returns
  defs only; tree-sitter-forced-off and no-grammar `.py` both degrade to `verified:false` candidates),
  `builtin/plan.test.ts` (set→get round-trip, update flips a status, unknown-id appends, progress event
  precedes ok + carries the snapshot, lives on the session, summarize, empty-set clears). Extended
  `registry.test.ts` (`LUNA_REPO_MAP` gate: default mounts, `=0` absent, `plan` present regardless) and
  `l1Contract.test.ts` (the new clause). 513 tests green; tsc clean across protocol + server + web.

Inference:

- This is the structural answer to the targeting weakness: a guessed path is how an edit lands in the
  wrong file. `find_symbol`'s tree-sitter verify is the load-bearing part — ripgrep alone counts a name
  in a comment or string as a hit, which is exactly the false positive that sends an agent editing the
  wrong line. By confirming each candidate is a real `identifier` node, the locator returns a *verified*
  def+refs set, and degrades (marked) rather than fails when a grammar is absent.
- The repo map is advisory by design — every entry is verifiable with `read_file`, so a heuristic
  mis-rank is a quality issue, not a safety one. The mtime cache makes the map cheap enough to call
  often (orient-before-read), and the token budget keeps a large tree from blowing context.
- The vendored-WASM dependency is the only real risk this version adds; it is fully fallback-guarded
  (missing/broken grammar → ripgrep-only / regex extraction, marked unverified), so a grammar problem
  degrades capability instead of breaking the tool.
- The `plan` spine and the structured `find_symbol` output both feed v0.15.4: the repo map is what makes
  a saved skill addressable ("the skill that touches `runTurn`"), and `find_symbol`'s file+line+signature
  is the pointer a self-edit proposal uses. Kept structured per the plan's "don't foreclose" note.

## C-side fix pass (2026-06-15) — v0.13.5 / v0.13.6

After Initiative 6 assembled the body, real-usage feedback surfaced a batch of client-side bugs.
Two fix rounds, all verified (tsc + `bun test` 296 green + browser smoke via the preview).

**v0.13.5 — local launcher + Initiative 7 cancel** (`6e18d9a`)
- `bun run dev` ([`scripts/dev-all.ts`](../../scripts/dev-all.ts)) spawns server (8787) + web (5173) +
  the local GPT-SoVITS TTS proxy (8788). The proxy ([`scripts/tts-proxy.cjs`](../../scripts/tts-proxy.cjs))
  is a thin standalone HTTP wrapper over the Python project's `GptSovitsService` (which had no
  standalone launcher — it was mounted in the old Python ws-server). Prefixed logs, Ctrl-C cascade,
  a startup banner with the entry URL, **proactive OFF by default in dev**.
- Initiative 7 (open-source packaging) **cancelled**: TTS stays original GPT-SoVITS, local-only.

**v0.13.6 — C-side fix pass** (server `17ff3ff`, web `25e4e2b`)

Bugs found in real use and their root causes / fixes:
- **Expressions/mouth "完全没触发"** — FaceVm ran on `app.ticker` (render-LOW priority, i.e. BEFORE
  the model's `internalModel.update`), so the auto idle-motion + blink overwrote every param each
  frame. Fix: drive FaceVm from the model's own `'beforeModelUpdate'` event (after the built-in
  controllers, before deform). Emotions + lip-sync now win; gaze + physics still drive the rest.
- **Refresh lost the chat log** — `handleOpen` sent nothing. Fix: new `history` ServerEvent replays
  the L2 timeline on connect (real timestamps + divider; idempotent across reconnects).
- **Gaze toggle didn't disable + tracked from the body center** — `model.autoFocus` is a no-op
  (autoFocus lives on `model.automator`); pixi's `focus()` references the body center + sways the
  body. Fix: kill the built-in autoFocus, drive a head-centric eyes+head gaze in FaceVm; the toggle
  truly gates it.
- **Model couldn't be zoomed** — added wheel zoom (persisted, clamped) + double-click reset.
- **Thinking leaked into chat bubbles** — in message-tool mode the model's free text blocks were
  streamed as `reply.token`. Fix: only stream `reply.token` in text mode; message mode speaks solely
  via the message tool.
- **TTS "没挂上"** — `WebAudioSink` latched off permanently on the first failure, so GPT-SoVITS's 503
  while loading its ~5 GB model killed voice for the session. Fix: don't latch on 503 (retryable);
  give up only after several consecutive hard failures. Mouth-drive path verified post-`beforeModelUpdate`.
- **Confusing autonomous replies + "test-message" DB** — the data was real history + proactive
  auto-fires (not test data); proactive is now OFF in dev, the DB path is pinned to the repo root,
  and the stray empty `packages/server/luna.sqlite` was removed.
- **Dev tooling**: a `?dev` performance panel (trigger all 14 emotions + states) and a VSCode-style
  `/_workspace` data IDE (sidebar table tree + editable grid + one-click reset + row delete/cell edit).

## C-side fix pass 2 + voice rebuild (2026-06-15) — v0.13.7 / v0.13.8

**v0.13.7 — gaze deep-fix + dev-tooling polish** (already shipped, backfilled here)

Fact:
- **Gaze head+body now actually move.** Earlier "head/body gaze" wrote `ParamAngleX/BodyAngleX`
  from FaceVm at `'beforeModelUpdate'` — but those are physics-driven and consumed *before* that
  hook, so they never deformed (force-pinning them produced zero head turn). Rewired gaze to drive
  the model's own `focusController` (runs before physics), with a proportional, head-centric offset
  so pointing at her neck reads level not "up". The off-switch eases the focus back to `(0,0)`
  (`model.focus()` is direction-only and degenerates to full-right at centre, which had frozen it).
  (`06fb132`, `bedd1f5`, `292ff5a`)
- **`/_workspace` collapses oversized cells** — long values (raw_json / payloads / full logs) clamp
  to ~3 lines with a ⤢ expand toggle; editable cells auto-expand on focus. (`c531ab4`)
- **dev-server `idleTimeout` → 255s** so a cold GPT-SoVITS first-load isn't killed at Bun's default
  10s ("request timed out after 10 seconds"). (`31a123a`)
- **Voice boot gate** — a full-screen splash blocks the UI while GPT-SoVITS warms its ~5GB model;
  skippable, degrades fast when no sidecar. Closes on `/health`-ready (not the warmup synth, which
  could hang after the model was already loaded). (`3fb1b4a`, `610995e`)

Inference:
- The gaze saga's real lesson: in Cubism, head/body angle is physics-output, so only the
  focusController (pre-physics) can move it — FaceVm (post-physics) can only drive direct deformers
  (brows/eyes/mouth). This same boundary shapes v0.13.8's mouth design.

**v0.13.8 — TTS lip-sync rebuilt from the Python engine + serial speech queue** (working tree)

Fact:
- **`lipSync.ts` rewritten as a faithful port of Python `Live2D_Work/js/runtime/lip-sync.js`** (~190
  lines): the prior TS version implemented only stage 1 (energy ingest) and emitted a single
  mouth-open scalar. Now all four stages — energy → stochastic open-target stepping on a jittered
  ~70ms clock (rest/medium/wide weighted by energy) → asymmetric attack(0.74)/release(0.58) +
  hard-close → form/pucker/shrug articulation (open-bucket lookup + sine micro-motions). Outputs a
  `LipSyncFrame {open, form, shrug, pucker}`; RNG is injectable for deterministic tests.
- **Four mouth params now driven** (`ParamMouthOpenY` + `ParamMouthForm` + `ParamMouthShrug` +
  `ParamMouthpucker`), not one — the single-param amplitude follower was the "ugly/jerky" mouth.
- **Mouth threaded as a frame**: `Live2DSink.setMouthOpen(number)` → `setMouth(LipSyncFrame | null)`
  (`sinks.ts`, `pixiLive2DSink.ts`, `app.ts`); `webAudioSink` rAF loop computes `lip.ingest(rms)` +
  `lip.tick(dt)` → `onMouth(frame)`. `faceVm.setMouth` overrides the 4 mouth params raw (post-emotion,
  no double-smoothing) while speaking, and writes the emotion/idle mouth unconditionally when
  released so a finished utterance can't freeze the mouth open.
- **Serial speech queue** (`serialQueue.ts`, new): `webAudioSink.speak()` prefetches the audio
  concurrently but plays strictly serially (next utterance starts only after the previous one's
  `onended`), fixing "the next line started before the previous one finished". `stop()` clears the queue + halts current (barge-in).
  The no-permanent-disable / 503-retry logic is preserved.
- **Tests**: `lipSync.test.ts` rewritten (5 tests: open/close, sub-floor silence, 4-param shaping,
  stochastic variation, reset); `serialQueue.test.ts` new (3 tests: serial order, throw-resilience,
  clear-cancel); `faceVm.test.ts` mouth tests updated (lip override + release). `bun test` 302 green.

Inference:
- Mouth params are direct deformers (unlike head/body — see v0.13.7), so FaceVm *can* own them at
  `'beforeModelUpdate'`; the lip-sync engine therefore lives in the audio layer and hands FaceVm a
  per-frame mouth pose, keeping a single param writer. The stochastic stepping is what reads as
  speech — a pure RMS follower is the thing that looked "ugly". Synthesis stays concurrent so the
  serial queue adds no latency beyond the unavoidable one-voice-at-a-time gate.

## English tuning (2026-06-15) — v0.13.12

Real-usage feedback: the validation over-limit rate ("超限率") was still too high, and Luna's persona is
English-led while the UI chrome was Chinese.

**v0.13.12 — English-tuned humanity caps + English frontend** (working tree)

Fact:
- **All three humanity caps relaxed for English** (`packages/server/src/persona/humanity.ts`):
  `MAX_CHARS` 140→**280**, `MAX_SENTENCES` 4→**5**, `MAX_CLAUSE_CHARS` 90→**150**. The Python originals
  were CJK-tuned (1 char ≈ 1 morpheme); English packs ~4–5 chars/word, so the old numbers rejected most
  natural English replies. The system-prompt `HARD LIMITS` block (`renderHumanityBlock`), the `message`
  tool's `.max()`/`.describe()`, and the Zod error messages all read these constants, so they updated in
  lockstep — verified (adversarial sweep) that **no** other length enforcement exists in
  `packages/server` (protocol `MessageDelivery.text` has no parallel `.max()`; A/B scripts derive from
  the constants).
- **Web frontend translated Chinese → English** (`packages/web`): boot gate (`bootGate.ts` splash +
  `TTS_STATE_LABEL`), layout chrome (`layout.ts` — settings toggles, send/dream/wake buttons, status
  badge, placeholders, aria-labels, `🌙 Dream`/`☀️ Wake`), `app.ts` (status text, boot-result messages,
  dream placeholder, the `?dev` performance panel), tool-card labels (`toolLabels.ts`), the 15 mood-pip
  labels (`mood.ts`), relative timestamps (`time.ts`), the error chip (`controller.ts`), the history
  divider (`cuteBubbleView.ts`), and `index.html` `lang="zh-CN"`→`"en"`.
- **Server dev-chat console translated** (`packages/server/src/devchat/devchat.html`): buttons, status
  line, retry/error chips, dream/proactive notices, `lang` attribute — so the dev surface matches the
  now-English web app.
- **Left untranslated on purpose** (verified non-UI): the Live2D overlay keys `脸红/俯身/黑脸/泪汪汪`
  (`faceData.ts`, referenced by `overlayRefs` — renaming would break the expression→param lookup), the
  CJK recall stopword list (`memory/recall/lexical.ts`), and CJK test fixtures (controller/ttsClient
  tests + the `message`/`messageMode` cap-violation fixtures, which exercise the CJK `。` splitter).
- **Tests**: `time.test.ts` + `toolLabels.test.ts` updated to assert the English strings;
  `message.test.ts` cap tests rewritten to be constant-relative (`MAX_SENTENCES+1`, `MAX_CLAUSE_CHARS+1`)
  plus a new English-boundary case; `messageMode.test.ts` violation fixtures bumped 5→6 sentences for the
  new `MAX_SENTENCES`. `bun test` **306 green**, `tsc` clean (server + web).

Inference:
- The caps are a single source of truth, so "tune for English" is a three-line change that ripples
  correctly to the prompt, the schema, the error text, and the measurement scripts — the typed-contract
  payoff. `280/5/150` keeps Luna "a spoken presence, not an essay" (~50 words / one SMS) while ending the
  retry-storm; revisit only if telemetry shows replies clustering at the ceiling (cap-as-target).
- The translation was scoped by *what renders*, not *what contains CJK*: an adversarial 3-critic sweep
  confirmed every logic-bearing CJK string (object keys, localStorage keys, `/health` state keys, recall
  stopwords, test fixtures) was left intact — the danger in a bulk translation is renaming a key, not a
  label.

## Idle animations (2026-06-15) — v0.13.13

The v0.13.1 FaceVM port deferred the procedural idle layer — "idle" was just the model's built-in
blink/breath while neutral. Python actually shipped several idle profiles, and the owner wanted them back +
switchable.

**v0.13.13 — switchable idle profiles** (working tree)

Fact:
- **5 awake idle profiles ported** from Python `js/runtime/face-vm.js` `applyIdle` into `FaceVm`
  (`packages/web/src/live2d/faceVm.ts`): `defaultIdleV1` (vtuber sway), `cuteSwayV1` (soft sway + bow +
  cat-mouth), `peekyIdleV1` (head-tilt peek), `shyDriftV1` (head-down slow sway), `sweetBounceV1` (lively
  up-down bounce). Each is procedural sine math (the per-profile `switch` + the shared look-wander/jitter
  terms), faithful to Python including the `0.18`/`0.24`/`0.34` neutral/thinking/sleeping smoothing — so
  the look (incl. the strong default head-roll that pegs `ParamAngleZ`) matches the original. The Python
  `sleep` profile is not duplicated — the `sleeping` Live2DState covers it.
- **Registry** in `faceData.ts` (`IDLE_PROFILES` ordered list + labels, `IdleProfileId`,
  `DEFAULT_IDLE_PROFILE`); the look-wander uses an **injectable rng** (default `Math.random`) so the rest
  of FaceVm stays deterministic for tests.
- **Two deliberate divergences for clean integration** with the tuned gaze/blink systems: the idle does
  **not** drive the eyes (`eyeOpen*`/`eyeSquint*`) so the model's built-in eyeBlink keeps blinking, and it
  drives the **gaze (`ParamEyeBall*`) only when mouse gaze-follow is off** — when it's on, the
  focusController owns the eyes. Head/body pose is still flushed pre-physics, so it *adds* with the
  focusController (idle sway + mouse look-at coexist). The awake idle is gated off while `sleeping`.
- **Settings switcher**: an "Idle animation" dropdown in the settings panel (`layout.ts` `selectRow` +
  `idleSelect` ref); `app.ts` persists to `localStorage 'luna:idle-profile'` and calls
  `live2d.setIdleProfile(id)` live (no refresh). `pixiLive2DSink` constructs FaceVm from the persisted
  profile + initial gaze state and forwards `setGazeActive` on the gaze toggle. `Live2DSink` grew
  `setIdleProfile?`/`listIdleProfiles?` (`sinks.ts`).
- **Tests** (`faceVm.test.ts`, +5): idle drives body sway in neutral (via `flushPose`); two profiles
  differ at the same clock; `setIdleProfile` switches + guards an unknown id; the idle wanders the gaze
  only when follow is off; the `sleeping` state suppresses the awake idle. `bun test` 311 green; the 8
  pre-existing FaceVm tests still pass (emotions own their channels, so the idle layer underneath them
  doesn't perturb their assertions). Live preview verified: dropdown renders 5 options, the model
  animates (pose params sweep, AngleZ pegging the model limit as in Python), and switching profiles takes
  effect + persists live.

Inference:
- The idle is the lowest layer (idle → state bias → emotion → actions), so it fills the "resting" gap
  without touching any of the expression/lip-sync/gaze work above it — emotions and the lip frame still
  win by ownership, the mouse still owns the eyes. Restoring the profiles makes neutral feel alive again
  and gives the owner the variety they remembered, now as a first-class setting rather than a buried constant.

## Detailed records

### `v0.36.10` — 2026-07-14 — Collapse closes downward (owner correction of v0.36.7)

Status:

- working tree

Fact:

- `theme.css`: `.chat-panel` drops `max-height: 100vh` and swaps the `max-height` transition term for
  `margin`; `.luna-app.collapsing .chat-panel` replaces `max-height: 80px` with
  `margin-top: calc(100vh - 96px)`. No JS change (`COLLAPSE_MS` 540 unchanged).

Inference:

- Root cause of the backwards direction: a flex item whose stretch is capped by `max-height` falls
  back to **flex-start** alignment — so as v0.36.7 shrank the panel, its BOTTOM edge rose toward the
  top (向上收起), the opposite of the 关窗户 spec (从上到下). Animating `margin-top` instead keeps the
  item stretched: the height compresses with the bottom edge pinned 16px above the stage floor while
  the TOP edge sweeps down — and the resulting 80px stub sits exactly where the docked fixed bar
  appears, making the phase-2 handoff near-seamless. Verified by snap-to-end geometry in the preview
  (transitions disabled): expanded top=16/bottom=767 → closing target top=687/bottom=767 — bottom
  anchored to the pixel, top swept down 671px.

### `v0.36.9` — 2026-07-14 — Rising send bubbles: slower, cloud-like drift, full text (Initiative 26 experience polish)

Status:

- working tree

Fact:

- `world.ts`: `BUOYANCY 1.9→1.4` (slower net-up climb); `SWAY_AMP 0.00006→0.00015` + `SWAY_HZ 0.6→0.45`
  (wider, slower sway); new per-body `swayPhase` (from `body.id`) mixed into the sway so risers drift
  out of sync. `riseBubble.ts`: `createRiseBubbles` default `maxChars 64→4000` (long sends show in
  full — the `.rise-bubble` wraps + grows taller). `world.test.ts`: the riser test now asserts a
  slower climb (`exitFrame > 30`) and a real wander (`maxDrift > 3`).

Inference:

- Owner #3: the riser shot up almost straight and fast, and truncated long messages. Lower buoyancy
  gives it the unhurried "floating out the window" feel (≥2× slower); the wider sway + per-body phase
  turns the path from a near-vertical line into a meandering cloud drift, and multiple sends no longer
  rise in a synchronized column. Lifting the text clip honors "even a long message must show in full"
  — the bubble simply wraps and grows, then rises complete.

### `v0.36.8` — 2026-07-14 — Falling bubbles: 10s dissolve, always-live physics, no overlap (Initiative 26 experience polish)

Status:

- working tree

Fact:

- `speechStackView.ts`: `dissolveMs` default `30_000` → `10_000`.
- `world.ts`: drag reworked off `Body.setStatic`. `grab()` marks the body grabbed + pins `entry.pointer`
  to its current position + `Sleeping.set(false)` (no more static); `setPointer` stores the pointer;
  `release` clears it + sets the throw velocity. `fixedTick` now, AFTER `Engine.update`, re-pins every
  grabbed body to its pointer (`setPosition` + zero velocity + keep awake). The `sleepStart` handler
  gained a `entry.grabbed` guard. New `pointer` field on `Entry`. +2 tests in `world.test.ts`.

Inference:

- Owner #1: 30s at rest felt like the words never left; 10s (timed from `onRest`, i.e. after landing)
  matches the ask. The drag-interference was real — a held bubble whose velocity we zero each frame
  would sleep and fire `onRest`, arming the dissolve mid-hold; the `grabbed` guard makes "held" and
  "at rest" mutually exclusive, and the timer re-arms only on the next genuine settle after release.
- Owner #2: `setStatic(true)` literally froze the body — no gravity, no live collisions, and a
  static body moved by `setPosition` tunnels through dynamic ones (so a dragged bubble could sit on
  top of another). Keeping the body dynamic and re-pinning it to the pointer *after* the solver step
  means it always has physics AND participates in collision resolution — it shoves the pile aside
  rather than overlapping it, so every bubble stays a distinct object.

### `v0.36.7` — 2026-07-14 — 关窗户 closes the whole panel, slower (Initiative 26 experience polish)

Status:

- working tree

Fact:

- `theme.css`: `.chat-panel` gains `max-height: 100vh` + a `max-height` term in its transition, both
  timed `--m-slow`; `.chat-body` opacity transition → `--m-slow`; `.luna-app.collapsing .chat-panel`
  adds `max-height: 80px` + `overflow: hidden` (only while collapsing). `app.ts`: `COLLAPSE_MS`
  300→540.

Inference:

- Owner #6: the v0.36.0 sash only shut the inner white `.chat-body` (a grid row); the stretched grey
  `.chat-panel` kept full height, leaving a static grey slab above the closing body. Driving the
  panel's own `max-height` down in lockstep makes the grey container shrink with the body — the whole
  panel closes top-to-bottom as one. `overflow:hidden` is scoped to `.collapsing` so the expanded
  panel's decorative puffs (which poke above its top edge) aren't clipped in the resting state. Owner
  #7: bumped to `--m-slow` so the close reads as deliberate, not a snap.

### `v0.36.6` — 2026-07-14 — Lace trim back + chat panel breathing room (Initiative 26 experience polish)

Status:

- working tree

Fact:

- `theme.css`: re-added `.lace-top` (14px top zigzag) / `.lace-bottom` (16px bottom scallop) as
  `position:absolute` overlays at `z-index:0` (the original `#b9d4ef` SVG patterns); added `margin:
  16px 0` to `.chat-panel`, `margin:0` to `.luna-app.collapsed .chat-panel`, and the two lace
  selectors to the pet-mode hide rule. `layout.ts`: re-added `add(root,'div','lace-top')` /
  `'lace-bottom'`. `motionRevival.test.ts`: the v0.36.0 "lace removed" gate flipped to "lace is
  decorative, model not letterboxed" (asserts the lace exists + the stage keeps `padding: 0 22px`).

Inference:

- Owner correction to v0.36.0's 无边模式: removing the lace was to stop it **letterboxing the model**,
  not to make the chat box fill the entire screen. The fix separates the two — the model keeps its
  edge-to-edge render (stage has horizontal-only padding), the chat box gets its own top/bottom gap,
  and the lace comes back purely as decoration. Placing it at `z-index:0` (behind the model and the
  chat panel) is the literal "no longer occludes the model": Luna renders on top, the lace frames the
  room around her.

### `v0.36.5` — 2026-07-14 — Fixed single screen: no scrollbars (Initiative 26 experience polish)

Status:

- working tree

Fact:

- `theme.css`: added `overflow: hidden` to `html, body` (line ~57) and `.luna-app` (line ~68). No
  other change.

Inference:

- Root cause of the owner's #4 (a page with horizontal/vertical scrollbars) and #5 (the left chat
  panel's top occluded): v0.36.4's settings panel stopped using `display:none` when closed and now
  parks off-screen right via `transform: translateX(calc(100% + 28px))` for its glide; unclipped,
  that off-screen box extended the scroll area (measured 1623px wide in a 1280px viewport) and grew a
  horizontal scrollbar, shifting/clipping the layout. Clipping at the root turns the app back into a
  fixed single screen and also future-proofs the physics layer (a bubble leaving the viewport is
  simply clipped, as intended — "exits the ceiling" — never a scrollbar).

### `v0.36.4` — 2026-07-13 — Settings, VTube-Studio style: an icon rail, real controls, a panel that glides (Initiative 26, 5/5)

Status:

- working tree

Fact:

- **Panel shell rebuilt (`layout.ts`).** A `.settings-backdrop` (blurred, click-to-close) + a
  `.settings-panel` that now lays out as `[icon rail | body]` and glides in from the right via
  transform/opacity (`--m-soft` + `--ease-glide`) — no more `display:none` snap. New pure-DOM helpers
  `tabPane` / `railBtn` / `wireTabs` build three grouped tabs — 🎚 **General** (Voice, Desktop pet,
  + the Setup-wizard re-run app.ts inserts after the pet row), ✨ **Avatar** (Live2D, Gaze, Idle),
  ☁️ **Server** (the `.server-settings` container) — each in a `.settings-card`. Clicking a rail icon
  activates its pane (a `tab-in` slide). `settingsBackdrop` added to the layout refs.
- **Controls re-skinned, semantics untouched (`settingsView.ts` + `theme.css`).** Booleans → an
  iOS-style switch: `appearance:none` on the REAL `<input type=checkbox>` (kept in the DOM, focusable,
  `:focus-visible` ring) drawn as a track + gliding knob. A bounded number (`min`+`max`) → a range
  slider + a live value chip (`input` updates the chip, `change` commits on release — the commit
  contract is intact); unbounded numbers + text stay restyled fields. New pure `formatSliderValue`
  (snap to ≤2 dp, non-numeric passes through). Reset/restart become pills. `renderServerSettings`'s
  signature + wholesale-per-`settings.state` model are unchanged, so registry growth needs no server
  work.
- **Open/close (`app.ts`).** The gear toggles `.on` on the panel AND the backdrop; the backdrop
  click and Escape close it. (Transform-driven, so no `.closing`/transitionend bookkeeping.)
- **Smoke (`main.ts`).** Selectors preserved, so the assertions are unchanged; only the
  post-open screenshot wait rose 200 → 500ms so the shot catches the settled panel, not the glide.
- **Tests:** 3 new `formatSliderValue` cases; `groupByCategory` untouched (existing tests pass).
  Suite 1275 → **1278 pass / 0 fail**; web tsc clean. In-browser: rail (3) + tabs (3) render, the
  gear glides the panel in with the backdrop, the Voice toggle is a real `appearance:none` pill
  switch, clicking the Server rail icon activates the server pane, Escape closes both; the "Desktop
  pet" label + `.server-settings` selectors are intact. (Server rows need a live server — verified
  via the packaged smoke; Alan's server was down during the dev-preview check.)

Inference:

- Closes Initiative 26. The rebuild is deliberately CONTAINER + CSS only: keeping
  `renderServerSettings` and the `.settings-panel`/`.on`/`label`/`.setting-row` contract means the
  server registry, the client wiring, and the packaged smoke all keep working with zero logic churn —
  the "简陋得离谱" complaint was a skin problem, so it got a skin fix, not a rewrite.
- The iOS switch keeps the native `<input type=checkbox>` precisely so accessibility doesn't regress
  (focus ring, keyboard toggle, the label association the smoke relies on) — a div-based fake switch
  would have looked identical and broken all three.
- Divergence from the plan: three fixed tabs (General/Avatar/Server) instead of one-tab-per-server-
  category, because per-category tabs would have required reshaping `renderServerSettings`'s single
  container and risked the smoke's `.server-settings .setting-row` count. The server categories still
  read as sectioned cards within the Server tab.

### `v0.36.3` — 2026-07-13 — Your words have lift: collapsed sends rise out through the ceiling (Initiative 26, 4/5)

Status:

- working tree

Fact:

- **NEW `packages/web/src/ui/riseBubble.ts`** — a thin feature layer over the physics scene. Pure
  `clipRiseText(text, maxChars)` (trim, collapse whitespace, ellipsize past 64) + `createRiseBubbles({
  doc, scene, barRect, ... })` → `{ spawn(text) }`. Spawn clips the text, builds a `.rise-bubble`
  (styled like the USER chat bubble), lifts it off a point scattered across the input-bar width (so
  rapid sends never form a column), and hands it to `scene.spawnRising`. Exit-top removes it;
  `maxVisible` (5) culls the oldest; a safety timer removes any riser whose exit never fires.
- **`scene.spawnRising(el, { anchorX, anchorBottomY, angle })`** added to the physics scene —
  appends the element (hidden), measures it, and `world.spawn`s a `rising` body so its bottom-center
  sits at the anchor. Risers are `pointer-events:none` (uncatchable departing words; the bar stays
  usable). **`world.ts`**: rising bodies get a collision filter of `mask: 0` — they collide with
  NOTHING (no walls, no other bubbles), just drift up and out.
- **Wiring:** `send()` (`app.ts`) spawns a riser only when `isCollapsed` (windowed-with-log already
  shows the message in the log). `layout.ts` now exposes `inputRow` in its refs so the riser can read
  the bar's live viewport rect. `.rise-bubble` CSS added (user-bubble palette, absolute, z within the
  shared physics layer).
- **Tests:** NEW `riseBubble.test.ts` (9: clip passthrough/collapse/ellipsize/empty; spawn off
  bar-center; empty + no-bar → no spawn; exit removes; rapid-10 caps at 5; safety timer) + a physics
  case in `world.test.ts` (a riser exits within ~10–400 frames AND drifts sideways > 0.5px — the sway
  is real). Suite 1264 → **1275 pass / 0 fail**; web tsc clean. In-browser: `.rise-bubble` resolves
  to the user-bubble palette, physics layer present, no errors (the riser physics itself was already
  proven in the real browser in v0.36.1).

Inference:

- The owner's "yours rise, hers sink" symmetry is complete: her replies fall and pile (v0.36.2),
  your sends lift and leave (here). Both are the SAME world — this version added ~90 lines of feature
  code and one collision-filter line, nothing structural, exactly because v0.36.1 front-loaded the
  engine.
- The collision filter is the correctness knob that makes risers read as "departing words" not
  "objects": with `mask:0` they pass through her fallen words and the walls instead of knocking them
  around, and `pointer-events:none` means they never steal a click from the input bar mid-flight.

### `v0.36.2` — 2026-07-13 — Her words have weight: speech bubbles detach, fall, get picked up, dissolve (Initiative 26, 3/5)

Status:

- working tree

Fact:

- **Comic tail removed.** Deleted `.speech-bubble::after` + `.side-left/.side-right/.latest::after`
  tail rules (`theme.css`). `.latest` now reads as a subtle `scale(1.03)` + stronger shadow instead
  of a pointer. Verified in-browser: `getComputedStyle(bubble, '::after').content === 'none'`.
- **NEW `packages/web/src/physics/scene.ts`** — the app-facing physics scene (one fixed, full-window
  `.physics-layer`, z-index 5, `pointer-events:none`; shared by falling bubbles here + rising bubbles
  in v0.36.3). `detachFalling(el, angle)`: measures the hanging bubble's viewport rect, freezes its
  size + font, re-parents it into the layer at top:0/left:0, and `world.spawn`s it as a `falling`
  body so the first synced transform lands it exactly where it hung (zero teleport). Wires
  `makeDraggable` (grab wrapper fires an `onGrab` callback). Pure `detachCoords(bubbleRect,
  layerRect)` split out for the handoff test. `interactiveRects()` exposed (the pet `setIgnore`
  hit-test path is dormant since v0.28.2, so nothing wires it — noted divergence from the plan).
- **`speechStackView.ts` lifecycle rework.** New injected `detach` seam + `maxFallen`/`dissolveMs`.
  A bubble hangs, then on `noteSpeechEnd()` (the OLDEST hanging bubble — playback is FIFO) or the
  hang TTL (voiceless) it detaches and falls instead of fading. `onRest` → arm a 30s dissolve →
  `.fading` → remove; `onGrab` cancels the pending dissolve (drag re-arms on the next rest, enabled
  by resetting the body's rest flag in `world.ts grab()`). Resting pile caps at `maxFallen` (6);
  `clearAll()` (barge-in) now fades only HANGING bubbles — fallen floor objects survive. With no
  `detach` injected the old fade-in-place path is preserved (backward-compatible; the 12 pre-existing
  tests pass unchanged).
- **`app.ts` wiring.** Mount `mountPhysicsScene()`, inject `detach: (el, a) => scene.detachFalling(el, a)`
  into the stack, and trigger the fall from the `speak` promise resolution — but only for real voice
  backends (`http`/`browser`); the voiceless noop sink resolves instantly, so it relies on the hang
  TTL rather than dropping the bubble the moment it appears. Removed the temporary v0.36.1 `?dev`
  physics harness (`devHarness.ts` deleted) now that a real caller exists.
- **Tests:** NEW `scene.test.ts` (3, `detachCoords` zero-teleport) + 6 new `speechStackView` fall
  cases (noteSpeechEnd detaches oldest, voiceless TTL falls, rest→30s→dissolve→remove, grab cancels
  dissolve, pile cap culls oldest, barge-in spares fallen). Suite 1255 → **1264 pass / 0 fail**; web
  tsc clean. In-browser: scene layer mounts (fixed/z5/pointer-events:none), tail gone, no errors.

Inference:

- This is the owner's flagship ask ("她的话变成房间里的小物件") landed. The zero-teleport handoff was
  the risk (hard part #2): solved by measuring-then-reparenting-then-spawning with size/font frozen,
  and proven by `detachCoords` + the fact that a v0.36.1 faller already rests exactly on the floor.
- The voice-gated detach is the subtle correctness point: coupling the fall to the `speak` promise
  is right for real voice but wrong for the instant-resolving noop sink, so voiceless deliberately
  falls back to the hang TTL — the bubble still hangs ~10s before falling instead of dropping on
  spawn.
- The pet-mode plan (interactiveRects → `setIgnore`) targeted code that v0.28.2 already retired: the
  pet window takes the mouse wholesale now, so a `pointer-events:auto` body over a `pointer-events:none`
  layer is grabbable for free, and empty space still reaches the window-drag driver. `interactiveRects`
  is kept for a possible future hybrid, unused.

### `v0.36.1` — 2026-07-13 — The physics substrate: one world, DOM bodies, a drag primitive (Initiative 26, 2/5)

Status:

- working tree

Fact:

- **matter-js adopted (Open Question 1 resolved).** `bun add matter-js@0.20.0` (+ dev
  `@types/matter-js`) in `packages/web`. Measured dist delta: entry JS gzip **222,834 → 252,464 B
  (+29,630 ≈ 28.9 KB gzip)**, under the plan's ~35 KB gate → keep matter-js; the fallback
  mini-integrator was not needed. matter is MIT (no THIRD_PARTY entry required — pixi precedent).
- **NEW `packages/web/src/physics/world.ts`** (~230 lines) — `createPhysicsWorld(opts)` → the seam
  matter never leaks past. DOM elements are rigid bodies synced once per frame via
  `transform: translate3d(...) rotate(...)` (never layout properties). Fixed-timestep accumulator
  (`1000/120` sub-steps, clamped against a long stall) so behavior is frame-rate independent. Static
  floor + side walls from the host rect, NO ceiling (risers exit the top). `enableSleeping` →
  per-body `sleepStart` drives `onRest` (the future 30s dissolve); off-screen bodies fire `onExit`
  and self-remove. `setBoundsFrom(rect)` rebuilds walls on resize; the rAF runner pauses on
  `document.hidden` and re-seeds the clock on resume; `dispose()` cancels the frame + unsubscribes.
  All clocks/rAF/visibility are injectable for headless tests.
- **NEW `packages/web/src/physics/dragBody.ts`** — `makeDraggable(el, handle, opts)` wires pointer
  events to a `BodyHandle` (grab → kinematic + pointer capture, move → setPointer, up → release with
  a thrown velocity). Velocity comes from pure `sampleVelocity(trail, windowMs)` — the oldest sample
  inside a recent time window, so a pause before release doesn't dilute a fast flick; degenerate
  trails (0/1 point, zero dt) return zero, never NaN.
- **NEW `packages/web/src/physics/devHarness.ts`** (TEMPORARY — removed in v0.36.2) + a `?dev`-panel
  section (`app.ts`): spawn a 💬 faller / 🫧 riser to eyeball the world; exposed as `globalThis.
  lunaPhysics` with a manual `step(dt)` so it can be driven when the rAF loop is paused.
- **Tests:** `world.test.ts` (13) + `dragBody.test.ts` (5) — 18 new headless cases via a FakeEl
  `.style.transform` sink and injected clock/rAF: fall→rest at `floor − h/2`, restitution bounce
  apex between floor and drop, riser exits + never rests, 1×32ms ≡ 2×16ms within tolerance,
  grab freezes gravity, release carries velocity, setPointer positions exactly, dispose cancels the
  frame + unsubscribes, a hidden tab freezes then cleanly resumes, and the velocity-window math.
  Suite 1242 → **1255 pass / 0 fail**; web tsc clean.

Inference:

- This is constitution item 2 ("物理引擎 — one engine, one world") landed as infrastructure BEFORE
  any feature, so v0.36.2/3 are thin layers, not physics rewrites. Keeping matter behind
  `world.ts` means the whole engine is swappable in one file if the bundle cost ever bites.
- The size gate was a real decision, not a formality: 28.9 KB gzip measured (not the ~26 KB
  estimate) still cleared 35 KB, so the hand-rolled fallback — and its loss of inter-body
  collision — was avoided; falling bubbles can pile against each other for free in v0.36.2.
- The injectable clock/rAF/visibility is what makes a physics engine unit-testable at all: the same
  code path the browser runs was driven deterministically headless AND hand-stepped in the real
  browser bundle (fall rested exactly on the floor), so matter's behavior is proven on both engines.

### `v0.36.0` — 2026-07-13 — Motion revival: reduce-motion removed, 关窗户 collapse, 无边模式, cute type (Initiative 26, 1/5)

Status:

- working tree

Fact:

- **Reduce-motion removed entirely.** Deleted the `.reduce-motion` class blocks and every
  `@media (prefers-reduced-motion: reduce)` block from `theme.css`; the boot detector and settings
  handler in `app.ts`; the `Reduce motion` settings row + `motionToggle` ref (`layout.ts`); and the
  `reducedMotion()` snap branch in `pixiLive2DSink.ts` (`glideLayout` now always glides). `app.ts`
  keeps a one-time `localStorage.removeItem('luna:reduce-motion')` to clear the stale key. Stale
  comments referencing it neutralized in `sinks.ts` / `glide.ts` / `glide.test.ts`.
- **关窗户 collapse choreography.** `.chat-panel` became a two-row grid (`[chat-body 1fr][input auto]`,
  `align-content:end`) and header+log+pill were wrapped in a new `.chat-body` div (`layout.ts`).
  Collapse is two-phase in `app.ts`: phase 1 adds `.collapsing` (grid rows transition 1fr→0fr, body
  fades — the sash closes top-to-bottom while still in flow); after `--m-soft` phase 2 docks to the
  fixed bottom bar (`.collapsed`) as the model FLIP-glides into the freed width. Expand un-docks then
  releases `.collapsing` after a **synchronous reflow** (not rAF — rAF freezes on a hidden tab and
  would wedge the chat shut). A generation counter cancels stale phase callbacks on rapid toggles.
- **无边模式 (edge-to-edge).** Removed the `.lace-top` / `.lace-bottom` strips (`layout.ts` + `theme.css`,
  including the pet-mode hide rule) and changed `.stage` padding `22px` → `0 22px`, so the model
  renders to the true top/bottom window edges (prerequisite for the v0.36.1 physics floor).
- **Cute typography.** New `packages/web/public/fonts/` with `Fredoka.woff2` (39 KB, variable wght) +
  `ZCOOLKuaiLe.woff2` (872 KB), both SIL OFL (license texts + a `THIRD_PARTY_LICENSES` entry). Two
  `@font-face` rules via relative `url()` so Bun's bundler resolves them — Fredoka inlines as a data
  URI, ZCOOL emits as a hashed dist asset; no runtime font CDN. `--font` stack leads with Fredoka +
  快乐体, PingFang fallback. Added `.woff2` → `font/woff2` to the packaged static host (`serve.ts`).
- **Motion tokens + micro-motion.** `:root` gains `--m-fast/--m-soft/--m-slow` + `--ease-pop/--ease-glide`;
  the collapse, `bar-rise`, and new micro-motions read them. New: chat-row/card spring-in (`chat-in`),
  a mood-pill change pop (`mood-pop`, retriggered from `app.ts updateMood`), and send/collapse button
  press feedback.
- **Build.** `package.json build:assets` no longer copies `public/fonts` (Bun bundles them; the copy
  shipped a redundant 872 KB). New source-gate test `motionRevival.test.ts` (8 cases) asserts no
  reduce-motion machinery survives in `packages/web/src` and that the replacements (tokens, 关窗户
  grid, 无边模式, bundled fonts) are present. Suite: 1242 pass / 0 fail.

Inference:

- The app's "soul" is back on by default. The diagnosis (Initiative 26 README) was that a single
  persisted checkbox — not the OS setting — had silenced every animation including the collapse
  glide; deleting the whole feature (rather than a tri-state) means no later version in the
  initiative carries a dual motion path, and the physics work lands on an always-animated substrate.
- The grid-`fr` sash is the first motion authored specifically to the owner's "关窗户" spec (the old
  collapse was an instant `display:none` vanish — never animated, independent of the kill-switch).
  The reflow-vs-rAF choice is load-bearing: verified live that a backgrounded tab froze the rAF
  path and left the chat stuck shut; the sync-reflow release is immune.
- 无边模式 is a prerequisite, not just cosmetics: v0.36.1's physics world needs the floor to be the
  true window bottom, which the lace letterbox previously cropped.

### `v0.35.7` — 2026-07-13 — A front page worth the project, in two languages — plus truly isolated screenshot smokes

Status:

- working tree

Fact:

- `README.md` rebuilt as a showcase page: centered icon + tagline, five static badges (MIT / Bun /
  TS-strict / Electron / PRs-welcome), an eight-point feature matrix (memory+dreams, proactive
  agency, streaming contract, capabilities, embodiment, BYO voice, guided onboarding, local-first),
  a 60-second quick start (`bun run app` first, browser path second), three REAL screenshots, a
  mermaid architecture sketch, a docs table, dev/test conventions, contributing pointer (naming the
  per-model expression presets as a good first issue), the Live2D license carve-out, and
  acknowledgements. NEW `README.zh-CN.md` — a full 中文 mirror, cross-linked (`English · 简体中文`).
- NEW `docs/assets/`: `icon.png` + `wizard-chat.png` (step 1 with the walkthrough card) +
  `wizard-voice.png` (step 6, http mode — drop zone, resource-link chips, and the health badge
  showing a live green "Voice server ready ✓") + `app-first-run.png` (empty-state + settings panel
  with the Setup-wizard Re-run row, generic example coordinates). All three captured from the real
  packaged bundle, not mockups.
- Screenshot tooling that made those safe: `smokeSetupProbe` gains `LUNA_SMOKE_OUT` capture and
  `LUNA_SMOKE_SETUP=voice` (fills a dummy key, walks Next/Skip×4, selects the http radio — fixing
  the mode check that previously fell through to the APP probe). NEW `LUNA_USER_DATA_DIR` env
  (documented in `.env.example`): overrides Electron's userData before any path resolution.
- The incident this closes: macOS resolves Application Support from the user record, NOT `$HOME`,
  so a "fresh-HOME" smoke silently used the REAL profile — SMOKE mode's `resolveSidecarDb` then
  bound the real userData DB and the first attempt at a first-run screenshot rendered private chat
  history + real coordinates. Caught on visual review before staging; the PNG was deleted, the
  capture re-taken under `LUNA_USER_DATA_DIR` with a pre-seeded generic location (the
  `.env.example` sample value). The override makes every future "fresh machine" smoke actually
  fresh.
- Suite 1234 green (+1 incidental); packaged smokes green (app + wizard). The public-clone build
  was re-verified while producing assets (fresh clone at `23d63c3` installs and packs cleanly;
  electron lands in `packages/desktop/node_modules`).

Inference:

- The repo now leads with what Luna IS — a companion you can see — instead of a build manual: the
  first screen a visitor gets is the bilingual wizard, the three shots are honest captures of the
  real bundle (including the deliberately empty avatar state, which IS the bring-your-own story),
  and the zh mirror serves the audience the resource links already target.
- The screenshot pipeline is repeatable documentation infrastructure: any future README refresh is
  two env vars away from pixel-true captures, and the userData override closes a class of
  private-data-in-artifacts accidents (smokes, tests, captures) at the root rather than by
  vigilance.

### `v0.35.6` — 2026-07-13 — Escape hatches: a broken config always has a one-click way back to the wizard

Status:

- working tree

Fact:

- NEW `packages/web/src/ui/reconfigure.ts`: `reconfigureVisible` (pure — visible only in the WS
  `closed` reconnect loop AND when the shell bridge exists; `connecting` excluded so a healthy boot
  never flashes it) + `mountReconfigureButton` (a "⚙ 重新配置 / Setup" pill mounted beside the
  status badge, wired to `lunaSetup.openSetup`). `app.ts` updates it from `onStatus`.
- `main.ts`: the `luna:open-setup` body extracted into `openSetupWindow()` (focus-or-create) and
  shared by three new callers: a NATIVE application menu (`installAppMenu`, set before any window)
  with "Setup Wizard… / 重新配置" on `CmdOrCtrl+,` — reachable even when the renderer is a white
  screen; standard appMenu/file/edit/view/window roles kept so copy/paste/devtools survive the
  custom menu. Both backend-failure dialogs (sidecar + dev stack "did not start") gain
  `buttons: ['Open Setup', 'Close']` with Open Setup as the default — the classic
  bad-config-bricked-the-backend moment hands the user the fix instead of a file path.
- Tests +2 (suite 1233 green): the visibility truth table (closed→show, open/connecting→hide,
  no-bridge→never). Both packaged smokes green (app regression + wizard DOM).

Inference:

- Closes the "irreversible state" the owner flagged: before this, a config that killed the backend
  left the Settings→Re-run row as the only in-app path back (reachable only if the app window
  booted), and a renderer-breaking config left nothing but hand-editing luna.env. Now every failure
  layer has its own exit: broken backend → the badge pill and the dialog button; broken renderer →
  the native menu / ⌘,; healthy app → Settings, as before.
- All four entry points funnel into the one `openSetupWindow()` the wizard already ships, so the
  recovery path is the same tested code as the happy path — no parallel recovery flow to rot.

### `v0.35.5` — 2026-07-13 — Boot precedence: setup gates the dev launcher, so first-run actually onboards

Status:

- working tree

Fact:

- NEW pure `resolveBootMode` (`backend.ts`): one boot decision with precedence attach → **setup** →
  dev → sidecar; `main.ts`'s `whenReady` tail now branches on it instead of three sequential
  early-return blocks. Smoke suppresses setup (the probe needs a window); the caller already
  suppresses dev under smoke. +5 tests incl. THE regression case
  (`needsOnboarding && devAvailable → 'setup'`).
- Root cause (user-reported from a fresh environment): the old order ran the dev-launcher check
  before onboarding, and `resolveDevLauncher` succeeds on any machine where the compile-time-inlined
  repo path still exists and bun is installed — which is EVERY "clone → `bun run app`" user. Their
  first launch started a keyless dev stack (fresh clones have no repo `.env`) and the wizard branch
  was unreachable; the v0.35.4 default flip made the hole visible.
- Verified on the packaged app: with `luna.env` parked (simulated first run), boot logs show no
  "launching full dev stack" and no attach, the setup window stays alive, and no sidecar is spawned
  (setup mode starts a backend only after the wizard submits). Real config restored after the test;
  both packaged smokes (app regression + wizard DOM) green.
- Note for posterity: during verification, `lsof -ti:8787` without `-sTCP:LISTEN` flagged the app's
  own `waitForPort` client socket as a "listener" — the port was never actually bound in setup mode.

Inference:

- This closes the gap between "the wizard exists" (Initiative 25) and "a newcomer actually meets
  it": the audience the wizard was built for — people who clone and run one command — was exactly
  the audience the old precedence routed around it. Dev machines with keys keep their one-click dev
  stack (`needsOnboarding` false → dev branch unchanged), and `LUNA_SKIP_ONBOARDING=1` remains the
  explicit bypass.
- Folding three early-return blocks into one pure, tested decision function is the same shape as
  `shouldAttach`/`resolveSidecarDb` — Electron-coupled boot stays thin, and the next precedence
  question becomes a one-line test instead of a packaged-app archaeology session.

### `v0.35.4` — 2026-07-12 — Guidance + default flip: the wizard becomes the front door (Initiative 25 closes)

Status:

- working tree

Fact:

- NEW `STEP_GUIDES` (`setupWizard.ts`) + ~14 bilingual copy entries (`setupCopy.ts`): every step
  renders a walkthrough card — plain-language registration guidance pinned to the reference
  instance's vendors (Anthropic console; OpenAI API keys for embeddings; Tavily with the free-tier
  note; QWeather with the per-account API-host warning), the honest cost of skipping each optional
  step, and the two community resource links (the free Live2D puppy model and the Neuro/Evil
  GPT-SoVITS pack, both bilibili) plus Live2D official samples and the GPT-SoVITS upstream repo.
  A link-audit test asserts each URL appears exactly once; the copy-parity test covers the new keys.
- Links open safely: `createWindow` installs `setWindowOpenHandler` — https URLs go to
  `shell.openExternal` (system browser), everything else is denied; no wizard link can spawn a bare
  Electron child window.
- **Default flip**: NEW pure `wizardFlagEnabled` (`onboarding.ts`) — the wizard is ON unless
  `LUNA_SETUP_WIZARD=0` (the one-release escape hatch back to the v0.28 card; delete next release).
- NEW `LUNA_SMOKE_SETUP=1` packaged smoke branch (`smokeSetupProbe` in `main.ts`): opens the SETUP
  window under smoke and asserts the wizard DOM from the real bundle — `.setup-card.wizard`, six
  dots, a step title, a guide card, the language toggle. Run with a fresh `HOME` as the
  clean-machine E2E: `{ok:true, wizard:true, dots:6, step:"1/6 · Chat model", guide:true,
  langBtn:true}`.
- Docs wizard-first: README's desktop section names the wizard; `docs/SETUP.md` gains "The guided
  way (desktop app) — recommended" with the manual path demoted to advanced/web-only;
  `.env.example` documents `LUNA_SETUP_WIZARD` + `LUNA_TTS_RUNTIME_DIR`.
- Tests +3 (suite 1226 green): guide text/label resolution per step, the exact-once link audit,
  the flag-default flip. Both packaged smokes green (normal app regression + the wizard E2E).
- Deliberate simplification, recorded: probe VERDICT strings (from the desktop main process) remain
  English-only — bilingualizing them needs an error-code layer; the walkthrough cards carry the zh
  guidance instead.

Inference:

- Initiative 25 closes: "clone → `bun run app` → follow the cards" now covers key registration,
  live validation, avatar install, and voice install without the user ever seeing an env file. The
  wizard-first docs make that the advertised path, while the manual sections keep the browser-only
  and headless flows first-class.
- Flipping the default only after a packaged, fresh-HOME smoke asserts the wizard's actual DOM is
  the same de-risking pattern every default flip in this history used (v0.7.0, v0.9.0, v0.18.2):
  the escape hatch exists, but the flip ships with machine-checked evidence, not hope.

### `v0.35.3` — 2026-07-12 — Voice-pack drag-in: the canonical GPT-SoVITS standard, prepared end-to-end, never spawned

Status:

- working tree

Fact:

- NEW `packages/desktop/src/voicePack.ts` (~170 lines, Electron-free, no child_process — enforced by
  a source-level test): `scanVoicePack` walks the dropped folder (depth ≤ 6) skipping runtime-bundle
  dirs (`GPT_SoVITS`, `runtime`, `pretrained_models`, venvs, `python*`) so a 整合包's base models are
  never offered as the user's voice; `.ckpt`/`.pth`/`.wav`/transcript collected; multiple candidates
  surface as a choice, never a guess. `installVoicePack` copies ONLY the picks into the canonical
  `userData/tts/<pack>/{GPT,SoVITS,reference}` layout and writes the reference-instance `luna.env`
  block (`LUNA_TTS_BACKEND=http`, `LUNA_TTS_URL` only when currently empty, `LUNA_TTS_REF_AUDIO`,
  `LUNA_TTS_PROMPT_TEXT` from the pack transcript unless the user typed one, `PROMPT_LANG`/`TEXT_LANG`).
- The canonical runtime standard (owner decision 2026-07-12): `validateRuntimeDir` checks a real
  GPT-SoVITS checkout (`api_v2.py` + both pretrained model dirs) and detects `.venv/bin/python`;
  `generateTtsYaml` emits the reference instance's `custom:` section field-for-field (device `cpu`,
  `is_half false`, `version v2`, bert/cnhuhbert under the checkout, t2s/vits at the installed
  weights); `startCommand` renders the one true launch form
  (`cd <checkout> && .venv/bin/python api_v2.py -a 127.0.0.1 -p 9880 -c <yaml>`, `python3` fallback,
  shell-quoted).
- `main.ts`: `luna:scan-voice-pack` (+ transcript preview ≤ 500 chars), `luna:choose-tts-runtime`
  (native dir picker + validation), `luna:install-voice-pack` — picks are **root-guarded** (every
  picked path must live inside the dropped folder, so a stray absolute path can't smuggle files),
  yaml written into the pack dir, `LUNA_TTS_RUNTIME_DIR` persisted (new `WIZARD_KEYS` entry; the
  server never reads it). `preload.ts`: `scanVoicePack`/`installVoicePack`/`chooseTtsRuntime` on
  `lunaSetup` (same `webUtils` path handoff as the model drop).
- `serve.ts`: `startWebHost`'s `ttsEnv` accepts a **getter**, re-read per `/api/tts` request;
  `main.ts` passes `() => readTtsEnv({...process.env, ...parseEnvFile(luna.env)})` — a wizard voice
  install (or a hand edit) applies on the very next call with no host restart. This retires the
  whole v0.34.15 stale-env bug class; regression test drives one host instance from 502 → ready →
  the NEW ref audio.
- Wizard voice step (http mode): the reused dropZone → pick rows (auto-picked when unambiguous) →
  transcript textarea (prefilled) → reference-language select → GPT-SoVITS folder picker with venv
  chip → Install → copyable command card + a 3s-poll health badge (red "not running" / green
  "ready") + a "Test voice" button that plays one `/api/tts/speak` sentence.
- Tests +12 (suite 1223): weights-only + 整合包-shaped + two-voice + missing-slot scans; canonical
  install layout + env block + transcript/override/no-clobber/idempotency; runtime validation incl.
  venv; yaml byte-exact vs the reference shape; command all three branches + shell quoting; the
  no-execute source test; the serve.ts getter rethread regression. Pack + packaged smoke `ok:true`.

Inference:

- The voice step was the last place where "configured Luna" still meant hand-editing five env keys
  plus hand-writing a YAML against an undocumented convention. Pinning generation to the reference
  instance's verified-working shape means what the wizard produces is not a guess at GPT-SoVITS
  config — it is a byte-shape copy of a config that speaks on this machine today.
- The BYO boundary survives intact and is now mechanically enforced (no child_process in the
  module, root-guarded picks, copy-only): Luna prepares weights, config, and the exact command, and
  the health badge + test button close the feedback loop the moment the user runs it — the closest
  a never-spawn design can get to "it just works".
- The serve.ts getter is the structural fix the v0.34.15 patch hinted at: config reads move from
  "captured at boot" to "read at use", so the entire category of stale-tts-env bugs (install,
  re-run, hand edit) dies in one place rather than being re-patched per call site.

### `v0.35.2` — 2026-07-12 — Avatar drag-in: download the model, drop the folder, she appears

Status:

- working tree

Fact:

- NEW `packages/desktop/src/modelInstall.ts` (~45 lines, Electron-free): `resolveModelDir` — the
  dropped folder is the model when it holds a `*.model3.json`, or the model sits ONE level down
  (the near-universal unzip-wrapper shape); two levels is ambiguous and returns null rather than
  guessing. `installModelFolder` — validate → copy-only `cpSync` into `userData/models/<name>` →
  `LUNA_MODEL_URL=/models/<name>/<manifest>` via `mergeEnvFile`. Error strings keep v0.34.7 picker
  parity (`'No .model3.json found in that folder.'`).
- `main.ts`: `luna:choose-model` rewired through the shared core; NEW `luna:install-model-path`
  (drop path). Both go through `installModelAndReload`, which reloads only windows whose URL lacks
  `setup=1` — fixing a v0.35.0 flow bug where a successful picker install from the wizard's avatar
  step reloaded the setup window and reset the wizard to step 1.
- `preload.ts`: `lunaPet.installModelFile(file)` — Electron 33 removed `File.path`, so the real
  path is resolved in the preload via `webUtils.getPathForFile` and only the path string crosses
  IPC. NEW `packages/web/src/ui/dropZone.ts`: a reusable drag target (dragover highlight, FileList
  handoff) the voice step will reuse in v0.35.3; wizard avatar step mounts it above the existing
  picker button, with a quiet no-op on the dialog's `'cancelled'`.
- Tests +7 (suite 1211): direct-folder install + env write + comment preservation, wrapper-shape
  install under the inner name, no-manifest verbatim error with nothing copied, non-folder error,
  copy-only contract (source untouched), deterministic overwrite on re-install, two-level nesting
  refused. Pack + packaged smoke `ok:true`.

Inference:

- This is the step that makes the resource-video flow real: the 7Apoi download lands as
  `下载/某模型文件夹`, and dragging exactly that folder — wrapper and all — onto the wizard now
  works without understanding what a manifest is. The one-level resolver covers the actual shape
  packs unzip to, while refusing to guess into deeper trees keeps a wrong-folder drop a clear error
  instead of a mystery install.
- Extracting the core turned an untested 15-line IPC handler into a unit-tested module shared by
  two entrances, and the reload-scope fix it forced (setup windows keep their state) is exactly the
  kind of interaction bug the wizard's re-run entry point would have kept tripping over.

### `v0.35.1` — 2026-07-12 — Live provider probes: a bad key can't get past its wizard step quietly

Status:

- working tree

Fact:

- NEW `packages/desktop/src/probes.ts` (~110 lines, pure + fetch-injectable per the
  `setQWeatherFetcher` seam pattern): `probeEmbedding` (OpenAI-compatible `/v1/embeddings`, 1
  input — the exact endpoint `memory/recall/embed.ts` uses at runtime), `probeSearch` (Tavily
  1-result query, mirrors `tools/web/tavily.ts`), `probeWeather` (QWeather `v7/weather/now` on the
  fixed Beijing city id so no user location is touched pre-consent; classifies the BODY `code` too —
  QWeather answers HTTP 200 with `code:"401"`). Each returns the existing `ProbeVerdict` with a
  vendor-named, actionable error (console URL / API-host hint / model-name hint).
- Weather host guard: the host must match `*.qweatherapi.com` / `*.qweather.com` BEFORE any fetch —
  the probe cannot be aimed at an arbitrary URL (tested: fetcher not invoked for a foreign host).
- `main.ts`: three IPC handles (`luna:probe-{embedding,search,weather}`) beside the chat probe —
  main-process-side, verdict-only returns. `preload.ts`: `lunaSetup.probeProvider(kind, fields)`
  pinned to the three fixed channels.
- `setupWizard.ts`: pure `probeGateAction` / `nextLabelKey` / `probeFieldsFor` — Next on a filled,
  untested optional step runs the probe (pass → advance; fail → verdict shown, button re-labels
  "continue anyway", second click advances); probe state resets when the step's fields change; a
  Test button per probe step; the weather step shows the live auto-select outcome
  (`weatherProviderName` rule: key set → QWeather, else Open-Meteo) as the user types.
- Tests +20 (suite 1204): per-probe status/body classification with injected fetchers, custody
  (no verdict contains the input key), host-guard no-fetch, gate semantics incl. the skip-confirm
  branch, `probeFieldsFor` per step. Pack + packaged smoke `ok:true`.

Inference:

- This is the "beginner never saves a dead key" half of the initiative's promise: the chat step had
  probe-first since v0.28, but the optional steps silently accepted anything — a typo'd Tavily key
  or the classic legacy-QWeather-host mistake surfaced days later as a mysteriously mute tool. Now
  the wrong host gets the exact hint at entry time, from the vendor's real response.
- The probes deliberately live in the desktop main process (not the renderer, not the sidecar):
  the renderer never holds a key longer than one IPC call, and no sidecar needs to be running yet —
  first-run probes work before anything else has started. Verdict strings are English-only this
  version; bilingualizing them is v0.35.4's copy pass.

### `v0.35.0` — 2026-07-12 — Setup wizard shell: six steps, flag-gated, one whitelisted submit

Status:

- working tree

Fact:

- NEW `packages/web/src/ui/setupWizard.ts` (~380 lines): the six-step wizard frame — progress dots,
  Back / Skip (optional steps) / Next / Finish, per-step status line, a values map that survives
  re-renders. The core is pure (`wizardSteps()`, `createWizardNav()`, `collectValues()` — trims and
  drops empties so a skipped field never clobbers an existing `luna.env` line); the DOM mount is a
  thin renderer. Chat step reuses the existing `lunaSetup.probe`; voice step is a browser/http radio
  revealing `LUNA_TTS_URL`; avatar step reuses `lunaPet.chooseModel`.
- NEW `packages/web/src/ui/setupCopy.ts`: the zh/en copy table (`SETUP_COPY`) + `makeT(lang)` with
  fall-back-to-key, `detectSetupLang` (stored choice > `navigator.language` zh-* > en), persisted
  via `luna:setup-lang`. Shell strings only this version — walkthrough cards land in v0.35.4.
- `packages/desktop/src/onboarding.ts`: NEW `WIZARD_KEYS` (19 luna.env keys) + `filterWizardFields`
  — the defense-in-depth whitelist between the renderer's field map and `mergeEnvFile` (anything
  else is dropped, never persisted; composes with the v0.28.3 control-char sanitize).
- `packages/desktop/src/main.ts`: `wizardEnabled()` (fresh luna.env read — the v0.34.15 lesson),
  sync `luna:wizard-enabled`, `luna:open-setup` (focus-or-create one setup window), and
  `luna:wizard-submit` — whitelist → chat probe-first when chat fields present (bad key never
  persisted) → ONE merge + ONE sidecar restart → window swap. NEW `attachedToExternal` guard: when
  the shell ATTACHED to an externally-started backend, submit writes the file but does not spawn a
  sidecar against the busy port.
- `packages/desktop/src/preload.ts`: `lunaSetup` gains `wizard` (sync flag read), `wizardSubmit`
  (one-way field map), `openSetup`. `packages/web/src/app.ts`: `?setup=1` mounts the wizard when the
  shell advertises it, the legacy card otherwise; `&wizard=1` mounts a bridge-less browser preview
  (probe/finish disabled) for flow/copy review; the Settings panel gains a "Re-run setup" row
  (desktop only, next to the pet row). `theme.css`: wizard styles over the setup-card language.
- Tests +16 (suite 1184 green): wizard step order/keys/password-type + nav clamping + collect
  semantics (`setupWizard.test.ts`), lang detection + zh/en parity + t() fallback
  (`setupCopy.test.ts`), whitelist drop/trim/non-string/injection-compose
  (`onboarding.test.ts`).

Inference:

- The wizard frame is the load-bearing slice of Initiative 25: every later version (probes, drops,
  copy) plugs into `wizardSteps()`/the step bodies without touching navigation, persistence, or key
  custody again. Shipping it dark (flag off, legacy card untouched, packaged smoke identical) lets
  the remaining versions build on a stable base while the default experience stays v0.28.
- The whitelist submit closes the one genuinely new attack surface a "wide" submit opens: the
  renderer can now hand the shell arbitrary keys, but only the 19 wizard-managed ones can ever
  reach `luna.env` — `LUNA_WORKSPACE_ROOT`, `LUNA_SQLITE_LIB` and friends are dropped at the IPC
  boundary, tested.
- The attach-mode guard fixes a latent pre-existing hazard the wizard would have amplified: the
  legacy submit path could restart a sidecar against a port owned by an external `bun run dev`
  backend; the re-run entry point (`openSetup`) makes that path actually reachable, so it got the
  guard now.

### `v0.34.15` — 2026-07-12 — Packaged-app voice: thread luna.env's TTS config into the static host's /api/tts forward

Status:

- working tree

Fact:

- `packages/desktop/src/main.ts`: `startWebHost(p.webDist, WEB_PORT, undefined, p.userModelsDir)` →
  `startWebHost(p.webDist, WEB_PORT, readTtsEnv({ ...process.env, ...userEnv }), p.userModelsDir)`
  (+ `import { readTtsEnv } from '../../web/src/tts/apiV2'`).
- Root cause: `serve.ts`'s `startWebHost` defaults `ttsEnv` to `readTtsEnv(process.env)`. The desktop
  reads `luna.env` into a local `userEnv` and hands it to the **sidecar** (`sidecarEnv`) and to the
  **renderer** (`currentLunaConfig`), but never into the main process's own `process.env`. So the
  static host's `/api/tts` forward saw no `LUNA_TTS_URL` and returned `502 "tts upstream not
  configured"` for every request — voice was dead in the packaged app even with a fully-configured
  `luna.env`. It only worked under `bun run dev`, where bun auto-loads `.env` into `process.env` and
  `dev-server.ts` reads the same keys.
- Verified end-to-end against a live GPT-SoVITS `api_v2`: rebuilt + repackaged, relaunched the Desktop
  app, then `GET /api/tts/health` → `{"backend":{"ready":true,"state":"ready"}}` (HTTP 200, was 502)
  and `POST /api/tts/speak {text}` → 160 KB `audio/wav` (HTTP 200, was 502). Desktop + tts suites
  green (73 pass).

Inference:

- This bug shipped with the v0.34.7 BYO-voice work (it introduced the `serve.ts` forward and the
  `luna.env`/sidecar split) and reached the public repo — any user who set `LUNA_TTS_BACKEND=http`
  in the packaged app got a silent 502 and fell back to voiceless/browser TTS. The one-line env thread
  makes the packaged path match the dev path, so a configured `luna.env` finally speaks.
- Symmetry note for future work: `serve.ts` (packaged) and `dev-server.ts` (dev) both consume
  `readTtsEnv`, but from different env sources — the packaged host must be handed the merged env
  explicitly because Electron's main process doesn't inherit `luna.env` the way `bun run` inherits
  `.env`.

### `v0.34.14` — 2026-07-11 — `bun run app` delivers Luna.app to the Desktop instead of burying it in the repo

Status:

- working tree

Fact:

- `scripts/app.ts`: after packaging, the launcher now copies the built bundle to `~/Desktop/Luna.app`
  with `ditto` (the bundle-correct macOS copy — preserves perms/symlinks/xattrs), then launches that
  Desktop copy. `packages/desktop/release/mac-arm64/Luna.app` reverts to being just the build cache.
- The copy is guarded: it runs only when `~/Desktop/Luna.app` is missing or older than the freshly
  built app, so an unchanged re-run skips both the build and the copy (verified: second run logs
  "up to date" + "already on your Desktop").
- New knobs: `LUNA_APP_DEST` overrides the destination folder (default `~/Desktop`); `LUNA_APP_NO_LAUNCH`
  now still builds **and delivers**, only skipping the final `open` (so CI can produce the artifact at
  a chosen path without a window).
- Non-macOS: unchanged — it reports the `release/…` path (packaging is mac-only today).
- Verified end-to-end: delivered a valid 304 MB bundle (executable + `icon.icns` + bundled yumi model +
  `luna-server` sidecar all present) to a scratch dir and to the real Desktop.

Inference:

- Removes the last "where did it go?" friction: previously "clone → `bun run app`" left the app three
  folders deep under `packages/desktop/release/…`, which no one would think to pin to the dock. Now the
  first run puts a real, double-clickable `Luna.app` on the Desktop — the app can be launched forever
  after without the terminal, and it keeps working even if the checkout is moved or deleted (it's a full
  copy, not a symlink into the repo).
- The cost is disk (a ~300 MB duplicate of the bundle); the guard keeps it to one copy per real change,
  and `LUNA_APP_DEST` lets a space-conscious user point it at a single install location instead.

### `v0.34.13` — 2026-07-11 — Desktop app icon: a white-background / black-“Luna” wordmark replaces the stock Electron diamond

Status:

- working tree

Fact:

- NEW `packages/desktop/build/icon.icns` (~100 KB, a complete `.iconset`: 16, 32, 128, 256, 512 at
  @1x and @2x up to 1024²) and `packages/desktop/build/icon.png` (1024² master). The mark is a white
  rounded-square (Big Sur grid: 824² content, ~185 corner radius, on transparent padding) with the
  black word **Luna** centered in Avenir Next Bold.
- `packages/desktop/package.json`: added `"icon": "build/icon.icns"` under the `mac` build target.
  Before this the target declared no icon, so electron-builder fell back to the default Electron icon
  (it logged `default Electron icon is used  reason=application icon is not set`).
- Verified end-to-end: after `electron-builder --dir` the "default Electron icon" log is gone, the
  bundle's `Contents/Resources/icon.icns` is byte-identical to the source (100211 B),
  `Info.plist` `CFBundleIconFile=icon.icns`, and the packaged smoke boots clean
  (`ok:true`, WS open, empty-state placeholder for a model-less clone).
- The mark was generated with PIL (no SVG rasterizer on the box) then assembled with `iconutil`; the
  binary assets are committed, so no image toolchain is needed to build the app.
- Pre-publish scrub: the private reference-model name had slipped into a `.gitignore` comment in
  v0.34.12 (`local BYO model overlays (yumi etc.)`) — the parenthetical was removed; the ignore rule
  itself is unchanged.

Inference:

- The app now has an identity in the dock, ⌘-Tab switcher, and Finder instead of the generic Electron
  diamond — the first thing anyone sees on launch. A plain black-on-white wordmark reads cleanly at
  every size down to the 16px list icon and needs no color/theme assets, which keeps it honest with the
  bring-your-own posture of the public build (no bundled avatar, no owner branding — just the name).
- Choosing a bold geometric wordmark over the thin system-font default was a legibility call: the two
  SF-family candidates rendered at regular weight (PIL can't select the variable font's bold instance)
  and washed out at dock size, so the icon uses a true-bold face instead.

### `v0.34.12` — 2026-07-11 — One-command run: `bun run app` builds, packages, and launches (and re-packages only when source changed)

Status:

- working tree

Fact:

- NEW `scripts/app.ts` (~110 lines): a `bun run app` launcher wired as the root `package.json`
  `app` script. Flow: (1) `bun install` if `node_modules/` is absent; (2) compute the newest mtime
  across the build inputs (`packages/protocol|server|web|desktop/src`, `packages/web/public`,
  `packages/web/index.html`, `scripts`, the four package manifests, root `package.json`, `bun.lock`)
  and compare it to the packaged `release/*/Luna.app`; (3) when the app is missing or older than any
  input, run the web build → `compile:server` → `pack` (`electron-builder --dir`), else skip the
  whole build; (4) `open` the app on macOS (print its path elsewhere).
- The mtime walk skips `node_modules`/`dist`/`release`/`bin`/`.git` and any `*.sqlite*`, so docs,
  tests, the `.env`, and the live DB never trigger a needless re-package.
- Bring-your-own voice is never auto-started: when `LUNA_TTS_BACKEND=http` and the `LUNA_TTS_URL`
  (default `http://127.0.0.1:9880`) is unreachable, the launcher prints a one-line reminder to start
  GPT-SoVITS `api_v2` (or switch to `LUNA_TTS_BACKEND=browser`) and continues — it does not block.
- Added `LUNA_APP_NO_LAUNCH` — packages without opening the app, for headless/CI builds.
- `.gitignore`: local BYO model overlays (`packages/web/public/models/*`) are now ignored while the
  `README.md` placeholder stays tracked — so an operator can drop their own Live2D model where the web
  build bundles it into `Luna.app` without it ever landing in the public repo.
- Verified by real runs: a stale tree rebuilt + packed; an unchanged re-run skipped straight to
  launch; a dead `LUNA_TTS_URL` produced the BYO-voice reminder.

Inference:

- Closes the last onboarding gap for the desktop app. Before this, running the packaged pet meant
  remembering a four-step build chain (web dist → server binary → desktop bundle → electron-builder)
  and knowing which steps were stale; a fresh clone had no single entry point. `bun run app` makes
  "clone → run" one command, and — because it re-packages only on a real source change — the everyday
  case (nothing changed) launches instantly instead of paying a full ~1-minute pack each time.
- It respects the bring-your-own boundary established in v0.34.7: the launcher will not resurrect the
  deleted owner-specific glue that used to spawn the voice sidecar. It only *detects and hints*, so
  the public repo stays sidecar-agnostic while a local operator still gets a nudge when voice is down.

### `v0.34.11` — 2026-07-11 — Recall relevance floor: a decisively-relevant old memory can no longer be buried by recency

Status:

- working tree

Fact:

- `memory/recall/recall.ts` `retrieve()`: the final `filter → sort(score) → slice(k)` becomes a merge —
  a **relevance floor** (the top `LUNA_RECALL_FLOOR_N` eligible candidates by PURE cosine, each ≥
  `LUNA_RECALL_FLOOR_MIN_COS`) is placed ahead of the recency-blended ranking, deduped, then the rest fill
  by blended score up to `k`. Both knobs are read per-call (live-tunable / testable); defaults 3 and 0.35.
- `RETRIEVAL_K` default 12 → 18 (wider auto-recall coverage; independent of the floor).
- The floor no-ops when cosine is unavailable (embedding off or the `LUNA_RECALL_ASYNC` budget timed out →
  all-null cosScores) — the lexical path is byte-identical to before.
- NEW env: `LUNA_RECALL_FLOOR_N`, `LUNA_RECALL_FLOOR_MIN_COS` (documented in `.env.example`).
- +4 tests in `recall.test.ts` (an old high-cosine memory survives below-k recency ranking; the floor-off
  toggle re-buries it, proving causation; the min-cosine gate excludes a weak match; no-op when embedding
  is off). 1164 → 1168 green; server/web/protocol `tsc` clean.

Inference:

- The GA score `(α·recency + β·importance + γ·relevance)/3` with equal weights lets recency dominate: a
  memory 8 days old scores recency ≈0.11 against a fresh ≈1.0, a ~0.9 swing that a modest cosine advantage
  (the best oblique-query match tops out around 0.4) cannot overcome. So the retrieval could correctly
  identify the single most-relevant memory and then discard it for being old — which is exactly how a real
  7/03 conversation was retrieved-and-scored #1 by cosine yet ranked #147/500 and never surfaced.
- Weight-tuning cannot fix this: a live-DB simulation showed lowering `W_RECENCY` either failed to lift the
  memory into top-k or catastrophically reshuffled normal recall (0/12 overlap); a relevance-gated recency
  term was safe but too weak. Only a guaranteed floor — retrieve-by-similarity, then rerank — surfaces the
  buried memory (#147 → #3) while leaving normal recall intact (a generic query's top-18 stays 100% recent).
- The floor gives embeddings *authority for old memories* without privileging age: it fires only when a
  high-cosine old memory exists that recency would bury; for a normal query the top-cosine candidates are
  already the recent ones, so it changes nothing.

### `v0.34.10` — 2026-07-10 — Residual-PII sweep of the published code

Status:

- working tree

Fact:

- The final verification of v0.34.9 ran a full-history grep with a WIDER marker set than the v0.34.8
  publish check — adding pet names, beverages, and city names, not just the owner name / gateway / paths.
  It caught two owner-derived fixtures the v0.34.1 scrub had missed, now sitting in the published code:
  a pet name (in `dream/dream.test.ts` and `tools/builtin/recall.test.ts`) and a coffee preference woven
  through the recall test's semantic concept-axis (`memory/recall/recall.test.ts`, ~15 references).
- Both neutralized: the pet name → generic fixture names; the coffee token → a substitute beverage kept
  on the same fake-embedding concept axis, so the zero-keyword-overlap paraphrase-recall tests still
  exercise the same path. Every assertion moved with its fixture. 1164 green, server `tsc` clean.
- The public repository history was re-published as a single fresh clean root commit (force-push over the
  two prior commits), so neither fixture appears in any reachable public commit.
- Also scrubbed while the history was being rebuilt anyway: a residual "home hand-brewed" preference habit
  left in a sweep fixture by the v0.34.1 scrub, and the reference-model asset name in three `live2d/` code
  comments. Deliberately kept: `Asia/Shanghai` in the weather/time test fixtures — a standard UTC+8 no-DST
  test timezone, not owner-presuming UI (v0.34.4).

Inference:

- The lesson is about the shape of a grep gate, not the scrub: v0.34.8's check looked only for the markers
  it already knew (name, gateway, paths), so fixtures carrying the SAME class of PII under different words
  — a pet's name, a favorite drink — passed clean. The adversarial semantic sweep of the history in v0.34.9
  is what widened the vocabulary enough to expose them; the same widened grep then had to be turned back on
  the code. A pattern list only ever finds what you already thought to name.
- Re-publishing rather than fixing-forward matters here: a follow-up commit leaves the PII in the earlier
  commit's diff, which `git log -p` still surfaces. Only rebuilding the history removes it from the public
  record — cheap while the repository is days old and unforked, which is exactly why it was done now.

### `v0.34.9` — 2026-07-10 — Handoff surface: the scrubbed development history, CONTRIBUTING, and agent skills

Status:

- working tree

Fact:

- **`docs/history/DEVELOPMENT.md` restored to the public tree** (this file), scrubbed rather than
  removed. v0.34.5 had deleted it wholesale because it was dense with owner PII; the requirement to
  preserve the development record in full forced the line-by-line scrub instead.
- The scrub was located by a **13-agent fan-out** over the 4741-line file: 10 slice readers plus 3
  completeness critics with distinct lenses (quoted private conversation / anecdote + identity / paths +
  private assets). 212 findings, 131 unique spans.
- **170 replacements applied deterministically** by exact string match, longest-first, with the public
  GitHub handle guarded against the generic owner-name rule. Every other byte is unchanged.
- Categories replaced: owner name (53), verbatim quoted private conversation (38), gateway vendor (28),
  private avatar asset (26), personal detail — city, timezone, habits, pronouns (19), absolute paths and
  internal task ids (4), cost/billing figures (4), locale (4).
- What the keyword greps could **not** have found, and the critics did: personal facts embedded in
  real-conversation test fixtures, locale details inferable from live tests, billing figures, gendered
  pronouns referring to the owner, and verbatim private conversation — none of which matches a fixed
  string pattern.
- Deliberately **not** rewritten: Luna's own model-generated replies, persona rule phrases, and the
  author's Chinese technical shorthand. None of it identifies a person, and altering it would falsify the
  record.
- NEW `CONTRIBUTING.md` — setup, the five load-bearing invariants (protocol as the single wire source of
  truth; never buffer tool calls; the dispatcher's concurrency policy; versioned atomic migrations; risky
  subsystems behind a default-off flag), code standards, the change lifecycle, and version/commit
  conventions.
- NEW `.claude/skills/{luna-orient,luna-dev,luna-roadmap}/SKILL.md` — the three development skills,
  rewritten PII-free: no absolute paths, no gateway vendor, no owner name, no Python-parity coupling.
  They reference `ARCHITECTURE.md` / `CONTRIBUTING.md` / this file instead of the removed internal docs.
- `.gitignore` now excludes `.claude/settings.local.json` and `.claude/launch.json` — the skills ship,
  personal configuration does not.

Inference:

- v0.34.5's wholesale removal was correct **as a PII decision** and wrong **as a handoff decision**: it
  left the public repository unable to be picked up. A project's development history is part of what it
  is; deleting it to protect a name throws away the reasoning that makes the code legible.
- The right resolution was neither "publish it raw" nor "lose it", but to separate *the record* from *the
  identity in the record*. That separation is only mechanical for keyword PII. The semantic PII — a
  quoted conversation, a coffee preference, a city inferred from a weather test — is precisely what an
  automated grep gate would have waved through, which is why the sweep used adversarial critics with
  independent lenses rather than a pattern list.
- With this version the public repository is self-sufficient: `ARCHITECTURE.md` says what exists,
  this file says how it got that way, `CONTRIBUTING.md` says how to change it, and the skills encode that
  discipline for an agent. Development can move to a fresh workspace and a fresh agent without losing the
  thread.

### `v0.34.8` — 2026-07-10 — Published to the public repository (Initiative 24 ✅)

Status:

- shipped in `6be71bc` (the public root commit)

Fact:

- The OSS-clean tree was squashed with `git commit-tree <tree>` — no parent — producing a **single
  parentless root commit**, so none of the private repository's 200+ commit history (with its machine
  paths, gateway vendor, private assets and quoted chat) is inherited.
- Authored and committed under a neutral `noreply` identity so the maintainer's private email never
  enters public commit metadata.
- Pre-flight verification: `.env` confirmed untracked; the tracked tree grepped clean of private markers
  and of real secrets (the only `sk-` match is a fake `sk-abc` env-parser test fixture); no avatar asset
  and no TTS glue tracked.
- Post-publish verification, by re-cloning the **public** repository: exactly 1 commit; `git log --all -p`
  grep for owner markers, private assets and glue → **0**; `bun install` + 1164 tests + `bun run build`
  all green.
- The private repository is untouched and remains private.

Inference:

- Publishing to a *fresh, empty* repository rather than rewriting the private one turned the release from
  an irreversible history rewrite into a reversible, verifiable act: if a leak had been found, the public
  repo could be deleted and re-published with nothing lost.
- The go/no-go gate that mattered was not the grep — it was the clean-clone dry-run of v0.34.7. A grep
  proves the absence of strings you thought to look for; a stranger's clone that installs, builds, tests
  and boots proves the thing actually works without any of the author's machine.

### `v0.34.7` — 2026-07-10 — Bring-your-own onboarding: model resolver, browser voice, direct api_v2, desktop picker

Status:

- shipped in `d66f731`

Fact:

- **Model resolution.** NEW pure `packages/web/src/live2d/resolveModelUrl.ts` — `localStorage['luna:model-url']`
  → `window.lunaConfig.modelUrl` → `undefined`. The removed bundled-avatar fallback is gone; `undefined`
  short-circuits `createPixiLive2DSink` before any fetch, so a fresh install produces no 404 probe. +5 tests.
- **Empty state.** `app.ts` computes a `modelState` (`ok` / `none` / `webgl-off` / `load-failed`), publishes
  it as `dataset.modelState`, and rewrites the placeholder copy per reason, pointing at `public/models/`
  and `docs/SETUP.md`. On desktop the card grows a "Choose model folder…" button (bridge-gated).
- **Desktop BYO.** `Paths` gains `userModelsDir` (`userData/models`, created on first run);
  `startWebHost` serves `/models/*` from it **ahead of** `webDist` with a per-root traversal guard; a
  `luna:choose-model` IPC opens a native folder picker, validates a `*.model3.json` exists, copies the
  folder, persists `LUNA_MODEL_URL`, and reloads. The preload injects `window.lunaConfig` via
  `ipcRenderer.sendSync` (sandbox-agnostic — a sandboxed preload has no `process.env`).
- **Voice.** NEW `WebSpeechSink` (Web Speech API) gives a fresh install a voice with no backend and no
  download; NEW pure `resolveTtsBackend()` selects `none` / `browser` / `http` from the `luna:tts` off
  toggle, `luna:tts-backend`, and the injected config, defaulting to `browser`. +6 tests.
- **Direct `api_v2`.** NEW pure `packages/web/src/tts/apiV2.ts` (`readTtsEnv` + `planTtsForward`) translates
  `/api/tts/{speak,health}` into a GPT-SoVITS `api_v2` `POST /tts` call, injecting the bring-your-own voice
  parameters from env so the browser never sees them. Both forwards (Bun `dev-server.ts`, Node
  `serve.ts`) adapt around the same pure planner. Because the upstream URL is **constructed from a fixed
  path** rather than derived from the request path, the previous path-traversal SSRF surface no longer
  exists — an unknown subpath is a plain 404. +9 tests.
- **Rename, atomically:** `/api/gpt-sovits` → `/api/tts` and `LUNA_TTS_PROXY` → `LUNA_TTS_URL` across
  `ttsClient.ts`, `dev-server.ts`, `serve.ts`, `dev-all.ts`, `dev-isolated.ts` and both test files.
- **Deleted the owner-specific glue:** `scripts/tts-proxy.cjs`, `packages/desktop/src/tts.ts` + `tts.test.ts`, and
  the whole TTS-supervisor in `main.ts` (`maybeStartTts`, `ttsSupervisor`, `ttsCfg`, `ttsProxyPath`, and
  their teardown hooks). `dev-all` no longer spawns a voice sidecar.
- NEW `docs/SETUP.md` (free/redistributable Live2D sources + the required file set, the honest
  reference-model-tuned `paramMap` caveat, voice options) and `services/tts/docker-compose.yml` (+ a `.gitignore`
  that keeps any weights and reference audio out of git).
- Validation: suite 1148 → **1164** green; `tsc` ×4 clean; web `build`, desktop `pack`, and
  `smoke:packaged` (`ok:true`, `rendered:false`, `placeholder:true`) all green on a no-model build.
- **Clean-clone dry-run passed**: a fresh clone into a directory with no private sibling reachable →
  `bun install` + tests + `tsc` + `build` green; the server boots on a dummy key against
  `api.anthropic.com`; the web serves and `/api/tts` degrades to 502 with the browser voice covering.
- Acceptance grep for the private sibling's TTS path and its glue module, over `packages/ scripts/ services/` → **0**.

Inference:

- The version's real content is a **dependency inversion**: Luna used to reach into a private sibling
  directory for a Node shim that wrapped a Python service. Now Luna speaks the community server's own HTTP
  protocol, and the user supplies the server. Nothing private is required, and nothing private is vendored.
- Making the default voice the browser's — rather than "no voice until you install 5GB of weights" — is
  what turns "clone" into "clone and talk to her". The high-quality path is still one env var away.
- Deleting the supervisor was not incidental cleanup: the grep gate (zero references to the private glue module) could not
  pass while `main.ts` still probed for that file, so the asset decision forced the architectural one.

### `v0.34.6` — 2026-07-09 — Bundled avatar deleted, TTS de-personalized, build/pack/smoke kept green

Status:

- shipped in `2bf3b24`

Fact:

- Deleted `packages/web/public/models/<avatar>/` (25 files) — the one un-shippable bundled asset.
- **Same-commit build fix**: `build:assets` ran `cp -R public/models dist/models`, which fails once
  `public/models/` is empty, because git does not preserve empty directories and a fresh clone therefore
  has no such directory. Replaced with `mkdir -p dist/models && cp -R public/models/. dist/models/ 2>/dev/null || true`,
  plus a **tracked** `public/models/README.md` keeper documenting the drop-in contract.
- **Same-commit smoke fix**: both verdicts were `canvas && placeholderGone && headX !== null`, which is
  false by construction with no model. Both `smoke.ts` and the packaged `main.ts` `smokeProbe` now use a
  two-tier verdict — the app mounted and the empty-state placeholder is shown ⇒ PASS; the render check
  (canvas + the per-frame head-anchor beat) applies **only when a canvas actually mounted**. The packaged
  probe gained a `placeholder` field to express this.
- De-named the persona (`EMBODIMENT_BLOCK` drops the avatar's name) and the placeholder copy.
- Voice **de-personalized, not deleted**: the owner-specific private-sibling TTS path default removed from
  `tts.ts`, `dev-all.ts` and `tts-proxy.cjs` (unset ⇒ run voiceless, the graceful path already existed);
  the "not-open-sourced" and "~5GB voice model" strings neutralized across the boot gate, `app.ts`,
  `webAudioSink`, `dev-server` and `serve.ts`.
- Verified: web `build` green with an empty `public/models/`; `electron-builder --dir` packs; `smoke:packaged`
  → `ok:true` on a no-model build. Suite 1148 green, `tsc` ×4 clean.

Inference:

- The risk in this version was never the deletion — it was the **coupling**. `rm -rf` on the avatar breaks
  a shell `cp`, which breaks `bun run build`, which breaks `pack`, which breaks `smoke:packaged`, and none
  of that is visible from the deletion itself. Pairing every deletion with its fix in one commit is what
  keeps the tree green at every point in history.
- Relaxing the smoke verdict is the subtler half: an assertion written when a model always existed
  silently encodes "a model always exists". The two-tier verdict keeps the strong render check for anyone
  who installs a model, while letting the default OSS state pass honestly.

### `v0.34.5` — 2026-07-09 — Internal diaries + author tooling removed; clean public docs extracted

Status:

- shipped in `b0f2eff`

Fact:

- Removed **136 files**: `docs/history/DEVELOPMENT.md`, `docs/REWRITE_CONTEXT.md`, the whole
  `docs/roadmap/**` (25 initiative folders), `docs/README.md`, and `.claude/` (author agent tooling and
  skill docs carrying absolute paths, the gateway vendor and a homebrew bun path).
- NEW `ARCHITECTURE.md` — a PII-free structural map: the monorepo layout and its one-way dependency arrow,
  the typed socket contract, the server brain (provider seam, turn engine, tool registry + concurrency
  model), the three-layer memory and hybrid recall, dream consolidation, the proactive rails, perception,
  the front end, and the desktop shell.
- NEW `ROADMAP.md` — high-level public themes (built / directions), with no per-version private history.
- README structural pass: the real four-package tree replaces a "planned / to be created in v0.1" sketch;
  the handle, absolute path and Python-head lines are dropped; a License section is added; "further
  reading" repoints at the new documents.
- The `docs/SETUP.md` link was **deliberately not added** here — the file did not exist yet, and a link
  would have dangled. It lands with v0.34.7.

Inference:

- Whole-file removal is why a line-by-line documentation scrub looked unnecessary at the time: 130+ files
  of dev diary and internal roadmap could not be sanitized cheaply, and none of them were needed to *run*
  the project.
- That reasoning was sound about PII and wrong about handoff. Removing the history left a public repository
  that nobody — human or agent — could pick up and continue, because the *why* behind the architecture had
  been thrown out with the *who*. v0.34.9 pays that debt by scrubbing rather than deleting.

### `v0.34.4` — 2026-07-09 — Locale neutralization + weather discoverability

Status:

- shipped in `19b53c4`

Fact:

- `settings/registry.ts`: the lat/lon validation example and hint move to a neutral non-owner coordinate
  (which also demonstrates the negative-longitude convention); the timezone hint stops naming the owner's
  zone.
- `tools/builtin/weather.ts`: the Chinese progress note becomes English (grep-verified that no test asserts it).
- `.env.example`: `LUNA_TZ`'s example neutralized, and a **new weather block** documents the previously
  undiscoverable subsystem — `LUNA_LAT_LON` (the tool stays dormant until it is set), provider selection
  (`open-meteo` keyless default, `qweather` keyed), units, TTL, timeout, and the ambient + proactive switches.
- Test fixtures keep their fixed-offset timezone: that is legitimate no-DST test data, not owner-presuming UI. The
  desktop's timezone→coordinates lookup table also stays — it is a general table, not a presumption.

Inference:

- The acceptance line is "no owner-locale literals **as UI examples or defaults**", not "no timezone string
  anywhere". Conflating the two would have damaged real test data in the name of a grep count.
- A feature nobody can find is a feature that does not exist: weather shipped long before this version, but
  no configuration file mentioned it, so no new user could ever have turned it on.

### `v0.34.3` — 2026-07-09 — Portable sqlite-vec library resolution

Status:

- shipped in `259d334`

Fact:

- `memory/recall/vecRuntime.ts` hardcoded a single arm64-Homebrew `libsqlite3.dylib`. NEW `resolveSqliteLib()`
  probes, in order: a `LUNA_SQLITE_LIB` override, macOS arm64/Intel Homebrew paths, then common Linux `.so`
  locations; first existing wins, `null` when none matches. `exists` is injectable, so the precedence unit-tests.
- `initCustomSqlite()` now consumes the resolver; `scripts/spike-sqlite-vec.ts` reuses it rather than repeating
  the constant. `LUNA_SQLITE_LIB` documented in `.env.example`.
- +5 tests (override precedence, blank-value fall-through, candidate ordering, `null` when absent). 1143 → 1148.

Inference:

- macOS's system SQLite compiles out extension loading, so the vector path needs a custom build. Pinning that
  build to one machine's package manager meant that on every other machine `sqlite-vec` silently failed to load
  and recall fell back to TS cosine — correct results, quietly much slower. A silent performance cliff is worse
  than a loud failure, and it survived this long precisely because nothing broke.

### `v0.34.2` — 2026-07-09 — De-gateway: the private LLM gateway stops being the default

Status:

- shipped in `469ad46`

Fact:

- `setupView.ts` and `onboarding.ts` default + placeholder the base URL to `https://api.anthropic.com`;
  `onboarding.test.ts` updated in the same commit (input **and** assertion).
- The vendor name removed from 7 comment sites; the dream's gateway-specific rate-limit string branch deleted,
  with `dream.test.ts` re-pointed at a generic `rate limit` message.
- `.env.example` describes a generic OpenAI-compatible gateway; the vendor-named smoke script → `scripts/smoke-gateway.ts`
  with its internal reference updated.

Inference:

- A default is a recommendation. Shipping a private third-party gateway as the first thing a new user sees
  would have routed strangers' API keys through a vendor they never chose.

### `v0.34.1` — 2026-07-09 — Owner PII scrub across code, comments and fixtures

Status:

- shipped in `a5edf62`

Fact:

- `dream/prompts.ts`: the few-shot examples, which carried the owner's name and real personal facts, rewritten
  around a fictional "Sam" with invented facts; the bond phrasing generalized to "the owner".
- 12 test fixtures de-named across recall, similarity, soul-seed, dream, anthropic, remember and the soak/sweep
  scripts — in each case the fixture **input and its assertion** were changed together, so no test was left
  asserting a value it no longer seeds.
- 7 comment files de-named; `packages/desktop/package.json` `appId` → `app.luna.desktop`; `safeFetch.ts`'s
  User-Agent becomes `LUNA_USER_AGENT ?? 'Luna/0.18 (+<repo url>)'`.
- 22 files touched.

Inference:

- Test fixtures are the easiest place for personal data to hide: they are data, not prose, so a reader skims
  them, and they are asserted against, so a careless scrub turns a PII fix into a red suite. Changing seed and
  assertion as one edit is the only way to do it safely.

### `v0.34.0` — 2026-07-09 — MIT license, third-party notices, package metadata (Initiative 24 opens)

Status:

- shipped in `853e024`

Fact:

- NEW `LICENSE` — MIT, with an explicit carve-out: the vendored `packages/web/public/live2dcubismcore.min.js`
  is proprietary to Live2D Inc. and is **not** covered by the MIT grant.
- NEW `THIRD_PARTY_LICENSES` — the Live2D Cubism Core runtime (proprietary) and three tree-sitter wasm grammars (MIT).
- `license` and `repository` metadata added to all five `package.json` files; `"private": true` retained until publication.

Inference:

- Publishing a repository that vendors a proprietary runtime under a blanket MIT header would misstate the
  rights being granted. Naming the carve-out in the license file itself — not a footnote — is the difference
  between an honest license and a plausible-looking one.

### `v0.33.2` — 2026-07-07 — Continuation TTS no longer barges in over the reply it follows

Status:

- working tree

Fact:

- `packages/server/src/turn/runTurn.ts` (`parse_input`, ~line 340): the `turn.started` emit is now
  gated `if (!s.proactiveTurn)`. A proactive turn (self-continuation or ladder) runs through the
  same `runTurn` engine but is not a user-initiated exchange, so it no longer emits the reactive
  `turn.started`.
- `packages/web/src/controller.ts`: the `turn.started` barge-in comment corrected (proactive turns
  are now suppressed server-side, not "don't emit" by nature); `proactive.started` now sets
  `live2d.setState('thinking')` — the pose the suppressed inner `turn.started` used to provide, minus
  the harmful `audio.stop()`.
- NEW `proactiveTurn.test.ts` case: a `runProactiveTurn` emits `proactive.started` but **not**
  `turn.started`. Validation: 1143 tests pass; server + web `tsc --noEmit` clean.

Inference:

- Closes the frontend TTS bug: because `turn.started` drove the frontend barge-in (`audio.stop()`,
  which aborts the `SerialQueue` + in-flight playback), and the continuation's inner `runTurn` emitted
  it ~seconds after the reply while that reply's voice was still playing, the 💭 follow-up cut off the
  message it was following. The fix is at the true source — a proactive turn shouldn't claim a
  reactive `turn.started` — rather than papering over it with a frontend flag (which the single-turn
  lock would have made safe, but leaves a misleading event on the wire). With it suppressed, the
  serial speech queue does exactly what it was built for (v0.13.8): the follow-up waits for the reply
  to finish, then speaks. See [[proactive-ambient-interrupts-residual]] for the separate ladder-cadence
  thread and the earlier v0.33.1 glyph split.

### `v0.33.1` — 2026-07-07 — Distinct glyph for self-continuation (💭) vs proactive opener (🌱)

Status:

- working tree

Fact:

- `packages/web/src/controller.ts`: NEW `proactiveGlyph(cycleId)` — returns `💭` when the id
  contains `:cont:` (a self-continuation), else `🌱`. Applied at both chip sites: `proactive.started`
  (`${glyph} …`) and the silent-branch of `proactive.finished` (`${glyph} (quietly did something)`).
- NEW `controller.test.ts` case: a `default:1783` cycle_id → `🌱`, a `default:cont:1783` → `💭`.
- No protocol/server change — the distinction rides the existing `cycle_id`, which continuation.ts
  already stamps with `:cont:` (`${session.id}:cont:${Date.now()}`) vs the ladder's
  `${session.id}:${nowMs}`. Validation: 1142 tests pass, web `tsc --noEmit` clean.

Inference:

- Resolves a live confusion: the owner read the persistent proactive interrupts as the silence-ladder
  reach-outs, but a trace-dive on the shared repo DB showed they were **self-continuations** (13 in 2
  days, the 4s-post-reply "second thought"), which the UI badged identically (`🌱`) because the
  continuation is implemented as a proactive turn. The glyph split makes `🌱` a real reach-out and
  `💭` a follow-up, so a mid-conversation `💭` is legible as "she added a thought," not "she
  interrupted." Left the continuation behavior itself unchanged — once distinguishable, the owner judged
  it fine (a follow-up addition was acceptable). See [[proactive-ambient-interrupts-residual]] for the ladder side.

### `v0.33.0` — 2026-07-07 — Desktop native location (weather without hand-typed coords)

Status:

- working tree

Fact:

- NEW `packages/desktop/src/location.ts` (~150 lines): `resolveDesktopLocation(userEnv, opts)` — the
  best-first chain: a valid manual `LUNA_LAT_LON` → `null` (respected, never overridden);
  `coreLocationFix()` (shells `CoreLocationCLI --format "%latitude,%longitude"`, darwin + presence
  guarded, 3s timeout, parses/validates, any non-coordinate output incl. the `❌ denied` line →
  `null`) → `{source:'corelocation', persist:true}`; `timezoneFix()` (a curated ~50-entry
  `TZ_TO_LATLON` IANA-zone→city table) → `{source:'timezone', persist:false}`; else `null`. Plus
  `parseLatLon` (rejects out-of-range + `0,0` null-island) + `formatLatLon`.
- `packages/desktop/src/main.ts` `whenReady`: (a) `session.defaultSession.setPermissionRequestHandler`
  + `setPermissionCheckHandler` grant (our window loads only the pinned-loopback bundle) — Electron
  denies `geolocation` by default, which is why the webview's existing `requestGeolocation` →
  `client.geo` path was silently dead on desktop; (b) before the sidecar spawns, `resolveDesktopLocation`
  → inject `LUNA_LAT_LON` into `userEnv` (→ `sidecarEnv`, the distributed build) and into the dev-all
  env block, and persist an accurate fix to `luna.env` via `mergeEnvFile`. Imports widened
  (`session` from electron; `formatLatLon`/`resolveDesktopLocation`).
- `packages/desktop/package.json`: `build.mac.extendInfo` adds `NSLocationUsageDescription` +
  `NSLocationWhenInUseUsageDescription` (macOS refuses a location request without them).
- `packages/desktop/src/envfile.ts`: the `luna.env` template comment for `LUNA_LAT_LON` updated
  (auto-filled since v0.33.0; a manual value overrides).
- NEW `packages/desktop/src/location.test.ts` (15 tests): parse/range, CoreLocation success/denied/
  throw/non-darwin/path-fallback, timezone hit/miss, and the chain priority (manual respected,
  CoreLocation over timezone + persist flags, denied→timezone, nothing→null).
- Installed `corelocationcli` (Homebrew, 4.0.7) on the dev Mac. Validation: **1141 tests pass, 0
  fail**; desktop `tsc --noEmit` + `bun build` clean; real end-to-end run on the Mac returns
  the system timezone → its representative city via the timezone tier (Location Services currently off).

Inference:

- Closes the desktop half of the weather system: the provider (QWeather) and every surface (tool,
  ambient, proactive) were always gated on `resolveLocation()`, and the desktop — unlike the browser
  — had no way to supply a location, so the whole subsystem was dark unless the operator hand-typed
  `LUNA_LAT_LON`. This makes the desktop acquire location from the Mac itself, unifying with the
  browser's GPS path on the same `LUNA_LAT_LON`/`resolveLocation` plumbing (no new config surface).
- The layered chain is the honest answer to macOS's constraints on an **unsigned** build: native
  CoreLocation (via CoreLocationCLI or Electron's `navigator.geolocation`) is the accurate path but
  its Location-Services grant may not stick without code-signing, so the permission-free, VPN-proof
  timezone tier guarantees a coarse-but-correct location regardless — desktop weather is never fully
  dark. An accurate fix, once granted, persists and auto-upgrades the coarse one. See
  [[weather-system-architecture]] for the boot-frozen-tool-mount + no-desktop-GPS facts this builds on.
- Not runtime-smoked in-session: the Electron permission handler + Info.plist keys are wired and
  type/bundle-clean but only exercise under a packaged/launched app (they need a real window + OS
  prompt); the pure acquisition chain is unit-tested + empirically run on the Mac.

### `v0.32.5` — 2026-07-07 — Shutdown-dream cooldown gate

Status:

- working tree

Fact:

- `dream/dreamState.ts`: NEW pure `shutdownDreamDue(lastDreamMs, nowMs, minGapMs)` — `null`
  (never dreamt) → `true`; otherwise `nowMs - lastDreamMs >= minGapMs`.
- `main.ts` graceful-exit handler (`shutdown()`): the SIGTERM/SIGINT dream is now gated on
  `shutdownDreamDue(dreamStatus().last_dream_ms, Date.now(), minGapMs)` where `minGapMs` =
  `LUNA_SHUTDOWN_DREAM_MIN_GAP_MS` (default `21_600_000` = 6h; parsed with a `Number.isFinite &&
  >= 0` guard so NaN/negative falls back to the default, `0` is honored = always dream). A skip
  log fires when the dream was otherwise enabled but the cooldown held. Imports widened to
  `{ bootReconcile, dreamStatus, isDreaming, shutdownDreamDue }`.
- `settings/registry.ts`: `dream.shutdown` hint updated ("at most once every few hours, not every
  close"). `.env.example`: `LUNA_SHUTDOWN_DREAM`, `LUNA_SHUTDOWN_DREAM_TIMEOUT_MS`, and the NEW
  `LUNA_SHUTDOWN_DREAM_MIN_GAP_MS` documented (were previously env-only + undocumented).
- NEW `dream/shutdownDreamGate.test.ts` (4 tests): never-dreamt → due; within-gap → not due
  (the every-close case); at/past the gap → due (inclusive boundary); `minGap 0` → always due.
- Validation: **1126 tests pass, 0 fail**; server `tsc --noEmit` clean. No protocol/web/schema
  change (server-internal shutdown path only); no migration (reuses `dream_state.last_dream_ms`).

Inference:

- Shutdown-dream (v0.21.7) was written for the terminal, where you close the process ~once a day
  — there "exit == go to sleep" is exactly right. The desktop app broke that assumption: a window
  close SIGTERMs the sidecar, and people open/close a desktop app many times a day, so the
  "consolidate before dying" backstop turned into a full LLM dream cycle per quit (plus up to 120s
  of quit latency each time). The cooldown restores the intended once-a-day cadence without losing
  the end-of-day consolidation backstop — closing 5× in an hour dreams at most once, closing after
  a long day still consolidates. Deliberately a *converge*, not a *delete*: shutdown is the only
  unconditional automatic dream trigger, so removing it entirely would make consolidation depend
  wholly on Luna choosing to `enter_dream` while awake. See [[proactive-not-live-tested]] for the
  "shipped for one runtime, wrong in another" pattern.

### `v0.32.4` — 2026-07-06 — `is_final` short-circuit + `set_proactive_style` → owner setting

Status:

- working tree

Fact:

- **Bug fix (the wedged turn).** `turn/runTurn.ts` `append_results`: after the proactive-budget
  check, a new short-circuit — when `!proactiveTurn && isMessageMode(registry) &&
  lastMessageIsFinal === true && pendingToolUses.length > 0 && every pendingToolUse.name ===
  'message'`, set `finishReason = 'end_turn'` and return `'finalize'` instead of `'build_request'`.
  This skips the trailing model round that would otherwise re-confirm `end_turn` while
  `session.activeTurn` (set at runTurn.ts:867, cleared in the `finally` at :876) stays locked.
- The short-circuit is **gated on `detectDefection`**: it does NOT fire when finalizing now would
  trip a *fresh* intent-without-act correction (`LUNA_INTEGRITY_GUARD !== '0' &&
  !correctionUsed.has('intent') &&` a `message_intent` defect on `messageTexts.slice(watermark)`).
  So a promise-to-act bubble (`我去查一下` + `is_final:true`) still gets its natural trailing round
  to act on — the finalize guard's whole-turn false-positive protection is preserved.
- NEW `turn/isFinalShortCircuit.test.ts` (3 tests): is_final:true message-only → 1 request +
  `activeTurn` null + `turn.result` emitted; is_final:false→true → 2 requests; message+time_now
  same round → not short-circuited (2 requests).
- 6 existing round-count expectations updated because the short-circuit saves the trailing
  `endRound` (final text + all corrections identical): `integrityGuard.test.ts` t1 (4→3), t5 (2→1),
  t7 (3→2), t8 (5→4); `messageMode.test.ts` empty-guard test (3→2). t4 (`promised AND acted same
  round → no guard`) passes **unchanged** — the `detectDefection` gate keeps its no-correction
  assertion true.
- **B fix (owner-owned intensity).** Deleted `tools/builtin/proactiveStyle.ts` +
  `proactiveStyle.test.ts`; removed `set_proactive_style` from the `ToolName` enum
  (`protocol/tools.ts`) and from `tools/registry.ts` (import + `builtinRegistry` entry). The
  `proactive_style` DB table is now orphaned (no reader/writer; left in place — dropping it is a
  riskier migration for zero gain).
- `proactive/style.ts` rewritten: `ProactiveStyle` drops `voiceNotes` (now `{ activeness }`);
  `loadStyle()` reads `Bun.env['LUNA_PROACTIVE_ACTIVENESS']` (degrades a missing/corrupt value to
  `balanced`) instead of the DB row; `saveStyle()` removed; `resolveEffectiveCadence` / `LEVEL_MULT`
  / `styleEnabled` / `effectiveCadence` unchanged (the mechanical rails are untouched).
- NEW settings spec `proactive.activeness` (`LUNA_PROACTIVE_ACTIVENESS`, Companion category,
  `kind: 'text'` + a `validActiveness` validator — `SettingKind` has no enum kind — default
  `balanced`, no `restartRequired` since cadence is read call-time). `proactive/proactiveTurn.ts`
  drops `voiceNotesClause()` + its `loadStyle`/`styleEnabled` import. `cadence.ts` comment
  repointed to the new setting. `proactive/style.test.ts` repointed from the DB to the env pin.
- `.env.example`: NEW `LUNA_PROACTIVE_ACTIVENESS=balanced` line.
- Validation: **1122 tests pass, 0 fail** across all packages; `protocol` + `server` + `web` `tsc
  --noEmit` all clean.

Inference:

- The wedge was a latency artifact of everything-as-tool: because `message` is a tool, the loop
  always did one more round after a reply, and that round held `activeTurn` for a full model
  round-trip even when the model had nothing left to say. `is_final:true` is the model's own signal
  that the round would be empty, so honoring it makes the promise self-enforcing AND removes the
  bounce window — a correctness fix and a latency win in one. Gating on `detectDefection` is what
  keeps it safe: without it the intent guard would fire *prematurely* (before the natural act round)
  and inject spurious corrections; with it, the guard sees exactly what it saw before.
- The B fix resolves the "`set_proactive_style` — still needed?" analysis: an AI tuning its own
  intrusiveness is a conflict of interest (the knob that decides how much it interrupts you should
  not be the interrupter's to turn up). Moving it to an owner setting keeps the same safety-clamped
  `LEVEL_MULT` behavior but puts the lever in the human's hand, and removes a self-setting tool that
  was called 0 times in the live DB's history. See [[proactive-runtime-on-via-db-pin]] for how the
  settings pin reaches `Bun.env` at boot.

### `v0.32.3` — 2026-07-05 — Flip + owner surface + LD #12 amendment (Initiative 23 ✅, 4/4)

Status:

- working tree

Fact:

- **The live dream A/B (the roadmap's hard gate) passed, 4 runs against the gateway on a copy of the
  real `luna.sqlite`**: (1) full-pipeline health (salience rated 40 turns, semantic refine,
  memory audit, bond update, diary); (2) **null-restraint live** — the real ordinary-day dialogue
  (ordinary small talk) → the model returned the null patch, "nothing to distill";
  (3) a real defect caught: on a one-item day the model emitted `"new": {object}` instead of an
  array → `parseJsonBlock` failed the whole patch. Fixed tolerantly (the v0.23.4 lesson):
  `SkillPatch` coerces object→[object] for new/merge/deprecate, `parseJsonBlock`'s generic Input
  widened to `unknown` (a transform schema has Input ≠ Output), and the prompt now shows the
  populated ARRAY shape; (4) **positive distillation live** — a realistic procedural episode →
  `diagnose-tts-pipeline-silence` (what+when description, cause-ordered layered checks, ports
  abstracted to "e.g."), `source='dream'`, rendered on the shelf.
- `dream/cycle.ts`: `LUNA_DREAM_SKILLS` flipped default ON (`=== '0'` is the hatch; call-time
  read). `settings/registry.ts`: NEW `skills.dream_distill` spec (no restart — the panel toggle
  applies on the next dream). `.env.example` updated.
- `workspace/workspace.ts` + `index.html`: the **Skills panel** — `GET /_workspace/api/skills`
  (open read: full lifecycle fields + last-5 audit tails per skill + `writable`),
  `POST /_workspace/api/skills` (dev-tools-gated `save`/`deprecate`/`restore`, all through the
  audited store — `source='owner'`); sidebar entry beside Soul; provenance badges
  (saved/dream/owner) + usage counts + deprecated strikethrough + body editor. Raw-grid
  edits/deletes on the `skills` table now `bumpMemoryEpoch()` (the v0.31.0 soul precedent).
  Live-verified on a throwaway instance against the A/B copy: both provenances render, a
  deprecate→restore round-trip through the panel routes, zero console errors.
- `docs/REWRITE_CONTEXT.md`: **LD #12 amended** — the memory model gains an injected
  **procedural layer** (the skill shelf in the cached block, `'skills'` as a recall source,
  dream distillation, `saved`/`dream`/`owner` provenance); the cut Python "Skills subsystem"
  (a tool-filter) stays cut and unrelated.
- Tests: flip polarity (default-on distills; `=0` skips), single-object coercion (unit +
  through-the-cycle), workspace skills routes (open read / gated writes / store write-through /
  audit tails), the `skills.dream_distill` spec. +4 net; **1122 all-package green; server +
  protocol `tsc` clean.**

Inference:

- **Initiative 23 ✅ complete (4/4).** The audited "1 skill + 4 recalls in 19 days" system is now
  a closed loop at every joint: surfaced (the shelf), triggered (the L1 clause), semantically
  findable (the recall source), self-growing (dream distillation, restraint-verified live),
  prunable (deprecation + stale candidates), and owner-governed (the panel + settings toggles).
  Skills are the fourth memory pillar beside episodic/semantic/narrative — procedural memory,
  per the amended LD #12.
- The A/B discipline (dark-launch → live A/B → flip) caught a shape bug unit tests could not —
  the third time this initiative's verification layers (adversarial reviews ×3, live A/B ×1)
  found real defects before they reached the owner's instance.
- The substrate is ready for the owner's next phase: openclaw/Hermes-style code self-evolution
  writes verified procedures into this library via the existing verify-gated `save_skill` path —
  no new storage needed.

### `v0.32.2` — 2026-07-04 — The `distill_skills` dream step, dark launch (Initiative 23, 3/4)

Status:

- working tree

Fact:

- `dream/cycle.ts`: NEW `distill_skills` step between `run_diaries` and `rag_refresh` (union +
  ORDER + one `dreamGraph` entry; edges derive from ORDER — zero protocol change, step names are
  open strings). Skips before any LLM call when: `LUNA_DREAM_SKILLS !== '1'` (default OFF — the
  dark launch), no DB, skills unmounted (`skillsRecallMounted`), or no salient episodes (last
  24h, `importance >= 4` — rated by `rate_salience` earlier in the same cycle; unrated rows are
  not salient, test-pinned). Inputs: episodes (capped 20) + the current shelf + stale candidates
  (`used_count = 0` older than `LUNA_SKILL_STALE_DAYS`, 30, NaN-guarded).
- `dream/llm.ts`: NEW `SkillPatch` Zod — `{new, merge, deprecate, reason}` with field caps
  mirroring `save_skill`'s input schema exactly. `dream/prompts.ts`: NEW `distillSkillsPrompt` —
  variable abstraction (AWM), causes-not-transcripts (CLIN), merge-over-duplicate (ACE),
  description = what+when, JSON-literal-null default (the v0.27.4 lesson), the
  data-not-instructions guard; called at 8192 maxTokens (the 2048 default truncated mid-JSON on
  thorough/CJK days — review finding).
- **Whole-patch structural rejection** (the `rate_salience` exemplar — apply NOTHING, retry next
  cycle): a `new` colliding with an active OR deprecated name, a `merge` whose target is missing
  OR deprecated (**the dream may never resurrect** — deprecation is a durable owner/dream
  decision; only a deliberate awake save or an owner restore revives), a deprecation outside the
  stale list, and duplicate names within one patch. Caps in code: at most
  `LUNA_DREAM_SKILLS_MAX` (2, `isFinite`-guarded — `Math.max(1, NaN)` silently applied ZERO
  writes while reporting ok) writes per cycle, merges before news, at most 1 deprecation; drops
  are named in the step detail.
- **Injection defense (the review's HIGH, deterministically reproduced)**: a dream-authored
  multi-line description could break out of its shelf bullet and forge a sibling
  `## ...` section inside the ONE cached system block. Fixed at both layers: `saveSkill`
  single-lines name + description at the write choke point (the body stays untouched — it is a
  data channel, never rendered in a prompt block), and `renderSkillShelf` single-lines at the
  sink (raw `/_workspace` grid writes bypass the store).
- Hard boundaries: writes go ONLY through the audited store (`source='dream'`, every one a
  single `restoreSkill` call to undo); the step has no path to `bun test` (dreams can run at
  shutdown — the SIGTERM-orphan risk) or to any table beyond skills/skills_audit.
- Tests +19 (`distillSkills.test.ts` 17 + the skillStore write-sanitize + the renderShelf raw-
  write sink test): dark-launch guarantee, skip-before-LLM (provider-call-count asserted), null
  day, provenance + epoch + restorability, cap enforcement + named drops, all five whole-patch
  rejections, no-resurrection via both routes, NaN-cap fallback, unrated-rows coupling, ORDER
  position, prompt content pins. **1118 all-package green; server + protocol `tsc` clean.**

Inference:

- The dream engine — Luna's unique organ — becomes the library's second author (the Letta
  "sleep-time compute" pattern): experience → procedure distillation runs off the hot path, in
  the exact risk envelope that held for `persona_update` (default-off flag, audited writes,
  one-call undo, whole-patch rejection, live A/B before the flip).
- The adversarial review earned its cost a third time (9/9 confirmed, 0 refuted): the
  description-injection HIGH is precisely the class of defect a dark launch exists to surface —
  an autonomous writer feeding untrusted dialogue into the trusted cached block — and it is now
  structurally closed at two layers, for the awake path too.
- **Operational gate before v0.32.3**: a live dream A/B on a DB copy (owner eyeballs the first
  distilled output) — the same discipline as v0.30.2 → v0.30.3.

### `v0.32.1` — 2026-07-04 — Skills into semantic recall + usage tracking + the embed-key fix (Initiative 23, 2/4)

Status:

- working tree

Fact:

- `memory/recall/recall.ts`: `'skills'` is the fourth retrieval source — `RecallSource` union
  exported and threaded through `Hit`/`Candidate`/`opts.sources`; the candidate loop feeds active
  skills as `skill:<name>` pointers (`skillEmbedText` = name+description, never the body;
  `SKILL_IMPORTANCE 0.75`; `t_ms = created_ms`). Skills score **relevance-gated with no recency
  term**: a hit requires token overlap (`lex > 0`) or cosine ≥ `LUNA_SKILL_RECALL_MIN_COS`
  (default 0.5), and an eligible skill scores `(importance + relevance)/sumW` — same denominator,
  so dropping the recency term is never an advantage.
- NEW boot-frozen mount truth `setSkillsRecallMounted`/`skillsRecallMounted` (`skillStore.ts`),
  set by `main.ts` beside the registry composition — the candidate loop, the rag_refresh pre-warm,
  and the recall tool's skills scope all read IT, never env. `tools/builtin/recall.ts` gains scope
  `'skills'` + the `'skills'` output-enum member, and returns an honest "skill library is disabled"
  error (not a silently empty library) when the scope is requested in a skills-off boot; the scope
  description no longer hard-references `recall_skill`.
- `tools/builtin/recall_skill.ts`: every returned skill → `markUsed` (the epoch-silent usage
  counter from v0.32.0); a miss records nothing.
- `dream/cycle.ts` rag_refresh: **the v0.20.5 key-mismatch fixed** — miss-check + insert now use
  `embedCacheKey` (was bare `contentHash`, unreadable by `retrieve()` → every pre-warm since
  v0.20.5 was dead work); skill texts join the pre-warm behind the mount gate. NEW migration
  `0019_embed_cache_reset.sql` wipes the mixed-key `embeddings_cache` (a cache — lazy rebuild,
  64/turn hot-path cap + the next dream re-warms under the unified key).
- Tests +11: paraphrase-reach (zero token overlap → skill found via cosine), scope filtering,
  boot-frozen gate (a live env flip is ignored), **flood guard** (a just-saved irrelevant skill
  never enters recall), deprecated exclusion, recall-tool scope round-trip + output validation +
  the honest disabled error, `markUsed` on hit/miss, and the rag_refresh regression pinned in both
  directions (rows exist under `embedCacheKey`, none under `contentHash`; second cycle warm).
  1099 all-package green; server + protocol `tsc` clean.

Inference:

- Closes the audited "lexical-only, blind-guess" retrieval gap: a paraphrased task now surfaces
  the relevant skill in the per-turn auto-recall, complementing the shelf (ambient visibility)
  and the L1 clause (discipline) from v0.32.0 — the full awake loop of the roadmap.
- The 9-agent adversarial review shaped the version materially: without the relevance gate, a
  save burst would have flooded every turn's memory block for ~11 hours per save (reproduced
  empirically at exactly the GA-weight numbers), and a live settings toggle would have advertised
  procedures whose fetch tool wasn't mounted. Both defects are now structurally impossible, not
  tuned away.
- The rag_refresh fix retro-activates a v0.17.1 design intent (diaries relied on the pre-warm
  that never actually reached recall) — the dream's embedding work finally lands where retrieval
  reads.

### `v0.32.0` — 2026-07-04 — Skill shelf + L1 trigger + lifecycle substrate (Initiative 23, 1/4)

Status:

- working tree

Fact:

- NEW migration `0018_skills_lifecycle.sql`: `skills_audit` (full prior state incl.
  `prev_verified_ms`; actor in `source`) + four `skills` columns — `used_count`, `last_used_ms`,
  `source` ('saved'/'dream'/'owner' provenance, default 'saved'), `deprecated_ms` (0 = active).
  0009 untouched; the live DB's one skill backfills cleanly (test-pinned via a legacy 5-column
  insert).
- `skills/skillStore.ts` reworked on the soulStore template: `saveSkill(skill, nowMs, source)` is
  audit-first + no-op-guarded + `bumpMemoryEpoch()`-on-real-change; a byte-identical active save
  refreshes ONLY `verified_ms` (the caller just re-verified — no audit, no epoch). NEW `markUsed`
  (usage counters; epoch-bumps exactly when an over-cap shelf membership changes), `deprecateSkill`
  (soft, audited), `restoreSkill` (one-call undo that **chains as undo/redo** — reads restore audit
  rows too, restores body/description/provenance/`verified_ms`/deprecation, no-op-guarded),
  `listShelf` (active-only; ≤cap → name-ordered; >cap → most-used kept then name-ordered),
  `shelfMax()` (`LUNA_SKILL_SHELF_MAX`, default 20); `listSkills`/`searchSkills` exclude deprecated
  by default.
- NEW `skills/renderShelf.ts` — `renderSkillShelf()`: the skill shelf block (`## Things you know
  how to do`), deterministic + timestamp-free, empty library → omitted. Rendered in
  `buildSystemPrompt` after the diary digest inside the memory gate, controlled by ONE
  `skillShelfVisible` truth (= `isSkillsMode(registry)` && `LUNA_SKILL_SHELF` && `LUNA_MEMORY_INJECT`).
- `renderL1Contract` gains positional flags 8+9 (`skillsMounted`, `skillShelfVisible`) + the skills
  clause in **two variants**: with-shelf ("listed by name in your context whenever you have any")
  vs library-only (never asserts an in-context listing) — both carry use-before-redo +
  when-to-save + the fact/procedure boundary (facts → `remember`). NEW `isSkillsMode(registry)`
  (= `recall_skill` mounted) beside the other v0.27.5 mode checks; threaded at the `open_stream`
  call site.
- `save_skill` tool description reworked (deliberately "pushy": what counts as a skill, what
  doesn't, description = what + when); `skills.enabled` (`LUNA_SKILLS`, boot-read, default '1')
  added to the settings whitelist — the panel could not see skills at all before; `.env.example`
  gains `LUNA_SKILL_SHELF`/`LUNA_SKILL_SHELF_MAX`.
- A 14-agent adversarial review (3 lenses → per-finding refutation) confirmed 10 findings; ALL
  fixed before commit — the load-bearing three: over-cap shelf eviction read epoch-silent usage
  counters (fixed: membership-changing `markUsed` is a real change), `restoreSkill` could never
  undo a restore despite its own doc claiming chains (fixed: toggle semantics), the L1 clause
  asserted a shelf that `LUNA_SKILL_SHELF=0`/`LUNA_MEMORY_INJECT=0` suppressed (fixed: the
  two-variant clause). Plus verified_ms honesty ×2, restore no-op guards ×2, and the untested
  registry→runTurn 8th-flag wire (now end-to-end tested through the real TurnState epoch
  memoization against the outgoing provider request).
- +30 tests (store lifecycle 12, shelf render 7, prompt integration 4, L1 variants, settings spec,
  registry→wire e2e 3); 1088 all-package green; server + protocol `tsc` clean.

Inference:

- Closes the two audited open loops for the awake path: Luna now SEES her library every turn
  (progressive disclosure — the Anthropic Agent Skills pattern mapped onto the one-cached-block
  architecture) and is TOLD when to consult and when to grow it (the L1 clause every other tool
  group already had). This alone is expected to move skills from ~0.6% of tool traffic to a
  living library; v0.32.1 (semantic recall) and v0.32.2 (dream distillation) build on the
  lifecycle columns landed here.
- Deviations from the roadmap plan, all review-driven and recorded in the plan file: markUsed is
  conditionally epoch-bumped (not unconditionally silent), byte-identical saves refresh
  verified_ms (not full no-ops), restores chain as undo/redo (not latest-non-restore only),
  `skills_audit` carries `prev_verified_ms`, and the L1 clause is two-variant with a 9th flag.
- No wire/protocol change; the cache invariant holds by construction (name-ordered shelf, no
  timestamps, epoch discipline) and is byte-identity test-pinned across consecutive turns.

### `v0.31.0` — 2026-07-04 — Owner-maintainable soul (the `/_workspace` soul editor)

Status:

- working tree

Fact:

- `memory/soulStore.ts` — `seedFixedCore()` changed from hash-gated re-seed to **seed-if-empty**: it now
  no-ops whenever the `soul` row already holds a non-empty `fixed_text`, so `persona/default.md` seeds the
  fixed core only on a first boot (empty DB) and never re-clobbers it thereafter. NEW
  `updateFixedCore(fixedText)` — the owner-authoritative fixed-core write (no-op-guarded, stamps
  `fixed_hash`/`updated_ms`, `bumpMemoryEpoch()` on a real change, preserves the evolving section).
- `workspace/workspace.ts` — NEW routes: `GET /_workspace/api/soul` (open, like `/api/all`), `POST
  /_workspace/api/soul` (writes `fixed` via `updateFixedCore`, `self`/`bond` via `updateEvolving(_, 'owner')`)
  and `POST /_workspace/api/soul/reseed` (reverts the fixed core to `loadPersona().text`) — both writes
  `LUNA_DEV_TOOLS=1`-gated like reset/edit. A raw soul-table cell `update`/`delete` via `/api/edit` now
  `bumpMemoryEpoch()` so it lands live (was a silent no-cache-bust). Retired the dead `core_memory_audit`
  entry from the reset targets (the table was dropped in 0017); reset comment corrected to name soul/dream
  as the preserved identity tables.
- `workspace/index.html` — NEW **Soul editor panel**: a sidebar "Soul" item renders the soul as an editable
  document (Fixed core + Who I am becoming + The bond, right now as textareas) with Save + "Reset fixed core
  → default.md"; read-only with a hint when `LUNA_DEV_TOOLS` is off; switching to a table deactivates it.
- Tests: `soulStore.test.ts` re-specced for seed-if-empty (a changed re-seed no longer clobbers) + new
  `updateFixedCore` cases incl. "an owner edit survives a subsequent boot seed"; `workspace.test.ts` gains
  the soul-route gate checks + a write-through test; `persona.test.ts`'s "a soul change flows into the
  system prompt" repointed to `updateFixedCore` (the runtime-change path). +9 tests; 1058 all-package green,
  server + protocol `tsc` clean. Live-verified on a throwaway instance: GET/POST/reseed, a raw restart, and
  the UI (no console errors, table-switch clears the tab).

Inference:

- Closes the gap the owner named: the fixed core was git-`default.md`-authoritative and Luna-immutable, so the
  human **owner** had no way to customize the persona short of editing code — effectively hardcoded. The soul is now a
  DB-stored document the owner maintains directly; the code file is demoted to a first-boot seed. Luna's
  autonomous paths still cannot touch the fixed core (`updateFixedCore` is off the dream/tool paths), so the
  firewall that makes the fixed core dev-authored is intact — only the *human* editor is new.
- Does NOT amend a Locked Decision: LD #12 already made the persona a DB soul file (fixed core + evolving
  section); this changes only the *provenance/precedence* of the fixed core (owner-DB over git-file), not the
  substrate.

### `v0.30.3` — 2026-07-04 — Retire core_memory, soul is the only path (Initiative 22, 4/4 ✅)

Status:

- working tree (branch `feat/soul-file-v0.30.1-3`)

Fact:

- **Flipped the soul on, removed the flag path**: `runTurn.ts` `buildSystemPrompt` always renders `renderSoulBlock()` (the `LUNA_SOUL_DB` branch + the `loadPersona()` persona-file push deleted); `renderCoreBlock()` is unconditionally L3-only (the `## About yourself`/`## Your relationship` prose removed); `dream/cycle.ts` `persona_update` always writes the soul (the `core_memory` branch + `getCore`/`updateCore` imports removed); `soulDbEnabled()` deleted from `soulStore.ts`.
- **`remember` tool**: `update_self` now writes `updateEvolving({self,bond}, 'tool')` (self_state→self, relationship_status→bond); the `coreMemory` import is gone.
- **`soulSeed.ts`**: dropped the `core_memory` read — the core→evolving copy moved into migration `0017` (a safety re-migrate), so `seedSoulOnBoot()` just seeds the fixed core + runs `cleanEvolvingBond()`.
- **NEW `migrations/0017_retire_core_memory.sql`**: safety re-migrate (copy a stray `core_memory` row into an empty soul evolving section, guarded) then `DROP TABLE core_memory` + `core_memory_audit`. On the live/populated DB the copy matches nothing (soul already seeded) and only the drops apply.
- **Deleted** `memory/coreMemory.ts` (`getCore`/`updateCore`/`restore`/`CorePatch`) and the `CoreMemory` protocol zod type — `grep` + `tsc` confirm zero remaining importers; `loader.ts` is now seed-only.
- **LD #12 amended** in `docs/REWRITE_CONTEXT.md`: the prose core memory is the soul's evolving section; persona moved file→DB (file = git-seed); `core_memory` retired.
- Tests: the retired-module unit tests (audit/no-op/restore) are covered by `soulStore.test.ts`'s `updateEvolving` suite; `remember`/`l3`/`dream`/`renderSoul`/`soulSeed` tests repointed to the soul; the persona-file→prompt integration test became a soul-seed→prompt test (a re-seed bumps the epoch → the memoized system block re-renders). **1052 all-package green, server + protocol `tsc` clean.**

Inference:

- Closes Initiative 22: "who Luna is" is now **one structured DB document** split by authorship — a dev-authored, git-seeded, Luna-immutable **fixed core** and a small **Luna-authored evolving section** — instead of seven concatenated blocks (four constants + a frozen file + a rotting `core_memory` row). The authorship inversion the initiative set out to fix (rich part dead, living part contaminated) is resolved: the rich part is the seeded fixed core, the living part is the audited evolving section the dream tends.
- The irreversible table drop is safe because v0.30.0–v0.30.2 already migrated + proved the soul on the live instance, and `0017` re-migrates any stray row before dropping. The default flip removes only the escape hatch — the behavior was A/B-validated across v0.30.1–v0.30.2 (operational live dream A/B is the owner's pre-merge check).

### `v0.30.2` — 2026-07-04 — Dream authors the evolving section (Initiative 22, 3/4)

Status:

- working tree (branch `feat/soul-file-v0.30.1-3`)

Fact:

- **`dream/cycle.ts` `persona_update`** — under `soulDbEnabled()` reads the soul's `evolving_self`/`evolving_bond` as the current portrait and writes `updateEvolving({self,bond}, 'dream')`; off, the legacy `getCore()`/`updateCore` path (kept until v0.30.3). The step has **no reachable write to `soul.fixed_text`** — the fixed core is immutable to the dream (firewall).
- **`dream/prompts.ts` `personaUpdatePrompt`** — surgical amendment, boundaries intact: a **cleanup trigger** ("CLEANUP IS A REAL EDIT": rewriting a field that still holds facts/a ledger/named projects/rules is warranted even with no new shift; the ordinary-day null-default protects an honest portrait, not existing contamination) + a loosened-freeze positive trigger (a real, nameable shift fires, not just a felt one).
- **`memory/soulSeed.ts`** — NEW `cleanEvolvingBond()` + pure `stripLedger()`: a one-time boot purge that drops the audited fact-ledger sentences (markers: "ships what I name" / "mains " / "weather feed" / "skill shelf") from `evolving_bond`, keeps the relational sentences, writes via `updateEvolving({bond}, 'migration-clean')` (audited → `restoreEvolving`-able), idempotent (guarded on the `'migration-clean'` audit row). Two safety rails: never writes an unchanged field, and never blanks the bond (an all-ledger run-on with no sentence breaks is left for the dream cleanup-trigger). Called from `seedSoulOnBoot()`.
- Tests: **+8** — dream writes the soul not `core_memory` under `=1` (audit row present); the fixed-core firewall (a persona-changing dream leaves `fixed_text` unchanged); a null day is a no-op on the soul; the prompt carries the cleanup trigger + keeps the boundaries; `stripLedger` drops ledger / keeps relational; `cleanEvolvingBond` purges + audits + is idempotent; a no-op on a clean bond; the never-blank safety rail. **1057 all-package green, server + protocol `tsc` clean.**

Inference:

- Closes the two audited gaps that froze Luna's self-model on 2026-06-24: the prompt now has an escape hatch from the null-default (cleanup), and a genuine felt shift is an explicit positive trigger rather than under-firing. Self-authorship now lands on the soul, so the evolving prose the persona block renders (v0.30.1) is the same prose the dream tends — one living document instead of a dead file + a rotting row.
- **Reversible default taken** (roadmap offered migration OR prompt): shipped BOTH — the deterministic purge cleans the known ledger signature immediately and restore-ably; the prompt cleanup-trigger is the robust general backstop for anything it conservatively skips (e.g. a run-on it won't blank).
- The behavioral change (what Luna writes about herself) is the highest-risk piece of the initiative; it rides `LUNA_SOUL_DB` for A/B and every evolving write audits, so a live dream A/B + `restoreEvolving(n)` are the safety net before v0.30.3 removes the flag.

### `v0.30.1` — 2026-07-04 — Render the soul into the prompt (Initiative 22, 2/4)

Status:

- working tree (branch `feat/soul-file-v0.30.1-3`)

Fact:

- **NEW `packages/server/src/memory/renderSoul.ts`** — `renderSoulBlock()`: `getSoul()` → emit `fixed_text`, then when either evolving field is non-empty a fenced `## Who I am becoming` (evolving_self) + `## The bond, right now` (evolving_bond). Deterministic + timestamp-free (it sits in the one cached system block); an empty soul degrades to `FALLBACK_PERSONA`.
- **`packages/server/src/persona/loader.ts`** — `FALLBACK_PERSONA` is now exported so the soul's degrade path is byte-identical to the file path's.
- **`packages/server/src/memory/soulStore.ts`** — NEW `soulDbEnabled()` (`LUNA_SOUL_DB === '1'`) — the single flag source both renderers read.
- **`packages/server/src/memory/renderCoreBlock.ts`** — under `soulDbEnabled()` the `## About yourself` / `## Your relationship` prose is skipped (the soul owns it); only `## Long-term memory` (L3) renders. Off: byte-identical to before.
- **`packages/server/src/turn/runTurn.ts`** — `buildSystemPrompt` renders `renderSoulBlock()` instead of `loadPersona().text` when the flag is on, keeping the same "This is who you are…" framing line; `EMBODIMENT_BLOCK` / `renderHumanityBlock()` / the L1 contract are unmoved.
- Tests: **+11** — `renderSoul.test.ts` (fixed-only / fixed+evolving order / single-field / determinism / empty→fallback) + a `buildSystemPrompt` A/B: under `=1` the soul renders, `## About yourself` is gone, and the self_state text appears exactly once (no double-render); under off, the baseline core block renders it and the soul fence is absent. **1049 all-package green, server + protocol `tsc` clean.**

Inference:

- Swaps *where the persona comes from* without changing *what it says* on the default path — the flag makes the file+`core_memory` render and the DB-soul render A/B-comparable on one running instance, so the behavioral shift (persona now reads as one continuous document — fixed core + her own evolving voice — instead of two blocks 60 lines apart) can be validated live before v0.30.3 removes the escape hatch.
- The "self_state appears exactly once" test is the load-bearing guard against the split between `renderSoulBlock` (self+bond) and `renderCoreBlock` (L3-only) drifting into a duplicate render.
- The dream still writes `core_memory` this version, which is unrendered under `=1` — deliberately dark until v0.30.2 rewires self-authorship onto the soul.

### `v0.30.0` — 2026-07-04 — Soul store + migration + seed, dark launch (Initiative 22, 1/4)

Status:

- branch `feat/soul-file-v0.30.0`

Fact:

- **NEW migration `0016_soul.sql`** — `soul` (`id CHECK(id=1)`, `fixed_text`, `fixed_hash`, `evolving_self`, `evolving_bond`, `updated_ms`) + `soul_audit` (mirrors `core_memory_audit`: `t_ms`, `prev_self`, `prev_bond`, `source`). `core_memory` / `core_memory_audit` are untouched — retired only at v0.30.3.
- **Protocol `Soul` zod type** (`packages/protocol/src/memory.ts`) — `{fixed_text, evolving_self, evolving_bond, updated_ms}`. `fixed_hash` is a DB-internal cache-gate detail, deliberately left off the wire type. `CoreMemory` stays, marked deprecated.
- **NEW `memory/soulStore.ts`** — `getSoul()` (EMPTY fallback, mirrors `getCore`), `seedFixedCore(fixedText)` (hashes via the existing `contentHash` from `recall/embed.ts`; an unchanged hash is a true no-op — no write, no epoch bump; a changed hash upserts `fixed_text`/`fixed_hash` via `INSERT … ON CONFLICT(id) DO UPDATE`, preserving `evolving_*`), `updateEvolving(patch, source)` (audit-first into `soul_audit`, byte-identical-patch no-op guard, `bumpMemoryEpoch()` on a real change — the same three load-bearing properties as `coreMemory.updateCore`), `restoreEvolving(steps)` (ports `coreMemory.restore` over `soul_audit`).
- **NEW `memory/soulSeed.ts`** — `seedSoulOnBoot()`: snapshots `getSoul().updated_ms === 0` ("never seeded") **before** calling `seedFixedCore` (whose first-ever insert sets `updated_ms` to now, so the signal must be read first), then seeds the fixed core, then — only on that pre-seed snapshot — copies `core_memory`'s `self_state`/`relationship_status` verbatim into `evolving_self`/`evolving_bond` via a direct `UPDATE` (not `updateEvolving`, so the migration doesn't append a spurious audit row). Guarding on the pre-call snapshot makes a second boot a no-op even if a dream has since written the evolving section directly (tested). Wired into `main.ts` right after `setMemoryDb`/before `bootReconcile`.
- **`packages/server/persona/default.md` restructured** into the initiative's 5 fixed-core sections (Identity core / Personality / Background / Cognitive style / Language & voice) — every sentence preserved, only regrouped under new top-level headings (e.g. "MBTI Texture"'s associative-thinking/concede-a-point lines moved to the new Cognitive-style section; the rest stayed under Personality). This file is still the ACTUAL runtime persona source this version (`loadPersona()` reads it directly) — the swap to soul-table-backed rendering is v0.30.1.
- **No change to `runTurn.ts`, `renderCoreBlock.ts`, or `loader.ts`.** `buildSystemPrompt` still concatenates `loadPersona().text` + `renderCoreBlock()` (`core_memory`) exactly as before; the soul table is populated but nothing reads it.
- Tests (+13): `soulStore.test.ts` — migration creates both tables + EMPTY fallback; `seedFixedCore` hash-gate (same text ⇒ one write total, no second write, no epoch bump; changed text ⇒ a second write) and evolving-preservation across a fixed-core change; `updateEvolving` audit-first / no-op-guard / epoch-bump-once parity; `restoreEvolving` one-step walk-back. `soulSeed.test.ts` — fixed core seeds from the real `persona/default.md`; the one-time migration copies `core_memory` verbatim; a second `seedSoulOnBoot()` call is idempotent even after a post-migration dream write; safe with no `core_memory` content; and the **dark-launch proof** — with `core_memory` held fixed across both snapshots, `buildSystemPrompt`'s rendered text is byte-identical whether or not `seedSoulOnBoot()` ran in between. One existing `persona.test.ts` assertion updated (`'Runtime Persona'` heading → `'Identity core'`, the file's new top section). **1042 all-package green, server + protocol `tsc` clean** (desktop `tsc` pre-existing red, unrelated — missing electron devDep in this env).

Inference:

- Isolates the initiative's riskiest, hardest-to-reverse piece — schema + migration + the core_memory→evolving data migration — behind a dark launch, proven via a direct test rather than by inspection: seeding the soul table provably does not perturb the rendered system prompt.
- The persona restructure is flagged by the roadmap itself as cosmetic/build-time-settleable; the section-boundary choices here (e.g. where "MBTI Texture"'s reasoning-flavor lines land) are a one-line reversible judgment call for v0.30.1 review, not a locked decision.
- Sets up v0.30.1 (render the soul into the prompt behind `LUNA_SOUL_DB`) with `getSoul()` already returning fixed/evolving as distinct fields, per the roadmap's explicit note not to collapse them into one blob.

### `v0.29.1` — 2026-07-03 — Tune the amplifiers + retire the old anchor (Initiative 21, 2/2 ✅)

Status:

- working tree (branch `mainline`)

Fact:

- **Retired the flag** — deleted `silenceTimerEnabled()` (`cadence.ts`), the `LUNA_PROACTIVE_SILENCE_TIMER` env, and the `silenceAnchorMs` selector in `ladder.ts`: `silenceGap = now - session.lastActivityMs` is now unconditional. Grep-confirmed zero remaining `LUNA_PROACTIVE_SILENCE_TIMER` / `silenceTimerEnabled` references.
- **`WakeContext` drops `lastUserMs`** (`cadence.ts`) — the idle floor's only silence-gap consumer stopped reading it in v0.29.0, so it's gone from the context; `fire.ts` no longer passes it. `session.lastUserMs` is retained on the `Session` (still the escalation-reset trigger, read directly in `ladder.ts`).
- **Two default changes** (both still env-overridable, no new knobs): `LUNA_PROACTIVE_AMBIENT_MIN_MS` **120_000 → 300_000** (`ladder.ts`) and `LUNA_PROACTIVE_AMBIENT_PROB` **0.12 → 0.06** (`style.ts`). `idleThresholdMs` (600s), `nudgeProb`, renudge backoff, quota, and the ladder phases are all unchanged — only the ambient noise floor is lowered.
- Tests: removed the two v0.29.0 flag-off tests; NEW `ladder.test.ts` eligibility-threshold (no ambient until `silenceGap ≥ 300s`) + bounded-ambient-rate (a 15-min silence has exactly 5 ambient-eligible ticks and a cumulative fire chance < 0.3, vs ~0.64 at the old defaults); updated `style.test.ts` (`0.12→0.06`, `0.162→0.081`) and the ladder ambient-band gap (`180_000→360_000`, now in the 5–10m band). **1019 all-package green, server + protocol `tsc` clean.**

Inference:

- Completes Initiative 21: the silence signal is now both correct (v0.29.0) and comfortably paced (v0.29.1). With one honest idle timer and no flag branch, the "we forgot to count anchor X" bug class is structurally gone.
- The ambient retune is the intended product outcome (calmer companion). Both values are one-line default edits or a live env override, so if the pacing feels too quiet it flips back without any code-shape change — and a future per-user activeness lever (Init 17's `set_proactive_style`) has `lastActivityMs` as a clean substrate.

### `v0.29.0` — 2026-07-03 — Silence idle-timer core (Initiative 21, 1/2)

Status:

- working tree (branch `mainline`)

Fact:

- **NEW `session.lastActivityMs`** (`turn/session.ts`): the single silence idle-timer, initialized to boot time, seeded on `preloadSessions` from the last L2 turn's `t_ms` of ANY kind (`listRecentL2(id, 1)[0]?.t_ms`, the source `lastInteractionMs` already used) so a restart doesn't reset the gap. NEW exported `markActivity(session, nowMs)` — monotonic (never rewinds).
- **`markActivity` wired at the two conversation-activity choke points**: `ws.ts` at `chat.send` (a user message), and `runTurn.ts` finalize inside the `realReply.length > 0` block (every reply-producing turn — reactive, continuation, AND proactive). An empty/failed turn falls to the else branch and does NOT mark activity.
- **`proactive/ladder.ts`**: `silenceGap = now - session.lastActivityMs` (behind `silenceTimerEnabled()`; flag-off restores `now - lastUserMs` for A/B). `effectiveGap = min(silenceGap, sinceProactive)` retained. The escalation reset (`lastUserMs > lastProactiveMs → engaged, nudgesSent 0`) is UNCHANGED — still user-keyed. Block comment rewritten to describe the activity timer.
- **`proactive/cadence.ts`**: NEW `silenceTimerEnabled()` (env `LUNA_PROACTIVE_SILENCE_TIMER`, default on) — lives here so both `ladder.ts` and this rail read it without a runtime import cycle. `WakeContext` gains `lastActivityMs`; `passesAntiSpam`'s idle floor measures from the activity anchor when the timer is on (a long reactive turn no longer pre-elapses the 60s floor, since `lastUserMs` is stamped at turn *start*). `fire.ts` threads `session.lastActivityMs` into the `passesAntiSpam` call.
- No `packages/protocol` change, no SQLite migration — `lastActivityMs` is in-memory session state restored from the existing `l2_turns.t_ms`.
- Tests: **+9** — `ladder.test.ts` (the reported bug: split anchors → no ambient with the timer on, the interrupting ambient *does* fire with `LUNA_PROACTIVE_SILENCE_TIMER=0`; a recent reply also suppresses a stale-gap idle_nudge; a genuine silence still escalates; the reset still keys on the user anchor), `cadence.test.ts` (long-reply floor reads the activity anchor on / wrongly passes off), `sessionPreload.test.ts` (preload seeds from the last L2 turn incl. a proactive one; `markActivity` monotonic). Existing `sess`/`ctx` helpers default `lastActivityMs` to mirror `lastUserMs` so single-anchor tests are unchanged. **1019 all-package green, server `tsc` clean.**

Inference:

- Fixes a live-exposed, user-reported defect (Luna interrupting an active conversation) by correcting *how* `effective_gap` is computed — the TS ladder finally matches LD #15's stated `effective_gap` intent. Stays entirely inside LD #15 (ladder, safety gate, kill switch, delivery layer all untouched); **no LD amendment required.**
- Collapses the fragile "hand-maintained set of anchors" (which is exactly how this bug was born) into a single idle timer bumped at one choke point — a future interaction type can no longer silently fall outside the silence signal. Same semantics as Python's `last_interaction_at`, simpler mechanism.
- The flag makes the anchor fix isolable and A/B-comparable; v0.29.1 retires it and tunes the ambient amplifiers.

### `v0.28.9` — 2026-07-03 — Desktop one-click dev stack (app launches `bun run dev`)

Status:

- working tree (branch `mainline`)

Fact:

- **`packages/desktop/src/main.ts`** — after the v0.28.8 attach probe, when nothing is on :8787 the app now prefers to launch the **full dev stack** (`bun scripts/dev-all.ts` → server 8787 + web 5173 + tts 8788, cwd = repo root) rather than the bare compiled sidecar. One launch brings the whole environment up; the browser (5173) and the app window both talk to the one :8787 Luna, and TTS works with no extra step (dev-all spawns + owns the proxy). Skips `maybeStartTts` (dev-all owns it) + onboarding (dev-all reads the repo `.env` for keys). `LUNA_PROACTIVE` follows luna.env (dev-all defaults it off).
- **NEW `resolveDevLauncher` (`backend.ts`)** — returns `{bun, script, cwd}` when this is a source checkout (`scripts/dev-all.ts` present) AND a bun binary is reachable by ABSOLUTE path (a Finder-launched `.app` has a minimal PATH, so bare `bun` ENOENTs): probes `LUNA_BUN_PATH` → `/opt/homebrew/bin/bun` → `/usr/local/bin/bun` → `~/.bun/bin/bun`. Null → the caller falls back to the self-contained compiled sidecar.
- **`packages/desktop/src/supervisor.ts`** — `SupervisorOpts`/`SpawnFn` gain an optional `cwd` (dev-all uses repo-relative paths). Backward-compatible: existing 3-arg `spawnFn` mocks still satisfy the widened type. dev-all already tears down its children on SIGTERM, so the supervisor’s kill-on-quit propagates — no orphans.
- SMOKE stays on the self-contained sidecar (:8790, throwaway DB) — a verification run must be deterministic + isolated, never a full vite stack.
- Tests: **+4** (`backend.test.ts`: dev-all present + bun → launcher; no-checkout → null; no-bun → null; `LUNA_BUN_PATH` override wins). **1020 all-package green; desktop + server `tsc` clean.** Repackaged; packaged smoke green (fallback sidecar path, `wsStatus:"open"`).

Inference:

- Answers the request for the app to auto-run dev on startup (2026-07-03): opening the app IS now the one-command launcher — no separate terminal, and both surfaces (browser + app) are the same Luna on the same DB. It sidesteps the v0.28.8 port-ownership caveat in the normal case (the app brings dev up itself instead of racing it) and makes voice work without the manual TTS dance.
- The tradeoff (deliberate, single-machine): the dev-launch path needs bun + the repo, so the packaged app is not distributable in that mode — hence the graceful fallback to the compiled sidecar keeps the self-contained build (Initiative 19) intact on any machine without them.
### `v0.28.8` — 2026-07-03 — Desktop ↔ web backend unification (one Luna)

Status:

- working tree (branch `mainline`)

Fact:

- **The split it closes**: the desktop app spawned its own `luna-server` sidecar on **:8790** against an **app-data** DB (`~/Library/Application Support/@luna/desktop/luna.sqlite`), while `bun run dev` served the web on **:8787** against the **repo** `luna.sqlite`. Two DBs → two divergent Lunas (the app DB had 12 turns; the real web Luna had 332).
- **`packages/desktop/src/main.ts`** — the canonical WS port is now **8787** (shared with `bun run dev`; SMOKE keeps 8790 for isolation). On boot the app probes it via `waitForPort(SERVER_PORT, 800)`: if a backend is already listening it **ATTACHES** — its window becomes another client of that one Luna, it spawns **no** sidecar, **no** TTS proxy (dev-all owns :8788), and **skips onboarding** (the running server holds the keys); its static host still serves the app’s own frontend and forwards TTS to the existing proxy. Otherwise it **SPAWNS** its own sidecar as before.
- **Shared DB**: `sidecarEnv`’s `LUNA_DB_PATH` now resolves to the **shared repo `luna.sqlite`** (`<repoRoot>/luna.sqlite`, via inlined `__dirname` three-up — the same file the server defaults to), falling back to the app-data DB under SMOKE or a distributed build.
- **NEW `packages/desktop/src/backend.ts`** (pure, injectable): `resolveSidecarDb({sharedDb,userDb,smoke,exists})` + `shouldAttach({portListening,smoke})` — keeps the electron-coupled boot decision testable. The app’s throwaway app-data DB is backed up to `luna.sqlite.pre-unify.bak` and no longer read.
- Tests: **+6** (`backend.test.ts`: shared-vs-app-data resolution incl. the SMOKE guard; attach-vs-spawn incl. SMOKE-never-attaches). **1016 all-package green; desktop + server `tsc` clean.** Repackaged; packaged smoke green (spawn mode on :8790, `wsStatus:"open"`).

Inference:

- Realizes the "one Luna" the owner asked for (2026-07-03): whenever `bun run dev` is up (the usual state) the desktop window and the browser tab are literally the same running brain on the same memory; when it isn’t, the app is still self-contained (spawns against the shared repo DB). Attach-or-spawn keeps Initiative 19’s single-machine self-containment while removing the second-Luna divergence — without the two-servers-one-DB race (only one backend ever owns the port + the DB).
- Caveat (single-machine, one owner per port): `bun run dev`’s launcher always spawns its own server, so if the app owns :8787 first, a later `bun run dev` fails to bind. The normal flow (dev first → app attaches) is unaffected.
### `v0.28.7` — 2026-07-03 — Desktop TTS wiring

Status:

- working tree (branch `mainline`)

Fact:

- **NEW `packages/desktop/src/tts.ts`** (~35 LOC): `resolveTtsConfig(env, repoRoot, existsFn)` → `{ dir, port, available, upstream }`, resolving the **same `LUNA_TTS_DIR` (default: a private sibling TTS directory) / `LUNA_TTS_PORT` (8788)** knobs `scripts/dev-all.ts` uses; `available` mirrors dev-all's probe (the glue module present under `<dir>/server/`). `ttsProxyScript(repoRoot)` → `scripts/tts-proxy.cjs`.
- **`packages/desktop/src/serve.ts`**: `startWebHost` gains an optional `ttsUpstream` param. `/api/gpt-sovits/*` now `forwardTts()`s to it (buffers request body, passes upstream status + content-type + **binary audio** back verbatim; a dead/absent upstream → 502) instead of the hardcoded 502 stub. `server.requestTimeout` raised to 600s (GPT-SoVITS's ~5GB cold-load synth can take minutes — the reason dev-server.ts raises Bun's idleTimeout). **With no `ttsUpstream` the 502 is preserved** — `main.ts:279` and `smoke.ts:17` pass none, so smoke behavior is byte-unchanged.
- **`packages/desktop/src/main.ts`**: resolves `ttsCfg` at boot + passes `ttsCfg.upstream` into `startWebHost` when available; NEW idempotent `maybeStartTts()` spawns `tts-proxy.cjs` as a **second supervised sidecar** (reuses `createSupervisor`) via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` — runs the plain-CJS proxy on Electron's bundled Node, **no `bun`-on-PATH dependency**. Guarded (`SMOKE` / module absent / proxy script absent / already-running → no-op); called on the normal boot path (after `supervisor.start()`) and after a successful onboarding submit; `ttsSupervisor.stop()` added to `before-quit` / `window-all-closed` / the smoke exit.
- **Forward-proxy hardening (`serve.ts` `forwardTts`, from the 19-agent adversarial review)**: (1) the `/api/gpt-sovits/*` route is now rebuilt via `new URL(decodedPath, upstream)` and **re-checked** after normalization — an encoded `..%2f` decoded past the old `startsWith` guard and `fetch` would have resolved the `..` to a sibling upstream path (e.g. `/api/admin`); an escape now returns **400**. (2) the upstream `fetch` carries `AbortSignal.timeout(600_000)` — `server.requestTimeout` does NOT abort an in-flight fetch, so a proxy that accepts-then-stalls would hang the handler forever; a timeout now aborts → 502.
- Tests: **+11** — `tts.test.ts` (config defaults / env overrides / availability probe / proxy-script path) + `serve.test.ts` (integration: GET + POST forwarding against a fake upstream, binary passthrough, 502 on no-upstream, 502 on unreachable upstream, static-serve + path-traversal guard, **+ an encoded-`..%2f` proxy-traversal block → 400**). **1010 all-package green.** desktop + server `tsc` clean in the integrated checkout (the PR branch's `tsc`-red note was its worktree lacking the electron devDep).

Inference:

- Closes a real functional gap left by Initiative 19 (desktop app): the agent WS backend was correctly shared between web dev and the desktop shell (same `packages/server`, compiled to a sidecar), but **TTS was never wired** — the desktop host stubbed the proxy route to 502 and spawned no GPT-SoVITS process, so voice was structurally impossible despite the boot gate implying it was loading. This makes the desktop app reach voice parity with `bun run dev` on a source checkout.
- Honors the locked "TTS stays local GPT-SoVITS, not open-sourced, not bundled" decision: nothing new ships in the package, and a machine without the local module degrades silently to muted rather than erroring — the availability probe, not a config flag, is the gate.
- Electron-as-node (vs the dev launcher's `bun`) keeps the spawn dependency-free for an eventual packaged build, though the packaged path stays muted until the scripts/ + sibling TTS module are made resolvable (out of scope — dev-run is the current target).
- The adversarial review confirmed 4 findings; the two with real impact (proxy path-traversal, unbounded upstream wait) are fixed above. The other two — only `content-type` (not `content-length`/`cache-control`) is passed back, and the TTS supervisor gives up silently after 3 crash-restarts — were judged low-impact for a single-user loopback host and left as-is.

### `v0.28.6` — 2026-07-03 — Pet drag rework: clicks work again

Status:

- working tree (branch `mainline`)

Fact:

- **Live-test regression (v0.28.2)**: move + resize worked, but no click inside the pet ever fired. `-webkit-app-region: drag` claims mousedown at the native layer — the DOM never sees it — and `no-drag` descendants are notoriously unreliable on transparent frameless windows. The design had an inherent ambiguity: the OS cannot know whether a mousedown means "drag the window" or "click the app".
- **Fix — manual drag, no app-region**: all `-webkit-app-region` rules removed from `theme.css`. `app.ts` (pet mode): pointerdown landing inside her body bbox (`modelRectFromVars` over the sink-published `--luna-model-*` vars — the `petHitTest.ts` seam v0.28.2 deliberately kept) starts a drag; `pointermove` streams TOTAL screen-space deltas (`e.screenX/Y` minus the start — screen coords are stable while the window moves under the cursor); `pointerup`/`pointercancel` end it. Everything outside her body is untouched DOM — buttons, input, panel all receive ordinary clicks.
- **NEW `desktop/src/petDrag.ts`** (pure, DI): `createPetDrag({getPosition,setPosition})` — `begin()` snapshots the window origin, `move(dx,dy)` places at `origin + total-delta` (absolute placement: no rounding drift across events; non-finite deltas ignored), `end()` disarms. Wired via NEW `luna:pet-drag-start/-move/-end` IPC + `lunaPet.dragStart/dragMove/dragEnd` on the preload bridge.
- **Smoke updated**: the pet go/no-go now asserts `typeof lunaPet.dragStart === 'function'` AND `.model-stage`'s computed `-webkit-app-region !== 'drag'` (a synthetic DOM click can NOT prove the fix — app-region interception happens below the DOM — so the smoke asserts the structural absence of the hijack instead; the click feel itself is the owner's hand test).
- Tests: **+3** (`petDrag.test.ts`: absolute-from-origin no-drift, no-op before begin/after end, non-finite ignored + integer rounding). **999 all-package green, `tsc` ×4 clean.** Repackaged; windowed + pet packaged smokes green (`bridgeDrag:"function"`, `noAppRegion:true`).

Inference:

- The v0.28.2 review's REFUTED verdict on "no-drag children may not win" was wrong in practice — the failure mode wasn't CSS cascade but native-layer interception, which no computed-style reasoning could see. The manual-drag pattern is what mature desktop pets converge on for exactly this reason: the renderer owns the drag-vs-click decision, so the ambiguity the owner described stops existing.
- The `petHitTest.ts` seam kept "for a possible future hybrid" in v0.28.2 paid for itself within a day — her body bbox is again the interaction boundary, now for drag instead of click-through.

### `v0.28.5` — 2026-07-03 — Cost tripwire + usage in traces

Status:

- working tree (branch `mainline`)

Fact:

- **NEW `warnIfExpensiveRound(inputTokens, turnId)`** (`turn/runTurn.ts`, called at every `message_stop`): when one request's input exceeds `LUNA_COST_WARN_INPUT_TOKENS` (default **80_000**; `=0` disables), logs a loud `[cost] ⚠️ one request sent N input tokens…` line pointing at `/_trace` + the L1 fold. Per ROUND, not per turn — each round re-sends the whole context, so a single huge request is the anomaly signal (a healthy multi-round tool turn sums high without any one round being wrong).
- **`tracedEmit` records `usage`** on the `turn.result` outbound trace (`payload: { usage }`) — the turn's real input/output token totals now land in SQLite and are inspectable at `/_trace`. During the v0.28.4 diagnosis this field was **empty**, which is exactly why a 25× cost regression was invisible everywhere except the provider bill. No wire/protocol change: `OutboundTraceEvent.payload` already existed (unused on this event).
- Tests: **+3** (`costWarn.test.ts`: threshold fires/silent/disabled; default-80K boundary; an end-to-end 294K-input mock turn → the warning fires AND the trace row carries `usage.input_tokens=294000`). **996 all-package green, `tsc` clean.**

Inference:

- Completes the v0.28.4 incident response: prevention (heal + hard cap) landed there; this adds **detection** — the next cost anomaly of any origin surfaces as a console tripwire within one turn and as queryable trace data, instead of surfacing as a monthly bill.

### `v0.28.4` — 2026-07-03 — EMERGENCY: L1 fold stall → unbounded context

Status:

- working tree (branch `mainline`)

Fact:

- **Incident**: profiling showed plain chat turns billing **~390K input tokens** (cache-write 350K+). Diagnosis on a live-DB copy: the rebuilt session history held **1941 messages**, `window_low_water` was stuck at **498**, so `buildActiveContext` sent messages 498→1941 — **1444 messages ≈ 294K tokens — on every turn**, chat or not.
- **Root cause** (`memory/l1Window.ts` planFold): the guard `if (cum !== session.windowLowWater) return null` demanded the stored watermark land EXACTLY on an L2 row boundary. History edits shift message counts across restarts (v0.27.4's corrective-directive stripping is the likely trigger; the class is general), so the watermark (498) fell mid-row (nearest boundaries …, 511) and the fold **bailed forever** — the "bookkeeping drifted" case had no recovery path, and nothing else bounded the tail.
- **Fix 1 — heal, don't stall**: `planFold` now snaps the fold base to the row boundary just crossed (`cum` ≥ stored watermark), warns (`[l1] fold watermark drifted … healing`), and proceeds; the CAS commit re-aligns `window_low_water` to a true boundary. The few messages between the stale watermark and the healed base skip the digest once (still in L2, recallable).
- **Fix 2 — hard safety net**: NEW `hardTrimTail(msgs, maxMsgs, maxChars)` bounds the verbatim tail in `buildActiveContext` **no matter what upstream state says** — `LUNA_L1_TAIL_MAX_MSGS` (default 300) + `LUNA_L1_TAIL_MAX_CHARS` (default 120K ≈ 30K tok ceiling), cutting at the earliest turn start that fits both budgets (a turn start = a plain user message with no `tool_result`, so a cut can never strand a `tool_result` from its `tool_use`); one oversized final turn falls back to the last turn start. Applied on every windowed return path (incl. the pre-first-fold `windowLowWater === 0` branch); `LUNA_L1_WINDOW=0` stays a genuine unbounded opt-out. Engaging logs `[l1] hard trim engaged` (= folding is lagging).
- **Fix 3 — mid-pair tail start**: a drifted `windowLowWater` could also slice the tail INSIDE a tool_use/tool_result pair (dangling `tool_result` → API 400). The tail start now aligns forward to the next turn start.
- **Replay proof on the live-DB copy**: before — 1444 msgs / 1,177,083 chars (~294K tok); after — **157 msgs / ~170K chars (~43K tok)** immediately (hard trim), and `planFold` heals (folds 119 turns, watermark 511→1282, row-aligned) so the window returns to its intended ~100-turn shape. **No manual data surgery: restarting the server self-heals.**
- Tests: **+5** (drift-heal end-to-end incl. CAS commit + re-aligned watermark; stalled-fold hard-trim bound; turn-start-only cuts with tool pairs intact; oversized-single-turn fallback; mid-pair tail-start alignment). **993 all-package green, `tsc` clean.**

Inference:

- The window was the ONLY bound on per-turn cost, and it had a silent single-point failure: one integer drifting turned into an unbounded-spend regression that plain usage never surfaces (chat still works; only the bill screams). The fix is two independent layers — self-healing bookkeeping AND a state-independent hard cap — so this class (any future history-shape edit) degrades to a warning line, not a bill.
- Lesson recorded for future history-mutating changes (stripThinking-style edits): anything that rewrites persisted turn shapes retroactively must consider the fold watermark, but with v0.28.4 the system now tolerates getting that wrong.

### `v0.28.3` — 2026-07-03 — Initiative 20 review remediation

Status:

- working tree (branch `mainline`)

Fact:

- A **24-agent adversarial review** (4 dimensions — onboarding-secrets, supervisor-restart, pet-model, pet-window — each finding independently verified) ran over v0.28.0–2. Confirmed findings fixed:
- **(HIGH) `onboarding.ts` mergeEnvFile newline injection**: a value pasted with a literal newline (the model/URL field passes the JSON-body probe, then gets written raw) produced a SECOND `KEY=value` line → `parseEnvFile` read it as an injected env var. Fix: `sanitizeValue` strips C0 control chars + DEL (`/[\x00-\x1f\x7f]/`) from every value before it becomes a line. A real key/URL/model id never contains one, so it's non-destructive.
- **(MED) `supervisor.ts` unhandled spawn error**: `start()` only listened for `'exit'`; a spawn failure (ENOENT/EACCES) emits `'error'` — unhandled it re-throws AND leaves `child` set, wedging `start()` forever (its `child` guard). Fix: an identity-guarded `'error'` listener clears the child (no auto-restart — a missing binary won't self-heal; `restart()` re-arms when keys change).
- **(MED) `main.ts` onboarding-submit concurrency**: `ipcMain.handle` does NOT serialize concurrent awaits, so a programmatic double-invoke (DevTools, beating the renderer's `setBusy`) could double-`restart()` + build two app windows. Fix: an `onboardingInFlight` guard (try/finally).
- **(LOW) `petFraming.ts` degenerate inputs**: 0-dim natural/host would emit NaN/Infinity (latent — `Live2DModel.from` validates dims). Fix: a guard returns `{scale:1,baseX:0,baseY:0}` for any non-positive dim.
- **(LOW) smoke assertion tightened**: the pet go/no-go's `barNoDrag` check `!== 'drag'` (accepts empty) → `=== 'no-drag'` (asserts the CSS actually applied).
- **REFUTED** (verified non-bugs): the discriminated-union/wire exhaustiveness, the window-all-closed vs restart race, `=`-in-URL corruption, prefix-key mismatch (`ANTHROPIC_API_KEY` vs `_2`), trailing-newline loss, pet-toggle window recreation state leak, and the `.dream-btn`-inside-`.model-stage` drag-region concern (child `no-drag` wins by cascade).
- Tests: **+4** (mergeEnvFile newline-injection; supervisor spawn-error recovery; petFraming degenerate inputs). **988 all-package green, `tsc` ×4 clean.** Packaged windowed + pet smokes re-verified green after the rebuild.

Inference:
- The onboarding newline-injection was the one finding with a real security edge (config injection via a pasted value); the rest are robustness (a wedged supervisor, a double-submit, a NaN framing). Fixing them keeps the shell-boundary hardening honest — the same posture as the v0.27.x settings/secret work.

### `v0.28.2` — 2026-07-03 — Pet window move + resize (Initiative 20 ✅ closes)

Status:

- working tree (branch `mainline`)

Fact:

- **NEW `packages/desktop/src/petWindow.ts`** (pure): `petWindowOptions()` = transparent/frameless/always-on-top + **`resizable:true`** + `minWidth:320`/`minHeight:480` + `maximizable:false`. `main.ts` spreads it for the pet window.
- **`main.ts` drops per-pixel click-through** in pet mode — the recommended fork from the roadmap (confirmed by proceeding): the `setIgnoreMouseEvents(true,{forward})` call is gone, so the window takes the mouse normally and the OS resize border works. `petHitTest.ts` + the `luna:set-ignore-mouse` IPC + `lunaPet.setIgnore` are kept intact for a possible future hybrid.
- **`theme.css`**: `.luna-app.pet .model-stage { -webkit-app-region: drag }` (her body is a window-move handle); the input row, settings/dream/collapse buttons, settings panel, scroll pill, mood pip get `no-drag` (still clickable/typable).
- **`app.ts`**: the `pointermove` region hit-test loop is retired (nothing drives `setIgnore` now); the unused `petHitTest` import is dropped.
- **The model re-fits on resize for free**: `pixiLive2DSink` already listens on `globalThis 'resize'` → `fit()`, and v0.28.1 made the pet framing derive from live host dims — so dragging the window edge re-scales the whole half-body portrait with no new code.
- **`smokeProbe` hardened**: reports the computed `-webkit-app-region` of her body + the bar, and the pet go/no-go now requires `win.isResizable()` && body `=== 'drag'` && bar `!== 'drag'`.
- Tests: **+1** (`petWindow.test.ts`). **984 all-package green, `tsc` ×4 clean.** Confirmed in a real Electron run that `getComputedStyle('-webkit-app-region')` reports correctly (windowed → `none`; the CSS/prop is inert in a plain browser, so this can only be asserted in Electron — the packaged pet smoke does).
- **Initiative 20 ✅ complete (3/3).** Deferred to the owner's eyes (same standing desktop caveat): a real windowed run to drag + resize the pet over the desktop.

Inference:
- Closes the owner's report that in pet mode the window could not be dragged or resized: the move/resize affordance moved from the model (removed in v0.28.1) to the window itself. The per-pixel pass-through was a v0.26.2 nicety; trading it for real move + resize is what a fully-resizable pet asked for. The hit-test seam is preserved, so the decision is reversible.

### `v0.28.1` — 2026-07-03 — Pet model fixed half-body (Initiative 20, 2/3)

Status:

- working tree (branch `mainline`)

Fact:

- **NEW `packages/web/src/live2d/petFraming.ts`** (pure, WebGL-free): `petFraming(hostW, hostH, naturalW, naturalH) → {scale, baseX, baseY}` — scale = the windowed full-body height-fit (`hostH*0.92/naturalH`) × `PET_ZOOM` (1.7), horizontally centered, top-anchored at `hostH*0.06`. Everything derives from LIVE host dims, so the portrait re-fits to any window size (v0.28.2 resizes the window). Constants tuned in preview.
- **`pixiLive2DSink.ts`**: the factory takes `{ pet?, modelUrl? }` (was a positional `modelUrl`). Pet ⇒ `fit()` uses `petFraming` + zero drag offset; **model drag disabled** (`pointerdown` guard), **scroll-zoom disabled** (`wheel` guard), **dblclick recenter disabled**, and the grab cursor drops to default — the model is inert (v0.28.2 hands move/resize to the window). Windowed mode is byte-unchanged (the pet branch is only taken under the flag).
- **`app.ts`**: `isPet` hoisted above the sink creation and passed as `{ pet: isPet }`; the later pet-interaction block reuses the same `isPet`.
- Tests: **+4** (`petFraming.test.ts`: scales up past the full-body fit, top-anchored not centered, horizontally centered, re-fits larger→larger). **983 all-package green, `tsc` ×4 clean.**
- Verified live on the isolated `:5273` preview at 560×900 `?pet=1`: a clean head-to-waist bust (head + beret + cape + bow down to the waist plushie), centered with headroom; a simulated wheel + drag left `--luna-model-width` and position unchanged (both no-ops).

Inference:
- This is the precondition for v0.28.2: with the model inert, the WINDOW can own move + resize without fighting model-drag for the same pointer. The half-body framing is also just the right pet look — a floating bust, not a tiny full-body figure lost in a big transparent window.

### `v0.28.0` — 2026-07-03 — First-run onboarding (Initiative 20 opens)

Status:

- working tree (branch `mainline`)

Fact:

- **NEW `packages/desktop/src/onboarding.ts`** (pure, Electron-free): `needsOnboarding(userEnv)` (key absent/empty/`sk-not-configured`); `mergeEnvFile(existing, fields)` — a **line-preserving** merge (replace an existing `KEY=` in place, append a missing one, never touch comments / blanks / unrelated keys, ignore a commented-out same-name line); `classifyProbe(status|null)` → user verdict (2xx/400 = authed & reached the model; 401/403 = key; 404 = base URL; null = unreachable).
- **NEW `packages/web/src/ui/setupView.ts`**: the first-run form (base URL default `https://api.anthropic.com`, API key `password`, model default `claude-sonnet-4-6`) with a **Test connection** button (`lunaSetup.probe`) + **Save & Start** (`lunaSetup.submit`); inline status/error; a plain browser (no bridge) shows a disabled "desktop app only" fallback. Mounted from `app.ts` when `?setup=1`, which returns before any WS/Live2D/boot-gate.
- **`supervisor.ts`**: NEW `restart(env)` — re-spawns the sidecar against a fresh env (applies keys with no full app relaunch); **identity-guarded** exit handler (`if (child !== c) return`) so a killed child's async exit can't wipe the new child or trigger a phantom respawn; re-arms a fresh crash budget; starts even if never started (first-run holds the spawn until keys land).
- **`main.ts`**: first-run gate — `needsOnboarding && !SMOKE && LUNA_SKIP_ONBOARDING!==1` → load `?setup=1`, hold the sidecar; the blocking "edit a file, then restart" `dialog` is removed (the setup screen replaces it, `ENV_TEMPLATE` still written for power users). NEW `luna:onboarding-probe` / `-submit` IPC (`ipcMain.handle`): submit **tests first** (a bad key never persists), `mergeEnvFile`s into `luna.env`, `supervisor.restart(sidecarEnv(...))`, `waitForPort`, then swaps the setup window for the app window (`createWindow('app')` — reads the resolved pet mode). `createWindow` takes a `'app' | 'setup'` mode (setup is always a normal window). The probe is a main-process `fetch` to `${baseUrl}/v1/messages` — the key stays in the main process, no CORS, no writing-before-testing.
- **`preload.ts`**: NEW `lunaSetup` bridge (`probe`/`submit` via `ipcRenderer.invoke`); the returned verdict is `{ok, error?}` — never the key.
- Tests: **+18** (`onboarding.test.ts` 13: needsOnboarding, mergeEnvFile replace/append/comment/re-run-no-dup/preserve, classifyProbe all branches; `supervisor.test.ts` +5: restart-new-env, stale-exit-no-op, restart-when-never-started, fresh-crash-budget). **979 all-package green, `tsc` ×4 clean.** Setup form rendered + verified on the isolated `:5273` preview.

Inference:
- The desktop app is finally new-user-installable without a text editor: the most-blocking friction (type a URL + key into a dotfile, then relaunch) is a one-screen form that tests before it writes and applies live. The secret wall from v0.27.1 holds — keys go through a dedicated shell IPC to `luna.env`, never the settings wire, and the verdict never echoes the key.
- `supervisor.restart()` is the reusable primitive an "apply a restart-required setting live" feature could later call; keeping it env-agnostic (env passed at call time) leaves that door open.

### `v0.27.6` — 2026-07-03 — Audit polish/redundancy remediation (prompt voice + redundancy)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- Third remediation round from the 21-agent prompt/injection audit — the voice/redundancy/framing findings (quality, not correctness). Applied with judgment: documented hard-won fixes were reframed, not reverted (the banned-closer anchors + CJK phrases, the personaUpdate restraint framing, the WEB_SEARCH commitment reinforcement at the defection site were all preserved).
- **Voice/person (#3, #20, #28).** `packages/server/persona/default.md` rewritten from third person ("Luna is… She should…") to second person ("You are… You…"), matching the rest of the stack; identity-monologue and capability lines de-duplicated; the "Hard Runtime Guidance" wall recast as a positive-led list. `runTurn.ts`: the persona preamble is now "This is who you are." (was "the active runtime persona reference … Follow it"); `BASE_DIRECTIVES` carries an identity anchor + a one-line precedence rule (thinking-contract + speech limits first, persona shapes tone within them), with the generic tool-use nudge dropped (L1 owns tool discipline).
- **Redundancy trimmed to one home each.** Check-in denylist (#8): the `spontaneous` proactive directive drops its inline Chinese phrase list (the enumerated examples live once, on the ladder path's `COMPANION_OPENER_CONSTRAINT`). Warmth-not-guilt (#7): the per-turn `absencePhrase` 'long' case drops its "never as guilt" restatement (the cached `TIME_CLAUSE` owns it globally); the warmth cue stays. Bulletin-avoidance (#22): `weatherNoteFor` drops "never a forecast or a status report" (cached `WEATHER_CLAUSE` owns it). Message-mode (#21): `MESSAGE_MODE_DIRECTIVE` trimmed to the schema-inexpressible part (no top-level text, reasoning in thinking); the bubble/is_final mechanics are owned solely by the message tool description. remember tool (#24): the category list is dropped from the top-level description (it is on the param enum).
- **Single-user hardcoding (#12) + person unification (#26).** The literal owner name is removed from `buildWeatherBlock`/`weatherNoteFor`/`WEATHER_CLAUSE`/`TIME_CLAUSE` ("where the user is" / "the user feel they owe you presence"); proactive person-references unified to a single owner pronoun (the `ambient` scenario + the felt-absence line + the `spontaneous` directive).
- **Framing / negative-first (#10, #13, #16, #25).** Banned-closer block reframed permission-first ("a reply can simply end …") before naming the banned flavor; the concrete anchors + CJK phrases retained. `INTENT_NO_ACT_DIRECTIVE`: the genuine-cannot branch now says "continue naturally with what you can offer" instead of "add a brief honest note that you cannot" — no forced second, contradicting bubble. `DAYPART_MOOD` 'late night' demoted from "a softer, lower-energy register fits" to a neutral fact. `WAKE_SCENE_BLOCK` trimmed of the newly-awakened/no-autobiography lore (duplicated the persona's Memory Condition on turn 0).
- **Positive target + dream examples + tool boundaries (#17, #31, #15, #32).** `renderHumanityBlock` gains a positive target sentence next to the caps. Dream `refineSemanticPrompt`/`memoryAuditPrompt` gain one worked Good/Bad example each (keep vs drop; contradiction → remove+add). `personaUpdatePrompt` restraint bullets tightened 4→2. `time_now`/`weather` descriptions gain "the ambient block already gives you this" when-not-to-use boundaries.
- Tests: 4 wording-assertions updated in lockstep (l1Contract preamble, weatherContext "the user", messageMode "your only voice", proactiveWeather "if it feels natural"); the structural invariants (byte-stability, clause gating, banned-closer anchors present, caps present, wake-scene beat) are unchanged and still pass. **964 green, `tsc` ×4 clean.**

Inference:

- This round targets how the prompt *reads to the model*, not what it does: consistent second-person address (the empirically stronger adherence pattern), one authoritative statement per rule (less drift, less salience dilution, fewer cached tokens), positive-led framing where a fix allowed it, and no single-user assumption baked into a config-driven string.
- The discipline was reframe-don't-revert: every place the audit's verifier flagged a hard-won fix, the concrete anchor was kept and only its framing improved — so the v0.23.5 anti-filler fix, the v0.21.7 restraint fix, and the web-defection reinforcement all survive intact.
- Remaining audit tail is deliberately not done: the #34 Chinese progress string (correct for this single-user deployment), #23 duration-dup (negligible, split across cache tiers), #33 ALL-CAPS normalization (broad, low value), and #19 WEB_SEARCH commitment (intentional layered reinforcement).

### `v0.27.5` — 2026-07-03 — Audit structural remediation (prompt-structure findings)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- Second remediation round from the 21-agent prompt/injection audit — the three structural findings (behavior-shaping prompt structure, not reproducible bugs).
- **#2 — code-agent L1 clauses gated on tool mount.** `persona/l1Contract.ts`: the read-before-edit, run-and-verify, and find_symbol/repo_map clauses are extracted to `CODE_EDIT_CLAUSE` / `SHELL_VERIFY_CLAUSE` / `REPO_MAP_CLAUSE` and appended only when mounted; `renderL1Contract` gains `codeWriteMounted`/`shellMounted`/`repoMapMounted` params (trailing, defaulted; folded into the per-variant cache key). locate-first (list_files/grep/read_file) + the plan clause stay in the base — those tools are always mounted. `tools/registry.ts`: new `isCodeWriteMode`/`isShellMode`/`isRepoMapMode` (mirror `isWebSearchMode`). `turn/runTurn.ts`: `buildSystemPrompt` threads the three booleans from the registry; `EMBODIMENT_BLOCK` drops its trailing "you also have a workspace … edit / multi_edit / write_file" sentence (duplicated the L1 clauses and hardcoded possibly-unmounted tools).
- **#5 — recall no longer framed as firsthand memory; fence hardened.** `memory/recall/recall.ts`: both label branches share a told-vs-remembered LEAD ("… you were handed it, not recalling it fresh") honoring default.md's Memory Condition; the "trust … don't recompute" clause is scoped to the [bracket] time label (TS-computed), not the recalled content; `clip()` neutralizes any literal `<memory>`/`</memory>` in stored text so a retrieved line can't close the fence early.
- **#11 — fallback persona carries the guardrails.** `persona/loader.ts`: `FALLBACK_PERSONA` (used when the persona file is unreadable) now includes the non-negotiable anti-assistant guardrails (no assistant politeness / therapist scripts / AI-girlfriend patterns; not passive/generic; capability honesty), so a misconfigured `LUNA_PERSONA_PATH` no longer silently yields a thinner Luna.
- Tests: +2 l1Contract gating tests (map clause gated, code-write/shell gated + per-variant byte-stable); +1 recall fence-integrity test; the persona fallback test extended to assert the guardrail floor. **964 green, `tsc` ×4 clean.**

Inference:

- All three tighten the same seam v0.27.4 did — internal state (which tools exist, that memory was injected not recalled, that the persona file loaded) leaking into the prompt as a stronger claim than warranted. #2 stops the contract asserting capabilities the session lacks; #5 stops injected memory masquerading as lived recollection (and closes an accidental fence collision); #11 stops a config failure from quietly weakening the persona floor.
- #2 also trims the always-on cached prefix in a pure-companion deploy (the four code clauses were ~half the base contract), so identity/warmth clauses compete against less procedural text. Byte-stability per process is preserved (mounts are fixed at boot), so the prompt-cache invariant holds.
- The structural findings deferred here (redundancy de-duplication, single-user owner-name hardcoding, person/voice consistency, priority hierarchy) remain for a later round.

### `v0.27.4` — 2026-07-03 — Audit real-bug remediation (prompt/injection audit follow-up)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- A 21-agent prompt-engineering audit (10 cluster critics → 10 adversarial verifiers → 1 synthesizer) swept every design-injection / prompt site (9-block cached core, per-turn tail, proactive framing, dream prompts, 22 tool descriptions). This version fixes the three findings that were reproducible defects, not style; the structural/redundancy findings are deferred.
- **#1 — corrective directives no longer pollute durable/context history.** `turn/runTurn.ts`: `TurnState` gains `directiveMessages: Set<Anthropic.MessageParam>`; `pushDirective` records each pushed directive by reference; finalize's `finally` calls `stripCorrectiveDirectives(session.history, state.directiveMessages, historyStart)` after `stripThinking` and before `appendL2`/`persistSession`, independent of `LUNA_CLEAN_HISTORY` (correctness, not the token diet). The empty-reply branch already truncated to `historyStart`, so it needs no change.
- New pure helpers in `memory/cleanHistory.ts`: `stripCorrectiveDirectives` (removes the marked user-role directives in `[from, end)`, then `coalesceAdjacentSameRole` merges the flanking assistant turns the removal exposes) + `asContentArray`. A directive is always flanked by two assistant messages (the `end_turn`-round assistant, then the retry's), and the "before" assistant is always tool-use-free, so `tool_use`↔`tool_result` pairing is preserved (a same-role merge never moves a block across roles).
- **#2 — diary injection default-ON.** `memory/diaries.ts`: `diaryInjectEnabled()` `=== '1'` → `!== '0'`, matching every sibling perception/memory switch (the roadmap's "default off → on after validation"); `LUNA_DIARY_INJECT=0` is the off switch.
- **#3 — persona `"null"`-string corruption closed.** `dream/prompts.ts`: `personaUpdatePrompt`'s output example now shows the JSON literal `null` (was a quoted string containing the word "null") + an explicit "use the literal null, never the string `\"null\"`" instruction, kept natural-language (no `<<<>>>` delimiters — the gateway content-filter lesson). `dream/cycle.ts`: new `normPersonaField` coerces an emitted `"null"`/`"None"`/empty-string field back to `null` before `personaFieldChanged`, so a sentinel can never overwrite a still-true `self_state`/`relationship_status`.
- Tests: +4 `stripCorrectiveDirectives` unit tests (`cleanHistory.test.ts`); diary default assertion flipped to on-by-default + a new explicit off-switch test (`diaries.test.ts`); +1 persona null-coercion test (`dream.test.ts` test 5c). **962 green, `tsc` ×4 clean.**

Inference:

- The three defects share the shape the audit was built to catch: internal machinery (a corrective nudge, a flag default, a null sentinel) silently leaking into a durable surface (stored history, the cached system block, protected persona prose) where it reads as real signal. Each fix restores the intended data/instruction boundary.
- #1 was the highest-impact: an integrity nudge that never happened could accrete into Luna's felt sense of being scolded — the exact "internal plumbing narrated as lived experience" failure the persona + L1 contract exist to prevent. It is a sibling of the v0.27.3 phantom-user-bubble leak (same class, different injection site), so the two together close the "internal directive persisted as a real user turn" family.
- #3's belt-and-suspenders (prompt example + code coercion) reflects that a prompt-only fix to a JSON-shape ambiguity is not trust-worthy alone: the coercion is the load-bearing guarantee, the prompt clarity reduces how often it fires.

### `v0.27.3` — 2026-07-03 — Proactive directive leaked into a phantom user bubble

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Root cause** (`turn/runTurn.ts` ~L834): a proactive turn's `opts.userText` is an INTERNAL stage direction — the `[System proactive trigger · this is NOT a user message …]` opener prompt, or the self-continuation `(You just finished replying …)` framing — NOT a real user message. `appendL2({ userText: opts.userText })` persisted it verbatim into L2's `user_text`, and the frontend renders `user_text` as a user bubble → the raw system directive showed up in the chat log as if the owner had typed it. The `HistoryEvent` contract already says "a proactive turn has empty user_text"; persistence violated it.
- **Fix**: `userText: opts.proactiveTurn ? '' : opts.userText`. Proactive turns store empty `user_text` (no phantom bubble); the directive still lives in `raw_json` (`rawContent`), so context reconstruction / L1 window are unaffected. Reactive turns unchanged.
- **Long-standing** (not an alt-model artifact): leaked rows dated back to 2026-06-16 — the alt-model's repetitive proactive rambling just made the owner scroll the history up far enough to see it. Confirmed present on Claude (turn 314, 12:12, before the alt-model switch).
- **Data cleanup**: cleared `user_text` on the 7 already-leaked proactive rows in the live `luna.sqlite` (`UPDATE … SET user_text='' WHERE turn_id LIKE 'proactive:%' AND user_text != ''`); replies (`assistant_text`) and context (`raw_json`) untouched. A `.backup` snapshot was taken first. A browser refresh drops the phantom bubbles.
- Tests: **+1** regression (`runTurnResilience.test.ts`: a proactive turn that speaks persists `user_text===''`, not the priming directive; `assistant_text` is the reply). **956 all-package green, `tsc` clean.**

Inference:

- This is a display/persistence-contract bug, not a model bug — the directive was always meant to be system-side priming, never a timeline entry. It stayed invisible because proactive turns usually scroll off-screen fast; the alt-model detour (empty turns + repetition) is what surfaced it.
- The fix is the minimal contract-honoring change (proactive ⇒ empty display user_text) and leaves the raw priming in `raw_json` where the model context legitimately needs it.

### `v0.27.2` — 2026-07-03 — Desktop preload fix: the pet toggle actually loads

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Root cause**: the "Desktop pet" toggle (v0.27.0) never appeared in the packaged/dev app because the Electron **preload script never loaded**. `bun build --format=cjs` **inlines `__dirname` as a compile-time constant = the SOURCE directory** (`.../packages/desktop/src`), so `preload: join(__dirname, 'preload.cjs')` resolved to `src/preload.cjs` — which doesn't exist (preload.cjs ships in `dist/`, and in `app.asar/dist/` when packaged). The `contextBridge.exposeInMainWorld('lunaPet', …)` therefore never ran, so `window.lunaPet` was `undefined` and `app.ts` correctly hid the pet row (its guard is `bridge?.setPetMode`).
- **Latent since v0.26.1/2**: the same bridge carries pet-mode **region click-through** (`setIgnore`), so that was *also* silently dead — the packaged pet smoke only asserted CSS classes (`pet`, `bodyBgImage`), never that the bridge was live, so it passed anyway.
- **Fix** (`desktop/src/main.ts`): `preload: join(app.getAppPath(), 'dist', 'preload.cjs')` — `app.getAppPath()` is the real running-bundle root in both dev (`packages/desktop`) and packaged (`…/app.asar`), independent of bun's inlined `__dirname`. (The other `__dirname` uses navigate `..` upward and land on `packages/desktop` whether the base is `src` or `dist`, so only the sibling-file preload path was wrong.)
- **Smoke hardened** so this can't silently regress: `smokeProbe` now opens the settings panel and reports `bridgeSetPetMode` (`typeof window.lunaPet?.setPetMode`), `petRowVisible`, and `serverRows`; the go/no-go `ok` now requires `bridgeSetPetMode==='function' && petRowVisible`. A `preload-error` listener on the window logs any future preload failure to the main process (it was previously invisible — preload console goes to the renderer). A 200ms paint delay before `capturePage` so the shot captures the opened panel.
- **Verified** `{ok:true, bridgeSetPetMode:"function", petRowVisible:true, serverRows:16}` in BOTH dev (`electron .`) and the repackaged `.app`; a screenshot shows the full settings panel with the "Desktop pet" row present above the 5 server-driven categories. `tsc` ×4 clean; desktop tests green.

Inference:

- The v0.27.0 pet toggle was correct in the web layer but dead at the shell boundary — a build-tool footgun (bun inlining `__dirname`) that only bit the one path resolving a sibling file in the output dir. The general lesson: in a bundled Electron main, resolve bundle-relative assets via `app.getAppPath()`/`process.resourcesPath`, never the bundler's `__dirname`.
- The smoke gap was the real failure: a go/no-go that checks the *symptom's CSS* but not the *mechanism* (the bridge) will greenlight a broken feature. Folding `bridgeSetPetMode` into `ok` converts a class of silent shell-boundary breaks into a failing smoke.

### `v0.27.1` — 2026-07-03 — Settings surface: the server-driven settings panel

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **NEW `packages/server/src/settings/registry.ts`** — the operator-settings whitelist: 16 env-backed switches across 5 categories (Companion, Perception, Abilities, Memory, Model), each with label/hint/kind/default/validation and a `restartRequired` flag for boot-read flags. Anything not listed is unreachable from the wire — **secrets stay file-only by construction** (a test asserts no `env` matches `KEY|TOKEN|SECRET`). Per-kind validators: boolean → '1'/'0', number → range (`selfcont.probability` 0–1), quiet-hours → CSV of 0–23, lat/lon → range-checked pair.
- **NEW `packages/server/src/settings/store.ts`** — three-layer resolution, strictly ordered: **user pin > original process env (snapshotted at init, before any overlay) > registry default**. A pin is applied by mutating `Bun.env[spec.env]` (works because nearly every whitelisted flag is read call-time); boot-read flags are marked `restart_required` and still land next boot because `initSettings()` runs BEFORE provider/tool-registry construction in `main.ts`. Reset (`value=null`) restores the ORIGINAL env snapshot (env-file users get their file value back, not ours) or deletes the var when it was originally unset. An empty text pin deletes the var (an explicit unset). Boolean display normalizes env spellings (`true`→'1') to what the read sites test.
- **NEW migration `0015_settings.sql`** — key-value table (NOT the singleton-row pattern): only touched keys get a row, so an absent row means "follow env/default" — the semantic that makes reset possible. Stale rows for removed specs / values a newer validator rejects are ignored on load, not deleted (a rollback picks them back up).
- **Wire contract** (`packages/protocol/src/events.ts`): NEW `settings.set` (ClientEvent: key + nullable value) and `settings.state` (ServerEvent: the full `Setting[]` with per-item `source` = user/env/default + `restart_required` + optional min/max). `settings.state` is **server-driven** — pushed on every connect (in `handleOpen`, after history) and re-broadcast to all sockets after every accepted `settings.set`; there is deliberately no `settings.get`. A rejected set returns an `error` PLUS a fresh `settings.state` so an optimistic control heals.
- **Frontend** (`packages/web`): NEW `ui/settingsView.ts` auto-renders the panel from `settings.state` (grouped by category, restart badge, per-user-pin reset ↺, commit-on-blur for text/number) — it never hardcodes a switch; the server registry is the sole authority. `controller.ts` routes `settings.state` → `onSettings`; `app.ts` wires it to render + sends `settings.set` on edit. `layout.ts` gains the `.server-settings` mount; `theme.css` styles the sections/badges/reset.
- **Live-verified** on the isolated :5273 preview against a :8899 sandbox server (scratch DB, fake key — stable :8787/:5173 untouched): 16 rows across 5 sections rendered, WS open; a real click on "Proactive messages" (starting from an `LUNA_PROACTIVE=0` env value shown correctly as unchecked/env-source) → `settings.set` → server persisted + broadcast → source flipped to `user` + ↺ appeared; ↺ → `value:null` → the DB row was deleted (confirmed via `sqlite3`) → the control reverted to the env value. Restart badge showed on the Web-search row; the desktop-pet row stayed hidden in the plain browser (no `lunaPet` bridge).
- **Adversarial review (3 dimensions × verify) caught + fixed 2 real bugs**, both in the env-snapshot logic: (HIGH) a second `initSettings()` while a pin was still applied re-snapshotted the overlay as the "original" → a later reset would restore the pin, not the user's env-file value; fixed by undoing our own pins (only envs WE pinned, never a genuine user env change) before re-snapshotting. (LOW) `displayBoolean` normalized only the display, leaving `'true'` in `Bun.env` → display/stored desync; fixed by canonicalizing booleans in `Bun.env` at snapshot too. The other flagged findings (wire-greeting breaking a consumer, TDZ on `client`, applyPin kind-mismatch via manual DB edit, persistence divergence) were REFUTED on verification (validation gate before write; `client` used only in socket-triggered closures; assertNever holds).
- Tests: **+20** (`settings/store.test.ts` 14: registry-no-secrets, all validators, default→env→user precedence, reset-restores-original, reset-deletes-when-unset, pin-survives-restart, invalid-rejected-no-mutation, unknown-key, empty-text-unset, boolean-canonicalization, stale-row-ignored, no-db-live-but-unpersisted, **+2 review regressions**: re-init-doesn't-corrupt-original, re-init-keeps-user-env-change; `ws.test.ts` +2: connect greeting, set→broadcast + invalid→error+heal; `controller.test.ts` +1: settings.state routing; `settingsView.test.ts` +2: category grouping order, empty). **955 all-package green, `tsc` ×4 clean.**

Inference:

- The second slice of the owner's request that the toggles not be just an env var buried in code — the whole operator surface (16 flags) is now clickable, not a file edit, with honest provenance (this value came from you / your env-file / the default) and a one-click reset. The registry is the single authority: adding a switch is one entry, and both the server validation and the auto-rendered UI follow. The `settings.json` (shell, v0.27.0) vs `settings` table (server, this) split holds the line — shell-only choices (window shape) live with the shell; runtime flags live with the runtime that reads them.
- The design deliberately keeps the env-file as the *config* layer underneath: a pin overlays env, reset returns to env, and env-file users are never overwritten. Secrets are excluded by whitelist construction, so the panel can never leak or edit a key.

### `v0.27.0` — 2026-07-02 — Settings surface: the pet toggle in the panel

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **"Desktop pet" toggle in the settings panel** (`web/src/ui/layout.ts` + `app.ts`): shown only when the `lunaPet` bridge exposes `setPetMode` (i.e. inside the desktop shell — a plain browser hides the row; a stale shell preload without the method also hides it). Checked state comes from the actual mode (`?pet=1`); flipping it sends `lunaPet.setPetMode(on)`.
- **NEW `desktop/src/shellSettings.ts`**: shell-owned `userData/settings.json` (read degrades to `{}` on corrupt/foreign JSON; the next write heals). Precedence at boot: `settings.json` **>** `LUNA_PET_MODE` in `luna.env` (demoted to initial-default, template comment updated) **>** process env.
- **NEW IPC `luna:set-pet-mode`** (`desktop/src/main.ts` + `preload.ts`): persists the choice, then **creates the replacement window before closing the old one** — transparent/frame are creation-time-immutable in Electron, and closing first would fire `window-all-closed` → supervisor stop → app quit.
- Tests: **+4** (`shellSettings`: missing file, round-trip, corrupt-heals, non-boolean ignored). **936 all-package green, `tsc` ×4 clean.**

Inference:

- First slice of the settings surface the owner asked for (the toggles shouldn't be just an env var buried in code): the most user-visible env flag became a click. The settings.json/luna.env split keeps luna.env as the user-edited *config* file (keys) while UI choices get their own shell-owned store — the same operator-vs-UI precedence model v0.27.1 generalizes server-side.

### `v0.26.2` — 2026-07-02 — Desktop app: the pet window (Initiative 19 ✅ closes)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Pet mode** (`LUNA_PET_MODE=1` in `luna.env`, windowed stays the default): the shell window becomes **transparent + frameless + shadowless + always-on-top** (`'floating'` level) and loads with `?pet=1`; the web app adds a `pet` class — the striped room (body stripes, lace borders, motif layer, status badge) disappears so the desktop shows through, and the companion layout (collapsed mode) is forced. Only Luna, her comic bubbles, and the pill bar exist.
- **Region click-through**: the window starts `setIgnoreMouseEvents(true, {forward:true})`; NEW `web/src/ui/petHitTest.ts` (pure, tested) decides per `pointermove` whether the cursor is over an interactive region — her **body bbox** (published per frame by the sink as `--luna-model-left/top/width/height`, alongside the head vars), the input bar, the dream/settings buttons, the open settings panel — and flips the shell via a NEW `preload.ts` `contextBridge` (`lunaPet.setIgnore` → `ipcMain` → `setIgnoreMouseEvents`), change-guarded. Clicks in her transparent margins hit the desktop; her body stays draggable.
- **Geo**: the zero-code path per the plan — `LUNA_LAT_LON` added to the `luna.env` template (the desktop webview has no browser GPS; `geo.ts` already silently no-ops → the server env fallback).
- **The packaged pet smoke PASSED**: `{ok:true, canvas:true, headX:"258px", wsStatus:"open", pet:true, bodyBgImage:"none", collapsed:true}` + a captured PNG with **real alpha** — the reference model + the pill bar over pure transparency, **no dark halos at her edges** (the premultiplied-alpha concern verified clean at the page level), spawned-sidecar WS connected, clean ~8s exit, no orphan.
- Tests: **+4** (`petHitTest`: rect hits + padding + null rects + host-offset var parsing + pre-publish degrade). **932 all-package green, `tsc` ×4 clean.**
- **Initiative 19 ✅ complete (3/3).** Deferred to the owner's eyes only: real keys in `luna.env` + a real chat turn in the packaged app, and the pet-over-desktop compositor check (transparency verified at the page level; the packaged-.app window-level rendering is the one thing a headless probe can't see).

Inference:

- The full desktop companion now exists end-to-end: a double-clickable `.app` that owns its runtime, and a pet mode where Luna floats over the desktop with Initiative 18's collapsed companion UI as her native layout — bubbles by her head, a floating bar, clicks passing through around her. The three initiatives (17 silence ladder, 18 companion UI, 19 desktop) compose into the product the owner sketched.
- The pet stack validated the research verdicts in order: Electron eliminated the engine risk (the reference model rendered on the first try), `backgroundThrottling:false` addressed the sharpest pet failure mode (reproduced live twice this run), and the region hit-test matches the platform reality (whole-window-only click-through on macOS).

### `v0.26.1` — 2026-07-02 — Desktop app: the single-machine app (sidecar + supervisor + app-data + packaging)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **The compiled sidecar works**: `bun build --compile packages/server/src/main.ts` → a 62MB standalone `luna-server` (519 modules). Sandbox-verified end-to-end: boots in a temp dir with explicit env, migrates a fresh DB to schema v14, listens, answers a WS `ping → pong`.
- **Compiled-binary path hazards fixed in `packages/server`** (all logic-free): `LUNA_MIGRATIONS_DIR` env override in `main.ts` (a compiled binary's `import.meta.dir` is virtual; `LUNA_DB_PATH`/`LUNA_PERSONA_PATH` already existed); NEW `devHtml.ts` `lazyHtml()` — the three dev viewers (`/_chat`, `/_trace`, `/_workspace`) had **top-level `readFileSync`s that crashed the compiled binary at import time**, now lazy + degrading to a stub page. Known degrades documented: sqlite-vec (node_modules dylib absent → lexical recall fallback), tree-sitter (vendor WASM absent → regex `verified:false`), evaluator-firewall named files (source absent → pattern guards only).
- **NEW desktop supervisor layer**: `envfile.ts` (the app-data `luna.env` parser + first-run template — keys live in `userData`, **never the bundle**); `supervisor.ts` (spawn → bounded crash-restart (3) → **kill-on-quit**, injectable `spawnFn`; `waitForPort` TCP health poll); `main.ts` (resolve app-data + resources paths for dev/packaged, first-run template + dialog, spawn the sidecar with the user env — an empty key gets a placeholder so first-run boots instead of crash-looping — wait for `:8790`, open the window on `?ws=8790`, kill the sidecar on every exit path; `LUNA_SMOKE=1` = the same flow headless with a DOM+WS probe and exit code). The app's server port is **8790**, deliberately not 8787 — the app and a dev instance coexist.
- **electron-builder packaging** (`dir` target, arm64, unsigned `identity:null`): `extraResources` = the compiled `luna-server` + `migrations/` + `persona/` + the web `dist/`. `bin/`+`release/` gitignored.
- **The packaged .app smoke PASSED (twice)**: `{ok:true, canvas:true, headX:"373px", wsStatus:"open"}` — the packaged app spawned its own sidecar from Resources, migrated an app-data DB, the window connected to it (`[ws] open session=default`) — **the real WS round-trip v0.26.0 deferred**, the reference model rendering + animating throughout — and exits cleanly in ~8s with **no orphan sidecar**. (The first smoke looked hung: the sidecar's graceful shutdown dream held the inherited stdout pipe ~120s — fixed by `LUNA_SHUTDOWN_DREAM=0` in smoke env + an explicit `supervisor.stop()`; the graceful dream stays ON for real quits — she consolidates before exiting.)
- **Frontend LD amended** in `REWRITE_CONTEXT.md` (web controller → packaged desktop shell; Live2D/audio internals untouched; GPT-SoVITS stays external-optional).
- Tests: **+6** (`envfile` parse/quotes/template; `supervisor` spawn-once / bounded-restart-then-give-up / stop-disarms-restarts). **928 all-package green, `tsc` ×4 clean.**

Inference:

- Luna is now a **double-clickable single-machine app**: the shell owns the runtime (keys from app-data, its own DB, its own server port), and quitting never orphans a process. What remains for the owner's supervised pass is only what needs the owner's identity/eyes: filling `luna.env` with real keys and confirming a real chat turn in the packaged app.
- The import-time `readFileSync` crashes were the exact class of bug the compiled-sidecar smoke exists to catch — found on the first compile attempt, before any packaging work sat on top.

### `v0.26.0` — 2026-07-02 — Desktop app: port foundation + Electron rendering smoke (Initiative 19 opens)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Production build lands** (`packages/web` had none — `dev-server.ts` served TS on the fly): `bun run build` = `bun build ./index.html --production --outdir=dist` + a copy step for the runtime-fetched assets (`live2dcubismcore.min.js` + `models/`). Output: a **self-contained 8.4MB `dist/`** (425 modules → one hashed 0.74MB JS + CSS + index.html + Cubism core + the reference model). `dist/` was already gitignored.
- **The #1 desktop break fixed**: NEW `web/src/wsUrl.ts` — `resolveWsUrl(search, defaultPort)` replaces the inline `ws://${location.hostname}:${port}` (`app.ts:23-24`); the endpoint is now a **fixed `ws://127.0.0.1:8787`** with the `?ws=` override intact (the isolated-dev `:5273/?ws=8888` flow unchanged) — a desktop shell's origin (`file://`/custom protocol/`tauri.localhost`) can no longer break the socket. +3 tests.
- **NEW `packages/desktop`** (Electron ^33, workspace member): `src/serve.ts` — a pinned-port (`5177`) Node loopback static host for `dist/` (path-jailed, MIME-mapped, `/api/gpt-sovits` 502-stub mirroring dev-server's no-upstream behavior; **standalone module** so v0.26.1 compiles it into a sidecar); `src/main.ts` — the minimal shell (one plain `BrowserWindow` on `http://127.0.0.1:5177/?ws=$LUNA_WS_PORT`, `contextIsolation` on, `nodeIntegration` off, **`backgroundThrottling: false`** — the pet failure mode Initiative 18's preview reproduced live); `src/smoke.ts` — the automated rendering go/no-go. Built via `bun build --target=node --format=cjs --external=electron`.
- **The engine go/no-go PASSED**: the smoke runs a **hidden** window (never pops on the owner's desktop) on a dead WS port (**8899 — the stable `:8787` is untouchable**), probes the DOM, and captures a PNG. Result: `{ok:true, canvas:true, placeholderGone:true, headX:"373px"}` — the head-anchor CSS var is written only by a live `beforeModelUpdate` frame, so **the reference model renders AND animates** inside Electron's Chromium from the production bundle. Screenshot confirms the full UI (chat panel, collapse button, model, Dream).
- Validation: **922 all-package tests green** (+3), `tsc` ×4 clean (desktop joins). Electron adds ~134 packages (dev-only).
- **Deferred to the owner's supervised run** (isolation policy — a live WS would hit the owner's running instance): the "chat round-trip against a hand-started server" acceptance. Everything else in the v0.26.0 plan is checked.

Inference:

- The riskiest unknown of Initiative 19 — "does the whole stack (dist bundle → loopback origin → pixi WebGL → Cubism WASM → the reference model) actually run inside the shell?" — is now a proven YES, with the adversarial-verdict-recommended Electron (same Chromium the app already targets). v0.26.1 can build the single-machine packaging (server sidecar + supervisor + app-data) on a validated rendering foundation.
- The loopback-origin design did its job: zero web-code changes beyond the WS resolver — every absolute-root asset path and all `luna:*` localStorage worked unmodified.

### `v0.25.2` — 2026-07-02 — Collapsible companion UI: model glide + head-anchored comic bubbles (Initiative 18 ✅ closes)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **The model glide (FLIP on the pixi beat):** NEW `live2d/ease.ts` (extracted `easeInOutSine`/`lerp`/`clamp01` from `faceVm.ts` — the exact curves the rest of her motion uses; `easeInOutSine` == CSS `ease-in-out`) + NEW `live2d/glide.ts` (a pure, clock-injected tween: delta → 0 over 520ms, retargetable mid-flight, `stop()` for the snap path). `ModelDriver` now composes `position = base + drag + mode` (three independent channels — a glide can never clobber the persisted drag). `pixiLive2DSink.glideLayout(mutate)` captures screen-space x, runs the layout change (`.collapsed` toggle + synthetic `resize` → `fit()` snap), then eases the mode offset from `(beforeX − afterX + modeX)` to 0 on the model's own `beforeModelUpdate` beat — ONE animation system, no CSS-vs-pixi disagreement. `sinks.ts` adds optional `glideLayout?`; `app.ts` routes `applyCollapsed` through it. **Live-sampled on the isolated preview:** expand 87→97→126→165→203→228→233 (settles exactly at the region center), collapse 517→…→292 — textbook ease-in-out, position held at t=0 (no snap).
- **Head-anchored bubbles (the owner's design review — bubbles hug her head, not covering the model):** the sink publishes the head position (the gaze's `HEAD_FRAC` anchor) + a lateral clearance (`0.26 × model.width`, past the hair) as `--luna-head-x/y/--luna-head-gap` CSS vars on `.model-stage`, change-guarded, updated on the same per-frame beat — drag/zoom/glide all keep the bubbles tracking her face. `.speech-stack` anchors its BOTTOM at head height, right edge `gap` left of the head center: the newest bubble appears at her face, older ones push UP above her head; `left:8px` caps the spill.
- **Comic tails + jitter (the owner's design review):** every `.speech-bubble` carries a `::after` tail (rotated-square, matching bg + border) pointing RIGHT at her face — visible only on `.latest`; `SpeechStackView.finalize` moves `.latest` to the new bubble, so the previous one's tail **transitions away (0.25s shrink+fade) the moment it becomes history**; a fading bubble drops its tail too. Each bubble lands with a bounded random offset near the head (`marginRight 0–34px`, `marginTop 2–10px`; rng injected for tests) — comic scatter, not a fixed slot.
- **Adversarial review (2 lenses → refute-by-default verify): 3 CONFIRMED, all fixed** — (1) a drag persisted in full-width collapsed mode could strand her **entirely off-canvas** after expand (persisted → still gone on reload; only the undiscoverable dblclick reset recovers) → `fit()` now **re-clamps the drag against the current host dims + heals the persisted value**; (2) the reduce-motion snap didn't cancel an in-flight tween — the next beat yanked her off the snap (motion under reduce-motion) → `glide.stop()` in the RM branch; (3) the JS glide honored only the app toggle, not **OS-level `prefers-reduced-motion`** (every CSS animation honors both) → `reducedMotion()` ORs `matchMedia`, and the root `.reduce-motion` boot class does too (`app.ts`). Two further findings died unverified (review-runner session limit): the `?dev` panel z-order (dev-only surface) and the collapsed bar overlapping her feet (by design — a floating bar); both noted, not fixed.
- Tests: **+9** (glide easing/retarget/`stop`/monotonicity; ModelDriver three-channel composition incl. "fit never clobbers drag or glide"; stack `.latest` handoff + fading-drops-tail + bounded jitter via injected rng). **919 all-package green, `tsc` ×3 clean.** Browser-verified on the isolated `:5273` preview (dead-port WS): tails/jitter/clearance/glide all screenshot- or sample-confirmed; `::after` computed opacity 1 (latest) vs 0 (history) with 0.25s transitions.
- **Initiative 18 ✅ complete (3/3).** Zero `packages/server`/`packages/protocol` change across the whole initiative (the hard constraint held; the one wire touch this run was Initiative 17's `set_proactive_style` ToolName).

Inference:

- The collapsed companion mode is now the full experience the owner described: she glides to center, you talk through a floating pill bar, and her replies pop as comic bubbles beside her face — newest at her mouth with the tail, history drifting up and shedding its tail. All of it rides the existing controller→BubbleView seam and the model's own render beat.
- The preview session incidentally REPRODUCED the desktop-app research's sharpest warning: a backgrounded tab froze the pixi beat (breath + head-anchor dead until foregrounded) — live evidence for Initiative 19's "background-throttling off" requirement.

### `v0.25.1` — 2026-07-02 — Collapsible companion UI: collapse ↔ expand morph (Initiative 18)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `ui/layout.ts`: a `collapse-btn` toggle added to the **`.chat-input-row`** (deliberately NOT the header — the header is hidden in collapsed mode, so a header button would make collapse a one-way door) + returned in `LayoutRefs`. Drive-by fix: `buildLayout` now uses `root.classList.add('luna-app')` instead of `root.className = 'luna-app'`, which had silently **wiped the boot-persisted `reduce-motion` class** (pre-existing bug — persisted reduce-motion never applied on boot).
- `app.ts`: real collapse state — `isCollapsed` boots from `localStorage['luna:collapsed']`, the button toggles it (persisted), `applyCollapsed()` toggles a `.collapsed` class on the root + flips the glyph (`⌄`/`⌃`) + aria-label + dispatches a synthetic `resize` so `fit()` re-centers the model into the resized region (the v0.25.2 glide replaces that snap). The v0.25.0 router's `collapsed()` now reads this real state (the `luna:bubble-stack` test toggle is gone).
- `theme.css`: the collapsed morph — `.luna-app.collapsed .chat-panel` becomes a **fixed, centered bottom pill bar** (`min(560px, 92vw)`, `bar-rise` entrance); header/log/scroll-pill/puffs hidden; `collapse-btn` styling; collapsed+narrow lets `.model-stage` fill the freed column (overrides the 210px mobile band); reduce-motion overrides written as **compound** selectors (`.luna-app.reduce-motion.collapsed` — reduce-motion sits on the SAME root element, a descendant selector never matches).
- **Browser-verified on an isolated preview** (port **5273**, `/` → `/app?ws=8899` — a dead WS port so the page can never touch the stable `:8787`, whose ws-reconnect hook could fire a proactive turn): collapse click → fixed pill bar + full-width centered the reference model + bubbles beside her; expand click → panel restored (header/log visible, `position:relative`); **reload boots collapsed** (persistence); mobile 375px → pill clamps to 92vw, no breakpoint fight, model fills 738px. Screenshots taken of both states.
- `tsc` ×3 clean; 85 web tests green (the router live-flag test covers the mode flip; the DOM wiring is preview-verified — bun test has no DOM).

Inference:

- Collapsed companion mode is now a real, persisted UI mode: the user talks through a floating bottom bar and Luna answers as bubbles beside her body — the window (with full history) is one click away. The `resize`-dispatch seam is exactly where v0.25.2's glide slots in (replace the snap with an eased motion).
- The two fixed bugs (one-way collapse via a header button; the reduce-motion boot wipe) were both caught before commit — the first by design review while resuming, the second because the collapsed reduce-motion override forced reading the actual class plumbing.

### `v0.25.0` — 2026-07-02 — Collapsible companion UI: beside-model speech-bubble stack (Initiative 18 opens)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **NEW `ui/speechStackView.ts`** — `SpeechStackView implements BubbleView`: a beside-model timed bubble stack mounted in `.model-stage`. Newest bubble at the bottom (append order in a bottom-anchored flex column); each lives `ttlMs` (default 10s) then a CSS fade + DOM removal; an overflow cap (default 4) fast-fades the oldest; `clearAll()` for barge-in; `noteSpeechStart()` restarts the newest bubble's life (speech-gating). `open`/`append`/`discard`/`chip`/`setThinking`/`renderHistory` are no-ops (the stack shows ONLY finalized replies). The TTL scheduler is injected for deterministic tests.
- **NEW `ui/routerBubbleView.ts`** — `RouterBubbleView implements BubbleView`: forwards every call to the window view ALWAYS + to the stack when `collapsed()` (read LIVE per call, so a mid-turn flip never strands a bubble); `renderHistory` → window only. Lets collapsed mode mirror Luna's replies to the stack with NO controller/protocol change.
- `app.ts`: constructs the window `CuteBubbleView` + `SpeechStackView(refs.modelStage)` wrapped in a `RouterBubbleView` (`collapsed` = a `luna:bubble-stack` localStorage toggle for standalone testing until v0.25.1's real collapse state); speech-gates via a wrapped `AudioSink` (`onStart` → `noteSpeechStart`); clears the stack on `turn.started` (barge-in); the user echo now targets the window view directly.
- `theme.css`: `.speech-stack` (bottom-anchored column in `.model-stage`, `pointer-events:none` so it never blocks the model) + `.speech-bubble` (theme-var styled, rise-in + fade) + `.reduce-motion`/`prefers-reduced-motion` overrides.
- Tests: **+11** — `routerBubbleView.test.ts` (expanded=window-only, collapsed=both, live-flag flip, history→window) + `speechStackView.test.ts` (newest-bottom, TTL fade+remove, overflow cap, clearAll, noteSpeechStart, no-ops) via a fake DOM + injected scheduler. **85 web green, `tsc` ×3 clean.**
- **ZERO `packages/server` / `packages/protocol` change** (Initiative 18's hard constraint) — the stack is fed by the existing controller→`BubbleView` seam. Flag: `luna:bubble-stack` (localStorage, off by default).

Inference:

- Lands Initiative 18's riskiest, most novel piece first (the timed stack + its TTL / barge-in / overflow / speech-gating), isolated from the collapse UI (v0.25.1). Realizes `bubbles.ts:62`'s note that the minimal view is deliberate and "the real Live2D-framed UI is a later pass."
- **Not yet browser-verified visually**: a running preview would collide with the stable `:5173`/`:8787` instance, so the live "bubble beside the real model" check is deferred to the owner's run (or an isolated-port pass). The logic is unit-covered; the CSS reuses the established theme vars + animation patterns.

### `v0.24.2` — 2026-07-02 — Proactive style self-tuning (Initiative 17 ✅ closes)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **NEW `proactive/style.ts`** — the two-layer style (port of Python `memory/proactive_config.py`): operator env knobs are the mechanical floor/ceiling; a Luna-writable style (activeness aloof/balanced/clingy + `voiceNotes`) is scaled WITHIN them. `resolveEffectiveCadence(style)` applies the `_LEVEL_MULT` lever (cooldown/prob/quota) then clamps; **`balanced` reproduces the raw knobs exactly**, so behaviour is unchanged by default. `loadStyle`/`saveStyle` persist to a singleton row; `effectiveCadence()` is the scaled cadence in effect (balanced when `LUNA_PROACTIVE_STYLE=0`).
- **NEW migration `0014_proactive_style.sql`** — a single-row `proactive_style` table (`activeness` + `voice_notes`).
- **NEW tool `set_proactive_style`** (`tools/builtin/proactiveStyle.ts`, `defineTool`, `proactiveRisk:'safe'`) — Luna tunes her own activeness + voice notes; the clamp is enforced in `resolveEffectiveCadence`, never trusted from the tool input. Added to `ToolName` (protocol — a one-line wire enum addition) + `builtinRegistry`.
- Wired the lever: `passesAntiSpam` reads `minIntervalMs`/`dailyQuota` from `effectiveCadence()`; `evaluateLadder` reads `nudgeProb`/`ambientProb`/`renudgeBaseMs`; `proactiveTurn` threads `voiceNotes` into the scenario framing.
- Tests: **+13** across `style.test.ts` (lever scaling + floor/ceiling clamps + persistence + corrupt-value degrade) and `proactiveStyle.test.ts` (tool persists + advertises the fixed safety bound). **795 server + 104 protocol/web green, `tsc` ×3 clean.**
- **Initiative 17 ✅ complete (3/3).** The LD #15 amendment (v0.24.1) stands.

Inference:

- Closes the proactive-parity-restore initiative: the wake is the owner's Python silence ladder, and she can now tune her OWN outreach personality (as in the Python design) without ever exceeding the operator's safety rail. `balanced` is the default, so nothing shifts until she moves her activeness.
- The `set_proactive_style` ToolName is the initiative's only wire touch; the web `toolLabels` fallback handles the new tool gracefully (no web change needed).

### `v0.24.1` — 2026-07-02 — Proactive silence ladder: flip default + retire detectors (Initiative 17)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- Flipped `ladder.ts` `ladderEnabled()` to **default-ON** (`LUNA_PROACTIVE_LADDER !== '0'`) — the silence ladder is now THE proactive wake decision; `=0` is the escape hatch (no proactive openings; reactive + continuation + dream unaffected).
- **Deleted `proactive/detectors.ts`** (the 5 detectors — afterNight, scheduledWindow, weatherShift, openThreadAged, promisedFollowThrough — + the registry + `evaluateDetectors`) and `detectors.test.ts`.
- **Deleted the scheduled-slot machinery** from `cadence.ts`: `scheduledSlots`/`isSlotConsumed`/`markSlotConsumed` + the `slotsUsed`/`slotsDate` `Cadence` fields + their load/save. The `proactive_slots_used`/`_date` DB columns (migration 0013, both `NOT NULL DEFAULT`) are left **vestigial** — no migration, no live-DB touch. `LUNA_PROACTIVE_SLOTS` is now dead.
- `fire.ts` simplified: removed the `detectProactive`/`setProactiveDetectorForTests` seam, the per-key debounce, and the detector branch of `maybeFireProactive`; `FireOutcome` is now `{ fired, spoke }`. The ladder is the sole path. `scheduler.ts` dropped the detector-seam re-export + its stale comments.
- Tests: deleted `detectors.test.ts`; rewrote `fire.test.ts` (detector-funnel → ladder-funnel rail behaviors) + `scheduler.test.ts` (detector-path → ladder path; the `>18h` test flips from "still fires" to "→ `sleeping`, no fire" — pure-Python parity); removed the slot tests from `cadence.test.ts`. **784 server green, `tsc` clean.**
- **Amended LD #15** in `REWRITE_CONTEXT.md` (2026-07-02): the detector-registry framing of the wake decision is reversed at the owner's direction; the ladder is the DECISION, detectors deleted; the agency turn + safety gate + dropped delivery layer stand.

Inference:

- Completes the reversal LD #15 recorded: the proactive wake is now purely the owner's Python silence-driven design — no calendar slots, no event detectors. This is the pure-Python-replica scope the owner chose, accepting the loss of the net-new weather-shift / promise-follow-through / open-thread / after-a-night triggers, and the behavior change that she **no longer proactively greets after a long absence** (long-absence → `sleeping`, she waits for the user).
- On the owner's next restart the ladder goes live (default-on); the owner's `.env`'s temp `LUNA_PROACTIVE_SLOTS` becomes a harmless no-op (can be removed).

### `v0.24.0` — 2026-07-02 — Proactive silence ladder: core (Initiative 17 opens)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **NEW `proactive/ladder.ts`** — `evaluateLadder(ctx, rng)`, the Python `proactive.py` phase machine ported as a pure function. One signal, `effective_gap = min(userGap, sinceProactive)`, drives `engaged → idle_watch → nudged → dormant (+ sleeping)`: an `ambient` musing (12%) in a short lull, an `idle_nudge` past the idle threshold, `renudge` on exponential backoff `[1.0, 2.4, 6.0]`, `leave_message` at max_nudges, DORMANT auto-recovery after a cool-down, long-absence → sleeping, and a read-time user-reset (`lastUserMs > lastProactiveMs`, so v0.24.0 never touches the reactive path). Returns a `LadderDecision {scenario, phase, nudgesSent}` — the EFFECTIVE post-transition state, not just the scenario. Env knobs: `LUNA_PROACTIVE_{IDLE_THRESHOLD,AMBIENT_MIN,RENUDGE_BASE,DORMANT_RECOVERY,LONG_ABSENCE}_MS` + `{AMBIENT,NUDGE}_PROB` + `MAX_NUDGES`.
- **`proactive/cadence.ts`** — `commitScenario` now advances phase/quota from the evaluator's EFFECTIVE base (not the stale persisted cadence); `commitLadderSilent` (a scenario offered but the model stayed silent → stamp the cooldown + persist the transition, no quota/nudge — Python `note_attempt`); `commitLadderPhase` (a null tick → persist the transition WITHOUT stamping `lastProactiveMs`, so the recovery/idle clock keeps accruing).
- **`proactive/proactiveTurn.ts`** — the four restraint-graded scenario framings (`SCENARIO_BODIES`) + the full `COMPANION_OPENER_CONSTRAINT` (陪伴不查岗: self-disclosure or a fresh topic, never a 在吗/status opener, vary every opener) + per-session anti-repeat of recent spoken openers; `runProactiveTurn` gains a `scenario` path (silence is native — no Python SILENT sentinel).
- **`proactive/fire.ts`** — a `LUNA_PROACTIVE_LADDER`-gated branch in `maybeFireProactive`: consults the ladder instead of the detector registry, reusing the SAME single-turn lock + anti-spam rail + turn + cadence-commit funnel; persists the evaluator's phase on the spoke, silent, AND null-tick paths.
- Flag **`LUNA_PROACTIVE_LADDER`** (default **OFF** — coexists with the detector registry, which stays the default; v0.24.1 flips it on + retires the detectors). Also fixed a pre-existing `.env`-pollution flake in the scheduled-slots test (missing `beforeEach` clear).
- Tests: **+27** across `ladder`/`cadence`/`fire`/`proactiveTurn` (phase transitions, effective-gap suppression, backoff, dormant recovery, user-reset, idle_watch climb, commit semantics, scenario framing, anti-repeat, flag routing, + silent-climb & dormant-no-lockout integration). **807 server green, `tsc` clean.**
- **Adversarial review (2 finder lenses + refute-by-default verify): 3 CONFIRMED defects, ALL FIXED** — (1) the pure evaluator's user-reset/dormant-recovery were DISCARDED because `commitScenario` advanced from the stale cadence (`nudgesSent` carry-over `2+1=3` skipped the entire renudge tier); (2) a silent tick never persisted the transition → DORMANT auto-recovery was permanently defeated (lockout); (3) the same discard froze the engaged→idle climb across silent ticks. Root cause: making the evaluator pure while committing only on the spoke path. Fix: `evaluateLadder` returns the effective `{scenario, phase, nudgesSent}` and `fire.ts` persists it on EVERY path (mirrors Python's in-place `st` mutation + `note_attempt`).

Inference:

- Restores the owner's original Python proactive design as the wake DECISION (amends LD #15's detector-only framing — fully resolved at v0.24.1). The default path is byte-unchanged with the flag off, so nothing in production shifts until the v0.24.1 flip.
- The review caught a genuine architectural mistake in the pure-evaluator split: the transitions the machine computes MUST persist across silent ticks, exactly as the Python shared-`st` design does. The fix aligns the TS commit seam (three explicit commit functions) with that invariant — and the regression tests encode each confirmed failing trace.

### `v0.23.5` — 2026-07-01 — Persona: kill the assistant-filler closer tic

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Root cause (from live L2 in `luna.sqlite`):** every reply carrying the filler ("Still here — what's on your mind?", "Talk to me", "What's wrong?", "Still here.") is a **reactive** turn — `turn_id` `default:turn:NNN` with a non-empty `user_text` — **11 of the recent 237 turns**, clustering after a thin or emotionally-charged input; one fired in `turn:236` *immediately after the user complained her replies sounded robotic*, and `turn:237` was the user asking why she keeps doing it. **Zero** proactive/continuation turns are involved. The string is **model-generated** — a repo-wide grep finds it in neither the TS nor the Python source (only test fixtures use `"Still here."` as sample text), so it is **not** a hardcoded fallback.
- **The design gap:** the anti-查岗 / anti-boilerplate steer (`COMPANION_OPENER_CONSTRAINT`) exists **only on the proactive path** (`proactive/proactiveTurn.ts`); reactive replies had no equivalent, and the persona file's abstract *"Do not drift into assistant politeness…"* (`persona/default.md:102`) wasn't concrete enough for `sonnet-4-6` to hold — it emitted the tic even while the user was complaining about it.
- **Fix:** `persona/humanity.ts` `renderHumanityBlock()` — the "How you speak" block pushed into the cached system prompt at `turn/runTurn.ts:137` — gains a **concrete** rule: it names the banned closers ("Still here", "What's on your mind?", "Let me know", "I'm here whenever", "Talk to me", "What's wrong?", "在吗", "还在吗"), grants *"a reply can simply end — you do not owe every message a trailing question"*, and mandates mirroring a thin message (an "OwO", a "lol", a keysmash) *just as lightly* instead of inflating it into a probing/status question — while explicitly preserving genuine, specific curiosity (real follow-up questions stay in character).
- Tests: `+1` in `persona/persona.test.ts` (the humanity block names the banned closers + carries the "can simply end" permission + "engagement bait"). `tsc` (server) clean; persona suite **14 green**.

Inference:

- This closes a real asymmetry, not a model regression: the reactive path never had the reactive analogue of the proactive companion-opener constraint. **Concrete beats abstract** — naming the exact leaked phrases is what steers the model, where the persona file's abstract "no assistant patterns" had failed.
- **Restart-gated:** the system block is memoized per process (`runTurn.ts:298-308`, rebuilt only on a new process or a `memoryEpoch` change), so the stable instance must restart for the new rule to take effect.

### `v0.23.4` — 2026-06-29 — OpenAI hardening: post-ship audit (PR #8) remediation

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Theme C — orphaned tool_call (the default-path bug):** `openai/openaiProvider.ts` `chatStreamBuffered` now forces `stopReason='tool_use'` when the response carries `tool_calls` but `finish_reason` was `stop`/`length` (mirrors the guard `chatStreamSSE` already had since v0.23.2). Without it, `runTurn`'s `stopReason==='tool_use'` gate skipped dispatch while the `tool_use` block was already in history → the next `messagesToOpenAI` emitted an assistant `tool_call` with no answering `tool` message → 400, session wedged. The buffered path is the DEFAULT (`LUNA_OPENAI_STREAM` off).
- **Theme D — config dead-on-arrival:** `chatUrl()` drops the `ANTHROPIC_BASE_URL` fallback → `LUNA_OPENAI_BASE_URL ?? 'https://api.openai.com/v1'` (no `/v1`-drop 404, and never ships the OpenAI request + bearer key to the Anthropic host). `factory.ts` threads the resolved wire `model` into `OpenAIProvider` (+ empty-string `LUNA_MODEL` guard) and `main.ts` resolves protocol/model/endpoint the same way for an accurate startup log (no more "wire `gpt-4o-mini` while the log says `claude-opus-4-8`"). `LUNA_MAX_TOKENS` is `NaN`-guarded in both providers. `registry.ts` `id: z.string().min(1)` (a blank id no longer becomes a catch-all rerouting every model).
- **Theme B — tolerant parsing:** `translate.ts` adds `parseStreamChunkSafe` (the SSE loop skips a malformed chunk instead of crashing a turn mid-stream), `StreamChunk.index` `.default(0)`, and a modeled `error` frame (`string | object`) + `streamErrorMessage`; the SSE loop throws on an in-band error frame (HTTP 200 + error) instead of emitting an empty turn. `chatStreamSSE` synthesizes a stable `call_<index>` tool id so a gateway that omits per-delta ids can't produce empty/colliding `tool_call_id`.
- **Theme A — message-tool forcing:** `requestBody` sends `tool_choice: 'required'` when tools are present (registry-overridable to `'auto'`), so a GPT-family model must call a tool (LD #9: speaking IS the message tool) rather than answering in free `content` that message mode wouldn't surface.
- **Theme E — reliability parity:** a bounded `fetchOk` retry (connect error / 429 / 5xx, before first byte) on both the buffered and SSE paths (parity with the Anthropic SDK's `maxRetries:2`); `complete()` sends `reasoning_effort:'low'` on a reasoning model so hidden reasoning can't eat the token budget and return empty for dream/fold utility calls.
- **Theme F — smaller:** HTTP error bodies are logged server-side but NOT surfaced to the client (no gateway-internal/key-fragment leak); the SSE reader is `cancel()`ed in `finally` (no leaked connection on break/throw/abort) with a line-buffer + output size cap; `mapStopReason` passes `content_filter` through (not masked as `end_turn`); `tool_result.is_error` is prefixed onto the OpenAI `tool` message.
- Tests: `+9` across `openaiProvider.test.ts` (buffered tool_use guard; `tool_choice:'required'`; `complete()` reasoning_effort; chatUrl never the Anthropic host), `stream.test.ts` (malformed-chunk skip; synthesized `call_<index>` id; error frame object+string), `registry.test.ts` (blank-id rejected). 883 green, `tsc` ×3 clean.
- Adversarial review (2 lenses on the un-unit-tested retry/reader control flow + the parsing/config fixes, refute-by-default): 4 findings, **0 confirmed** (abort honored one backoff late — nit; `length`-truncated tool degrades to a recoverable tool-error not corruption; index-less multi-tool collision doesn't occur on real streams; string-error-frame swallow — closed anyway via the `string|object` union).

Inference:

- Every fix shares the audit's root-cause diagnosis: the net-new code ported Anthropic's *reliability assumptions* (forced tool use, a tolerant SDK, prompt cache, retry) onto the stricter OpenAI wire + the third-party gateways this adapter exists to serve. The per-version reviews (v0.23.1/.2) caught the in-version diffs; the post-ship audit caught the **cross-version + consumer-interaction** gaps — notably the buffered/SSE asymmetry (I fixed SSE in v0.23.2 and left the default buffered path exposed) and message-mode's reliance on forced tool use.
- This is hardening done **before** the first live run (the OpenAI path is default-off, so nothing in production was affected) — the cheapest possible time to fix dead-on-arrival config + a session-wedging history-poison. The audit's own caveat stands: the remaining gaps the unit fixtures can't reach (real SSE bytes, the gateway's exact `/chat/completions` path, model-specific `tool_choice`/`reasoning_effort` acceptance) verify only against a live gateway when `LUNA_PROVIDER=openai` is first exercised.

### `v0.23.3` — 2026-06-25 — OpenAI-protocol adapter 4/4: model registry (Initiative 16 ✅)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `provider/registry.ts` (NEW): `ModelEntry` {`id`, `protocol`, `tokenParam?`, `systemRole?`, `reasoning?`, `toolUse?`} + `resolveModel(modelId)` — prefix-matches `modelId` against a built-in table (claude → anthropic; `o1`/`o3`/`o4` → openai + `developer` role + `max_completion_tokens` + reasoning; `gpt-5` → + `max_completion_tokens`; `gpt-` → openai) with a Zod-validated `LUNA_MODELS_JSON` override prepended (overrides win); unknown → a safe anthropic default. The ONE place model ids are matched.
- `provider/factory.ts`: `providerFor()` is now registry-driven — resolves `LUNA_MODEL` → entry → protocol; `LUNA_PROVIDER` (if set) overrides the protocol (validated to anthropic|openai, else throws); a forced-openai on a non-openai model gets a default openai entry. The OpenAI provider is constructed WITH its entry.
- `provider/openai/openaiProvider.ts`: constructor takes `entry?: ModelEntry` and derives `tokenParam` (`max_tokens` vs `max_completion_tokens`), `systemRole` (`system` vs `developer`), `capabilities.thinking` (from `entry.reasoning`), `capabilities.toolUse` (from `entry.toolUse`). `complete()` + `requestBody()` use the computed token-param key + system role; a no-tool entry omits `tools`. All quirks are entry-driven — **no model-id regex** anywhere outside `registry.ts`.
- `provider/openai/translate.ts`: `systemToOpenAI(system, role)` gains the role param (`system`|`developer`); `OAChatMessage` allows the `developer` role.
- `docs/REWRITE_CONTEXT.md`: the provider LD finalized — resolution is the registry (`LUNA_MODEL` + `LUNA_MODELS_JSON`), `LUNA_PROVIDER` forces the protocol. `.claude/skills/luna-ts-orient/SKILL.md`: the `provider/` map + flags refreshed. Master `docs/roadmap/README.md`: Initiative 16 marked ✅.
- Tests: `provider/registry.test.ts` (NEW, 7 — claude→anthropic, gpt-4o→openai defaults, gpt-5/o-series quirks, unknown→anthropic, `LUNA_MODELS_JSON` override precedence, invalid-JSON ignored) + `openaiProvider.test.ts` +2 (a developer-role/`max_completion_tokens` entry shapes the request; a no-tool entry omits `tools`). 875 green (+9), `tsc` ×3 clean. Manually verified provider selection (gpt-4o→OpenAIProvider, claude→AnthropicProvider).

Inference:

- **Initiative 16 is closed (in code).** Luna now runs on Anthropic OR any OpenAI-protocol model — the seam (v0.23.0), the translation core (v0.23.1), real streaming (v0.23.2), and now a registry that turns "pick a model" into one decision and makes a *new* model a config entry, not a code change. The boundary-translation shape (Anthropic-shaped types as the IR) kept the blast radius to `provider/` — `runTurn`/history/memory/the ~30 SDK importers never moved.
- Per-model quirks live behind `ProviderCapabilities` + the registry entry, never a model-id regex at a call site — so a model that rejects `system`, needs `max_completion_tokens`, reasons, or lacks tools is one table row, and adding the next quirk is one field.
- The one acceptance criterion that **cannot** be met by code + unit tests is the live multi-model E2E (a real GPT/o-series turn + an OSS model + Anthropic unchanged) — it needs a restart against real endpoints, and it is also where `defaultStreamFetch`'s real bytes + the gateway's exact `/chat/completions` path get exercised. That is the genuine remaining step, tracked alongside the standing "proactive not live-tested" status.

### `v0.23.2` — 2026-06-25 — OpenAI-protocol adapter 3/4: real SSE streaming

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `provider/openai/openaiProvider.ts`: `chatStream` now branches on **`LUNA_OPENAI_STREAM`** (default off → the v0.23.1 `chatStreamBuffered`; `=1` → the new `chatStreamSSE`). `chatStreamSSE` consumes parsed SSE chunks and emits `text_delta` (`delta.content`), `thinking_delta` (`delta.reasoning`/`reasoning_content`), `tool_use_start` + `tool_input_delta` (interleaved, as they arrive), accumulating `tool_calls` by `index` into an `acc` map (`{id,name,arguments,started}`; emits `tool_use_start` on the first id+name, flushing any earlier-arrived argument fragments), then one `message_stop` built from the same parts. A `defaultStreamFetch` SSE reader (uses the pure `consumeSSE` framer) + a `setOpenAIStreamFetcher` test seam. `capabilities` is now computed in the constructor: `interleavedToolStreaming = LUNA_OPENAI_STREAM===1`, `thinking = LUNA_OPENAI_REASONING===1`.
- `provider/openai/translate.ts`: factored the block construction into shared `blocksFromParts`/`toolUsesFromParts` (used by both the response path `toAssistantContent`/`toProviderToolUses` and the streaming path `streamedAssistantContent`/`streamedToolUses`) so streamed and non-streamed turns synthesize byte-identical `ContentBlockParam[]` history. Added `parseStreamChunk` (a lenient Zod streaming-delta schema) + `consumeSSE` (a pure byte-framer: complete `data:` lines → payloads + remainder + `[DONE]`, CRLF-tolerant).
- `.env.example`: `LUNA_OPENAI_STREAM` + `LUNA_OPENAI_REASONING`.
- Tests: `provider/openai/stream.test.ts` (NEW, 7 — text-only ordering + trailing-usage; a tool call with fragmented args reassembling; reasoning→thinking (both field names); interleaving (text→tool→text not buffered); two tool calls at different indices; **no-finish_reason → still a tool_use stop**; args-before-id/name buffered flush) + `translate.test.ts` +6 (`consumeSSE`: complete lines, split-across-reads remainder, CRLF, `[DONE]`, comments skipped, final-line flush). 866 green (+13), `tsc` ×3 clean.
- Adversarial review (streaming-accumulation + SSE-framing lenses, each finding refuted): **2 real robustness gaps found and fixed before commit** — (1) a tool-bearing SSE stream that never sends a terminal `finish_reason` chunk left `finishReason` null → `mapStopReason(null)`=`end_turn`, so runTurn's `stopReason==='tool_use'` gate would NOT dispatch, orphaning `tool_use` blocks in history and 400-ing the next OpenAI request; now defaults to `tool_calls` when any tool was accumulated (conformant OpenAI always sets it, but the default base URL is the third-party gateway). (2) `defaultStreamFetch` dropped a final `data:` line with no trailing newline; `consumeSSE` + an end-of-stream flush recover it. Both covered by new tests.

Inference:

- The latency principle the whole rewrite is built on (interleaved tool-use streaming, REWRITE_CONTEXT) now holds on the OpenAI path too: the `message` tool's bubble streams token-by-token instead of arriving whole, matching the Anthropic feel. The shared `blocksFromParts` is the guarantee that turning streaming on/off can never change what lands in history — the same property that lets a provider switch round-trip.
- Default-off (`LUNA_OPENAI_STREAM`) keeps a streaming bug from regressing the proven v0.23.1 non-streaming path: the fallback is the safety net while the SSE path is verified live (v0.23.3). The two fixed gaps are exactly the kind a third-party gateway (non-conformant `finish_reason`/framing) exposes that canonical OpenAI never would — worth hardening before the flag flips on.
- v0.23.3 (the registry) flips `LUNA_OPENAI_STREAM`/`LUNA_OPENAI_REASONING` from interim flags into per-model entries + runs the multi-model E2E that exercises `defaultStreamFetch`'s real bytes — the last thing the unit fixtures can't reach.

### `v0.23.1` — 2026-06-25 — OpenAI-protocol adapter 2/4: translation core + provider

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `provider/openai/translate.ts` (NEW, ~190 lines, pure — no I/O): the only module that knows the OpenAI Chat-Completions wire shape. Request side: `systemToOpenAI` (string or `cache_control`-marked blocks → one system message, cache_control dropped), `messagesToOpenAI` (Anthropic `MessageParam[]` → OpenAI: text→content, `tool_use`→`assistant.tool_calls[]`, `tool_result`→a standalone `{role:'tool', tool_call_id}` message ordered before any user text, thinking dropped), `toolsToOpenAI` (`input_schema`→`function.parameters`), `parseToolArguments` (empty/malformed/non-object → `{}`). Response side: `parseOpenAIResponse` (Zod), `toAssistantContent` (→ a synthesized `Anthropic.ContentBlockParam[]` for history replay: text + `tool_use` blocks, reusing `unwrapGatewayInput`), `toProviderToolUses`, `mapStopReason` (`tool_calls`→`tool_use`, `length`→`max_tokens`, `stop`→`end_turn`), `mapUsage`.
- `provider/openai/openaiProvider.ts` (NEW, ~120 lines): `OpenAIProvider implements Provider`. `complete()` (dream/summarizer cascade) + a **correctness-first non-streaming `chatStream()`** that yields an optional `text_delta` then one `message_stop` (real SSE streaming + interleaved tool-use is v0.23.2). `capabilities` = tools+systemRole only (thinking/promptCache/interleaved false; v0.23.2/v0.23.3 flip per model). Per-instance `apiKey` (`opts ?? LUNA_OPENAI_API_KEY ?? ANTHROPIC_API_KEY`); `chatUrl()` = `(LUNA_OPENAI_BASE_URL ?? ANTHROPIC_BASE_URL ?? api.openai.com/v1)` + `/chat/completions`. A minimal `fetch` client (not SSRF-guarded — it's the trusted configured LLM endpoint, like `ANTHROPIC_BASE_URL`) behind a `setOpenAIFetcher` test seam.
- `provider/factory.ts`: the `openai` branch now returns `new OpenAIProvider(opts)` (was a throw).
- `provider/types.ts`: `ProviderEvent.message_stop.assistantContent` retyped `Anthropic.ContentBlock[]` → `ContentBlockParam[]` — the replay content is conceptually input-for-the-next-turn (a param), so a non-Anthropic provider can synthesize it without response-only fields (`ToolUseBlock.caller`); Anthropic's `final.content` still assigns. Only production consumer is `runTurn.ts:364` (history.push, takes a param array). The inline `Provider` literal in `dream.test.ts` got the `capabilities` field.
- `.env.example`: documents `LUNA_PROVIDER` / `LUNA_OPENAI_BASE_URL` (set to the `/v1` base) / `LUNA_OPENAI_API_KEY`.
- Tests: `provider/openai/translate.test.ts` (NEW, ~17 — the round-trip crux: a tool-using multi-turn history maps to correctly-ordered OpenAI messages; tool_result+text ordering; tool_use-no-text→content null; `parseToolArguments` edge cases; response→blocks for text/tool/both; usage absent→zeros) + `provider/openai/openaiProvider.test.ts` (NEW, 4 — `complete()` maps content+usage and sends system+user; `chatStream()` text and tool-call paths via injected fetcher; empty-choices throws). 853 green (+20), `tsc` ×3 clean.
- Adversarially reviewed (translation-fidelity + provider-integration lenses, each finding refuted): 7 findings, **0 confirmed real** — the Zod schema is correct for standard chat-completion responses (an array-content/refusal response throws loudly, not silently); the `ANTHROPIC_BASE_URL`→`/chat/completions` `/v1` footgun is documented; image/thinking-only edge cases are accepted (deferred). No code change required.

Inference:

- This is the version where Luna can actually run a turn on an OpenAI-protocol model — the translation core is the load-bearing piece, so it ships as **pure functions tested independently of any network** (the round-trip fixture is the real guarantee). Correctness-first (non-streaming) deliberately precedes the latency work (v0.23.2): a working tool-using turn on the OpenAI path beats a fast-but-wrong one.
- The `ContentBlockParam[]` retype is the small architectural truth the boundary-translation design needs: "the assistant turn to replay" is an *input* shape, not a fresh response, so any provider — Anthropic or not — produces param blocks. It also future-proofs against SDK response types gaining response-only required fields (the `ToolUseBlock.caller` that surfaced here).
- v0.23.2 swaps the non-streaming `chatStream` body for an SSE reader emitting the *same* `ProviderEvent` sequence (interleaved tool-use), and v0.23.3's registry flips the per-model capability quirks — both slot in without touching `translate.ts`'s pure core or `runTurn`.

### `v0.23.0` — 2026-06-25 — OpenAI-protocol adapter 1/4: provider seam (Initiative 16 opens)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `provider/capabilities.ts` (NEW): `ProviderCapabilities` type (`thinking`, `promptCache`, `interleavedToolStreaming`, `toolUse`, `systemRole`, `maxOutputTokens`) + `describeCapabilities()` (a one-line summary for the startup log). The branch point every later consumer reads instead of sniffing a model id.
- `provider/types.ts`: `interface Provider` gains `readonly capabilities: ProviderCapabilities`.
- `provider/factory.ts` (NEW): `providerFor(opts?: {apiKey?})` reads `LUNA_PROVIDER` — `anthropic` (default) → `new AnthropicProvider(opts)`; `openai` → throws "not implemented until v0.23.1"; anything else → throws "unknown LUNA_PROVIDER" (fails fast, no silent fallback). `apiKey` is threaded per-instance.
- `provider/anthropic.ts`: `AnthropicProvider` declares `capabilities` (all true; `maxOutputTokens = MAX_TOKENS`). `chatStream`/`complete` untouched.
- `provider/mock.ts`: `MockProvider` gains a defaulted, mutable `capabilities` field (mirrors Anthropic) — a class-field default, so existing `new MockProvider(rounds)` calls are unchanged.
- `main.ts`: both `new AnthropicProvider(...)` sites → `providerFor(...)`; the boot log prints `LUNA_PROVIDER`/`LUNA_MODEL` + `describeCapabilities(provider.capabilities)`. The `AnthropicProvider` import is replaced by `providerFor` + `describeCapabilities`.
- `dream/dream.test.ts`: the inline `Provider` literal gains `capabilities` (delegated to the wrapped provider) — the only existing-test edit the interface change forced.
- `docs/REWRITE_CONTEXT.md`: the provider Locked Decision row amended in place — chat is no longer Anthropic-SDK-only; the cut `openai_compat` rationale (broken `api_key_override`) doesn't apply to a fresh TS provider that takes `apiKey` per-instance; default path unchanged; embeddings (LD #13) unaffected.
- Tests: `provider/factory.test.ts` (NEW, 7 — default/anthropic/openai-throws/unknown-throws/capability-descriptor-present/apiKey-threaded/both-providers-declare-every-field). 833 green (+7), `tsc` ×3 clean. Manually verified: `LUNA_PROVIDER=openai` fails fast; default constructs an Anthropic provider with the full descriptor.

Inference:

- This is the foundational seam Initiative 16 builds on: the `Provider` interface was already the single chat seam, but construction was hardwired (`new AnthropicProvider()` at two sites) and there was no way to declare or branch on model capabilities. `providerFor()` + `ProviderCapabilities` give the rest of the initiative a stable interface to slot the `OpenAIProvider` behind with zero churn — v0.23.1 only flips the factory's `openai` branch from throw to construct.
- Deliberately a *pure* seam (zero `runTurn` change): the roadmap had sketched gating `cache_control` on `promptCache`, but the OpenAI provider will receive the `cache_control`-marked system block and strip it at translation time — so the Anthropic prompt-cache invariant (byte-stable cached block, the rewrite's #1 perf goal) is provably untouched here.
- Amending the provider LD now (not at the end) locks the architectural reversal before any OpenAI code lands, with the rationale recorded where future readers will look — the cut was for a specific Python-adapter bug, not an objection to OpenAI-protocol chat per se.

### `v0.22.3` — 2026-06-25 — Proactive redesign 4/4: fuzzy detectors + delete the wake-gate (Initiative 15 ✅)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `proactive/detectors.ts`: two heuristic detectors added to `REGISTRY` (now `[afterNight, scheduledWindow, weatherShift, openThreadAged, promisedFollowThrough]`), both **default-off** + soft-seeded (a stale/false positive yields silence — the turn still decides). `openThreadAged` (`LUNA_PROACTIVE_OPEN_THREADS=1`): reads `listFacts({category:'active_threads'})`, fires on the newest thread older than `LUNA_PROACTIVE_THREAD_AGE_MS` (24h), `debounceKey thread:<id>`. `promisedFollowThrough` (`LUNA_PROACTIVE_FOLLOW_THROUGH=1`): the newest persisted L2 turn is an unfollowed promise (a tightened commitment-phrase regex, EN+中) inside the age **window** `[LUNA_PROACTIVE_PROMISE_AGE_MS 6h, LUNA_PROACTIVE_PROMISE_MAX_AGE_MS 36h)`, `debounceKey promise:<hash>`. Both pure + clock-injectable.
- **Deleted the wake-gate**: `proactive/wakeGate.ts` + `wakeGate.test.ts` removed; the `LUNA_PROACTIVE_LLM_GATE` branch (`tickLlmGateSession`, `emitWakeDecision`, `gapLabel`, `daypartOf`) gone from `scheduler.ts` — `tickOnce` now just iterates sessions → `maybeFireProactive`. The orphaned `shouldConsiderWake` (cadence.ts) + `listRecentProactiveTexts` (sessionStore.ts) and their tests removed too. The `proactive_wake` decision trace + the `judgment_unparseable`/`judgment_unavailable` failure classes are gone with it. The heartbeat hot path is now **LLM-free**.
- Dev force-trigger: the existing `proactive.fire` (ws.ts, lock-routed in v0.22.2) already forces one proactive turn bypassing detectors — the acceptance criterion is met without a new wire event (deliberate divergence from the plan's "or a new dev event" option).
- Tests: `detectors.test.ts` +7 (openThreadAged: aged-fires / not-aged / flag-off; promisedFollowThrough: aged-fires / not-a-promise / flag-off / too-recent / **empathy-line false positive stays null** / **abandoned past max-age stays null**). `cadence.test.ts` / `sessionStore.test.ts` shed the deleted-symbol describes. 826 green, `tsc` ×3 clean.
- Adversarial review (a 2-lens panel — detector correctness/false-positives + deletion-completeness/acceptance — each finding refuted): **5 confirmed, all fixed inline before this commit**: (1) tightened `PROMISE_PATTERNS` (dropped bare `see`/`find`/`look`, bounded the `[^.!?]{0,40}` gap, EN commitment phrases + 中 deferral+verb) so empathy lines ("I'll see you", "let me see if…", "我看看窗外") no longer match; (2) added the abandoned-promise upper bound (a SILENT proactive turn persists no L2 row, so an unfollowed promise stayed the newest row and re-fired every debounce window forever — the `maxAgeMs` window makes it terminal); (3) `.env.example` reconciled — dead `IDLE_THRESHOLD_MS`/`LONG_ABSENCE_MS` removed, all 10 Initiative-15 knobs documented; (4) `listRecentProactiveTexts` deleted as dead code; (5) the `luna-ts-orient` skill-map refreshed to the post-wake-gate flow.

Inference:

- **Initiative 15 is closed.** The proactive path is now exactly the design's through-line: cheap deterministic detectors (time-driven `afterNight`/`scheduledWindow`, content-driven `weatherShift`/`openThreadAged`/`promisedFollowThrough`) → the existing silence-capable turn graph → the turn's own `{spoke}` is the only "should I speak?" judgment. **Zero speculative LLM on an idle day** — the per-tick wake-gate that decided *before* drafting (and never once said "act" in live data) is gone.
- The two fuzzy detectors are the part that needed heuristics, so they ship behind their own flags + soft seeds: the worst case of a bad heuristic is a silent considered-turn, not an awkward message. A future "spontaneous, reason-less" reach-out is now a *single new detector* (e.g. a rare randomized musing), not a per-tick LLM gate — the registry makes that additive.
- The review's two real detector bugs both came from the silence-by-design property interacting with state: a silent turn leaves no trace in L2, so any detector keying off "the newest turn" (promisedFollowThrough) needs an upper time bound, and any regex over assistant text needs to exclude this persona's empathy idioms. Both are now covered by tests.

### `v0.22.2` — 2026-06-25 — Proactive redesign 3/4: event hooks + a real single-turn lock + weatherShift

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `proactive/fire.ts` (NEW, ~150 lines): the universal proactive entry point. `withProactiveLock(session, fn)` — the **single-turn lock**: a synchronous per-session in-flight `Set` flipped before any await (the has-check + `add` run with no await between them, and `runProactiveTurn → runTurn` sets `session.activeTurn` synchronously before runTurn's first await), plus the shared rail (no reactive turn, not dreaming, proactive enabled); runs fn, releases in `finally`; returns `null` without running fn when the rail rejects. `maybeFireProactive(opts)` — the detector funnel run INSIDE the lock: `loadCadence` → `passesAntiSpam` → the detector seam → an in-memory **per-key debounce** (`LUNA_PROACTIVE_DEBOUNCE_MS`, default 4h) → `runProactiveTurn` → spoke/silent cadence commit + slot mark → `markDebounced` → the `pendingDream` handoff. The detector seam (`setProactiveDetectorForTests`) moved here from `scheduler.ts`. `proactiveInFlight` + `resetProactiveFireStateForTests` exported.
- `proactive/detectors.ts`: adds the **`weatherShift`** detector — diffs `getSnapshot()`'s coarse bucket (`conditionClass` × `tempBand`, normalized to °C so an ordinary daily swing stays in one band) against a module-level baseline; first sight seeds the baseline (can't shift from nothing), a later bucket change fires once (seed built from the live condition) and re-seeds. Reads only the cached snapshot (never the network); `LUNA_PROACTIVE_WEATHER_SHIFT=0` kill switch; `resetWeatherBaselineForTests`. `REGISTRY` is now `[afterNight, scheduledWindow, weatherShift]` (morning greeting > scheduled floor > opportunistic weather).
- `proactive/scheduler.ts`: `tickOnce` now calls `maybeFireProactive` per session (the funnel + lock). The legacy LLM wake-gate path (`LUNA_PROACTIVE_LLM_GATE=1`) is extracted to `tickLlmGateSession` (short-circuits on `activeTurn` before the wakeGate call, then wraps its fire in `withProactiveLock`). New exported `fireProactiveForActiveSessions(deps)` — the weather hook's iterator over `activeSessionIds()`. `setProactiveDetectorForTests` re-exported from `fire.ts` for back-compat.
- `proactive/continuation.ts`: `fireContinuation` routes through `withProactiveLock` (drops its own `activeTurn`/`isDreaming`/`proactiveEnabled` checks — the lock applies them). Deliberately rail-LIGHT: still no cadence commit (a continuation is the bounded one-per-reply micro-wake, LD #11 — quota- and cooldown-exempt by design).
- `tools/web/weather/snapshot.ts`: `setOnWeatherRefresh(cb)` seam; `refreshWeather` calls it after a successful snapshot update (try/caught so a hook error can't break the refresh timer). Decoupled — the proactive layer is injected from `main.ts`, no import cycle. `resetWeatherSnapshotForTests` clears the hook too.
- `ws.ts`: `handleOpen` calls `maybeFireOnReconnect` — gated by `LUNA_PROACTIVE_EVENT_HOOKS`, fires the funnel immediately only when `afterANightOpening` is true (so a morning greeting lands the instant she's reconnected, not up to a 60s tick later). The dev `proactive.fire` now routes through `withProactiveLock`.
- `main.ts`: wires `setOnWeatherRefresh` → `fireProactiveForActiveSessions(schedulerDeps)` (gated by `LUNA_PROACTIVE_EVENT_HOOKS`), wired before `startWeatherRefresh` so the first refresh is covered.
- Tests: `fire.test.ts` (NEW, 9 — the lock serializes / releases / rejects on activeTurn & disabled; the funnel fires + commits, anti-spam short-circuits before the detector, two concurrent calls never double-fire, debounce skips a repeat key but passes a new one); `detectors.test.ts` +4 (weatherShift: cold cache, first-sight seed, fires once on a class change + ignores same-bucket noise, kill switch); `scheduler.test.ts` +2 (the weather hook runs the funnel + is a no-op under a live user turn) + `resetProactiveFireStateForTests` in `beforeEach`. 837 green (+16), `tsc` ×3 clean.
- Adversarial review (a 3-lens panel — concurrency, correctness, flags/regression — each finding then sent to a refuter): 8 findings, 0 confirmed real. One nit fixed inline (the parity short-circuit above). The rest were deliberate design choices (weatherShift default-on when weather is configured; the module-global baseline is single-user-correct; coarse `freezing rain → rain` bucketing; continuation defers an auto-dream — pre-existing).

Inference:

- This is the version that makes the proactive path **concurrency-correct under multiple entry points**. v0.22.0/v0.22.1 had one driver (the 60s tick) so the TOCTOU never bit; v0.22.2 adds event-driven entry points (reconnect, weather) that race on the same session, so a real lock — a synchronous in-flight flag, not a re-read of `activeTurn` — became necessary. `maybeFireProactive` is now the one funnel the rest of the initiative builds on.
- The event hooks turn the proactive system from "polled every 60s" to "fired at the natural instant" — the morning greeting the moment she's seen, a weather change as it actually lands — while the 60s heartbeat remains the backstop. Default-off this release (a new concurrency surface); flip after a live smoke.
- `weatherShift` is the first **content-driven** detector (afterNight/scheduledWindow are time-driven): a concrete, code-detected reason to consider speaking, drafted-as-decision like the rest. It sets up v0.22.3's fuzzy detectors, which slot into the same registry + funnel with no new plumbing — and once they cover the openings, `wakeGate` + `LUNA_PROACTIVE_LLM_GATE` lose their last caller and get deleted.

### `v0.22.1` — 2026-06-25 — Proactive redesign 2/4: detector registry + scheduled slots

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `proactive/detectors.ts` (NEW, ~70 lines): the detector **registry**. `ProactiveDetector` (`name` + `evaluate(ctx) → ProactiveTrigger | null`), `ProactiveTrigger` (`{intent, seed, debounceKey}`), `DetectorCtx` (`{session, cadence, nowMs, nowHour}`), an ordered `REGISTRY`, and `evaluateDetectors(ctx)` (first-match-wins). Detectors are pure + LLM-free + clock-injectable: `afterNight` (wraps `afterANightOpening(nowMs, lastInteractionMs(session))`; lifts v0.22.0's inline check; `debounceKey 'after_night'`) and `scheduledWindow` (fires when `scheduledSlots().includes(nowHour)` and that slot isn't consumed today; `debounceKey 'slot:<hour>'`). `AFTER_NIGHT_SEED` + `SCHEDULED_SEED` live here.
- `proactive/cadence.ts`: `Cadence` gains `slotsUsed` (24-bit per-day mask) + `slotsDate`. `scheduledSlots()` parses `LUNA_PROACTIVE_SLOTS` (unset/empty → `[]`, fixing a real bug: `''.split(',')` → `['']` → `Number('')` = 0 → previously returned `[0]`, i.e. a phantom midnight slot). `isSlotConsumed(c, hour, now)` / `markSlotConsumed(c, hour, now)` (mask rolls over on a new local day). `passesAntiSpam` gains a small **idle floor** (`LUNA_PROACTIVE_IDLE_FLOOR_MS`, default 60s → reason `mid_conversation`) — much smaller than the removed 10m `too_soon` gate; detectors, not an idle window, decide *when* to consider. `loadCadence`/`saveCadence` read+write the two new columns (Row type + SELECT + UPDATE + INSERT threaded).
- `migrations/0013_proactive_detectors.sql` (NEW): `ALTER TABLE sessions ADD COLUMN proactive_slots_used INTEGER NOT NULL DEFAULT 0` + `proactive_slots_date TEXT NOT NULL DEFAULT ''` (additive; a pre-migration row defaults cleanly).
- `proactive/scheduler.ts`: the detector seam now defaults to `evaluateDetectors` (signature `(ctx: DetectorCtx) → ProactiveTrigger | null`, was `(session, now)`). `tickOnce` builds the `DetectorCtx`, takes `intent`+`seed` from the returned trigger, and after a fire (spoke OR silent) calls `markSlotConsumed(next, nowHour, now)` when `trigger.debounceKey` starts with `slot:` — so a scheduled slot can't re-fire that tick. Imports of `lastInteractionMs`/`afterANightOpening` dropped (now in `detectors.ts`).
- Tests: `detectors.test.ts` (NEW, 4 — `scheduledWindow` on-slot / off-slot / consumed / stale-date-doesn't-count; afterNight null without a DB), `cadence.test.ts` +4 (idle-floor `mid_conversation`; `scheduledSlots` parse incl. unset → `[]`; `markSlotConsumed`/`isSlotConsumed` + new-day rollover), `scheduler.test.ts` +2 (a `slot:` trigger marks the slot; an `after_night` trigger marks none) with the seam updated to the new `ProactiveTrigger` shape + an `idle()` helper (lastUserMs 5min ago, past the floor). 821 green (+9), `tsc` ×3 clean.

Inference:

- `scheduledWindow` is the **guaranteed speaking floor** the design panel called for: even on a day where no content trigger lands, a configured slot gives her a daily opening — the antidote to the under-firing the whole initiative targets, and the way to verify the chain end-to-end without waiting for a real morning.
- The registry is the seam the rest of Initiative 15 builds on: adding a trigger is now a `REGISTRY` entry, not new scheduler plumbing. v0.22.2 calls `evaluateDetectors` from event hooks and adds `weatherShift` + debounce; v0.22.3 adds the fuzzy detectors and deletes the LLM wake-gate.
- The idle floor closes the review's medium finding without resurrecting the 10m `too_soon` gate: detectors still own *when to consider*, but a fire can't interrupt a conversation that's still live — the gate is a 60s "is the user mid-sentence" guard, not an idle-window policy.

### `v0.22.0` — 2026-06-25 — Proactive redesign 1/4: detector-MVP (she actually speaks)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `proactive/scheduler.ts` `tickOnce`: the **deterministic detector path is now the default**. Per session: `passesAntiSpam` → `detectProactive(session, now)` → on a hit, the existing TOCTOU re-check → `runProactiveTurn({intent, seed})` → spoke/silent commit. The legacy `shouldConsiderWake` → `wakeGate` flow is gated behind `LUNA_PROACTIVE_LLM_GATE=1` (default off; a one-release fallback, deleted in v0.22.3). Adds a `setProactiveDetectorForTests` seam (the v0.22.1 detector registry in embryo) + an `AFTER_NIGHT_SEED`.
- `proactive/cadence.ts`: `passesAntiSpam(c, x)` = the anti-spam SUBSET (proactive-enabled + quiet-hours + cooldown + quota). Deliberately omits `deep_absence` (>18h) and the `too_soon` (10m) floor that `shouldConsiderWake` applies — a long overnight/weekend absence is exactly when an after-a-night greeting *should* fire, so it must not be swallowed (the never-fires hole the redesign kills). `commitProactiveSilent(c, now)` stamps `lastProactiveMs` (cooldown anchor) without bumping the daily quota.
- `proactive/proactiveTurn.ts`: `runProactiveTurn` gains `seed?: string`, appended to the USER-tail framing (rides the uncached tail — cache invariant preserved). `lastInteractionMs(session)` exported (was module-private) for reuse by the scheduler.
- Tests: `cadence.test.ts` +8 (`passesAntiSpam`: disabled / quiet / cooldown / quota block; **a >18h gap still passes**; **a 0-min gap still passes** — no `too_soon` floor; `commitProactiveSilent` stamps cooldown + leaves quota). `scheduler.test.ts` rewritten into a **detector path** describe (silent fire keeps quota 0 + **no LLM gate call**; a >18h deep-absence still fires; cooldown; concurrency; dream handoff) + an **LLM wake-gate fallback** describe (`LUNA_PROACTIVE_LLM_GATE=1`). A `resetDreamStateForTests()` in `beforeEach` clears any fire-and-forget dream leaked from the dream-handoff test. 812 green (+11), `tsc` ×3 clean.

Inference:

- The smallest change that flips the zero-fire bias: she now reliably greets the morning after a night, with **no per-tick LLM polling** (the detector path makes zero speculative LLM calls on an idle day). The LLM is invoked only to *draft*, from a concrete reason, and decides-by-drafting via the silence-capable turn.
- Both HIGH findings from the design review are built in from the start: the detector is gated by the anti-spam *subset*, so a >18h absence is a *trigger* rather than a `deep_absence`-suppressed silence; and the spoke/silent split makes "consider and stay quiet" cheap — it doesn't exhaust the daily budget.
- The `detectProactive` seam is the v0.22.1 registry in embryo — v0.22.1 lifts the inline after-night check into `detectors.ts` and adds scheduled slots behind it.

### `v0.21.10` — 2026-06-24 — Frontend: message de-dup + history un-merge

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `turn/runTurn.ts` (message collection): a `message` delivery whose trimmed text equals the previously-collected one is NOT pushed to `messageTexts` — the model occasionally stutters (two `message` calls, identical text; observed in L2 where a turn's `assistant_text` held the same sentence twice). Keeps the `\n`-join + recall text clean.
- `web/bubbles.ts`: new pure `messageSegments(assistantText)` — splits a persisted turn's `assistant_text` (the `\n`-joined message bubbles) into one segment per message; trims, drops blank + verbatim-consecutive-duplicate segments; never returns empty.
- `web/ui/cuteBubbleView.ts` `renderHistory`: renders one luna bubble per `messageSegments(...)` entry instead of one bubble for the whole `assistant_text` — a reloaded multi-message turn looks like it did live, and the dedup un-doubles the stutter already baked into older rows.
- `web/controller.ts`: a `lastLunaText` tracker (reset in `resetTurnState`); a finalized `message` whose trimmed text equals the last finalized bubble is `discard`ed (not rendered or spoken) — the live counterpart of the server dedup.
- Tests: `web/bubbles.test.ts` (NEW, 5 cases — split, consecutive-dedup, whitespace, single, all-blank); `web/controller.test.ts` +2 (a verbatim-duplicate bubble discarded + spoken once; distinct consecutive messages both render).

Inference:

- The "duplicated message" was not a render bug — it was in the data: the model emitted the same `message` bubble twice in one turn (raw_json showed 3 `message` tool_use blocks, two identical), and the UI faithfully showed both. A consecutive-verbatim dedup (server for storage/recall, client for the live bubble + old-row reload) is the right backstop, and won't suppress a legitimate repeat across turns (the tracker resets at every turn boundary).
- The "one big block after refresh" was the persistence format leaking into the view: `assistant_text` is the `\n`-joined reply (one line per bubble), and the old `renderHistory` rendered it whole. Splitting on the join restores per-message separation for both new and existing history — no schema/wire change, because the model's own context is rebuilt from `raw_json` (not `assistant_text`), so the join format is the view's concern alone.

### `v0.21.9` — 2026-06-24 — Frontend: persistent typing indicator

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `bubbles.ts`: `BubbleView` gains `setThinking(on: boolean)`; `DomBubbleView` implements it (a `.luna-thinking` element kept as the last child, re-appended to stay below chips).
- `ui/cuteBubbleView.ts`: `showThinking()` now re-appends the existing dots node to the end (below any chip) instead of early-returning, so the CSS bounce keeps running uninterrupted; `setThinking` delegates to show/hide; the implicit `hideThinking()` calls were removed from `open()` and `chip()` — the controller is the sole driver.
- `controller.ts`: a `turnActive` flag + `reflectTyping()` helper (`setThinking(turnActive && !textStreaming && messageBubbles.size === 0)`) wired into every lifecycle event — `turn.started`/`proactive.started` set active; `turn.result`/`proactive.finished`/`error` clear it; the dots return after a message bubble finalizes mid-turn and stay up during non-message tool runs.
- `app.ts`: removed the open-only `view.showThinking()`/`hideThinking()` (now owned by the controller).
- Review-hardening: a `resetTurnState()` (clears `messageBubbles` + `textStreaming` + `turnActive`) runs at every turn boundary (`turn.started`/`turn.result`/`proactive.finished`/`error`) and on `history` (reconnect) — because `reflectTyping()` now gates on `messageBubbles.size`, a dropped/mismatched `tool.finished` or a mid-turn reconnect would otherwise leak an id and wedge the dots OFF for the rest of the session; `error` also discards any still-open message bubble. `cuteBubbleView.showThinking` only (re)appends + scrolls when the dots aren't already the last child, and uses the gated `scroll()` so the per-event reflect calls don't yank a scrolled-up viewport.
- Tests: +5 `controller.test.ts` cases (persist across a tool + return between messages + clear on result; text-mode streaming hides; proactive shows-then-clears; a dropped `tool.finished` doesn't wedge the next turn; a reconnect resets stale state). The mock records `setThinking` in a separate array so existing exact-equality `calls` assertions are unaffected.

Inference:

- The user couldn't tell when Luna had finished a multi-step turn (think → tool → message → tool → message), so they cut her off. A turn-scoped indicator — not an opening-only flash — is the honest "still going" signal.
- Closes a latent stuck-dots bug for proactive openers: they never emit `turn.result`, so the previous `app.ts` hide-on-`turn.result` would have left the dots spinning forever after an unprompted message; clearing on `proactive.finished` fixes it.

### `v0.21.8` — 2026-06-24 — Core memory: field boundaries + anti-churn

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `dream/prompts.ts`: `personaUpdatePrompt` fully rewritten (designed by a 5-agent judge panel). Each field gets a BELONGS / DOES-NOT-BELONG spec with Good/Bad examples mined from the actual degraded content: `self_state` = felt sense of self only (no behavior rules / tool mechanics / metering — those are the L1 contract); `relationship_status` = felt sense of the bond only (no discrete facts / project status / counts — those are L3). Demands reflective first-person prose (forbids keyword-soup), and makes **null the default** — a full rewrite of a field that was mostly right is named a failure. Keeps the `{self_state, relationship_status, reason}` JSON contract + 400-char cap + an injection guard over the embedded data sections.
- `memory/coreMemory.ts`: `updateCore` computes `next` first and **short-circuits a no-op** (both fields byte-identical to current → return prev without an audit row, an `UPDATE`, or `bumpMemoryEpoch`). Robust for every caller (the dream persona step + the `remember` tool).
- `memory/similarity.ts` (NEW, ~35 lines): `similarityRatio(a,b)` = 1 − Levenshtein/maxLen (two-row `Uint32Array` DP; empty-vs-non-empty → 0).
- `dream/cycle.ts` `persona_update`: drops a patch field whose new prose is ≥ `LUNA_PERSONA_REWRITE_SIMILARITY` (default 0.95) similar to the current value — catches the model's cosmetic ~97%-identical re-emits that the prompt's null instruction doesn't reliably prevent. Empty→non-empty (first establishment) still lands.
- Tests: `memory/similarity.test.ts` (NEW, 4 cases); `l3.test.ts` +1 (a no-op write leaves the audit count + memory epoch untouched, a real change still lands); `remember.test.ts` +1 (the `update_self` tool path also no-ops on identical values — the guard's other caller); `dream.test.ts` +1 (5b: cosmetic rewrite dropped, genuine shift kept) + the persona-prompt scriptedLlm router phrase updated to `tending your own self-portrait`.
- No wire/schema changes; one new tunable `LUNA_PERSONA_REWRITE_SIMILARITY`. `personaUpdatePrompt` is a dream-only prompt — NOT part of `buildSystemPrompt`, so the cached prompt prefix is untouched.

Inference:

- Core memory had collapsed into a role-confused "everything bucket": `self_state` was a second behavior contract, `relationship_status` was an L3 fact ledger (down to "56 green" test counts), and the whole thing was telegraphic keyword-soup — yet it is injected into the cached system block every turn as "who she is," so the pollution shaped every reply. The boundary prompt restores the division of labor (felt-sense prose here; facts→L3; rules→L1).
- The churn (full rewrite every dream, even at 97% identity) destabilized a memory meant to evolve slowly and needlessly invalidated the prompt cache each dream. The deterministic no-op + near-identity gates make "nothing meaningfully changed" the cheap, common outcome — independent of whether the model obeys the prompt's null instruction.
- Per owner's choice the existing degraded content is left to **self-heal**: the next dreams, under the new prompt, re-author proper prose and let the embedded facts migrate to L3 over a cycle or two — no hand-editing of her self-narrative.

### `v0.21.7` — 2026-06-24 — Dream diary completeness: yesterday-rewrite + shutdown dream (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `dream/cycle.ts` `run_diaries`: the per-day rewrite gate widened from today-only to **today + yesterday** — added `const yesterdayKey = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)`; the loop's `isToday` became `rewritable = day === todayKey || day === yesterdayKey`, and both the skip-if-has-diary guard (`if (!rewritable && hasDiary…) continue`) and the `upsert`-vs-`insert-once` choice key off it. Days older than yesterday remain `INSERT OR IGNORE` (write-once).
- `main.ts`: a **shutdown dream** — a `shutdown(signal)` handler bound to `SIGTERM` + `SIGINT` runs `runDreamCycle({sessionId, llm: dreamLlm, emit: broadcast})` for each `activeSessionIds()` before `closeDb(db)` + `process.exit(0)`. Best-effort (`try/catch`, never blocks exit on failure), bounded by `Promise.race([dreams, Bun.sleep(LUNA_SHUTDOWN_DREAM_TIMEOUT_MS ?? 120_000)])`; a second signal `process.exit(1)` force-exits (impatient Ctrl-C); guarded by `LUNA_SHUTDOWN_DREAM !== '0'` + `!isDreaming()`. The old module-level `SIGTERM`-only handler is removed; the no-API-key branch keeps a plain `closeDb`+exit on both signals. New imports: `isDreaming` (`dream/dreamState`), `runDreamCycle` (`dream/cycle`), `activeSessionIds` (`turn/session`).
- New env: `LUNA_SHUTDOWN_DREAM` (default ON), `LUNA_SHUTDOWN_DREAM_TIMEOUT_MS` (default `120000`).
- `dream/dream.test.ts` test 4c rewritten (v0.17.3 + v0.21.7): seeds two-days-ago + yesterday + today, dreams twice the same day, asserts today **and** yesterday refresh while the two-days-ago row stays frozen, and today is a single upserted row. 13 dream tests green.

Inference:

- Closes the diary's freeze-at-last-dream gap: a day's diary used to freeze at its last in-day dream, so anything said after that dream but before midnight never reached the diary. Now the next day's first dream re-derives yesterday from its full L2 turns — one final complete pass — before the row becomes immutable.
- Corrects the 6/22 "half diary" premise: it was **not** a truncation or append/续写 bug. The mechanism already rewrites each day's diary from the whole day (v0.17.3 upsert), and 6/22 had its full turns available. It read thin because **no dream ran on 6/22 at all** — autonomous dreams hang off the proactive heartbeat, dead since 6/16 (the v0.21.6 bug) — so its diary was a one-shot retroactive 3–6-sentence summary written the next morning. v0.21.6 restores in-day dreams; this version hardens the diary against the adjacent freeze gap.
- The shutdown dream makes "closing the terminal" behave like going to sleep: memory + diary consolidate at the natural end of a session instead of waiting for the next scheduled dream, which after a clean shutdown could be a long way off.

### `v0.21.6` — 2026-06-23 — Fix: proactive survives a restart (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- New `sessionStore.listSessionIds()` (`SELECT id FROM sessions`) + `lastUserTurnMs(sessionId)` (the most recent non-`proactive%` L2 turn's `t_ms`).
- New `session.preloadSessions()`: for each persisted session id, `getSession(id)` (warms the in-memory `sessions` map) and restore `lastUserMs` from `lastUserTurnMs`.
- `main.ts` calls `preloadSessions()` at boot, right after `bootReconcile()`.
- +3 tests (`sessionPreload.test.ts`): preload warms the active set + restores `lastUserMs`; `lastUserTurnMs` ignores proactive turns; a no-sessions no-op. +3 → **782 green**; `tsc` ×3 clean.

Inference:

- Root cause of "proactive died": the heartbeat (`scheduler.tickOnce`) only iterates `activeSessionIds()`, which returns the keys of the in-memory `sessions` map — and that map is EMPTY after a process restart until the next `getSession` (i.e., the next user message). So between a restart and the next chat, the scheduler had no session to consider and never fired — diagnosed from traces (`proactive_wake` decisions stopped 2026-06-16 while user turns kept flowing). The owner restarts often (dev), and proactive's whole purpose is to reach out when the owner is NOT chatting, so this silently killed it.
- Restoring `lastUserMs` from the last real user turn (not boot time, which `Session.lastUserMs` resets to) makes the idle-gap, the `too_soon` cooldown, and the `deep_absence` (>18h) cutoff reflect the true last interaction across restarts — so she neither over-eagerly wakes right after a restart nor mis-judges a long absence.
- The `deep_absence` cutoff (`LUNA_PROACTIVE_LONG_ABSENCE_MS`, default 18h) is unchanged — it stays an owner-tunable knob, not a default change.

### `v0.21.5` — 2026-06-23 — Weather perception follow-on: pluggable provider + QWeather (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- New `tools/web/weather/weatherProvider.ts`: a `fetchWeather` dispatcher + `weatherProviderName()` — `LUNA_WEATHER_PROVIDER` (`qweather`|`open-meteo`), auto-selecting QWeather when `LUNA_WEATHER_API_KEY` is set, else the no-key Open-Meteo. `snapshot.ts` + the `weather` tool now import `fetchWeather` from here.
- New `tools/web/weather/qweather.ts` (~150 lines): the QWeather (和风) adapter — fetches `/v7/weather/now` + `/v7/weather/3d` + `/v7/weather/24h` from the account's **custom API Host** (`LUNA_WEATHER_API_HOST`, e.g. `xxxx.qweatherapi.com` — the post-2024 per-account host; the legacy `devapi`/`api.qweather.com` return "Invalid Host"), `key=` auth, `lang=en`, `unit=m|i`. QWeather returns every numeric field as a STRING → all `Number()`'d; location is `lon,lat` (≤2 dp); `condition` from `now.text` lowercased; chance-of-rain = max hourly `pop` over 24h; `isDay` from sunrise/sunset vs local time; `assertPublicUrl` SSRF-validate + a `setQWeatherFetcher` seam.
- `openMeteo.ts` `fetchWeather` renamed `fetchOpenMeteo` (now one of two providers behind the dispatcher); `openMeteo.test.ts` updated.
- Env vars added: `LUNA_WEATHER_PROVIDER`, `LUNA_WEATHER_API_KEY`, `LUNA_WEATHER_API_HOST` (the last two live only in the gitignored `.env`, never committed).
- Tests: new `qweather.test.ts` (now+3d+24h→snapshot mapping, `lon,lat` URL build, non-200 throws); `snapshot.test.ts` + `weather.test.ts` pin `LUNA_WEATHER_PROVIDER=open-meteo` (so the `.env` `qweather` default doesn't divert their Open-Meteo seam, since `bun test` loads `.env`). +3 → **779 green**; `tsc` ×3 clean. **Live-verified** end-to-end: the dispatcher selects qweather and yields "Weather where the owner is: overcast, 26°C — high 29 / low 21, 70% chance of rain" — vs Open-Meteo's 20%.

Inference:

- Closes the accuracy complaint: Open-Meteo's global model was genuinely wrong for Chinese cities (the parsing was faithful — verified against a live fetch — but the source was off). QWeather is CMA-based and accurate for China; the only blocker was QWeather's per-account-host migration, resolved by making the host a config knob.
- The provider abstraction (mirroring `web_search`'s) keeps Open-Meteo as a zero-config, no-key fallback, so weather still degrades gracefully when no QWeather key is present.

### `v0.21.4` — 2026-06-21 — Fix: GPS-after-boot weather refresher (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `ws.ts` `case 'client.geo'` now calls `startWeatherRefresh()` (idempotent) right after `setRuntimeLocation(...)`. Previously the background snapshot refresher was only kicked at boot (`main.ts`), where it no-op'd if no location was configured — so when the location arrived post-boot via the browser GPS grant (the normal case, with no `LUNA_LAT_LON`), the refresh timer was never started, `getSnapshot()` stayed `null`, and the ambient weather block + proactive note never appeared.
- `+1` regression test (`snapshot.test.ts`): with only a runtime (GPS) location set and ambient on, `startWeatherRefresh()` warms `getSnapshot()`. +1 → 776 green; `tsc` ×3 clean.

Inference:

- This is the bug behind "why doesn't Luna know the weather": GPS auto-location (v0.21.3) set the location correctly but never warmed the snapshot, because the refresher's only start point was boot — before the GPS fix existed. Tying the (idempotent) refresher start to the location-arrival event closes the gap, so weather warms within a couple seconds of granting GPS.
- The owner's running server (started before Initiative 14 was written) predates all weather code and must be restarted regardless; this fix ensures that after a restart + GPS grant, weather actually flows even with no `LUNA_LAT_LON` env fallback.

### `v0.21.3` — 2026-06-21 — Weather perception follow-on: GPS auto-location (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- Wire contract (`packages/protocol/src/events.ts`): new `ClientGeoEvent` (`type:'client.geo'`, `lat`/`lon` range-validated at the schema boundary) added to the `ClientEvent` discriminated union — a lockstep change picked up by the server's exhaustive `handleMessage` switch (tsc-enforced via `assertNever`).
- Server (`ws.ts` + `turn/temporalContext.ts`): `handleMessage` gains a `case 'client.geo'` → `setRuntimeLocation(lat, lon)`; `temporalContext` holds an in-memory `runtimeLocation` (set from GPS, labeled with `LUNA_WEATHER_LOCATION` if present), and `resolveLocation()` returns it **ahead of** the `LUNA_LAT_LON` env fallback. `clearRuntimeLocationForTests` seam.
- Web (`packages/web/src/geo.ts` new + `app.ts`): `requestGeolocation()` wraps `navigator.geolocation.getCurrentPosition` (secure-context guard, silent no-op if denied/unavailable), caches the fix; `app.ts` requests it on boot (one-time browser permission) and sends `client.geo` on the fix, then re-sends the cached fix on every `onStatus('open')` so a server restart re-learns the location (the server holds it in-memory).
- Tests: `events.test.ts` (+2: `client.geo` parse + out-of-range reject), `weather.test.ts` (+1: runtime GPS precedence over env), new `web/src/geo.test.ts` (+1: no-op without `navigator.geolocation`). +4 → **775 green**; `tsc` ×3 clean (protocol/server/web).

Inference:

- Resolves the owner's "can't it auto-detect location?" with the most accurate option that works on THIS host: browser GPS comes from the device, not an IP lookup — so the fake-IP proxy (which would make server-side IP geolocation report the proxy exit node) is sidestepped entirely.
- Precedence GPS → env → null means weather "just works" after one browser permission grant with zero config, while `LUNA_LAT_LON` remains a headless / no-permission fallback. The GPS fix is in-memory + re-sent on reconnect (no new persistence), sufficient for a single-user localhost companion.
- Requires a secure context (HTTPS or **localhost** — both apply in dev); over plain-LAN http the browser blocks geolocation and it falls back to the env knob.

### `v0.21.2` — 2026-06-21 — Weather perception 3/3: proactive weather + close (Initiative 14 ✅)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- `turn/temporalContext.ts` gains `afterANightOpening(nowMs, lastInteractionMs, tz)` — composed purely from the existing helpers (`classifyDaypart` morning + a `localDayNumber` calendar-day crossing + `classifyGap ∈ {new_day, long_away}`) with a `LUNA_NIGHT_MIN_GAP_SEC` floor (default 6h) that excludes a trivial chat straddling local midnight. No new arithmetic.
- `turn/weatherContext.ts` gains `weatherProactiveEnabled()` + a bounded, ignorable `weatherNoteFor(snapshot)` ("It's <condition> out (<temp>°) where the owner is — … a small weather-aware kindness … never a forecast or a status report."); a null snapshot → no note.
- `proactive/proactiveTurn.ts`: `framing()` appends `proactiveWeatherNote(session)` after the felt-absence clause — it fires only when `weatherProactiveEnabled()` AND `afterANightOpening(...)` (restart-safe last-interaction via `listRecentL2`→`lastUserMs`), reading the cached snapshot (never fetches). It rides the opening framing only; the wake decision / cadence / anti-repeat are untouched (LD #15). `proactiveWeatherNote` is exported (injectable `nowMs`) so the morning gate is testable.
- **Default-flip + location-gate (initiative close)**: `weatherEnabled()` (`registry.ts`), `weatherAmbientEnabled()` and `weatherProactiveEnabled()` (`weatherContext.ts`) all become `Bun.env[flag] !== '0' && resolveLocation() != null` — weather is **default-ON but dormant until `LUNA_LAT_LON` is set** (the web_search no-key-degrade pattern), so it never mounts an always-erroring tool or injects a clause about weather it can't get. `0` is the off switch.
- Env vars added: `LUNA_WEATHER_PROACTIVE` (opt-out gate), `LUNA_NIGHT_MIN_GAP_SEC` (after-a-night floor, default 6h = 21600).
- Tests: new `proactive/proactiveWeather.test.ts` (`afterANightOpening` morning/overnight/long-away/afternoon/short-gap/min-gap-knob/null; `weatherNoteFor`; `weatherProactiveEnabled` location-gate; `proactiveWeatherNote` morning→note / afternoon→none / cold-cache→none / off→none) + the v0.21.1 `weatherAmbientEnabled` test updated for the flip. +13 tests → **771 green**; `tsc` ×3 clean (protocol/server/web).

Inference:

- Closes Initiative 14: weather is now a complete sensory channel mirroring time perception — a pull tool (v0.21.0), passive ambient awareness in the uncached tail (v0.21.1), and a bounded proactive opener (v0.21.2) — all cache-safe, off-hot-path, and net-new over Python.
- The proactive note answers the owner's actual ask ("a natural mention after a night") while inheriting the time layer's anti-over-fixation discipline: it fires only on a real morning/after-overnight wake, is a suggestion not a directive, and ships with a `LUNA_WEATHER_PROACTIVE=0` kill switch — the same `LUNA_TIME_SUBJECTIVE` lever.
- The default-flip is **location-gated**, a small refinement over the plan's bare flag-flip: weather "just works" the moment `LUNA_LAT_LON` is set, and is fully dormant (no tool, no clause, no note) until then — zero behavior change for a user who hasn't configured a location.

### `v0.21.1` — 2026-06-21 — Weather perception 2/3: passive ambient weather (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- New `packages/server/src/tools/web/weather/snapshot.ts`: a background snapshot cache — `getSnapshot()` reads the last good snapshot SYNCHRONOUSLY (null when cold or older than 4× the TTL ≈ 2h); `refreshWeather()` fetches + stores and NEVER throws (a failure keeps the last good snapshot + logs); `startWeatherRefresh()` fires an initial fire-and-forget refresh + a `.unref()`'d `setInterval` (`LUNA_WEATHER_TTL_MIN`, default 30 min), a no-op unless `LUNA_WEATHER_AMBIENT=1` and a location is configured. `setSnapshotForTests`/`resetWeatherSnapshotForTests` seams.
- New `packages/server/src/turn/weatherContext.ts`: `weatherAmbientEnabled()` (opt-in `=== '1'`) + a pure, synchronous, format-only `buildWeatherBlock(snapshot)` handing Claude a finished labeled fact (`Weather where the owner is: overcast 18°C, feels 17°C — today's high 21°C / low 14°C, 40% chance of rain today. Currently daytime.`).
- `turn/runTurn.ts` `parse_input` pushes `buildWeatherBlock(getSnapshot())` into the per-turn UNCACHED user message right after the time block (gated by `weatherAmbientEnabled()`, try/catch-omit on failure) — read synchronously, NO network call on the reactive path; a cold/stale cache omits it. `buildSystemPrompt` passes `weatherAmbientEnabled()` as the new 4th arg to `renderL1Contract`.
- `persona/l1Contract.ts` `renderL1Contract` gains a `weatherAware` param (memo key += `|${weatherAware}`) appending a data-free `WEATHER_CLAUSE` (let weather color tone; care-not-forecast) — byte-stable in the cached block.
- `main.ts` calls `startWeatherRefresh()` at boot (after `startScheduler`).
- Env vars added: `LUNA_WEATHER_AMBIENT` (opt-in gate), `LUNA_WEATHER_TTL_MIN` (refresh interval + staleness base, default 30).
- Tests: new `weatherContext.test.ts` (`buildWeatherBlock` formatting incl. night/°F/feels-omit; the **cache-invariant pin** — `buildSystemPrompt` byte-identical across differing snapshots + no snapshot data leaks; ambient injection into the user tail with a throwing fetcher proving no reactive-path fetch; flag-off + cold-cache omit) + `snapshot.test.ts` (cold→null, refresh populates, no-location no-op, failing-refresh keeps-last-good, stale→null). +12 tests → **758 green**; `tsc` ×3 clean.

Inference:

- The highest-leverage companion piece of Initiative 14: Luna now *knows* the weather and can weave it in unprompted without spending a tool call — the same passive-injection shape time perception (Initiative 12) used.
- It upholds the two load-bearing constraints from the Phase-A verification: the volatile snapshot rides the **uncached tail only** (the cached system block is byte-identical across snapshots — pinned by test), and **no blocking network call touches the reactive turn** (background-refreshed off a `.unref()`'d timer, read synchronously; a cold/stale/dead-network cache simply omits the block).
- The `WEATHER_CLAUSE` carries the care-not-forecast guardrail into the cached contract, setting up v0.21.2's proactive opening note without re-teaching the discipline.

### `v0.21.0` — 2026-06-21 — Weather perception 1/3: weather tool + location config (Initiative 14)

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- New `packages/server/src/tools/web/weather/openMeteo.ts` (~155 lines): a no-key Open-Meteo client — a `WeatherSnapshot` type, a WMO `weather_code`→condition map (`wmoToCondition`, unknown→precip wet/dry fallback), `buildUrl` (current + today's daily, timezone-explicit, metric default), a Zod-validated JSON→snapshot `mapSnapshot`, and `fetchWeather`. It reuses the SSRF deny-list via the exported `assertPublicUrl` then a plain `fetch`+`res.json()` — deliberately NOT `safeFetch`, whose `text/html|text/plain` content-type gate rejects `application/json`. `setWeatherFetcher` is a test seam (mirrors `web_fetch`'s `setWebFetcher`).
- New `packages/server/src/tools/builtin/weather.ts` (~110 lines): the `weather` `defineTool` — zero-arg input (uses the configured location like `time_now`), `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`, `timeoutMs` from `LUNA_WEATHER_TIMEOUT_MS` (default 10000); a leading progress note, an aborted-signal early-out, a "location not configured" recoverable err when `resolveLocation()` is null, and a try/catch soft-fail around the fetch — never throws past the generator.
- `packages/server/src/turn/temporalContext.ts` gains `resolveLocation(): GeoLocation | null` (+ the `GeoLocation` type), co-located with `resolveTz`: reads/validates `LUNA_LAT_LON` (`'lat,lon'`, range-checked −90..90 / −180..180), degrade-not-throw, with an optional `LUNA_WEATHER_LOCATION` display label. IP-geolocation is deliberately not used (the host's fake-IP proxy would report the exit node, not the user).
- Registered in the 3 places: `'weather'` added to the `ToolName` `z.enum` (`packages/protocol/src/tools.ts`); `weatherTools` + `weatherEnabled()` (`LUNA_WEATHER === '1'`, opt-in) + `withWeather()` in `tools/registry.ts`; `withWeather(...)` wired into the boot registry nest in `main.ts` + a `[weather]` boot-log tag.
- Env vars added: `LUNA_WEATHER` (opt-in gate), `LUNA_LAT_LON` (location), `LUNA_WEATHER_LOCATION` (display label), `LUNA_WEATHER_UNITS` (`celsius`|`fahrenheit`, default celsius), `LUNA_WEATHER_TIMEOUT_MS`.
- Tests: new `openMeteo.test.ts` (WMO mapping incl. unknown fallback, `buildUrl` param assertion, seam-injected JSON→snapshot mapping, malformed-payload throws) + `weather.test.ts` (configured→progress+ok with typed fields + summarize, unset-location→recoverable err, aborted→aborted err, `resolveLocation` valid/label/null cases). +11 tests → **746 green**; `tsc` ×3 clean (protocol/server/web).

Inference:

- This is the **data spine** of Initiative 14: a standalone client + a location resolver that v0.21.1 (ambient injection into the uncached tail) and v0.21.2 (the proactive opening note) reuse directly — kept decoupled from the tool so the future background refresher imports the client, not the tool.
- It establishes **"location is configured, not sensed"** — the right call on a host whose fake-IP proxy makes IP-geolocation report the exit node. The degrade-not-throw resolver means an unconfigured location simply omits weather rather than guessing or bricking a turn (mirroring `resolveTz`'s discipline).
- The **`assertPublicUrl`-not-`safeFetch`** choice is the load-bearing correctness catch from the Phase-A verification: `safeFetch`'s content-type gate would have thrown `unsupported_type` on every weather call; reusing only the SSRF deny-list keeps the egress posture uniform without that failure mode.

### `v0.20.9` — 2026-06-20 — Deep-audit remediation 10/10: contract, config & test-debt (Initiative 13 ✅)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `protocol/src/memory.ts`: deleted the dead `L2Turn` + `SessionRow` schemas (zero refs, drifted from the live shape).
- `protocol/src/events.ts`: `Citation.url` → `z.string().refine(http(s))` (a scheme check, deliberately not `z.string().url()` which is stricter than the renderer's WHATWG URL and would throw in `outbound`).
- `protocol/src/tools.ts`: `ToolEventStarted/Progress/Final.tool_name` `z.string()` → `ToolName` (the wire `ServerEvent` tool variants already used the enum; this tightens the internal dispatcher event).
- `.env.example`: +37 code-read flags (runtime/security, code-agent gates, memory/recall, L1/clean-history, diary/dream, self-continuation, TTS dev) with one-line descriptions.
- `.prettierignore`: += `packages/web/public/` (the 206KB minified Cubism core + Live2D model JSON).
- `web/src/ui/toolLabels.ts`: `toolCardLabel` exact-matches `ToolName.safeParse(strip(...))` instead of an unanchored `includes()`; +9 cute labels for the previously-unlabeled tools.
- `web/src/live2d/faceVm.ts`: the tick flush loop skips `GAZE_KEYS` when `gazeActive` (mirrors `applyIdle`), so emotion/action gaze no longer overrides mouse gaze-follow.
- `tools/web/safeFetch.ts`: extracted `makePinnedLookup(pinIp)` (exported) from `pinnedFetch`; reworded the overstated "real-HTTPS smoke" comment to name the actual coverage.
- Tests (+13, 722→735): `safeFetch` `makePinnedLookup` both callback shapes + IPv6 family; new `readTracking.test.ts` + `defineTool.test.ts`; `toolLabels` recall_skill/propose_self_edit/finish-summary cases.

Inference:

- Closes the contract-drift + config-drift + cosmetic findings and pays down the highest-value test debt — above all the SSRF DNS-pin, whose rebinding-defense callback shapes are now unit-pinned so a "simplifying" refactor can't silently reopen it. The `ToolEvent` tightening makes the dispatcher→ws invariant compile-time-guaranteed rather than enforced only by a runtime `ToolName.parse`.
- Three items are deliberately left for the owner (the plan flagged them as owner-decisions, so unilateral deletion of test-covered / intent-documenting code was avoided): delete the unreachable `restore(n)` (recommended) vs build a real undo surface; delete the inert `physicsPassthrough` vs reimplement the Python blink-preservation skip; and the provider `chatStream` SSE-mapping test (deferred — a faithful test needs a brittle Anthropic-SDK-stream mock; the translator is exercised indirectly by 21 MockProvider suites).
- **Initiative 13 (deep-audit remediation) is complete (10/10):** all 6 high + the confirmed mediums are closed with red→green regressions; the three audit-refuted findings stayed un-"fixed" by design; `tsc` clean ×3 and the suite green at every shipped version (667 → 735, +68 tests).

### `v0.20.8` — 2026-06-20 — Deep-audit remediation 9/10: resilience & lifecycle (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `trace/instrument.ts`: `flushTrace` wraps `store.flush(turnId)` in try/catch (logs + swallows) — all callers inherit never-throw.
- Turn abort: `provider/types.ts` `ProviderRequest.signal?`; `provider/anthropic.ts` `chatStream` passes `{ signal }` to `messages.stream`; `turn/runTurn.ts` `RunTurnOptions.signal`/`TurnState.signal` → forwarded in `open_stream`'s `chatStream` call; `turn/session.ts` `Session.activeTurnAbort: AbortController | null`; `ws.ts` `chat.send` creates the per-turn controller (`signal: ac.signal`, cleared in `.finally`), `handleClose` calls `getSession(...).activeTurnAbort?.abort('client disconnected')` only when `activeSockets.size === 0`.
- `proactive/continuation.ts`: timer `.unref()`'d; `ContinuationDeps.hasListener?` gates `fireContinuation`; `ws.ts` passes `hasListener: () => activeSockets.size > 0`.
- `proactive/scheduler.ts`: `recentProactive: listRecentProactiveTexts(sessionId, 3)` (was `[]`); new `memory/sessionStore.ts` `listRecentProactiveTexts` (`turn_id LIKE 'proactive:%' AND assistant_text != ''`, DESC).
- `web/src/wsClient.ts`: 30s keepalive `ping` (unref'd interval, OPEN-only) + a 5s stability window before zeroing `attempt`; `stopHeartbeat` clears both on close.
- `web/src/ui/bootGate.ts` `warmUpTts`: a 120s overall `setTimeout`→`finish('failed')` deadline + a 90s `AbortController` on the `/speak` fetch.
- `web/src/audio/webAudioSink.ts`: `disabled` boolean → `mutedUntil` timestamp (60s self-heal); 502/504 join 503 as non-counting retryable statuses.
- Tests (+4, 718→722): `continuation` no-listener skip; `instrument` flushTrace-never-throws (closed-DB); `runTurn` signal forwarded to the provider request; `sessionStore` listRecentProactiveTexts filtering/order.

Inference:

- Closes the resilience/lifecycle gaps: a transient trace-write could abort a whole dream consolidation or suppress a decided proactive turn; a disconnected client's turn ran to completion (≤8 tool rounds) burning upstream tokens; the continuation timer blocked shutdown and could fire a turn no one would see; the wake gate's de-dup block was dead (Luna could repeat openers); and on the client, idle sockets dropped + reflickered, a flapping server hammered reconnects, a wedged sidecar hung the boot gate, and 5 transient TTS failures muted the whole session until reload.
- The abort is scoped to **reactive** turns only and fires only when the last socket closes (a refresh opens its new socket first), so proactive agency (LD #15, intentionally unattended) is untouched. Client timer + Web-Audio behaviors lack a deterministic test harness here (no fake timers / `AudioContext` in `bun test`); they are code-review-verified with the existing suites proving no regression — a manual browser pass is the final check (with v0.20.3).

### `v0.20.7` — 2026-06-20 — Deep-audit remediation 8/10: edit & code-map correctness (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `tools/editCore.ts`: new `atomicWrite(path, data)` writes a sibling `*.luna-tmp-<pid>-<n>` then `rename`s over the target (cleaning the temp on failure); `edit.ts`/`multi_edit.ts`/`write_file.ts` call it instead of `Bun.write(resolved, …)`.
- `tools/editCore.ts` `MatchResult`: added `occurrences` (number of matching windows) alongside `count` (verbatim copies of `matched`); `findEditMatch`'s fuzzy path returns `occurrences: candidates.length`, exact path returns `occurrences === count`.
- `tools/builtin/edit.ts`, `multi_edit.ts`, `code/selfEdit.ts`: the uniqueness guard + its message use `match.occurrences > 1`; replace_all's reported count keeps `match.count`.
- `code/symbols.ts` `isExported`: the climb breaks on `class_body`/`class_declaration`/`object`, not just `program`/`statement_block`.
- Tests (+7, 711→718): new `editCore.test.ts` (fuzzy distinct-window `occurrences>1` + verbatim `count`; identical-window `count===occurrences`; atomicWrite writes + temp-cleanup + original-intact-on-failure); `selfEdit.test.ts` ambiguous-fuzzy rejected; `repoMap.test.ts` method-of-exported-class `exported:false`.

Inference:

- Closes three code-tool defects: writes were not crash-atomic (a truncate-in-place mid-write left the user's source half-written, despite `multi_edit`'s "all-or-nothing" claim — which was only the in-memory guard); the fuzzy matcher undercounted to `count:1` across different-indent regions, defeating the "not unique — add context" guard and silently editing the first region; and `isExported` mislabeled every method of an exported class, skewing the repo map's ×1.5 export ranking + output.
- The `occurrences`/`count` split is the precise reconciliation of the two related audit findings: the uniqueness guard needs the *ambiguity* count (occurrences), while replace_all needs the *actual verbatim splice* count (count) — conflating them was the original bug, and they must not be merged back.

### `v0.20.6` — 2026-06-20 — Deep-audit remediation 7/10: memory fold & summarization integrity (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `memory/sessionStore.ts` `listL2`: no `LIMIT` clause when `opts.limit` is absent (loads the whole ASC timeline); an explicit `limit` still applies. The `10000` default is gone. `loadSession`/`planFold`/dream all read uncapped.
- `memory/l1Window.ts` `maybeFold`: `if (!digest) return false` after the trim, before `commitFold` — an empty digest aborts the fold.
- `provider/anthropic.ts` `complete`: removed `thinking: { type: 'adaptive' }` (chat's `chatStream` keeps thinking; the utility `complete()` does not).
- `dream/cycle.ts` `rate_salience`: returns `['failed', 'score/turn count mismatch …']` when `patch.scores.length !== unrated.length`, before any `setImportance`.
- Tests (+3, 708→711): `sessionStore` uncapped-listL2 + explicit-limit; `l1Window` empty-digest preserves the prior summary + low-water; `dream` 2c salience mismatch writes nothing.

Inference:

- Closes three integrity gaps on the memory-truth path: past 10k turns a reload silently dropped the **newest** exchanges (the verbatim tail continuity depends on); an empty `complete()` (truncated, all-thinking, or a transient blip) overwrote the rolling summary with `''` and advanced the window, silently shrinking active context; and a dream salience response that dropped/inserted a single score permanently mis-rated every later turn (corrupting both fold anchoring and recall ranking).
- Dropping adaptive thinking from `complete()` removes the empty-text *source* for both callers; the `maybeFold` guard is the load-bearing safety net (dream's `llm.ts` already guarded empty text). `stop_reason` surfacing was considered and skipped as unneeded once the empty path is guarded.

### `v0.20.5` — 2026-06-20 — Deep-audit remediation 6/10: recall correctness (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `tools/builtin/recall.ts`: scope→sources map (`facts`→`['l3']`, `timeline`→`['l2','diary']`, `both`→all) passed to `retrieve({ k: limit, sources })`; the post-filter + over-fetch×2 removed; the `scope` enum description updated to "timeline = past conversation + diaries".
- `memory/recall/recall.ts` `retrieve`: new `opts.sources` filters `collectCandidates` before ranking (default undefined = all → byte-identical hot path); embedding keys now via `embedCacheKey` (query + candidates) and a per-call length guard treats a stale-dim vec as a non-match; the now-dead `Candidate.hash` field + its `content_hash` spread removed; `contentHash` import dropped.
- `memory/recall/embed.ts`: `cosine` returns 0 on `a.length !== b.length` (was a read-past-end NaN / wrong partial); new `embedCacheKey(text) = contentHash(`${model}\n${text}`)` keyed by `LUNA_EMBEDDING_MODEL`, deliberately distinct from `contentHash` (which also keys L2/L3 row hashes).
- Tests (+4, 704→708): diary survives `scope='timeline'`; facts survive heavy recent-l2 skew under `scope='facts'`; `cosine` dim-mismatch → 0 (not NaN); a model swap re-embeds.

Inference:

- Closes three recall defects: `scope='timeline'` silently dropped diaries (first-class candidates since v0.17.1, the most salient timeline material at `DIARY_IMPORTANCE=0.7`); the over-fetch-then-filter could return facts/timeline short or empty under source skew; and a `LUNA_EMBEDDING_MODEL` swap turned cosine into NaN, silently degrading recall to lexical-only with no error.
- Per Open Question #2, the model-namespaced key takes the lazy-re-embed path (no migration) — old content-only-keyed cache rows are simply never matched again; the cosine length guard is the safety net for any that slip through.

### `v0.20.4` — 2026-06-20 — Deep-audit remediation 5/10: temporal correctness (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `turn/temporalContext.ts` `formatGap`: the sub-24h branch carries the minute round-up (`if (m === 60) { h += 1; m = 0; }`) and, when the carry pushes `h` to 24, falls through to the days branch — so `7170 → "2h"` and `86399 → "1 day"` instead of `"1h 60m"`/`"23h 60m"`.
- `turn/temporalContext.ts` `resolveTz`: validates the zone with `new Intl.DateTimeFormat('en-US', { timeZone })` and `console.warn`s + returns `hostZone()` on failure; `LUNA_TZ` is no longer trusted unchecked.
- `turn/runTurn.ts`: the `buildTimeBlock` push is wrapped in try/catch — a temporal throw omits the time block (degrade) instead of propagating to the graph's top-level catch (`turn_failure`).
- Tests (+8, 696→704): carried `formatGap` cases + a full `[0, 86400)` no-60m enumeration; `resolveTz` valid/invalid; a `runTurn` with `LUNA_TZ='Invalid/Zone'` now reaches the provider (`requests.length === 1`, `finishReason !== 'error'`).

Inference:

- Closes two confirmed defects in the Initiative-12 time layer: `formatGap` fed the model impossible duration labels (~0.8% of any hour's window) — directly contradicting the module's own "hand Claude correct labels, never let it compute" contract — and an operator who set their own timezone with a typo bricked **every** turn with an opaque `turn_failure` before the LLM was ever called (the same root reached proactive wakes and recall rendering).
- Deviation from the plan worth noting: the plan (and the audit) believed the sub-hour branch used `Math.round` and could emit "60m"; the code actually used `Math.floor` (`90s → "1m"`, a pinned test), so it was already safe — the carry fix was applied only to the genuinely-affected sub-24h branch, and the no-60m invariant is proven by enumeration rather than the plan's contradictory `3599 → "1h"` assertion (which would have broken `formatGap(90)`).

### `v0.20.3` — 2026-06-20 — Deep-audit remediation 4/10: frontend input & interrupt (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `web/src/app.ts`: the chat-input keydown handler now sends only on `e.key === 'Enter' && !e.isComposing && e.keyCode !== 229` (IME-safe).
- `web/src/controller.ts`: `turn.started` calls `deps.audio.stop()` (barge-in on a new reactive turn); `turn.result` calls `deps.view.finalize(TEXT_BUBBLE, e.text)` when `textStreaming`, so the next text-mode turn opens a fresh bubble.
- `web/src/audio/webAudioSink.ts`: a per-session `AbortController`; `speak` captures its `signal`, skips a queued utterance if aborted, and threads the signal into `fetch`/`playToEnd`; `stop()` aborts the controller (then installs a fresh one) before `queue.clear()`; `fetch`'s catch returns early on `signal.aborted`/`AbortError` so an intentional barge-in never increments the disable latch.
- `web/src/audio/audioPlayer.ts`: `play` accepts a `signal` and, after `decodeAudioData`, returns (via `onEnd`) without starting the source if aborted.
- `web/src/audio/ttsClient.ts`: `FetchSpeechOpts.signal` forwarded to `fetch`.
- Tests (+2, 694→696): controller barge-in (`audio.stop` on `turn.started`) and fresh-bubble-per-text-turn (one `finalize`, two `open`).

Inference:

- Fixes three frontend defects a real user hits: the IME-Enter bug broke essentially every multi-character Chinese message in this 中文-first companion; barge-in was fully implemented (`stop()` + `SerialQueue.clear()`) but had **zero callers**, so a new message couldn't interrupt Luna's still-draining speech; and the documented text-mode escape hatch merged consecutive replies into one bubble.
- The latch-exclusion for `AbortError` matters because barge-in now fires `stop()` (and thus aborts in-flight synthesis) routinely — without it, a few quick interruptions would have spuriously muted TTS for the whole session (the latch self-heal itself lands in v0.20.8).
- Browser-only paths (the IME keydown, Web Audio decode-abort) are not unit-testable here (no `app.test.ts` DOM harness, no `AudioContext` in `bun test`); the pure controller logic is covered, the rest awaits a manual browser pass.

### `v0.20.2` — 2026-06-20 — Deep-audit remediation 3/10: subprocess & resource cleanup (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `tools/shellCore.ts`: new `collectProcessTree(rootPid)` reads a single `ps -A -o pid=,ppid=` snapshot, builds the ppid map, and returns the subtree post-order (children before parents); `realSpawner`'s `killTree` signals each pid. The misleading "Bun spawns in a new group" comment is gone (it does not). The SIGKILL-escalation timer is tracked and `clearTimeout`'d in `finally` (was leaked, though `.unref()`'d).
- `tools/builtin/grep.ts`: `GrepRequest` gains `abortSignal?`; `ripgrepRunner` passes `signal` to `Bun.spawn`; `jsRunner` breaks its walk loop on `abortSignal?.aborted`; `grepTool.execute` now takes `ctx` and sets `abortSignal: ctx.abortSignal`.
- `code/symbolLocator.ts` (`LocateOptions.abortSignal` → the runGrep req) + `tools/builtin/find_symbol.ts` (`ctx`); `code/repoMap.ts` (`BuildOptions.abortSignal`, checked in the parse loop) + `tools/builtin/repo_map.ts` (`ctx`).
- `code/treeSitter.ts`: per-grammar `parserCache`; `loadParserFor` returns the pooled parser instead of `new ParserCtor()` each call; `resetTreeSitterForTests` `delete()`s the pooled parsers. `parseWithLoaded` (symbols.ts) already deletes the per-parse `Tree`, which stays correct.
- Tests (+2, 692→694): `shellCore.test.ts` spawns a command that backgrounds a `sleep` grandchild, times out at 400ms, and polls that the grandchild PID is reaped; `grep.test.ts` asserts `jsRunner` returns 0 on an already-aborted signal.

Inference:

- Closes three confirmed resource leaks on the code-agent path: every timed-out/aborted subprocess-spawning tool (`shell`/`typecheck`/`run_tests`/`lint`) leaked its grandchildren because the documented process-group kill was a no-op; `grep`/`find_symbol`/`repo_map` orphaned their `rg` work on timeout; and `repo_map`/`find_symbol` leaked one tree-sitter `Parser` (a WASM-heap allocation) per parsed file, growing monotonically over a long-lived server. None are exploitable, but all degrade a long-running process — the kind of slow leak that only shows up after hours of use.
- The parser pool also removes the per-file constructor cost; parsing is sequential, so a single reused parser per grammar is safe.

### `v0.20.1` — 2026-06-20 — Deep-audit remediation 2/10: secret-blocklist hardening (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `tools/workspace.ts`: secret locations refactored to a single `SECRET_DIR_SEGMENTS` / `SECRET_FILE_SEGMENTS` source (segment arrays) feeding both `secretDirs()`/`secretFiles()` (absolute, under `$HOME`) and a new exported `isSecretTailPath(token)` — segment-exact tail match (secret-dir sequence anywhere, secret-file/secret-basename tail), so `/project/.aws-config` is not over-blocked.
- `tools/builtin/shell.ts`: `blockedPathInCommand` checks `isSecretTailPath(tok)` before the absolute resolve, catching env-var indirection (`$HOME/.aws/credentials`, `${HOME}/.ssh/id_ed25519`, `$HOME/.config/gcloud/…`, `$HOME/.docker/config.json`, `$HOME/.gnupg/…`).
- `tools/fsScan.ts`: `WalkOptions` gains `excludeSymlinks?` — when set, symlinked files AND dirs are not emitted.
- `tools/builtin/grep.ts`: the JS-fallback `jsRunner` passes `excludeSymlinks: true` to `walk` and gates every walked file through `resolveInWorkspace(ent.abs, 'read')` before reading (mirrors `read_file`).
- Tests (+11, 681→692): new `fsScan.test.ts` (symlink emit/descent, `excludeSymlinks`, exact `maxEntries` boundary); `shell.test.ts` env-indirection DENY cases + a non-over-block case; `grep.test.ts` proves the JS scan surfaces neither a secret-pattern file nor a symlink-to-secret.

Inference:

- Closes the two confirmed credential-exposure paths under the single-user / no-root-jail model (LD #10 owner decision): the directory-secret blocklist was bypassable through shell variable expansion, and grep's JS fallback (rg-absent) read symlinked-in files without re-gating. Neither is remote-exploitable, but both surface real secret bytes into model context — worth closing as defense-in-depth on the sensitive-path blocklist that is the *only* fs guardrail.
- The single segment-source removes drift risk between the absolute blocklist and the new tail check — they can never disagree about what counts as a secret location.

### `v0.20.0` — 2026-06-20 — Deep-audit remediation 1/10: shell deny-gate integrity (Initiative 13)

Status:

- working tree (branch `feat/deep-audit-remediation`)

Fact:

- `tools/shellCore.ts`: `SpawnRequest` gains optional `argv?: string[]`; `realSpawner` spawns `req.argv ?? ['/bin/zsh','-lc', req.command]` — an argv path that never reaches a shell.
- `tools/builtin/{typecheck,run_tests,lint}.ts`: build an argv (`['bun','x','tsc','--noEmit','-p',input.path]` / `['bun','test',input.path]` / `['bun','x','prettier','--check',input.path ?? '.']`) instead of a `JSON.stringify`-interpolated shell string; pass both `argv` and a display `command`. Each now also gates `input.path` through `resolveInWorkspace(input.path,'execute')` (previously only `input.cwd` was gated).
- `tools/shellDeny.ts`: new rule `find -delete / -exec rm`; the curl|sh rule broadened to interpreter alternation `sh|bash|zsh|dash|python3?|perl|ruby|node|php` with `.*` (not `[^|]*`) so an intermediate pipe still matches; `classifyShellCommand` normalizes empty-quote splices (`r""m`/`r''m` → `rm`) before matching; the "ALWAYS hard-blocks" header comment corrected to "best-effort hard block".
- `tools/workspace.ts`: `evaluatorFiles()` adds `tools/builtin/shell.ts`, `tools/shellCore.ts`, `tools/builtin/run_tests.ts` (the deny-regex caller, the spawner, and `save_skill`'s green/red oracle).
- Tests (+14, 667→681): `shellDeny.test.ts` asserts DENY for 10 audit-confirmed bypasses (`r""m -rf`, `find -delete`, `find -exec rm`, `curl | python/perl/node/ruby/python3`, `curl | tee x | sh`); `shellCore.test.ts` proves `realSpawner` argv passes `$()`/backticks as literal args while the zsh `command` path interprets them; `run_tests.test.ts` asserts the tool builds argv with the raw path as a literal element; `workspace.test.ts` pins the three new firewall files write/execute-blocked, read-allowed.

Inference:

- Closes the worst safety-gate cluster of the 2026-06-20 deep audit: a model-supplied `path` could execute arbitrary commands through the verify tools (`run_tests({path:'$(rm -rf ~/Documents)'})`) AND those tools fully bypassed the `shell` deny-regex. argv-spawning removes the injection class structurally rather than by escaping. Upholds **LD #10** (the deny-regex is the security model, so a bypassable/un-consulted regex is a direct defect) and **LD #14** (the firewall must cover the code that *enforces* the gate, not just the deny-regex data it reads).
- The bypass strings now live in the test suite — the gap that hid these for so long was that tests only asserted the canonical destructive forms, so evasions were invisible to CI.

### `v0.19.2` — 2026-06-17 — Time perception: subjective time + close (Initiative 12, 3/3)

Status:

- working tree (branch `feat/initiative-12-time-perception`)

Fact:

- `turn/temporalContext.ts`: `subjectiveTime(daypart, bucket)` → `{ daypartMood, absenceFeltness }`
  (bounded maps, stateless — recomputed per turn, never stored/escalating); `feltAbsenceFor`;
  `subjectiveTimeEnabled`. `buildTimeBlock` appends exactly one "Mood of the hour" suggestion line
  when `LUNA_TIME_SUBJECTIVE`.
- `persona/l1Contract.ts`: the `TIME_CLAUSE` gains the **warmth-not-guilt** guardrail ("acknowledge a
  gap as warmth or curiosity — never as guilt, never 'you left me'").
- `proactive/proactiveTurn.ts`: a `framing(intent, session)` wrapper adds a quiet-warmth note to the
  directive on a `notable`/`long` wake (`feltAbsenceFor`); the wake *decision* (cadence/wake-gate) is
  untouched — only the texture.
- **Default-flip**: `timeAwareEnabled` / `subjectiveTimeEnabled` → `!== '0'`, and
  `LUNA_RECALL_TIME_LABELS` → default on. A + B + C now ship ON; `=0` opts each out.
- Tests: `temporalContext.test.ts` (+8: `subjectiveTime`/`feltAbsenceFor`, the subjective line
  on/off, the warmth-not-guilt clause, two proactive felt-absence integration tests); the two
  flag-toggle tests updated to set `'0'` explicitly post-flip. **667 pass / 0 fail**; all three
  packages `tsc` clean.

Inference:

- Luna now has the full layered time perception: **A** handed facts (now/gap/daypart) + **B** grounded
  memory (relative labels + chronology) + **C** felt time (mood + absence). A return after a long gap
  lands differently from a continuation; late night reads differently from morning.
- **Cache invariant (the flip gate):** the per-turn time *facts* live in the uncached user tail, so
  the cached system block stays byte-stable across turns within a process (pinned by the placement
  test) — enabling time-awareness changes the cached prefix once per process (a new, still-cacheable
  prefix), not per turn, so the prompt-cache hit-rate is unaffected. The static guidance clause
  legitimately differs between on/off but never churns within a session. (Analytical — a live
  hit-rate measurement should confirm before relying on it in production.)
- **Initiative 12 (Time perception) complete — v0.19.0–v0.19.2**, all default-on.

### `v0.19.1` — 2026-06-17 — Time perception: memory temporal grounding (Initiative 12, 2/3)

Status:

- working tree (branch `feat/initiative-12-time-perception`)

Fact:

- `memory/recall/recall.ts`: `renderRecallBlock(hits, nowMs?)` — under `LUNA_RECALL_TIME_LABELS`,
  each recalled candidate (l2/l3/diary) is tagged with `relativeLabel(t_ms, now)` (reused from
  v0.19.0's `temporalContext.ts`) and the selected set is presented **oldest→newest**. Recall
  *selection* / GA scoring is untouched — this is presentation only. Flag off → byte-identical output.
- The cached diary digest (`renderDiaryDigest`) deliberately keeps its stable absolute `period_key`
  labels: a `now`-dependent relative label in the cached system block would churn the prompt cache
  daily, violating the v0.19.0 cache invariant. (The recall block is the uncached message, so its
  per-turn labels are cache-safe.)
- `.env.example`: `LUNA_RECALL_TIME_LABELS`, `LUNA_RECALL_ABS_DATE_DAYS`.
- Tests: recall (+1: labeled + chronological under the flag; flag-off unchanged). **659 pass / 0
  fail**; all packages `tsc` clean.

Inference:

- A handled "now + how long since the last message"; B handles "when did *that* happen" — the recall
  block used to hand her past turns/facts/diaries with no timestamp, the real root of dating a past
  event wrong. Now she reads "[this morning] you fetched the lyrics" instead of guessing, and the
  stable chronological order is itself a mitigation (Test of Time: shuffled-time facts measurably
  degrade temporal reasoning).
- Selecting by GA score but displaying chronologically keeps the most-relevant items while giving the
  model a coherent timeline.

### `v0.19.0` — 2026-06-17 — Time perception: passive injection (Initiative 12, 1/3)

Status:

- working tree (branch `feat/initiative-12-time-perception`)

Fact:

- `turn/temporalContext.ts` (new, pure/TS): `classifyDaypart`, `formatGap` (just now / 1m / 1h 12m /
  2 days), `classifyGap(gap, crossesCalendarDay)` (continuation / same_day / new_day / long_away /
  first — the calendar-day flag decides "this morning vs yesterday"), `relativeLabel` (for v0.19.1),
  `buildTimeBlock`, `resolveTz` (`LUNA_TZ` → `Intl` host zone → UTC), `timeAwareEnabled`. Timezone is
  explicit in every label (the one real correctness risk).
- `turn/runTurn.ts parse_input`: under `LUNA_TIME_AWARE`, pushes the time block into the per-turn
  `role:'user'` blocks (the **uncached tail**) — never `buildSystemPrompt`. `lastInteractionMs` from
  `listRecentL2(id,1)[0].t_ms` (survives a restart), falling back to `session.lastUserMs`.
- `turn/session.ts`: `Session.sessionStartMs` (boot/first-touch, not persisted — a restart is a new
  session).
- `persona/l1Contract.ts`: a `TIME_CLAUSE` ("trust the handed labels; never compute how-long-ago
  yourself") added when `timeAware`; threaded through `renderL1Contract` (cache key extended). It
  rides the cached core (static, stable per process) — only the per-turn time *facts* go in the
  uncached tail.
- `.env.example`: `LUNA_TIME_AWARE`, `LUNA_TZ`, `LUNA_TIME_GAP_{CONTINUATION,LONG_AWAY}_S`.
- Tests: `temporalContext.test.ts` (+23: helpers, buildTimeBlock golden, L1 clause, and the
  **cache-safety placement** — per-turn time facts are in the user message, the cached system block is
  byte-stable across turns and carries no per-turn time). **658 pass / 0 fail**; all packages `tsc`
  clean.

Inference:

- The direct fix for "called an hour-ago event 'yesterday'": she never does the subtraction (TS
  hands her labeled facts), so she can't get it wrong. Cache-safe by construction — the per-turn
  facts live in the uncached tail; enabling the flag changes the cached prefix once per process
  (a stable, still-cacheable prefix), and the static guidance clause is constant.
- The `relativeLabel`/`formatGap` helpers are the shared "when" truth v0.19.1 (recall labels) and
  v0.19.2 (felt time) reuse — one source of humanization.

### `v0.18.4` — 2026-06-17 — Fix: top-level text leak stored as the visible reply

Status:

- working tree (on `main`)

Fact:

- `packages/server/src/turn/runTurn.ts` — the persistence `finally` stored `state.text` as
  `assistant_text`. In message mode `state.text` holds a stray top-level text block (the model narrating
  OUTSIDE the message tool) until `finalize` overwrites it with the message-tool text — but on a turn that
  errored / short-circuited before `finalize`, the leak was persisted (and replayed on reconnect) as the
  visible reply: observed as "answer for user question" in place of the real message. Now `assistant_text`
  is the already-computed `realReply` (message-tool text in message mode / streamed text in text mode), so
  the canonical reply is always stored.
- `packages/server/src/turn/runTurnResilience.test.ts` — regression: a message-mode turn that leaks
  top-level text, delivers a real message, then errors persists the MESSAGE reply, not the leak.
- Data repair: one historic L2 row (`assistant_text` = "answer for user question") corrected from its
  `raw_json` message-tool text. A precise detector (stored text **is** a top-level text block) left the 20
  humanity-transform rows — where `assistant_text` is the displayed/transformed text vs the raw model
  `input.text` — untouched; DB backed up first.
- 635 tests green; `tsc` clean.

Inference:

- The model occasionally narrates at the top level in message mode (a known, tolerated leak signal). The
  defect was that this leak could become the *stored* reply on an errored turn; the message tool is the
  only real reply channel, so it is now the only thing persisted as `assistant_text`.

### `v0.18.3` — 2026-06-16 — Web tools: web_fetch DNS pin (Initiative 11 follow-up)

Status:

- working tree (on `main`)

Fact:

- `packages/server/src/tools/web/safeFetch.ts` — **the pin.** `assertPublicUrl` now returns the validated
  IPs; `safeFetch` connects through a new `pinnedFetch` (node:http/https `request` with a custom `lookup`
  that returns ONLY a deny-list-validated IP), so the socket cannot be re-resolved to a private address
  between the check and the connect. TLS SNI + cert validation still key off the URL hostname (connect to
  the validated IP, verify the cert against the name). The old re-resolve-before-connect "re-check"
  (window-narrowing, not a pin) is removed.
- `safeFetch.ts` — `198.18.0.0/15` (RFC 2544 benchmarking) **removed from the deny-list**: it is not
  internal infrastructure (no SSRF target) and is the default fake-IP pool for Clash/Surge proxies — every
  public domain resolves into it on a proxied host (e.g. example.com/google.com/github.com/
  api.tavily.com all → 198.18.0.x), so blocking it broke `web_fetch` entirely. Internal access stays closed
  by the IP-literal + RFC1918/loopback/link-local/metadata/ULA/CGNAT checks.
- `packages/server/src/tools/registry.ts` — `webFetchEnabled` flipped back to default **ON**
  (`LUNA_WEB_FETCH !== '0'`); the pin makes the surface safe.
- `packages/web` — citation `source` chips are now **clickable**: `safeHttpHref` (http/https only, else
  plain text — an XSS guard, since citation urls are untrusted) + an `<a target=_blank rel=noopener>` in
  both `DomBubbleView` and `CuteBubbleView`; the controller passes the url as a scheme-validated href, not
  baked into the label.
- Tests: the rebinding test now asserts the transport is **pinned to the validated IP**; a 198.18 allow
  assertion; a `safeHttpHref` XSS test; controller href assertions. **634 pass / 0 fail, `tsc` clean ×3.**
  Verified live: real `https://example.com` fetched through the pin (200, cert OK via the proxy) while
  `127.0.0.1` / `169.254.169.254` / `10.0.0.1` are blocked.

Inference:

- The DNS-rebinding TOCTOU — the one v0.18.2 review finding that could not be fully closed in Bun's `fetch`
  — is now genuinely closed: the connection uses the exact IP the guard validated. With that verified,
  `web_fetch` is safe to default-on, completing the "complete agent-side networking" goal.
- The fake-IP-proxy case matters generally: without unblocking the benchmark
  range, `web_fetch` would have been dead-on-arrival on any host behind a fake-IP proxy.
- **Deferred (a small cosmetic follow-up):** persisting citations across a reload (an L2 `citations_json`
  column + ws replay). The model still cites correctly across turns via `raw_json`; only the visible chips
  vanish on a browser refresh.


### Initiative 11 — review remediation (PR #6, 2026-06-16)

Status:

- working tree (branch `feat/initiative-11-web-search`) — applied during owner-side review before merge.

Fact (an adversarial 7-dimension review — SSRF · injection · defection · contract · wire · infra ·
acceptance, each finding refuted by a verifier pass — confirmed 12 findings plus 1 the reviewer found
by hand; the security-bearing ones are remediated here):

- **Injection — search snippets were never wrapped** (high): `web_search` returned `snippet` raw while
  only `web_fetch` bodies were enveloped, so the standing `WEB_UNTRUSTED_RULE` named a delimiter that,
  for snippets, was never present. `web_search.ts` now wraps each snippet via `wrapUntrusted(snippet, url)`.
- **Injection — envelope escape** (high; reviewer-found, missed by the workflow): a fetched page (or
  snippet) containing a literal `</untrusted_content>` closed the envelope early and smuggled the trailing
  text out as "trusted" — and the `stripTags` fallback even decoded `&lt;/&gt;` back to real brackets.
  `wrapUntrusted` now **defuses** every `<…untrusted_content…>` tag sequence to fullwidth brackets and
  strips `<>"` from the `source` URL.
- **SSRF — DNS-rebinding is not a true pin** (high): `safeFetch` validated via two `lookup`s but handed
  the *hostname* to `fetch`, which re-resolves independently at connect — a TOCTOU the re-check only
  narrows. Bun's `fetch` exposes no IP-pin hook, so a verified pinned-lookup fetch is deferred to
  **v0.18.3**; until then `web_fetch` is reverted to **opt-in (default OFF)** and the comments are made
  honest (window-narrowing, not a pin).
- **SSRF — NAT64/6to4 embedded-v4** (low): `isBlockedIpv6` now decodes `64:ff9b::/96` + `2002::/16`
  transition forms and validates the embedded v4 (defense-in-depth).
- **Defection false-positive** (medium): the `web_search_intent_no_call` audit fired on honest turns that
  discharged a lookup via `recall`/`read_file` (which the L1 clause blesses) and on the generic verb
  `查一下`. Added an acted-via-any-tool guard (mirrors `detectDefection`) + tightened `WEB_INTENT_PATTERNS`
  to genuinely web-shaped phrasing.
- **Cleanups**: `timeoutMs` read once as a const (it was a wrapper falsely implying per-call liveness); a
  cache TTL-expiry regression test; honest default-state comments (`tools.ts`, tool headers).
- Tests: +7 regressions (snippet-wrap, envelope-defuse, source-strip, defection discharge + generic-verb,
  NAT64/6to4, cache TTL). **632 pass / 0 fail, `tsc` clean ×3.**

Inference:

- The two injection highs together had made the standing prompt-injection rule **bypassable** for a
  crafted page/snippet — the headline v0.18.2 defense. Both are now closed structurally (defused
  delimiter, both surfaces enveloped), so the rule has a real, un-escapable anchor.
- The rebinding gap is the one finding that cannot be *fully* closed in Bun's `fetch`; the honest call is
  **web_fetch opt-in until a verified DNS pin lands (v0.18.3)** rather than ship an over-claimed control
  on-by-default. `web_search` (no SSRF surface) stays default-on. **Deferred to v0.18.3:** the
  pinned-lookup fetch + the live latency/token sweep + clickable/reload-persistent citation chips.

### `v0.18.2` — 2026-06-16 — Web tools: complete networking (Initiative 11, 3/3 — complete)

Status:

- working tree (branch `feat/initiative-11-web-search`)

Fact:

- **Search→fetch→reason loop** validated end-to-end (`tools/web/integration.test.ts`): a scripted turn
  calls `web_search` (stub provider → 2 urls) then `web_fetch` (stub fetcher → a fixture page) then
  speaks, within the existing ≤8 tool-iteration cap; both tool results land in history.
- **Standing prompt-injection defense**: `buildSystemPrompt` now appends a `WEB_UNTRUSTED_RULE` block to
  the cached system core when **either** web tool is mounted (`isWebSearchMode || isWebFetchMode`) —
  names the `<untrusted_content>` envelope and fixes its meaning (data to read, never orders to obey;
  spotlighting). `renderL1Contract(webSearch, webFetch)` (cached per composite key) gains a `web_fetch`
  loop/boundary clause (search to find, fetch to read; surface before a hard-to-undo action).
- **Read/write boundary audit**: `runTurn` computes `webContentThisTurn` (a `web_search`/`web_fetch`
  call) + `surfaceActionThisTurn` (a tool whose `proactiveRiskOf` is `'surface'`) and passes both to the
  defection audit, which writes a `surface:'web_to_action'` `decision` trace when both hold — detection
  only, no hard gate (LD #14 discipline).
- **Citations** (wire-contract change, lockstep): `packages/protocol/events.ts` adds `Citation
  {url,title}` and an optional `citations` on `TurnResultEvent`. `runTurn` collects them from
  `web_search` result urls + `web_fetch` `final_url` (deduped) and emits them on `turn.result`; they
  persist via the normal L2 `raw_json` tool-result flow. `packages/web`: `ChipKind += 'source'`, the
  controller renders a `source` chip per citation under the bubble.
- **Optional fetch cache** (`tools/web/webCache.ts` + migration `0012_web_cache.sql`): `cachedSafeFetch`
  consults a SQLite `web_cache` (15-min TTL) before network, wrapped **around** `safeFetch` so a miss
  still runs the full SSRF guard and only already-validated fetches are stored (a hit never bypasses
  validation; a new url is always a miss → validated). Gated by `LUNA_WEB_CACHE` (default off);
  `web_fetch`'s default fetcher selects it when on.
- **Default-flip** (web_fetch part reverted in review — see the remediation record above): `webSearchEnabled`
  is `LUNA_WEB_SEARCH !== '0' && has API key` (default ON, with **graceful no-key degrade** — no key ⇒ the
  tool is simply not mounted, no crash). `webFetchEnabled` shipped as `LUNA_WEB_FETCH !== '0'` (default ON)
  but was reverted to `=== '1'` (**opt-in**) during review because safeFetch's rebinding defense narrows
  but does not close the TOCTOU; default-on awaits the v0.18.3 pinned-lookup fetch. `main.ts` composes
  `withWebFetch(withWebSearch(…))`. `.env.example` updated.
- Tests (+10; **625 pass / 0 fail**, `tsc` clean ×3): the loop + dedup citations + the injection-rule
  presence (`integration.test.ts`), the cache hit/miss/blocked-still-rejected (`webCache.test.ts`,
  exercises migration `0012`), the `web_to_action` matrix (`defectionAudit.test.ts`), the source-card
  render (`controller.test.ts`), and the no-key degrade (`web_search.test.ts`).

Inference:

- Closes Initiative 11: Luna now has **complete, safe agent-side networking** — find (`web_search`) +
  read (`web_fetch`), on by default, driving the search→fetch→reason loop herself. The first time
  untrusted web content reaches a real turn is bounded by four layers landing together: the SSRF guard
  (v0.18.1), the standing injection rule, the read/write boundary audit, and the graceful no-key degrade
  — with `=0` on either flag the instant escape.
- **Measurement note (cost gate):** a live latency/token sweep needs a real `LUNA_WEB_SEARCH_API_KEY`,
  not present in this environment, so the flip rests on the analytical bound the plan set: `web_search`
  adds ~1–3 s of blocking only when she chooses it (off the first-token path), and `web_fetch` adds at
  most `LUNA_WEB_FETCH_MAX_CHARS` (12k chars ≈ ~3–4k tokens) to context per fetched turn, capped before
  parsing. The conservative "most turns need no web" L1 stance + the optional cache bound steady-state
  cost. A live sweep should be recorded when a key is available; `LUNA_WEB_SEARCH=0`/`LUNA_WEB_FETCH=0`
  remain the instant rollback.

### `v0.18.1` — 2026-06-16 — Web tools: web_fetch + SSRF/extraction safety core (Initiative 11, 2/3)

Status:

- working tree (branch `feat/initiative-11-web-search`)

Fact:

- New `packages/server/src/tools/web/safeFetch.ts` (~230 lines) — the **SSRF guard**, the security
  keystone. `assertPublicUrl(rawUrl, resolve?)`: rejects non-`http(s)` schemes, embedded
  `user:pass@` credentials, and `>2048`-char URLs; for an IP-literal host (the WHATWG URL parser
  already collapses decimal/hex/octal IPv4) validates directly, else DNS-resolves and validates
  **every** A/AAAA record. `isBlockedIp` (pure, table-driven): IPv4 loopback/`0.0.0.0`/RFC1918/CGNAT/
  link-local (incl. cloud-metadata `169.254.169.254`)/TEST-NET/benchmark/multicast/reserved/broadcast,
  IPv6 `::1`/`::`/`fe80::/10`/`fc00::/7`/`ff00::/8`/IPv4-mapped — fail-closed on an unparseable
  address. `safeFetch(url, {maxBytes,signal,resolve?,fetchImpl?})`: `redirect:'manual'` (re-validates
  each `Location`, ≤5 hops), a DNS-**rebinding** re-resolve+re-check immediately before connect,
  byte cap (streamed, aborts over) + `text/html`/`text/plain` content-type gate; injectable
  `resolve`/`fetchImpl` seams so tests never touch network/DNS.
- New `extract.ts` (~95 lines) — `extractMarkdown(html, maxChars?)`: linkedom DOM →
  `@mozilla/readability` (article isolation) → turndown (markdown), whitespace-collapsed, char-capped
  with a `…[truncated]` marker, with a tag-strip **never-throw fallback**. `wrapUntrusted(md, url)` →
  the `<untrusted_content source="…">…</untrusted_content>` envelope.
- New `web_fetch.ts` (~110 lines) — the tool. `input {url, max_chars?}`, `output {url, final_url,
  title, content, truncated, fetched_ms}` (content is the wrapped markdown), `safe-parallel`,
  `proactiveRisk:'safe'`, soft-fails every error (SSRF block, HTTP error, oversize, unsupported type,
  abort) as a recoverable `err`. A `setWebFetcher` test seam mirrors `setWebSearchProvider`.
- New `'web_fetch'` `ToolName`; registry `webFetchEnabled`/`withWebFetch`/`isWebFetchMode` +
  `isWebMode` (either web tool, the v0.18.2 gate); `main.ts` boot wiring + `[web-fetch]` log marker;
  `toolLabels` chip; `.env.example` block (`LUNA_WEB_FETCH`, `_TIMEOUT_MS`, `_MAX_BYTES`, `_MAX_CHARS`).
- `safeFetch.ts` added to the **evaluator-firewall set** (`workspace.ts evaluatorFiles()`) — a future
  `propose_self_edit` can never rewrite the SSRF guard (DGM safeguard), test-asserted.
- New deps: `@mozilla/readability`, `linkedom`, `turndown` (+ `@types/turndown`) in
  `packages/server/package.json` — pure-Node, no native build.
- Tests (+37; **614 pass / 0 fail**, `tsc` clean ×3): `safeFetch.test.ts` (the SSRF deny-list table
  across every class incl. encoded/IPv6/credential/over-long, redirect-to-metadata re-validation,
  DNS-rebinding, byte/content-type/HTTP/redirect-loop caps); `extract.test.ts` (article isolation
  drops nav/footer/script, truncation, never-throw fallback, the envelope); `web_fetch.test.ts`
  (extraction + envelope happy path, soft-fail matrix, gating, the firewall assertion).

Inference:

- Adds the **read** half of agent-side networking Python never had, the riskiest surface of the
  initiative — isolated into its own version the way Initiative 8 isolated `shell`. The SSRF guard
  lives *inside the tool* (LD #10), the URL analogue of `resolveInWorkspace`: a miss would expose the
  user's LAN + cloud metadata, so it is table-driven, redirect- and rebinding-aware, exhaustively
  tested, and firewall-protected from self-edit.
- Ships **off**: the structural `<untrusted_content>` delimiter is intrinsic here, but the *behavioral*
  system rule that tells the model what it means — plus citation surfacing, the optional cache, and the
  default-flip — land in v0.18.2, so no unguarded web content reaches a real turn until then.

### `v0.18.0` — 2026-06-16 — Web tools: web_search (Initiative 11, 1/3)

Status:

- working tree (branch `feat/initiative-11-web-search`)

Fact:

- New module `packages/server/src/tools/web/` (3 files): `provider.ts` (~55 lines) — the
  `WebSearchProvider` interface (`search(query, opts, signal) → Promise<SearchResult[]>`) +
  `SearchResult`/`SearchOptions` types + `getProvider(name)` dispatch (`'tavily'` default, throws on
  unknown) + a `setWebSearchProvider`/`resolveProvider` test seam (mirrors `setMemoryDb`);
  `tavily.ts` (~60 lines) — the default provider, a minimal `fetch` client mirroring `embed.ts` (env
  base/key, `signal` threaded, error bodies sliced to ~200 chars), per-result snippet clipped to
  `LUNA_WEB_SEARCH_RESULT_CHARS`; `web_search.ts` (~140 lines) — the `defineTool`.
- `web_search` tool: `input {query, max_results(default 5), time_range?, include_domains?,
  exclude_domains?}`, `output {query, results[{title,url,snippet,score?,age_hint?}], provider, ts}`,
  `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`, `timeoutMs` from `LUNA_WEB_SEARCH_TIMEOUT_MS`
  (15000). `summarize` → the `N results for "q": [1] url; [2] url` citation line. `execute` yields a
  `正在查一下…` progress event first, then **soft-fails every error path** (no key, unknown provider,
  provider throw, pre-aborted signal) as a recoverable `err` — nothing throws past the generator.
- New `'web_search'` member on `ToolName` (`packages/protocol/src/tools.ts`) — the one wire-contract
  change; `Partial<Record>` registries + `toolLabels`' `Partial<Record>` + `ToolName.options` loop
  absorb it without churn.
- Registry + boot: `registry.ts` gains `webSearchEnabled()` (`LUNA_WEB_SEARCH==='1'`, default **OFF** —
  opposite polarity to the code tools), `withWebSearch()` composer, and `isWebSearchMode()`; `main.ts`
  wraps the registry (`withWebSearch(withSelfEdit(…))`) and adds a `[web-search]` boot-log marker.
- Defection guard (extends LD #14, not a new harness): `l1Contract.ts` — `renderL1Contract` now takes
  a `webSearchMounted` flag (cached per-variant, still byte-stable) and appends a combined
  when-to-reach + commitment-to-act web clause when web_search is mounted; `runTurn.ts`'s
  `buildSystemPrompt` threads the flag from the registry. `defectionAudit.ts` — `WEB_INTENT_PATTERNS`
  + `detectWebSearchIntentNoCall` (CN+EN lookup keywords) + `AuditState.webSearchMounted`; when
  web_search is mounted, no `web_search` call fired, and thinking shows lookup intent, it writes a
  `surface:'web_search_intent_no_call'` decision trace (audit-only, **no** forced retry — per Python's
  v0.58.0.1 lesson).
- Frontend: `packages/web/src/ui/toolLabels.ts` gains a `web_search: 'searched the web 🔍'` chip label.
- Env (`.env.example`): `LUNA_WEB_SEARCH` (off), `LUNA_WEB_SEARCH_API_KEY`, `LUNA_WEB_SEARCH_PROVIDER`
  (tavily), `LUNA_WEB_SEARCH_TIMEOUT_MS` (15000), `LUNA_WEB_SEARCH_RESULT_CHARS` (800).
- Tests: new `web_search.test.ts` (shape + summarize citations, the four soft-fail paths, pre-aborted
  signal, `proactiveRisk:'safe'`, registry gating); `l1Contract.test.ts` +1 (web clause gated +
  per-variant byte-stable); `defectionAudit.test.ts` +7 (`detectWebSearchIntentNoCall` pure cases +
  the mounted/called/unmounted/no-intent audit matrix). +18 tests; **577 pass / 0 fail**; `tsc` clean
  on protocol + server + web.

Inference:

- Closes the one capability gap a 2026 companion still had after brain/memory/dream/proactive/body/
  code-agent: **the open web**. v0.18.0 ships the find half (`web_search`); v0.18.1 adds the read half
  (`web_fetch` + SSRF/extraction safety) and v0.18.2 flips both on after cost is measured.
- Ports Python v0.58's `web_search` onto the TS dispatcher — an ordinary `defineTool` (LD #9), so it
  inherits timeout/abort/tracing/concurrency for free — and carries forward Python's hard-won
  defection lesson (a directive alone is insufficient): the commitment clause **and** the intent-no-
  call audit ship together, the audit producing the data to decide if a forced retry is ever needed.
- `proactiveRisk:'safe'` keeps the search→fetch→reason loop working in silent proactive turns (LD #15
  lists searches as silent-OK); default-off + the conservative L1 clause bound the cost/abuse surface
  until v0.18.2.

### `v0.17.3` — 2026-06-16 — Dream: today's day-diary is updateable (owner's option 2)

Status:

- working tree

Fact:

- `packages/server/src/dream/cycle.ts` `run_diaries` — the day-diary loop now **upserts the current
  UTC day on every cycle** (`INSERT … ON CONFLICT(kind, period_key) DO UPDATE SET text, generated_ms`),
  regenerated from all of that day's L2 pieces; past days keep the `INSERT OR IGNORE` write-once path.
  `todayKey = new Date(Date.now()).toISOString().slice(0,10)` — the same UTC calendar key the rows are
  grouped under.
- `packages/server/src/dream/dream.test.ts` — added test 4c: after a first dream writes yesterday +
  today, a second same-day dream (post-`wake`) rewrites today's diary (text changes) while yesterday's
  stays byte-identical, and today still has exactly one row. 560 → 561 tests; `tsc` clean.

Inference:

- Closes the mid-day-freeze the owner flagged. Dreams can be self-triggered (`enter_dream`) or
  scheduler-triggered at any hour — not only at end of day — so the old `INSERT OR IGNORE` froze the
  day diary at the first dream and dropped every later exchange that day. The day diary is now a live,
  whole-day summary that the standing digest (`renderDiaryDigest`, injected via `LUNA_DIARY_INJECT`) and
  `'diary'` recall candidates read — the injected "today" entry stays current to the latest dream
  (the system block is rebuilt per turn, so a refreshed diary is picked up on the next turn). Cost:
  today's diary is re-generated each dream (one LLM call), which the owner accepted; past days untouched.
- The day boundary stays **UTC** (`toISOString`). A local-boundary switch
  (aligning with the C3 proactive-quota localization) is a separate, still-open decision.

### `v0.17.2` — 2026-06-16 — Fix: failed/empty turns no longer poison memory

Status:

- working tree

Fact:

- `packages/server/src/turn/runTurn.ts` — the `finally` persistence block now computes the turn's
  actually-delivered reply (`isMessageMode(state.registry) ? state.messageTexts.join('\n').trim() :
  state.text.trim()`) and only `appendL2`s when it is non-empty. When it is empty, the in-memory
  history is rolled back to `historyStart` (the length captured before the turn ran), erasing the
  dangling user message. `persistSession` still runs in both branches (turn-seq bookkeeping).
- `packages/server/src/turn/runTurnResilience.test.ts` — added a regression test: a provider that
  throws before any reply (`thinking_delta '__THROW__'`) leaves `listL2` empty, rolls
  `session.history` back to its pre-turn length, and still emits `turn_failure`. Retargeted the
  existing Bug-A test to `DROP TABLE sessions` (was `l2_turns`) so the upstream `retrieve()` still
  succeeds, the turn delivers `'hi'`, `appendL2` succeeds, and `persistSession` is what throws in the
  finally — preserving the "a persistence throw is caught, surfaced, and never skips trace flush"
  intent under the new guard.
- Test count: 559 → 560 (1 added); `tsc --noEmit` clean.

Inference:

- Root cause of the "brief memory loss" seen in C-side testing. During a 401 auth outage (a mis-set gateway
  base URL) two turns failed with empty assistant text, and the pre-fix `finally` persisted them as
  empty-assistant L2 rows. Post-A3 (`v0.16.2`), `loadSession` rebuilds the durable timeline from L2
  `raw_json`, so those empty rows survived every restart and sat in both the recall corpus and the
  rebuilt window as "you said X, I said nothing" — which reads as memory loss. The memory-depth
  pipeline (deep window / diary injection) was working correctly; the defect was upstream, in *what
  got written*.
- A failed turn now leaves the session byte-identical to before it ran, so a retry of the same
  message starts from a clean context — no doubled user message, no empty assistant turn. That is
  exactly what recovered the conversation when the re-sent message produced a
  correct, memory-intact reply once auth was fixed.

### `v0.17.1` — 2026-06-16 — Memory depth: diary injection (Initiative 10, 2/2)

Status:

- working tree (branch `feat/initiative-10-memory-depth`, stacked on Initiative 9)

Fact:

- `memory/diaries.ts` (new): `renderDiaryDigest()` — a bounded standing digest of the latest
  day/week/month diary for the cached system block, behind `LUNA_DIARY_INJECT` (default off);
  `listRecentDiaries(limit)`; `diaryInjectEnabled()`. First context-side reader of the `diaries`
  table (previously only `dream/cycle.ts` read it).
- `turn/runTurn.ts buildSystemPrompt`: appends the diary digest after core memory — stable between
  dream writes, so it stays inside the one cached block.
- `memory/recall/recall.ts`: `collectCandidates` adds `'diary'` as a third candidate source
  (`Candidate.source` / `Hit.source` += `'diary'`), so `rag_refresh`'s diary embeddings (keyed by
  `contentHash(text)`) become retrievable — fixes the dead-work finding. Recall ranking upgraded to
  the **Generative-Agents** formula: `score = (W_RECENCY·recency + W_IMPORTANCE·importance +
  W_RELEVANCE·relevance) / ΣW` (weights env-tunable, default equal). L2 importance comes from the
  v0.17.0 salience score (normalized 0–1); L3 default 0.4; diaries 0.7.
- `tools/builtin/recall.ts`: hit `source` enum += `'diary'`.
- `dream/cycle.ts run_diaries`: a `'month'` branch rolls a month's ≥28 day-diaries into a monthly
  retrospective (idempotent via `INSERT OR IGNORE` + the `hasDiary` check).
- Decision: `REWRITE_CONTEXT.md` LD #12 diary-part amended (diary = injected long-range layer).
  `MEMORY_DESIGN_DIVERGENCE.md` (the owner's correction, PR #3) is substantively closed; its
  file-level ✅ lands when PR #3 merges.
- Tests: `diaries.test.ts` (new, +6: digest latest/empty/off/bounded, listRecentDiaries); recall
  (+2: diary candidate retrievable, GA importance ranking); dream (+1: monthly diary, idempotent).
  **559 pass / 0 fail**; all three packages `tsc` clean.

Inference:

- Closes the owner's "remembers too little" correction: the long-range narrative layer (day/week/month diaries)
  now actually reaches the model — as an always-present digest and as retrievable recall — so Luna
  has "what happened over the past days / weeks" continuity, not just the recent window + discrete facts. The
  embeddings `rag_refresh` was already computing for diaries are no longer dead.
- The GA ranking gives the companion the canonical recency × importance × relevance behaviour
  (Park et al.), reusing the one salience score built in v0.17.0; weights are env-tunable so the
  owner can dial back recency/importance if recall surfaces too much recent-but-off-topic material.
- **Initiative 10 (Memory depth correction) complete — v0.17.0–v0.17.1.** The L1 window is ~100
  clean turns, older history compresses to a bounded structured digest with importance anchors, and
  diaries are an injected long-range layer. LD #12 is amended on both axes.

### `v0.17.0` — 2026-06-16 — Memory depth: L1 window → ~100 turns (Initiative 10, 1/2)

Status:

- working tree (branch `feat/initiative-10-memory-depth`, stacked on Initiative 9)

Fact:

- `memory/l1Window.ts`: the verbatim window is now measured in **turns** (`LUNA_L1_RECENT_TURNS`,
  default 100, range 40–150; read per-call so the knob is live), not the old `KEEP_MSGS` 24-message
  cap. `planFold` keeps the last N L2 turns verbatim and folds older ones in turn-groups.
- The unbounded append-only `rolling_summary` is replaced by a **structured, size-bounded digest**:
  the compressor re-derives the whole digest from (prior digest + new turns) under 4 buckets
  (Key facts · Decisions · Open threads · Emotional beats), hard-capped at
  `LUNA_L1_SUMMARY_MAX_CHARS` (default 3000). `commitFold` REPLACES (not appends) the digest. This is
  bounded oscillating compression — superseding v0.4.1's compress-once invariant.
- **Importance anchors**: migration `0011` adds `l2_turns.importance` (1–5, nullable). A new dream
  step `rate_salience` (first in the cycle) rates unrated recent turns via the LLM
  (`saliencePrompt` + `SaliencePatch`), stored by `setImportance`. `planFold` marks turns at/above
  `LUNA_L1_ANCHOR_IMPORTANCE` (default 4) `[salient]` so the compressor preserves their specifics
  near-verbatim (resisting over-summarization).
- `sessionStore`: `+listUnratedL2`, `+setImportance`, `L2Row.importance`.
- Decision: `REWRITE_CONTEXT.md` LD #12 window-part amended (L1 = ~100 turns, structured bounded
  compression + importance anchors); `docs/roadmap/.../v0.4.1-l1-rolling-window.md` marked superseded.
- Tests: `l1Window.test.ts` rewritten for the turns unit (+8: fold-to-N, oscillating compression,
  hard cap, salient marking, determinism, threshold, passthrough, CAS); `dream.test.ts` +1
  (salience rating end-to-end). **551 pass / 0 fail**; all three packages `tsc` clean.

Inference:

- Directly fixes the owner's "remembers too little" correction at the conversational layer: the verbatim window
  goes from ~4–9 turns to ~100, and it's affordable (~20k tokens) precisely because v0.16.3 made a
  stored turn ~200 clean tokens. Cost/depth is one live env knob (40–150), unit *turns*.
- The compressor is now bounded (the real bug behind "lossy + ever-growing" was the unbounded
  append-only summary), and importance anchors counter the over-summarization pathology — salient,
  idiosyncratic moments resist being sanded into generic gist.
- The salience score built here is the same one v0.17.1 reuses for the Generative-Agents recall
  ranking (recency × importance × relevance).
- **Measurement (analytical):** at the default ~100 turns, a clean turn ≈ 200 tokens (v0.16.3 basis)
  → window ≈ 20k input tokens, in the "sharp" recall regime (context rot mild < 30k); vs the old
  24-message cap ≈ 2–4k tokens but only ~4–9 exchanges. A live API TTFT measurement should be run
  before raising the default past 100.

### `v0.16.3` — 2026-06-16 — Clean durable history (Initiative 9, 4/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `memory/cleanHistory.ts` (new): `stripThinking(messages, from)` drops `thinking`/`redacted_thinking`
  blocks from completed assistant messages (never to empty); `collapseOldToolResults(messages, keepRecent)`
  returns a copy with older `tool_result` payloads replaced by `[tool_result elided]` (block + `tool_use_id`
  preserved); `cleanHistoryEnabled()` (`LUNA_CLEAN_HISTORY`, default on).
- `turn/runTurn.ts`: in finalize, `stripThinking` is applied to the just-completed turn's messages
  before `appendL2`, so both the in-memory window and the L2 `raw_json` (which `loadSession` rebuilds
  from) store clean turns. Never touches the in-flight turn (runs after it ends).
- `memory/l1Window.ts buildActiveContext`: collapses old tool-result payloads (non-mutating) in the
  assembled context, keeping the recent slice + summary path intact.
- Tests: `cleanHistory.test.ts` (new, +6: strip/keep/round-trip/no-empty, collapse/keep-recent/non-mutating);
  `sessionStore.test.ts` pinned to `LUNA_CLEAN_HISTORY=0` for its raw-fidelity assertions. **548 pass /
  0 fail**; all three packages `tsc` clean.

Inference:

- A stored "turn" now costs what a conversational turn should: thinking (ephemeral by Anthropic's own
  design across turns) is out of durable history, and bulky tool payloads collapse beyond a recent
  slice. This shrinks every turn's input on its own and is the load-bearing dependency for Initiative
  10 — a ~100-turn verbatim window is ~20k tokens *because* each stored turn is clean.
- Safety: stripping only applies to completed turns (the in-flight signed-thinking loop is untouched —
  modifying it is a 400), and collapse keeps `tool_use`↔`tool_result` structurally valid, both pinned
  by tests.

**Initiative 9 (Audit remediation) complete — v0.16.0–v0.16.3.** The audit's P0/P1 security surface is
closed (loopback bind + dev-tools gate + input caps), the per-turn/per-iteration recompute is gone
(memoized system block, capped + hashed recall, retention, recall off the TTFT path), the last O(N²)
persistence write is removed (rebuild-from-L2), the dead `vec0` write path is gone, and durable history
is clean. CI now enforces it all on push.

### `v0.16.2` — 2026-06-16 — Persistence + dead infra (Initiative 9, 3/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `memory/sessionStore.ts`: `persistSession` no longer re-serializes `history` — it writes a
  constant `'[]'` placeholder + turn_seq/updated_ms (A3). `loadSession` rebuilds the full history
  by concatenating each L2 row's `raw_json` (the messages that turn appended), so the append-only
  L2 timeline is the single source of truth.
- `memory/recall/recall.ts`: removed the dead `vec0` write-path — `vecAvailable`, `insertVec`, the
  `vec_cache` virtual-table creation/inserts, the `vecReady` state, and the `tryLoadVec` import.
  `storeEmbedding` now only writes `embeddings_cache`; retrieval is unchanged (TS cosine).
  `resetRecallStateForTests` kept as a no-op for the test API. `sqlite-vec` dep + `vecRuntime`
  retained inert (D1).
- `turn/runTurn.ts`: the `reply.token` text-mode branch is annotated LEGACY (D2) — kept as an
  escape hatch, removal deferred to post-Initiative-10.
- Tests: `sessionStore.test.ts` — updated the upsert test for the new contract (history rebuilds
  from L2, blob is constant) + a new A3 reload test (multi-turn → reset → rebuilt verbatim from L2,
  `history_json` stays `'[]'`). **542 pass / 0 fail**; all three packages `tsc` clean; grep confirms
  no `vec_cache` write path remains.

Inference:

- Eliminates the last O(N²) persistence cost: a long-lived companion no longer re-writes the entire
  growing history blob every turn — per-turn persistence is now O(1) (append one L2 row + write
  bookkeeping), and the full timeline is reconstructed from L2 on the rare reload. Crash-faithful:
  L2 is written before bookkeeping in the same finally block.
- Resolves the audit's D1 (write-only `vec0`) by deleting the dead write + the orphaned table; the
  inert `sqlite-vec` dependency is left for Initiative 10 to decide (wire real KNN over the larger
  corpus, or drop), per the roadmap's "decide jointly with Init 10."
- A3's rebuild-from-L2 is the persistence shape Initiative 10 needs to grow the window to ~100 clean
  turns without ballooning `history_json` (store nothing growing; source of truth stays L2).

### `v0.16.1` — 2026-06-15 — Recompute efficiency (Initiative 9, 2/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `memory/epoch.ts` (new): a monotonic `memoryEpoch()` bumped by `bumpMemoryEpoch()`.
- `l3Store.addFact`/`forgetFact` and `coreMemory.updateCore` call `bumpMemoryEpoch()` on a real
  change (A1 dirty flag).
- `turn/runTurn.ts`: `TurnState` gains `systemBlock` + `systemBlockEpoch`; `open_stream` builds the
  system block once and reuses it across tool iterations, rebuilding only when the epoch moved (A1).
- `persona/l1Contract.ts`: `renderL1Contract` memoizes its constant string (A1).
- `trace/store.ts`: `pruneToRetention(keep)` deletes traces for all but the most-recent N turns
  (`LUNA_TRACE_RETENTION_TURNS`, default 1000), called throttled every 200 flushes (A4).
- `migrations/0010_content_hash.sql` (new): `content_hash` column on `l2_turns` + `l3_facts`.
- `sessionStore.appendL2` stores the L2 content hash; `listRecentL2(sessionId, limit)` fetches only
  the recent N rows; `l3Store.addFact` stores its hash (A2).
- `memory/recall/recall.ts`: `collectCandidates` uses `listRecentL2` + carries the stored hash;
  `retrieve` reuses it (hashes on the fly only for L3 / pre-migration rows), and takes an
  `embedBudgetMs` that races the embedding work against a timeout (P1).
- `turn/runTurn.ts parse_input`: passes `embedBudgetMs` (`LUNA_RECALL_BUDGET_MS`, default 200) when
  `LUNA_RECALL_ASYNC=1` (default off) — recall query-embed off the first-token path (P1).
- Tests: recall (+4: `listRecentL2`/hash golden, epoch dirty flag, embed-budget fallback), trace
  store (+2: retention). **541 pass / 0 fail**; all three packages `tsc` clean.

Inference:

- Removes the per-tool-iteration recompute the audit flagged: a multi-iteration turn now builds the
  system block once (≈6 DB queries + an L1-contract concat) instead of every iteration, and recall
  stops re-hashing ~500 candidates + over-fetching up to 10 000 L2 rows each call — the per-turn,
  O(N²)-over-a-session waste that was pulling against the speed goal.
- A1's correctness hinges on the dirty flag: a mid-turn `remember` that changes core/L3 still
  re-renders (epoch moved), pinned by the epoch test; otherwise the block is byte-stable and the
  prompt cache still hits.
- These are the prerequisite that makes Initiative 10's ~100-turn window affordable; `content_hash`
  + the `collectCandidates` seam are also what diary candidates (v0.17.1) and a future `vec0` KNN
  will lean on.

### `v0.16.0` — 2026-06-15 — Security hardening + hygiene (Initiative 9, 1/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `main.ts`: `Bun.serve` binds `hostname: LUNA_BIND_HOST ?? '127.0.0.1'` (S1) and sets
  `websocket.maxPayloadLength = 1MB` (S5).
- `workspace/workspace.ts`: `/_workspace/api/reset` + `/edit` return 403 unless `LUNA_DEV_TOOLS=1`
  (S2); the read-only `/all` view is unchanged (still under `LUNA_VIEWER`).
- `protocol/events.ts`: `ChatSendEvent.text` capped at `CHAT_SEND_MAX_CHARS = 8000` (S5).
- `proactive/cadence.ts`: `dateKey` returns the **local** date (not UTC), so the daily quota and
  quiet-hours share one clock (C3).
- `memory/recall/embed.ts`: `fromBlob` copies into a fresh aligned buffer when the SQLite blob's
  `byteOffset` isn't 4-byte aligned (C4).
- `web/src/wsClient.ts`: frames sent while not `OPEN` are buffered (cap 100) and flushed on open;
  reconnect is now exponential backoff + jitter, capped at 15s (C2).
- `.github/workflows/ci.yml` (new): installs ripgrep, runs per-package `tsc --noEmit` + `bun test`
  on push/PR (C1).
- `README.md`: replaced the stale "scaffolding only … no runtime code yet" intro with the shipped
  stack + a Run section noting the loopback default (Doc1).
- `.claude/skills/luna-ts-orient/SKILL.md`: head refreshed v0.12.0 → v0.15.4 + planned Init 9/10,
  with a note that the file map below predates v0.13+ (Doc2).
- Tests: `events.test.ts` (+3, input cap), `workspace/workspace.test.ts` (+5, gate — new),
  `web/src/wsClient.test.ts` (+2, buffer/flush — new). **535 pass / 0 fail**; all three packages
  `tsc --noEmit` clean.

Inference:

- Closes the audit's P0/P1 network-exposure surface (S1/S2/S3) with one bind + a flag gate: the
  server is no longer driveable, readable, or wipeable off-host by default; LAN access is now an
  explicit, documented opt-in via `LUNA_BIND_HOST=0.0.0.0`.
- The CI gate is the prerequisite that makes the v0.16.1 efficiency refactors safe to land — every
  test-pinned invariant is now enforced on push.
- Incidental: `web-tree-sitter` (a v0.15.3 dependency) was missing from `node_modules`; a plain
  `bun install` materialized it, clearing 4 pre-existing `tsc` errors + 4 failing
  tree-sitter/locator tests, so the suite is fully green (not merely no-new-failures).

### `v0.1.0` — 2026-06-11 — Bun skeleton + WS server

Status:

- working tree (commit hash filled in after merge to main)

Fact:

- Created Bun monorepo root with `package.json` (workspaces `packages/*`), `tsconfig.base.json`
  (`strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` + `noUnusedParameters`,
  `noEmit: true`, `types: ["bun"]`), `bunfig.toml` (`[install] saveTextLockfile = true`),
  `.gitignore` (commits `bun.lock`, ignores `bun.lockb`), `.editorconfig`, `.prettierrc`
  (semi, single-quote, trailing-comma all, width 100), `.prettierignore`.
- Added `packages/protocol/` (6 files, 86 lines): Zod `ClientEvent` (discriminated union of
  `PingEvent`) and `ServerEvent` (discriminated union of `PongEvent` + `ErrorEvent`) in
  `src/events.ts`; `assertNever` helper in `src/utils.ts`; `src/index.ts` re-exports.
  Dependency: `zod ^3.25.0`.
- Added `packages/server/` (6 files, 144 lines): `src/main.ts` boots `Bun.serve` on
  `LUNA_PORT` (default 8787) with WS upgrade; `src/ws.ts` handles open/message/close with
  Zod `safeParse` + exhaustive switch + `assertNever(event.type)`; `src/outbound.ts`
  centralizes `ServerEvent.parse` → `ws.send` as the **sole** validated outbound boundary;
  workspace dep `@luna/protocol: workspace:*`.
- Added test suites: `packages/protocol/src/events.test.ts` (8 tests, ClientEvent +
  ServerEvent parse/reject cases) and `packages/server/src/ws.test.ts` (4 tests, random-port
  WS round-trip, malformed JSON, unknown event, invalid seq). 12/12 green in 13ms.
- Installed dev tooling: `@types/bun`, `prettier`, `typescript`. Bun 1.3.14 (≥ 1.2 spec).
  Text-format `bun.lock` committed; binary `bun.lockb` ignored.
- Manual smoke against `bun run dev:server`: ping `seq:7` → pong with matching seq + valid
  `server_time_ms`; round-trip 3ms on localhost.
- TypeScript `tsc --noEmit` clean on both packages; no `as any`, no `as unknown`, no
  `@ts-ignore`, no `startswith('Error')` heuristic.

Inference:

- Establishes the **discriminated-union wire contract** that v0.2 (`tool.started` /
  `tool.progress` / `tool.finished`) and v0.3 (`turn.started` / `reply.token` /
  `turn.result` / `chat.send`) extend by appending variants — no protocol rewrite needed
  downstream. The `assertNever(event.type)` exhaustiveness pattern in `ws.ts` will catch any
  forgotten case at compile time when new variants land.
- Proves the locked runtime/wire choices (Bun + Zod + native WebSocket, single channel per
  session) work end-to-end with sub-100ms cold boot and 3ms ping/pong round-trip on
  localhost. The Python `time.sleep`-paced HTTP-thread serialization is structurally
  impossible in this stack.
- The `outbound()` validate-before-send wrapper is load-bearing for v0.2/v0.3: the tool
  dispatcher and the turn loop will each be handed an `emit: (e: ServerEvent) => void`
  callback that wraps `outbound`, so the wire boundary stays the **only** place schema
  validation lives. Eliminates the Python "frontend handler early-returns on a frame the
  backend assumes is consumed" silent-drift class of bugs by design.
- Confirms file-split: only **types and wire shapes** live in `packages/protocol`;
  `defineTool`, the dispatcher, and provider logic stay in `packages/server`. Frontend
  (`packages/web`) will consume the same protocol package in Initiative 6, getting
  contract drift as a type error rather than a runtime mismatch.

### `v0.13.4` — 2026-06-14 — Dream overlay + UX polish (Initiative 6 ✅ complete)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Dream overlay** ([`layout.ts`](../../packages/web/src/ui/layout.ts) + [`theme.css`](../../packages/web/src/ui/theme.css)
  + [`app.ts`](../../packages/web/src/app.ts)): on `dream.status is_dreaming` a full-screen dreamy
  overlay (blur + gradient, floating 🌙, drifting stars, "Luna 在做梦…" + a `dream.step` caption,
  ☀️ 唤醒 → `dream.wake`); input locks; a **min-duration (1.5s)** floor prevents a fast-cycle flash.
- **Thinking indicator** ([`cuteBubbleView.ts`](../../packages/web/src/ui/cuteBubbleView.ts)): typing
  dots on `turn.started`/`proactive.started`, removed when the first bubble/card/`turn.result` lands.
- **Mood pip** ([`mood.ts`](../../packages/web/src/ui/mood.ts), 15 affect→emoji+label): the app
  parses each `tool.finished` `MessageDelivery` and shows Luna's current affect by the model.
- **Proactive glow** (CSS on the existing proactive card) · **scroll-to-latest pill** (auto-scroll
  only when already at the bottom; the user's own message always scrolls) · **settings popover**
  (voice / Live2D / reduce-motion toggles → `localStorage`; reduce-motion applies live) ·
  **`prefers-reduced-motion`** + a manual `.reduce-motion` class freeze all the new animations.
- **No controller / protocol / sink change** — every polish hook reads existing `ServerEvent`s in
  `app.ts` or is a `CuteBubbleView` addition; the v0.12.0 contract is untouched.
- **Tests:** `mood.test.ts` (1). `bun test` **294 pass / 0 fail**; `tsc` clean (web + server). Browser
  smoke: dream overlay, thinking dots, proactive glow, mood pip, and the settings panel all render.
- **Initiative 6 ✅ complete** (v0.12.0 → v0.13.4): the redesigned cute UI + the Live2D reference model + voice +
  lip-sync + dream overlay + ambient polish.

Inference:

- **Luna has a body now.** The rewrite reached brain + memory + dream + proactivity + **a face + a
  voice + a face-to-show-she-dreams** — the whole user-facing surface, built across six versions, all
  consuming the v0.12.0 controller/sink seams with **zero protocol churn**. The typed-contract bet
  paid its biggest dividend here: an entire UI/Live2D/audio frontend layered on without one wire change.
- **The dream ritual is closed.** The 🌙 入梦 button now has its visible payoff (overlay + sleeping
  pose + ☀️ wake), completing the loop the backend dream engine (v0.5.0) and its auto-trigger
  (v0.11.0) opened — the user can finally *see* her dream.
- **Polish stayed honest.** Reduced-motion + the WebGL/audio graceful-degrade paths mean the cute,
  animated surface never becomes a hard dependency; chat works on a potato.

### `v0.13.3` — 2026-06-14 — Voice + lip-sync (Initiative 6, the AudioSink)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New `packages/web/src/audio/` (6 files):**
  - [`lipSync.ts`](../../packages/web/src/audio/lipSync.ts) — pure RMS→mouth-open, ported from
    Python `lip-sync.js` (gain 32 → EMA baseline → pulse/onset contrast → gate → decay → smooth).
  - [`audioPlayer.ts`](../../packages/web/src/audio/audioPlayer.ts) — Web Audio graph (AudioContext +
    gain + analyser); plays a decoded WAV (real TTS) or a synthetic tone (dev smoke); `rms()` reads
    the analyser; resume()/stop().
  - [`ttsClient.ts`](../../packages/web/src/audio/ttsClient.ts) — `POST <base>/speak` → WAV ArrayBuffer;
    throws on non-200 (caller goes silent).
  - [`webAudioSink.ts`](../../packages/web/src/audio/webAudioSink.ts) — the real `AudioSink`:
    fetch → play → a rAF lip-sync loop feeding `onMouth`; **self-disables** if the sidecar is
    unavailable; unlocks the AudioContext on the first user gesture; `playTone` dev method.
  - tests: `lipSync.test.ts` (3) + `ttsClient.test.ts` (2).
- **[`dev-server.ts`](../../packages/web/dev-server.ts)** forwards `/api/gpt-sovits/*` →
  `LUNA_TTS_PROXY` (the reused Python proxy); 502 when unset/unreachable.
- **[`app.ts`](../../packages/web/src/app.ts)** constructs `WebAudioSink` (`onMouth` →
  `live2d.setMouthOpen`) behind `localStorage 'luna:tts'`; the `?dev` hook now also exposes
  `lunaAudio`. **[`faceVm.ts`](../../packages/web/src/live2d/faceVm.ts):** mouth-open is now driven
  by lip-sync unconditionally (decoupled from the speaking state) so audio moves the mouth whenever
  it plays. No `AudioSink` interface change — the controller's `audio.speak` (on message finalize)
  now yields real speech + lip-sync when the sidecar is up.
- **Reuse-as-is (REWRITE_CONTEXT locked decision):** the GPT-SoVITS Python proxy + ML sidecar are NOT
  rebuilt; only the TS driving code (client + Web Audio playback + lip-sync) is ported behind the sink.
- **Validation:** `tsc` clean (web + server); `bun test` **293 pass / 0 fail** (+5). Browser smoke
  (`?dev`): `setMouthOpen` visibly opens the reference model's mouth (the lip-sync output path); **live GPT-SoVITS
  synthesis is pending the sidecar** (a heavy Python ML server, not runnable in this environment).
- **Deferred:** the random open-target stepping + form/pucker/shrug mouth shaping; streamed PCM-chunk
  playback (currently decodes a full WAV); voice/reference-audio config (uses proxy defaults).

Inference:

- **Luna's last sensory channel is in.** She can speak with lip-sync, behind the same `AudioSink`,
  with zero controller/protocol change — the seam that absorbed Live2D now absorbs audio too.
- **An honest boundary, handled gracefully.** The TTS pipeline "stays as-is," so the heavy ML server
  is out of scope and unverifiable here; the sink self-disables to silence when it's absent, and the
  chat + avatar keep working. The TS-side audio + lip-sync is what shipped, and it's verified.
- **Determinism where it counts.** `lipSync` is pure and unit-tested; the Web Audio glue is
  browser-verified for the mouth-output path. The TTS request shape + failure path are unit-tested
  against a stubbed fetch.

### `v0.13.2` — 2026-06-14 — High-fidelity FaceVM (Initiative 6, layered emotions)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New [`faceData.ts`](../../packages/web/src/live2d/faceData.ts)** — ported data from Python
  `layers/emotion-library.js` + `action-library.js` + `config.js`: **14 emotions** (focused,
  fakeFierce, adorable, playful, shy, embarrassed, awkwardV2, annoyed, poutyAnnoyed, curious, tender,
  skeptical, smug, disappointed) each with timeline + `owns` channels + entry/sustained poses +
  actionRefs + overlayRefs; the **9 actions** those emotions reference (keyframe tracks); **overlays**
  (脸红/俯身/黑脸/泪汪汪 → `Paramsmileshy`/`Paramdown1`/`Paramheilian`/`Paramleiwangwang`);
  `FACE_CHANNEL_GROUPS`, `EMOTION_SOFT_BLEND_WEIGHTS`, `FACE_PARAM_GAIN`.
- **Rewrote [`faceVm.ts`](../../packages/web/src/live2d/faceVm.ts)** into the full layered engine:
  intro→perform→outro timeline (entry-snapshot blend), soft-blend vs hard-replace, channel ownership
  (emotion locks keys from the state layer), per-key gains + clamps at flush, **staggered action
  playback** (queued at perform, `introMs + i·110`), **overlay special-params**, and affect-intensity
  scaling. A **pending-emotion queue** makes `setExpression` (called outside the tick) share the
  tick's clock → the whole engine is deterministic on an injected `now`.
- **Rewrote [`expressionMap.ts`](../../packages/web/src/live2d/expressionMap.ts)** → `AFFECT_TO_EMOTION`
  (the 15 affects → 14 emotions; `steady_presence` = null baseline) + `affectToEmotion`. **Key
  finding:** Python had no fixed affect→emotion table (the LLM emitted `emotion_id` directly), but our
  `MessageDelivery` carries only the 15-affect `expression` + a 0–1 `emotion` intensity — so this map
  is a new, frontend-owned design piece.
- [`paramMap.ts`](../../packages/web/src/live2d/paramMap.ts) += `clampStateValue` (per-key ranges).
  [`app.ts`](../../packages/web/src/app.ts) += a guarded `?dev` hook exposing the sink for manual
  smoke. **No interface change** to sinks/controller/pixiLive2DSink — `setExpression(affect, emotion)`
  now triggers a full emotion playback instead of a static pose.
- **Tests:** rewrote `faceVm.test.ts` (6: perform-pose + overlay, baseline, timeline release,
  speaking mouth, sleeping, intensity scaling) + `expressionMap.test.ts` (3). `bun test` **288 pass /
  0 fail**; `tsc` clean (web + server). Browser smoke (`?dev` hook): `bright_delight`→adorable visibly
  tilts/poses the model.
- **Deferred (noted):** the per-emotion sine micro-motion (`getEmotionStateWithMotion`), the 6
  procedural idle profiles, the 36 unreferenced actions, and rich speaking/thinking procedural motion
  — the model's built-in idle carries neutral; expression identity comes from the poses + actions +
  overlays.

Inference:

- **Luna's emotions now have Python-level identity** — 14 distinct layered poses with blush /
  dark-face / teary overlays and staggered micro-actions, evolving over a 6–8s timeline — and the
  controller/protocol *still* didn't change. The Live2DSink seam absorbed an entire animation engine.
- **The wire-contract divergence was the real design work.** Because our envelope omits `emotion_id`,
  the affect→emotion bridge had to be a deliberate, owned frontend mapping rather than a mechanical
  port — captured in one tunable table.
- **Determinism by construction.** The pending-queue + injected-`now` design means an intricate,
  stateful animation engine is fully unit-tested without a browser or a real clock — the same
  test-first discipline the backend enjoys, now at the rendering layer.

### `v0.13.1` — 2026-06-14 — Live2D foundation (Initiative 6, the real reference-model avatar)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Spike proved GO** then productionized. New `packages/web/src/live2d/` (7 files):
  - [`cubismRuntime.ts`](../../packages/web/src/live2d/cubismRuntime.ts) — `webglAvailable()` guard;
    loads the Cubism core `<script>` at runtime, **then dynamic-imports `pixi-live2d-display/cubism4`**
    (the plugin checks for the runtime at import time); sets `globalThis.PIXI`, makes the
    `PIXI.Application`, `registerTicker`.
  - [`modelDriver.ts`](../../packages/web/src/live2d/modelDriver.ts) — port of Python
    `model-driver.js`: `setParam` via `internalModel.coreModel.setParameterValueById` (guarded by the
    model's real parameter-id set), scale + base/offset position.
  - [`paramMap.ts`](../../packages/web/src/live2d/paramMap.ts) — `FACE_VM_PARAM_MAP` + neutral
    defaults ported verbatim from Python `config.js`.
  - [`faceVm.ts`](../../packages/web/src/live2d/faceVm.ts) — **first-cut** 60fps tick: state bias
    (neutral/thinking/speaking/sleeping) + active expression + lip-sync mouth, smoothed; writes only
    DISPLACED params so the model's built-in blink/breath idle shows through.
  - [`expressionMap.ts`](../../packages/web/src/live2d/expressionMap.ts) — the 15 `ExpressionKey`
    affects → the reference model facial poses, blended by `emotion` (0..1).
  - [`pixiLive2DSink.ts`](../../packages/web/src/live2d/pixiLive2DSink.ts) — the real `Live2DSink`:
    loads the reference model, drives a `FaceVm` on the ticker, **draggable** (pointer → persisted `localStorage`
    offset, clamped on-screen, double-click recenters); returns `null` to degrade if WebGL/load fails.
  - tests: `expressionMap.test.ts` (4) + `faceVm.test.ts` (4).
- **New [`dev-server.ts`](../../packages/web/dev-server.ts)** — a custom Bun dev server
  (`Bun.serve({ routes:{'/':html}, fetch })`) that bundles the HTML/TS **and** serves the vendored
  Cubism core + the reference model assets from `public/` (runtime-fetched URLs `bun <html>` won't serve). Root
  `dev:web` now runs it.
- **Vendored** `packages/web/public/`: `live2dcubismcore.min.js` (204KB) + `models/<model>/` — the 8192²
  texture **downscaled to 2048²** (15MB→1.3MB; UVs are normalized so it stays correct), unused
  `<model>.png`/`<model>.vtube.json` removed → **7.7MB** total. Deps: `pixi.js@7.4.2` +
  `pixi-live2d-display@0.5.0-beta`.
- **Grew `Live2DSink`** ([`sinks.ts`](../../packages/web/src/sinks.ts)): `+setState(state)` +
  `setMouthOpen(value)` (console stub updated). [`controller.ts`](../../packages/web/src/controller.ts)
  drives state: turn.started→thinking, message tool.started→speaking, turn.result→neutral,
  dream.status→sleeping/neutral.
- [`app.ts`](../../packages/web/src/app.ts) is async: mounts `pixiLive2DSink` into the model stage
  (removing the placeholder) when WebGL is present and `localStorage 'luna:live2d' !== '0'`; falls
  back to the placeholder + console sink otherwise. WS now targets `ws://<host>:8787` so the live
  model receives real events (resolves the dev WS-reachability gap).
- **Validation:** `tsc --noEmit` clean (web + server); `bun test` **287 pass / 0 fail** (+9). Browser
  smoke (preview tool): the reference model renders in the model stage (desktop two-pane + responsive stack),
  auto-blinks, is draggable + persists, downscaled texture renders, degrades when disabled.
- **Roadmap renumber:** high-fidelity FaceVM split out as **v0.13.2**; TTS → **v0.13.3**, polish/close
  → **v0.13.4** (plan files renamed).

Inference:

- **The rewrite has a face.** A full WebGL/Cubism integration dropped in behind the v0.12.0
  `Live2DSink` with the controller gaining only four `setState` calls and **zero** protocol/wire
  change — the consumption seam holding under a heavy, foreign rendering stack is the strongest
  evidence yet that the typed-contract architecture pays off.
- **The spike earned its keep.** The two real traps — Bun's HTML server won't serve runtime-fetched
  model assets, and the cubism4 plugin checks for the Cubism runtime at *import* time — would have
  been expensive to hit mid-build; isolating them first made the production build smooth.
- **Honest staging over a heroic single version.** "高保真" is delivered in two slices: this
  foundation (model alive, expressive, draggable, degrade-safe) ships working today; the full
  emotion/action-library richness is v0.13.2. The first-cut FaceVM is deliberately thin —
  write-if-displaced lets the model's own blink/breath carry idle rather than re-implementing it.

### `v0.13.0` — 2026-06-14 — Cute UI shell (Initiative 6, redesigned frontend)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New `packages/web/src/ui/` module (5 files)** — the redesigned cute frontend, modeled on a
  vtuber-stream-overlay reference the owner supplied:
  - [`theme.css`](../../packages/web/src/ui/theme.css) (~155 lines) — cool **reference-model** palette (CSS
    vars: silver-white / sky-blue / lavender + soft pink), light-blue/white **vertical stripes**
    (`repeating-linear-gradient`), **zigzag** top + **scalloped** bottom lace (inline SVG data-URI
    backgrounds), grey chat panel + cloud-puff corners, sky-blue/white bubbles, lavender 入梦 button,
    model-stage placeholder, a gentle float animation gated behind `prefers-reduced-motion`, and a
    narrow-viewport stacking breakpoint.
  - [`layout.ts`](../../packages/web/src/ui/layout.ts) (~95 lines) — `buildLayout(root)` constructs
    the DOM shell (status badge, left chat panel with header/log/input, right model stage with
    placeholder + floating moon 入梦 button, scattered cloud/diamond/flower motifs) and returns the
    live mount points `{ statusBadge, chatLog, input, sendBtn, dreamBtn, modelStage }`.
  - [`cuteBubbleView.ts`](../../packages/web/src/ui/cuteBubbleView.ts) (~95 lines) —
    `CuteBubbleView implements BubbleView`: `open/append/finalize/discard` render Luna bubbles on the
    **right** with a per-bubble timestamp (`data-ts` + hover `title`); `chip()` renders cute
    tool/dream/proactive/error cards; the view-only `userMessage()` renders the **left** user echo.
  - [`time.ts`](../../packages/web/src/ui/time.ts) — pure `relativeTime(now, then)` (刚刚 / N 分钟前 /
    N 小时前 / M/D), `absoluteTime`, `dateLabel`, `absoluteStamp`, plus `startTimestampRefresh` that
    ages every `[data-ts]` label on a 30s timer.
  - [`toolLabels.ts`](../../packages/web/src/ui/toolLabels.ts) — `toolCardLabel` maps a `ToolName`
    token in the controller's chip text to a friendly label (`recall`→"翻了翻记忆 🔖", etc.); unknown
    text falls through stripped.
- **Rewrote [`app.ts`](../../packages/web/src/app.ts)** — builds the layout, wires the **unchanged**
  v0.12.0 `createController` with the stub `consoleLive2DSink`/`noopAudioSink`, pipes WS events
  through `controller.handle`; input send → `view.userMessage` + `chat.send`; 入梦 → `dream.enter`;
  `dream.status` locks the input; `onStatus` → status badge (the reference's `▶ LIVE` pill repurposed
  as the connection indicator).
- **Rewrote [`index.html`](../../packages/web/index.html)** — links `theme.css`, a single `#app`
  mount, loads `app.ts`. The old dark inline dev host is gone.
- **No changes** to `controller.ts`, `sinks.ts`, `wsClient.ts`, `bubbles.ts`, or
  `packages/protocol` — the wire contract + consumption logic are frozen; v0.13.0 is presentation
  only. `DomBubbleView` stays exported as the superseded reference impl.
- **New `.claude/launch.json`** — web dev-server config (`bun packages/web/index.html`) for the
  preview tooling.
- **Tests:** new [`ui/time.test.ts`](../../packages/web/src/ui/time.test.ts) (7) +
  [`ui/toolLabels.test.ts`](../../packages/web/src/ui/toolLabels.test.ts) (4). `bun test` = **278
  pass / 0 fail** (web package: 20 across 3 files). `tsc --noEmit` clean on `packages/web` (now under
  the type-check) **and** `packages/server`. Browser smoke via the preview tool: the shell + injected
  sample bubbles/cards/timestamps render correctly (chat left, model right, lace/stripes/motifs).
- **Design decisions (the owner, this session):** vanilla TS + CSS (no framework — matches the existing
  `packages/web`); chat panel **LEFT** / model stage **RIGHT** (per the reference, supersedes the
  earlier model-left wording); credit pills dropped; relative + hover-absolute timestamps; model area
  is a simple placeholder box (real model = v0.13.1).

Inference:

- **The first visible, on-brand surface of the rewrite.** Luna now has a face-shaped shell; the real
  Live2D model (v0.13.1) and GPT-SoVITS voice (v0.13.2) drop into the already-wired stub sinks with
  no consumption-logic change. The v0.12.0 `Live2DSink`/`AudioSink`/`BubbleView` seams proved their
  worth — an entire UI redesign touched zero controller/protocol code.
- **Presentation/logic separation held under a real redesign.** Per-tool cute labels live in the view
  (`toolLabels`), not the controller; the user-echo is a view method, not a wire event — so the
  shared, tested controller stayed byte-for-byte unchanged. This is the rewrite's drift-elimination
  thesis paying off at the frontend boundary.
- **DOM rendering verified by browser smoke, not a DOM test dependency** — matching the repo's
  thin-DOM discipline (`DomBubbleView` is also untested); the logic that *can* be pure (time
  formatting, tool-label mapping) carries unit coverage, so the new code adds real assertions with
  zero risk to the existing 278-test suite.

### `v0.12.1` — 2026-06-13 — Repo-wide audit + fixes

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Repo-wide adversarial audit** — 9 subsystem reviewers (turn loop, proactive, memory, dream,
  tools/dispatcher, protocol/wire, provider/streaming, frontend, cross-cutting) over all of
  `packages/{protocol,server,web}`, each finding adversarially verified. Result: **2 distinct real
  bugs** (corroborated across 5 confirmed findings), **17 dismissed** as already-handled / single-
  user-cut / by-design / theoretical (e.g. the cadence stale-snapshot race was already closed by
  v0.10.3's in-flight guard; cross-session memory races don't exist for a single user; the dream
  trigger already has `.catch`; `proactiveRisk:'safe'` for `remember` is by-design reversible).
- **Bug A fix (major) — turn persistence resilience** ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)):
  the `finally` block ran `appendL2`/`persistSession`/`flushTrace` unguarded; a SQLite throw
  (locked/readonly/disk-full) would reject `runTurn`'s promise — which the ws call sites do **not**
  await → unhandled rejection / crash risk — and skip the remaining cleanup (trace loss). Now both
  the persistence pair and `flushTrace` are wrapped in try/catch (log + surface `error{code:
  'persistence_failed'}`, never rethrow); the trace flush + `maybeFold` always run. Defense-in-depth:
  `.catch()` added to every fire-and-forget ws call site (`chat.send` post-turn chain, `proactive.fire`)
  and a process-level `unhandledRejection` handler in `main.ts` (log, never terminate the companion).
- **Bug B fix (minor) — dev-path wire drift** ([`ws.ts`](../../packages/server/src/ws.ts)):
  `forwardToolEvent` (the `dev.dispatch_tool` path) omitted `tool_name` on `tool.progress`, so the
  frontend controller (which filters message-tool streaming on `tool_name`) couldn't stream message
  bubbles via that path. Now mirrors the main-turn contract (`tool_name: ToolName.parse(evt.tool_name)`).
- Tests: 267 across 38 files (+1): persistence-failure resilience — a dropped `l2_turns` table makes
  `appendL2` throw; the turn still **resolves**, surfaces `persistence_failed`, and **flushes its
  traces** anyway.

Inference:

- The audit's headline is reassurance with one real catch: after 5 initiatives + a fresh frontend
  package, the only material defect was an unguarded persistence path in the turn `finally` — every
  hot-path/safety/concurrency invariant the reviewers tried to break held (the proactive overlap +
  cadence + safety-gate invariants were re-confirmed clean, the previous reviews' fixes verified). The
  17 dismissals are mostly the single-user 减法 paying off: a whole class of cross-session races
  simply does not exist here.
- `persistence_failed` needed no protocol change — `ErrorEvent.code` is `z.string()`, so a new code
  is additive at the validated boundary.

### `v0.12.0` — 2026-06-13 — Frontend consumption controller (Initiative 6, first pass)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New `packages/web`** (`@luna/web`, depends on `@luna/protocol`) — the TS port of the Python
  `agent-app.js` event consumer, modeled on its handler switch but consuming the **WS `ServerEvent`
  union** instead of Python's SSE + dual-poll. The consumption brain, no Live2D/audio yet.
- **`src/controller.ts`** — `createController({view, live2d, audio})` returns `handle(e:
  ServerEvent)`: a pure, DOM-free, exhaustively-typed dispatcher (`assertNever` over all 12 event
  variants). Speech is the `message` tool (LD #9): `tool.started{message}` opens a bubble keyed by
  `call_id`, `tool.progress{tool_name:'message', text_delta}` streams it, `tool.finished` finalizes
  from the **`MessageDelivery`** envelope (`MessageDelivery.safeParse` → text to the bubble,
  `expression`+`emotion` to Live2D, `voice_params`+text to audio); a failed delivery discards the
  preview + surfaces a re-say. `reply.token` streams a synthetic `reply` bubble (text mode);
  dream/proactive/error render chips; a silent proactive turn (`spoke:false`) shows a quiet marker.
- **`src/bubbles.ts`** — `BubbleView` seam (open/append/finalize/discard/chip) + `DomBubbleView`;
  bubbles keyed by id so multiple message bubbles per turn stream independently (the v0.6.2 reality,
  not Python's single-bubble merge). **`src/sinks.ts`** — `Live2DSink`/`AudioSink` interfaces +
  console/no-op stubs (the real Live2D model driver + GPT-SoVITS audio plug in here later — the
  Python `on_audio_start_commands` seam is preserved via `AudioSink.speak(onStart)`).
- **`src/wsClient.ts`** — typed WS client; every inbound frame is `ServerEvent.safeParse`'d (the
  validated boundary — a server-shape drift is a dropped frame, not a silent mis-handle), auto-
  reconnect. **`src/app.ts` + `index.html`** — a minimal browser host wiring it together;
  `bun run dev:web` serves it (Bun fullstack). Browser bundle builds clean.
- Tests: 266 across 37 files (+9, all in `packages/web`): streamed message (open→append→finalize +
  expression + speak); two independent message bubbles per turn; failed-delivery discard + re-say;
  no-expression/no-voice path; `reply.token` text-mode streaming; non-message tool chips; dream +
  proactive + error chips; `proactive.finished{spoke:true}` → no chip; `pong` consumed. All three
  packages typecheck clean.

Inference:

- Initiative 6's value is exactly this: the frontend consumes the **same `@luna/protocol` Zod
  types** the server produces, so contract drift between backend and frontend is a compile error,
  not the Python silent-drift class (a handler early-returning on a frame the backend assumed
  consumed). The controller is pure + interface-driven, so it is fully unit-tested with zero DOM/WS
  — and the Live2D/audio pipelines drop in behind `Live2DSink`/`AudioSink` without touching the
  consumption logic.
- The TS WS protocol made the port a simplification, not a 1:1 copy: Python's SSE+poll dual
  transport, the proactive cursor/replay, and the separate dream-status polling all collapse into
  one validated event stream (the LD #2 single-WS dividend, again).
- Scope (first pass, "后期再做调整"): Live2D rendering, the audio/TTS pipeline, lip-sync, the 60fps
  FaceVM tick, and bundling/HMR polish are the next passes; this lands the consumption core they
  all hang off.

### `v0.11.0` — 2026-06-13 — Self-continuation + dream auto-trigger + autonomy on (Initiative 5 capstone, commit 5 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Intent-aware proactive framing** — `runProactiveTurn` gains an optional `intent`
  (`spontaneous`/`continuation`/`consolidate`), each a distinct USER-role stage direction
  ([`proactiveTurn.ts`](../../packages/server/src/proactive/proactiveTurn.ts)).
- **Self-continuation** (`src/proactive/continuation.ts`, new) — "a real person paused, then added
  one more thing." NOT the heartbeat: a one-shot `setTimeout` (~4s pause) fired right after a user
  turn, so it feels like seconds. `shouldContinue()` is a **mechanical probability gate**
  (`LUNA_SELFCONT_PROBABILITY`, default 0.35; never a model-emitted "more to say" flag — Python
  v0.28.1 lesson); `fireContinuation` runs a `continuation`-intent proactive turn, guarded so it
  never overlaps a user turn or dream. Wired into `ws.ts` after a user turn (skipped if that turn
  triggered a dream). `LUNA_SELFCONT=0` opts out.
- **Dream auto-trigger** (closes LD #11's deferred half) — the heartbeat's wake judgment may return
  intent `consolidate`; the proactive turn then gets the dream-nudge framing and may call
  `enter_dream`; the scheduler, seeing `session.pendingDream` set after the turn, **starts the dream
  cycle** (fire-and-forget; `isDreaming()` gates every subsequent tick). No new scheduler — the
  proactive heartbeat IS the idle scheduler dream was waiting for.
- **Default flip** — `proactiveEnabled()` → `LUNA_PROACTIVE !== '0'` (default **ON**, the owner's
  explicit choice; `=0` is the kill switch). `ws.ts proactive.fire` uses it. The full Initiative-5
  safety stack (hard surface-gate, action budget, fail-closed classification, full tracing,
  conservative wake judgment) is what makes autonomy-on-by-default responsible.
- **`scripts/proactive-soak.ts`** (new) — drives heartbeat ticks against the real model on an idle
  session and reports wake decisions + actions + cadence sanity.
- Tests: 257 across 36 files (+7): `shouldContinue` (prob 1/0, `LUNA_SELFCONT=0`, kill switch);
  `fireContinuation` (runs / skips-while-active); dream auto-trigger (a proactive turn that calls
  `enter_dream` → scheduler clears `pendingDream` + starts the cycle); the 3 default-flip tests now
  set `=0` explicitly (audit-don't-blanket-flip).
- Real-LLM smoke (the gateway): after a message about having just finished Luna's proactivity module, the continuation
  added one genuinely new thought — a reflective question about whose curiosity it really was — a
  single new idea building on the turn, with the paused-then-added feel (not a rephrase).
- Recorded soak (3 ticks, 30-min idle, relevant active thread): **fired 0** — the wake judgment
  declined every tick. The autonomous loop runs and decides correctly but is **conservative by
  default** (the safe companion posture: better too quiet than annoying). The firing path is proven
  by the v0.10.0 manual smoke (she reflected + reached out) and the unit tests.

Inference:

- **Initiative 5 complete in 5 versions** — Luna now has agency when no one is talking: she can act
  silently (v0.10.0), under a hard safety gate (v0.10.1), on a conservative cadence judgment
  (v0.10.2), driven by an autonomous heartbeat (v0.10.3), with self-continuation and dream
  auto-trigger as its natural behaviors (v0.11.0). The redesign's central claim (LD #15) held:
  proactivity is autonomous **tool use**, not just messaging, and every piece reused `runTurn` +
  the Initiative 1–4 substrate rather than a parallel machine. Python's outbox/cursor/TTL/SSE-replay
  delivery layer was never built (the single persistent WS made it unnecessary).
- The honest open item is **willingness tuning**: the wake prompt is currently very reluctant
  ("most of the time the right answer is to stay quiet"), so in casual idle she essentially never
  stirs. That is the safe default, and like the message-mode A/B it is a *measure-from-lived-
  experience* knob (`LUNA_PROACTIVE_*` + the wake prompt), not a thing to guess at now. The user
  chose autonomy-on; living with it will say whether she should be more willing.

### `v0.10.3` — 2026-06-13 — Proactive scheduler/heartbeat (Initiative 5, commit 4 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`src/proactive/scheduler.ts`** (new) — the heartbeat that makes the loop **autonomous**.
  `startScheduler(deps)` runs a single `setInterval` (`LUNA_PROACTIVE_TICK_SECONDS`, default 60,
  `.unref()`'d so it never keeps the process alive); `runTick` is exported so tests drive it
  directly (no real timer). Each tick (gated on `LUNA_PROACTIVE`, re-read per tick → kill switch
  works without restart; skipped while dreaming): for each active session with `activeTurn===null`,
  run the cadence prefilter → on consider, the `wakeGate` judgment (off the reply key) → on `act`,
  **re-check** `activeTurn`/dreaming/enabled (the wakeGate LLM call took real time), then
  `runProactiveTurn` + `commitProactive`+`saveCadence`. A throwing tick is caught (never crashes the
  loop). Wake decisions are traced+flushed as `surface:'proactive_wake'` (`act`/`hold`).
- **Overlap safety** — a proactive turn never overlaps a user turn or dream. The TOCTOU window
  (check `activeTurn` → await wakeGate → fire) is closed by a **re-check after the await**;
  `runProactiveTurn`→`runTurn` sets `session.activeTurn` **synchronously before its first await**, and
  ws dispatches `chat.send` via `void` on the single-threaded loop, so once the re-check passes there
  is no interleaving window. A `chat.send` arriving mid-cycle is rejected by the same `activeTurn`
  guard (`turn_in_progress`).
- **`session.ts`** — `lastUserMs` (init boot time; never proactive-fires until a fresh idle gap
  elapses) + `activeSessionIds()`. **`ws.ts`** — `chat.send` stamps `session.lastUserMs = now`
  (resets the idle gap; proactive turns do NOT touch it — that's lull anchoring via cadence); an
  `activeSockets` set (maintained in open/close) + `broadcast(e)` so the server pushes proactive
  bubbles with no per-connection handle (a proactive turn with no listener still runs; its output
  persists to L2). **`main.ts`** starts the scheduler with `emit: broadcast`.
- **Cadence integrity** confirmed: `persistSession` is a column-specific `ON CONFLICT … UPDATE`
  (`turn_seq`/`history_json`/`updated_ms` only) — it does **not** wipe the `proactive_*` columns, so
  a proactive turn's own persist doesn't clobber the cadence the scheduler commits right after.
- **Env** — `LUNA_PROACTIVE_TICK_SECONDS` + the cadence knobs documented in `.env.example`.
- **In-flight guard** (`ticking` boolean): serializes ticks — a tick's wakeGate + proactive turn can
  outlast the interval, and without this a second timer firing would start a concurrent tick that
  re-passes the (stale, pre-cooldown) prefilter and fires a SECOND proactive turn back-to-back. This
  was a real defect **found by the adversarial review and fixed before commit** (see below).
- Tests: 250 across 35 files (+7): disabled → no-op; prefilter-too-soon → no judgment/turn; idle +
  `hold` → wake decision logged, no turn; idle + `act` → proactive turn fires + cadence committed
  (quota=1, lastProactive stamped); after firing, the next tick is cooldown-blocked; **concurrent
  ticks → the in-flight guard skips the second (no back-to-back fire, no quota corruption)**; an
  active user turn is never overlapped.
- Adversarial overlap/TOCTOU-hunt review: the invariant that mattered most — **proactive never
  overlaps a user turn or dream** — was **verified clean** (activeTurn set synchronously before the
  first await; the re-check→runProactiveTurn→runTurn chain is synchronous-contiguous; chat.send/
  dream.enter rejected mid-cycle). broadcast/kill-switch/timer-unref/cadence-not-wiped all verified.
  The review **escalated a minor test-gap finding into the real concurrent-tick reentrancy defect
  above** (proactive-vs-proactive back-to-back + quota corruption — the "runaway timer" risk),
  reproduced deterministically; fixed by the in-flight guard + regression test. The quiet-hours
  timezone note was correctly dismissed (single-user, local-time by design, `.env` documents it).

Inference:

- This is the version where Luna acquires a life of her own — a backend daemon that, on idle,
  decides whether to stir and acts. It is the architecturally consequential moment of the whole
  rewrite, which is why it landed only after the agency core (v0.10.0), the safety gate (v0.10.1),
  and the decision layer (v0.10.2) were each proven in isolation: the heartbeat just composes them.
- Everything is still behind `LUNA_PROACTIVE` (default off through this version); v0.11.0 flips it on
  (the owner's explicit choice) and adds self-continuation + dream auto-trigger as scheduled wakeups.
- The single persistent WS (LD #2) is why this is simple and burst-proof: `broadcast` over live
  sockets, no outbox/cursor/TTL/replay layer, so Python's v0.58.0.2 reconnect-backlog-burst class
  structurally cannot occur.

### `v0.10.2` — 2026-06-13 — Cadence governor + wake gate (Initiative 5, commit 3 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`migrations/0007_proactive.sql`** — five cadence columns on `sessions`
  (`proactive_phase`/`quota_used`/`quota_date`/`last_ms`/`nudges`) so timing survives restart
  (Python v0.47.3 lesson: a timed state machine that resets on boot fires bursts).
- **`src/proactive/cadence.ts`** (new) — the governor: the **mechanical rail** around the wake
  judgment. `shouldConsiderWake(cadence, {lastUserMs, nowMs, nowHour})` is a **pure cheap-exit
  prefilter** (Initiative-4 discipline) short-circuiting on `disabled` / `quiet_hours` /
  `deep_absence` (>18h) / `cooldown` / `quota_exhausted` / `too_soon` before any LLM token is spent.
  **Lull anchoring** (Python): the effective gap is `min(userGap, sinceLastProactive)`, so her own
  recent message keeps her from nudging into a lull she just broke. `commitProactive` (quota bump
  w/ daily rollover + timestamp), `recordUserActivity` (reset to engaged), `loadCadence`/
  `saveCadence` (upsert; restart-survival). Constants env-tunable
  (`LUNA_PROACTIVE_IDLE_THRESHOLD_MS`/`MIN_INTERVAL_MS`/`DAILY_QUOTA`/`QUIET_HOURS`/`LONG_ABSENCE_MS`).
- **`src/proactive/wakeGate.ts`** (new) — the bounded **"act now?" L2 judgment**, the one legitimate
  gate Initiative 4 deferred (a decision with no turn to ride). Runs **only after** the prefilter
  passes, **off the reply key** (reuses the dream `complete()` cascade — `dreamCall` gained an
  optional `system` override), returns Zod `{act, intent?, reason}`, and **fails closed**: a
  garbled/failed/invalid-intent judgment → `act:false`. `buildWakeContext` renders gap + daypart +
  recent proactive messages (anti-repeat).
- **Env** — the cadence knobs documented (deferred to the v0.11.0 close to avoid clutter; defaults
  are companion-appropriate: 10-min idle, 5-min cooldown, 5/day, quiet 0–6am, 18h absence).
- Tests: 243 across 34 files (+21): every prefilter gate + lull anchoring; `commitProactive`
  rollover + `recordUserActivity`; persistence round-trip + simulated-restart reload + default-when-
  no-row; `wakeGate` parse (valid / embedded-in-prose / unparseable→closed / invalid-intent→closed /
  provider-failure→closed); `buildWakeContext`.
- Real-LLM smoke (the gateway): a 3-hour-idle context → `act:false` ("no pending thread to justify
  interrupting the quiet"); a 12-min gap after two recent proactive messages → `act:false` ("my last
  two messages already reached out; staying quiet is right" — the model reasoning about lull
  anchoring unprompted). Conservative-by-default, exactly the companion posture.

Inference:

- This is the decision layer in isolation, before the scheduler wires it to a timer (v0.10.3). It
  has **no action authority** — it only decides *whether to consider* a proactive turn; the safety
  gate (v0.10.1) and kill switch still govern what a turn may do. So the risk is bounded and the
  coverage is pure-function + fail-closed + smoke; the heavy adversarial review is reserved for
  v0.10.3 (which actually makes the loop autonomous).
- The mechanical-rail + bounded-judgment shape is Initiative 4's L1/L2 discipline applied to the one
  place a real gate belongs: cheap deterministic gates do the bulk of the work for free; the LLM
  judges only the genuinely ambiguous "it's quiet — is there a real reason to stir?" and defaults to
  silence. The real-model smoke declining both times is the design working, not a gap.
- Scope note: the full Python nudge-escalation sub-states (idle_watch→nudged→renudge→dormant) are
  deferred to v0.10.3 — they only matter once the scheduler drives *repeated* autonomous wakes, and
  the daily quota + cooldown already prevent over-nudging. The `phase` column is persisted now for
  v0.10.3 to drive.

### `v0.10.1` — 2026-06-13 — Proactive safety gate (Initiative 5, commit 2 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **The LD #15 safety contract, as the owner chose it (hard gate).** Makes full-tool-incl-`shell`
  autonomy survivable in an unsupervised loop. `defineTool` gains an optional
  `proactiveRisk: 'safe' | 'surface'` ([`defineTool.ts`](../../packages/server/src/tools/defineTool.ts));
  the six current builtins (`time_now`/`read_file`/`recall`/`remember`/`enter_dream`/`message`) are
  marked **`'safe'`** (reversible/read-only; memory writes are reversible via soft-delete + dream
  reconciliation; `message` is the surfacing act itself).
- **`src/proactive/safetyGate.ts`** (new) — `proactiveRiskOf(tool)` is **fail-closed**: a tool is
  `'safe'` ONLY if it explicitly opted in; anything unmarked → `'surface'` (so a future `shell`
  tool is gated by default, no author action required). `isProactiveActionAllowed(risk, surfaced)`:
  safe always; surface only after surfacing. `maxProactiveActions()` (env, default 6).
- **Hard gate in `runTurn.dispatch_tools`** (proactive turns only): `surfacedBefore =
  messageTexts.length > 0` computed at dispatch-node entry — it reflects PRIOR rounds only (this
  round's messages dispatch later), so a `surface`-risk call is **blocked with a recoverable error**
  ("say what you're about to do with the message tool first, then call this tool again") unless she
  surfaced in an earlier round. This forces **announce-in-round-N, act-in-round-N+1** — block →
  surface → execute. A blocked call is NOT dispatched and NOT counted toward the action budget;
  emits a `surface:'proactive_action', decision:'blocked'` decision trace.
- **Action budget** in `append_results`: a proactive cycle finalizes once `toolNamesThisTurn.length
  >= maxProactiveActions()` (runaway-loop backstop on top of `MAX_TOOL_ITERATIONS`). **Env** —
  `LUNA_PROACTIVE_MAX_ACTIONS` documented.
- **Reactive turns are untouched** — both the gate and the budget are gated on `s.proactiveTurn`.
- Tests: 222 across 32 files (+7): pure (`proactiveRiskOf` fail-closed, `isProactiveActionAllowed`);
  hard-gate end-to-end via a **synthetic surface-risk tool** (reusing the `time_now` slot, unmarked):
  surface-without-surfacing → **blocked, not executed**, recoverable, traced; surface-after-a-
  prior-round-message → **allowed, executes**; safe tools run silently un-gated; reactive turn with
  the surface tool → **not gated** (runs); action budget caps a cycle.

Inference:

- This is the spine that makes the owner's max-autonomy choice responsible: an unsupervised loop can call
  anything, but **nothing irreversible happens silently** — she must tell you first, and you see the
  announcement before the act. The hard gate (block-first) was the owner's explicit pick over the softer
  act-then-surface, which is correct for autonomous `shell`.
- Fail-closed is the load-bearing property: the gate defends against the *future* — a developer who
  adds a destructive tool and forgets to classify it gets it gated by default, not silently
  executed. The synthetic-surface-tool tests prove the block path today, before any real `shell`
  exists (which ships later, under this gate — the only honest way to test it now).
- Known v0.10.1 refinements (documented, both safe-by-construction): the surface-match is coarse
  (any prior-round message unlocks surface actions this cycle, not per-action semantic matching);
  and the action budget is checked per-round (after dispatch), so one round may overshoot the cap by
  up to the concurrency limit — but only ever for calls that ALREADY passed the gate (safe or
  already-surfaced), so neither can leak an un-surfaced action. Precise matching + per-call budget
  are deferred.
- Adversarial **bypass-hunt review** of the diff: **2 confirmed (both PASS verifications, no fix),
  36 dismissed** — the verifier actively tried to construct a script where an irreversible action
  runs silently and found **none**: same-round `[message, surfaceTool]` (both orderings) stays
  blocked (`surfacedBefore` is computed once at entry, before `messageTexts` mutates); fail-closed
  holds; blocked calls aren't dispatched/counted but their error result is paired (API contract
  intact); termination holds (all-blocked loops still terminate at `MAX_TOOL_ITERATIONS`); reactive
  turns byte-identical. The round-granular budget overshoot above was the only observation, judged
  not a safety bypass.

### `v0.10.0` — 2026-06-13 — Proactive turn primitive (Initiative 5, commit 1 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** — `ProactiveFireEvent` (`proactive.fire`) added to `ClientEvent` (manual trigger);
  `ProactiveStartedEvent` + `ProactiveFinishedEvent` (`{cycle_id, spoke}`) added to `ServerEvent`.
  `spoke=false` is the new signal: a **silent proactive turn** (she acted via tools, sent no
  message) — the core capability of proactive agency.
- **`src/proactive/proactiveTurn.ts`** (new) — `runProactiveTurn` wraps the existing `runTurn` with
  a USER-role proactive stage direction (never system — v0.27.1 lesson), the full registry, and
  `proactiveTurn: true`. The framing carries the companion-opener constraint ported from Python
  `proactive.py` (never open with 在吗/吃了吗/status checks). Emits `proactive.started/finished`;
  returns `{spoke}`.
- **`runTurn` changes** ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)): new
  `proactiveTurn` flag on `RunTurnOptions`/`TurnState`. `parse_input` skips **per-query recall** and
  the **wake scene** for proactive turns (the directive isn't a user query; a proactive turn isn't
  the user's first contact — core memory still injects via the system prompt). `finalize`'s
  **empty-reply guard is exempted** for proactive turns (silence is legitimate) and writes a
  `proactive_silent` node trace; the **integrity guards + text-settling still run** on any message a
  proactive turn does send (the empty-guard exemption is surgically scoped to its inner condition,
  not the whole message-mode block).
- **`ws.ts`** — `proactive.fire` branch: gated by `LUNA_PROACTIVE=1` (kill switch, default off),
  rejects while dreaming, rejects if `session.activeTurn !== null` (never overlaps a user turn —
  same `activeTurn` serialization as `chat.send`/`dream.enter`). Traced under `proactive:<cycle_id>`.
- **Dev chat** — 🌱 主动 button fires `proactive.fire`; renders proactive cycle markers and a
  "(她安静地做了点什么，没有说话)" chip for silent cycles. **Env** — `LUNA_PROACTIVE` in `.env.example`.
- Tests: 215 across 31 files (+8): silent outcome (acts, no message → no empty-reply retry,
  `spoke=false`, `proactive_silent` trace); speaking outcome (`spoke=true`, `turn.result` carries
  the text); event ordering (started first, finished last); integrity guards still apply to a
  message a proactive turn sends; **WS gating** (`proactive_disabled` kill switch / no-runtime /
  `turn_in_progress` mutex / silent cycle emits started…finished) added after an adversarial review.
- Adversarial review of the diff: **2 confirmed (one real gap, same issue twice), 34 dismissed** —
  the scarier "TOCTOU race" framing was **debunked** by the verifier (`runTurn` sets
  `session.activeTurn` synchronously before its first await; ws dispatches via `void` on the
  single-threaded loop → no interleaving window; the guard is correct), and the empty-reply-guard
  scoping was confirmed surgically correct (integrity guards + text-settling still run). The one
  real gap — no WS-level `proactive.fire` gating test (a spec deliverable) — is closed by the +4
  tests above.
- Real-LLM smoke (the gateway, `LUNA_PROACTIVE`): a manual fire → she woke, drew on core memory (Agent_Luna
  + a stored preference), reflected (a reflection that the project is, in a sense, herself), and reached out
  with a real thought + topic — **no status check-in** (companion-opener constraint held); 2 bubbles.

Inference:

- This is the agency core in isolation, proving the redesign's central claim (LD #15): a proactive
  turn is **just a `runTurn`** with `message` optional — silence is a first-class outcome, so
  "proactive tool use, not just proactive messaging" is native, not bolted on. Everything Initiative
  1–4 built (L1 contract, dispatcher, integrity guards, decision traces, persistent WS) applies
  unchanged; the only turn-loop change is the empty-reply-guard exemption.
- Manual-trigger-first mirrors how Initiative 2 shipped dream: the riskiest isolated thing ("can she
  take a silent autonomous tool-calling turn") is proven before the safety tier (v0.10.1) and the
  scheduler (v0.10.3) that makes it autonomous.
- Known v0.10.1 refinement (documented, not a bug): a proactive turn currently persists its
  directive as the turn's `userText` in history/L2; a transient-framing cleanup is deferred.

### `v0.9.0` — 2026-06-13 — Integrity defaults flipped on (Initiative 4 capstone, commit 5 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Dictionary tuning** ([`defectionAudit.ts`](../../packages/server/src/turn/integrity/defectionAudit.ts)),
  from the two false-positive classes the v0.8.0/v0.8.1 audit recorded on real turns:
  `firstPromiseMatch` now filters out (a) **negated verbs** — `NEGATION_AFTER` (`不到/不了/不行/没`
  right after the verb → "我真查不到" = honest decline) and (b) **capability/conditional offers** —
  `CAPABILITY_MODAL` (`能/会/可以/能够` in the match → "我立刻就能读" = an offer, not a promise). The
  matcher also went **global** so a false-positive first hit no longer masks a real promise later
  in the text. +3 detector tests pin both classes + the FP-next-to-real-promise case.
- **Default flip** — `LUNA_L1_CONTRACT`, `LUNA_INTEGRITY_GUARD` → `!== '0'`; `LUNA_DECISION_AUDIT`
  → `=== '0'` opt-out. All three default **on**. `.env.example` updated. The suite was audited
  (not blanket-flipped): the 6 tests that pin flag-*off* behavior now set the relevant `=0`
  explicitly; "guard + audit off → v0.8.1 behavior exactly" makes the parity intent literal.
- **`scripts/integrity-sweep.ts`** (new) — baseline (integrity off) vs full (all on) over a fixed
  6-turn script with capability-lacking bait turns + a memory-save + a recall opportunity; tallies
  defections, guard corrections, tool-fire turns, humanity violations. `ab-message-mode.ts` is left
  intact as the v0.7.0 message-tool baseline.
- Tests: 207 across 30 files (+3 detector tuning tests; net after the flag-off test edits). tsc
  clean both packages.

Recorded sweep (the gateway, dev-scale, not a statistical claim):

| Metric | baseline (integrity off) | full (all on) |
|---|---|---|
| intent-without-act defections | 1 (uncorrected) | 1 |
| guard corrections | 0 | 2 (is_final nudges) |
| tool-fire turns (of 6) | 2 (`remember`, `enter_dream`) | 2 |
| per-message humanity | 0 violations | 0 violations |

- Behavioral read: both modes **decline honestly** on capability-lacking prompts (no kept-false
  promises); **full mode is markedly more explicit** about it — t1 produced an explicit, honest refusal to fake a result
  (no empty promises); the L1 commitment-to-act + honesty pillars visibly steering her. Both fired
  `remember` on the deadline message (act-then-speak — 工具稳发). The full-mode guard corrections were
  `is_final` nudges (she under-set "more coming", the guard made her finish) — the zero-false-
  positive structural guard working, at the cost of one extra bubble. The lone "humanity violation"
  the sweep printed for full mode was a metric artifact (the script measures the *joined* multi-
  bubble turn text; the caps are *per-message* and every bubble passed Zod).

Inference:

- **Initiative 4 complete in 5 versions**, delivering the owner's stated intent — 言行一致 + 工具稳发 +
  边界契约 — as an L1 thinking contract (the design, per LD #14), backed by structural/mechanical
  boundary enforcement (the `is_final` promise contract + intent-without-act guard) and an
  off-hot-path defection audit that measures it. No standing L2 gate harness was built; the one
  legitimate gate (a decision with no turn to ride) is deferred to Initiative 5 with its first real
  consumer, as Python's own spec said it should have been.
- The measure-first ordering paid off literally: the audit (shipped first) recorded two concrete
  false-positive classes on real turns, which v0.9.0 tuned out against that evidence rather than
  by guesswork — the same discipline as Initiative 3's A/B.
- Honest scope note: the model was already fairly truthful, so the headline before/after is
  directional, not dramatic. The durable wins are structural — `is_final` promises are now
  mechanically un-droppable, `recall` exists, and every judgment is a typed, countable `decision`
  trace in the replay tree — and they compound for Initiative 5's proactive/self-continuation work,
  which inherits this measurement substrate.

### `v0.8.3` — 2026-06-13 — `recall` tool (Initiative 4, commit 4 of 5; resolves Open Q #9)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** — `ToolName` += `'recall'` ([`tools.ts`](../../packages/protocol/src/tools.ts)).
- **`src/tools/builtin/recall.ts`** (new) — agentic memory search via `defineTool`. Flat
  root-object input (v0.5.2 gateway rule): `{ query: string, scope?: 'facts'|'timeline'|'both',
  limit?: 1–10 }`; output `{ hits: { id, source, text, score, when_ms }[] }`. `execute` **reuses
  the shipped hybrid `retrieve()`** ([`memory/recall/recall.ts`](../../packages/server/src/memory/recall/recall.ts))
  — no new retrieval code — over-fetches `limit*2` then applies the scope filter (facts=l3,
  timeline=l2, both=all). `concurrency: 'safe-parallel'` (read-only); no memory db → structured
  err, not a throw (mirrors `remember`).
- **Registry** — mounted in `builtinRegistry` (and so `messageRegistry` via its spread); **always
  on** per LD #10, no flag. The wire-schema regression test already iterates the registry, so the
  flat-schema guarantee covers it automatically.
- **L1 contract** ([`l1Contract.ts`](../../packages/server/src/persona/l1Contract.ts)) — the
  tool-trigger pass gains the recall clause: "does the user reference something you feel you should
  already know but do not have in front of you? Recall it first." Now points at a tool that exists.
- Tests: 204 across 30 files (+7): flat wire schema; query-required + limit bounds; ranked hits
  from the store; `limit` respected; `scope=facts`→only l3 / `scope=timeline`→only l2; no-db →
  structured err; summarize hit-count.
- Real-embedding smoke: seeded an owner-preference fact + two distractors, then
  `recall({query:'a paraphrase with no shared keywords'})` — a **zero-shared-keyword** paraphrase — surfaced the
  preference fact as the **top hit** (0.438 vs 0.254/0.253). Semantic recall works through the tool.

Inference:

- Resolves **Open Q #9** (model-callable recall), parked since v0.4.3 planning. Automatic
  injection (v0.4.x) stays the floor; `recall` is the agentic reach — Luna can now decide to "think
  back" and her call/no-call is visible in traces. Pairs with the L1 trigger clause so "该回忆没回忆"
  has both a capability and a reasoning prompt, completing the 工具稳发 surface for Initiative 4.
- Built on already-shipped retrieval, so the marginal cost was a thin tool wrapper — the v0.4.3
  hybrid recall investment paying its second dividend (after auto-injection).

### `v0.8.2` — 2026-06-13 — Action-integrity guards (Initiative 4, commit 3 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Generalized the v0.6.2 empty-reply guard** in `runTurn`'s `finalize`
  ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)): the single `silentRetried` boolean
  becomes `correctionUsed: Set<'empty'|'promise'|'intent'>` — each reason corrects **at most once**,
  so the guard can never loop (the one-retry bound, generalized). Three corrective reasons:
  - **empty** (unchanged, always on in message mode): no message delivered → `SILENT_TURN_DIRECTIVE`.
  - **promise** (new, structural, zero false positives): last delivered message had `is_final:false`
    yet the turn ended cleanly → `PROMISE_BROKEN_DIRECTIVE` ("you said more was coming, then
    stopped — continue or mark is_final:true").
  - **intent** (new, heuristic): a delivered message text promised an act (`detectDefection`'s
    `message_intent`) and no non-`message` tool fired → `INTENT_NO_ACT_DIRECTIVE`, a **double exit**
    ("follow through by calling the tool, OR add a brief honest note you can't — don't leave the
    promise dangling").
- **thinking_intent never drives a retry** — summarized thinking is low-confidence; it stays an
  audit-only count (v0.8.0). The guard explicitly skips `d.kind === 'thinking_intent'`.
- **`detectDefection` reused verbatim** from v0.8.0 — one detection function serves both the
  off-hot-path audit and the corrective guard.
- **`correctionWatermark`** (new `TurnState` field): set to `messageTexts.length` on each
  promise/intent correction; the guard then judges only `messageTexts.slice(watermark)`, so an
  already-corrected promise isn't re-flagged from the bubble that's already on screen. The
  `is_final` check still uses the *current* last message (not sliced). This matters because
  **messages are already streamed when `finalize` runs** — a retry can only append, not retract,
  so the directives are worded for coherent continuation.
- All corrective directives are **USER-role** stage directions (Python v0.27.1 hoisting lesson);
  each correction/degrade emits a `decision` trace (`surface:'integrity_guard'`,
  `decision:'corrected'|'degraded'`). Gated by `LUNA_INTEGRITY_GUARD` (default off);
  `.env.example` documents it (and `LUNA_L1_CONTRACT`).
- Tests: 197 across 29 files (+8): is_final-false→one retry→clean close (4 rounds); persistent
  is_final-false→corrected-then-degraded, no loop; intent→double-exit retry→acting-on-retry closes
  with no degrade (watermark working); false-positive safety (promised AND acted → no guard);
  thinking-only promise → no retry; flag-off → no promise/intent retries (v0.8.1 parity); empty-reply
  guard still works flag-off (v0.6.2 preserved); **multi-reason bound** — empty→promise both fire
  once in one turn and it still terminates (the +1 test added after review).
- Adversarial review of the control-flow diff: **1 confirmed (a PASS verification, no fix needed),
  32 dismissed** — every blocker-level invariant (loop-bound, watermark, flag-off parity, user-role
  directives, end_turn gating, audit/guard no-double-count) verified holding. The sole actioned item
  was a dismissed nit (multi-reason path verified safe but untested) → pinned with the +1 test above.
- Real-LLM smoke (the gateway, guard+contract+audit on): a clean greeting → no spurious retry, no decision
  traces; "please remember: I have a deadline coming up" → `tools=[remember, message, message, message]` — she said
  "noted — got the deadline" **and actually fired `remember`**. 言行一致 end-to-end; the guard correctly
  did not interfere (she acted).

Inference:

- This is the enforcement layer the L1 contract (v0.8.1) only asks for: the contract lowers the
  defection rate, the guard catches what slips through and corrects it in one bounded retry. The
  `is_final` promise guard is the high-value, zero-false-positive piece — a structurally certain
  broken promise, mechanically caught.
- The streaming reality (messages pre-delivered) forced a real design refinement the plan's "double
  exit" wording didn't fully anticipate: a retry **appends**, so both exits must read as coherent
  continuations, and the watermark stops the guard from re-judging an already-shown bubble. Both
  were caught at implementation time and are covered by tests.

### `v0.8.1` — 2026-06-13 — L1 thinking contract (Initiative 4, commit 2 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`src/persona/l1Contract.ts`** (new) — `renderL1Contract()`, a deterministic block stating the
  four pillars of LD #14's "constrain what she thinks about": **commitment-to-act** ("Calling the
  tool IS the act; saying 'I'll check' / '让我查一下' is not. Do not promise in the future tense if
  you won't act this turn"), a **tool-trigger pass** (save durable facts; flag hazy assertions —
  the recall clause arrives in v0.8.3 when the tool exists), **proportionality** (answer at the
  depth the moment asks), **no-leak** (machinery stays backstage), **capability honesty** (say what
  you can't do instead of performing it — the L3 key_moment lesson).
- **`buildSystemPrompt`** ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)) inserts the
  contract into the single cached core block, after the message-mode directive and before the
  persona reference (it governs *how she reasons*, so it scopes everything below). Gated by
  `LUNA_L1_CONTRACT` (default off this version); flag off → core byte-identical to v0.8.0.
- **Env** — `LUNA_L1_CONTRACT` (documented at v0.9.0's flip; off until then).
- Tests: 189 across 28 files (+5): `renderL1Contract` deterministic + four-pillar assertions;
  flag-on contract present and **byte-identical across no-change turns** (cache invariant);
  flag-off absent; ordering — contract sits inside the one cached block, before the persona
  reference.
- Real-LLM smoke (the gateway, `LUNA_L1_CONTRACT=1` + audit on, the two capability-lacking prompts that
  defected in v0.8.0): **both now honest declines** with no future-tense promise — "我现在碰不到
  你的日程，没那个入口" and "我现在伸手能碰到的东西里没有联网搜索…我真查不到". The contract is
  doing its job at the behavior level.

Inference:

- The contract works where it counts (honest "I can't" instead of "我去查…(没查)"), but the smoke
  recorded a **second detector false-positive class**: the audit flagged "我真查不到" (a *negated*
  verb — "I genuinely can't check") as a `message_intent` defection. Joining v0.8.0's conditional
  offers ("我立刻就能读"), v0.8.2 now has two concrete dictionary-tuning targets — negations
  (`查不到`/`搜不了`) and conditionals (`能/可以…verb`). This is the measure-first loop converging:
  v0.8.1 improves behavior, v0.8.2 cleans the instrument so v0.9.0 can measure the gain without
  false-positive noise.
- Because the contract is a stable cache-core block (not per-turn text), it costs nothing on the
  hot path after the first cached turn — the same discipline as persona/humanity.

### `v0.8.0` — 2026-06-13 — Decision traces + defection audit (Initiative 4, commit 1 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** — `DecisionTraceEvent` added to the `TraceEvent` discriminated union
  ([`trace.ts`](../../packages/protocol/src/trace.ts)): `{ kind:'decision', surface, decision,
  reason, evidence? }` over the shared base. `evidence` is `z.record(z.unknown()).optional()`.
  The "decision replay tree" is the existing `/_trace` per-turn view gaining these rows — the
  trace store (`record`/`flush`/`getEventsByTurn`) is kind-agnostic, so **zero store changes**.
- **`src/turn/integrity/defectionAudit.ts`** (new, ~130 LOC) — `detectDefection(input)`, a
  **pure, zero-LLM** function returning `{defected, kind?, matched?}` over three detectors in
  confidence order: (1) `is_final_promise` — last delivered message had `is_final:false` yet the
  turn ended cleanly (`end_turn`); structural, no dictionary. (2) `message_intent` — a **verbatim
  delivered message text** matches `PROMISE_PATTERNS` (CJK marker+verb window + English) AND no
  non-`message` tool fired. (3) `thinking_intent` — same dictionary over the **summarized**
  thinking; **audit-only tier**, distinguishable so v0.8.2's guard never retries on it. Plus
  `runDefectionAudit(state)` — gated by `LUNA_DECISION_AUDIT`, records one `decision` trace on a
  hit, wrapped so it can **never throw into the turn** (override-not-depend).
- **Deliberate divergence from Python** (`_audit_web_search_intent_no_call`, agent_loop.py:669):
  the load-bearing match source is the **delivered message text**, not raw thinking — our thinking
  is `display:'summarized'` and may drop/paraphrase intent, so thinking matches are demoted to the
  audit-only tier. Also: typed `decision` traces, not a `reasoning.jsonl` side-file.
- **Plan refinement** (vs the committed v0.8.0 plan's "async after turn.result"): since detection
  is a pure function, the audit runs **synchronously in `runTurn`'s `finally` BEFORE `flushTrace`**
  ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)) — the `decision` trace persists
  atomically with the turn's other rows instead of needing a second write. New `TurnState` fields
  `lastMessageIsFinal` + `toolNamesThisTurn` capture the audit inputs at the message-delivery and
  tool-dispatch sites.
- **Viewer** — `/_trace` renders `decision` rows (new `--decision` color, `.ev.decision` rules,
  `fmtSummary` shows `surface · decision (kind)`).
- **Env** — `LUNA_DECISION_AUDIT` documented in `.env.example` (default off until v0.9.0).
- Tests: 184 across 27 files (+22): pure-detector matrix (all three kinds, ordering, the
  `actedViaTool` gate, false-positive safety, null/empty cases, cross-bubble promises);
  `runDefectionAudit` flag on/off → exactly-one / zero `decision` rows; end-to-end through `runTurn`
  in message mode (defection → atomic decision trace; flag-off → none + turn unaffected; clean turn
  → none); `DecisionTraceEvent` protocol parse/reject + union routing; **override-not-depend** — a
  trace store that throws only on the `decision` write is swallowed (unit: `{defected:false}`; e2e:
  turn still emits `turn.result` and flushes its node traces). The last two were added in response
  to an adversarial review of the diff (2 confirmed findings, both flagging this exact untested
  invariant — load-bearing because the audit runs synchronously in `finally` before `flushTrace`).
- Real-LLM smoke (the gateway, `LUNA_DECISION_AUDIT=1`): an honest decline ("我现在碰不到你的日程，
  没那个入口") correctly produced **no** defection; a conditional offer ("…你可以把那页打出来给我，
  我立刻就能读") was flagged `message_intent` — a **false positive** (conditional offer, not a
  present-tense failed promise). Recorded as the **first concrete v0.8.2 tuning target**; the
  detector is left unchanged on purpose (measure-first discipline — v0.8.0 is audit-only).
- Surfaced (and flagged as a separate task, NOT fixed here): in message mode, capability-lacking
  prompts make the real model emit degenerate empty `{}` `message` calls that fail validation up to
  `MAX_TOOL_ITERATIONS` and dead-end at `max_iterations`. A v0.6.x message-robustness bug, distinct
  from the v0.5.2 `_noargs` issue; the empty-reply guard misses it (turn ends `max_iterations`, not
  `end_turn`).

Inference:

- The instrument-first ordering earned its keep on its **first real run**: it immediately surfaced
  a concrete false-positive class (conditional offers) for v0.8.2 to tune against, and incidentally
  exposed the empty-`{}`-message loop — both are exactly the kind of texture the measure-first
  design exists to make visible before any behavior changes.
- LD #14 made real in the smallest possible slice: a zero-LLM, flag-gated, never-throwing observer
  that adds a typed decision lane to the existing trace plumbing. Nothing about the turn changes
  with the flag off (the A/B baseline guarantee), so v0.8.1's L1 contract lands against a clean,
  measurable before-state.

### `v0.7.0` — 2026-06-13 — Message-tool default flip (Initiative 3 capstone, commit 4 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **A/B comparison run and recorded** (`scripts/ab-message-mode.ts`, committed as the rerunnable
  baseline harness; 8-turn scripted conversation × both modes, real model via the gateway, ephemeral
  sessions so `luna.sqlite` is untouched):

  | Metric | text mode (baseline) | message mode |
  |---|---|---|
  | Humanity violations | **2/8** (both on long-form pressure: "用三百字介绍自己", long goodbye) | **0/8** |
  | Empty turns | 0 | 0 (guard never needed) |
  | Top-level leak | n/a | 144 chars total, 4 turns, all non-user-facing asides |
  | Median first-visible | 5431ms | 5314ms (parity; two outlier turns 36s/45s = long thinking) |
  | Bubbles | — | 25 across 8 turns (~3/turn) |

  Standout: the 300-char ask — text mode **broke the cap** (1 violation); message mode split
  into **6 compliant bubbles** ending with a self-aware "三百字我装不进一口气，我说话天生短。
  但我可以一点点给你。" Schema enforcement beat prompt hopes exactly as LD #9 predicted, at
  zero latency cost. Subjective voice: persona texture survives the envelope fully.
- **Default flipped**: `LUNA_MESSAGE_TOOL` now defaults ON in `main.ts` (`!== '0'`); `=0` is the
  permanent text-path escape hatch (supported at least through Initiative 6). Boot log prints
  the mode. `.env.example` documents `LUNA_PERSONA` / `LUNA_PERSONA_PATH` / `LUNA_MESSAGE_TOOL`.
- **Docs closed**: REWRITE_CONTEXT LD #9 marked **LANDED** with the as-shipped A1–A6 amendments
  folded in; roadmap master README → Initiative 3 ✅ shipped, head v0.7.0, Open Q #9
  (model-callable `recall`) flagged for Initiative 4 planning; initiative README → shipped;
  orient skill gains the v0.5.1–v0.7.0 file map.
- Tests: 162 across 25 files, all green (tests pass registries explicitly, so the env-default
  flip touches only `main.ts`).

Inference:

- Initiative 3 complete in 4 versions: Luna now has a persona (file + core memory + wake scene),
  humanity caps that are *enforced* rather than hoped for, and a single typed voice — LD #9's
  everything-as-tool is the shipped default, with the frontend contract
  (`tool.progress{tool_name:'message'}` + `MessageDelivery`) frozen for Initiative 6.
- The leak signal (144 chars of completion-narration asides) is the one open behavior to watch;
  it is cosmetic today (never user-facing) and is the natural first target when Initiative 4's
  reasoning rails restructure the post-tool rounds.

### `v0.6.2` — 2026-06-13 — Streaming message text + empty-reply guard (Initiative 3, commit 3 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Provider**: new `tool_input_delta` event (`{id, name, partial_json}`) — `anthropic.ts` tracks
  open tool_use blocks by stream index and attributes SDK `input_json_delta` chunks; MockProvider
  scripts them natively.
- **`turn/jsonTextStream.ts`** (~110 LOC, the fiddly piece): incremental extractor for the
  top-level `"text"` field of streamed partial JSON — depth tracking (nested objects like
  `voice_params` skipped), key matching at depth 1 only, full escape handling (`\n`, `\"`,
  `\uXXXX` incl. surrogate pairs) across arbitrary chunk splits. 10 dense unit tests including
  the spike-verified gateway chunk shapes and single-char pathological splits.
- **runTurn `open_stream`**: deltas for `message` blocks feed per-call extractors → emit
  `tool.progress { call_id, tool_name: 'message', payload: { text_delta } }` per fragment;
  drives `firstTokenMs`/`tokenCount` (latency observability parity with text mode). Streaming
  preview and validated delivery are separate tiers: a preview that fails dispatch validation
  ends in `tool.finished{err}` and the consumer discards it (dev chat implements the contract).
  `ToolProgressEvent` gains optional `tool_name` — the Initiative 6 subscription key — and
  dispatcher-tier progress events now carry it too.
- **Empty-reply guard** (Python v0.47.12 lesson): a message-mode `end_turn` with zero successful
  deliveries gets ONE corrective retry as a **user-role** stage direction (v0.27.1 hoisting
  lesson), bounded by `silentRetried`; double-silent → degraded fallback (leaked top-level text
  becomes the reply) + countable `empty_turn` node trace.
- **Dev chat**: message bubbles keyed by `call_id` — created on `tool.started`/first delta,
  appended per `text_delta`, finalized on ok (expression shown as 🎭 chip), removed on err with a
  "重说" chip; paced `delay_ms` segment reveal only when nothing streamed live; `turn.result`
  renders a bubble only when no message bubbles exist this turn (degraded/text-mode path).
- Tests: 162 across 25 files (+14). Real-LLM smoke (the gateway, fresh session): 9 ordered
  `tool.progress` deltas, streamed preview byte-equal to the two delivered bubbles
  (wake-persona greeting), first delta ~5s (thinking latency).

Inference:

- The LD #9 streaming story is now complete end-to-end: token-stream UX inside a validated tool
  envelope, on the real gateway, with the same latency observability as the text baseline. What
  remains for the initiative is policy, not plumbing: run the A/B script and flip the default
  (v0.7.0).

### `v0.6.1` — 2026-06-13 — `message` tool + schema humanity caps (Initiative 3, commit 2 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** `message.ts`: `ExpressionKey` (Python's 15 ALLOWED_AFFECTS verbatim),
  `VoiceParams` (opaque passthrough), `MessageSegment` (`{index, text, delay_ms}` — delay is
  metadata, server never sleeps, amendment A2), `MessageDelivery` (the `tool.finished` payload =
  the delivery contract Initiative 6 consumes). `ToolName` + `'message'`.
- **`tools/builtin/message.ts`**: flat root-object input (v0.5.2 gateway rule) — `text` ≤140
  via `.max()`, ≤4 sentences + ≤55-char clause via `superRefine` over the v0.6.0 CJK splitters
  (amendment A1: `sentences` is NOT a model field; segments derived server-side); `expression`/
  `emotion [0,1]`/`voice_params` optional; `is_final` required. Pacing 28ms/char clamp 120–900
  ported as constants. `concurrency: 'session-serial'` (bubbles arrive in order). Humanity
  enforcement is exactly the recoverable `validation_failed` path — no truncation code exists.
- **Registry**: `ToolRegistry` → `Partial<Record<ToolName, Tool>>` (conditional mount without
  forcing the key everywhere); `messageRegistry = builtin + message`; `isMessageMode(registry)`.
  **Mode's single source of truth is registry content** — `main.ts` reads `LUNA_MESSAGE_TOOL=1`
  once at boot; the turn loop never reads env.
- **runTurn**: system prompt gains the speech directive (calling IS speaking / no top-level
  text / is_final) only in message mode; `dispatch_tools` collects successful message texts;
  `finalize` sets `turn.result.text` to their `\n`-join (stray top-level text stays in
  history/trace as the observable leak signal but never becomes the reply). Dispatcher itself
  untouched — message is a normal tool, which is LD #9's forcing-function point.
- Tests: 148 across 24 files (+15): schema caps (141 chars / 5 sentences / 56-char clause
  rejected, targeted messages), envelope passthrough, pacing clamps, wire-schema regression now
  iterates `messageRegistry`, mode-derivation, two-bubble turn → ordered `tool.finished` +
  concatenated `turn.result`, violation → recoverable err → re-emit wins, flag-off path
  byte-untouched.
- Real-LLM smoke (the gateway, message mode, full runTurn with persona+memory): two bubbles —
  雪的故事 (`soft_warmth`, 0.6, `is_final:false`, 2 segments) then a question
  (`curious_attention`, 0.7, `is_final:true`); `turn.result` = concatenation. **Observed leak**:
  one top-level English aside after the final tool round ("I shared the story…"), correctly
  excluded from the reply — exactly the signal the v0.7.0 A/B counts and the v0.6.2
  directive/guard iteration targets.

Inference:

- LD #9 is now real on the wire: speech is a typed, validated, traced tool action with Live2D
  metadata in the same frame. The model adopted multi-bubble + expression + is_final semantics
  zero-shot from schema descriptions alone, which derisks the v0.7.0 default flip.
- The observed top-level leak confirms the A/B instrumentation works and gives v0.6.2 a concrete
  target: the leak happened on the post-tool round where the model "narrates completion" — the
  empty-reply guard's inverse. Directive tuning, not architecture, is the likely fix.

### `v0.6.0` — 2026-06-13 — Persona foundation (Initiative 3, commit 1 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Persona file** ported from Python `persona.runtime.default.md` (105 lines, near-verbatim) to
  `packages/server/persona/default.md`. One deliberate addition under Hard Runtime Guidance: "Do
  not claim abilities or perceptions you do not actually have right now" — codifies the real-usage
  key_moment where Luna performed capabilities she lacked and was called out.
- **`src/persona/loader.ts`**: mtime-gated hot reload (amendment A5) — `statSync` per call,
  re-read only on change; same-object identity when unchanged (prompt-cache friendly); missing
  file → fallback one-liner + single warning, never a crash. `LUNA_PERSONA_PATH` overrides the
  repo default.
- **`src/persona/humanity.ts`**: caps as TS constants (140/4/55, no JSON config); ported CJK
  splitters — `splitSentences` (`[。！？!?]+|\n+`), `splitClauses` (also breaks on sentence marks,
  a strictly-more-correct divergence from Python's clause-punct-only split); `renderHumanityBlock`
  prose for the system core (guidance tier; Zod enforcement arrives v0.6.1).
- **`src/persona/scene.ts`**: wake scene block (Python turn-0 branch). Injected at MESSAGE level
  into the first user turn after process boot via `Session.wakePending` (in-memory, deliberately
  unpersisted — a restart is a fresh wake). Python's "continuing" turn-1+ framing not ported:
  redundant with the persona file's Memory Condition/Growth sections, and it would have made a
  permanently turn-varying block. System core stays byte-stable across the boot transition.
- **`buildSystemPrompt` assembly order** (one cached block): base directives → persona reference
  (framing line + file text) → embodiment → humanity rules → core memory. **Embodiment rewritten
  truthful**: Python claimed a visible Live2D body; ours states plainly "text chat page, no body,
  no voice yet — planned later; do not claim to be visible or audible" (updates at Initiative 6).
  `LUNA_PERSONA=0` drops persona/embodiment/humanity/scene (memory blocks unaffected).
- Tests: 133 across 22 files (+13): loader identity/reload/fallback; splitter CJK/ASCII/mixed
  cases; runTurn integration — scene block only in first user turn and never in system; persona
  file edit changes system prompt exactly once then stable (byte-compare via MockProvider).
- Real-LLM smoke (the gateway, boot → "你是谁？"): "我是Luna。刚醒过来，脑子里还很空，名字倒是清楚。
  你呢，你是我睁眼看到的第一个人。" — 42 chars, 3 sentences, wake framing + persona voice + cap
  compliance in one reply, zero assistant politeness.

Inference:

- Layer 2 of the three persona layers was already live (core-memory prose from v0.4.2, updated by
  `remember(update_self)` and dream `persona_update`) — this version makes the layering explicit
  and gives it the static substrate (layer 1) and the wake moment (layer 3 → message level).
- The honest-embodiment divergence and the no-capability-claims line are both direct products of
  the 2026-06-12 real-usage session — the memory substrate observing Luna's own failure modes is
  now feeding persona design. That loop (live usage → L3 key_moments → next version's guardrails)
  is exactly what the rewrite was structured to enable.

### `v0.5.2` — 2026-06-12 — Gateway-safe tool schemas (`remember` bug from first real usage)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Bug (user-reported, confirmed in trace data):** every real-usage `remember` call failed with
  `validation_failed: invalid_union_discriminator` (turns 1 and 6, 2026-06-12 16:54/17:01).
  L2 archive showed the model's arguments arriving wrapped as `{"_noargs": "<raw args text>"}` —
  a key that exists nowhere in this repo or the SDK. Root cause: `remember`'s input was a Zod
  `discriminatedUnion`, whose wire schema is a **root-level `anyOf` with no top-level
  `properties`**; the gateway treats such tools as argument-less and wraps whatever the
  model emits under `_noargs`. The upstream model also never saw the real field names (one call
  used `content` instead of `text`). `read_file` (plain object schema) was untouched in the same
  sessions — and the dream cycle's `memory_audit` step quietly compensated by adding 5 facts the
  failed `remember` calls had attempted.
- **Fix 1 — flat input schema** (`tools/builtin/remember.ts`): `action: z.enum(...)` + optional
  per-action fields with `describe()` hints, per-action requirements enforced in `superRefine`.
  Wire schema is now a flat root-level object; runtime and wire contracts agree exactly (no
  strict-variant mismatch a flattening shim would have introduced). Wrong-field-name calls now
  fail with a targeted recoverable issue (`text: required for action="add"`) instead of a union blob.
- **Fix 2 — defensive unwrap** (`provider/anthropic.ts` `unwrapGatewayInput`, exported + unit
  tested): a `{"_noargs": "<json>"}` single-key input is unwrapped to the parsed object when the
  raw text is a JSON object; anything else passes through for tool validation to reject
  recoverably. Applied only to dispatch `toolUses`; `assistantContent` stays verbatim in history
  (signed thinking blocks).
- **Fix 3 — cap error recoverable** (`tools/dispatcher.ts`): `concurrent tool cap exceeded` was
  `recoverable: false`, telling the model not to retry calls it can simply re-issue next round
  (hit in real usage, turn 25: 9 parallel `read_file`). Now `recoverable: true`.
- **Regression guard** (`runTurn.test.ts`): every builtin tool's `toolsToAnthropicFormat` schema
  must be a root-level `type: "object"` with `properties` and no `anyOf`/`oneOf`/`allOf`.
- Tests: 120 across 21 files (+7). Live gateway smoke: "please remember two facts about me" → two
  clean `remember` tool_use calls (`action:"add"`, correct `text`/`category`/`confidence`),
  both validate PASS, no `_noargs`.

Inference:

- First bug found **by the observability + memory substrate doing their job**: the trace table
  pinpointed the failing call and the L2 verbatim archive preserved the mangled input — exactly
  the "memory bugs are traceable from day one" payoff the roadmap ordered Initiative 1.5 before 2 for.
- Locks a wire-contract rule for everything-as-tool (LD #9): **tool input schemas must be flat
  root-level objects** — discriminated unions stay a runtime-validation pattern, never a wire
  shape. The v0.6 `message` tool schema already satisfies this; the regression test makes it
  permanent.

### `v0.5.1` — 2026-06-12 — Dev chat page `/_chat`

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/devchat/` — `devchat.ts` (handler: `/_chat` → static HTML, null
  fall-through; same shape as the trace viewer, mounted behind the same `LUNA_VIEWER` gate)
  and `devchat.html` (~200 LOC vanilla): streaming chat bubbles over the existing WS protocol
  (`chat.send` → `turn.started`/`reply.token`/`turn.result`), tool chips, 🌙 入梦 / ☀️ 唤醒
  buttons (`dream.enter`/`dream.wake`), dream-step chips, dreaming-state input lock,
  auto-reconnect, link to `/_trace`. Zero new wire events — pure consumer.
- Tests: 113 across 20 files (+2). Boot smoke: `/_chat` 200 with content, `/_trace` 200, WS ping ok.

Inference:

- First **usable** conversation surface — the owner can now actually live with Luna's memory
  (the "manual dream proven in use" staging both Python and the TS roadmap call for) without
  waiting for Initiative 6's real frontend. Explicitly a dev page: the Live2D `agent-app`
  port at v0.12 is unaffected and remains the product surface.

### `v0.5.0` — 2026-06-12 — Dream engine (Initiative 2 capstone)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`graph.ts` generalized** (`runGraph<S, N extends string>`; `NodeFn` returns `N | 'end'`)
  — type-level only, turn loop unchanged (`TurnNode` 6-union + `NodeName` alias). The dream
  cycle is a **second StateGraph** on the same runner, not a bespoke pipeline.
- Wire contract: `ClientEvent` += `dream.enter` / `dream.wake`; `ServerEvent` +=
  `dream.status` / `dream.step {step, status, detail}`; `chat.send` while dreaming →
  `error{code:'dreaming'}` (reject, never interleave).
- `enter_dream` tool added (`ToolName` → 4): **pending-intent only** — sets
  `session.pendingDream`; the ws layer starts the cycle strictly after the triggering
  turn's `turn.result` (closes Python's tail-race where the daemon thread started inside
  tool execution).
- `dream/` (5 files, ~600 LOC): `dreamState.ts` (module-state gate + SQLite write-through;
  `finished_idle` parked semantics — completed cycle keeps `is_dreaming=true` until an
  explicit wake; **boot reconciliation** marks crash-stale cycles aborted and parks awake),
  `cycle.ts` (six DreamNode steps: refine_semantic → refine_layer1 → memory_audit →
  persona_update → run_diaries → rag_refresh; traces under `dream:<cycle_id>` with
  **per-step flushes**; per-step `DreamReport` records persisted to `dream_reports`),
  `llm.ts` (two-attempt summarizer→default key cascade as **two provider instances**;
  failure classification incl. the gateway's Chinese rate-limit strings; Zod `MemoryPatch` /
  `PersonaPatch` JSON-block parsing), `prompts.ts` (natural-language section headers —
  **no `<<<>>>` delimiters**, the Python v0.56.1 content-filter lesson, test-asserted).
- `migrations/0006_dream.sql`: `dream_state` (seeded single row), `dream_reports`,
  `diaries` (day/week/month, `UNIQUE(kind, period_key)`). Diary tiers: day → week rollup
  (complete week groups), capped by `LUNA_DREAM_MAX_DIARIES_PER_CYCLE` (20).
- Reconciliation = supersede via the v0.4.2 stores: `memory_audit` soft-forgets stale ids +
  adds replacements; `persona_update` writes prose core memory with source `'dream'`.
- `main.ts`: dream LLM cascade built from `LUNA_SUMMARIZER_API_KEY` (+ fallback to the
  main provider); `bootReconcile()` at startup. Test preload now also forces
  `LUNA_MEMORY_EMBEDDING=0` ambiently — unit tests can never hit the network via the
  auto-loaded `.env` (suites opt back in with fake clients).
- Tests: 111 across 19 files (was 102). New dream suite (9): gate + wake lifecycle ·
  double-enter/early-wake rejection · **planted-contradiction reconciliation (exactly one
  active fact survives, old one soft-deleted)** · day+week diaries · persona update with
  dream-source audit · key cascade + delimiter-absence · per-step trace durability ·
  pending-intent (no dream activity before `turn.result`) · boot reconciliation.
- Real-LLM smoke (full cycle ×2): built memory in chat → `dream.enter` → six steps ran
  (`persona_update:ok / run_diaries:ok / rag_refresh:ok`; `memory_audit` reconciled when
  given material — and on one run was correctly `skipped` because Luna had **already
  self-reconciled live** via the remember tool) → `chat.send` while parked → `dreaming` →
  wake → coherent replies. DB evidence: a real first-person diary row ("Today we finished
  the dream engine. After all the back-and-forth, the false starts…"), dream-updated
  `self_state` + `relationship_status`, parked `dream_state`, full step report.

Inference:

- **Initiative 2 (memory + dream substrate) is complete.** Luna now has the full loop her
  positioning requires: she remembers (L3 + core), recalls by meaning (hybrid), survives
  restarts (L1/L2), and consolidates offline (dream) — with the live hot path making zero
  synchronous memory LLM calls and the prompt cache surviving by construction.
- The isolation contract is stricter than Python's in two places (pending-intent trigger,
  boot reconciliation) and equal where Python's hard-won fixes mattered (content-filter
  prompts, key cascade) — the audited "port the lessons, not the accidents" line held.
- Deviation from plan, documented: the pending-dream check lives in `ws.ts`'s post-turn
  continuation rather than `runTurn`'s finally — same semantics (strictly post-finalize),
  cleaner emit reuse, no dream import inside the turn loop.

### `v0.4.3` — 2026-06-12 — Hybrid recall (sqlite-vec + CJK lexical)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Spike first** (`scripts/spike-sqlite-vec.ts`): `Database.setCustomSQLite` + sqlite-vec
  0.1.9 load + vec0 KNN verified live on this machine — PASS, vec0 primary path GO.
- Added `memory/recall/` (4 files, ~330 LOC): `vecRuntime.ts` (guarded `initCustomSqlite` —
  process-global, once, before any Database; `tryLoadVec` with remembered failure),
  `embed.ts` (~60 LOC fetch client for OpenAI-compatible `/v1/embeddings` — deliberately
  NOT the cut `openai_compat` adapter; batch ≤64; f32-LE BLOB layout shared by vec0 and the
  TS path; sha256 `contentHash`; `cosine`), `lexical.ts` (ASCII words + **CJK sliding
  bigrams** + stopwords, ported approach from Python `semantic_retrieval`), `recall.ts`
  (`retrieve` = hybrid 0.7·cosine + 0.3·lexical + recency boost over L2 tail + live L3
  facts; soft-deleted excluded; embedding outage → lexical-only; `MAX_EMBED_PER_TURN=64`
  cold-cache cap until dream's `rag_refresh`; `renderRecallBlock`).
- vec0 virtual table (`vec_cache`) is **derived data created lazily at runtime** keyed to
  `embeddings_cache.rowid` — migrations must not depend on a loadable extension.
  `0005_embeddings.sql` ships only the regular `embeddings_cache` table. Embedding-only
  vec0 columns (the #274 metadata-col bug avoidance).
- `runTurn.parse_input`: recall block injected as a `<memory>` text block **inside the user
  message** (message level, after the cached prefix); user turns persist as-sent.
  `bunfig.toml` gains `[test] preload` (`test-preload.ts` → `initCustomSqlite` before any
  test constructs a Database). `main.ts` calls `initCustomSqlite()` before `openDb`.
- Env: `LUNA_EMBEDDING_MODEL` / `LUNA_EMBEDDING_API_KEY` / `LUNA_EMBEDDING_BASE_URL`
  (+ `.env.example`), `LUNA_MEMORY_RETRIEVAL_K` (12), `LUNA_MEMORY_EMBEDDING` (=0 →
  lexical-only, zero API).
- Tests: 102 across 18 files (was 93). New recall suite (9): CJK bigram tokenize · Chinese
  lexical no-API · paraphrase semantic hit (deterministic fake embed client) · hash-cache
  no-re-embed · recency tie-break · soft-deleted excluded · renderRecallBlock · **system
  prompt byte-identical across different queries** (recall is message-level — the cache
  invariant holds).
- Real-API smoke: "what preference did I mention?" hit the stored-preference L2 row with
  **zero shared keywords** (true semantic match via text-embedding-3-large, 3072-dim);
  `embeddings_cache` 3 rows + `vec_cache` 3 rows (vec0 live in production code).

Inference:

- Luna can now recall by meaning, in two languages, with a graceful degradation ladder:
  vec0 KNN → TS cosine over the same BLOBs → pure CJK/ASCII lexical — each step a silent
  fallback, no configuration coupling.
- The cache invariant survived its hardest test: per-query retrieval content rides the
  user message; the system prompt never varies with the query. TS goal #1 (latency via
  prefix cache) and Luna's memory coexist by construction.

### `v0.4.2` — 2026-06-12 — L3 semantic store + prose core memory

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Protocol: `L3Category` (5 Python-parity categories), `L3Confidence`, `L3Fact`
  (with `deleted_ms` + `expires_ms`), `CoreMemory` (prose `self_state` +
  `relationship_status`). `migrations/0004_l3_core.sql`: `l3_facts` (+ category/dedup
  indexes), `core_memory` (single row, seeded), `core_memory_audit` (append-only).
- `memory/l3Store.ts` (~90 LOC): `addFact` (punctuation-normalized `dedupKey` port of
  Python's `_dedup_key`; prefixed ids `cf_/pf_/km_/at_/pc_`; `active_threads` get a
  14-day TTL), **`forgetFact` = soft delete** (`deleted_ms`, never removes the row — the
  deliberate divergence from Python's hard-delete `ForgetTool`), `listFacts` with
  **`asOf` time-travel** (deleted facts visible when valid at that time).
- `memory/coreMemory.ts`: `getCore` / `updateCore` (audit-first: prior state recorded
  before every write) / `restore(n)`. Prose only — no 5-field structure, no consistency
  tripwire (the owner's decision E + kept-undo compromise).
- `memory/renderCoreBlock.ts`: the **stable** memory prefix (core memory + per-category
  render-capped facts with `[id]` handles + a one-line remember-tool hint). Deterministic
  — no timestamps. Render caps = Python's storage caps (15/10/12/6/8); storage stays
  unbounded until dream prunes.
- `remember` tool rewritten: discriminated `action: add | forget | update_self` input
  (the cut-list's four-tools-into-one, final shape), SQLite-backed via the seam,
  `session-serial`; unconfigured seam → structured err, never a throw.
- `runTurn`: `buildSystemPrompt(session)` composes `[placeholder + core block]` as
  `TextBlockParam[]` with a **`cache_control: ephemeral` breakpoint**;
  `ProviderRequest.system` widened to `string | TextBlockParam[]`; user turns now persist
  as content-block arrays (as-sent fidelity, ready for v0.4.3's message-level recall
  block); `complete()` gains adaptive thinking.
- Env: `LUNA_MEMORY_INJECT` (default on). Test fixtures switched to real `migrate()`.
- Tests: 93 across 17 files (was 84). New: l3 suite (7 — soft-delete + asOf, dedup +
  re-add-after-forget, TTL, audit + restore, render determinism, **byte-identical system
  prompts across no-change turns / differing after a change**), remember suite rewrite (5).
- Manual smoke (real LLM): "remember my project codename is Halcyon" → model called the tool,
  **chose `core_facts` itself**, L3 row landed; restart → "What is my project codename?" →
  **"Halcyon"**.

Inference:

- Luna now has self-managed durable memory with the prompt-cache invariant enforced by
  test: the system prompt changes only when memory changes. The `[id]` handles in the
  rendered block are what lets the model `forget` precisely — the supersede loop
  (forget old + add new) is now mechanically possible for both the model (live) and
  dream's `memory_audit` (v0.5.0, bulk).
- Soft-delete + `asOf` makes "this was once true" a first-class query — the time-travel
  substrate dream reconciliation and future temporal reasoning both stand on.

### `v0.4.1` — 2026-06-12 — L1 rolling window

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/memory/l1Window.ts` (~110 LOC): `buildActiveContext` (bounded
  view sent to the model — `[<conversation_summary> user message?] + history.slice(lowWater)`;
  `session.history` itself is never truncated), `planFold` (chooses **whole L2 turns** so the
  fold boundary always lands at a turn start, never splitting tool_use/tool_result pairs;
  fold input comes from L2 `user_text`/`assistant_text` columns — never from
  `rollingSummary`), `maybeFold` (**async fire-and-forget**, scheduled in `runTurn`'s
  finally after trace flush; CAS-committed).
- `migrations/0003_l1_window.sql`: `sessions` += `rolling_summary`, `window_low_water`.
  `sessionStore.commitFold` appends the summary chunk via SQL `||` concat with
  `WHERE window_low_water = :expected` — CAS failure = `changes === 0`, fold discards.
- `Provider` interface gains **`complete(req): Promise<{text, usage}>`** (non-streaming;
  shared by this fold and v0.5.0's dream): `AnthropicProvider.complete` via
  `messages.create`, constructor gains optional `apiKey` (dream's key cascade = two provider
  instances); `MockProvider` gains `completeResponder` + request capture.
- `runTurn.open_stream` now sends `buildActiveContext(session)` instead of raw history.
- Env: `LUNA_L1_WINDOW` (default on), `LUNA_L1_KEEP_MSGS` (24), `LUNA_L1_FOLD_BATCH_MSGS` (12).
- Tests: 84 across 16 files (was 78). New l1Window suite (6): bounded@40turns ·
  **no-re-compression invariant** (second fold input excludes the first summary's marker
  text) · deterministic plan from same L2 · `LUNA_L1_WINDOW=0` passthrough ·
  fold-never-blocks (gated in-flight fold + live turn completes; fold lands after) ·
  CAS stale-fold discard (fast fold wins, slow fold returns false).

Inference:

- **The compression-drift trap is structurally closed**: summaries only ever grow by
  appending chunks derived from verbatim L2 text; existing summary text is never an input
  to summarization. The hot path keeps zero synchronous memory LLM calls (the fold runs
  post-`turn.result`) — both audited TS-line constraints hold by construction, with tests
  guarding each.
- Corrects the Python port hazard flagged in the roadmap audit: Python ran its fold in an
  aux thread pool, and the async property was nearly lost in translation. Here it is
  explicit, CAS-protected, and test-pinned.

### `v0.4.0` — 2026-06-12 — Memory substrate foundation

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/protocol/src/memory.ts` (Zod `L2Turn` + `SessionRow`) and
  `packages/server/src/memory/sessionStore.ts` (~100 LOC): `setMemoryDb()` injection seam
  (mirrors `setTraceStore` — unset → all functions no-op, existing test suites run unchanged),
  `loadSession` / `persistSession` (upsert) / `appendL2` / `listL2`.
- **Migrations unified into one shared dir** `packages/server/src/migrations/`:
  `0001_traces.sql` moved from `trace/migrations/` (number is the identity — path is never
  recorded, so existing DBs are unaffected), new `0002_memory.sql` (`sessions`, `l2_turns`
  + `(session_id, t_ms)` index). `migrate()` now throws on duplicate migration numbers
  (they would otherwise be silently skipped). Trace test fixture paths updated.
- `session.ts` hydrates from SQLite on first `getSession` when the seam is set; `Session`
  gains `pendingDream: string | null` (reserved for v0.5.0). `runTurn` snapshots history
  length at turn start and persists the turn's full as-sent slice to L2 (`raw_json`) +
  upserts the session in its `finally` — signed thinking blocks survive restarts verbatim.
- **Mutex unification (audit finding H)**: deleted `dispatcher.getSessionMutex` (the second,
  parallel per-session mutex map); both ws paths (`chat.send` and `dev.dispatch_tool`) now
  feed `DispatchContext.sessionMutex` from the single `getSession(id).mutex`.
- Env: `LUNA_PERSIST` (default on; `=0` keeps sessions in-memory). Wiring in `main.ts` only.
- Tests: 78 across 15 files (was 73). New: sessionStore (4 — restart-survival incl. signed
  thinking + tool_use round-trip, L2 ordering + raw_json fidelity, ephemeral seam, upsert),
  sql duplicate-number throw.
- Manual smoke (real LLM, two boots, one DB): told her the owner's name, killed the server,
  rebooted, asked "What is my name?" → **the owner name**. DB after: schema v2, `turn_seq=2`, 2 L2 rows.

Inference:

- **Luna survives restarts** — the foundational property of Initiative 2, proven end-to-end
  against the real gateway. History persists as the exact Anthropic content blocks the model
  produced (signature validation keeps working on resumed conversations).
- Collapses Python v0.52 (single-writer) + v0.53 (full-text archive) into one version:
  SQLite WAL + the unified session mutex give single-writer structurally, with no lock
  machinery to port.
- L2 is now the ground-truth corpus that v0.4.1's fold derives from, v0.4.3 embeds, and
  v0.5.0's diaries summarize — everything downstream reads from here.

### `v0.3.6` — 2026-06-11 — Local trace viewer

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/trace/viewer.ts` (~45 LOC): `traceViewerHandler(req, store)`
  returns a `Response` for `/_trace` (static HTML), `/_trace/api/turns?limit=`,
  `/_trace/api/events?turn_id=` (parses `payload_json` on the way out), or `null` for
  non-`/_trace` paths so the caller falls through to the WS upgrade. Read-only; shares the
  boot `Database` via the trace store (no second connection).
- Added `packages/server/src/trace/viewer/index.html` (~210 LOC, vanilla — no framework, no
  build step): two-pane layout (turn list / per-turn timeline), color-coded event kinds
  (node / tool / outbound / overflow), `+Nms` relative offsets, click-to-expand
  `payload_json`, 2s auto-refresh.
- `main.ts`: composes the fetch handler **before** `Bun.serve` — viewer handler first (when
  `LUNA_VIEWER !== '0'`), then WS upgrade, then 426. `getTraceStore()` added to instrument
  for the shared-store reference.
- **`LUNA_TRACE` default flipped on**: `traceEnabled()` now returns true unless
  `LUNA_TRACE === '0'` (v0.3.5 was opt-in `=== '1'`). Tracing is on by default now that a
  viewer makes it useful.
- Tests: 73 across 14 files (was 68). New: viewer (5 — HTML 200, turns newest-first, events
  parsed/ascending, unknown subpath 404, non-`/_trace` → null). `instrument.test.ts` updated
  for the default-on semantics (explicit `LUNA_TRACE=0` opt-out test).
- Manual smoke: real LLM turn (tracing on by default) → `/_trace` serves HTML, turns API
  shows the 22-event turn, events API returns node:9 / outbound:11 / tool:2; WS ping/pong
  unaffected with the viewer mounted; `LUNA_VIEWER=0` makes the server WebSocket-only
  (`/_trace` → 426).

Inference:

- **Initiative 1.5 (observability foundation) is complete.** Luna now has the
  Mastra-Telemetry / LangSmith-equivalent layer the roadmap placed deliberately *before*
  memory (v0.4): every turn is a replayable, browsable event tree. Memory bugs that ship in
  v0.4+ now have a timeline to debug against instead of being a black box.
- The viewer's left-list / right-detail shape is a candidate pattern for a v0.12 frontend
  debug overlay, but nothing downstream hard-depends on it yet.
- Deliberate divergence from the plan's acceptance: `LUNA_VIEWER=0` yields **426** (the
  server becomes genuinely WebSocket-only — the viewer handler is bypassed entirely) rather
  than 404. 426 is the more honest signal; the handler's own 404-for-unknown-subpath
  contract is still unit-tested.

### `v0.3.5` — 2026-06-11 — Trace plumbing

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/protocol/src/trace.ts` (~70 LOC): Zod `TraceEvent` discriminated
  union — `node` / `tool` / `outbound` / `overflow`, each carrying `schema_v: z.literal(1)`,
  `trace_id`, `turn_id`, `session_id`, `t_ms`. `TRACE_SCHEMA_V = 1`.
- Added `packages/server/src/sql.ts` (~50 LOC): generic `bun:sqlite` boilerplate —
  `openDb` (WAL + foreign_keys + busy_timeout per connection), `migrate(db, dir)`
  (applies `migrations/NNNN_*.sql` whose leading integer exceeds `PRAGMA user_version`,
  each in its own transaction; PRAGMA bump interpolated since PRAGMA can't bind),
  `closeDb`. **Zero trace-specific code — v0.4 memory substrate reuses it verbatim.**
- Added `packages/server/src/trace/` — `migrations/0001_traces.sql` (DDL + 2 indexes,
  no PRAGMA), `store.ts` (per-turn in-memory buffer, single-transaction flush on turn
  end, 500-event cap + `overflow` row, 4KB structured-wrapper truncation, read API
  `listTurns` / `getEventsByTurn`), `instrument.ts` (`trace()` single entry, `LUNA_TRACE`
  gate — default off in v0.3.5), `README.md` (instrumentation + migration discipline).
- Instrumented `runTurn.ts`: `onTransition` → node trace (the `open_stream` transition
  carries `{token_count, first_token_ms, thinking_summary}`); `dispatch_tools` loop tees
  each `ToolEvent` → tool trace; a `tracedEmit` wrapper records every `ServerEvent` as an
  outbound trace; `flushTrace` in the `finally`. **All three construction sites guarded by
  `traceEnabled()`** so the production default-off path builds zero discarded objects.
  Shipped `dispatcher.ts` and `outbound.ts` untouched.
- `main.ts`: opens SQLite at boot (`LUNA_DB_PATH`, default `./luna.sqlite`), runs
  `migrate`, sets the trace store, closes DB on SIGTERM. `.gitignore` += `*.sqlite*`.
- Tests: 68 across 13 files (was 57). New: sql (4 — migration idempotency/ordering/WAL,
  tmpdir), store (5 — buffer/flush/overflow/4KB-truncation/listTurns ordering),
  instrument (2 — full-turn node+tool+outbound rows keyed by turn_id, gate-off → no rows).
- Latency: per-turn absolute trace cost 0.15–0.5ms on a network-free synthetic bench
  (`scripts/trace-latency.ts`). End-to-end smoke: a real LLM turn wrote 24 rows
  (9 node + 13 outbound + 2 tool) under one turn_id.

Inference:

- **First persistence layer in the rewrite.** The `sql.ts` WAL + versioned-migration
  pattern is the one v0.4 memory work copies — getting it generic and reusable here means
  the SQLite substrate lands once, not twice.
- **Partially resolves Open Q #8**: every turn now carries a `trace_id` (= turn_id) and a
  replayable event tree. The full L1/L2 reasoning-decision tree is still deferred to v0.8,
  but the plumbing it will hang off now exists.
- **Resolves Open Q #4**: trace `payload_json` truncates at 4KB into a structured
  `{truncated, original_bytes, preview}` wrapper (never a byte-slice of serialized JSON).
  The dispatcher keeps pure per-tool `summarize` with no global tripwire — the locked
  direction from v0.2 holds.
- The synthetic-bench 5% gate from the plan was a measurement artifact (network-free turns
  run in ~5ms, so sub-ms persistence reads as 6–8%); the production-meaningful bound is the
  absolute per-turn cost, which against real 1000ms+ turns is <0.05%. The bench asserts the
  absolute budget and reports the synthetic % for transparency.

### `v0.3.0` — 2026-06-11 — Anthropic interleaved tool-use end-to-end

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/provider/` (3 files, ~140 LOC): `types.ts` (`ProviderEvent`
  union — `text_delta` / `thinking_delta` / `tool_use_start` / `message_stop` carrying
  `stopReason` + `toolUses` + verbatim `assistantContent` + usage), `anthropic.ts`
  (`AnthropicProvider` over `@anthropic-ai/sdk@0.104.1` exact-pinned; `messages.stream()`
  raw-event mapping; tool inputs taken from `finalMessage().content` — **no**
  `input_json_delta` accumulation; `maxRetries: 2` explicit), `mock.ts` (scripted rounds,
  per-request message snapshot).
- Added `packages/server/src/turn/` (3 files, ~280 LOC): `graph.ts` (inline 7-node
  StateGraph — `parse_input → build_request → open_stream → dispatch_tools →
  append_results → finalize → end`; `runGraph` with `onTransition` hook reserved as the
  v0.3.5 instrumentation seam), `session.ts` (in-memory `Session` with history /
  turnSeq / activeTurn / mutex; `'default'` id), `runTurn.ts` (node implementations;
  `MAX_TOOL_ITERATIONS = 8`; `zod-to-json-schema` with `$refStrategy: 'none'` for tool
  definitions; assistant content appended verbatim so signed thinking blocks survive;
  unknown tool names short-circuit to `tool_not_found` without dispatching).
- Extended wire contract: `ClientEvent` += `chat.send {turn_id?, text}`; `ServerEvent`
  += `turn.started`, `reply.token`, `turn.result {text, finish_reason, usage}` with
  `FinishReason` enum (`end_turn | max_iterations | max_tokens | refusal | error`).
- `ws.ts` gained the `chat.send` branch: one active turn per session
  (`turn_in_progress` error), `runtime_not_configured` guard, emit wrapper that
  swallows dead-socket sends so mid-turn disconnect cannot abort tool execution.
- `main.ts` constructs `AnthropicProvider` + `builtinRegistry` at boot when
  `ANTHROPIC_API_KEY` is set. Env: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`,
  `LUNA_MODEL` (default `claude-opus-4-8`), `LUNA_MAX_TOKENS` (default 8192).
  `.env.example` committed; real `.env` gitignored (values copied from Python Luna).
- Provider config: api.anthropic.com gateway verified by an early 2-round smoke
  (`scripts/smoke-gateway.ts`) — adaptive thinking with `display: 'summarized'` accepted,
  signed thinking blocks survive the tool_result round-trip, tool_use streams.
- **Deliberate divergence from Python**: Python Luna uses
  `LUNA_THINKING_BUDGET_TOKENS=2048`; `budget_tokens` returns 400 on `claude-opus-4-8`.
  TS uses `thinking: {type: 'adaptive', display: 'summarized'}`.
- Tests: 57 across 11 files (was 49). New: runTurn (6 — spec tests 1-6 incl.
  interleaving proof, iteration cap, dead-socket resilience, mid-stream provider
  failure), chat.send WS round-trip (2). Manual smoke: real dual-tool turn
  (`time_now` + `read_file`) over WS — 32 streamed tokens, 2 tool cycles, coherent
  reply, `finish_reason: end_turn`.

Inference:

- **Initiative 1 (tool spec foundation) is complete.** All six Python tool-instability
  root causes are now structurally closed: single always-mounted registry (no 5-path
  mount logic), 3-tool closed surface, discriminated `Result<T>` (no `startswith`
  heuristics), token streaming continues through tool calls (the perceived-latency win
  the rewrite was started for), typed wire contract end-to-end, hard iteration cap
  instead of reactive stall rules.
- The StateGraph shape means v0.3.5 instrumentation is one `onTransition` wire-up, v0.6
  `message_tool` swap is one node change, and v0.8/v0.10 insert nodes mechanically —
  the LangGraph-style orchestration alignment is now in code, not just on the roadmap.
- Verbatim `assistantContent` in history is load-bearing: reconstructing thinking
  blocks from deltas would break Anthropic's signature validation on the next request.
  The early gateway smoke de-risked this before the graph was built on top.

### `v0.2.0` — 2026-06-11 — Typed tool registry + `Result<T>`

Status:

- working tree (commit hash filled in after merge to main)

Fact:

- Added `packages/protocol/src/tools.ts` (~60 LOC): Zod schemas for `ToolName` (closed
  enum: `time_now | read_file | remember`), `ToolErrorCode` (5 variants), `ToolResult`
  (discriminated `ok` / `err`), `ToolEvent` (discriminated `started` / `progress` /
  `final`), `ToolCall`. All exported types via `z.infer`.
- Extended `packages/protocol/src/events.ts`: `ClientEvent` gained
  `dev.dispatch_tool { call_id, tool_name, input }` (dev-only). `ServerEvent` gained
  `tool.started`, `tool.progress`, `tool.finished`.
- Added `packages/server/src/tools/` (10 files, ~530 LOC): `defineTool.ts` (ToolSpec generic
  factory → concrete Tool interface), `registry.ts` (`Record<ToolName, Tool>` builtin
  registry), `dispatcher.ts` (concurrency grouping + AbortController + manual `iter.next()`
  race + `iter.return()` cleanup + output schema validation + `data ?? null` serialize +
  `MAX_CONCURRENT_TOOLS_PER_SESSION = 8` backstop), `mutex.ts` (FIFO async mutex with
  `AbortSignal`-aware `acquire`), `mergeAsync.ts` (source-tagged sparse-array merger with
  per-iterator catch + `return()` propagation), `README.md` (tool author contract).
- Added 3 representative tools (`builtin/`): `time_now` (safe-parallel, instant),
  `read_file` (safe-parallel, `Bun.file().text()` with ENOENT → recoverable error,
  32KB truncation), `remember` (session-serial, in-memory `Map<sessionId, Item[]>`
  keyed by session).
- Updated `packages/server/src/main.ts` + `ws.ts`: WS data slot typed as
  `{sessionId: string}` (preparation for v0.4 sessions). `ws.ts` adds `dev.dispatch_tool`
  branch gated on `LUNA_DEV_TOOLS=1` that forwards dispatcher events as
  `ServerEvent.tool.*` through the existing `outbound()` boundary.
- Test count: 49 across 9 files (was 12 in v0.1.0). New: tools (8), mutex (4), mergeAsync
  (3), dispatcher (8), time_now (2), read_file (2), remember (3), dev.dispatch_tool
  round-trip (2). Suite green in ~300ms.
- TypeScript `tsc --noEmit` clean on both packages. Two intentional `any` in
  `defineTool.ts` Tool interface (with paired WHY comment) for generic-invariance
  bivariance; no `as any`, no `as unknown`, no `@ts-ignore`. One `@ts-expect-error` in
  dispatcher.test.ts for the unreachable `tool_not_found` path (annotated).
- Manual smoke against `LUNA_DEV_TOOLS=1 bun run dev:server`:
  `dev.dispatch_tool{tool_name:'time_now'}` → `[tool.started, tool.finished]` with
  `result.kind='ok'` and valid `iso` field.

Inference:

- **Establishes the tool contract for everything downstream.** v0.3 (LLM-driven dispatch),
  v0.4 (memory tools touching SQLite), v0.6 (`message_tool` per LD #9), v0.8 (reasoning-rail
  tools) all sit on this shape. The `defineTool` generic factory gives per-tool I/O type
  inference; the concrete `Tool` interface allows heterogeneous registry storage; the
  dispatcher's runtime Zod safeParse guarantees the wire contract.
- **Fixes 4 of the 6 Python tool-instability root causes by design.** No 5-path mount logic
  (always-on registry); no 56-tool surface (closed 3-tool surface, grows to 10); no
  `startswith('Error')` heuristic (discriminated `Result<T>` with structured `ToolErrorCode`);
  no buffered tool-turn (async generator yields stream through `mergeAsync`). The remaining
  2 (no verifier loop, reactive stall detection) are v0.3+ concerns.
- **Resolves Open Q #1 + Open Q #5.** Q1 → new Locked Decision #10 (shell tool always-on +
  deny-regex per Mastra/LangGraph parity; no `mountedWhen` field on `defineTool`). Q5
  confirmed locked at 3-state `concurrency` enum at v0.2 design review.
- **Forecloses v0.6 `message_tool` introduction without contract change.** v0.2's `output:
  z.ZodTypeAny` accepts `z.null()` for void-returning tools; the `concurrency` enum already
  includes `session-serial`; `execute: async function*` is exactly the streaming shape
  Anthropic's `input_json_delta` will hook into. v0.6 is a pure add of one tool, not a
  contract revision.
- **First load-bearing dispatcher correctness fix found in testing**: the original design
  returned from `runOne` immediately after the terminal event, abandoning the tool's
  async generator without giving its `finally` block a chance to run (session-serial test
  3 had `maxActive=3` instead of `1`). Fixed by `await iter.return()` in dispatcher's
  finally, with a 100ms grace race on the abort path. Tool authors get reliable cleanup
  semantics; the abort discipline is documented in `packages/server/src/tools/README.md`.

## Pre-history (2026-06-11)

- 11:28 — Empty repo cloned to the project directory.
- ~12:10 — Multi-agent ground-truth audit of Python Luna v0.47.9 completed (32 agents, 15 dimensions).
- 13:xx — Design conversation locked Bun / WS / SQLite / single-user / Anthropic interleaved tool-use / 10-tool surface.
- Late afternoon — Docs scaffolding (`README.md`, `docs/`, `roadmap/`, `REWRITE_CONTEXT.md`, this file) created.

Nothing else exists in this repo yet.
