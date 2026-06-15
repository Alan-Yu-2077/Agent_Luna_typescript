# Docs index — Agent_Luna (TypeScript)

This is the documentation root for the TS rewrite. It mirrors the Python project's docs structure so
that the same `luna-dev` / `luna-orient` / `luna-roadmap` discipline applies.

## What lives where

| File | Purpose | When to read |
|---|---|---|
| [`REWRITE_CONTEXT.md`](REWRITE_CONTEXT.md) | Audited facts about Python Luna + locked design decisions for v2 + still-open questions | **Read first** on any non-trivial change |
| [`history/DEVELOPMENT.md`](history/DEVELOPMENT.md) | Per-version log of what actually shipped in this TS repo | Truth source for "what version are we on" |
| [`ARCH_EFFICIENCY.md`](ARCH_EFFICIENCY.md) | Design-level inefficiency findings (the "recompute from full corpus every turn" pattern) | Before perf work or anything in the hot path |
| [`roadmap/README.md`](roadmap/README.md) | Forward plan: initiatives in execution order with status | Before planning the next version |
| [`roadmap/<initiative>-YYYY-MM/`](roadmap/) | Self-contained version plans, one folder per initiative | When ready to execute a specific version |

## Discipline (carried over from Python Luna)

1. **One plan per shipped version.** Each `vX.Y.Z-<theme>.md` is self-contained: goal, backend changes,
   frontend changes, tests, risk, acceptance criteria.
2. **Version numbers reserve across initiatives** — never overlap, never reuse. Even when initiatives
   interleave (Python Luna shipped v0.47.x and v0.52.x in parallel), each version is unique.
3. **`DEVELOPMENT.md` is the truth.** When in doubt about "what's actually shipped", read it — not
   the roadmap, not this file, not in-flight conversations.
4. **Roadmap is a plan, not a contract.** Versions can move between initiatives, get deferred, or be
   merged when reality demands. Update the roadmap when that happens; do not lie.

## What's intentionally not here yet

- API reference docs (no API yet)
- Architecture diagrams (premature — wait for v0.3+ when the wire protocol stabilizes)
- A `runtime-atlas` interactive map (Python Luna has one; we'll port it after v0.5+)
- A `reasoning-spec.md` cross-cutting doc (will land alongside the reasoning-rails initiative)
