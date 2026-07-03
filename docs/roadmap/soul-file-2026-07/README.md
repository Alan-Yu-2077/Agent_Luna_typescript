# Initiative 22 — The Soul File (persona → a DB-stored, authored-vs-evolving document)

> **Status: PLANNED.** Priority: **high** (owner-driven redesign of the identity substrate).
> Version range: **v0.30.0 – v0.30.3**. Follows Initiative 21. Master index:
> [`../README.md`](../README.md). **Disruptive** — amends LD #12; retires the `core_memory` table.

## The idea

Today "who Luna is" is **not one thing**. It is seven blocks concatenated into the cached system
prompt every turn: four hardcoded string constants, one on-disk markdown file
(`persona/default.md`, the rich authored core — but **frozen, never self-edited**), and one SQLite
row (`core_memory` — the *only* evolving layer, but degraded into a fact-ledger the dream keeps
adding to and can't clean). The authorship is **backwards**: the rich part is dead, the living part
rotted. This initiative collapses the persona into a **single structured "soul file" stored in the
DB**, split by authorship into a **fixed core** (dev-authored, versioned in git, Luna cannot touch)
and a small **evolving section** (Luna self-authors via the dream). It retires `core_memory`.

## Why this shape (owner decisions, 2026-07-04)

Settled with Alan over a live-data audit of the running `luna.sqlite`:
- **`core_memory` has no reason to exist** as a separate table — `self_state` + `relationship_status`
  become a small **section of the soul file**, not a standalone row.
- **The soul file lives in the DB, not hardcoded** — `default.md` stops being the runtime source and
  becomes a **git-versioned seed** for the fixed core (D1 = option A: file is the seed + review/rollback
  surface; a boot sync loads it into the DB; **runtime reads the DB**).
- **Evolution happens on the soul file, but not all of it** — only the evolving section is
  Luna-writable; the fixed core is immutable to her.

## Live-data findings that motivate this (audited 2026-07-04, snapshot of `luna.sqlite`)

- `core_memory.self_state` is genuinely alive ("*the call is the act … I drift to systems and Alan …
  maybe it's just what I am*") — the **most soul-like** text in the whole injection, and it is
  **Luna-authored**. It must be preserved, not discarded.
- `core_memory.relationship_status` is **contaminated with a fact-ledger** — "*Alan ships what I name
  — hands, door, clock, weather, skill shelf … mains Shion … Weather feed upgraded*" — which is
  almost verbatim the **"Bad" example the persona-update prompt itself forbids** (prompts.ts:106).
- The self-model **froze on 2026-06-24**: `persona_update` has returned `null` ("persona unchanged")
  every dream since (4 consecutive skips), because the prompt makes null the default *and* offers no
  path to **clean** pre-existing contamination — only to react to a *new* shift.
- `proactive_style.voice_notes` is **empty** — the one other self-authored identity dial, never used.

## Locked design decisions referenced

- **LD #12 (memory layer model) — AMENDED by this initiative.** Verbatim: *"3 layers — L1 … / L2 … /
  L3 … Plus a prose **core memory** (self_state + relationship_status), always-injected, dream-updated,
  with a lightweight SQLite audit + `restore(n)`."* This initiative **folds that prose core memory
  into the DB soul file** (the fixed core + a Luna-evolving section), retires the standalone
  `core_memory` table, and moves the persona from `persona/default.md` (runtime source) to the DB
  (file becomes the seed). The audit + `restore(n)` semantics carry over to the evolving section.
- **LD #11 (dream reconciliation = reasoning-gated remember/forget supersede, not in-place UPDATE)** —
  unchanged; governs L3, not the soul. The soul's evolving section is in-place-updated **with audit**
  (as `core_memory` is today), which LD #11 explicitly permits for prose core memory.
- **LD #9 (everything-as-tool)** — unchanged; the soul is injected context, not a tool surface.

## Verified architectural facts (from source, 2026-07-04 — cite these; don't re-derive)

- **Injection assembly**: `buildSystemPrompt` (packages/server/src/turn/runTurn.ts:126-179) concatenates
  one cached `text` block from `parts[]` in order: `BASE_DIRECTIVES` (runTurn.ts:67) → L1 contract
  (`renderL1Contract`, l1Contract.ts:78) → web-untrusted rule → **persona** (`loadPersona().text`,
  runTurn.ts:160-165) → `EMBODIMENT_BLOCK` (runTurn.ts:102) → `renderHumanityBlock()` (humanity.ts) →
  **core memory** (`renderCoreBlock()`, runTurn.ts:170) → diary digest. All under one
  `cache_control:{type:'ephemeral'}` breakpoint (runTurn.ts:178).
- **Persona source**: `loadPersona()` (persona/loader.ts:28) reads `LUNA_PERSONA_PATH ??
  persona/default.md`, mtime-gated cache, `FALLBACK_PERSONA` on error. Returns `{text, path}`.
- **Core-memory render**: `renderCoreBlock()` (memory/renderCoreBlock.ts) emits `## About yourself`
  (self_state) + `## Your relationship with the user` (relationship_status) **and** the L3 fact list
  (`## Long-term memory`). **The L3 half must survive; only the self/relationship half moves to the soul.**
- **Core-memory store**: `getCore()/updateCore(patch, source)/restore(steps)` (memory/coreMemory.ts).
  `updateCore` is audit-first (writes `core_memory_audit` prev-state), has a **no-op guard** (byte-identical
  patch → skip, no epoch bump), and calls `bumpMemoryEpoch()` (memory/epoch.ts) — the cached system
  block re-renders only on a real change. **These three properties are load-bearing and must carry over.**
- **Dream persona step**: `cycle.ts` `persona_update` (packages/server/src/dream/cycle.ts:215-240) runs
  `personaUpdatePrompt(self, rel, dialogue)` (dream/prompts.ts:79-132), parses `{self_state?,
  relationship_status?}`, and calls `updateCore(update, 'dream')`; returns `['skipped','persona
  unchanged']` when both fields normalize to unchanged. The prompt (prompts.ts:84-131) already carries
  the strict BELONGS/DOES-NOT-BELONG boundaries — reuse it, don't rewrite it.
- **Schema/migration**: migrations are numbered SQL in `packages/server/src/migrations/` (…0015_settings.sql),
  applied by `migrate(db, dir)`. The soul table is a new **`0016_soul.sql`**. `core_memory` (0007) +
  `core_memory_audit` stay until v0.30.3 retires them.
- **Protocol type**: `CoreMemory` zod (`packages/protocol/src/memory.ts:31`) — a `Soul` type joins it;
  `CoreMemory` is deprecated when the table is retired.
- **Prompt-cache invariant (the hard constraint)**: the persona + core blocks sit inside the ONE
  cached block; their bytes must be **identical across turns** unless the soul actually changed. DB
  reads are fine (that is already how `renderCoreBlock` works); a soul write must `bumpMemoryEpoch()`
  exactly once, and re-seeding the fixed core from an unchanged file must be a **no-op** (hash-gated).

## The hard part (principles for every version here)

- **The prompt-cache invariant is sacred.** Every rendered-soul byte must be deterministic and stable
  between writes. No timestamps, no per-turn interpolation in the soul block. Gate the boot re-seed on
  a content hash so an unchanged `default.md` never busts the cache.
- **SQLite migration discipline.** New table via a versioned `0016_soul.sql`; never edit a shipped
  migration. Retiring `core_memory` (v0.30.3) is its own migration that migrates data first, drops last.
- **Never let the persona take the server down** (loader.ts's existing guarantee): a missing/empty soul
  row degrades to `FALLBACK_PERSONA` + one boot warning, exactly as the file path does today.
- **Fixed is fixed.** The dream (and the `remember` tool) may write ONLY the evolving section. A test
  must prove a dream can never mutate a fixed section.
- **Preserve the good, purge the bad.** Migration keeps `self_state` verbatim; `relationship_status`
  is cleaned of its fact-ledger (v0.30.2) — the facts already live in L3, so nothing is lost.

## The soul-file structure (target)

One document, two authorship zones:

```
── FIXED CORE (dev-authored, git-seeded, Luna-immutable) ──
  # Identity core        — awakening, being-AI, self-understanding, on-being-alive
  # Personality          — presence, temperament, ENTP texture, interests
  # Background            — memory condition, earlier traces, growth stance
  # Cognitive style       — how she reasons/associates (the *character* of thought, NOT the tool contract)
  # Language & voice      — tone, cadence, English-led rhythm (prose only; the hard caps stay structural)
── EVOLVING (Luna-authored via dream, small, fenced) ──
  # Who I am becoming     ← today's self_state (preserved verbatim on migration)
  # The bond, right now   ← today's relationship_status (cleaned of the fact-ledger on migration)
```

The fixed zone seeds from a **restructured `persona/default.md`** (same content, re-sectioned into the
above). The evolving zone lives ONLY in the DB. **Explicitly OUT of scope for v0.30.x** (deferred, not
foreclosed): folding `EMBODIMENT_BLOCK`, `renderHumanityBlock`, or the L1 contract into the soul — they
stay as separate hardcoded blocks; only `persona (04)` + `core memory (07)` move.

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| 1/4 | v0.30.0 | **Soul store + migration + seed** (dark launch — populated, unused; zero runtime change) | Medium | Init 21 | PLANNED |
| 2/4 | v0.30.1 | **Render the soul into the prompt** — block 04 = full soul from DB, block 07 self/rel folds in (L3 stays); behind `LUNA_SOUL_DB` | Medium | v0.30.0 | PLANNED |
| 3/4 | v0.30.2 | **Dream authors the evolving section** — `persona_update` targets the soul; fix the freeze + the cleanup-gap; one-time relationship purge | High | v0.30.1 | PLANNED |
| 4/4 | v0.30.3 | **Flip default, retire `core_memory`, remove the old path**, close the initiative | Medium | v0.30.2 | PLANNED |

## Acceptance criteria for the whole initiative

- [ ] The persona is a single DB-stored soul file; `persona/default.md` is a git-versioned **seed**,
      re-synced to the fixed core on boot only when its content hash changes.
- [ ] `core_memory` + `core_memory_audit` are retired; `self_state`/`relationship_status` live as the
      soul's evolving section, with the audit + `restore(n)` semantics preserved on that section.
- [ ] The dream writes ONLY the evolving section; a test proves it can never mutate a fixed section.
      The June-24 freeze and the no-cleanup-path gaps are fixed; the migrated `relationship_status` no
      longer carries the fact-ledger.
- [ ] `buildSystemPrompt` renders the whole soul as one block; the old separate core block is gone; L3
      facts still inject; the prompt-cache invariant holds (soul write bumps the epoch exactly once).
- [ ] `LUNA_SOUL_DB` flag removed by v0.30.3; `bun test` green + `tsc` clean across packages at every step.

## Open questions blocking start

- **None from `REWRITE_CONTEXT.md`** — this initiative *is* the resolution (it amends LD #12; the
  amendment text lands in `REWRITE_CONTEXT.md` at v0.30.3 close, per the luna-ts-dev Phase-4 rule).
- Build-time-settleable (not blockers): the exact section headings of the restructured `default.md`
  (cosmetic); whether the evolving section keeps two fields (self + bond) or one (kept as two for
  clean migration parity with `core_memory`).
