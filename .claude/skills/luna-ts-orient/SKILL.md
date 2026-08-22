---
name: luna-ts-orient
description: >
  Ground-truth project map for Luna (the TypeScript companion agent at ~/Desktop/Luna-ts).
  Invoke at the start of any non-trivial task in this repo (or via /luna-ts-orient) before
  searching the tree blindly: where the code lives, the shape of the hot path, the real tool
  and event surface, which env gates are on by default, and the concepts that are DEAD but
  still remembered by older notes. Treat `docs/history/DEVELOPMENT.md` as the truth source for
  "what version are we on" — this file gives you shape, that file gives you the number.
---

# Luna (TypeScript) — Code-Truth Orientation

Last calibrated against the tree: **2026-08-09, shipped head v0.45.17.** Everything below was
re-derived from source on that date. Where this file and the code disagree, **the code wins** —
and fix this file in the same change.

## ⛔ Read this before anything else

**One tree, one remote, one branch: `~/Desktop/Luna-ts`, branch `main`.** It holds the live
`luna.sqlite` (repo root, 58 MB — gitignored, never commit it), the real `.env`, and the source
the owner's `Luna.app` actually runs. `origin` is `Agent_Luna_typescript.git` and it is **public** —
every push is publishing. `docs/roadmap/` is deliberately git-invisible (`.git/info/exclude`).

Gone as of the 2026-08-01 consolidation — if you remember them, that memory is stale:
`~/Desktop/Agent_Luna_typescript` (second tree), the `oss-prep` branch, the second remote, the
Python original `~/Desktop/Agent_Luna`, and `docs/REWRITE_CONTEXT.md`. **There is no Python parity
reference any more.** Locked design decisions now live in `ARCHITECTURE.md`, not in a context file.

### 🪤 The grep trap (this environment, every session)

The shell runs with an empty locale (`LANG=`/`LC_ALL=` unset). BSD `grep` then treats any file
containing emoji or CJK — which is most of this repo — as **binary and silently skips it: zero
output, no "Binary file matches" line.** A bare `grep` that finds nothing proves nothing.

**Always `grep -a`** (or `rg`, `Read`, `awk`) when the answer "it isn't there" would matter.
Before deleting anything as unused: `grep -a` **plus** `bunx tsc --noEmit` — never grep alone.

### The owner's runtime is the dev-all path, not the packaged sidecar

The packaged `Luna.app`, when the repo + bun + keys are present, spawns `bun scripts/dev-all.ts`
(server 8787 + web 5173 served by `packages/web/dev-server.ts`). Consequences:

- **Config home is the repo `.env`**, not `<userData>/luna.env`. Only whitelisted keys are forwarded
  from luna.env into that spawn (`packages/desktop/src/main.ts`, the dev-all branch).
- **Server/web edits take effect on app restart — no repack needed.** Repacking only refreshes the
  Electron shell (desktop main/preload).
- **A new `/api/*` face must be added twice**: `packages/web/dev-server.ts` *and*
  `packages/desktop/src/serve.ts`. A parity test guards this; adding only one is a v0.45.6 repeat.
- The live DB is the **repo-root `luna.sqlite`** (shared-DB mode), not the app-data copy.

## Where things are

```
packages/
  protocol/   the wire contract — zod schemas + inferred types, imported by BOTH sides
    events.ts   ClientEvent: ping · dev.dispatch_tool · chat.send · dream.enter · dream.wake
                             proactive.fire · client.geo · settings.set
                ServerEvent: pong · error · tool.started/progress/finished · turn.started
                             reply.token · turn.result · dream.status · dream.step
                             proactive.started · proactive.finished{spoke, quiet_note?} · history · settings.state
    tools.ts memory.ts message.ts trace.ts data.ts music.ts
  server/     the brain — owns all state and every model call
    main.ts ws.ts wsOrigin.ts outbound.ts sql.ts swallow.ts shutdownRoute.ts
    turn/ tools/ memory/ dream/ proactive/ provider/ persona/ skills/ code/
    data/ settings/ trace/ workspace/ migrations/ (22 files)
  web/        thin reactive view — app.ts controller.ts wsClient.ts + live2d/ (18) ui/ (25)
              audio/ physics/ tts/ + menuMode wakeSequence returnGate quietLeaf uiMode workbenchMode
  music-cli/  vendored macOS Now-Playing observer (v0.45.0, re-vendored v0.45.8)
              adapter.ts (the ONLY file that knows media-control's JSON)
              library.ts (the ONLY file that knows the NetEase local SQLite — opened READ-ONLY)
              lyrics.ts  (the ONLY file that knows the lyric endpoint)
              → everything else consumes the types.ts contracts
  desktop/    Electron shell: window, pet mode, supervisors (sidecar + TTS), serve.ts, envfile.ts
```

**Truth sources**, in order: the code → `docs/history/DEVELOPMENT.md` (per-version log, top line =
shipped head) → `ARCHITECTURE.md` (structural map + locked decisions) → `docs/roadmap/README.md`
(forward plan, local-only). **Never quote a test count from a file** — run `bun test`.

## The hot path

`ws.ts` (`chat.send`) → `turn/runTurn.ts`, a declarative `Graph<TurnState, TurnNode>`:
`parse_input → build_request → open_stream → dispatch_tools → append_results → finalize`.

- The system prompt is assembled once and cache-stable; **volatile perception (time, weather, music,
  lyrics, recall) goes into the UNCACHED user tail**, never the cached system block.
- Tool calls stream (`tool.started/progress/finished`) as the provider yields them — never buffered.
- Two budgets, different jobs: `MAX_TOOL_ITERATIONS` (default 8, `LUNA_MAX_TOOL_ITERATIONS`) caps
  *rounds*; `LUNA_PROACTIVE_MAX_ACTIONS` (default 8) caps *total tool calls in one proactive cycle*.
- Speech happens **only through the `message` tool**; finalize enforces action-integrity guards
  (promise-without-act, intent-without-act) with one bounded retry.
- Reactive vs proactive vs dream are mutually exclusive via `session.activeTurn` + a synchronous
  check-and-set prefix, plus `withProactiveLock` per session.

## The tool surface (28 tools, `protocol/src/tools.ts` is the list)

`time_now read_file remember enter_dream message recall list_files grep edit multi_edit write_file
shell typecheck run_tests lint repo_map find_symbol plan save_skill recall_skill propose_self_edit
web_search web_fetch weather music_now music_control music_library music_lyrics`

**`proactiveRisk` is fail-closed**: a tool is silently runnable in a proactive turn ONLY if it
explicitly opts into `'safe'`. Anything unmarked is `'surface'` — allowed only after she has already
spoken this cycle. `music_control` is deliberately unmarked; that is the design, not an oversight.

Capability gates unmount whole groups (`LUNA_CODE_WRITE`, `LUNA_SHELL`, `LUNA_SELF_EDIT`,
`LUNA_SKILLS`, `LUNA_WEB_SEARCH`, `LUNA_WEB_FETCH`, `LUNA_MUSIC`, weather via `LUNA_LAT_LON`).
The registry is assembled **once at boot** — flipping a mount flag needs a restart.

## Default-ON vs default-OFF (the polarity actually in the source)

`!== '0'` = **on unless disabled**: `LUNA_MESSAGE_TOOL` `LUNA_L1_CONTRACT` `LUNA_INTEGRITY_GUARD`
`LUNA_DECISION_AUDIT` `LUNA_PERSONA` `LUNA_PERSIST` `LUNA_MEMORY_INJECT` `LUNA_MEMORY_EMBEDDING`
`LUNA_DIARY_INJECT` `LUNA_CODE_WRITE` `LUNA_LINT_ON_WRITE` `LUNA_CLEAN_HISTORY` `LUNA_VIEWER`
`LUNA_WEB_FETCH` `LUNA_MUSIC_AMBIENT` `LUNA_MUSIC_PROACTIVE` `LUNA_QUIET_WORK` `LUNA_SELFCONT`
`LUNA_PROACTIVE` `LUNA_PROACTIVE_LADDER` `LUNA_SHUTDOWN_DREAM`

`=== '1'` = **off unless enabled**: `LUNA_DEV_TOOLS` `LUNA_MUSIC` `LUNA_MUSIC_ENRICH`
`LUNA_PROACTIVE_EVENT_HOOKS` `LUNA_OPENAI_STREAM` `LUNA_OPENAI_REASONING` `LUNA_WEB_CACHE`

`.env.example` documents the full surface with defaults; it is kept in sync deliberately.

## Concepts that are DEAD (older notes and stale memories still cite them)

| Believed | Truth |
|---|---|
| A detector registry picks the proactive trigger | **Deleted in v0.24.1.** The silence ladder is THE wake decision; extra reasons (music moment) stack *inside* the same tick behind the global cadence rail. `weatherShift` survives only as a default-off event hook. |
| A `consolidate` proactive intent triggers dreams | **Deleted in v0.45.12** — it was unreachable code with a full directive block. Intents are `spontaneous` / `continuation`. |
| Anthropic SDK only; `openai_compat` dropped | An OpenAI provider shipped in Initiative 16 — `provider/openai/`. (Known debt: its `tool_choice:'required'` over-correction must be fixed *before* anyone switches to it.) |
| The skills subsystem was cut | Shipped in Initiative 23 — `server/src/skills/`, plus dream-time distillation. |
| A browser voice covers for missing TTS | **Removed in v0.43.14.** No GPT-SoVITS ⇒ she is silent, by decision. |
| `web_fetch` is opt-in pending a DNS pin | The pin landed in v0.18.3; the gate has been default-ON since. The comment that said otherwise was a lie fixed in v0.45.13. |
| `proactiveInFlight` / `stopScheduler` / `currentStep` exist | Deleted in v0.45.14 — exported, never called. The scheduler's timer is `unref`'d and simply dies with the process; nothing stops it. |
| Distribution / installers / releases / Windows product work | Retired in v0.41.0. win32 *code* stays; distribution as a goal does not. Never propose packaging or platform ports. |

## Run / test

- `bun test` from `~/Desktop/Luna-ts` — the only honest source of the test count.
- `bunx tsc --noEmit` inside each of the **five** packages; all must be clean.
- `bun run dev` = `scripts/dev-all.ts` (server 8787 + web 5173). Bun lives at `/opt/homebrew/bin/bun`.
- The harness shell may pre-set `ANTHROPIC_BASE_URL=https://api.anthropic.com`; the owner's key is a
  yunwu.ai gateway key, so `env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY` before running anything
  that talks to the real model, or it 401s.
- Packaged path (only needed for shell changes): `bun run --cwd packages/web build`,
  `bun run --cwd packages/desktop compile:server`, `pack`, `smoke:packaged`.

## Doc-vs-code traps (live list — append when you find one)

1. **A comment claiming a gate's default is not evidence.** Two shipped lies were found this way
   (`web_fetch` "opt-in", `registry.ts` "default-OFF"). Read the expression, not the prose.
2. **`grep` silently lies here** — see the trap section at the top.
3. **Version numbers in prose drift.** DEVELOPMENT.md's top line is the only head worth quoting.
4. **The roadmap's status column drifts behind the plan files.** Dev sessions update the plan file
   they ship and forget the master index; verify against `git log` before believing either.

## Iteration discipline

Every shipped version appends to `docs/history/DEVELOPMENT.md` (Version Index row + Detailed
Record). **If a change alters the orientation picture — a new package, a dead concept, a flipped
default, a new trap — update THIS file in the same commit.** A map stale by three versions is
worse than no map: it makes confident readers wrong.
