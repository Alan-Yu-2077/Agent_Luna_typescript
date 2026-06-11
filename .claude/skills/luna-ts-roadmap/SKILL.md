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
  or to roadmap work targeting the Python original (use luna-roadmap for that).
---

# Luna (TypeScript) Roadmap-Writing Skill

Turns a *finalized* development plan into durable, executable roadmap files under
`docs/roadmap/`. Plans are written to be picked up later, one version at a time, by
`luna-ts-dev`.

**Hard rule: this skill writes plans, not code.** Never implement. Never commit unless the user
explicitly asks (then use a `docs:` commit, never `git add -A`, never touch `.env`).

Good roadmaps for this repo follow a proven shape (inherited from Python Luna's
`luna-roadmap`): **verify facts first, then stage into non-overlapping versions, each grounded
in real symbols or — pre-v0.1 — in `REWRITE_CONTEXT.md` decisions.** Follow the phases.

---

## Phase A — Verify facts (mandatory, do this BEFORE writing anything)

A roadmap built on assumptions is worse than none. Before writing a plan, confirm the facts the
plan rests on. Two sources, depending on what's being roadmapped:

### A.1 — Verify against REWRITE_CONTEXT.md

For any plan that depends on a locked design decision (runtime, persistence, wire model, tool
spec shape, etc.):
- Read `docs/REWRITE_CONTEXT.md` directly. Confirm the relevant Locked Decision is what you
  think it is.
- If a Decision is actually still Open, **stop and tell the user** — the plan needs that
  resolution first, not a hand-wave.
- Capture the cited Locked Decisions verbatim in a **"Locked design decisions referenced"**
  section in the initiative README.

### A.2 — Verify against actual TS source (post-v0.1 only)

For any plan that reuses or extends existing TS code:
- Use `luna-ts-orient` if not already oriented this session.
- Read the real `packages/*` files. Confirm hook points exist, function signatures match
  assumptions, the Zod schema you intend to extend has the shape you expect.
- Capture findings into **"Verified architectural facts"** in the initiative README, each with
  `package/src/file.ts:line` citation.

### A.3 — Verify against Python parity reference (when porting)

For any plan that ports a Python behavior:
- Read the Python source at `/Users/alanyu2077/Desktop/Agent_Luna` directly. Confirm the
  behavior you intend to mirror still exists at the version `docs/history/DEVELOPMENT.md`
  (Python repo) names as shipped.
- Note explicit divergences. If the rewrite deliberately changes the behavior, the plan must
  say so (and the rationale belongs in `REWRITE_CONTEXT.md` either as a Locked Decision or as
  an Open Question being resolved by this initiative).

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
- **Locked design decisions referenced**: pulled from `REWRITE_CONTEXT.md` (Phase A.1).
- **Verified architectural facts** (post-v0.1 only): pulled from real source (Phase A.2), with
  citations. Every later plan references these instead of re-deriving.
- **Python parity notes** (when relevant): pulled from Phase A.3, with citations and
  divergence rationale.
- **The hard part** (if any): the recurring principles for the kind of work this initiative
  contains (e.g. SSE protocol design, SQLite migration discipline).
- **Execution order & status table**: `| Plan | Version | Theme | Risk | Depends | Status |`.
- **Acceptance criteria for the whole initiative**: the boxes that must check before the
  initiative is ✅ shipped.
- **Open questions blocking start**: which `REWRITE_CONTEXT.md` Open Questions must resolve
  before any version in this initiative can begin.

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
post-v0.1; reference REWRITE_CONTEXT decisions pre-v0.1.>

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
  isolation, then enabled. Same de-risking pattern as Python Luna's v0.32 / v0.38.
- **Ground in real symbols** post-v0.1 — cite `package/src/file.ts:line` so the implementer
  isn't re-searching.
- **Stage to isolate the riskiest thing first** (e.g. land the protocol shape before the
  behavior that uses it).
- **Reuse existing infra** named explicitly (`defineTool`, `dispatchToolCalls`, the protocol
  package's `ServerEvent` union, etc.).
- Note wire-contract / SQLite-schema / tool-surface caution points from `luna-ts-orient` where
  the plan touches them.
- For pre-v0.1 plans, the "real symbols" don't exist yet — ground in `REWRITE_CONTEXT.md`
  Locked Decisions and the planned package layout from the master `docs/roadmap/README.md`.

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
✓ Facts verified (Phase A) — N facts cited from <REWRITE_CONTEXT.md | source | Python parity>
✓ Versions assigned non-overlapping (vX.Y.Z–vX.Y.Z)
✓ Initiative folder written (README + M plan files)
✓ Master docs/roadmap/README.md updated
✓ Reported + deferred Open Questions surfaced (no code written)
```

Mark any skipped/!= step with ✗ and why.
