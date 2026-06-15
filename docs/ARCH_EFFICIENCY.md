# Architectural Efficiency — findings & reminders

**Audited at:** v0.13.11 (`bdfed13`), 2026-06-15
**Scope:** *design-level* inefficiency only — places where the architecture does avoidable work,
not point bugs. (For the broader security/correctness audit see
[`CODE_AUDIT.md`](CODE_AUDIT.md); the `P1–P3` performance items there are the point-level symptoms
of the structural pattern described here.)
**Method:** file-by-file read + targeted greps; every claim cites `file:line`.

> **The one pattern.** Across four independent subsystems the code **recomputes derived state from
> the full corpus on every turn — sometimes every tool iteration — instead of maintaining it
> incrementally or caching it.** At single-user scale today this is invisible. But each item is
> `O(history)` per turn, so it compounds to **`O(N²)` over a session's life**, which runs directly
> against the project's #1 goal (end-to-end speed). None of this is "wrong"; it is the same cheap
> fix repeated — *memoize / go incremental / add a retention window*.

---

## At a glance

| ID | Severity | What is recomputed | When | Fix shape |
|---|---|---|---|---|
| A1 | P1 | System prompt incl. ~6 DB queries + uncached L1 contract | **every tool iteration** (≤8/turn) | memoize per turn (dirty-flag on memory change) |
| A2 | P1 | Recall candidate set: over-fetch + re-hash all 500 | **every turn** (twice if `recall` tool used) | persist content hashes; fetch only what's needed |
| A3 | P2 | Whole `history_json` serialized + rewritten | **every turn** | incremental persist / rebuild window from L2 |
| A4 | P2 | Unbounded `traces` growth + full-table aggregation | every turn (write) / 2s (viewer) | retention window + bounded viewer query |

---

## A1 — System prompt rebuilt on every tool iteration (~6 DB queries each)

`open_stream` calls `chatStream({ system: buildSystemPrompt(...) })`
(`packages/server/src/turn/runTurn.ts:188`), and `open_stream` is a **looped** graph node — it runs
once per tool iteration: `build_request → open_stream → dispatch_tools → append_results →
build_request`, bounded by `MAX_TOOL_ITERATIONS = 8` (`runTurn.ts:28`). Each `buildSystemPrompt`:

- `renderCoreBlock()` → `getCore()` (1 query) + `listFacts({ category })` for **5 categories**
  (5 queries) = **6 DB queries** (`packages/server/src/memory/renderCoreBlock.ts:47`;
  `listFacts` is a fresh query with no memoization, `packages/server/src/memory/l3Store.ts:67`);
- `renderL1Contract()` rebuilds its whole string **uncached** every call
  (`packages/server/src/persona/l1Contract.ts:6` — no `let cached`).

The tool schema, by contrast, is converted **once per turn** and cached on the turn state —
`if (s.anthropicTools.length === 0) s.anthropicTools = toolsToAnthropicFormat(...)`
(`runTurn.ts:175`). The system block simply never got the same treatment.

**Cost.** A 3-iteration turn does **18 DB queries + 3 full L1-contract string builds** to produce a
**byte-identical** system block. (The Anthropic prefix cache still hits when memory is unchanged —
so this is wasted *server* CPU/DB, not extra API spend.)

**Fix.** Memoize the rendered system block on `TurnState`, invalidated by a cheap "L3 / core_memory
changed since last render" flag. That both removes the redundant work and keeps the mid-turn
`remember`-changed-memory case correct (re-render only when it actually changed).

---

## A2 — Recall re-fetches and re-hashes the entire candidate set every turn

`retrieve()` (`packages/server/src/memory/recall/recall.ts:133`) is called once per reactive turn
from `parse_input` (`runTurn.ts:164`), and **again** whenever the `recall` tool fires
(`packages/server/src/tools/builtin/recall.ts:64`). Each call:

1. `collectCandidates()` calls `listL2(sessionId)` with **no limit** → fetches up to **10 000 rows**
   (`listL2` default `opts?.limit ?? 10000`, `packages/server/src/memory/sessionStore.ts:108`), then
   `.slice(-L2_CANDIDATE_LIMIT)` keeps only the last **500** (`recall.ts:113-114`). It pulls up to
   10 000 rows to use 500.
2. `candidates.map((c) => contentHash(c.text))` — **sha256 over every candidate's full text, every
   call** (`recall.ts:158`), purely to key the `embeddings_cache` lookup. These hashes are **never
   persisted**, so the same 500 hashes are recomputed forever.

**Cost.** `O(history)` DB rows + 500 sha256 hashes per turn (doubled on a `recall`-tool turn).

**Fix.** Pass `{ limit: 500 }` to `listL2` with `ORDER BY t_ms DESC` so only the needed rows are
read; store the content hash as a column on `l2_turns` / `l3_facts` (computed once at insert) and
read it back instead of re-hashing.

---

## A3 — `history` grows unbounded in memory and is fully rewritten to disk every turn

`session.history` is never truncated — the L1 window only bounds what is *sent to the model*
(`buildActiveContext`, `packages/server/src/memory/l1Window.ts:16`), not what is *kept*. So the
in-memory array grows without bound for the life of the session, and `persistSession`
(`packages/server/src/memory/sessionStore.ts:61`) does `JSON.stringify(history)` over the **whole**
array on **every** turn → `O(N)` serialize+write per turn, `O(N²)` over the session. (L2 is correctly
append-only; this is specifically the single `sessions.history_json` blob.)

**Fix.** Persist history incrementally, or keep only the active window in `history_json` and rebuild
from the append-only L2 timeline on load (L2 is already the clean per-turn source of truth).

---

## A4 — `traces` table has no retention; viewer aggregates the whole table

`TraceStore` enforces a **per-turn** 500-event cap + overflow marker, but there is **no global
retention** anywhere (grep: no `DELETE FROM traces` / prune / vacuum). An always-on companion with
proactive turns firing every few minutes accumulates trace rows indefinitely
(`packages/server/src/trace/store.ts`). The trace viewer's `listTurns` then runs
`GROUP BY turn_id … MIN/MAX/COUNT` over the **entire** table (`store.ts:95`), and the viewer
auto-refreshes every ~2s — so an unbounded aggregation cost grows with uptime.

**Fix.** Add a retention window (drop traces older than N turns/days — the dream cycle is a natural
place to prune); bound the viewer query to a recent time range.

---

## Verified sound — not the problem (do not re-litigate)

Checked while looking for efficiency flaws and found correct:

- **Indexes exist** for every hot query: `l2_turns(session_id, t_ms)` (`0002_memory.sql`),
  `l3_facts(category, created_ms)` + `(dedup_key)` (`0004_l3_core.sql`),
  `traces(turn_id, t_ms)` + `(session_id, t_ms)` (`0001_traces.sql`). The A1–A4 costs are
  recomputation, **not** missing indexes.
- **Tool-schema conversion** is memoized once per turn (`runTurn.ts:175`), not per iteration.
- **Prompt-cache design is correct**: per-turn / per-query content goes into the *message* stream,
  never the cached system block; a single `cache_control` breakpoint marks the stable prefix. A1's
  waste is server-side recompute only — it does not invalidate the cache unless memory truly changed.

---

## Suggested order of attack

1. **A1** — memoize the system block on the turn (smallest change, every multi-iteration turn
   benefits, zero behavioral risk).
2. **A2** — cap the `listL2` fetch and persist content hashes (kills the per-turn re-hash).
3. **A3** — stop full-rewriting `history_json`.
4. **A4** — add a trace retention window + bound the viewer query.
