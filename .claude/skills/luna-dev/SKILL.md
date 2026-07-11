---
name: luna-dev
description: Full development lifecycle for Luna (TypeScript). Invoke for any concrete change request against this codebase — new features, bug fixes, refactors, schema changes, tool additions, protocol changes. Also invokable as /luna-dev. Do NOT invoke for orientation questions, documentation-only questions, or open-ended discussion with no change request.
---

# Luna — Development Lifecycle

A structured 5-phase process for every change. Follow the phases in order; do not skip.

---

## Phase 0 — Orient (mandatory)

Run `luna-orient`. Do not rely on memory or a prior conversation.

From it you get: the current shipped version, the packages in scope, and which invariants your change
puts at risk. You will use the version number in Phase 1.

---

## Phase 1 — Clarify + propose a version

### 1a. Ask what is actually unclear

Do not jump to a plan. Ask a focused set of clarifying questions — no generic boilerplate. Good angles
for this codebase:

- **Package scope** — which of `protocol` / `server` / `web` / `desktop`, and which module?
- **Wire contract impact** — does this add/change a `ClientEvent` or `ServerEvent`? If yes, both sides
  must move in lockstep. Flag it.
- **Tool surface impact** — a new/changed `defineTool`? What's its `concurrency` policy, its
  `summarize`, its `timeoutMs`, its `proactiveRisk`?
- **Memory impact** — does it touch the L1/L2/L3 SQLite schema? That needs a versioned migration file,
  never an in-place edit.
- **Flag** — is this risky enough to land default-off behind a `LUNA_*` flag first?
- **Tests** — which test files grow, and which package's suite covers it?

Present the 2–4 most relevant. Wait for answers.

### 1b. Propose the next version number

| Change scope | Increment |
|---|---|
| Bug fix, small tweak, config change | patch: `v0.X.Y` → `v0.X.Y+1` |
| New feature inside an existing package | patch or minor, by depth |
| New package, major architectural change, cross-package refactor | minor: `v0.X.Y` → `v0.X+1.0` |
| Redefines a contract (protocol, tool spec, SQLite schema) | minor |

Versions **reserve across the project** — never reuse, never overlap. Check `docs/roadmap/` (if present)
for numbers already claimed by planned work.

State the proposed version with a one-line rationale. Wait for confirmation.

---

## Phase 2 — Plan

Enter plan mode. The plan must cover:

1. **Files to create or modify** — path + reason, referencing real symbols from orientation, not
   pseudocode.
2. **Files to delete** — if scaffolding becomes obsolete.
3. **Schema changes** — every change to a Zod schema in `packages/protocol/` is a wire contract change.
   List both the producer and the consumer call sites.
4. **Architectural decision** — if several approaches exist, state the tradeoff and recommend one.
5. **Test impact** — what to add or update; which suite covers it.
6. **`docs/history/DEVELOPMENT.md` impact** — the version entry you will write in Phase 4.

Exit plan mode only after the plan is approved.

---

## Phase 3 — Implement

Follow `CONTRIBUTING.md` code standards. In short:

- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround).
- No `as any` / `as unknown` / `@ts-ignore` / `@ts-expect-error` without a one-line WHY. The wire
  boundary must be cast-free.
- Don't use `instanceof Error` or string-matching to *decide* an error happened — only to build one.
- Tests live beside the code: `packages/<pkg>/src/**/*.test.ts`.
- Prefer pure, injectable functions (pass `exists` / `fetch` / `storage` as options with real defaults)
  so behavior unit-tests without mocks.

**Validate after edits:**

```sh
bun test                                        # from the repo root
bun run --cwd packages/<changed> tsc --noEmit   # every package you touched
bun run --cwd packages/web build                # if you touched web or desktop
```

For a wire-contract change, typecheck **both** `server` and `web` — drift must surface as a type error.

**Caution points** (the ones that bite):

- `packages/protocol/src/events.ts` is the single source of truth for the socket.
- Do not buffer tool calls — emit `tool.started` / `tool.progress` / `tool.finished` as they stream.
- A tool declared parallel-safe that mutates shared state is a race condition.
- SQLite migrations: versioned file, atomic, never an in-place schema edit.

Report validation results before Phase 4.

---

## Phase 4 — Record the version

After implementation and green validation, write the entry to `docs/history/DEVELOPMENT.md`. Do not ask
for confirmation — it's a standard step.

**Version Index** — add a row (keep sorted by date):

```
| `vX.Y.Z` | YYYY-MM-DD | <one-line theme> | `<commit-hash or "working tree">` |
```

**Detailed Record** — add a `###` section:

```markdown
### `vX.Y.Z` — YYYY-MM-DD — <title>

Status:

- <shipped in `<hash>` | working tree>

Fact:

- <one bullet per logical change: file added/deleted/modified + what changed>
- <line counts for significant new files; env vars added; test coverage added>

Inference:

- <1-3 bullets: why this matters architecturally or product-wise>
- <what problem it solves that the previous version could not>
```

Rules: **Fact** bullets state what changed, not what the code does — one per logical change, not per
file. Say so explicitly when a file was deleted. **Inference** bullets must not restate Facts.

Update `Last updated:` at the top.

---

## Phase 5 — Commit

Apply guards — do **not** `git add -A`.

1. **Branch.** If on the default branch, create a feature branch (`git checkout -b feat/<slug>`).
2. **Scope check.** `git status --short`. If the tree holds unrelated changes, surface them and ask how
   to scope.
3. **Stage explicitly, then commit:**
   - Subject: `<type>(<scope>): <summary> (vX.Y.Z)` — `feat` / `fix` / `refactor` / `perf` / `chore` /
     `docs`.
   - Body: 3–6 bullets of what changed + why; note the test count and that the suite is green.
4. **Do not push** unless asked.
5. Report the commit hash.

Never stage `.env`. Never commit a secret.

---

## Summary checklist

Output at the end of every run:

```
✓ Oriented (luna-orient)
✓ Requirements clarified (vX.Y.Z confirmed)
✓ Plan approved
✓ Implementation complete
✓ Validation: <test results, tsc, build>
✓ DEVELOPMENT.md updated (vX.Y.Z)
✓ Committed (vX.Y.Z, <hash>)
```

Mark any skipped or failed step with ✗ and say why.
