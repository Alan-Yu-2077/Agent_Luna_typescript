---
name: luna-ts-orient
description: >
  Ground-truth project map for Agent_Luna (TypeScript rewrite, not the Python original).
  Invoke at the start of any non-trivial task in this repo (or via /luna-ts-orient) before
  searching the tree blindly. Tells you the current shipped version, the locked design
  decisions, the deliberate cuts from Python Luna, and where to find code-truth vs
  documentation-truth. The Python original lives at `/Users/alanyu2077/Desktop/Agent_Luna`
  and is a *parity reference*, not the same project. Treat
  `docs/history/DEVELOPMENT.md` as the truth source for "what version are we on" in THIS
  repo — never confuse it with the Python repo's version log.
---

# Agent_Luna (TypeScript) — Code-Truth Orientation

This skill is a code-truth map for the TypeScript rewrite. It is **deliberately distinct** from
the Python project's `luna-orient` skill; the two repos share design history but not version
numbers, runtime, or source tree.

## What this repo is

A clean-room TypeScript rewrite of [Agent_Luna](https://github.com/Alan-Yu-2077/Agent_Luna) at
`/Users/alanyu2077/Desktop/Agent_Luna` (Python, shipped through v0.47.11 as of 2026-06-11). The
rewrite targets two goals the Python version cannot reach incrementally: end-to-end response
speed and a single typed contract shared by backend and frontend. See
[`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md) for the audited facts that drive
every decision here.

## Current state (read this first)

> Repo is **scaffolding only**. No runtime code yet. First initiative (tool spec foundation,
> v0.1.0–v0.3.0) is planned in `docs/roadmap/tool-spec-foundation-2026-06/`. Until v0.1 ships,
> there is no `packages/`, no `package.json`, no `tsconfig`. Don't grep for code that doesn't
> exist — read the roadmap plan files instead.

Verify current version state by reading the top of
[`docs/history/DEVELOPMENT.md`](../../../docs/history/DEVELOPMENT.md). If that file says any
version > pre-v0.1.0, the **Once code exists** section below applies and this skill needs to
grow into a real ground-truth map of what shipped.

## Locked design decisions (don't re-litigate)

From [`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md):

| Decision | Choice |
|---|---|
| Runtime | **Bun** (native TS, `bun:sqlite`, native WebSocket) |
| Wire | **Single WebSocket per session** — one channel for chat + proactive + tool approval + Live2D commands |
| Persistence | **SQLite** (+ `sqlite-vec` for embeddings) |
| Schema | **Zod** as single source of truth → TS types + JSON Schema + runtime validation |
| User scope | **Single user** (no `user_id` threading; default session) |
| LLM provider | **Anthropic via official SDK only** (drop `openai_compat` and `mock`) |
| Tool streaming | **Anthropic interleaved tool-use SSE** — token stream continues through tool calls |
| Frontend scope | **TS-port `agent-app.js` controller only** — Live2D + audio pipeline untouched |

## What's cut from Python (减负 list — don't try to port these)

See [`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md) §"What we are cutting" for the
full list with rationale. Highlights:

- STS2 game integration (29 tools, all gone)
- `openai_compat` and `mock` providers
- Tool demand-load + `workspace_intent` keyword gating + `force_full_tools` meta (the v0.47.x
  bug source)
- Skills subsystem (`list_skills` / `activate_skill` / `exit_skill`)
- Tool approval gating (dormant in Python)
- `patch_file` / `replace_in_file` (kept `edit_file` only)
- `make_directory` / `move_path` / `copy_path` / `delete_path` (folded into `shell`)
- `local_roots` / `explore_local_files` / `codebase_overview` / `find_relevant_files`
  (covered by `list_files` + `search_code` + `read_file`)
- `progress_update` (replaced by tool-self-streaming)
- 4 separate memory tools (`remember`/`revise_memory`/`forget`/`update_self`) → one `remember`
  with discriminator
- All AGENT_MESSAGE_TOOL_NAMES special-casing
- `startswith('Error')` failure heuristic

## What's kept from Python

- Four-layer memory model (L1 / L2 / L3 / diary) — concepts, storage swapped to SQLite
- Proactive state machine (`ENGAGED → IDLE_WATCH → NUDGED → DORMANT → SLEEPING`)
- Reasoning-spec L1/L2 philosophy (mechanical rail + bounded model judgment + logged audit)
- Humanity hard caps (140 / 4 / 55), but enforced at the streaming layer (not prompt-only)
- Persona three-layer resolution (base / runtime / scene)
- Live2D pipeline + TTS pipeline (Node proxy + Python GPT-SoVITS sidecar) — untouched

## Cross-references

- Python source (parity reference): `/Users/alanyu2077/Desktop/Agent_Luna`
- Python audit findings (the 15-dimension ground-truth pass that drives this rewrite): captured
  in [`docs/REWRITE_CONTEXT.md`](../../../docs/REWRITE_CONTEXT.md) §"Why we are rewriting"
- Forward plan: [`docs/roadmap/README.md`](../../../docs/roadmap/README.md)
- Per-version log: [`docs/history/DEVELOPMENT.md`](../../../docs/history/DEVELOPMENT.md)

## Once code exists (grow this skill at v0.1+)

After v0.1.0 ships, this section should be expanded to mirror Python `luna-orient`'s pattern:

- **File map**: `packages/protocol/`, `packages/server/`, `packages/web/` with per-file roles
- **The hot path**: WS frame → router → turn orchestrator → tool dispatcher → provider stream
  → outbound, with file:line citations
- **WS event contract**: every `ClientEvent` / `ServerEvent` variant, source, when emitted
- **Memory layer table**: SQLite schemas, indexes, retrieval paths
- **Tool surface**: each tool's input/output schema + concurrency + summarize
- **Run / test**: `bun start`, `bun test`, env vars consumed
- **Doc-vs-code traps** (will accrue over time): claims in docs that drifted past code

**Discipline**: every shipped version should append to this skill if it changes the orientation
picture. A skill stale by 3 versions is worse than no skill.

## Doc-vs-code traps (current)

Pre-v0.1: none — no code to drift past. Once v0.1+ ships, document them here, mirroring the
Python skill's pattern (numbered, with citations).

## Iteration discipline (when landing changes)

- Append outcome to `docs/history/DEVELOPMENT.md` Version Index + Detailed Record (template
  identical to Python repo's; see luna-ts-dev Phase 4)
- Update this skill's "Once code exists" section to reflect new architectural truth
- Add tests next to the package they cover (`packages/server/src/**/*.test.ts`)
- Update `docs/REWRITE_CONTEXT.md` if a Locked decision changes or an Open question resolves
