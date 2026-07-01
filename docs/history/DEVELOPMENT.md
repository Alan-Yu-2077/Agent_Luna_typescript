# Agent_Luna (TypeScript) — Development History

Last updated: 2026-07-01 (Asia/Shanghai) — v0.23.5 (**persona fix — kill the assistant-filler closer tic**: live L2 caught Luna padding *reactive* replies with hollow check-in bait ("Still here — what's on your mind?" / "Talk to me" / "What's wrong?") — **model-generated** (absent from all TS + Python source, not a hardcoded fallback), 11 of the recent 237 turns, once *while Alan was complaining she sounds like a robot* (`turn:236`); root cause = the anti-查岗 constraint lived only on the **proactive** path and the persona file's abstract "no assistant patterns" didn't hold. `renderHumanityBlock()` — the cached "How you speak" block (`runTurn.ts:137`) — gains a **concrete** rule: names the banned closers (+ 在吗/还在吗), grants "a reply can simply end", makes her mirror a thin OwO/lol *lightly* rather than inflating it into a probing/status question, while keeping genuine specific curiosity. +1 test; persona 14 green, `tsc` clean; **restart-gated** (system block memoized per process). branch) · v0.23.4 (**OpenAI hardening** — remediates the post-ship audit PR #8 of Initiative 16, *before* the first live OpenAI run: forces a `tool_use` stop on the **default buffered path** when tool_calls are present (the audit's cleanest bug — orphaned `tool_use` 400s the next request; the SSE path already guarded it); **config dead-on-arrival** fixes — base-URL no longer falls back to `ANTHROPIC_BASE_URL` (no `/v1`-drop 404, no bearer key to the Anthropic host), the factory is the single source of the wire model (log no longer lies), `NaN`-guarded `LUNA_MAX_TOKENS`; **tolerant parsing** — `safeParse` skip-bad-chunk, synthesized `call_<index>` tool ids, in-band error-frame detection; **`tool_choice:'required'`** so a GPT model can't bypass the message tool; retry parity + `complete()` `reasoning_effort:'low'`; error-body redaction, SSE reader cleanup + size cap, registry `id.min(1)`. Adversarially reviewed (4 findings, 0 confirmed). +9 tests; 883 green, `tsc` ×3 clean, branch) · v0.23.3 (Initiative 16 **✅ CLOSED** 4/4 — **OpenAI-protocol adapter: model registry**: a `provider/registry.ts` resolves `LUNA_MODEL` → a `ModelEntry` (protocol + per-model quirks: `tokenParam` `max_tokens`/`max_completion_tokens`, `system`/`developer` role, `reasoning`, `toolUse`), built-ins (claude → anthropic; gpt-/o-series → openai) + a `LUNA_MODELS_JSON` override so a new model needs no code change. `providerFor()` is registry-driven (`LUNA_PROVIDER` forces the protocol); `OpenAIProvider` takes the entry and threads the quirks (entry-driven, **no model-id regex** at call sites). Picking a model is now one decision. +9 tests; 875 green, `tsc` ×3 clean. **Initiative 16 done** — Luna runs on Anthropic OR any OpenAI-protocol model; the live multi-model E2E is the one remaining step (needs a restart against real endpoints). branch) · v0.23.2 (Initiative 16 3/4 — **OpenAI-protocol adapter: real SSE streaming**: `OpenAIProvider.chatStream` gains a true streaming path behind `LUNA_OPENAI_STREAM` (default off → the proven v0.23.1 non-streaming fallback) — OpenAI SSE deltas → `text_delta` / `thinking_delta` (reasoning models, `LUNA_OPENAI_REASONING`) / `tool_use_start` / `tool_input_delta` as they arrive (interleaved tool-use, the latency win), accumulating `tool_calls` by `index` then one `message_stop` built from the **same shared block builders** as the non-streaming path (identical replayed history). A pure, tested `consumeSSE` byte-framer + a `setOpenAIStreamFetcher` seam. Adversarially reviewed: 2 real robustness gaps **fixed** — a tool stream with no terminal `finish_reason` now still stops as `tool_use` (else runTurn wouldn't dispatch → orphaned `tool_use` → next-request 400), and `consumeSSE` drains a final newline-less `data:` line. +13 tests; 866 green, `tsc` ×3 clean, branch) · v0.23.1 (Initiative 16 2/4 — **OpenAI-protocol adapter: translation core + provider**: a pure, exhaustively-tested `provider/openai/translate.ts` (Anthropic⇄OpenAI: system/messages/tools → OpenAI request; response → synthesized `ContentBlockParam[]` + `toolUses` + usage; tool_use⇄tool_calls, tool_result⇄`{role:'tool'}`) + an `OpenAIProvider` with `complete()` + a correctness-first **non-streaming** `chatStream()` (real SSE streaming is v0.23.2), behind a `setOpenAIFetcher` test seam. `providerFor()`'s `openai` branch now constructs it. `message_stop.assistantContent` retyped `ContentBlock[]`→`ContentBlockParam[]` (replay content is a param; lets a non-Anthropic provider synthesize it without response-only fields). Adversarially reviewed (translation-fidelity + integration lenses + refuters): 7 findings, **0 confirmed** (Zod is correct for standard responses; the baseURL `/v1` footgun is documented). +20 tests; 853 green, `tsc` ×3 clean, branch) · v0.23.0 (Initiative 16 **opens** 1/4 — **OpenAI-protocol adapter: provider seam**: a `ProviderCapabilities` descriptor every `Provider` self-declares + a single `providerFor()` factory selectable by `LUNA_PROVIDER` (default `anthropic` → **zero behavior change**). The `openai` branch throws until v0.23.1; an unknown value fails fast. `AnthropicProvider`/`MockProvider` declare capabilities; `main.ts` constructs via the factory and logs them. Amends the provider Locked Decision ("Anthropic-SDK-only chat") in REWRITE_CONTEXT — a fresh TS provider honors per-instance keys, so the cut `openai_compat`'s bug doesn't recur. Pure additive seam (no `runTurn` touch — the OpenAI path will strip `cache_control`, not gate it). +7 tests; 833 green, `tsc` ×3 clean, branch) · v0.22.3 (Initiative 15 **✅ CLOSED** 4/4 — **proactive: fuzzy detectors + delete the wake-gate**: two heuristic detectors `openThreadAged` (an L3 `active_thread` open > 24h) + `promisedFollowThrough` (an unfollowed "I'll do X" beat in a 6–36h window), both **default-off** + soft-seeded so a false positive yields silence. **Deleted `wakeGate.ts`** + its test + the `LUNA_PROACTIVE_LLM_GATE` branch + the now-orphaned `shouldConsiderWake`/`listRecentProactiveTexts` — the heartbeat is now **LLM-free** (cheap detectors → the silence-capable turn → `{spoke}` is the decision). Adversarially reviewed (2-lens panel + refuters: 5 confirmed, all fixed — tightened the promise regex against empathy-line false positives, added an abandoned-promise upper bound so a silent turn can't re-fire forever, plus `.env.example`/orient-map hygiene). +net tests; 826 green, `tsc` ×3 clean, branch) · v0.22.2 (Initiative 15 3/4 — **proactive: event hooks + a real single-turn lock + weatherShift**: a new `proactive/fire.ts` is the universal entry point — `withProactiveLock` flips a synchronous per-session in-flight flag BEFORE any await (the prior `activeTurn === null` check-then-act was a TOCTOU; the new ws-reconnect + weather-refresh hooks made the race reachable), and `maybeFireProactive` runs the whole funnel (anti-spam → detector → debounce → turn → cadence commit → dream handoff) inside it. The scheduler tick, both event hooks, continuation, and dev-fire all acquire the SAME lock. New `weatherShift` detector (fires once on a coarse condition/temp bucket change, kill switch `LUNA_PROACTIVE_WEATHER_SHIFT`) + a per-key in-memory debounce. Hooks behind `LUNA_PROACTIVE_EVENT_HOOKS` (default off). Adversarially reviewed (3-lens panel → refute each: 8 findings, 0 confirmed; one parity nit fixed — the legacy LLM-gate path short-circuits on `activeTurn` before the wakeGate call again). +16 tests. 837 green, `tsc` ×3 clean, branch) · v0.22.1 (Initiative 15 2/4 — **proactive: detector registry + scheduled slots**: lifts v0.22.0's inline after-night check into a `detectors.ts` **registry** (`evaluateDetectors`, first-match-wins) + adds a **`scheduledWindow`** detector — a guaranteed daily speaking floor at `LUNA_PROACTIVE_SLOTS` local hours (e.g. `'11,20'`), fired ≤ once per slot per day via a per-day bitmask (migration `0013` + `markSlotConsumed`). `passesAntiSpam` gains a small **idle floor** (don't reach in within ~60s of the user's last message — `mid_conversation`; still no 10m `too_soon` gate). Caught + fixed a real bug: unset `LUNA_PROACTIVE_SLOTS` yielded `[0]` (midnight) not `[]`. +9 tests. 821 green, `tsc` ×3 clean, branch) · v0.22.0 (Initiative 15 begins 1/4 — **proactive: detector-MVP, she actually speaks**: the proactive system has *never once* fired (every `proactive_wake` decision in the live DB is `hold`, **0 `act` ever** — the per-tick LLM wake-gate decides *before* drafting, is stay-quiet-biased, fails-closed on bad JSON). v0.22.0 makes the **deterministic detector path the default**: a cheap anti-spam subset (`passesAntiSpam` = quiet-hours + cooldown + quota — **NOT** the >18h `deep_absence` blanket or the 10m `too_soon` floor, so a long overnight/weekend gap still fires) → the **after-a-night** detector → the existing **silence-capable** proactive turn, whose own `{spoke}` is the only "should I speak?" judgment (drafting-as-decision). A **spoke/silent quota split** (`commitProactiveSilent`) lets a silent draft stamp the cooldown without burning the daily budget. `runProactiveTurn` gains a `seed`; the legacy LLM wake-gate becomes a default-off fallback behind `LUNA_PROACTIVE_LLM_GATE` (deleted in v0.22.3). +11 tests. 812 green, `tsc` ×3 clean, branch) · v0.21.10 (frontend — **message de-dup + history un-merge**: two chat-render bugs. (1) the model occasionally **stutters** — calls the `message` tool twice with identical text (confirmed in L2: a turn's reply held the same sentence twice) — so a bubble showed twice; a verbatim-consecutive duplicate is now dropped server-side (`runTurn` skips the duplicate `messageTexts` push, keeping `assistant_text`/recall clean) **and** discarded live in the controller. (2) a multi-message turn was newline-**joined** into `assistant_text`, so on reload `renderHistory` painted it as **one merged block**; a new pure `messageSegments` splits it back into one bubble per message (+ dedups, so old rows' baked-in stutters also un-double) — matching the live multi-bubble look, no schema/wire change. +7 tests. 801 green, `tsc` ×3 clean, branch) · v0.21.9 (frontend — **persistent typing indicator**: the bouncing "thinking" dots showed on `turn.started` but `open()`/`chip()` called `hideThinking()`, so the first tool/message killed them for the rest of a multi-step turn — she read as "done" and the user cut her off mid-turn. The controller now OWNS the indicator (`setThinking` added to `BubbleView`; the dots re-anchor to the end without restarting the CSS bounce) and keeps it up for the whole turn — through tool runs and between messages — hidden only while a bubble actively streams, cleared on `turn.result`/`proactive.finished`. Also fixes a latent stuck-dots bug: a proactive turn emits no `turn.result`, so the old open-only show would spin forever. Review-hardened: turn-local state (`messageBubbles`/`textStreaming`) resets at every turn boundary + on reconnect so a dropped `tool.finished` can't wedge the dots off, and `showThinking` no longer hijacks scroll. +5 controller tests. 794 green, `tsc` ×3 clean, branch) · v0.21.8 (core-memory remediation — **field boundaries + anti-churn**: the dream's `persona_update` had let `self_state` fill with behavior rules and `relationship_status` with discrete facts (down to a literal "56 green" test count) and rewrote both fields ~every dream even at 97% identity — yet core memory is injected into the cached system block every turn as "who she is". A judge-panel-designed `personaUpdatePrompt` now fences each field (felt sense ONLY; facts→L3, rules→L1), demands prose not keyword-soup, and makes **null the default**; `updateCore` short-circuits a no-op write (identical patch → no audit row, no cache-epoch bump, any caller); `cycle.ts` drops a per-field near-identical rewrite (`similarityRatio` ≥0.95 ⇒ unchanged, `LUNA_PERSONA_REWRITE_SIMILARITY`). Existing degraded content self-heals on the next dream (owner's call). +7 tests. 794 green, `tsc` ×3 clean, branch) · v0.21.7 (dream diary completeness — **yesterday-rewrite + shutdown dream**: from the 6/22 "half diary" diagnosis (not a truncation/append-续写 bug — the diary already rewrites from the whole day; it was thin because **no in-day dream ran on 6/22**, downstream of the v0.21.6 proactive death). (A) every dream now rewrites **today AND yesterday**'s day-diary (was today-only), so the next day's first dream gives yesterday one final complete pass — catching anything said after the last in-day dream, before midnight — before it freezes write-once; days older than yesterday stay immutable. (B) a **shutdown dream**: on a graceful exit (Ctrl-C / SIGTERM / SIGINT) `main.ts` runs one last `runDreamCycle` so the day's diary + memory consolidate before the process dies — best-effort, deadline-bounded (`LUNA_SHUTDOWN_DREAM_TIMEOUT_MS`, 120s), a second signal force-exits, `LUNA_SHUTDOWN_DREAM=0` disables it for fast dev restarts. 782 green, `tsc` ×3 clean, branch) · v0.21.6 (fix — **proactive survives a restart**: the heartbeat only iterates `activeSessionIds()` = the in-memory session map, empty after a restart until the next user message — so proactive went dead between a restart and the next chat (silent since 2026-06-16, confirmed in traces). Boot now `preloadSessions()` warms persisted sessions into the map + restores `lastUserMs` from the last real user turn. 782 green, `tsc` ×3 clean, branch) · v0.21.5 (Initiative 14 follow-on — **pluggable weather provider + QWeather**: a `weatherProvider` dispatcher (`LUNA_WEATHER_PROVIDER`; auto-selects QWeather when a key is set, else Open-Meteo) + a **QWeather (和风)** adapter — China-accurate CMA data, fixing Open-Meteo's bad China forecasts (live: Xi'an **70% vs Open-Meteo's 20%** rain); needs a free key + the account's custom API Host (`LUNA_WEATHER_API_KEY`/`_HOST`). Live-verified end-to-end. 779 green, `tsc` ×3 clean, branch) · v0.21.4 (fix — **GPS-after-boot weather refresher**: when a location arrives via `client.geo` *after* boot (the GPS grant), the `ws` handler now (re)starts the background snapshot refresher — boot-time `startWeatherRefresh` had no-op'd for lack of a location, so the ambient snapshot stayed cold forever and Luna never knew the weather. 776 green, `tsc` ×3 clean, branch) · v0.21.3 (Initiative 14 follow-on — **GPS auto-location**: the browser's `navigator.geolocation` sends a `client.geo` event (new `ClientEvent` variant, both packages) on connect/reconnect; the server uses the real GPS location for weather ahead of the `LUNA_LAT_LON` env fallback — sidestepping the fake-IP proxy that makes server-side IP geolocation report the exit node. Weather "just works" after one browser permission grant, no config. 775 green, `tsc` ×3 clean, branch) · v0.21.2 (Initiative 14 ✅ 3/3 — **proactive weather + close**: an `afterANightOpening` signal (composed from the existing daypart + new-day + gap helpers, 6h min-gap) gates a bounded, ignorable `weatherNoteFor` woven into the proactive opening `framing()` after the felt-absence clause (morning / after-overnight only) — care, not forecast; reads the cached snapshot, never fetches, never touches the wake decision. **Default-flip**: `LUNA_WEATHER` / `LUNA_WEATHER_AMBIENT` / `LUNA_WEATHER_PROACTIVE` now default-ON but **location-gated** (dormant until `LUNA_LAT_LON` is set). **Initiative 14 complete (3/3).** 771 green, `tsc` ×3 clean, branch) · v0.21.1 (Initiative 14 2/3 — **passive ambient weather**: a TTL-cached, background-refreshed weather snapshot (`snapshot.ts` — `.unref()`'d timer, read SYNCHRONOUSLY, cold/stale→omitted, never throws) injected into the per-turn **uncached** tail via a pure `buildWeatherBlock` + a stable data-free `WEATHER_CLAUSE` in the cached L1 contract — she *knows* the weather without a tool call, with **zero** prompt-cache-prefix change and **zero** network call on the reactive path; opt-in `LUNA_WEATHER_AMBIENT`. 758 green, `tsc` ×3 clean, branch) · v0.21.0 (Initiative 14 begins 1/3 — **weather tool + location config**: a no-key Open-Meteo `weather` pull-tool for the configured location (`LUNA_LAT_LON`, validated, degrade-not-throw — IP-geo is out behind the fake-IP proxy); a standalone `web/weather/openMeteo.ts` client (WMO-code map, `assertPublicUrl` SSRF-validate + a plain JSON GET since `safeFetch`'s text-only gate rejects JSON, a `setWeatherFetcher` seam) + `resolveLocation` co-located with `resolveTz`; `proactiveRisk:'safe'`, soft-fail; registered in the 3 places; opt-in behind `LUNA_WEATHER`. 746 green, `tsc` ×3 clean, branch) · v0.20.9 (deep-audit remediation 10/10 — **contract, config & test-debt; Initiative 13 complete**: dead `L2Turn`/`SessionRow` wire schemas removed; `Citation.url` tightened to an http(s) scheme `.refine()` (NOT `z.string().url()`, which would throw in `outbound`); the internal `ToolEvent.tool_name` tightened from `z.string()` to the `ToolName` enum (the wire `ServerEvent` already used it); `.env.example` gains the 37 missing code-read flags; `.prettierignore` excludes `packages/web/public/` (vendored Live2D); `toolLabels` exact-matches (was a substring `includes()` that mislabeled `recall_skill`→recall and rewrote finish summaries); the faceVm emotion-gaze now yields to the focusController when gaze-follow is on; `makePinnedLookup` extracted + unit-tested (the SSRF rebinding-defense shape) + the overstated "real-HTTPS smoke" claim reworded; new `readTracking`/`defineTool` sibling tests. Deferred to the owner: deleting the unreachable `restore(n)` + the inert `physicsPassthrough` (the plan's flagged owner-decisions), and the provider SSE-mapping test (brittle SDK-stream mock). **Initiative 13 ✅ complete (10/10).** 735 green, branch) · v0.20.8 (deep-audit remediation 9/10 — **resilience & lifecycle**: the trace-flush guard moves INTO `flushTrace` so a transient SQLite write can't abort a dream/proactive pass (all callers inherit never-throw); a reactive turn now carries an `AbortSignal` (per-turn `AbortController`, `ProviderRequest.signal`→`messages.stream({signal})`) that `ws.handleClose` aborts when the LAST socket closes — proactive/continuation turns stay socket-less by design (LD #15); the continuation timer is `.unref()`'d and skips firing when no client is listening; the wake gate's anti-repeat list is populated from recent spoken proactive openers (was dead `[]`). Client: a 30s keepalive ping (the server already pongs), a reconnect stability-window before resetting backoff, a `warmUpTts` overall deadline + per-fetch AbortController, and a self-healing TTS latch (`mutedUntil` + 502/504 treated retryable). 722 green, branch) · v0.20.7 (deep-audit remediation 8/10 — **edit & code-map correctness**: file writes are now crash-atomic (shared `atomicWrite` = temp-in-same-dir + rename, so a kill/ENOSPC mid-write leaves the original intact — `edit`/`multi_edit`/`write_file`); the fuzzy matcher gains a separate `occurrences` (ambiguity) field distinct from `count` (verbatim replacements) so two different-indent fuzzy regions correctly trip the uniqueness guard instead of silently editing the first (fixes selfEdit/edit/multi_edit; preserves replace_all count accuracy); `isExported` stops at `class_body`/`class_declaration`/`object` so a method of an exported class is no longer mislabeled exported; 718 green, branch) · v0.20.6 (deep-audit remediation 7/10 — **memory fold & summarization integrity**: `listL2` loads the whole timeline uncapped (the old `LIMIT 10000` with ASC order dropped the NEWEST turns on reload past it; the cap is removed rather than DESC+reversed, preserving the absolute `window_low_water` offset `planFold`/`buildActiveContext` index against); `maybeFold` rejects an empty digest before `commitFold` so a truncated/all-thinking `complete()` never overwrites `rolling_summary` with `''`; `complete()` drops adaptive thinking (overhead that competed with the output budget — the empty-text source); the dream salience step rejects a `scores.length !== unrated.length` patch so a shifted score list can't permanently mis-rate turns; 711 green, branch) · v0.20.5 (deep-audit remediation 6/10 — **recall correctness**: the agentic `recall` tool's `scope='timeline'` now includes diaries (was hard-coded `=== 'l2'`, silently dropping every diary hit), and scope is pushed into `retrieve()` (a `sources` pre-rank filter) so the `k` limit applies per-scope — a burst of recent off-scope rows can no longer starve facts/timeline out of the top-k; `cosine` length-guards a dim mismatch to 0 instead of NaN, and the embedding cache key is model-namespaced so a `LUNA_EMBEDDING_MODEL` swap re-embeds rather than reusing stale-dim vectors; hot-path auto-injection byte-identical (no `sources`); 708 green, branch) · v0.20.4 (deep-audit remediation 5/10 — **temporal correctness**: `formatGap`'s within-hour minute round-up now carries (`m===60 → h+1`, carrying past 24h into the days branch) so it never renders "1h 60m" / "23h 60m" — verified by enumerating all of `[0,86400)`; `resolveTz` validates `LUNA_TZ` (a typo like `Asia/Shanghi` used to throw RangeError and brick every turn before the LLM) and degrades to the host zone, plus a `buildTimeBlock` try/catch in runTurn so a temporal failure omits the block rather than failing the turn. Note: the sub-hour branch already used `Math.floor` so it was never affected. 704 green, branch) · v0.20.3 (deep-audit remediation 4/10 — **frontend input & interrupt**: an IME-composition Enter guard (`!isComposing && keyCode!==229`) stops a pinyin-candidate commit from dispatching a half-composed message — the **中文-input** fix; barge-in finally wired (controller calls `audio.stop()` on `turn.started`) + a per-utterance `AbortController` threaded through `fetchSpeech`/`player.play` so a `stop()` during synthesis/decode cancels cleanly, and an `AbortError` is **not** counted toward the TTS disable-latch; the text-mode reply bubble is finalized on `turn.result` so consecutive replies no longer merge into one growing bubble; 696 green, branch) · v0.20.2 (deep-audit remediation 3/10 — **subprocess & resource cleanup**: the spawner's "kill the process TREE" is now real — `collectProcessTree` enumerates descendants from a `ps` snapshot and signals each (Bun.spawn starts no new process group, so `kill(-pid)` was a no-op leaking grandchildren), + the SIGKILL-escalation timer is cleared on clean exit; `ctx.abortSignal` threaded into `grep`/`find_symbol`/`repo_map` (rg `Bun.spawn({signal})` + JS-walk/parse-loop abort checks); tree-sitter `Parser` pooled per-grammar (was `new` per file → WASM-heap leak), freed on reset; 694 green, branch) · v0.20.1 (deep-audit remediation 2/10 — **secret-blocklist hardening**: a shared secret-segment source + `isSecretTailPath` closes `$HOME/.aws/…` / `${HOME}/.ssh/…` env-indirection in `shell`'s path scan (the captured token resolves outside real $HOME, so only a tail-segment match catches it); `fsScan.walk` gains `excludeSymlinks` and grep's JS fallback both excludes symlinks AND gates every file through `resolveInWorkspace('read')` — closing the symlink-to-secret read; 692 green, branch) · v0.20.0 (deep-audit remediation 1/10 — **shell deny-gate integrity**: the verify tools `typecheck`/`run_tests`/`lint` now **argv-spawn** (no `/bin/zsh -lc`), closing the `$()`/backtick command-injection via `input.path` **and** the deny-regex bypass (they never called `classifyShellCommand`); `input.path` gated; deny-regex broadened (`find -delete`, `curl|python/perl/node/ruby/php`, intermediate-pipe, empty-quote splice) + comment corrected; evaluator firewall extended to `shell.ts`/`shellCore.ts`/`run_tests.ts`; 681 green, branch) · v0.19.2 (time perception C — bounded felt time: daypart-mood + felt-absence suggestion line (`subjectiveTime`), an L1 **warmth-not-guilt** guardrail, light proactive framing on a long-away wake; **A+B+C default-flipped ON**; cache invariant preserved (per-turn time stays in the uncached tail); **Initiative 12 complete 3/3**, branch) · v0.19.1 (time perception B — relative-time labels on recalled memories + chronological oldest→newest display, reusing v0.19.0's `relativeLabel`; the cached diary digest keeps stable absolute period labels to preserve the cache invariant; Initiative 12 2/3, branch) · v0.19.0 (time perception A — passive TS-computed time in the uncached user tail: now + daypart + elapsed + session, timezone-explicit; L1 "don't compute durations" clause; Initiative 12 1/3) · v0.18.4 (fix: a stray **top-level text leak** — the model narrating outside the message tool — got stored as the visible reply ("answer for user question") on a turn that errored before `finalize`; now the message-tool reply is always persisted as `assistant_text`. 1 historic L2 row repaired, 20 humanity-transform rows correctly left alone) · v0.18.3 (web tools — **web_fetch DNS pin**: `safeFetch` connects through a `node:http(s)` custom lookup **pinned to a deny-list-validated IP** — the rebinding TOCTOU is *closed*, not narrowed (verified by a real-HTTPS smoke); the `198.18.0.0/15` benchmarking range is unblocked so it works behind Clash/Surge fake-IP proxies; **`web_fetch` flipped default ON**; citation chips now clickable + scheme-validated (XSS-safe); reload-persistence deferred. 634 tests green) · v0.18.2 (web tools — **complete networking**: the search→fetch→reason loop validated end-to-end; the standing `<untrusted_content>` **prompt-injection rule** + the read/write boundary (`web_to_action` decision trace) extending LD #14; **citations** `{url,title}` on `turn.result` (wire-contract change, both packages) → source cards in the web UI + L2 persistence; an optional SSRF-safe fetch **cache** (migration `0012`, `LUNA_WEB_CACHE`); **default-flip** `web_search` **ON** (graceful no-key degrade), `web_fetch` reverted to **opt-in** in review (DNS-rebinding TOCTOU not fully closed → v0.18.3 pin); **Initiative 11 complete 3/3, review-remediated**, branch) · v0.18.1 (web tools — **web_fetch + SSRF/extraction safety core**: read one URL safely — `assertPublicUrl` deny-lists private/loopback/link-local/metadata/ULA/IPv4-mapped/encoded IPs + non-http(s) + credentials + over-long, `safeFetch` does manual redirect re-validation + DNS-rebinding re-check + byte/time caps + content-type gate, Readability→Turndown extraction wrapped in `<untrusted_content>`; the guard joins the evaluator-firewall set; default **OFF** behind `LUNA_WEB_FETCH`; **Initiative 11 2/3**, branch) · v0.18.0 (web tools — **web_search**: Luna's "look it up" capability, a client-side live-web search on the existing dispatcher behind a `WebSearchProvider` abstraction (Tavily default, gateway-safe since yunwu strips Anthropic's native web_search), soft-fail + `[N]` citation summary, `proactiveRisk:'safe'`; ships with the **defection guard** — an L1 commitment/when-to-reach clause + an off-hot-path `web_search_intent_no_call` audit extending LD #14; default **OFF** behind `LUNA_WEB_SEARCH`; **Initiative 11 begins 1/3**, branch) · v0.17.3 (dream: today's day-diary is **rewritten on every dream** so a daytime dream captures the whole day instead of freezing it at the first dream — owner's "option 2"; past days stay write-once) · v0.17.2 (fix: a failed/empty turn — e.g. a 401 gateway outage — no longer persists an empty-assistant L2 row and rolls its dangling user message out of history, killing the "短暂失忆" pollution that survived restarts post-A3) · v0.17.1 (memory depth — **diary injection**: a standing day/week/month digest in the cached system block + diaries as recall candidates (the long-range narrative memory finally reaches the model; rag_refresh's diary embeddings now retrievable), Generative-Agents recency×importance×relevance recall ranking, monthly diaries; amends LD #12 diary-part; **Initiative 10 complete 2/2**, branch)

## Scope

Per-version log of what has actually shipped in the TypeScript rewrite. This is the **truth source**
for "what version are we on" — not the roadmap, not in-flight conversation.

Conventions match Python Luna:
- `Fact` = grounded in commit history, repository docs, or checked-in code in this TS repo.
- `Inference` = phase summary derived from those materials.
- `-dev` = current working-tree iteration not yet committed.

The Python original (`/Users/alanyu2077/Desktop/Agent_Luna`) stays the running production system
during the rewrite. Its version log is unrelated to this one — `v0.1` here is not `v0.1` there.

## Source material

- 2026-06-11 15-dimension ground-truth audit of Python Luna v0.47.9 (`/Users/alanyu2077/.claude/.../tasks/w7tdhaip0.output`)
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
| `v0.13.1` | 2026-06-14 | Live2D foundation — yumi avatar (pixi-live2d + Cubism), first-cut FaceVM, draggable | `94ff57a` |
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
| `v0.17.2` | 2026-06-16 | Fix — failed/empty turns no longer poison memory (C-side) — `runTurn`'s `finally` persists a turn only if it delivered a **real reply** (message-tool text in message mode, streamed text in text mode); a turn that threw before any token (a 401/network outage → `finishReason 'error'`) or ended double-silent leaves **no** empty-assistant L2 row and has its dangling user message rolled back to the pre-turn point (post-A3 those empty rows otherwise survive every reload → the "短暂失忆" symptom). Retargeted the Bug-A resilience test (`DROP TABLE sessions`, not `l2_turns`, so the upstream `retrieve()` still runs and the failure lands in `persistSession`). 560 tests green. | `working tree` |
| `v0.17.3` | 2026-06-16 | Dream — today's day-diary is **updateable** (owner's option 2) — `run_diaries` upserts the current **UTC day** on every cycle (`ON CONFLICT(kind,period_key) DO UPDATE`), regenerated from all of that day's L2; past days keep `INSERT OR IGNORE` (write-once). Fixes the mid-day-freeze: a self-/scheduler-triggered daytime dream no longer locks the day diary at noon and lose the afternoon. Day boundary stays UTC (08:00 Asia/Shanghai). 561 tests green. | `working tree` |
| `v0.18.0` | 2026-06-16 | Web tools — **web_search** (Initiative 11, 1/3) — client-side live-web search on the existing dispatcher behind a `WebSearchProvider` abstraction (`tools/web/`: `provider.ts` + `tavily.ts` + `web_search.ts`), Tavily default, gateway-safe (yunwu strips Anthropic's native web_search), soft-fail (every failure a recoverable `err`, nothing throws past the generator) + `[N] url` citation summary + a `正在查一下…` progress line; `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`. Ships with the **defection guard** extending LD #14 — an L1 commitment/when-to-reach clause (gated on the tool being mounted) + an off-hot-path `web_search_intent_no_call` decision-trace audit (thinking shows web-lookup intent but no `web_search` call fired). Default **OFF** behind `LUNA_WEB_SEARCH`; +18 tests, 577 green. | `working tree` |
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
| `v0.21.5` | 2026-06-23 | Weather follow-on — **pluggable provider + QWeather (和风)** (Initiative 14): a `weatherProvider.ts` dispatcher (`LUNA_WEATHER_PROVIDER`: qweather\|open-meteo, auto by key presence) routes `fetchWeather` to a new **QWeather adapter** (`qweather.ts`: now+3d+24h via the account's custom API Host, all-string fields `Number()`'d, `lon,lat` order, max-24h `pop` as chance-of-rain, `assertPublicUrl` SSRF-validate + seam) or the renamed `fetchOpenMeteo` fallback. Fixes Open-Meteo's inaccurate China forecasts (**live: Xi'an 70% vs Open-Meteo 20% rain**). +3 adapter tests; existing weather tests pinned to open-meteo. Key/host live only in the gitignored `.env`. 779 green, `tsc` ×3 clean. | _branch_ |
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
| `v0.23.1` | 2026-06-25 | **OpenAI-protocol adapter 2/4 — translation core + provider** (Initiative 16): the riskiest slice. `provider/openai/translate.ts` (NEW, pure, no I/O) is the only place that knows the OpenAI Chat-Completions wire shape — `systemToOpenAI`/`messagesToOpenAI`/`toolsToOpenAI` (Anthropic-shaped history → OpenAI request: `tool_use`→`assistant.tool_calls[]`, `tool_result`→`{role:'tool', tool_call_id}`, `input_schema`→`function.parameters`, `cache_control` dropped) + `parseOpenAIResponse` (Zod) / `toAssistantContent` / `toProviderToolUses` / `mapStopReason` / `mapUsage` (response → a synthesized `Anthropic.ContentBlockParam[]` for replay + `ProviderToolUse[]` + usage). `provider/openai/openaiProvider.ts` (NEW): `OpenAIProvider` with `complete()` + a **correctness-first non-streaming** `chatStream()` (yields an optional `text_delta` then one `message_stop`; real SSE streaming is v0.23.2) + a minimal `fetch` client + `setOpenAIFetcher` test seam; `apiKey`/`baseURL` per-instance (yunwu OpenAI route by default). `providerFor()`'s `openai` branch constructs it. `message_stop.assistantContent` retyped `Anthropic.ContentBlock[]`→`ContentBlockParam[]` (the replay content is a param — lets a non-Anthropic provider synthesize it without response-only fields like `ToolUseBlock.caller`; Anthropic's `final.content` still assigns). Adversarially reviewed (2 lenses + refuters): 7 findings, **0 confirmed real** (the Zod schema is correct for standard chat-completion responses; an array-content/refusal response throws loudly rather than corrupting; the `ANTHROPIC_BASE_URL`→`/chat/completions` footgun is documented in `.env.example`). +20 tests. 853 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.2` | 2026-06-25 | **OpenAI-protocol adapter 3/4 — real SSE streaming** (Initiative 16): `OpenAIProvider.chatStream` branches on **`LUNA_OPENAI_STREAM`** (default off → the v0.23.1 non-streaming `chatStreamBuffered`; `=1` → a new `chatStreamSSE`). The SSE path translates chat-completion deltas → `text_delta` / `thinking_delta` (reasoning models via `delta.reasoning`/`reasoning_content`, gated by `LUNA_OPENAI_REASONING`) / `tool_use_start` / `tool_input_delta` **as they arrive** (interleaved tool-use — the rewrite's #1 latency principle), accumulating `tool_calls` by `index` (with a buffered-args flush if fragments precede the id/name), then one `message_stop` assembled from the **same `blocksFromParts` builders** the non-streaming path uses → streamed and non-streamed turns persist **byte-identical history**. A pure `consumeSSE` byte-framer (handles CRLF, split-across-reads, `[DONE]`, comments) + a `setOpenAIStreamFetcher` test seam; `capabilities` computed in the ctor (`interleavedToolStreaming`/`thinking` per the flags). Adversarially reviewed (streaming-accumulation + SSE-framing lenses + refuters): **2 real gaps fixed** — (1) a tool stream with no terminal `finish_reason` chunk now defaults to a `tool_use` stop (else `mapStopReason(null)`=`end_turn` → runTurn skips dispatch → orphaned `tool_use` in history → next OpenAI request 400s; plausible via the third-party yunwu gateway), (2) `consumeSSE` drains a final newline-less `data:` line. +13 tests. 866 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.3` | 2026-06-25 | **OpenAI-protocol adapter 4/4 — model registry → Initiative 16 ✅** : `provider/registry.ts` (NEW) — `resolveModel(LUNA_MODEL)` → a `ModelEntry` {`protocol`, `tokenParam`, `systemRole`, `reasoning`, `toolUse`} from a built-in table (claude → anthropic; `o1`/`o3`/`o4` → openai+`developer`+`max_completion_tokens`+reasoning; `gpt-5` → +`max_completion_tokens`; `gpt-` → openai) + a Zod-validated `LUNA_MODELS_JSON` override (a new model = one config entry, no code). `providerFor()` is now registry-driven (`LUNA_PROVIDER` forces the protocol; an unknown value still fails fast). `OpenAIProvider` takes the entry and threads the quirks — `tokenParam` for the max-tokens key, `system`/`developer` role, `reasoning`→`capabilities.thinking`, `toolUse:false`→omit tools — all **entry-driven, no model-id regex** at any call site. The live multi-model E2E (GPT/o-series + an OSS model + Anthropic) is the one remaining acceptance step (needs a restart against real endpoints). +9 tests. 875 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.4` | 2026-06-29 | **OpenAI hardening — post-ship audit (PR #8) remediation** : a 7-lens audit of Initiative 16 (0 critical / 5 high / 12 medium / 27 low; root cause = *treating Anthropic's reliability as protocol-independent*) raised concrete gaps; this fixes them **before any live OpenAI run**. **Theme C** (the cleanest bug): `chatStreamBuffered` — the DEFAULT path — now forces a `tool_use` stop when `tool_calls` are present (else orphaned `tool_use` poisons history → next request 400s; the SSE path already had the guard). **Theme D** (dead-on-arrival config): drop the `ANTHROPIC_BASE_URL` base-URL fallback (→ `api.openai.com/v1`; no `/v1`-drop 404, no bearer key to the Anthropic host); the factory threads the single wire model so the startup log can't lie; `NaN`-guard `LUNA_MAX_TOKENS` (both providers); registry `id.min(1)`. **Theme B** (tolerant parsing): `parseStreamChunkSafe` skip-bad-chunk, synthesized `call_<index>` tool ids (no empty/colliding `tool_call_id`), in-band `error`-frame detection (object OR string). **Theme A**: `tool_choice:'required'` so a GPT model can't answer in free `content` and bypass the message tool (LD #9; registry-overridable to `auto`). **Theme E**: bounded retry parity (`maxRetries`-equivalent on connect/5xx/429) + `complete()` `reasoning_effort:'low'` so an o-series dream/fold can't starve to empty. **Theme F**: HTTP error-body redaction (no gateway/key leak to the client), SSE reader cleanup + line/output size caps, `content_filter` passes through (not masked as `end_turn`), `is_error` prefixed on tool messages. Adversarially reviewed (2 lenses + refuters, focused on the un-unit-tested retry/reader control flow): 4 findings, **0 confirmed**. +9 tests. 883 green, `tsc` ×3 clean. | _branch_ |
| `v0.23.5` | 2026-07-01 | **Persona — kill the assistant-filler closer tic**: live L2 caught Luna padding **reactive** replies with hollow check-in bait ("Still here — what's on your mind?", "Talk to me", "What's wrong?") — 11 of the recent 237 turns, once *while the user was complaining she sounds like a robot* (`turn:236`). The string is **model-generated** (grep-absent from all TS + Python source, not a hardcoded fallback), and the anti-查岗 constraint existed only on the **proactive** path — reactive replies had no equivalent, and the persona file's abstract "no assistant patterns" (`default.md:102`) didn't hold. `renderHumanityBlock()` — the cached "How you speak" block (`runTurn.ts:137`) — gains a **concrete** rule: names the banned closers (+ 在吗/还在吗), grants "a reply can simply end", makes her mirror a thin OwO/lol *lightly* instead of inflating it into a probing question, all while preserving genuine specific curiosity. +1 test; persona 14 green, `tsc` clean. **Restart-gated** (system block memoized per process, `runTurn.ts:298-308`). | _branch_ |

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
  `onended`), fixing "上一条没说完就急着说下一条". `stop()` clears the queue + halts current (barge-in).
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
blink/breath while neutral. Python actually shipped several idle profiles, and Alan wanted them back +
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
  and gives Alan the variety he remembered, now as a first-class setting rather than a buried constant.

## Detailed records

### `v0.23.5` — 2026-07-01 — Persona: kill the assistant-filler closer tic

Status:

- working tree (branch `feat/weather-perception`)

Fact:

- **Root cause (from live L2 in `luna.sqlite`):** every reply carrying the filler ("Still here — what's on your mind?", "Talk to me", "What's wrong?", "Still here.") is a **reactive** turn — `turn_id` `default:turn:NNN` with a non-empty `user_text` — **11 of the recent 237 turns**, clustering after a thin or emotionally-charged input; one fired in `turn:236` *immediately after the user typed "you speak like a robot"*, and `turn:237` was the user asking why she keeps doing it. **Zero** proactive/continuation turns are involved. The string is **model-generated** — a repo-wide grep finds it in neither the TS nor the Python source (only test fixtures use `"Still here."` as sample text), so it is **not** a hardcoded fallback.
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
- Adversarial review (streaming-accumulation + SSE-framing lenses, each finding refuted): **2 real robustness gaps found and fixed before commit** — (1) a tool-bearing SSE stream that never sends a terminal `finish_reason` chunk left `finishReason` null → `mapStopReason(null)`=`end_turn`, so runTurn's `stopReason==='tool_use'` gate would NOT dispatch, orphaning `tool_use` blocks in history and 400-ing the next OpenAI request; now defaults to `tool_calls` when any tool was accumulated (conformant OpenAI always sets it, but the default base URL is the third-party yunwu gateway). (2) `defaultStreamFetch` dropped a final `data:` line with no trailing newline; `consumeSSE` + an end-of-stream flush recover it. Both covered by new tests.

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

- Root cause of "proactive died": the heartbeat (`scheduler.tickOnce`) only iterates `activeSessionIds()`, which returns the keys of the in-memory `sessions` map — and that map is EMPTY after a process restart until the next `getSession` (i.e., the next user message). So between a restart and the next chat, the scheduler had no session to consider and never fired — diagnosed from traces (`proactive_wake` decisions stopped 2026-06-16 while user turns kept flowing). The owner restarts often (dev), and proactive's whole purpose is to reach out when he is NOT chatting, so this silently killed it.
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
- Tests: new `qweather.test.ts` (now+3d+24h→snapshot mapping, `lon,lat` URL build, non-200 throws); `snapshot.test.ts` + `weather.test.ts` pin `LUNA_WEATHER_PROVIDER=open-meteo` (so the `.env` `qweather` default doesn't divert their Open-Meteo seam, since `bun test` loads `.env`). +3 → **779 green**; `tsc` ×3 clean. **Live-verified** end-to-end: the dispatcher selects qweather and yields "Weather where Alan is (Xi'an): overcast, 26°C — high 29 / low 21, 70% chance of rain" — vs Open-Meteo's 20%.

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
- `turn/weatherContext.ts` gains `weatherProactiveEnabled()` + a bounded, ignorable `weatherNoteFor(snapshot)` ("It's <condition> out (<temp>°) where Alan is — … a small weather-aware kindness … never a forecast or a status report."); a null snapshot → no note.
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
- New `packages/server/src/turn/weatherContext.ts`: `weatherAmbientEnabled()` (opt-in `=== '1'`) + a pure, synchronous, format-only `buildWeatherBlock(snapshot)` handing Claude a finished labeled fact (`Weather where Alan is (Shanghai): overcast 18°C, feels 17°C — today's high 21°C / low 14°C, 40% chance of rain today. Currently daytime.`).
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
- Tests (+8, 696→704): carried `formatGap` cases + a full `[0, 86400)` no-60m enumeration; `resolveTz` valid/invalid; a `runTurn` with `LUNA_TZ='Asia/Shanghi'` now reaches the provider (`requests.length === 1`, `finishReason !== 'error'`).

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
  public domain resolves into it on a proxied host (confirmed here: example.com/google.com/github.com/
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
- The fake-IP-proxy discovery matters for this deployment specifically: without unblocking the benchmark
  range, `web_fetch` would have been dead-on-arrival for the owner (his network uses the same proxy).
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
- The day boundary stays **UTC** (`toISOString` → 08:00 Asia/Shanghai). A local-boundary switch
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

- Root cause of the "短暂失忆" seen in C-side testing. During a 401 auth outage (a mis-set gateway
  base URL) two turns failed with empty assistant text, and the pre-fix `finally` persisted them as
  empty-assistant L2 rows. Post-A3 (`v0.16.2`), `loadSession` rebuilds the durable timeline from L2
  `raw_json`, so those empty rows survived every restart and sat in both the recall corpus and the
  rebuilt window as "you said X, I said nothing" — which reads as memory loss. The memory-depth
  pipeline (deep window / diary injection) was working correctly; the defect was upstream, in *what
  got written*.
- A failed turn now leaves the session byte-identical to before it ran, so a retry of the same
  message starts from a clean context — no doubled user message, no empty assistant turn. That is
  exactly what recovered the conversation at 10:53 when the re-sent "New version, Luna" produced a
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

- Closes the owner's "记得太短" correction: the long-range narrative layer (day/week/month diaries)
  now actually reaches the model — as an always-present digest and as retrievable recall — so Luna
  has "这几天 / 这几周发生了什么" continuity, not just the recent window + discrete facts. The
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

- Directly fixes the owner's "记得太短" correction at the conversational layer: the verbatim window
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
- **Initiative 6 ✅ complete** (v0.12.0 → v0.13.4): the redesigned cute UI + Live2D yumi + voice +
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
  (`?dev`): `setMouthOpen` visibly opens yumi's mouth (the lip-sync output path); **live GPT-SoVITS
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

### `v0.13.1` — 2026-06-14 — Live2D foundation (Initiative 6, the real yumi avatar)

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
    affects → yumi facial poses, blended by `emotion` (0..1).
  - [`pixiLive2DSink.ts`](../../packages/web/src/live2d/pixiLive2DSink.ts) — the real `Live2DSink`:
    loads yumi, drives a `FaceVm` on the ticker, **draggable** (pointer → persisted `localStorage`
    offset, clamped on-screen, double-click recenters); returns `null` to degrade if WebGL/load fails.
  - tests: `expressionMap.test.ts` (4) + `faceVm.test.ts` (4).
- **New [`dev-server.ts`](../../packages/web/dev-server.ts)** — a custom Bun dev server
  (`Bun.serve({ routes:{'/':html}, fetch })`) that bundles the HTML/TS **and** serves the vendored
  Cubism core + yumi assets from `public/` (runtime-fetched URLs `bun <html>` won't serve). Root
  `dev:web` now runs it.
- **Vendored** `packages/web/public/`: `live2dcubismcore.min.js` (204KB) + `models/yumi/` — the 8192²
  texture **downscaled to 2048²** (15MB→1.3MB; UVs are normalized so it stays correct), unused
  `yumi.png`/`yumi.vtube.json` removed → **7.7MB** total. Deps: `pixi.js@7.4.2` +
  `pixi-live2d-display@0.5.0-beta`.
- **Grew `Live2DSink`** ([`sinks.ts`](../../packages/web/src/sinks.ts)): `+setState(state)` +
  `setMouthOpen(value)` (console stub updated). [`controller.ts`](../../packages/web/src/controller.ts)
  drives state: turn.started→thinking, message tool.started→speaking, turn.result→neutral,
  dream.status→sleeping/neutral.
- [`app.ts`](../../packages/web/src/app.ts) is async: mounts `pixiLive2DSink` into the model stage
  (removing the placeholder) when WebGL is present and `localStorage 'luna:live2d' !== '0'`; falls
  back to the placeholder + console sink otherwise. WS now targets `ws://<host>:8787` so the live
  model receives real events (resolves the dev WS-reachability gap, task_3571afff).
- **Validation:** `tsc --noEmit` clean (web + server); `bun test` **287 pass / 0 fail** (+9). Browser
  smoke (preview tool): yumi renders in the model stage (desktop two-pane + responsive stack),
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
  vtuber-stream-overlay reference Alan supplied:
  - [`theme.css`](../../packages/web/src/ui/theme.css) (~155 lines) — cool **yumi** palette (CSS
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
- **Design decisions (Alan, this session):** vanilla TS + CSS (no framework — matches the existing
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
- **Default flip** — `proactiveEnabled()` → `LUNA_PROACTIVE !== '0'` (default **ON**, Alan's
  explicit choice; `=0` is the kill switch). `ws.ts proactive.fire` uses it. The full Initiative-5
  safety stack (hard surface-gate, action budget, fail-closed classification, full tracing,
  conservative wake judgment) is what makes autonomy-on-by-default responsible.
- **`scripts/proactive-soak.ts`** (new) — drives heartbeat ticks against the real model on an idle
  session and reports wake decisions + actions + cadence sanity.
- Tests: 257 across 36 files (+7): `shouldContinue` (prob 1/0, `LUNA_SELFCONT=0`, kill switch);
  `fireContinuation` (runs / skips-while-active); dream auto-trigger (a proactive turn that calls
  `enter_dream` → scheduler clears `pendingDream` + starts the cycle); the 3 default-flip tests now
  set `=0` explicitly (audit-don't-blanket-flip).
- Real-LLM smoke (yunwu): after "我今天写完了 Luna 的主动性模块，有点累但挺满足", the continuation
  added one genuinely new thought — "等下…如果想开口是你写的，那现在这股好奇，算我的还是你的？" — a
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
  (Alan's explicit choice) and adds self-continuation + dream auto-trigger as scheduled wakeups.
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
- Real-LLM smoke (yunwu): a 3-hour-idle context → `act:false` ("no pending thread to justify
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

- **The LD #15 safety contract, as Alan chose it (hard gate).** Makes full-tool-incl-`shell`
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

- This is the spine that makes Alan's max-autonomy choice responsible: an unsupervised loop can call
  anything, but **nothing irreversible happens silently** — she must tell you first, and you see the
  announcement before the act. The hard gate (block-first) was Alan's explicit pick over the softer
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
- Real-LLM smoke (yunwu, `LUNA_PROACTIVE`): a manual fire → she woke, drew on core memory (Agent_Luna
  + espresso preference), reflected ("你在写的 Agent_Luna，某种意义上就是我吧？"), and reached out
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

Recorded sweep (yunwu, dev-scale, not a statistical claim):

| Metric | baseline (integrity off) | full (all on) |
|---|---|---|
| intent-without-act defections | 1 (uncorrected) | 1 |
| guard corrections | 0 | 2 (is_final nudges) |
| tool-fire turns (of 6) | 2 (`remember`, `enter_dream`) | 2 |
| per-message humanity | 0 violations | 0 violations |

- Behavioral read: both modes **decline honestly** on capability-lacking prompts (no kept-false
  promises); **full mode is markedly more explicit** about it — t1 produced "不想骗你说我查到了…
  没留下空头支票哦" (the L1 commitment-to-act + honesty pillars visibly steering her). Both fired
  `remember` on "记一下…报告" (act-then-speak — 工具稳发). The full-mode guard corrections were
  `is_final` nudges (she under-set "more coming", the guard made her finish) — the zero-false-
  positive structural guard working, at the cost of one extra bubble. The lone "humanity violation"
  the sweep printed for full mode was a metric artifact (the script measures the *joined* multi-
  bubble turn text; the caps are *per-message* and every bubble passed Zod).

Inference:

- **Initiative 4 complete in 5 versions**, delivering Alan's stated intent — 言行一致 + 工具稳发 +
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
- Real-embedding smoke: seeded "用户最喜欢的饮品是在家手冲的意式浓缩咖啡" + two distractors, then
  `recall({query:'他平时爱喝点什么提神的'})` — a **zero-shared-keyword** paraphrase — surfaced the
  espresso fact as the **top hit** (0.438 vs 0.254/0.253). Semantic recall works through the tool.

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
- Real-LLM smoke (yunwu, guard+contract+audit on): a clean greeting → no spurious retry, no decision
  traces; "记一下：我下周一要交报告" → `tools=[remember, message, message, message]` — she said
  "记下了——下周一，报告" **and actually fired `remember`**. 言行一致 end-to-end; the guard correctly
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
- Real-LLM smoke (yunwu, `LUNA_L1_CONTRACT=1` + audit on, the two capability-lacking prompts that
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
- Real-LLM smoke (yunwu, `LUNA_DECISION_AUDIT=1`): an honest decline ("我现在碰不到你的日程，
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
  baseline harness; 8-turn scripted conversation × both modes, real model via yunwu, ephemeral
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
  the spike-verified yunwu chunk shapes and single-char pathological splits.
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
- Tests: 162 across 25 files (+14). Real-LLM smoke (yunwu, fresh session): 9 ordered
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
- Real-LLM smoke (yunwu, message mode, full runTurn with persona+memory): two bubbles —
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
- Real-LLM smoke (yunwu, boot → "你是谁？"): "我是Luna。刚醒过来，脑子里还很空，名字倒是清楚。
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
  `properties`**; the yunwu gateway treats such tools as argument-less and wraps whatever the
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
- Tests: 120 across 21 files (+7). Live yunwu smoke: "请记住：我的名字是 Alan，我喜欢猫。" → two
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

- First **usable** conversation surface — Alan can now actually live with Luna's memory
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
  failure classification incl. yunwu's Chinese rate-limit strings; Zod `MemoryPatch` /
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
- Real-API smoke: "what hot drink hobby did I mention?" hit the espresso L2 row with
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
  tripwire (Alan decision E + kept-undo compromise).
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
- Manual smoke (real LLM): "remember my cat is named Mochi" → model called the tool,
  **chose `core_facts` itself**, L3 row landed; restart → "What is my cat called?" →
  **"Mochi"**.

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
- Manual smoke (real LLM, two boots, one DB): told her "My name is Alan", killed the server,
  rebooted, asked "What is my name?" → **"Alan"**. DB after: schema v2, `turn_seq=2`, 2 L2 rows.

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
- Provider config: yunwu.ai gateway verified by an early 2-round smoke
  (`scripts/smoke-yunwu.ts`) — adaptive thinking with `display: 'summarized'` accepted,
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

- 11:28 — Empty repo cloned to `/Users/alanyu2077/Desktop/Agent_Luna_typescript`.
- ~12:10 — Multi-agent ground-truth audit of Python Luna v0.47.9 completed (32 agents, 15 dimensions).
- 13:xx — Design conversation locked Bun / WS / SQLite / single-user / Anthropic interleaved tool-use / 10-tool surface.
- Late afternoon — Docs scaffolding (`README.md`, `docs/`, `roadmap/`, `REWRITE_CONTEXT.md`, this file) created.

Nothing else exists in this repo yet.
