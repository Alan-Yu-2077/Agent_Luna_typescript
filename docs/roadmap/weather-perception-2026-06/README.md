# Initiative 14 — Weather perception

> **Status: ✅ SHIPPED 2026-06-21** (branch `feat/weather-perception`, 771 tests green; A+B+C
> default-on, **location-gated** — dormant until `LUNA_LAT_LON` is set). Order 14 (after Initiative 13 ✅
> deep-audit remediation). Version range **v0.21.0 – v0.21.2** (3 versions). Master index:
> [`../README.md`](../README.md).
> Source: owner request (a location-based weather tool **and** natural proactive mention — e.g. the
> opening conversation after a night) + a Phase-A fact verification (7 parallel verifiers over the tool
> registry, `temporalContext`, the proactive opening, the prompt-cache invariant, the Python parity
> reference, and a no-key weather-API web survey). Baseline: shipped head **v0.20.9**, 735 tests green.

## The idea

Give Luna a sense of the **weather where her person is**, and the judgment to mention it *naturally* —
the way a friend says "bundle up, it's freezing out" on a cold morning, not the way a weather app
recites a forecast. This is the same layered shape as Initiative 12 (time perception): **(A)** a
model-callable `weather` **pull tool** (she can look it up), **(B)** **passive ambient awareness** — a
TTL-cached, background-refreshed weather snapshot injected into the per-turn **uncached** tail so she
*knows* the weather without a tool call (like the time block), and **(C)** **proactive weather in the
opening** — a natural weather note woven into the after-a-night / morning wake, reusing the existing
daypart + new-day signal and the proactive framing. The through-line, inherited from Initiative 12:
**do all the work in TypeScript and hand Claude a finished, labeled fact; weather is a warmth lever,
never a bulletin.**

## Why now / why this shape

Weather is the natural next sensory channel after time (Initiative 12): both are **volatile per-turn
facts about the user's world** that color how a companion picks up the conversation. It lands after the
deep-audit remediation (Initiative 13) because it leans on now-hardened infrastructure — the SSRF
egress guard (`assertPublicUrl`), the off-hot-path / trace-flush discipline, the proactive lifecycle
(socket-less turns), and the time layer's daypart/new-day helpers. The split isolates the **net-new
data spine (A — the fetch client + location resolver)** from the **cache-sensitive ambient injection
(B)** from the **design-sensitive proactive timing (C — the part that can annoy if over-tuned)**.

## The hard part — principles that govern every version

1. **Weather is volatile → the per-turn snapshot rides the UNCACHED tail.** A byte-varying weather
   string in the `cache_control` system prefix would bust the Anthropic prefix cache every turn
   (`REWRITE_CONTEXT.md:74-78`, the rewrite's #1 latency goal). The snapshot is pushed into the per-turn
   **user message** next to `buildTimeBlock` (`runTurn.ts:238-256`), never `buildSystemPrompt`. A
   *stable-wording* weather L1 **clause** (guidance only, no interpolated data) MAY live in the cached
   contract like `TIME_CLAUSE` (`persona/l1Contract.ts:98`).
2. **No blocking fetch on the reactive path** (`REWRITE_CONTEXT.md:205`, off-hot-path discipline).
   Weather needs a network call — time did not. So the snapshot is **TTL-cached / background-refreshed**
   and read **synchronously** per turn (like `listRecentL2` reads `lastInteractionMs` at
   `runTurn.ts:238`); a cold/stale cache omits the block; a refresh is fire-and-forget (the
   `void maybeFold(...).catch()` pattern at `runTurn.ts:859`), never awaited on the reply.
3. **Compute/format in TS, hand her a labeled fact** (Initiative 12's rule). The WMO weather-code → human
   condition mapping, the °C formatting, the "today's high/low" all resolve in code; the model receives
   `- Weather: Shanghai, overcast 18°C (feels 17°C), high 21° / low 14°, rain likely later`.
4. **Care, not forecast** (warmth-not-guilt's sibling). Weather is a *suggestion* to color tone or open
   a morning warmly — never a status-recital and never forced. Same over-fixation risk Initiative 12
   flagged for subjective time; the proactive note is gated, bounded, and ignorable.
5. **Location is configured, not sensed.** IP-geolocation is out: this host runs a Clash/Surge fake-IP
   proxy (`safeFetch.ts:77-81`) so an IP lookup reports the exit node, not the user. Location is an
   explicit validated env knob (`LUNA_LAT_LON`), degrade-not-throw, exactly like `LUNA_TZ`.

## Locked design decisions referenced (`docs/REWRITE_CONTEXT.md`)

- **Prompt-cache invariant** (`REWRITE_CONTEXT.md:74-78`): system content lives before the
  `cache_control` breakpoint and changes only on a memory change → the volatile weather snapshot must
  ride the uncached per-turn tail, never the cached block. **The single most load-bearing constraint of
  this initiative** (identical to Initiative 12's).
- **Off-hot-path discipline** (`REWRITE_CONTEXT.md:205`): no synchronous external call may be added to
  the reactive turn → weather is a background-refreshed cached snapshot, read sync, never fetched inline.
- **LD #9 — Everything-as-tool; speech via the `message` tool only.** Ambient weather reaches the user
  only when Luna *chooses* to mention it; it is injected context, not a `get_weather` output the model
  narrates. The model-callable `weather` tool (A) is read-only/`proactiveRisk:'safe'`.
- **LD #12/#13 — 3-layer memory + the prompt-cache invariant.** Weather is a new ambient channel, not a
  memory layer; it touches neither L1/L2/L3 nor the recall ranking.
- **LD #14 — Evaluator firewall + SSRF egress.** The weather fetch validates its endpoint through the
  same `assertPublicUrl` deny-list the web tools use; no new egress hole.
- **LD #15 — Proactive = agency, fire-and-forget, socket-less.** The proactive weather note (C) feeds
  the existing opening **framing** (a computed suggestion), adding no new proactive machinery.

## Verified architectural facts (read from TS source; cited)

1. **`defineTool` + the `time_now` template are the exact shape for a `weather` pull tool.**
   `defineTool` is an identity pass-through (`tools/defineTool.ts:59-63`); `ToolSpec` =
   `{name, description, input: Zod, output: Zod, concurrency, timeoutMs, proactiveRisk?, summarize,
   execute}` (`:29-57`); `execute` is an `async function*` yielding `{kind:'progress'|'ok'|'err'}`
   (`:19-22`), with `ctx = {sessionId, callId, abortSignal}` (`:13-17`). `time_now` is the minimal
   zero-arg pull tool: `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`, one `{kind:'ok'}` yield
   (`tools/builtin/time_now.ts:4-31`). `proactiveRisk:'safe'` = read-only, may run silently in a
   proactive turn (`defineTool.ts:6-11`).
2. **A new tool registers in 3 places.** (1) add `'weather'` to the `ToolName` `z.enum`
   (`protocol/src/tools.ts:3-33`); (2) a `weatherTools` sub-registry + `weatherEnabled()` +
   `withWeather(base)` in `tools/registry.ts` (the established gate pattern, `:182-199`); (3) wire
   `withWeather(...)` into the boot-time nest in `main.ts:94-105` (+ a `[weather]` boot-log tag).
3. **Reuse the SSRF deny-list, NOT `safeFetch` directly, for the weather GET.** `safeFetch` hard-rejects
   any non-`text/html|text/plain` content-type (`safeFetch.ts:360-366`) — it would throw
   `unsupported_type` on the weather API's `application/json`. Instead call the **exported**
   `assertPublicUrl(url)` (`safeFetch.ts:143-179`) for SSRF validation, then do a plain `fetch`+JSON
   parse with `ctx.abortSignal`. The fake-IP proxy range is already allowed (`safeFetch.ts:77-81`,
   v0.18.3), so a normal HTTPS GET works.
4. **Soft-fail + progress are the tool convention.** Wrap the GET in try/catch and `yield {kind:'err',
   code: aborted ? 'aborted' : 'execution_exception', message, recoverable:true}` — never throw past the
   generator (`web_fetch.ts:102-122`); yield a leading `{kind:'progress', payload:{note:'…'}}` for the
   network wait (`web_search.ts:81-104`); read `timeoutMs` from env once at module load (it's a static
   dispatcher field) (`web_search.ts:59-75`).
5. **No location concept exists today — only the timezone.** `resolveTz()` reads/validates `LUNA_TZ`,
   degrade-to-host-zone-not-throw (`temporalContext.ts:82-91`). A location resolver should mirror it:
   `LUNA_LAT_LON` (`'lat,lon'`, range-checked, degrade-not-throw), co-located in `temporalContext.ts`.
6. **The "after-a-night opening" boolean is derivable from existing helpers — no new arithmetic.**
   `buildTimeBlock` already has, at `temporalContext.ts:217-229`: `daypart = classifyDaypart(hour)`
   (morning = local 06:00–11:59, `:138`), `crosses = localDayNumber(now) !== localDayNumber(last)`, and
   `bucket = classifyGap(gapSec, crosses)`. **Caveat:** `classifyGap` checks `longAway (≥86 400s)`
   *before* the calendar-day branch (`:171-172`), so a >24h overnight returns `'long_away'`, an 8–23h
   cross-midnight gap returns `'new_day'`. So `afterANightOpening = (last != null) && daypart ===
   'morning' && crosses && bucket ∈ {'new_day','long_away'}` (optionally `&& gapSec ≥ ~6h` to exclude a
   trivial cross-midnight blip — there is no minimum-overnight gate today).
7. **The proactive opening has one clean injection seam.** `framing(intent, session)`
   (`proactive/proactiveTurn.ts:47-59`) already appends a bounded, computed, ignorable parenthetical —
   the felt-absence clause (`:51-58`). A weather note is the same shape of mutation, ordered **after**
   felt-absence so both co-occur on a long-away morning wake; gate it on daypart (recompute inside
   `framing()`, matching `feltAbsenceFor`'s recompute-from-time discipline; `daypartOf` exists at
   `scheduler.ts:60-65` but isn't threaded in). It rides the **framing only** — never touches the wake
   *decision* (`wakeGate`), the cadence governor, or the anti-repeat list. Proactive turns are
   socket-less and persist to L2 regardless (Init 13 v0.20.8).
8. **The cached-clause hook is `renderL1Contract`.** `TIME_CLAUSE` is appended as a flag-gated, data-free
   clause (`persona/l1Contract.ts:98`) with the memo key including the gate flag (`:52`). A
   `WEATHER_CLAUSE` slots in identically, byte-stable per process.
9. **Version head = v0.20.9; next free contiguous range = v0.21.0+.**

## Python parity notes (`/Users/alanyu2077/Desktop/Agent_Luna`)

- **Net-new, not a port.** The Python original has **no** weather, geolocation, geocoding, Open-Meteo /
  OpenWeather, sunrise/climate, or any environmental-sensing feature in code or its version history. The
  only environmental signal it models is **time** (a daypart classifier + gap-since-last, injected as
  short natural-language lines into the proactive opener + L1 temporal guard). So Initiative 14 has no
  parity obligation; where it feeds weather into the opening, it *extends* the same place Python injects
  daypart context (`proactive.py:436` analog), and the opening prompt is currently environment-blind —
  feeding weather/time into the first line is a deliberate extension, not a restoration.

## Weather data source (web-verified)

- **Open-Meteo** (`https://api.open-meteo.com/v1/forecast`) — the single source: **free, NO API key**,
  lat/lon, current + today's high/low + precipitation/condition, generous limits (<10k calls/day; their
  server caches ~15 min). Minimal request for "current + today":
  `?latitude=..&longitude=..&current=temperature_2m,weather_code,precipitation,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset&timezone=<LUNA_TZ>&temperature_unit=celsius`.
  Condition comes from the **WMO `weather_code`** (0 clear … 95 thunderstorm), mapped to human text in
  code. Non-commercial use (a personal companion qualifies); CC-BY 4.0 attribution if ever surfaced
  publicly. Rejected: wttr.in (undocumented throttling), OpenWeatherMap (free tier needs a key).
- **No-key changes the gate:** unlike `web_search` (key-degrade), `weather` gates on the flag alone
  (`LUNA_WEATHER`), per-version default-OFF then flipped at close (Init-12 pattern).

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.21.0](v0.21.0-weather-tool.md) | v0.21.0 | **Weather tool + location config** — `LUNA_LAT_LON` resolver (degrade like `resolveTz`); a no-key Open-Meteo client (WMO-code map, `assertPublicUrl` SSRF-validate + plain JSON GET, soft-fail, test seam); a model-callable `weather` pull tool registered in the 3 places. Flag `LUNA_WEATHER` (default-off) | Low–Med | nothing | ✅ shipped |
| [v0.21.1](v0.21.1-ambient-weather.md) | v0.21.1 | **Passive ambient awareness** — a TTL-cached, background-refreshed snapshot (reusing the v0.21.0 client) read **synchronously** and formatted by a pure `buildWeatherBlock` pushed into the **uncached** tail next to `buildTimeBlock`; a stable `WEATHER_CLAUSE` in the cached contract. She *knows* without a tool call. Flag `LUNA_WEATHER_AMBIENT` (default-off) | Medium | v0.21.0 | ✅ shipped |
| [v0.21.2](v0.21.2-proactive-weather-close.md) | v0.21.2 | **Proactive weather in the opening + close** — the `afterANightOpening` boolean (from existing `temporalContext` helpers) gates a bounded `weatherNoteFor()` suggestion woven into `framing()` after the felt-absence clause (morning/after-overnight only); the "care, not forecast" guardrail; measure cache-hit-rate unchanged + **default-flip A/B/C on**; close. Flag `LUNA_WEATHER_PROACTIVE` (default-off → flip) | Medium | v0.21.0, v0.21.1 | ✅ shipped |

## Acceptance criteria for the whole initiative

- [ ] Luna can **look up** the weather for the configured location (the `weather` tool returns a
      structured, soft-failing result; never throws past the generator).
- [ ] Luna is **passively aware** of the weather — a correctly-labeled snapshot rides the **uncached
      tail**, with **zero** prompt-cache-prefix change (the pin test `recall.test.ts:193-238` stays
      green) and **zero** synchronous network call on the reactive turn (snapshot read from cache).
- [ ] On an **after-a-night / morning** wake she may open with a **natural, ignorable** weather note
      (care, not forecast) — and never recites weather on a routine afternoon continuation.
- [ ] **Location is configured** (`LUNA_LAT_LON`), validated, degrade-not-throw; an unset/ bad value
      omits weather rather than guessing or bricking a turn.
- [ ] Each version is **default-off-flagged**, E2E-verified, then flipped; `tsc` clean ×3 + `bun test`
      green per version; each logged in `docs/history/DEVELOPMENT.md` on ship.

## Open questions (settle at build time)

1. **Location precedence.** `LUNA_LAT_LON` (validated) → *omit weather if unset* (recommended) vs a
   coarse tz-centroid fallback (clearly labeled "approximate"). *Recommend omit-if-unset; no silent
   guessing.* Also: resolver in `temporalContext.ts` (co-located with `resolveTz`) vs a new
   `turn/location.ts`. *Recommend co-locate.*
2. **Refresh TTL / staleness.** Background refresh every ~15–30 min (respects Open-Meteo's ~15-min
   server cache + limits); omit the block past a staleness threshold (e.g. >2h). `LUNA_WEATHER_TTL_MIN`.
3. **Units.** Default **metric/°C** (Asia/Shanghai owner); optional `LUNA_WEATHER_UNITS`.
4. **`weather` tool input.** Zero-arg using the configured location (like `time_now`), with an optional
   `location` override — but Open-Meteo is lat/lon (no geocoding); free-text geocoding is **deferred**
   (separate Geocoding API call) unless the owner wants it in v0.21.0.
5. **Over-mention guard (C).** How strong/often the proactive note fires, and whether weather also
   lightly colors the subjective-mood line (`subjectiveTime` sibling). *Recommend morning/after-overnight
   only + bounded; observe in use and tune (or `LUNA_WEATHER_PROACTIVE=0`) — same lever as
   `LUNA_TIME_SUBJECTIVE`.*
6. **`afterANightOpening` minimum-gap.** Whether to require `gapSec ≥ ~6h` to exclude a trivial
   cross-midnight blip (no such gate exists today), and whether `'long_away'` (≥24h) counts as a
   "morning opening". *Recommend require ≥6h; include `long_away` when daypart is morning.*
