# Initiative 9 — Audit remediation (security · efficiency · hygiene)

> **Status: 📋 PLANNED.** Priority: after Initiative 8 (code-agent). Version range:
> **v0.16.0 – v0.16.3** (4 versions). Master index: [`../README.md`](../README.md).
> Source: the code-verified audits in PRs #1 ([`CODE_AUDIT.md`]) and #2 ([`ARCH_EFFICIENCY.md`]),
> every finding re-verified against HEAD (v0.13.13) before this roadmap was written.

## The idea

Two independent audits flagged a consistent set of real issues in the shipped stack: an
**unauthenticated network surface** (the server binds `0.0.0.0`, the `/_workspace` IDE can read/write
the whole DB), a recurring **"recompute derived state from the full corpus every turn"** inefficiency
(O(N²) over a session, against the project's #1 goal of speed), and some **dead infrastructure**
(`vec0` is write-only; the text-mode path is dead under message mode) plus **process/doc gaps** (no CI,
a stale front-door README, a stale orient skill). None of these break the single-user happy path today
— which is exactly why they need a roadmap, not a fire drill. This initiative remediates them in three
risk-ordered slices: cheap-and-safe first, recompute next, persistence/decisions last.

## Why now / why this shape

Every finding was confirmed against current source (see the verdict table). The work is *remediation* —
making the existing system safe and fast — so it is mostly mechanical and low-risk, and it is a
**prerequisite for Initiative 10**: PR #3 wants a 15–30× larger L1 window, which only stays within the
speed goal once the per-turn recompute (A1/A2/A3) is fixed. Harden → make-it-fast → then grow the window.

## Verified facts (audit re-confirmed at HEAD v0.13.13, with citations)

Every claim below was re-verified file-by-file (three parallel verification passes, 28/28 confirmed,
0 refuted, 0 stale). Later plans reference these instead of re-deriving.

**Security**
1. **S1 (P0)** — `Bun.serve<WSData>({ port, ... })` has **no `hostname`** → binds `0.0.0.0`
   (`packages/server/src/main.ts:72`); the WS `upgrade` sets no auth/origin/token
   (`main.ts:83`); grep of `main.ts`/`ws.ts`/`workspace/*`/`trace/viewer.ts` for
   `authorization|token|origin` → none.
2. **S2 (P0)** — `/_workspace/api/all` dumps every table, `/reset` deletes, `/edit`
   updates/deletes any row (`workspace/workspace.ts:108,113,132`), gated only by `LUNA_VIEWER`
   (default ON, `main.ts:34`). **Not SQL-injectable** — identifiers are allowlist-validated
   (`workspace.ts:129,138`), values bound. The issue is *exposure + no auth*.
3. **S3 (P1)** — `handleOpen` replays up to the last 300 L2 turns to every socket on connect
   (`ws.ts:85`). Resolved implicitly by S1's loopback bind.
4. **S4 (P1)** — `read_file` has **no path sandbox** (`Bun.file(input.path).text()`,
   `tools/builtin/read_file.ts:33`) and is `proactiveRisk:'safe'` (`:22`). **Already owned by
   Initiative 8 / v0.15.0** (`resolveInWorkspace` jail) — *not re-planned here; cross-referenced only.*
5. **S5 (P2)** — `ChatSendEvent.text` is `z.string().min(1)` with **no `.max()`**
   (`packages/protocol/src/events.ts:19`); `Bun.serve` sets no `maxPayloadLength`.

**Efficiency / recompute** (PR #2's one pattern)
6. **A1 (P1)** — `buildSystemPrompt` is rebuilt on **every** tool iteration (`open_stream` is a
   looped node, ≤8/turn; `runTurn.ts:192,384`); each rebuild = `renderCoreBlock` 6 DB queries
   (`getCore` + `listFacts`×5 categories, `renderCoreBlock.ts:36,48`; `listFacts` un-memoized
   `l3Store.ts:67`) + an uncached `renderL1Contract` (`persona/l1Contract.ts:6`). The tool schema
   **is** memoized once/turn (`runTurn.ts:179`); the system block never got the same treatment.
   Prefix cache still hits (no extra API spend) — wasted server CPU/DB only.
7. **A2 (P1)** — `retrieve()` (`recall/recall.ts:139`, once/turn from `runTurn.ts:168`, again on the
   `recall` tool) calls `listL2` with no limit → default **10 000** (`sessionStore.ts:114`), then
   `.slice(-500)` (`recall.ts:114`); and sha256-hashes all ~500 candidates every call
   (`recall.ts:158`), hashes never persisted as a column.
8. **P1/hot-path (P1)** — `parse_input` `await`s `retrieve()` **before** `open_stream`
   (`runTurn.ts:168` → `:185`); a cold-cache turn does 1–2 embedding network round-trips
   (`recall.ts:151`, up to `MAX_EMBED_PER_TURN=64` more, `:19,164`) **before the first LLM token** —
   directly on TTFT.
9. **A3/P2 (P2)** — `session.history` is never truncated (the L1 window only bounds what's *sent*,
   `l1Window.ts:14`); `persistSession` does `JSON.stringify(history)` over the whole array every turn
   (`sessionStore.ts:74`, called `runTurn.ts:633`) → O(N) write/turn, O(N²)/session.
10. **A4 (P2)** — `traces` has a per-turn 500 cap but **no global retention** (no `DELETE FROM
    traces` anywhere); `listTurns` aggregates the **whole** table (`store.ts:95`); the viewer
    auto-refreshes every 2 s (`viewer/index.html:172`).

**Dead code / decisions**
11. **D1/P3 (P2)** — `vec_cache` (a `vec0` virtual table) is created + INSERTed every `storeEmbedding`
    (`recall.ts:73,75,93`) but **never queried** — the only KNN `MATCH` in the repo is in
    `scripts/spike-sqlite-vec.ts` (a spike). Retrieval is brute-force TS cosine (`recall.ts:174`).
    The v0.4.3 "embedding-first sqlite-vec" claim is unrealized.
12. **D2 (P3)** — `reply.token` is emitted only `if (!isMessageMode(s.registry))` (`runTurn.ts:205`);
    message mode is the default (`main.ts:58`). The `LUNA_MESSAGE_TOOL=0` text path + the
    controller's text-bubble branch are dead under the default.

**Correctness / process**
13. **C1 (P2)** — no `.github/workflows` (no CI enforcing `bun test` + `tsc`).
14. **C2 (P3)** — `wsClient.send()` silently drops when the socket isn't OPEN (`web/src/wsClient.ts:46`)
    after `app.ts` already rendered the bubble; reconnect is a fixed 1.5 s, no backoff (`:41`).
15. **C3 (P3)** — proactive **daily quota** keyed to a **UTC** date (`cadence.ts:39`) while
    **quiet-hours** use **local** `getHours()` (`scheduler.ts:106`).
16. **C4 (P3)** — `fromBlob` builds a `Float32Array` off `blob.buffer`+byteOffset (4-byte-alignment
    assumption, `recall/embed.ts:41`).
17. **Doc1 (P2)** — `README.md:12` still says *"scaffolding only … no runtime code yet."*
18. **Doc2 (P3)** — the `luna-ts-orient` skill self-reports head **v0.12.0** (real head v0.13.13).

## Verified sound — do NOT re-litigate (from the audits, re-confirmed)
Concurrency guards are race-free (check-then-set before first `await`); `runTurn`'s `finally` can't
reject the turn; no SQL injection (allowlist + bound params); the tool dispatcher (tiers + abort +
Zod) is correct; the wire contract is Zod-validated at both ends; **all hot-query indexes exist**
(so A1–A4 are *recompute* costs, not missing indexes); the prompt-cache uses one `cache_control`
breakpoint on a stable prefix (A1's waste is server-side only). Streaming is **billing-neutral**.

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.16.0](v0.16.0-security-hygiene.md) | v0.16.0 | Security + hygiene — loopback bind (S1→closes S2/S3 net exposure), dev-tools gate (S2), input caps (S5), CI (C1), README/orient (Doc1/2), small robustness (C2/C3/C4) | Low | nothing | 📋 |
| [v0.16.1](v0.16.1-recompute-efficiency.md) | v0.16.1 | Recompute efficiency — memoize system block (A1), trace retention (A4), recall over-fetch + `content_hash` column (A2), recall off the TTFT path (P1) | Low–Med | v0.16.0 | 📋 |
| [v0.16.2](v0.16.2-persistence-vec0.md) | v0.16.2 | Persistence + dead infra — incremental `history_json` (A3/P2), decide `vec0` (wire KNN or remove, D1/P3), remove the dead text-mode path (D2) | Medium | v0.16.1 | 📋 |
| [v0.16.3](v0.16.3-clean-history.md) | v0.16.3 | **Clean durable history** — strip thinking blocks + collapse old tool-result payloads from stored history (a turn → ~200 clean tokens). *Discussion-derived; the efficiency foundation Initiative 10's deeper window builds on.* | Low–Med | v0.16.2 | 📋 |

## Acceptance criteria (whole initiative)
- [ ] Server is not reachable off-host by default (loopback bind), mutating dev routes are flag-gated,
      `chat.send` is length-capped — S1/S2/S3/S5 closed; tested.
- [ ] The system block is memoized per turn (re-rendered only on memory change); traces have a
      retention window; recall reads only what it needs and reuses persisted content hashes; the recall
      query-embed no longer blocks the first LLM token — A1/A2/A4/P1 closed; tested.
- [ ] `history_json` is no longer fully rewritten every turn; `vec0` is either wired into retrieval or
      removed with the dependency; the dead text-mode path is removed or explicitly retained — A3/D1/D2
      resolved.
- [ ] CI runs `bun test` + `tsc` on every PR; the README and orient skill reflect v0.16.x.
- [ ] `tsc` clean + `bun test` green at every version; each behavior-changing item default-off-flagged,
      verified, then flipped.

## Open questions blocking start
1. **Loopback default** — bind `127.0.0.1` unconditionally, or keep `0.0.0.0` behind an explicit
   `LUNA_BIND_HOST` for users who *want* LAN access? (Recommend: default loopback; opt-in host var.)
2. **vec0 decision (D1)** — wire `vec0` KNN into `retrieve()` (keeps the dep, fixes P3) **or** remove
   `sqlite-vec` + the `vec_cache` machinery and document TS cosine? (Recommend: at single-user scale,
   *remove* — TS cosine over ≤512 vectors is fine; revisit if the corpus grows. But see Initiative 10:
   a ~100-clean-turn window + diary candidates enlarges the corpus, which may tip this toward *wire it*.)
3. **Text-mode removal (D2)** — is message mode permanent (remove the `LUNA_MESSAGE_TOOL=0` path
   entirely) or kept as an escape hatch? (Recommend: remove once Initiative 10's window work is done,
   so there's a single context-assembly path to reason about.)
