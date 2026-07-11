# Contributing to Luna

Thanks for looking. Luna is opinionated about two things — **latency** and **a single typed contract
between backend and frontend**. Most of the guidance below exists to protect those two properties.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first; it's the structural map. [`docs/history/DEVELOPMENT.md`](docs/history/DEVELOPMENT.md)
is the per-version log — the truth source for "what actually shipped."

## Getting set up

```sh
bun install                       # Bun ≥ 1.2
cp .env.example .env              # set ANTHROPIC_API_KEY (the only value needed for a text-only run)

bun run dev                       # server + web
bun test                          # the whole suite, from the repo root
```

Per-package typecheck (all four must stay clean):

```sh
bun run --cwd packages/protocol tsc --noEmit
bun run --cwd packages/server   tsc --noEmit
bun run --cwd packages/web      tsc --noEmit
bun run --cwd packages/desktop  tsc --noEmit
```

No avatar model or voice weights ship with the repo — see [`docs/SETUP.md`](docs/SETUP.md) to add your own.

## The rules that matter

These are the invariants. Breaking one is the kind of bug that stays hidden for weeks.

1. **`packages/protocol` is the single source of truth for the wire.** Adding a `ServerEvent` variant
   without updating its consumer is exactly the silent drift this project exists to eliminate. A
   protocol change must land in the same commit as both sides of the socket. Build `server` **and**
   `web` after touching it — the drift should surface as a type error, not a runtime surprise.

2. **Never buffer tool calls.** Emit `tool.started` / `tool.progress` / `tool.finished` as they arrive
   on the provider stream. Buffering to the end of the turn re-introduces the "tool turn feels
   blocking" symptom the streaming architecture was built to kill.

3. **The tool dispatcher's concurrency policy is load-bearing.** A tool declared parallel-safe that
   secretly mutates shared state is a race condition. If your tool writes anything, say so.

4. **SQLite migrations are versioned, never edited in place.** Write a new file under
   `packages/server/src/migrations/`. Migrations must be atomic.

5. **Risky subsystems land behind a default-off flag.** Ship the flag, verify the feature in isolation,
   then flip the default in a follow-up. `LUNA_*` env vars are the convention; document them in
   `.env.example`.

6. **Never commit secrets.** `.env` is gitignored and holds real keys. `.env.example` holds only
   placeholders. Don't add real endpoints, keys, or personal paths to tracked files.

## Code standards

- **No comments unless the *why* is non-obvious** — a hidden constraint, a subtle invariant, a
  workaround. The types are the documentation; don't restate them in prose.
- **No `as any`, no `as unknown`, no `@ts-ignore` / `@ts-expect-error`** without a one-line WHY on the
  same line. The wire boundary in particular must be cast-free.
- **Don't use `instanceof Error` or string-matching to *decide* that an error happened** — only to build
  one. Errors are values on the result path.
- **Tests live next to the code** they test: `packages/<pkg>/src/**/*.test.ts`. There is no central test
  monolith.
- Prefer pure, injectable functions for anything you want to test (pass `exists`, `fetch`, `storage` in
  as options with real defaults — see `resolveSqliteLib`, `resolveModelUrl`, `planTtsForward`).

## Making a change

1. **Orient.** Read `ARCHITECTURE.md` and the relevant module. Check `docs/history/DEVELOPMENT.md` for the
   current version and how the area evolved.
2. **Scope it.** Which packages? Does it touch the wire contract, the tool surface, or the SQLite
   schema? Those three need extra care (see the rules above).
3. **Implement**, with tests beside the code.
4. **Validate.** `bun test` from the root + `tsc --noEmit` in every package you touched. If you changed
   the web or desktop shell, also `bun run --cwd packages/web build`.
5. **Record it.** Add an entry to `docs/history/DEVELOPMENT.md` (see its format — a Version Index row plus a
   detailed `Fact:` / `Inference:` section). State what changed, not what the code does.

## Versions & commits

Versions are `v0.X.Y` and **reserve across the project** — never reuse or overlap a number, even when
work streams interleave. The Version Index in `docs/history/DEVELOPMENT.md` is authoritative.

Commit messages are conventional:

```
<type>(<scope>): <summary> (vX.Y.Z)

- 3-6 bullets: what changed and why
- note the test count and that the suite is green
```

`type` is one of `feat` / `fix` / `refactor` / `perf` / `chore` / `docs`. Stage files explicitly —
please don't `git add -A`.

## Agent-assisted contribution

This repo ships Claude Code skills under [`.claude/skills/`](.claude/skills/):

| Skill | Use it to |
|---|---|
| `luna-orient` | Load the project map before any non-trivial task |
| `luna-dev` | Run the full 5-phase change lifecycle (orient → scope → plan → implement → record) |
| `luna-roadmap` | Turn a settled plan into staged, executable version plans under `docs/roadmap/` |

They encode the discipline above. If you're working with an agent, point it at `luna-orient` first.

## Reporting things

Bugs and questions are welcome as issues. For anything touching the wire protocol, memory schema, or the
tool surface, please open an issue to discuss before a large PR — those three are where a well-meaning
change can quietly break the invariants.
