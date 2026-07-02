# Post-ship audit: v0.23.4 → v0.27.0 (OpenAI hardening · proactive ladder · collapsible UI · desktop app)

> **Status: AUDIT (advisory).** Audited **2026-07-02** across four workstreams shipped since the
> Initiative-16 audit: **v0.23.4** OpenAI hardening, **Initiative 17** proactive parity restore
> (v0.24.0–v0.24.2), **Initiative 18** collapsible companion UI (v0.25.0–v0.25.2), and **Initiative 19**
> the Electron desktop app (v0.26.0–v0.26.2, incl. the v0.27.0 settings-panel pet toggle). Verdict:
> **no critical**, **6 distinct high-severity issues**, 11 medium, 12 low, 11 info (48 filed → 45
> survived adversarial verification → 3 refuted). The single dominant issue is that the **v0.23.4
> remediation of the *previous* audit over-corrected**: `tool_choice:'required'` fixed "content
> silently dropped" but now makes every OpenAI turn loop to `MAX_TOOL_ITERATIONS`. The desktop shell
> adds a real security finding (cross-site WebSocket hijacking) and several process-lifecycle bugs.

## Method

Seven review lenses (electron-security · serve/supervisor · packaging/lifecycle · openai-hardening
regression · proactive ladder · web/UI · cross-cutting) fanned out over the `v0.23.4..HEAD` diff and
the consumer code, then **every** finding was adversarially re-verified against the code by a separate
skeptic (refute-by-default). Top items hand-confirmed. 55 agents. Scope = this range, including where a
**pre-existing design now interacts badly** with the new desktop deployment.

| Severity | Count | Character |
|---|---|---|
| Critical | 0 | — |
| High | 6 | A remediation that over-corrected · a cross-site backend hijack · Electron process/port/DB-lock crashes |
| Medium | 11 | Blast-radius of the `tool_choice` regression · supervisor/lifecycle gaps · lost proactive features |
| Low/Info | 23 | Defense-in-depth (CSP, nav guard) · env spread · doc/flag drift · zero tests on the riskiest desktop paths |

---

## Theme 1 — the `tool_choice:'required'` over-correction *(highest blast radius)*

The prior audit found "an OpenAI content-only reply in message mode is (almost) dropped." The v0.23.4
fix forced a tool call on every request
([`openaiProvider.ts:166,209`](../../../packages/server/src/provider/openai/openaiProvider.ts#L166),
`this.toolChoice` default `'required'`). That swung too far: **the model can now never end its turn.**
One root cause, six confirmed consequences:

- **[HIGH] Every OpenAI turn loops to `MAX_TOOL_ITERATIONS` (8 LLM calls).** After the `message` tool
  is dispatched and results appended, `requestBody` re-sends `tool_choice:'required'`, so the next
  round is *forced* to call a tool again — the model can never emit a natural `end_turn`. It loops
  until `MAX_TOOL_ITERATIONS=8` ([`runTurn.ts:369,516`](../../../packages/server/src/turn/runTurn.ts#L369)).
  *Trigger:* `LUNA_PROVIDER=openai` (or any `gpt-`/`o-` model) + default message mode — **every normal
  turn.** *Impact:* ~4–8× latency and token cost per turn, forced padding/duplicate `message` calls or
  spurious `read_file`/`recall`, polluted history/recall. Borderline critical (guaranteed degradation
  in the default OpenAI config).
- **[MEDIUM] `tool_choice:'required'` 400s on the OSS/third-party gateways the adapter exists to serve**
  ([`openaiProvider.ts:209`](../../../packages/server/src/provider/openai/openaiProvider.ts#L209)) —
  many OpenAI-compatible backends reject `required`.
- **[MEDIUM] Text mode (`LUNA_MESSAGE_TOOL=0`) is broken** — with `required` the model can never answer
  in free `content`; forcing is gated only on `tools.length>0`, not on message mode.
- **[MEDIUM] Message-mode integrity guards silently no-op on OpenAI** — empty-reply/promise/intent
  guards key off `finishReason==='end_turn'` ([`runTurn.ts:556,571`](../../../packages/server/src/turn/runTurn.ts#L556)),
  which OpenAI turns now never reach (they finalize via `max_iterations`).
- **[MEDIUM] Proactive turns can no longer stay silent on OpenAI**
  ([`proactiveTurn.ts:182-200`](../../../packages/server/src/proactive/proactiveTurn.ts#L182)) — silence
  is a designed proactive outcome (LD #15), but `required` forces a tool call every autonomous wake.

> **Fix:** default `toolChoice` to `'auto'` (safe everywhere), and rely on the empty-reply guard +
> degraded fallback (which the prior audit's Theme A recommended surfacing as a real bubble) to catch a
> content-only reply — **not** a blanket force. If forcing is kept for the message path, it must (a)
> force the `message` tool *specifically*, (b) switch to `'auto'`/`'none'` after tool results so a turn
> can end, (c) gate on message mode, and (d) fall back to `'auto'` on a 400. Add a
> `LUNA_OPENAI_TOOL_CHOICE` override. **This is the top blocker.**

---

## Theme 2 — Electron desktop shell: process / port / DB-lock lifecycle

- **[HIGH] Quit orphans the sidecar for up to 120s (port + SQLite WAL lock held).** `supervisor.stop()`
  sends a single `SIGTERM` ([`supervisor.ts:64-68`](../../../packages/desktop/src/supervisor.ts#L64));
  the sidecar catches it and runs the graceful **shutdown dream** (≤120s of consolidation).
  `LUNA_SHUTDOWN_DREAM=0` is set only for `SMOKE`, not normal quit
  ([`main.ts:83-84,181-185`](../../../packages/desktop/src/main.ts#L83)). *Trigger:* quit with a real
  key + an active session, then relaunch within ~120s. *Impact:* the zombie holds port 8790 → the new
  sidecar's `Bun.serve` throws `EADDRINUSE` (uncaught) and crash-loops; supervisor exhausts
  `maxRestarts` → "Luna's server did not start"; meanwhile the orphan keeps spending API credits.
  Found independently by three lenses. *Fix:* set `LUNA_SHUTDOWN_DREAM=0` for the desktop sidecar
  unconditionally, **and** escalate `SIGTERM`→`SIGKILL` after a short grace in `stop()`, and
  `before-quit` should `preventDefault()` and await child exit.
- **[HIGH] `serve.ts` crashes the whole app on a malformed `%`-escape.** `decodeURIComponent(...)`
  ([`serve.ts:28`](../../../packages/desktop/src/serve.ts#L28)) throws `URIError` on a path like `/%ZZ`;
  it is uncaught in the request handler → the Electron main process dies. *Trigger:* any request to
  `http://127.0.0.1:5177/%` (a bad asset URL, a stray fetch, a crawler). *Fix:* try/catch the parse →
  400, plus a top-level `server.on('error')`.
- **[HIGH] `server.listen` has no `'error'` handler → `EADDRINUSE` is an uncaught crash.**
  ([`serve.ts:41-42`](../../../packages/desktop/src/serve.ts#L41)). *Trigger:* launch while 5177 is
  held (relaunch race, second instance). *Fix:* attach `server.on('error', …)` before listen; retry or
  exit cleanly.
- **[MEDIUM] No single-instance lock.** Two instances share one SQLite DB and both bind the fixed
  ports ([`main.ts:31-49,154-165`](../../../packages/desktop/src/main.ts#L31)). *Fix:*
  `app.requestSingleInstanceLock()`.
- **[MEDIUM] Supervisor: restart counter never resets on a healthy run + no backoff.** `restarts` only
  increments ([`supervisor.ts:41,52-58`](../../../packages/desktop/src/supervisor.ts#L41)); occasional
  crashes over a long session accumulate to a premature permanent give-up, and a fast-failing sidecar
  tight-loops with no delay. *Fix:* reset after a stability window; add exponential backoff; surface
  give-up in a dialog.
- **[LOW] Path-jail is a `startsWith(root)` prefix check** ([`serve.ts:33-34`](../../../packages/desktop/src/serve.ts#L33))
  — a sibling dir like `<root>-secret` escapes; also `%2f`-encoded traversal is not separator-bounded.
  Loopback-only + static build keeps it low, but the check should append a path separator.

---

## Theme 3 — desktop security posture

- **[HIGH] The local WebSocket server accepts upgrades with no `Origin` check → cross-site WebSocket
  hijacking.** ([`server/main.ts:193-203`](../../../packages/server/src/main.ts#L193) upgrades
  unconditionally.) In the desktop deployment the port is **fixed and always up on loopback**, so any
  web page the user visits can `new WebSocket('ws://127.0.0.1:8790')` and drive Luna — send/exfiltrate
  conversation, spend API budget, spoof GPS location, or trigger dream — with no interaction beyond
  visiting the page. A pre-existing behavior made newly and reliably exploitable by the desktop pinning.
  *Fix:* reject the upgrade unless `Origin` matches the loopback web origin, and/or a per-launch shared
  secret the shell injects into both page and server. **The most serious security finding.**
- **[LOW] No CSP on the Electron-loaded pages** — no `Content-Security-Policy` anywhere
  ([`serve.ts:38`](../../../packages/desktop/src/serve.ts#L38), no `onHeadersReceived`, no `<meta>`).
  Downgraded from high: there is **no currently-reachable HTML-injection sink** (the only `innerHTML` is
  a static literal in `bootGate.ts`; speech uses `textContent`), and `contextIsolation:true` +
  `nodeIntegration:false` confine a hypothetical injected script. Still, CSP is the mandated
  defense-in-depth for an app rendering model text; add `connect-src` whitelisting only the WS port.
- **[LOW] No `will-navigate` / `setWindowOpenHandler` guard + the `?ws=` parser accepts a host via
  userinfo.** `resolveWsUrl` ([`wsUrl.ts`](../../../packages/web/src/wsUrl.ts)) interpolates the raw
  `?ws=` into `ws://127.0.0.1:${port}` unvalidated; `new URL('ws://127.0.0.1:@evil.com').host ===
  'evil.com'`, so the "pinned loopback" promise is bypassable if a navigation ever carries `?ws=@host`.
  *Fix:* pin the origin on `will-navigate`, deny `window.open`, and reject any `?ws=` that isn't a bare
  numeric port.
- **[LOW] `lunaPet.setIgnore` IPC has no state guard** — a renderer can lock the pet window permanently
  click-through (input DoS). **[LOW] `sidecarEnv` spreads the full parent `process.env`** into the child
  ([`main.ts:68-77`](../../../packages/desktop/src/main.ts#L68)). **[INFO] Renderer `sandbox` is
  implicit** (never set) — a future `webPreferences` edit could silently disable it.

---

## Theme 4 — proactive silence-ladder (Initiative 17)

- **[HIGH] `leave_message` never winds down to `dormant`.** In the `nudged` block, once
  `nudgesSent >= maxNudges` the evaluator returns `leave_message` on every eligible tick
  ([`ladder.ts:133-138`](../../../packages/server/src/proactive/ladder.ts#L133)) with no transition to a
  terminal state. If the model stays silent on the leave_message turn (which the framing explicitly
  invites, [`proactiveTurn.ts:123-126`](../../../packages/server/src/proactive/proactiveTurn.ts#L123)),
  she offers `leave_message` **forever** at renudge spacing (base×6, ~30 min default), each a full LLM
  call — self-perpetuating burn, no release. *Fix:* set `phase='dormant'` when returning
  `leave_message` so the transition persists on both spoke and silent paths; add a silent-tick test.
- **[MEDIUM] The proactive weather note (Initiative 14) is dead on every autonomous wake.** The
  scenario path bypasses `framing()`/`proactiveWeatherNote()`
  ([`proactiveTurn.ts:159-186`](../../../packages/server/src/proactive/proactiveTurn.ts#L159),
  [`fire.ts:100-107`](../../../packages/server/src/proactive/fire.ts#L100)). *Fix:* fold the weather/
  after-night coloring into `scenarioFraming()`, or remove the dead seed param to avoid false coverage.
- **[LOW] The weather event-hook now fires the ladder on every refresh** — the notability check was
  deleted with the `weatherShift` detector; **[LOW] docs/comments still claim** weather-shift decides
  notability. **[INFO] `nudgeProb=0`** (or via `aloof` scaling) can strand the machine in `idle_watch`;
  **[INFO] `num()>0`** guards reject legitimate `0` knobs (`MAX_NUDGES=0`) by silently using defaults.

*(Refuted: "the after-night morning greeting is lost" — the `sleeping`-on-long-absence behavior is the
documented design, not a regression.)*

---

## Theme 5 — collapsible companion UI (Initiative 18)

- **[MEDIUM] Pet-mode body is permanently click-through when the Live2D sink is absent.** The hit-test
  needs the model rect from the sink ([`app.ts:218-243`](../../../packages/web/src/app.ts#L218),
  [`petHitTest.ts:24-39`](../../../packages/web/src/ui/petHitTest.ts#L24)); on WebGL failure / model
  load failure / `luna:live2d` off, `isInteractivePoint` has no body rect → Luna is a transparent,
  always-on-top, fully non-interactive window the user can't click or dismiss. *Fix:* publish a fallback
  interactive rect (placeholder bounding box), or hard-fail pet mode when the sink is null.
- **[INFO] First-frame click-through** before the sink publishes model vars; **[INFO] the `--luna-head-x`
  anchor is floored at 170px**, decoupling the bubble stack from the model near the left edge.

*(Refuted: "an unguarded `luna:collapsed` `getItem` aborts boot" — the read path does not throw the way
claimed.)*

---

## Theme 6 — cross-cutting hygiene

- **[LOW] `.env.example` drift** — advertises deleted detector knobs (`LUNA_PROACTIVE_SLOTS`,
  `weatherShift`) and omits every new Initiative-17/19 var (`LUNA_PROACTIVE_LADDER`,
  `LUNA_PROACTIVE_STYLE`, the `LUNA_PROACTIVE_*` cadence knobs, `LUNA_DESKTOP_WS_PORT`, `LUNA_PET_MODE`,
  `LUNA_SMOKE`, `LUNA_SHUTDOWN_DREAM`).
- **[LOW] Zero tests on the highest-risk desktop paths** (`serve.ts`, `main.ts`).
- **[INFO] Older app build over a newer app-data DB** silently runs against an unknown schema (no schema
  guard). **[INFO] The unsigned nested `luna-server` binary** will be Gatekeeper-killed when spawned
  from a distributed/quarantined app.
- **[Note — v0.27.0]** `writeShellSettings` ([`shellSettings.ts:26-28`](../../../packages/desktop/src/shellSettings.ts#L26))
  rewrites the whole `settings.json`; harmless at one field, but it will clobber sibling settings once
  `ShellSettings` grows — merge-on-write when a second field lands.

*(Refuted: "templated `luna.env` ships empty `ANTHROPIC_BASE_URL` breaking every turn" — the SDK
defaults an empty base URL correctly.)*

---

## Recommended remediation order (proposed v0.27.1 — "hardening")

Blockers first (the first two are the ones a real deployment hits immediately):

1. **Theme 1 — `tool_choice`.** Default to `'auto'`; surface a content-only reply as a bubble; gate any
   forcing on message mode + first round; `LUNA_OPENAI_TOOL_CHOICE` escape hatch. Fixes 6 findings at
   once and restores the integrity guards + proactive silence.
2. **Theme 2 — desktop lifecycle.** `LUNA_SHUTDOWN_DREAM=0` on the desktop sidecar + `SIGTERM`→`SIGKILL`
   escalation; wrap `serve.ts` (try/catch decode + `server.on('error')`); `requestSingleInstanceLock()`.
3. **Theme 3 — security.** WS `Origin` check (CSWSH); then CSP + navigation guard + `?ws=` validation.
4. **Theme 4 — ladder.** Make `leave_message` terminal → `dormant`; restore or remove the weather note.
5. **Theme 5/6 — pet-mode fallback rect; `.env.example` refresh; tests for `serve.ts`/supervisor/ladder
   stuck-states.**

> All findings were produced by static review; **no live desktop run and no live OpenAI run** back
> them — verify against the packaged app and a real gateway when each is first exercised.
