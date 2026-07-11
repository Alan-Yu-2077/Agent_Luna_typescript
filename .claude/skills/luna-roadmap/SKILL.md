---
name: luna-roadmap
description: Turn a finalized development plan for Luna (TypeScript) into durable, executable roadmap files under docs/roadmap/. Invoke AFTER a plan is discussed and settled and the user wants it written down for later execution ("write this up as a roadmap", "写进 roadmap", "make a plan for this"). Also invokable as /luna-roadmap. Do NOT invoke to implement code (use luna-dev), to brainstorm an undecided idea, or for a single small one-off change.
---

# Luna — Roadmap Writing

Turns a *finalized* plan into staged version plans under `docs/roadmap/`, written to be picked up later,
one version at a time, by `luna-dev`.

**Hard rule: this skill writes plans, not code.** Never implement. Never commit unless explicitly asked
(then a single `docs:` commit — never `git add -A`, never stage `.env`).

Good roadmaps here follow a proven shape: **verify facts against real source first, then stage into
non-overlapping versions, each grounded in real symbols.**

---

## Phase A — Verify the facts (mandatory, before writing anything)

A roadmap built on assumptions is worse than none.

1. Run `luna-orient` if you haven't this session.
2. Read the real `packages/*` files the plan depends on. Confirm the hook points exist, the function
   signatures match your assumption, the Zod schema you intend to extend has the shape you think.
3. Capture what you confirmed into a **"Verified architectural facts"** section in the initiative
   README, each with a `packages/<pkg>/src/<file>.ts:<line>` citation.

If a fact you need does not hold, **stop and say so** — the plan needs to change, not the reader's
expectations.

Do not proceed to Phase B until the facts are confirmed from source.

---

## Phase B — Assign non-overlapping version numbers

1. Read the shipped head from the Version Index in `docs/history/DEVELOPMENT.md`.
2. Scan `docs/roadmap/` (the master `README.md` + every initiative folder) for already-reserved ranges.
   Roadmap plans reserve numbers even though unshipped.
3. The new initiative takes the **next free contiguous range** above the highest reserved/shipped
   version. Never reuse, never overlap.
4. If priority shifts mean an existing planned initiative should move, **renumber it** (rename files +
   shift only its self-referential version tokens; never touch references to shipped versions).

State the proposed range + ordering in one line. Adjust if the user reorders.

---

## Phase C — Write the initiative folder

Create `docs/roadmap/<slug>-<YYYY-MM>/`:

### `README.md` — the initiative index

In order:

- **Title + status banner**: PLANNED, priority relative to other initiatives, version range, link back
  to the master `docs/roadmap/README.md`.
- **The idea**: one short paragraph — what and why, tied to the project's through-line (latency + a
  typed contract).
- **Why prioritized / deferred**: the ordering rationale.
- **Verified architectural facts**: from Phase A, with `file:line` citations. Later plans reference
  these instead of re-deriving them.
- **The hard part**: the recurring principles for this kind of work (e.g. SSE protocol design, SQLite
  migration discipline).
- **Execution order & status table**: `| Plan | Version | Theme | Risk | Depends | Status |`
- **Acceptance criteria for the whole initiative**: the boxes that must check before it is ✅ shipped.

### One plan file per version: `vX.Y.Z-<short-slug>.md`

```markdown
# vX.Y.Z — <title>

> **Status: PLANNED.** Initiative: <name> (Order N, version M/K). Risk: **Low/Medium/High**.
> Depends: <prior versions or "nothing">. Flag: `<env name>` or "none".

## Goal
<1 paragraph: what this version delivers, why it is a coherent standalone slice.>

## What ships
<concrete: new files, modified files, schemas, wire events. Reference real symbols.>

## Tests
<the actual assertions that must pass — not "test coverage added".>

## What this version explicitly does NOT include
<scope boundary: what is deferred, and to which later version.>

## Risk
<specific concerns + mitigation.>

## Acceptance criteria
<checkbox list. Each one observable.>

## Notes for vX.Y.Z+1 (don't foreclose)
<what shape decisions here preserve for the next slice.>
```

### Conventions every plan must follow

- **A default-off flag per risky version** (`LUNA_<FEATURE>=0`), E2E-verified in isolation, then
  enabled in a follow-up.
- **Ground in real symbols** — cite `packages/<pkg>/src/<file>.ts:<line>` so the implementer isn't
  re-searching.
- **Stage to isolate the riskiest thing first** — land the protocol shape before the behavior that uses
  it.
- **Reuse existing infrastructure** by name (`defineTool`, the dispatcher, the `ServerEvent` union).
- Call out wire-contract / SQLite-schema / tool-surface caution points wherever the plan touches them.
- **Couple every deletion to the fix it breaks.** If removing a file breaks the build, the fix lands in
  the same version.

---

## Phase D — Update the master roadmap index

Edit `docs/roadmap/README.md` so it stays the single forward-development entry point:

- Update the shipped-head line from `docs/history/DEVELOPMENT.md`.
- Add/refresh the initiative's row in the execution-order table.
- Add/refresh its per-version breakdown table with links to the plan files.
- Keep initiatives ordered by execution priority.

---

## Phase E — Report (no code, no commit)

- Summarize: the folder created, the version range, the staging, and any **corrected facts** from Phase A
  that changed the design.
- Surface deferred open questions so the reader knows what is still to settle at build time.
- Do **not** write code. Do **not** commit unless asked.

---

## Summary checklist

```
✓ Facts verified (Phase A) — N facts cited from source
✓ Versions assigned non-overlapping (vX.Y.Z–vX.Y.Z)
✓ Initiative folder written (README + M plan files)
✓ Master docs/roadmap/README.md updated
✓ Reported + open questions surfaced (no code written)
```

Mark any skipped step with ✗ and why.
