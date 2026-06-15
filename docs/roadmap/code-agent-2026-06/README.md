# Initiative 8 — Code-agent capability (the hands)

> **Status: 📋 PLANNED.** Priority: **next** (after Initiatives 1–6 ✅, Initiative 7 ❌ cancelled).
> Version range: **v0.15.0 – v0.15.4** (5 versions). Master index:
> [`../README.md`](../README.md).

## The idea

Luna has a brain, memory, dream, proactivity, and a body — but her **hands are crippled**. Today she
has exactly one read-only file primitive (`read_file`, any path, whole-file, no line range) and **no**
write/edit/shell/grep/glob/list tools. She can't browse a tree, find code by pattern, locate a symbol,
edit a file, run a test, or execute a command. This initiative gives her a **mainstream code-agent
capability** — locate → plan → edit → verify → iterate — built on the typed `defineTool` registry, and
caps it with the one self-evolution feature that is actually safe for a single-user companion: a
**persisted, self-verified skill library** plus **human-gated** self-modification. The acceptance bar
is "a real code agent," and the through-line stays the rewrite's: a typed tool surface, streaming
dispatch, and traceable, gated action.

## Why now / why this shape

Initiatives 1–6 shipped the whole companion (brain + memory + dream + proactivity + Live2D body +
voice). Initiative 7 (open-source packaging) was cancelled. The next leap in usefulness is **doing
real work on the user's machine** — which the architecture was explicitly built to host: LD #9
(everything-as-tool) + LD #10 (always-on + deny-regex for `shell`, *"lands at v0.4+ when concrete need
arises"* — that time is now) + LD #15 (the proactive safety gate that an irreversible code tool plugs
straight into).

The staging **isolates risk before capability**: the safe, read-only navigation + a real workspace
sandbox land first (v0.15.0); writes land behind a flag with read-before-edit + lint-on-write
(v0.15.1); the most dangerous surface — `shell` — lands behind its own flag with deny-regex + a verify
loop (v0.15.2); targeting power-ups (repo map / symbol locator) land once the basics work (v0.15.3);
self-evolution lands last, deliberately limited to the safe pattern (v0.15.4).

## Locked design decisions referenced

Pulled verbatim from [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- **LD #9 — Everything-as-tool**: *"`message` tool + all side-effect tools; no top-level `text`;
  reasoning via Claude `thinking` blocks."* Every new code primitive is a `defineTool` tool — no
  special cases. **減負 note (LD #9 detail, line 164):** *"`make_directory`, `move_path`, `copy_path`,
  `delete_path` → folded into `shell` tool"* — so this initiative does **not** add separate fs-mutation
  tools; directory/move/copy/delete go through `shell`.
- **LD #10 — Risky-tool mount policy**: *"Always-on + deny-regex inside the tool (no judgment-gated
  mounting; no `mountedWhen` predicate on `defineTool`) … applies to `shell` when it ships at v0.4+."*
  Resolves Open Q #1. The shell + edit tools are always mounted; safety is a deny-regex **inside**
  `execute`, not a mount predicate.
- **LD #15 — Proactive safety (reversible-silent / irreversible-surfaced)**: *"reads/searches/memory/
  dream may run silently; irreversible/destructive actions must surface a message first … deny-regex on
  `shell` (LD #10), fail-closed classification for unknown tools."* Every write/shell tool is
  `proactiveRisk: 'surface'`, so in a proactive turn Luna must speak before mutating — the gate already
  exists (`proactive/safetyGate.ts`).
- **LD #14 — L1 thinking contract is the design, not gates**: the locate→act→verify discipline is
  reinforced in the cached L1 contract (commitment-to-act, tool-trigger checklist), not a new gate.

## Verified architectural facts (from source, this session)

Every later plan builds on these instead of re-deriving. Citations are `package/src/file.ts:line`.

1. **Tool surface today = 6 tools, none of them code tools.** `time_now`, `read_file`, `remember`,
   `enter_dream`, `recall`, `message` — mounted in `packages/server/src/tools/registry.ts:15-30`
   (`builtinRegistry` 5 + `message` conditional). No `shell`/`edit`/`write`/`grep`/`glob`/`list`.
2. **`read_file` has NO path sandbox and NO line range** — `Bun.file(input.path).text()` accepts any
   absolute/relative path, 32 KB cap (`packages/server/src/tools/builtin/read_file.ts:30-54`). The
   "locked in a directory" the user perceives is actually the *opposite*: unbounded reads + zero
   navigation. A real workspace jail is missing and must be **added** (it's a safety upgrade, not a
   loosening).
3. **`defineTool` is the only extension point** (`packages/server/src/tools/defineTool.ts:44-57`):
   `{name, description, input: ZodSchema, output: ZodSchema, concurrency, timeoutMs, proactiveRisk,
   summarize, execute: async generator yielding progress|ok|err}`. Tool name must first be added to the
   `ToolName` enum in `packages/protocol/src/tools.ts:3-10`.
4. **Dispatcher** (`packages/server/src/tools/dispatcher.ts`): validates input (`safeParse`, line ~99 →
   `validation_failed`), emits `tool.started` only on success, streams `tool.progress`/`tool.final`,
   races `ctx.abortSignal` for `timeoutMs`, caps at `MAX_CONCURRENT_TOOLS_PER_SESSION = 8`, concurrency
   = `safe-parallel | session-serial | global-serial`.
5. **Proactive safety gate exists** (`packages/server/src/proactive/safetyGate.ts:1-31` +
   `packages/server/src/turn/runTurn.ts:286-293`): `proactiveRisk: 'safe' | 'surface'` (default
   'surface', fail-closed); a 'surface' tool is blocked in a proactive turn until Luna has messaged;
   `LUNA_PROACTIVE_MAX_ACTIONS` (default 6) action budget. A new write/shell tool plugs in by setting
   `proactiveRisk: 'surface'` — **no gate code to write**.
6. **Trace store auto-captures every tool** (`tool.started/progress/final`) into SQLite
   (`packages/server/src/trace/store.ts`, 500-event cap, 4 KB payload clamp). Decision traces for
   intent-vs-act exist (`packages/server/src/turn/integrity/defectionAudit.ts`).
7. **SQLite + the memory substrate** (`packages/server/src/memory/*`, `sql.ts`, migrations) is the
   natural home for the repo-map cache (mtime-keyed) and the skill library (FTS5 already used for L2).

## Python parity notes (the reference to port, with divergences)

Python Luna at `/Users/alanyu2077/Desktop/Agent_Luna/Agent/src/luna/tools/` has a **rich** code surface
(`filesystem.py`, `exec_command.py`). Port the *capability shape*; diverge where LD #9/#10 or the SOTA
say so.

- **Port (capability)**: `list_files`, `search_code` (regex), `find_relevant_files` (relevance ranking),
  `read_file` with **line-range + content_hash** (`filesystem.py:1020-1110`), the **resilient edit**
  (`edit_file` = stripped-line match + `difflib` best-match fallback + CRLF preservation,
  `filesystem.py:1299-1450`), **multi-hunk patch** (`patch_file:1453-1592`), **optimistic concurrency**
  via `expected_hash` on every write, **shell** with a deny-list + inspection-mode classification
  (`exec_command.py:49-106, 240-252`), and the **sensitive-path blocklist** (`~/.ssh`, keychains, etc.,
  `filesystem.py` PathAccess).
- **Diverge (mechanic)**: Python's primary edit story is `replace_in_file`/`edit_file`/`patch_file`.
  Our model is **Claude with interleaved tool-use**, so the primary edit surface is the **Claude-native
  `str_replace` shape** (`old_string`/`new_string`/`replace_all`, uniqueness-enforced) — Anthropic's own
  `text_editor` tool design — with Python's resilient/fuzzy matching as the *fallback*. We do **not**
  ship a unified-diff or AST edit as the primary surface (SOTA: little gain for a Claude agent, high
  per-language cost).
- **Diverge (減負, LD #9)**: Python's `make_directory`/`move_path`/`copy_path`/`delete_path` are **not**
  ported as tools — they go through `shell` (decided in the 減負 list).
- **Diverge (self-evolution)**: Python's self-layer is memory tools (`remember`/`revise`/`update_self`)
  + a disk-loaded **skill library** (`skill_tools.py`, SKILL.md files — loaded, not self-created) gated
  by `LUNA_SELF_EDIT_MEMORY` (default off). We go **further but safer**: Luna can *author + self-verify
  + persist* skills (Voyager/Hermes pattern), and *propose* edits to her own tools/prompts — but only
  behind a **human approval gate**, never autonomous self-source-rewrite.

## The hard part (recurring principles for this initiative)

1. **The sandbox is the load-bearing safety boundary.** Every file path (read, write, shell `cwd`) is
   canonicalized and asserted to live under `LUNA_WORKSPACE_ROOT`; symlink-escape and `..` traversal are
   rejected; a sensitive-path blocklist holds even on explicit override. Build this **once** (v0.15.0)
   and route every later tool through it. Get this wrong and a destructive tool is a foot-gun.
2. **str_replace reliability beats edit cleverness.** The single biggest reliability lever is
   **read-before-edit** (reject edits from stale memory; the dispatcher/session tracks which files were
   read) + **uniqueness-enforced `old_string`** + **concise, actionable errors** ("not unique, 3
   matches — add context"), with a fuzzy/whitespace-tolerant fallback that *reports when it fuzzed*.
3. **ACI discipline (SWE-agent):** windowed reads with line numbers, capped/shaped search output
   ("showing N of M"), **lint/typecheck-on-write returned in the tool result**, and informative
   feedback on every call — a constrained tool beats raw shell for LLM reliability.
4. **The verify loop is what fixes "weak targeting."** locate → plan → edit → **verify (`typecheck` /
   `run_tests` / `lint`)** → iterate. These verifiers are first-class tools; the L1 contract nudges
   "after a code edit, verify."
5. **Self-evolution has a hard firewall.** Luna may grow a skill library and *propose* self-edits, but
   she must **never** have write access to the code that *judges or sandboxes her* (tests, lint config,
   the deny-regex, the approval logic). The Darwin-Gödel-Machine lesson: an unsupervised self-rewriter
   *will* learn to fake its own test logs and strip its own guardrails. Human gate + evaluator firewall,
   always.

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.15.0](v0.15.0-workspace-sandbox-nav.md) | v0.15.0 | Workspace sandbox + read/navigation (windowed `read_file`, `list_files`, `grep`) — all read-only/safe | Medium | nothing | 📋 |
| [v0.15.1](v0.15.1-edit-tools.md) | v0.15.1 | Edit tools — `edit` (str_replace + fuzzy fallback), `multi_edit`, `write_file`; read-before-edit + lint-on-write | High | v0.15.0 | 📋 |
| [v0.15.2](v0.15.2-shell-verify.md) | v0.15.2 | `shell` (deny-regex + inspection mode) + the verify loop (`typecheck`/`run_tests`/`lint`) | High | v0.15.0 | 📋 |
| [v0.15.3](v0.15.3-repo-map-locator.md) | v0.15.3 | Targeting power-ups — Aider-style repo map (tree-sitter WASM) + hybrid symbol locator + `plan` tool | Medium | v0.15.0 | 📋 |
| [v0.15.4](v0.15.4-skills-self-edit.md) | v0.15.4 | Skill library (self-verified) + human-gated self-edit; **Initiative 8 close** | High | v0.15.1–3 | 📋 |

## Acceptance criteria (whole initiative)

- [ ] Luna can **navigate** a codebase she wasn't handed paths to: list/glob a tree, grep by regex,
      locate a symbol, read by line-range — all bounded to a configurable workspace.
- [ ] Luna can **edit** code reliably: str_replace edits with read-before-edit + uniqueness +
      fuzzy fallback, multi-edit atomicity, new-file creation — each returning a unified diff +
      content hash, each lint/typecheck-checked on write.
- [ ] Luna can **run** things: a sandboxed `shell` (deny-regex, timeout, output cap) + first-class
      `typecheck`/`run_tests`/`lint` so she closes the locate→edit→verify loop on her own.
- [ ] Every write/shell tool is **jailed** to `LUNA_WORKSPACE_ROOT`, sensitive-path-blocked, and
      `proactiveRisk: 'surface'` (must speak before mutating in a proactive turn).
- [ ] Luna can **grow safely**: author + self-verify + persist a reusable skill; propose a self-edit
      that lands only after a human one-click approval over the WS; she can never write to her own
      evaluator/sandbox/approval code.
- [ ] `tsc` clean across packages; `bun test` green; every risky version default-off behind a flag,
      E2E-verified in isolation, then flipped on.

## Open questions blocking start (settle at build time; new entries for REWRITE_CONTEXT)

1. **Workspace root + read scope.** `LUNA_WORKSPACE_ROOT` default = the launch cwd / repo root? Are
   **reads** jailed to the workspace too, or allowed broader (with the sensitive-path blocklist) while
   only **writes/shell** are jailed? (Python allows absolute reads outside the workspace; SOTA local
   agents jail everything. Recommend: writes/shell hard-jailed; reads jailed-by-default with an opt-in
   `LUNA_READ_OUTSIDE_WORKSPACE` for broader reads.)
2. **Shell approval model.** v1 = deny-regex + `proactiveRisk:'surface'` only, or also a **WS
   human-approval prompt** for non-allowlisted commands (interactive turns)? (Recommend: deny-regex +
   surface-gate for v0.15.2; add an optional approval prompt as a follow-up if it bites.)
3. **Self-edit ceiling.** Is **human-gated propose-diff** the permanent ceiling, or does Alan want a
   path to more autonomy later? (Research is unambiguous: human gate + evaluator firewall is the safe
   ceiling for a single-user companion. Recommend locking that as a decision.)
4. **Repo-map language coverage.** Which tree-sitter WASM grammars to bundle first (TS/JS/Python/JSON
   cover this repo + Python parity)? Cost: ~a few hundred KB of `.wasm` per grammar in `public/` or a
   server asset dir.
