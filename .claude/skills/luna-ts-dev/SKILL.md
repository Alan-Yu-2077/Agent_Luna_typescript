---
name: luna-ts-dev
description: >
  Full development lifecycle for Agent_Luna (TypeScript rewrite, not the Python original).
  Invoke when the user expresses a development intent for THIS repo — new features, bug fixes,
  refactors, schema changes, runtime changes, tool additions, protocol changes, or any
  "implement / add / fix / rework" request targeting the TS codebase. Also invokable as
  /luna-ts-dev.

  Trigger words / patterns (auto-invoke when present in a TS Luna dev context):
  实现、开发、添加、新增、修复、重构、改造、优化、我想要、我需要、帮我做、
  implement, add, build, fix, refactor, rework, create a feature, make Luna.

  Do NOT invoke for: documentation-only questions, orientation questions, general discussion
  about the rewrite without a concrete change request, tasks already mid-flight, or work
  targeting the Python original at /Users/alanyu2077/Desktop/Agent_Luna (use luna-dev for
  that).
---

# Luna (TypeScript) Development Lifecycle

Structured 5-phase development process for every change to the TypeScript rewrite. Follow the
phases in order. Do not skip phases.

This is distinct from the Python `luna-dev` skill. The two repos share design history but not
version numbers, runtime, or source tree.

---

## Phase 0 — Orient (mandatory before anything else)

Run `luna-ts-orient` to load the code-truth project map. Do not rely on memory or prior
conversation — always re-orient at the start of a new task so the current shipped version,
locked decisions, and cut/kept lists are fresh.

After orienting, extract from `docs/history/DEVELOPMENT.md`:
- The last version entry in the Version Index table (or "none shipped yet" pre-v0.1)
- Its version number

You will use this in Phase 1 to propose the next version number.

If `docs/REWRITE_CONTEXT.md` has Open Questions relevant to the requested change, surface them
in Phase 1 — they may be exactly what the user needs to settle now.

---

## Phase 1 — Requirements Analysis + Version Proposal

### 1a. First-round clarification

After the user states their initial goal, do NOT immediately write a plan. Ask a focused set of
clarifying questions to surface the real requirement. Adapt to what is actually unclear — no
generic boilerplate.

Good clarifying angles for this rewrite:

- **Package scope**: which of `packages/protocol`, `packages/server`, `packages/web` (and which
  module within) does this touch?
- **Wire contract impact**: does this add/remove/change a `ClientEvent` or `ServerEvent`
  variant? If yes, both packages will need updates in lockstep — flag it.
- **Tool spec impact**: does this add/modify a `defineTool` declaration? If yes: what's the
  `concurrency` policy, what's `summarize`, what's the `timeoutMs`?
- **Memory impact**: does this touch the SQLite schema for L1 / L2 / L3? Migrations need a
  declared `migrations/` file, not silent in-place edits.
- **Open question dependency**: does this require resolving an Open Question in
  `REWRITE_CONTEXT.md`? If yes, that resolution lands in the same change.
- **Python parity vs new direction**: is this porting a Python behavior, or deliberately
  diverging? Cite the Python file:line if porting, cite the rationale if diverging.
- **Tests**: what test files need to grow, and which package's `bun test` runs them?

Present 2–4 of the most relevant questions. Wait for user answers before proceeding.

### 1b. Version number proposal

Based on the last version in `DEVELOPMENT.md` and the scope of the change, propose the next
version number using this heuristic:

| Change scope | Increment |
|---|---|
| Bug fix, small tweak, config change | patch: `v0.X.Y` → `v0.X.Y+1` |
| New feature within an existing package | patch or minor based on depth |
| New package, major architectural change, cross-package refactor | minor: `v0.X.Y` → `v0.X+1.0` |
| Cross-cutting change that redefines a contract (protocol, tool spec, SQLite schema) | minor |

Versions reserve across initiatives — never reuse, never overlap with a number already claimed
in `docs/roadmap/`. Check the master roadmap index before proposing.

Present the proposed version number with a one-line rationale. Wait for confirmation before
moving to Phase 2.

---

## Phase 2 — Implementation Plan (EnterPlanMode)

Enter plan mode. Use information from Phase 1 to design the implementation.

Your plan must cover:

1. **Files to create or modify** — be specific (path + reason). Reference real symbols from
   the orientation output, not pseudocode.
2. **Files to delete** — if any dead scaffolding becomes obsolete.
3. **Schema changes** — every change to a Zod schema in `packages/protocol/` is a wire
   contract change; list both producer and consumer call sites.
4. **Architectural decision** — if multiple approaches exist, state the tradeoff and your
   recommendation. Link to the relevant Open Question in `REWRITE_CONTEXT.md` if applicable.
5. **Test impact** — what to add or update; which package's test suite covers it.
6. **DEVELOPMENT.md impact** — the version entry you will write after implementation.

Exit plan mode only after user approves the plan.

---

## Phase 3 — Implementation

Implement the approved plan. Guidelines:

**Code standards:**
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround).
- No JSDoc beyond a single short line. Types are the documentation.
- No `as any`, no `as unknown`, no `// @ts-ignore`, no `// @ts-expect-error` without a paired
  one-line WHY. The wire boundary in particular must be `as`-free.
- No `startswith('Error')`, no `instanceof Error` for *deciding* an error happened (only for
  *building* one).
- Per-package tests live next to the code: `packages/server/src/**/*.test.ts`. No central test
  monolith — the Python single-file pattern is one of the things we are deliberately not
  copying.

**Validation after edits:**
- `bun run --cwd packages/<changed> tsc --noEmit` (when a tsconfig exists, post-v0.1)
- `bun test` from repo root
- For wire contract changes: build both `packages/protocol` consumers (`server` and `web`) to
  surface drift as type errors.

**Rewrite-specific caution points** (grow this list as architecture lands):
- `packages/protocol/src/events.ts` is the single source of truth for the WS contract. Adding
  a `ServerEvent` variant without updating its consumer is the rewrite-equivalent of the
  Python silent-drift bugs we are explicitly eliminating.
- The tool dispatcher's concurrency policy is load-bearing for correctness — a tool declared
  `safe-parallel` that secretly mutates shared state is a race condition.
- Anthropic interleaved tool-use SSE: do not buffer tool calls and emit at the end; emit
  `tool.started` / `tool.progress` events as they arrive on the provider stream. Buffering
  re-introduces the Python "tool-turn feels blocking" symptom.
- SQLite migrations: never edit the schema in-place; write a versioned migration. The Python
  audit found cross-process MEMORY_LOCK was process-local — SQLite's WAL mode + per-statement
  locking is the fix, but only if migrations are atomic.

After implementation, run validation checks and report results before proceeding to Phase 4.

---

## Phase 4 — DEVELOPMENT.md Update

After implementation and validation, write a new entry to `docs/history/DEVELOPMENT.md`
automatically. Do not ask for confirmation.

### Version Index table

Add a new row (keep sorted by date):

```
| `vX.Y.Z` | YYYY-MM-DD | <one-line theme> | `<commit-hash or "working tree">` |
```

Use today's date. If the code is not yet committed, write `working tree`.

### Detailed Record section

Add a new `###` section, following this template (identical shape to Python `luna-dev`):

```markdown
### `vX.Y.Z` — YYYY-MM-DD — <title>

Status:

- <shipped in `<hash>` | working tree>

Fact:

- <bullet for each concrete, verifiable change: file added/deleted/modified + what changed>
- <include line counts for significant new files>
- <include env vars added if any>
- <include test coverage added>

Inference:

- <1–3 bullets explaining WHY this change matters architecturally or product-wise>
- <what problem this solves that the previous version could not>
- <any confirmed bugs or gaps this closes>
```

Rules for Fact bullets:
- One bullet per logical change, not per file
- State what changed, not what the code does
- If a file was deleted, say so explicitly
- If a Python-side behavior was ported or deliberately diverged, name it

Rules for Inference bullets:
- Do not restate Fact bullets
- Explain architectural or product significance
- If this resolves an Open Question in `REWRITE_CONTEXT.md`, say so and move the question to
  Locked Decisions in the same commit

After writing the entry, update `Last updated:` at the top to today.

---

## Phase 5 — Commit

Once Phase 4 is done and validation passed (tests green, types clean), commit. Standard
end-of-version step, but apply guards — do NOT blindly `git add -A`:

1. **Branch discipline.** `git rev-parse --abbrev-ref HEAD`. If on `main`, create a feature
   branch (`git checkout -b feat/<short-slug>`).
2. **Scope check.** `git status --short`. If the working tree holds changes unrelated to this
   version, surface them and ask the user how to scope (this version only vs everything).
3. **Stage + commit** with a conventional-commit message:
   - Subject: `<type>(<scope>): <summary> (vX.Y.Z)` — `feat` / `fix` / `refactor` / `perf` /
     `docs` as fits.
   - Body: 3–6 bullets of what changed + why; note test count and that suite is green.
   - End the message with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
4. **Do NOT push.** Leave pushing to the user unless they explicitly ask.
5. Report the commit hash.

---

## Summary checklist

At the end of every luna-ts-dev run, output:

```
✓ Oriented (luna-ts-orient)
✓ Requirements clarified (vX.Y.Z confirmed)
✓ Plan approved
✓ Implementation complete
✓ Validation: <test results>
✓ DEVELOPMENT.md updated (vX.Y.Z)
✓ Committed (vX.Y.Z, <commit hash>)
```

If any step was skipped or failed, mark it ✗ and explain why.
