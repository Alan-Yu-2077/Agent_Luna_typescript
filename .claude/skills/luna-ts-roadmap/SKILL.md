---
name: luna-ts-roadmap
description: >
  Persist a finalized development plan for Agent_Luna (TypeScript rewrite) into the roadmap as
  executable, staged version plans. Invoke AFTER you and the user have discussed and locked a
  development plan (decisions made, scope agreed) and the user wants it written down for later
  execution — triggers like "写进roadmap", "写成开发计划", "存成 roadmap",
  "把这个计划记下来后面再做", "make a roadmap for this", "write this up as a plan". Also
  invokable as /luna-ts-roadmap. Do NOT invoke to implement code (that's luna-ts-dev), to
  brainstorm an undecided idea (keep discussing first), to write a single small one-off change,
  (The Python original was archived on 2026-08-01; there is no parity repo to redirect to.)
---

# Luna (TypeScript) Roadmap-Writing Skill

Turns a *finalized* development plan into durable, executable roadmap files under
`docs/roadmap/`. Plans are written to be picked up later, one version at a time, by
`luna-ts-dev`.

**Hard rule: this skill writes plans, not code.** Never implement. Never commit unless the user
explicitly asks (then use a `docs:` commit, never `git add -A`, never touch `.env`).

## What may and may not be planned (2026-07-30 — read before Phase A)

Work in `~/Desktop/Luna-ts` (branch `main` — the only one); roadmap files live in its `docs/roadmap/`,
which is **git-invisible** via `.git/info/exclude` — never "fix" that by adding it to `.gitignore`.
The stale archive at the retired second tree and second remote are gone (consolidated 2026-08-01); read the live
`docs/history/DEVELOPMENT.md` for the shipped head.

**Luna is a private, single-machine companion, not a distributed product** (v0.41.0). The public repo
is frozen; nothing is pushed. Therefore an initiative **may not** propose:

- distribution, packaging, installers, releases, download surfaces, auto-update
- platform ports, cross-platform product support, code signing
- acceptance testing on hardware the owner has to go find (that whole tier is closed — see
  Initiative 28's ❄️ FROZEN banner for the reasoning)
- anything justified by reach, adoption, stars, or "so other people can use it"

**Judge every candidate initiative by**: what it does for *her* — memory quality, personality depth,
presence, expressiveness, latency, how she behaves on camera — or by how much clearer it makes the
engineering to read. Those are the only two axes left.

Good roadmaps here follow a proven shape: **verify facts first, then stage into non-overlapping
versions, each grounded in real symbols with `file.ts:line` citations.** Plans that skip Phase A
produce initiatives that get half-rewritten during the build. Follow the phases.

---

## Phase A — Verify facts (mandatory, do this BEFORE writing anything)

A roadmap built on assumptions is worse than none. Before writing a plan, confirm the facts the
plan rests on. Two sources, depending on what's being roadmapped:

### A.1 — Verify against the locked decisions

`docs/REWRITE_CONTEXT.md` is GONE (retired 2026-08-01). Locked design decisions now live in
**`ARCHITECTURE.md`** — read the relevant section directly (e.g. the music section carries two:
observe-don't-wrap, and the rejected "Luna picks the songs" route with its measured evidence).

- Confirm the decision says what you think it says. If it is actually still open, **stop and tell
  the user** — the plan needs that resolution first, not a hand-wave.
- Capture the cited decisions verbatim in a **"Locked design decisions referenced"** section of the
  initiative README, so later plans cite the README instead of re-deriving.
- When an initiative *creates* a decision the owner locks in discussion, write it into
  `ARCHITECTURE.md` in the same batch — a decision that lives only in a version file gets reopened
  by the next person who doesn't read version files.

### A.2 — Verify against actual TS source (post-v0.1 only)

For any plan that reuses or extends existing TS code:
- Use `luna-ts-orient` if not already oriented this session.
- Read the real `packages/*` files. Confirm hook points exist, function signatures match
  assumptions, the Zod schema you intend to extend has the shape you expect.
- Capture findings into **"Verified architectural facts"** in the initiative README, each with
  `package/src/file.ts:line` citation.

### A.3 — Verify against the LIVE system (the highest-value pass)

Source tells you what the code *can* do; the running instance tells you what it *does*. Several
initiatives here were reshaped — or proven necessary — only by this pass:

- **Query the real DB** (`luna.sqlite` at the repo root; open read-only for inspection):
  `dream_reports`, `l2_turns`, `proactive_outcomes`, `diaries`, `skills`. Initiative 33 exists
  because the dream log showed 4 dreams in one day with the stamp frozen for five days; Initiative
  36's tool-loop version exists because `l2_turns` showed 17 searches with 3 fetches.
- **Read the owner's actual config** — repo `.env` *and* `<userData>/luna.env`; the dev-all runtime
  reads the former (see `luna-ts-orient`). A feature can be perfectly built and simply never enabled.
- **Check what is actually running** (`ps`, `lsof -nP -iTCP:8787 -sTCP:LISTEN`) before claiming a
  component is live.

Capture what you measured, with the query or command, in the initiative README's facts table. A
number you measured beats a number you assumed, and the reader can re-run it.

Do not proceed to Phase B until the facts the plan rests on are confirmed from source.

---

## Phase B — Assign non-overlapping version numbers

1. Read the shipped head from `docs/history/DEVELOPMENT.md` (the Version Index — canonical
   "what's shipped").
2. Scan `docs/roadmap/` (master `README.md` + every initiative folder) for already-reserved
   version ranges. Roadmap plans reserve numbers even though unshipped.
3. The new initiative gets the **next free contiguous range** above the highest reserved/shipped
   version. Never reuse or overlap.
4. If priority changes mean an existing planned initiative should move, **renumber it** (rename
   files + shift only its self-referential version tokens; never touch references to dependent
   shipped versions). Keep the master index the ordering source of truth.

State the proposed range + ordering to the user in one line. Adjust if they reorder.

---

## Phase C — Write the initiative folder

Create `docs/roadmap/<slug>-<YYYY-MM>/` containing:

### `README.md` (the initiative index)

Sections, in order:
- **Title + Status banner**: PLANNED, priority relative to other initiatives, version range,
  link to the master `docs/roadmap/README.md`.
- **The idea**: 1 short paragraph — what and why, tied to the rewrite's through-line (latency
  + typed contract).
- **Why prioritized / deferred** (if relevant): the ordering rationale.
- **Locked design decisions referenced**: pulled from `ARCHITECTURE.md` (Phase A.1).
- **Verified architectural facts** (post-v0.1 only): pulled from real source (Phase A.2), with
  citations. Every later plan references these instead of re-deriving.
- **Measured facts from the live system** (when relevant): pulled from Phase A.3 — the query or
  command, and what it returned.
- **The hard part** (if any): the recurring principles for the kind of work this initiative
  contains (e.g. SSE protocol design, SQLite migration discipline).
- **Execution order & status table**: `| Plan | Version | Theme | Risk | Depends | Status |`.
- **Acceptance criteria for the whole initiative**: the boxes that must check before the
  initiative is ✅ shipped.
- **Open questions blocking start**: what must be settled with the owner before any version in
  this initiative can begin (vs. what can be decided at build time — say which).

### One plan file per version: `vX.Y.Z-<short-slug>.md`

Use this template:

```
# vX.Y.Z — <title>

> **Status: PLANNED.** Initiative: <name> (Order N, version M/K). Risk: **Low/Medium/High**.
> Depends: <prior versions or "nothing">. Flag: `<env name>` or "none".

## Goal
<1 paragraph: what this version delivers, why it's a coherent standalone slice.>

## What ships
<concrete: new files, modified files, schemas, wire events, etc. Reference real symbols
with `file.ts:line` citations.>

## Tests
<the test cases that must pass — actual assertions, not "test coverage added".>

## What this version explicitly does NOT include
<scope boundary. Names what's deferred and to which later version.>

## Risk
<specific concerns + mitigation.>

## Acceptance criteria
<checkbox list. Each is observable.>

## Notes for vX.Y.Z+1 (don't foreclose)
<what shape decisions in this version preserve for the next one.>
```

### Conventions every plan must follow

- **Default-off feature flag per risky version** (`LUNA_<FEATURE>=0`), E2E-verified in
  isolation, then enabled.
- **Ground in real symbols** post-v0.1 — cite `package/src/file.ts:line` so the implementer
  isn't re-searching.
- **Stage to isolate the riskiest thing first** (e.g. land the protocol shape before the
  behavior that uses it).
- **Reuse existing infra** named explicitly (`defineTool`, `dispatchToolCalls`, the protocol
  package's `ServerEvent` union, etc.).
- Note wire-contract / SQLite-schema / tool-surface caution points from `luna-ts-orient` where
  the plan touches them.
- **Status must flow back.** When a version ships, update BOTH its plan file and the master
  `docs/roadmap/README.md` row. Drift between the two has bitten this project repeatedly.

---

## Phase D — Update the master roadmap index

Edit `docs/roadmap/README.md` so it remains the single forward-development entry point:
- Update the shipped-head line from `docs/history/DEVELOPMENT.md`.
- Add/refresh the initiative's row in the execution-order table (order, version range, folder,
  status).
- Add/refresh the initiative's per-version breakdown table with links to the plan files.
- Keep initiatives ordered by execution priority.

---

## Phase E — Report (no code, no commit)

- Summarize: the folder created, the version range, the staging, and any **corrected facts**
  from Phase A that changed the design.
- Surface the deferred Open Questions so the user knows what's still to settle at build time.
- Do **not** write code. Do **not** commit unless the user asks; if they do: a single `docs:`
  commit, branch first if on default, never `git add -A`/`git add .`, never stage `.env`, use
  the standard commit footer.

---

## Summary checklist

```
✓ Facts verified (Phase A) — N facts cited from <ARCHITECTURE.md | source | the live system>
✓ Versions assigned non-overlapping (vX.Y.Z–vX.Y.Z)
✓ Initiative folder written (README + M plan files)
✓ Master docs/roadmap/README.md updated
✓ Reported + deferred Open Questions surfaced (no code written)
```

Mark any skipped/!= step with ✗ and why.
