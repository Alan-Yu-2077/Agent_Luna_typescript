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
  about the rewrite without a concrete change request, or tasks already mid-flight. (The Python
  original and its `luna-dev` skill were archived on 2026-08-01 — there is no parity repo to
  redirect to any more.)
---

# Luna (TypeScript) Development Lifecycle

## Where the code is, and what this project is now (read first — consolidated 2026-08-01)

**Everything is one line now.** The owner consolidated on 2026-08-01: one working tree, one remote,
one branch. Anything you remember about a second folder, a second remote, or an `oss-prep` branch is
history — it was archived that day.

- **Work in `~/Desktop/Luna-ts`, branch `main`.** The owner's real `luna.sqlite`, his `luna.env`, and
  the `Luna.app` he runs all live around this tree. It is the only tree.
- **One remote: `origin` → `github.com/Alan-Yu-2077/Agent_Luna_typescript.git`, branch `main`.**
  It is **PUBLIC** (it always was, despite older notes here claiming otherwise) and it is the
  development backup — push at the end of every version so the work is traceable off-machine.
  Real history, real identity, no replay, no PII gymnastics. Nothing is secret in it: `luna.env`,
  `luna.sqlite` and `docs/roadmap/` are all excluded and verified absent from history.
- **`github.com/Alan-Yu-2077/Luna-ts` is ARCHIVED (read-only)** — the old published showcase, frozen
  at v0.41.0. It is no longer a git remote here at all. Don't offer to publish to it.
- The GPT-SoVITS voice runtime lives at
  `~/Library/Application Support/@luna/desktop/tts/runtime` (moved off the retired Python tree on
  2026-08-01). Reference audio: `.../tts/voice/neuro-v2/reference.wav`.

**Luna is a private, single-machine companion — not a distributed product** (owner decision, landed
as v0.41.0, 2026-07-30). No installers, no GitHub Releases, no cross-platform product support.

Consequences that bind every version you plan or build:

- **Never propose** distribution, packaging, installers, platform ports, code signing, or acceptance
  testing on hardware the owner has to go find. That tier is permanently closed.
- **CI runs on every `push origin`** (ubuntu + windows, `.github/workflows/ci.yml`) and a red run
  EMAILS the owner. Local `bun test` green is not the finish line — after pushing, check the run
  (`gh run list`); red = a real problem or an environment regression to fix, never to ignore.
  (An older revision of this skill said "CI no longer runs" — that stale line caused a month of
  failure mail. Environment-dependent tests must `test.skipIf` their missing prerequisites.)
- Judge ideas by what they do for *her* — memory, personality, presence, expressiveness — and for the
  readability of the engineering. Not by reach.
- **The win32 branches in the code stay.** They are unit-tested cross-platform hygiene, and the
  principle is "stop promising Windows", not "remove Windows". Do not offer to rip them out.

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

`docs/REWRITE_CONTEXT.md` no longer exists (retired in the 2026-08-01 consolidation). Locked
design decisions now live in `ARCHITECTURE.md`; open questions live in the relevant initiative
README under `docs/roadmap/`. If one of those bears on the request, surface it in Phase 1.

---

## Phase 1 — Requirements Analysis + Version Proposal

### 1a. First-round clarification

After the user states their initial goal, do NOT immediately write a plan. Ask a focused set of
clarifying questions to surface the real requirement. Adapt to what is actually unclear — no
generic boilerplate.

Good clarifying angles for this rewrite:

- **Package scope**: which of the five — `packages/protocol`, `packages/server`, `packages/web`,
  `packages/music-cli`, `packages/desktop` (and which
  module within) does this touch?
- **Wire contract impact**: does this add/remove/change a `ClientEvent` or `ServerEvent`
  variant? If yes, both packages will need updates in lockstep — flag it.
- **Tool spec impact**: does this add/modify a `defineTool` declaration? If yes: what's the
  `concurrency` policy, what's `summarize`, what's the `timeoutMs`?
- **Memory impact**: does this touch the SQLite schema for L1 / L2 / L3? Migrations need a
  declared `migrations/` file, not silent in-place edits.
- **Open question dependency**: does this require resolving an Open Question in
  an initiative README's Open Questions? If yes, that resolution lands in the same change.
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
   recommendation. Link to the relevant initiative README's Open Question if applicable.
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
- If this resolves an Open Question, say so and record the resolution where that question lives
  (the initiative README, or `ARCHITECTURE.md` when it rises to a locked decision)

After writing the entry, update `Last updated:` at the top to today.

---

## Phase 5 — Land it (commit → repackage → smoke)

A version is NOT done at the commit. **The deliverable is the instance he actually talks to**, so
landing means the running app carries the change. Once Phase 4 is done and validation passed:

### 5a. Commit

Apply guards — do NOT blindly `git add -A`:

1. **Branch discipline.** `git rev-parse --abbrev-ref HEAD` — expect `main` in `~/Desktop/Luna-ts`.
   There is only one branch by design (consolidated 2026-08-01); do not create feature branches
   unless the owner asks.
2. **Scope check.** `git status --short`. If the working tree holds changes unrelated to this
   version, surface them and ask how to scope (this version only vs everything).
3. **Stage explicit paths only.** Never `git add -A` / `git add .`. Never stage `.env`, `*.sqlite`,
   `launch.json`, or anything under `docs/roadmap/` (that folder is git-invisible via
   `.git/info/exclude` — do NOT "fix" it by adding it to `.gitignore`).
4. **Commit** with a conventional-commit message:
   - Subject: `<type>(<scope>): <summary> (vX.Y.Z)` — `feat` / `fix` / `refactor` / `perf` / `docs`.
   - Body: 3–6 bullets of what changed + why; note the test count and that the suite is green.
   - End with the `Co-Authored-By:` footer naming the model you are actually running as — the
     harness states the exact line. **Do not copy a version out of this file**; it drifts.
5. **Back it up** — every version, so nothing lives on one disk only:

   ```sh
   git push origin main   # the only remote, the only branch. Tracking is set.
   ```

### 5b. Repackage — the owner's standing rule

**If the version touched `packages/web` or `packages/server` code, the packaged app is now stale and
a commit alone changes nothing he can see.** Rebuild and re-deliver:

```sh
cd ~/Desktop/Luna-ts/packages/web    && bun run build        # web dist
cd ~/Desktop/Luna-ts/packages/desktop && bun run compile:server && bun run pack
bun run smoke:packaged                                             # must print ok:true
```

Then rotate onto the Desktop, keeping one rollback copy:

```sh
rm -rf ~/Desktop/Luna-prev.app && mv ~/Desktop/Luna.app ~/Desktop/Luna-prev.app
cp -R ~/Desktop/Luna-ts/packages/desktop/release/mac-arm64/Luna.app ~/Desktop/Luna.app
```

If a dev-server run is needed for verification, strip the yunwu vars or the key 401s against
Anthropic: `env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY bun run dev`.

**Never disturb his live instance while working**: don't kill his `:8787` backend, his `:9880`
api_v2, or touch the shared `~/Desktop/Luna-ts/luna.sqlite`. Use throwaway ports for tests.

### 5c. Report

Commit hash, test count, and — explicitly — whether the packaged app was refreshed or why it didn't
need to be.

---

## Summary checklist

At the end of every luna-ts-dev run, output:

```
✓ Oriented (luna-ts-orient)
✓ Requirements clarified (vX.Y.Z confirmed)
✓ Plan approved
✓ Implementation complete
✓ Validation: <test count> pass / 0 fail, five packages tsc clean, CI green after push
✓ DEVELOPMENT.md updated (vX.Y.Z)
✓ Committed (vX.Y.Z, <commit hash>) + pushed to origin/main
✓ Repackaged + smoked (ok:true) → new Luna.app on the Desktop   ← or: "not needed, <reason>"
```

If any step was skipped or failed, mark it ✗ and explain why.
