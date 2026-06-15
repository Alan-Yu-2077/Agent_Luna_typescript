# Code Audit & Reminders — Agent_Luna (TypeScript)

**Audited at:** v0.13.11 (`bdfed13`), 2026-06-15
**Method:** file-by-file read of all three packages (protocol / server / web), plus
`bun test` + `bun x tsc --noEmit` on every package, plus targeted greps to confirm each claim
against code (not docs).
**Health baseline at audit time:** `bun test` → **305 / 305 pass** (46 files); `tsc --noEmit`
clean on protocol, server, and web.

> **What this document is.** A consolidated, code-verified reminder of the project's real
> strengths and its open risks, so they are not rediscovered from scratch each session and not
> silently re-litigated. Every finding cites `file:line`. Severity is rated for the project's
> actual deployment shape — a **local, single-user companion** — and called out separately where
> it changes on an untrusted network. This is a *reminder*, not a roadmap: nothing here is a
> committed plan. Promote items into `roadmap/` when you decide to act.

---

## At a glance

| ID | Severity | Area | One line | Status |
|---|---|---|---|---|
| S1 | **P0** | Security | Server binds `0.0.0.0` with no auth on WS or any viewer route | open |
| S2 | **P0** | Security | `/_workspace` is an unauthenticated read/write IDE over the whole DB | open |
| S3 | P1 | Security | WS replays the full conversation to any socket on connect | open |
| S4 | P1 | Security | `read_file` has no path sandbox + is `proactiveRisk:'safe'` | open |
| S5 | P2 | Security | `chat.send` text uncapped + no WS payload limit (cost/DoS) | open |
| P1 | P1 | Performance | Recall embedding runs a sync network round-trip on the hot path | open |
| P2 | P2 | Scalability | `history_json` fully re-serialized + rewritten every turn | open |
| P3 | P3 | Performance | Retrieval is brute-force TS cosine, not vec0 KNN | open |
| D1 | P2 | Dead code | `vec0`/`sqlite-vec` table is written every turn but never queried | open |
| D2 | P3 | Dead code | `reply.token` / text-mode path is dead in message mode (the default) | open |
| C1 | P2 | Process | No CI — nothing enforces the green test bar on push | open |
| C2 | P3 | Robustness | Frontend drops messages sent during reconnect (bubble still shows) | open |
| C3 | P3 | Correctness | Proactive daily quota keyed to UTC date, quiet-hours to local time | open |
| C4 | P3 | Robustness | `fromBlob` assumes 4-byte-aligned SQLite blobs | open |
| Doc1 | P2 | Docs | `README.md` still says "scaffolding only … no runtime code yet" | open |
| Doc2 | P3 | Docs | `luna-ts-orient` skill stale by ~6 versions (self-reports v0.12.0) | open |

---

## Security

The project is a **local single-user companion**. The realistic threat model is (a) running it on
an untrusted/shared network, and (b) prompt-injection steering the agent via conversation content.
There is **no exfiltration tool** shipped (no `shell`, no network-write, no email), which bounds
blast radius — but secrets (`.env` API keys) and the full conversation are reachable, and the new
`/_workspace` route is directly reachable over HTTP without going through the model at all.

### S1 — Unauthenticated network exposure (P0)

`Bun.serve` is started with no `hostname`, so it binds `0.0.0.0` (all interfaces), and there is no
auth / token / origin check on the WS upgrade or on any HTTP route.

- `packages/server/src/main.ts:72` — `Bun.serve({ port, async fetch … })`, no `hostname`.
- `packages/server/src/main.ts:78` — `srv.upgrade(req, { data: { sessionId: 'default' } })`, no
  credential/origin check.
- Confirmed by grep: no `authorization` / `token` / `origin` handling anywhere in `main.ts`,
  `ws.ts`, `workspace.ts`, or `trace/viewer.ts`.

**Why it matters:** on any shared network, anyone who can reach the port can drive the agent and
open every viewer route below.

**Suggested fix (one line, highest leverage):** bind to loopback —
`Bun.serve({ port, hostname: '127.0.0.1', … })`. This single change pulls WS + `/_trace` +
`/_chat` + `/_workspace` back to localhost. If remote access is ever wanted, add a shared-secret
token check at the `fetch`/upgrade boundary instead of opening the interface.

### S2 — `/_workspace` is an unauthenticated DB read/write IDE (P0)

`packages/server/src/workspace/workspace.ts` serves a "developer data IDE" gated only by
`LUNA_VIEWER` (default **on**):

- `GET /_workspace/api/all` (`workspace.ts:108`) → dumps **every** table, including `sessions`
  (the full conversation), `l2_turns`, `l3_facts`, `core_memory`, `diaries`.
- `POST /_workspace/api/reset` (`workspace.ts:113`) → deletes conversation + memory + traces.
- `POST /_workspace/api/edit` (`workspace.ts:118`) → updates / deletes any cell or row in any
  table.

Combined with **S1**, this means an unauthenticated party on the same network can read the entire
companion's memory and tamper with or wipe the database **without going through the model**.

**Not a SQL-injection bug:** table and column names are validated against `tableNames()` /
`PRAGMA table_info` allowlists before interpolation (`workspace.ts:129`, `:137`), and values use
bound parameters. The problem is purely *exposure + lack of auth*, which S1's loopback bind fixes.
Consider additionally gating mutating routes behind an explicit `LUNA_DEV_TOOLS`-style flag.

### S3 — Full conversation replayed to any connecting socket (P1)

`packages/server/src/ws.ts:87` (`handleOpen`) sends a `history` event with up to the last 300 L2
turns to **every** socket that connects. This is a good refresh-rehydration feature locally, but on
an exposed server (S1) it hands the entire recent conversation to anyone who opens a WebSocket.
Resolved implicitly by S1's loopback bind; no separate change needed if S1 lands.

### S4 — `read_file` has no path sandbox and is proactive-safe (P1)

`packages/server/src/tools/builtin/read_file.ts:33` does `Bun.file(input.path).text()` with **no**
root confinement, no `..` check, no allowlist (grep confirms no path-sandboxing anywhere under
`tools/`). It is mounted in `builtinRegistry` (`tools/registry.ts:20`, model-reachable) and marked
`proactiveRisk: 'safe'` (`read_file.ts:23`).

**Why it matters:** the model can read any file the process can — `.env` (the `ANTHROPIC_API_KEY`),
`~/.ssh/…`, `luna.sqlite`. Because it is `'safe'`, in an **autonomous proactive turn**
(`LUNA_PROACTIVE` default on) Luna can read arbitrary local files **silently**, without surfacing.
Reachable via prompt-injection in conversation content even in reactive turns.

**Suggested fix:** confine reads to an allowlisted root (resolve + `startsWith` the repo/workspace
root); and reconsider whether arbitrary file read should be `proactiveRisk:'safe'` (downgrading it
to `'surface'` forces an announce-before-act in proactive turns).

### S5 — Uncapped input on an unauthenticated socket (P2)

`ChatSendEvent.text` is `z.string().min(1)` with **no max** (`packages/protocol/src/events.ts:19`),
and `Bun.serve` sets no `maxPayloadLength`. An attacker (or a buggy client) can send an arbitrarily
large `chat.send`, which becomes a large LLM request — a cheap way to burn the API key and balloon
memory. Add a reasonable `.max()` on the text and/or a WS payload cap.

---

## Performance & scalability

### P1 — Recall embedding on the hot path (P1)

`packages/server/src/turn/runTurn.ts:164` (`parse_input`) `await`s `retrieve()` **before**
`open_stream`. Inside `retrieve()` (`memory/recall/recall.ts:133`):

- the user query is embedded with a synchronous HTTP round-trip, and because each turn's query is
  effectively novel text, it is almost always a cache miss (`recall.ts:149-156`);
- on a cold candidate cache it then embeds up to 64 more candidate texts in a second sequential
  call (`recall.ts:161-172`).

So a cold-cache turn performs **one or two embedding network round-trips before the first LLM
token**, landing directly on time-to-first-token — in tension with the project's #1 goal
(end-to-end speed). Mitigated by dream's `rag_refresh` pre-warm and per-text caching, but the query
embedding stays on the critical path.

**Suggested direction:** overlap the query embedding with the LLM first-byte (don't block
`open_stream` on it), or give recall a latency budget that falls back to lexical-only.

### P2 — `history_json` rewritten in full every turn (P2)

`session.history` is never truncated — the L1 window only bounds what is *sent* to the model
(`memory/l1Window.ts:16`), not what is *stored*. `persistSession`
(`memory/sessionStore.ts:61`) does `JSON.stringify(history)` over the whole array on **every**
turn. For a companion meant to run for a long time this is an O(N) serialize+write per turn → O(N²)
over the session's life. (L2 is correctly append-only; this is specifically the `sessions` blob.)

**Suggested direction:** persist history incrementally, or store only the active window and rebuild
from L2 on load.

### P3 — Brute-force cosine retrieval (P3)

`retrieve()` loads candidate embedding BLOBs and computes cosine in TypeScript over up to 500 L2
rows + all L3 facts × 3072 dims, every recall (`recall.ts:158-174`). Fine at single-user scale, but
this is the work the `vec0` table (D1) was meant to do.

---

## Dead code / unrealized infrastructure

### D1 — `vec0` / `sqlite-vec` is write-only (P2)

`vec_cache` (a `vec0` virtual table) is created and `INSERT`ed into on every `storeEmbedding`
(`recall.ts:73-77`, `:93`), but it is **never queried** — grep confirms no `MATCH`/KNN against
`vec_cache` anywhere; retrieval is the TS cosine in P3. So the entire `sqlite-vec` integration
(the dependency, `initCustomSqlite`, `tryLoadVec`, the table, the inserts) produces **zero
functional value** for retrieval, and the v0.4.3 "embedding-first sqlite-vec" claim is unrealized.

**Decide one way:** either wire `vec0` KNN into `retrieve()` (and get P3's speedup), or remove the
`vec_cache` machinery and the `sqlite-vec` dependency and document that recall is TS cosine.

### D2 — `reply.token` / text-mode path is dead in the default mode (P3)

Since v0.13.6, `reply.token` is **not emitted** in message-tool mode
(`runTurn.ts:201` — `if (!isMessageMode(s.registry)) s.emit({ reply.token })`). With message mode
the default (and the OSS-packaging direction), the `LUNA_MESSAGE_TOOL=0` branch, the `reply.token`
event, and the controller's `TEXT_BUBBLE` path are a legacy mode kept alive only for a flag that may
never be flipped. If message mode is the only supported mode, removing the text-mode path is a clean
simplification.

> **Streaming vs. cost (recorded from review discussion):** streaming is **billing-neutral** — the
> Anthropic API generates and bills the same tokens whether or not you stream; SSE only changes
> delivery. Cost in this codebase lives in **correction/integrity retries** (each re-sends context +
> regenerates — `runTurn` finalize guards) and **multi-message/multi-tool round trips** (mitigated by
> the single `cache_control` system block). Keep the streaming-simplification decision (D2 and the
> `tool.progress` message preview) **decoupled** from cost; it is an experience-vs-complexity call,
> not a cost call.

---

## Correctness & robustness

### C1 — No CI (P2)

No `.github/workflows`. For a project that deliberately pins invariants with tests (byte-stable
system prompt, soft-delete, dream-never-overlaps-turn, …), nothing enforces `bun test` + `tsc` on
push. A minimal workflow running both on PR would protect every test-pinned invariant.

### C2 — Frontend drops messages sent during reconnect (P3)

`wsClient.send()` silently drops when the socket is not `OPEN`
(`packages/web/src/wsClient.ts:46`), but `app.ts` has already rendered the user's bubble
(`app.ts` `send()`), so a message typed while reconnecting is lost while its bubble remains visible.
Reconnect is also a fixed 1.5s with no backoff/jitter (`wsClient.ts:41`). Consider buffering unsent
frames and flushing on reopen.

### C3 — Proactive quota timezone split (P3)

`cadence.ts`: the daily quota is keyed to a **UTC** date (`dateKey` → `toISOString`,
`cadence.ts:38`), while quiet-hours use **local** hours (`new Date().getHours()`,
`scheduler.ts:106`). The "daily" quota therefore resets at a local time that depends on the user's
offset (e.g. 08:00 local at UTC+8). Pick one clock.

### C4 — `fromBlob` alignment assumption (P3)

`memory/recall/embed.ts:40` builds a `Float32Array` from `blob.buffer` + `byteOffset`. If
`bun:sqlite` ever returns a BLOB whose `Uint8Array` is not 4-byte aligned, this throws. Works in
practice today; copy into a fresh buffer if it ever bites.

### C5 — `turn.result.usage` is cumulative (note, by design)

`runTurn` sums `input_tokens` across tool iterations (`runTurn.ts:227`), so a multi-round turn
reports the summed (re-sent) context. Accurate for billing; just be aware it is per-turn-total, not
per-final-request.

---

## Documentation accuracy

- **Doc1 —** `README.md:12` still reads *"This repo is scaffolding only at this point. No runtime
  code yet."* This is false at v0.13.11 (≈7.5k LOC, full stack shipped). The front-door README
  contradicts reality.
- **Doc2 —** the `luna-ts-orient` skill self-reports head **v0.12.0** and a **v0.7.0** file map; the
  real head is **v0.13.11**. By the skill's own rule ("stale by 3 versions is worse than no skill")
  it needs a refresh.

---

## Verified sound — do not re-litigate

Recorded so future audits don't re-spend effort here. These were checked and found correct:

- **Concurrency model.** Every check-then-set guard completes before its first `await`, so the
  single-threaded event loop makes them race-free: `session.activeTurn` (`ws.ts:164`),
  `enterDream` (`dream/dreamState.ts:50`), the scheduler's `ticking` flag (`scheduler.ts:93`). The
  scheduler also re-checks TOCTOU state after the `wakeGate` LLM call (`scheduler.ts:131`).
- **Error-handling discipline.** `runTurn`'s `finally` wraps persistence, audit, trace flush, and
  fold so none can reject the turn promise or skip cleanup (`runTurn.ts:609-652`); there is an
  `unhandledRejection` process backstop (`main.ts:40`).
- **No SQL injection.** Workspace identifiers are allowlist-validated, values are bound (S2);
  `migrate()` interpolates only a filename-derived integer (`sql.ts:48`).
- **Tool dispatcher.** Concurrency tiers + `AbortController` timeout + input/output Zod validation +
  generator cleanup are all present and tested (`tools/dispatcher.ts`).
- **Wire contract.** Every inbound and outbound frame is Zod-validated at both ends
  (`ws.ts:116`, `outbound.ts`, `web/src/wsClient.ts:36`) — the rewrite's core anti-drift property,
  intact.

---

## Suggested order of attack

1. **S1** — bind `127.0.0.1` (one line; neutralizes S1/S2/S3 exposure at once).
2. **S4** — sandbox `read_file` to an allowlisted root; reconsider its proactive-safe tier.
3. **D1** — decide vec0: wire it into `retrieve()` (also fixes P3) or remove it + the dependency.
4. **P1 / P2** — take recall embedding off the critical path; stop full-rewriting `history_json`.
5. **C1** — add a CI workflow running `bun test` + `tsc`.
6. **Doc1 / Doc2** — fix the README and refresh the orient skill.
