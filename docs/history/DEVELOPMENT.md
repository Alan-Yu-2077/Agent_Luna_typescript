# Agent_Luna (TypeScript) — Development History

Last updated: 2026-06-16 (Asia/Shanghai) — v0.18.0 (web tools — **web_search**: Luna's "look it up" capability, a client-side live-web search on the existing dispatcher behind a `WebSearchProvider` abstraction (Tavily default, gateway-safe since yunwu strips Anthropic's native web_search), soft-fail + `[N]` citation summary, `proactiveRisk:'safe'`; ships with the **defection guard** — an L1 commitment/when-to-reach clause + an off-hot-path `web_search_intent_no_call` audit extending LD #14; default **OFF** behind `LUNA_WEB_SEARCH`; **Initiative 11 begins 1/3**, branch) · v0.17.3 (dream: today's day-diary is **rewritten on every dream** so a daytime dream captures the whole day instead of freezing it at the first dream — owner's "option 2"; past days stay write-once) · v0.17.2 (fix: a failed/empty turn — e.g. a 401 gateway outage — no longer persists an empty-assistant L2 row and rolls its dangling user message out of history, killing the "短暂失忆" pollution that survived restarts post-A3) · v0.17.1 (memory depth — **diary injection**: a standing day/week/month digest in the cached system block + diaries as recall candidates (the long-range narrative memory finally reaches the model; rag_refresh's diary embeddings now retrievable), Generative-Agents recency×importance×relevance recall ranking, monthly diaries; amends LD #12 diary-part; **Initiative 10 complete 2/2**, branch)

## Scope

Per-version log of what has actually shipped in the TypeScript rewrite. This is the **truth source**
for "what version are we on" — not the roadmap, not in-flight conversation.

Conventions match Python Luna:
- `Fact` = grounded in commit history, repository docs, or checked-in code in this TS repo.
- `Inference` = phase summary derived from those materials.
- `-dev` = current working-tree iteration not yet committed.

The Python original (`/Users/alanyu2077/Desktop/Agent_Luna`) stays the running production system
during the rewrite. Its version log is unrelated to this one — `v0.1` here is not `v0.1` there.

## Source material

- 2026-06-11 15-dimension ground-truth audit of Python Luna v0.47.9 (`/Users/alanyu2077/.claude/.../tasks/w7tdhaip0.output`)
- Design conversation 2026-06-11 (Bun / WS / SQLite / Zod / single-user / interleaved tool streaming)
- 减负 list (see [`../REWRITE_CONTEXT.md`](../REWRITE_CONTEXT.md))

## High-level stages (planned, subject to roadmap)

- `v0.1` — project skeleton: Bun + TS + Zod + bun:sqlite + WS server bootstrap. No agent logic yet.
- `v0.2` — tool spec: typed registry, `Result<T>`, streaming tool execution, 3 representative tools end-to-end (`time_now`, `read_file`, `remember`).
- `v0.3` — single-turn LLM round trip with Anthropic interleaved tool-use SSE wired through WS to a minimal client.
- `v0.4` — memory substrate on SQLite (L1 session state first).
- `v0.5+` — TBD; see roadmap.

## Version index

| Version | Date | Theme | Evidence |
|---|---|---|---|
| `v0.1.0` | 2026-06-11 | Bun skeleton + WS server | `7ebd73a` |
| `v0.2.0` | 2026-06-11 | Typed tool registry + `Result<T>` + 3 representative tools | `14753c4` |
| `v0.3.0` | 2026-06-11 | Anthropic interleaved tool-use end-to-end (StateGraph turn loop) | `8fbdce4` |
| `v0.3.5` | 2026-06-11 | Trace plumbing — first `bun:sqlite`, trace_id through the graph | `cbb468a` |
| `v0.3.6` | 2026-06-11 | Local `/_trace` viewer; `LUNA_TRACE` default on | `58a970a` |
| `v0.4.0` | 2026-06-12 | Memory substrate foundation — SQLite-backed sessions (L1) + L2 full-text timeline | `c2b322b` |
| `v0.4.1` | 2026-06-12 | L1 rolling window — recent-N verbatim + compress-once async fold | `e406b60` |
| `v0.4.2` | 2026-06-12 | L3 semantic store + prose core memory + remember/forget/update_self | `07cc0c1` |
| `v0.4.3` | 2026-06-12 | Hybrid recall — sqlite-vec embedding-first + CJK-bigram lexical | `25d2b08` |
| `v0.5.0` | 2026-06-12 | Dream engine — isolated 6-step consolidation; Initiative 2 complete | `a0df0b5` |
| `v0.5.1` | 2026-06-12 | Dev chat page `/_chat` — first usable conversation surface | `c4a9d84` |
| `v0.5.2` | 2026-06-12 | Gateway-safe tool schemas — `remember` flat input + `_noargs` unwrap | `a341162` |
| `v0.6.0` | 2026-06-13 | Persona foundation — mtime-cached loader, humanity splitters, wake scene | `25ed7cd` |
| `v0.6.1` | 2026-06-13 | `message` tool + humanity caps as Zod schema (LD #9, flag off) | `266ee1b` |
| `v0.6.2` | 2026-06-13 | Streaming message text (`input_json_delta` → `tool.progress`) + empty-reply guard | `dad7636` |
| `v0.7.0` | 2026-06-13 | Message-tool default flip after recorded A/B; Initiative 3 complete | `de41694` |
| `v0.8.0` | 2026-06-13 | Decision trace events + zero-LLM defection audit + replay tree | `76c8dfe` |
| `v0.8.1` | 2026-06-13 | L1 thinking contract — commitment-to-act + proportionality + no-leak | `1d0da3d` |
| `v0.8.2` | 2026-06-13 | Action-integrity guards — `is_final` promise + intent-without-act corrective retries | `ea246a4` |
| `v0.8.3` | 2026-06-13 | `recall` tool — agentic memory search (Open Q #9) + L1 trigger clause | `8376820` |
| `v0.9.0` | 2026-06-13 | Dictionary tuning + integrity defaults flipped on; Initiative 4 complete | `a50b6fc` |
| `v0.10.0` | 2026-06-13 | Proactive turn primitive — `runTurn` + proactive framing + silent allowed (manual) | `514d309` |
| `v0.10.1` | 2026-06-13 | Proactive safety gate — hard block→surface→execute + fail-closed + action budget | `ed51152` |
| `v0.10.2` | 2026-06-13 | Cadence governor + wake gate — prefilter + bounded "act now?" L2 judgment | `636caf3` |
| `v0.10.3` | 2026-06-13 | Proactive scheduler/heartbeat — idle loop goes autonomous (behind the kill switch) | `ed51967` |
| `v0.11.0` | 2026-06-13 | Self-continuation + dream auto-trigger + autonomy default-on; Initiative 5 complete | `45bb3cb` |
| `v0.12.0` | 2026-06-13 | Frontend consumption controller (`packages/web`); Initiative 6 begins | `680e58d` |
| `v0.12.1` | 2026-06-13 | Repo-wide audit (9 reviewers) + fixes — turn persistence resilience, dev tool_name | `7cbfdc1` |
| `v0.13.0` | 2026-06-14 | Cute UI shell — redesigned vtuber-overlay frontend (chat left / model right) | `f82f5ae` |
| `v0.13.1` | 2026-06-14 | Live2D foundation — yumi avatar (pixi-live2d + Cubism), first-cut FaceVM, draggable | `94ff57a` |
| `v0.13.2` | 2026-06-14 | High-fidelity FaceVM — 14 layered emotions + timelines + overlays + actions | `e367b50` |
| `v0.13.3` | 2026-06-14 | Voice + lip-sync — Web Audio AudioSink + RMS lip-sync + GPT-SoVITS proxy client | `78a3350` |
| `v0.13.4` | 2026-06-14 | Dream overlay + UX polish (thinking/mood/scroll/settings/a11y); **Initiative 6 complete** | `7465f5d` |
| `v0.13.5` | 2026-06-15 | One-command local launcher (`bun run dev`) + TTS proxy; Initiative 7 cancelled | `6e18d9a` |
| `v0.13.6` | 2026-06-15 | C-side fix pass (real-usage bugs) — Live2D override/gaze/zoom, L1 history, thinking-leak, TTS, dev IDE | `17ff3ff` `25e4e2b` |
| `v0.13.7` | 2026-06-15 | C-side fix pass 2 — gaze head+body via focusController + off-switch, workspace cell-collapse, dev-server idleTimeout, voice boot gate | `06fb132` `bedd1f5` `292ff5a` `c531ab4` `31a123a` `3fb1b4a` `610995e` |
| `v0.13.8` | 2026-06-15 | TTS lip-sync rebuilt from the Python `lip-sync.js` engine (4 mouth params + stochastic stepping) + serial speech queue (no overlap) | `5ae9d4b` |
| `v0.13.9` | 2026-06-15 | Lip-sync calmer defaults — slower target stepping (70→100ms) + gentler attack/release/shape smoothing; lowers the mouth change rate per feedback | `ae1dd03` |
| `v0.13.10` | 2026-06-15 | Two real bugs — persona embodiment now reflects the live Live2D + voice (was "no body/voice yet"); emotion head/body pose deforms via a pre-physics `flushPose` (was dead — those params are physics-input) | `9070861` `b61e42d` |
| `v0.13.11` | 2026-06-15 | Message clause cap 55→90 (the CJK-tuned 55 retry-stormed English replies) + validation retries kept backstage (no leaked raw-ZodError chips) | `60319f7` `2010e82` |
| `v0.13.12` | 2026-06-15 | English tuning — all three humanity caps relaxed (140/4/90 → 280/5/150) to cut the validation over-limit rate; web + dev-chat frontend fully translated to English | `working tree` |
| `v0.13.13` | 2026-06-15 | Switchable idle animations — the 5 awake idle profiles (default/cute-sway/peek/shy-drift/sweet-bounce) ported from Python `applyIdle` into FaceVm + a settings dropdown; idle yields the eyes to blink + the gaze to mouse-follow | `working tree` |
| `v0.15.0` | 2026-06-15 | Code-agent read/nav foundation (Initiative 8, 1/5) — workspace sandbox (blocklist-only, no root jail) + windowed `read_file` + `list_files` + `grep` (rg w/ JS fallback) | _dev branch_ |
| `v0.15.1` | 2026-06-15 | Code-agent edit tools (Initiative 8, 2/5) — `edit` / `multi_edit` / `write_file` (read-before-edit + uniqueness + fuzzy-report + CRLF + optimistic `expected_hash` + atomic multi) behind `LUNA_CODE_WRITE` (default on) + lint-on-write (`Bun.Transpiler`, `LUNA_LINT_ON_WRITE`) + firewall-refusal routed through the edit tool | _dev branch_ |
| `v0.15.2` | 2026-06-15 | Code-agent shell + verify loop (Initiative 8, 3/5) — sandboxed `shell` (deny-regex + interactive-block + process-tree kill + output cap, subsumes fs-mutation) plus `typecheck` / `run_tests` / `lint` verifiers, all behind `LUNA_SHELL` (default on) via a shared injectable spawner | _dev branch_ |
| `v0.15.3` | 2026-06-15 | Code-agent repo map + hybrid locator + plan (Initiative 8, 4/5) — Aider-style ranked, token-bounded, mtime-cached `repo_map` + hybrid `find_symbol` (ripgrep candidates → tree-sitter verify, comment/string false positives excluded, ripgrep-only fallback marked `verified:false`) behind `LUNA_REPO_MAP` (default on) + session-scoped `plan` todo spine (ships on always); `web-tree-sitter` + vendored TS/TSX/JS grammars; SQLite cache migration `0008` | _dev branch_ |
| `v0.15.4` | 2026-06-15 | Code-agent skill library + propose-only self-edit (Initiative 8, 5/5) — `save_skill` (verify-before-persist: refuses unless the suite is green — Voyager invariant) + `recall_skill` (lexical search) behind `LUNA_SKILLS`; `propose_self_edit` produces a unified diff for human review and **never writes**, with the evaluator firewall (`resolveInWorkspace` `'write'`, built in v0.15.0) hard-rejecting any edit to her own tests/sandbox/safetyGate/humanity/deny-regex/l1Contract **across all write tools** (the keystone test), behind `LUNA_SELF_EDIT`; skills table migration `0009`. Deviation: the `self_edit.proposed` wire event is deferred — the proposal is delivered via `tool.finished` (the diff) for the human to apply. **Initiative 8 complete (5/5).** | _dev branch_ |
| `v0.16.0` | 2026-06-15 | Security hardening + hygiene (Initiative 9, 1/4) — loopback bind `127.0.0.1` default (S1; closes S2/S3 net exposure) + `LUNA_BIND_HOST` opt-in, `/_workspace` reset/edit gated by `LUNA_DEV_TOOLS` (S2), `chat.send` capped at 8000 chars + WS `maxPayloadLength` (S5), `.github/workflows/ci.yml` (C1), README + orient-skill refresh (Doc1/2), WS reconnect buffer+backoff (C2), local-date quota clock (C3), aligned `fromBlob` (C4) | _branch_ |
| `v0.16.1` | 2026-06-15 | Recompute efficiency (Initiative 9, 2/4) — system block memoized per turn via a `memory/epoch` dirty flag bumped by `remember`/`update_self` (A1) + `renderL1Contract` cached; `traces` retention window (`pruneToRetention`, throttled off flush, A4); recall fetches only the recent 500 L2 rows (`listRecentL2`) + reuses a persisted `content_hash` column (migration `0010`, A2); recall embed budget off the first-token path behind `LUNA_RECALL_ASYNC` (P1) | _branch_ |
| `v0.16.2` | 2026-06-16 | Persistence + dead infra (Initiative 9, 3/4) — incremental `history_json`: `persistSession` writes only bookkeeping (constant `'[]'` blob), `loadSession` rebuilds the full timeline from the append-only L2 `raw_json` — the last O(N²) per-turn write gone (A3/P2); dead `vec0`/`vec_cache` write-path + orphaned virtual table removed, retrieval stays TS cosine (`sqlite-vec` dep kept inert for Initiative 10's potential KNN, D1); text-mode `reply.token` path marked legacy, removal deferred to post-Init-10 (D2) | _branch_ |
| `v0.16.3` | 2026-06-16 | Clean durable history (Initiative 9, 4/4) — `cleanHistory` strips prior-turn `thinking`/`redacted_thinking` from completed turns at persist time (the API drops them across turns anyway) + collapses old `tool_result` payloads to a marker in `buildActiveContext` (keeps recent + the `tool_use` records), behind `LUNA_CLEAN_HISTORY` (default on). A stored turn is clean conversation — the foundation for Initiative 10's ~100-turn window. **Initiative 9 complete (4/4).** | _branch_ |
| `v0.17.0` | 2026-06-16 | Memory depth — L1 window (Initiative 10, 1/2) — verbatim window re-unitized to **turns** (`LUNA_L1_RECENT_TURNS`, default ~100, range 40–150) replacing the 24-message cap; `planFold` counts turn-groups; the unbounded append-only `rolling_summary` replaced by a **structured, size-bounded digest** (4 buckets, hard char cap, bounded oscillating compression); **importance anchors** — a new `rate_salience` dream step rates turns 1–5 (LLM, migration `0011`), salient turns marked `[salient]` resist over-summarization; amends LD #12 window-part + marks v0.4.1 superseded | _branch_ |
| `v0.17.1` | 2026-06-16 | Memory depth — diary injection (Initiative 10, 2/2) — diaries reach the model at last: a bounded standing **day/week/month digest** in the cached system block (`renderDiaryDigest`, behind `LUNA_DIARY_INJECT`) + diaries as a third **recall candidate** source (`collectCandidates` += `'diary'`, so `rag_refresh`'s diary embeddings become retrievable — fixes the dead-work finding); recall ranking upgraded to the **Generative-Agents** `α·recency + β·importance + γ·relevance` (importance from the v0.17.0 salience score); **monthly diaries** generated by the dream cycle (idempotent). Amends LD #12 diary-part. **Initiative 10 complete (2/2).** | _branch_ |
| `v0.17.2` | 2026-06-16 | Fix — failed/empty turns no longer poison memory (C-side) — `runTurn`'s `finally` persists a turn only if it delivered a **real reply** (message-tool text in message mode, streamed text in text mode); a turn that threw before any token (a 401/network outage → `finishReason 'error'`) or ended double-silent leaves **no** empty-assistant L2 row and has its dangling user message rolled back to the pre-turn point (post-A3 those empty rows otherwise survive every reload → the "短暂失忆" symptom). Retargeted the Bug-A resilience test (`DROP TABLE sessions`, not `l2_turns`, so the upstream `retrieve()` still runs and the failure lands in `persistSession`). 560 tests green. | `working tree` |
| `v0.17.3` | 2026-06-16 | Dream — today's day-diary is **updateable** (owner's option 2) — `run_diaries` upserts the current **UTC day** on every cycle (`ON CONFLICT(kind,period_key) DO UPDATE`), regenerated from all of that day's L2; past days keep `INSERT OR IGNORE` (write-once). Fixes the mid-day-freeze: a self-/scheduler-triggered daytime dream no longer locks the day diary at noon and lose the afternoon. Day boundary stays UTC (08:00 Asia/Shanghai). 561 tests green. | `working tree` |
| `v0.18.0` | 2026-06-16 | Web tools — **web_search** (Initiative 11, 1/3) — client-side live-web search on the existing dispatcher behind a `WebSearchProvider` abstraction (`tools/web/`: `provider.ts` + `tavily.ts` + `web_search.ts`), Tavily default, gateway-safe (yunwu strips Anthropic's native web_search), soft-fail (every failure a recoverable `err`, nothing throws past the generator) + `[N] url` citation summary + a `正在查一下…` progress line; `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`. Ships with the **defection guard** extending LD #14 — an L1 commitment/when-to-reach clause (gated on the tool being mounted) + an off-hot-path `web_search_intent_no_call` decision-trace audit (thinking shows web-lookup intent but no `web_search` call fired). Default **OFF** behind `LUNA_WEB_SEARCH`; +18 tests, 577 green. | `working tree` |

## Code-agent capability (2026-06-15) — Initiative 8 begins (v0.15.0)

The first of five versions giving Luna a real code-agent surface. v0.15.0 ships the **safe,
read-only half** — a single workspace sandbox every file/shell tool will route through, plus the
navigation primitives she lacked (windowed reads, tree/glob listing, regex search). Developed on the
**dev branch** (isolated worktree); the stable instance is untouched.

**v0.15.0 — workspace sandbox + read/navigation** (dev branch)

Fact:
- New [`packages/server/src/tools/workspace.ts`](../../packages/server/src/tools/workspace.ts) (~230
  lines) — `resolveInWorkspace(path, access)` canonicalizes (realpath, including the nearest existing
  ancestor for not-yet-existing write targets) and rejects on a **sensitive-path blocklist**. Per the
  owner decision this is **NOT a root jail**: read/write/execute may touch any path EXCEPT the
  blocklist. Two tiers — SECRETS (`.env`/`.env.*`, `*.pem`, `*.key`, `id_rsa*`, `~/.ssh`, `~/.aws`,
  `~/.gnupg`, `~/.config/gcloud`, `~/Library/Keychains`, browser profiles, `~/.npmrc`/`~/.netrc`/
  `~/.docker/config.json`) rejected for every access; EVALUATOR FIREWALL (`*.test.ts`,
  `tsconfig*.json`, prettier/lint config, the shell deny source, `workspace.ts` itself, `humanity.ts`,
  `l1Contract.ts`, the safety gate) rejected for **write/execute only — read allowed** (DGM safeguard:
  Luna cannot write the code that judges/sandboxes her). Also `contentHash()` (sha256) for v0.15.1's
  optimistic concurrency.
- New [`packages/server/src/tools/fsScan.ts`](../../packages/server/src/tools/fsScan.ts) — ignore-aware
  walk (built-in set: `.git`/`node_modules`/`.venv`/`dist`/… + simple `.gitignore` segment lines) +
  binary-extension set, shared by `list_files`/`grep`. Symlinked dirs are not descended.
- Upgraded [`read_file.ts`](../../packages/server/src/tools/builtin/read_file.ts) — was whole-file/any-
  path/32KB. Now a 1-indexed line window (`offset`/`limit`, default 800, hard cap 2000), line-numbered
  content, returns `start_line`/`end_line`/`total_lines`/`truncated`/`content_hash`, routed through the
  sandbox (read). ENOENT stays recoverable; a secret path is a non-recoverable reject.
- New `list_files` ([`list_files.ts`](../../packages/server/src/tools/builtin/list_files.ts)) —
  `{ path?, recursive?, glob?, include_hidden?, max_entries? }` → ignore-aware entry list, `Bun.Glob`
  filter, truncation flag. New `grep` ([`grep.ts`](../../packages/server/src/tools/builtin/grep.ts)) —
  `{ query, path?, regex?, case_sensitive?, glob?, max_results? }` via a ripgrep subprocess
  (`rg --json`) with a **graceful JS-scanner fallback** (injectable runner) returning the identical
  shape; results capped + reported as `shown`/`total`/`truncated`. Both `proactiveRisk: 'safe'`,
  `concurrency: 'safe-parallel'`.
- Wired: `ToolName` enum gains `list_files`/`grep`
  ([`packages/protocol/src/tools.ts`](../../packages/protocol/src/tools.ts)); both mounted in
  `builtinRegistry` (read-only → on by default, no flag). L1 contract gains a locate-first clause;
  `EMBODIMENT_BLOCK` notes the browsable/searchable/readable workspace.
- Tests (4 files, 41 tests): `workspace.test.ts` (no-jail accept incl. `../`-escape, each secret tier,
  symlink-into-secret reject, evaluator-firewall read-ok/write-blocked), windowed `read_file.test.ts`,
  `list_files.test.ts` (glob/ignore/hidden/truncation), `grep.test.ts` (regex/literal/case/glob/cap +
  rg-absent fallback parity). tsc clean (protocol + server); the only suite failure is the pre-existing
  flaky `faceVm.test.ts` emotion-timeline test, unrelated to this change.

Inference:
- This is the foundation the riskier write/shell tools (v0.15.1/2) build on. By landing the *sandbox*
  and the *read-only* tools first, a bug here can only over-read (bounded by the blocklist), never
  destroy — the security-load-bearing piece is exhaustively unit-tested before anything mutates.
- Owner decision diverges from the plan's root-jail: the blocklist is now the **only** guardrail, which
  is why it is comprehensive and tested per-tier. The evaluator firewall is the concrete DGM safeguard —
  a future autonomous self-edit loop is explicitly a separate initiative needing container/VM isolation
  + an independent evaluator; none of that autonomy is built here.
- `read_file` already returns `content_hash`, so v0.15.1's `expected_hash` optimistic concurrency drops
  in, and `resolveInWorkspace(_, 'write'|'execute')` is ready for the write/shell tools.

**v0.15.1 — edit tools (str_replace-native + fuzzy fallback)** (dev branch)

The second of five. v0.15.0 gave Luna eyes; v0.15.1 gives her **hands that change code** — the
Claude-native edit surface plus a safe full-file write, gated behind `LUNA_CODE_WRITE` and routed
through the v0.15.0 sandbox. The two reliability levers SOTA edit agents converge on are both here:
**read-before-edit** (no edits from stale memory) and **lint-on-write** (a broken edit is caught at
edit time, not three turns later).

Fact:
- New [`packages/server/src/tools/builtin/edit.ts`](../../packages/server/src/tools/builtin/edit.ts) —
  `{ path, old_string, new_string, replace_all?, expected_hash? }`, the Anthropic `text_editor` /
  Claude Code `Edit` shape. Gates: **jailed** (`resolveInWorkspace(_, 'write')` → secrets + evaluator
  firewall), **read-before-edit** (rejects a path not `read_file`'d this session via the v0.15.0
  `readTracking` seam — recoverable + actionable), **uniqueness** (>1 match w/o `replace_all` →
  recoverable error w/ the count), **fuzzy fallback** (exact → stripped-line whitespace-tolerant; sets
  `fuzzed:true` so the model can verify — a silent wrong-fuzz is the dangerous case; CRLF preserved),
  **optimistic concurrency** (`expected_hash` mismatch → `stale_file`). Every result carries a unified
  diff + new `content_hash`.
- New [`multi_edit.ts`](../../packages/server/src/tools/builtin/multi_edit.ts) — `{ path, edits[],
  expected_hash? }`, **atomic** (Claude Code `MultiEdit` / Python `patch_file`): hunks apply in order to
  the in-memory text; the first failed hunk aborts with the failing index reported and **nothing
  written** (the half-edited-file guard). Same jail + read-before-edit + optimistic concurrency.
- New [`write_file.ts`](../../packages/server/src/tools/builtin/write_file.ts) — `{ path, content,
  create_dirs?, overwrite?, expected_hash? }`, full-file create/overwrite (Python `write_file` port).
  Description discourages it for existing files (prefer `edit`); **refuses to clobber** without
  `overwrite:true`; `create_dirs` defaults on; a successful write marks the path read so a follow-up
  `edit` is allowed.
- New [`editCore.ts`](../../packages/server/src/tools/editCore.ts) — the shared, LLM-free matcher
  (`findEditMatch` exact→stripped-line, the `_find_edit_match` port), CRLF helpers, index-splice
  `applyReplacement` (no `$`-reinterpretation), a Myers-LCS `unifiedDiff` (no new deps; truncated at 400
  lines), and a `closestMatchHint` for not-found misses.
- New [`lintOnWrite.ts`](../../packages/server/src/tools/lintOnWrite.ts) — after a successful edit/write
  to a `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` file, a **fast syntactic parse** (`Bun.Transpiler`, NOT
  full tsc — that is v0.15.2's `typecheck`) folds diagnostics into the tool result (SWE-agent ACI).
  v1 **surfaces, does not auto-revert** (reject-broken-edit is a v0.15.2 option). Behind
  `LUNA_LINT_ON_WRITE` (default on). Type errors are intentionally NOT caught (valid syntax).
- Wired: `ToolName` already carried `edit`/`multi_edit`/`write_file` (added as names in v0.15.0); they
  now have implementations. [`registry.ts`](../../packages/server/src/tools/registry.ts) gains
  `writeTools` + `codeWriteEnabled()` (`LUNA_CODE_WRITE !== '0'`, **default ON** per owner) +
  `withCodeWrite(base)`; [`main.ts`](../../packages/server/src/main.ts) composes the chosen registry
  through `withCodeWrite` once at boot (registry content = source of truth, no env read in the turn
  loop). L1 contract gains a read-before-edit / verify-after-edit clause; `EMBODIMENT_BLOCK` notes the
  editable workspace.
- Tests (5 files, 47 tests): `edit.test.ts` (exact/empty-delete; uniqueness + replace_all;
  read-before-edit rejection; fuzzy `fuzzed:true` + not-found hint; CRLF preserved; `stale_file`;
  lint-on-write diagnostics; firewall + secret jail), `multi_edit.test.ts` (ordered apply; later-hunk
  chaining; **failing-2nd-hunk leaves the file untouched + reports the index**; ambiguous-hunk abort;
  shared gates), `write_file.test.ts` (create + `create_dirs`; refuse-clobber; overwrite + `previous_hash`;
  stale-hash; marks-read; lint; firewall/secret jail), `lintOnWrite.test.ts` (lintable set; clean/broken
  TS; multi-error positions; JSX; non-lintable skip; type-error-not-caught; flag off), `registry.test.ts`
  (**`LUNA_CODE_WRITE=0` → write tools ABSENT** + a dispatched `edit` → `tool_not_found`; and the
  **firewall refusal routed END-TO-END through the edit tool via the dispatcher** — editing a `*.test.ts`
  and editing `workspace.ts` itself are both refused with the file untouched — closing safety check (b),
  which v0.15.0 could only prove by direct `resolveInWorkspace` calls). tsc clean (protocol + server);
  full suite 403 green (the lone intermittent failure remains the pre-existing flaky `faceVm.test.ts`
  emotion-timeline timing test — passes in isolation, unrelated to this change).

Inference:
- This is the first version that **writes the user's files**, hence the layered defenses: default-on but
  flag-killable, jailed via the v0.15.0 blocklist, read-before-edit + uniqueness + `expected_hash` make a
  wrong-target edit hard, atomic `multi_edit` prevents half-edited files, and a unified diff in every
  result keeps changes auditable. The dangerous failure mode for fuzzy matching is a *silent* wrong-fuzz,
  so the match path always reports `fuzzed:true` and the L1 contract tells her to verify.
- The DGM safeguard is now load-bearing and proven end-to-end: a write to the evaluator firewall (tests,
  configs, the sandbox itself, the humanity caps, the L1 contract, the safety gate) is refused not just
  in a unit call but when an `edit` is dispatched through the registry — Luna cannot write the code that
  judges/sandboxes/gates her, even with read-tracking satisfied.
- `lintOnWrite.ts` is the seam where v0.15.2 can add the **reject-broken-edit** hard guard (SWE-agent
  style) and the heavier `typecheck`/`run_tests` verify tools; the read-tracking + diff plumbing is what
  `shell`'s "edited then ran tests" loop will lean on. No `shell`, no full `tsc`/test verify, no repo map
  here (v0.15.2+).

**v0.15.2 — shell (sandboxed) + the verify loop** (dev branch)

The third of five. v0.15.1 gave Luna hands that change code; v0.15.2 lets her **run things** and
**verify her own work** — closing the locate → edit → verify → iterate loop. `shell` is the single
most dangerous surface in the rewrite, so it lands behind its own flag with a stacked defense, and it
subsumes directory create/move/copy/delete (LD #9 減負: no separate fs-mutation tools).

Fact:

- Added `shellDeny.ts` (~120 lines) — the deny-regex + interactive-command classifier, a port of
  Python `exec_command.py:49-106, 240-252`. `classifyShellCommand` hard-refuses `rm -rf`, `sudo`,
  `dd if=`, `mkfs`/disk-format, fork bombs, `shutdown`/`reboot`, `curl|wget … | sh`, writes into
  `~/.ssh`/dotfile-rc, keychain dumps, and detached-process (`nohup`/`disown`/`setsid`); blocks
  interactive first-tokens (`vim`/`less`/`ssh`/`top`/`tmux`/…). Lowercased match (case-insensitive),
  env-assignment-prefix-aware first-token. This file is itself an **evaluator-firewall** entry
  (already listed in `workspace.ts`) — Luna may read but never write the regex that gates her shell.
- Added `shellCore.ts` (~130 lines) — the **injectable** spawner shared by `shell` and the verify
  tools (so tests run no real destructive command, and v0.15.4's skill-runner can reuse it).
  `realSpawner` runs `/bin/zsh -lc <cmd>` via `Bun.spawn`, wires the abort signal, **kills the process
  TREE** on timeout/abort (negative-pid → process group, SIGTERM then SIGKILL escalation), and caps
  output to ~120 KB **middle-elided** (`capOutput`). `setSpawnerForTests`/`activeSpawner` is the
  injection seam; `clampTimeout` enforces default 120 s / hard max 1800 s.
- Added `builtin/shell.ts` (~170 lines) — `shell` tool: `session-serial`, `proactiveRisk:'surface'`,
  always-on deny-regex inside `execute`. Routes the cwd AND any absolute/`~`-path named in the command
  text through `resolveInWorkspace('execute')` (so `cat ~/.aws/credentials` is refused exactly like
  reading it), requires the cwd be a real directory, clamps the per-call `timeout_ms`, streams captured
  output as `tool.progress`, and returns `{stdout, stderr, exit_code, timed_out}`.
- Added the three verify tools (`builtin/typecheck.ts`, `run_tests.ts`, `lint.ts`, ~100 lines each) —
  thin wrappers over the project's own checkers through the shared spawner: `typecheck` runs
  `bun x tsc --noEmit [-p path]` → `{ok, diagnostics:{file,line,column,message}[]}`; `run_tests` runs
  `bun test [path]` → `{ok, pass, fail, failures[]}`; `lint` runs `bun x prettier --check` →
  `{ok, issues[]}`. Each parses its tool's text output into the structured shape (exported parsers:
  `parseTscOutput`, `parseBunTestOutput`, `parsePrettierOutput`). All `session-serial` +
  `proactiveRisk:'surface'`, cwd jailed.
- Modified `packages/protocol/src/tools.ts` — added `'shell'`, `'typecheck'`, `'run_tests'`, `'lint'`
  to the `ToolName` enum (wire contract).
- Modified `registry.ts` — `shellTools` group (shell + the three verifiers) behind `shellEnabled()` /
  `withShell()`, gated by **`LUNA_SHELL`** (OWNER DECISION: default ON; `=0` is the off switch). Wired
  into `main.ts` boot as `withShell(withCodeWrite(...))` with a `[shell]` boot-log marker.
- Modified `l1Contract.ts` — added the run-and-verify clause: "after you change code, actually run the
  check (typecheck/run_tests) before you say it works; do not claim a change compiles or passes
  untested."
- Tests added (~per the plan): `shellDeny.test.ts` (every dangerous pattern named + refused,
  case-insensitive, interactive block, env-prefix, ordinary commands allowed), `shellCore.test.ts`
  (middle-elide cap, timeout clamp), `shell.test.ts` (safe command → stdout/exit 0 via injected
  spawner; deny-regex/interactive refused with the spawner never invoked; sensitive cwd + sensitive
  path-in-command rejected; schema bounds; surface-risk via the real `safetyGate`), and
  `typecheck`/`run_tests`/`lint` `.test.ts` (parse a known-good and known-bad run into the structured
  shape; sensitive cwd rejected). Extended `registry.test.ts` with the `LUNA_SHELL` flag gate
  (default-on mounts, `=0` absent, dispatched `shell` → `tool_not_found`). 491 tests green; tsc clean
  across protocol + server + web.

Inference:

- The verify loop is the difference between an edit agent and a code agent. With `typecheck`/`run_tests`
  first-class, Luna can do locate → edit → verify → iterate without the user driving every step, and the
  L1 contract now pushes her to actually run the check rather than asserting an untested change works —
  the same capability-honesty pillar, applied to code.
- `shell` is the highest-risk surface in the rewrite, so the mitigations stack rather than relying on
  any one: default-flag (`LUNA_SHELL`, flip-after-E2E), per-pattern-tested deny-regex, the
  blocklist applied to the cwd AND the command text, interactive-block, timeout + process-tree kill +
  output cap, `session-serial` (no racing shells), and `proactiveRisk:'surface'` (no silent shell in a
  proactive turn — the gate + `LUNA_PROACTIVE_MAX_ACTIONS` budget). Residual: the deny-regex is a
  blocklist, not a jail — a creative destructive command could slip; the surface-gate + budget + a
  future optional WS approval prompt (OWNER DECISION #2 / plan Open Q #2, deferred) are the
  defense-in-depth, and the safe choice (container/VM isolation) is reserved for the autonomous loop,
  which is a separate initiative entirely.
- The spawner is injectable specifically so v0.15.4's self-verified skill-runner can reuse it — the
  verify tools are exactly what a skill runs before it is allowed to save. Plan note "don't foreclose"
  honored.

**v0.15.3 — repo map + hybrid symbol locator + plan** (dev branch)

The fourth of five. v0.15.0 gave Luna eyes (read/grep/list); v0.15.3 gives her a **map** and a
**structural locate** so she answers "where is `X` defined / who calls it" with a verified answer, not
a guessed path — fixing the targeting half of 寻址能力差/目标定位弱. Plus a lightweight `plan` tool so
multi-step code work has a visible, revisable todo spine.

Fact:

- Added `web-tree-sitter@0.26.9` as a server dependency and vendored three prebuilt grammars under
  `packages/server/vendor/tree-sitter/` (`tree-sitter-typescript.wasm`, `-tsx.wasm`, `-javascript.wasm`
  — TS-first per Open Q #4). The runtime auto-locates its own `.wasm` via `Parser.init()`; verified it
  loads + parses under Bun.
- Added `code/treeSitter.ts` (~120 lines) — lazy, process-once runtime init + per-grammar `Language`
  cache, `grammarForPath` ext→grammar map, `loadParserFor(path)`. Every failure path returns **null**
  (no grammar / runtime fails / `.wasm` missing) so callers fall back, never throw — the plan's
  never-hard-fail contract. `resetTreeSitterForTests` seam.
- Added `code/symbols.ts` (~210 lines) — `extractSymbols(path, source)` with two backends behind one
  shape: tree-sitter (`verified:true`; defs from declaration nodes + arrow/function-expr declarators,
  refs from `identifier`/`type_identifier` nodes — a name inside a comment/string is **not** an
  identifier node, so it is structurally excluded) and a comment-stripping regex fallback
  (`verified:false`). `forceRegexFallbackForTests` seam.
- Added `code/repoMap.ts` (~230 lines) — `buildRepoMap` walks the source tree (reusing `fsScan`),
  parses each file cache-aware, builds a def→referencing-file graph, **PageRank**s it (12 iterations,
  damping 0.85), attributes file rank to defs (×1.5 for exported, ×4 for a `focus` match), sorts, and
  emits a **token-bounded** outline (`renderRepoMap`, ~1500-token default, truncation marker). Injected
  `statFn`/`nowMs` for deterministic cache tests.
- Added `code/repoMapCache.ts` (~70 lines) — mtime+size-keyed `repo_map` table wrapper over the shared
  memory DB (no-ops when the DB is unset, exactly like `l3Store`). `getCached` returns null on a
  staleness hit so a touched file always re-parses; `putCached` upserts; `clearRepoMapCache` for tests.
- Added `code/symbolLocator.ts` (~150 lines) — `locateSymbol`: SICA hybrid. ripgrep (reusing v0.15.0's
  injectable `runGrep`) produces cheap `\bname\b` candidate lines; each candidate file is re-parsed with
  tree-sitter to confirm real defs/refs and attach signatures. A file with no grammar / unreadable /
  runtime-failed degrades to its raw candidate lines marked `verified:false`. Output is structured
  (file+line+signature), never prose — the locate primitive v0.15.4's self-edit will point with.
- Added migration `0008_repo_map.sql` — the `repo_map(path, mtime_ms, size, symbols_json, parsed_ms)`
  cache table (versioned, never an in-place schema edit — the Python drift bug we avoid).
- Added the three tools: `builtin/repo_map.ts` (`{focus?, path?, max_tokens?}` → ranked outline +
  entries; `safe-parallel`, `proactiveRisk:'safe'`, jailed), `builtin/find_symbol.ts`
  (`{name, kind?, path?}` → `{definitions[], references[], verified, truncated}`; same risk tier), and
  `builtin/plan.ts` (`{action:set|update|get, items?}`; `session-serial`, `safe`; state on the
  `Session` object, emits a `tool.progress` plan snapshot for the web UI).
- Modified `packages/protocol/src/tools.ts` — added `'repo_map'`, `'find_symbol'`, `'plan'` to the
  `ToolName` enum (wire contract).
- Modified `registry.ts` — `repoMapTools` group (`repo_map`+`find_symbol`) behind `repoMapEnabled()` /
  `withRepoMap()`, gated by **`LUNA_REPO_MAP`** (OWNER DECISION #4: default ON, the plan's "0 until
  verified" superseded; `=0` is the off switch). `plan` added to `builtinRegistry` (ships on always).
  Wired into `main.ts` as `withRepoMap(withShell(withCodeWrite(...)))` with a `[repo-map]` boot marker.
- Modified `turn/session.ts` — added the `plan: PlanItem[]` field (session-scoped, NOT persisted) +
  `PlanItem` type. Modified `l1Contract.ts` — the map/locate/plan clause ("prefer find_symbol/repo_map
  over reading whole files to hunt a name; set a plan first for multi-step work"). Modified
  `packages/web/src/ui/toolLabels.ts` — friendly chips for the three new tools.
- Tests added: `code/repoMap.test.ts` (fixture → expected symbol set + verified; most-referenced
  symbol ranks first; injected-mtime cache returns cached on unchanged + re-parses on touch + clear;
  tiny token budget truncates with the marker), `code/symbolLocator.test.ts` (def + its refs found;
  a same-name token in a line/block comment **excluded** by the tree-sitter pass; `kind:'def'` returns
  defs only; tree-sitter-forced-off and no-grammar `.py` both degrade to `verified:false` candidates),
  `builtin/plan.test.ts` (set→get round-trip, update flips a status, unknown-id appends, progress event
  precedes ok + carries the snapshot, lives on the session, summarize, empty-set clears). Extended
  `registry.test.ts` (`LUNA_REPO_MAP` gate: default mounts, `=0` absent, `plan` present regardless) and
  `l1Contract.test.ts` (the new clause). 513 tests green; tsc clean across protocol + server + web.

Inference:

- This is the structural answer to the targeting weakness: a guessed path is how an edit lands in the
  wrong file. `find_symbol`'s tree-sitter verify is the load-bearing part — ripgrep alone counts a name
  in a comment or string as a hit, which is exactly the false positive that sends an agent editing the
  wrong line. By confirming each candidate is a real `identifier` node, the locator returns a *verified*
  def+refs set, and degrades (marked) rather than fails when a grammar is absent.
- The repo map is advisory by design — every entry is verifiable with `read_file`, so a heuristic
  mis-rank is a quality issue, not a safety one. The mtime cache makes the map cheap enough to call
  often (orient-before-read), and the token budget keeps a large tree from blowing context.
- The vendored-WASM dependency is the only real risk this version adds; it is fully fallback-guarded
  (missing/broken grammar → ripgrep-only / regex extraction, marked unverified), so a grammar problem
  degrades capability instead of breaking the tool.
- The `plan` spine and the structured `find_symbol` output both feed v0.15.4: the repo map is what makes
  a saved skill addressable ("the skill that touches `runTurn`"), and `find_symbol`'s file+line+signature
  is the pointer a self-edit proposal uses. Kept structured per the plan's "don't foreclose" note.

## C-side fix pass (2026-06-15) — v0.13.5 / v0.13.6

After Initiative 6 assembled the body, real-usage feedback surfaced a batch of client-side bugs.
Two fix rounds, all verified (tsc + `bun test` 296 green + browser smoke via the preview).

**v0.13.5 — local launcher + Initiative 7 cancel** (`6e18d9a`)
- `bun run dev` ([`scripts/dev-all.ts`](../../scripts/dev-all.ts)) spawns server (8787) + web (5173) +
  the local GPT-SoVITS TTS proxy (8788). The proxy ([`scripts/tts-proxy.cjs`](../../scripts/tts-proxy.cjs))
  is a thin standalone HTTP wrapper over the Python project's `GptSovitsService` (which had no
  standalone launcher — it was mounted in the old Python ws-server). Prefixed logs, Ctrl-C cascade,
  a startup banner with the entry URL, **proactive OFF by default in dev**.
- Initiative 7 (open-source packaging) **cancelled**: TTS stays original GPT-SoVITS, local-only.

**v0.13.6 — C-side fix pass** (server `17ff3ff`, web `25e4e2b`)

Bugs found in real use and their root causes / fixes:
- **Expressions/mouth "完全没触发"** — FaceVm ran on `app.ticker` (render-LOW priority, i.e. BEFORE
  the model's `internalModel.update`), so the auto idle-motion + blink overwrote every param each
  frame. Fix: drive FaceVm from the model's own `'beforeModelUpdate'` event (after the built-in
  controllers, before deform). Emotions + lip-sync now win; gaze + physics still drive the rest.
- **Refresh lost the chat log** — `handleOpen` sent nothing. Fix: new `history` ServerEvent replays
  the L2 timeline on connect (real timestamps + divider; idempotent across reconnects).
- **Gaze toggle didn't disable + tracked from the body center** — `model.autoFocus` is a no-op
  (autoFocus lives on `model.automator`); pixi's `focus()` references the body center + sways the
  body. Fix: kill the built-in autoFocus, drive a head-centric eyes+head gaze in FaceVm; the toggle
  truly gates it.
- **Model couldn't be zoomed** — added wheel zoom (persisted, clamped) + double-click reset.
- **Thinking leaked into chat bubbles** — in message-tool mode the model's free text blocks were
  streamed as `reply.token`. Fix: only stream `reply.token` in text mode; message mode speaks solely
  via the message tool.
- **TTS "没挂上"** — `WebAudioSink` latched off permanently on the first failure, so GPT-SoVITS's 503
  while loading its ~5 GB model killed voice for the session. Fix: don't latch on 503 (retryable);
  give up only after several consecutive hard failures. Mouth-drive path verified post-`beforeModelUpdate`.
- **Confusing autonomous replies + "test-message" DB** — the data was real history + proactive
  auto-fires (not test data); proactive is now OFF in dev, the DB path is pinned to the repo root,
  and the stray empty `packages/server/luna.sqlite` was removed.
- **Dev tooling**: a `?dev` performance panel (trigger all 14 emotions + states) and a VSCode-style
  `/_workspace` data IDE (sidebar table tree + editable grid + one-click reset + row delete/cell edit).

## C-side fix pass 2 + voice rebuild (2026-06-15) — v0.13.7 / v0.13.8

**v0.13.7 — gaze deep-fix + dev-tooling polish** (already shipped, backfilled here)

Fact:
- **Gaze head+body now actually move.** Earlier "head/body gaze" wrote `ParamAngleX/BodyAngleX`
  from FaceVm at `'beforeModelUpdate'` — but those are physics-driven and consumed *before* that
  hook, so they never deformed (force-pinning them produced zero head turn). Rewired gaze to drive
  the model's own `focusController` (runs before physics), with a proportional, head-centric offset
  so pointing at her neck reads level not "up". The off-switch eases the focus back to `(0,0)`
  (`model.focus()` is direction-only and degenerates to full-right at centre, which had frozen it).
  (`06fb132`, `bedd1f5`, `292ff5a`)
- **`/_workspace` collapses oversized cells** — long values (raw_json / payloads / full logs) clamp
  to ~3 lines with a ⤢ expand toggle; editable cells auto-expand on focus. (`c531ab4`)
- **dev-server `idleTimeout` → 255s** so a cold GPT-SoVITS first-load isn't killed at Bun's default
  10s ("request timed out after 10 seconds"). (`31a123a`)
- **Voice boot gate** — a full-screen splash blocks the UI while GPT-SoVITS warms its ~5GB model;
  skippable, degrades fast when no sidecar. Closes on `/health`-ready (not the warmup synth, which
  could hang after the model was already loaded). (`3fb1b4a`, `610995e`)

Inference:
- The gaze saga's real lesson: in Cubism, head/body angle is physics-output, so only the
  focusController (pre-physics) can move it — FaceVm (post-physics) can only drive direct deformers
  (brows/eyes/mouth). This same boundary shapes v0.13.8's mouth design.

**v0.13.8 — TTS lip-sync rebuilt from the Python engine + serial speech queue** (working tree)

Fact:
- **`lipSync.ts` rewritten as a faithful port of Python `Live2D_Work/js/runtime/lip-sync.js`** (~190
  lines): the prior TS version implemented only stage 1 (energy ingest) and emitted a single
  mouth-open scalar. Now all four stages — energy → stochastic open-target stepping on a jittered
  ~70ms clock (rest/medium/wide weighted by energy) → asymmetric attack(0.74)/release(0.58) +
  hard-close → form/pucker/shrug articulation (open-bucket lookup + sine micro-motions). Outputs a
  `LipSyncFrame {open, form, shrug, pucker}`; RNG is injectable for deterministic tests.
- **Four mouth params now driven** (`ParamMouthOpenY` + `ParamMouthForm` + `ParamMouthShrug` +
  `ParamMouthpucker`), not one — the single-param amplitude follower was the "ugly/jerky" mouth.
- **Mouth threaded as a frame**: `Live2DSink.setMouthOpen(number)` → `setMouth(LipSyncFrame | null)`
  (`sinks.ts`, `pixiLive2DSink.ts`, `app.ts`); `webAudioSink` rAF loop computes `lip.ingest(rms)` +
  `lip.tick(dt)` → `onMouth(frame)`. `faceVm.setMouth` overrides the 4 mouth params raw (post-emotion,
  no double-smoothing) while speaking, and writes the emotion/idle mouth unconditionally when
  released so a finished utterance can't freeze the mouth open.
- **Serial speech queue** (`serialQueue.ts`, new): `webAudioSink.speak()` prefetches the audio
  concurrently but plays strictly serially (next utterance starts only after the previous one's
  `onended`), fixing "上一条没说完就急着说下一条". `stop()` clears the queue + halts current (barge-in).
  The no-permanent-disable / 503-retry logic is preserved.
- **Tests**: `lipSync.test.ts` rewritten (5 tests: open/close, sub-floor silence, 4-param shaping,
  stochastic variation, reset); `serialQueue.test.ts` new (3 tests: serial order, throw-resilience,
  clear-cancel); `faceVm.test.ts` mouth tests updated (lip override + release). `bun test` 302 green.

Inference:
- Mouth params are direct deformers (unlike head/body — see v0.13.7), so FaceVm *can* own them at
  `'beforeModelUpdate'`; the lip-sync engine therefore lives in the audio layer and hands FaceVm a
  per-frame mouth pose, keeping a single param writer. The stochastic stepping is what reads as
  speech — a pure RMS follower is the thing that looked "ugly". Synthesis stays concurrent so the
  serial queue adds no latency beyond the unavoidable one-voice-at-a-time gate.

## English tuning (2026-06-15) — v0.13.12

Real-usage feedback: the validation over-limit rate ("超限率") was still too high, and Luna's persona is
English-led while the UI chrome was Chinese.

**v0.13.12 — English-tuned humanity caps + English frontend** (working tree)

Fact:
- **All three humanity caps relaxed for English** (`packages/server/src/persona/humanity.ts`):
  `MAX_CHARS` 140→**280**, `MAX_SENTENCES` 4→**5**, `MAX_CLAUSE_CHARS` 90→**150**. The Python originals
  were CJK-tuned (1 char ≈ 1 morpheme); English packs ~4–5 chars/word, so the old numbers rejected most
  natural English replies. The system-prompt `HARD LIMITS` block (`renderHumanityBlock`), the `message`
  tool's `.max()`/`.describe()`, and the Zod error messages all read these constants, so they updated in
  lockstep — verified (adversarial sweep) that **no** other length enforcement exists in
  `packages/server` (protocol `MessageDelivery.text` has no parallel `.max()`; A/B scripts derive from
  the constants).
- **Web frontend translated Chinese → English** (`packages/web`): boot gate (`bootGate.ts` splash +
  `TTS_STATE_LABEL`), layout chrome (`layout.ts` — settings toggles, send/dream/wake buttons, status
  badge, placeholders, aria-labels, `🌙 Dream`/`☀️ Wake`), `app.ts` (status text, boot-result messages,
  dream placeholder, the `?dev` performance panel), tool-card labels (`toolLabels.ts`), the 15 mood-pip
  labels (`mood.ts`), relative timestamps (`time.ts`), the error chip (`controller.ts`), the history
  divider (`cuteBubbleView.ts`), and `index.html` `lang="zh-CN"`→`"en"`.
- **Server dev-chat console translated** (`packages/server/src/devchat/devchat.html`): buttons, status
  line, retry/error chips, dream/proactive notices, `lang` attribute — so the dev surface matches the
  now-English web app.
- **Left untranslated on purpose** (verified non-UI): the Live2D overlay keys `脸红/俯身/黑脸/泪汪汪`
  (`faceData.ts`, referenced by `overlayRefs` — renaming would break the expression→param lookup), the
  CJK recall stopword list (`memory/recall/lexical.ts`), and CJK test fixtures (controller/ttsClient
  tests + the `message`/`messageMode` cap-violation fixtures, which exercise the CJK `。` splitter).
- **Tests**: `time.test.ts` + `toolLabels.test.ts` updated to assert the English strings;
  `message.test.ts` cap tests rewritten to be constant-relative (`MAX_SENTENCES+1`, `MAX_CLAUSE_CHARS+1`)
  plus a new English-boundary case; `messageMode.test.ts` violation fixtures bumped 5→6 sentences for the
  new `MAX_SENTENCES`. `bun test` **306 green**, `tsc` clean (server + web).

Inference:
- The caps are a single source of truth, so "tune for English" is a three-line change that ripples
  correctly to the prompt, the schema, the error text, and the measurement scripts — the typed-contract
  payoff. `280/5/150` keeps Luna "a spoken presence, not an essay" (~50 words / one SMS) while ending the
  retry-storm; revisit only if telemetry shows replies clustering at the ceiling (cap-as-target).
- The translation was scoped by *what renders*, not *what contains CJK*: an adversarial 3-critic sweep
  confirmed every logic-bearing CJK string (object keys, localStorage keys, `/health` state keys, recall
  stopwords, test fixtures) was left intact — the danger in a bulk translation is renaming a key, not a
  label.

## Idle animations (2026-06-15) — v0.13.13

The v0.13.1 FaceVM port deferred the procedural idle layer — "idle" was just the model's built-in
blink/breath while neutral. Python actually shipped several idle profiles, and Alan wanted them back +
switchable.

**v0.13.13 — switchable idle profiles** (working tree)

Fact:
- **5 awake idle profiles ported** from Python `js/runtime/face-vm.js` `applyIdle` into `FaceVm`
  (`packages/web/src/live2d/faceVm.ts`): `defaultIdleV1` (vtuber sway), `cuteSwayV1` (soft sway + bow +
  cat-mouth), `peekyIdleV1` (head-tilt peek), `shyDriftV1` (head-down slow sway), `sweetBounceV1` (lively
  up-down bounce). Each is procedural sine math (the per-profile `switch` + the shared look-wander/jitter
  terms), faithful to Python including the `0.18`/`0.24`/`0.34` neutral/thinking/sleeping smoothing — so
  the look (incl. the strong default head-roll that pegs `ParamAngleZ`) matches the original. The Python
  `sleep` profile is not duplicated — the `sleeping` Live2DState covers it.
- **Registry** in `faceData.ts` (`IDLE_PROFILES` ordered list + labels, `IdleProfileId`,
  `DEFAULT_IDLE_PROFILE`); the look-wander uses an **injectable rng** (default `Math.random`) so the rest
  of FaceVm stays deterministic for tests.
- **Two deliberate divergences for clean integration** with the tuned gaze/blink systems: the idle does
  **not** drive the eyes (`eyeOpen*`/`eyeSquint*`) so the model's built-in eyeBlink keeps blinking, and it
  drives the **gaze (`ParamEyeBall*`) only when mouse gaze-follow is off** — when it's on, the
  focusController owns the eyes. Head/body pose is still flushed pre-physics, so it *adds* with the
  focusController (idle sway + mouse look-at coexist). The awake idle is gated off while `sleeping`.
- **Settings switcher**: an "Idle animation" dropdown in the settings panel (`layout.ts` `selectRow` +
  `idleSelect` ref); `app.ts` persists to `localStorage 'luna:idle-profile'` and calls
  `live2d.setIdleProfile(id)` live (no refresh). `pixiLive2DSink` constructs FaceVm from the persisted
  profile + initial gaze state and forwards `setGazeActive` on the gaze toggle. `Live2DSink` grew
  `setIdleProfile?`/`listIdleProfiles?` (`sinks.ts`).
- **Tests** (`faceVm.test.ts`, +5): idle drives body sway in neutral (via `flushPose`); two profiles
  differ at the same clock; `setIdleProfile` switches + guards an unknown id; the idle wanders the gaze
  only when follow is off; the `sleeping` state suppresses the awake idle. `bun test` 311 green; the 8
  pre-existing FaceVm tests still pass (emotions own their channels, so the idle layer underneath them
  doesn't perturb their assertions). Live preview verified: dropdown renders 5 options, the model
  animates (pose params sweep, AngleZ pegging the model limit as in Python), and switching profiles takes
  effect + persists live.

Inference:
- The idle is the lowest layer (idle → state bias → emotion → actions), so it fills the "resting" gap
  without touching any of the expression/lip-sync/gaze work above it — emotions and the lip frame still
  win by ownership, the mouse still owns the eyes. Restoring the profiles makes neutral feel alive again
  and gives Alan the variety he remembered, now as a first-class setting rather than a buried constant.

## Detailed records

### `v0.18.0` — 2026-06-16 — Web tools: web_search (Initiative 11, 1/3)

Status:

- working tree (branch `feat/initiative-11-web-search`)

Fact:

- New module `packages/server/src/tools/web/` (3 files): `provider.ts` (~55 lines) — the
  `WebSearchProvider` interface (`search(query, opts, signal) → Promise<SearchResult[]>`) +
  `SearchResult`/`SearchOptions` types + `getProvider(name)` dispatch (`'tavily'` default, throws on
  unknown) + a `setWebSearchProvider`/`resolveProvider` test seam (mirrors `setMemoryDb`);
  `tavily.ts` (~60 lines) — the default provider, a minimal `fetch` client mirroring `embed.ts` (env
  base/key, `signal` threaded, error bodies sliced to ~200 chars), per-result snippet clipped to
  `LUNA_WEB_SEARCH_RESULT_CHARS`; `web_search.ts` (~140 lines) — the `defineTool`.
- `web_search` tool: `input {query, max_results(default 5), time_range?, include_domains?,
  exclude_domains?}`, `output {query, results[{title,url,snippet,score?,age_hint?}], provider, ts}`,
  `concurrency:'safe-parallel'`, `proactiveRisk:'safe'`, `timeoutMs` from `LUNA_WEB_SEARCH_TIMEOUT_MS`
  (15000). `summarize` → the `N results for "q": [1] url; [2] url` citation line. `execute` yields a
  `正在查一下…` progress event first, then **soft-fails every error path** (no key, unknown provider,
  provider throw, pre-aborted signal) as a recoverable `err` — nothing throws past the generator.
- New `'web_search'` member on `ToolName` (`packages/protocol/src/tools.ts`) — the one wire-contract
  change; `Partial<Record>` registries + `toolLabels`' `Partial<Record>` + `ToolName.options` loop
  absorb it without churn.
- Registry + boot: `registry.ts` gains `webSearchEnabled()` (`LUNA_WEB_SEARCH==='1'`, default **OFF** —
  opposite polarity to the code tools), `withWebSearch()` composer, and `isWebSearchMode()`; `main.ts`
  wraps the registry (`withWebSearch(withSelfEdit(…))`) and adds a `[web-search]` boot-log marker.
- Defection guard (extends LD #14, not a new harness): `l1Contract.ts` — `renderL1Contract` now takes
  a `webSearchMounted` flag (cached per-variant, still byte-stable) and appends a combined
  when-to-reach + commitment-to-act web clause when web_search is mounted; `runTurn.ts`'s
  `buildSystemPrompt` threads the flag from the registry. `defectionAudit.ts` — `WEB_INTENT_PATTERNS`
  + `detectWebSearchIntentNoCall` (CN+EN lookup keywords) + `AuditState.webSearchMounted`; when
  web_search is mounted, no `web_search` call fired, and thinking shows lookup intent, it writes a
  `surface:'web_search_intent_no_call'` decision trace (audit-only, **no** forced retry — per Python's
  v0.58.0.1 lesson).
- Frontend: `packages/web/src/ui/toolLabels.ts` gains a `web_search: 'searched the web 🔍'` chip label.
- Env (`.env.example`): `LUNA_WEB_SEARCH` (off), `LUNA_WEB_SEARCH_API_KEY`, `LUNA_WEB_SEARCH_PROVIDER`
  (tavily), `LUNA_WEB_SEARCH_TIMEOUT_MS` (15000), `LUNA_WEB_SEARCH_RESULT_CHARS` (800).
- Tests: new `web_search.test.ts` (shape + summarize citations, the four soft-fail paths, pre-aborted
  signal, `proactiveRisk:'safe'`, registry gating); `l1Contract.test.ts` +1 (web clause gated +
  per-variant byte-stable); `defectionAudit.test.ts` +7 (`detectWebSearchIntentNoCall` pure cases +
  the mounted/called/unmounted/no-intent audit matrix). +18 tests; **577 pass / 0 fail**; `tsc` clean
  on protocol + server + web.

Inference:

- Closes the one capability gap a 2026 companion still had after brain/memory/dream/proactive/body/
  code-agent: **the open web**. v0.18.0 ships the find half (`web_search`); v0.18.1 adds the read half
  (`web_fetch` + SSRF/extraction safety) and v0.18.2 flips both on after cost is measured.
- Ports Python v0.58's `web_search` onto the TS dispatcher — an ordinary `defineTool` (LD #9), so it
  inherits timeout/abort/tracing/concurrency for free — and carries forward Python's hard-won
  defection lesson (a directive alone is insufficient): the commitment clause **and** the intent-no-
  call audit ship together, the audit producing the data to decide if a forced retry is ever needed.
- `proactiveRisk:'safe'` keeps the search→fetch→reason loop working in silent proactive turns (LD #15
  lists searches as silent-OK); default-off + the conservative L1 clause bound the cost/abuse surface
  until v0.18.2.

### `v0.17.3` — 2026-06-16 — Dream: today's day-diary is updateable (owner's option 2)

Status:

- working tree

Fact:

- `packages/server/src/dream/cycle.ts` `run_diaries` — the day-diary loop now **upserts the current
  UTC day on every cycle** (`INSERT … ON CONFLICT(kind, period_key) DO UPDATE SET text, generated_ms`),
  regenerated from all of that day's L2 pieces; past days keep the `INSERT OR IGNORE` write-once path.
  `todayKey = new Date(Date.now()).toISOString().slice(0,10)` — the same UTC calendar key the rows are
  grouped under.
- `packages/server/src/dream/dream.test.ts` — added test 4c: after a first dream writes yesterday +
  today, a second same-day dream (post-`wake`) rewrites today's diary (text changes) while yesterday's
  stays byte-identical, and today still has exactly one row. 560 → 561 tests; `tsc` clean.

Inference:

- Closes the mid-day-freeze the owner flagged. Dreams can be self-triggered (`enter_dream`) or
  scheduler-triggered at any hour — not only at end of day — so the old `INSERT OR IGNORE` froze the
  day diary at the first dream and dropped every later exchange that day. The day diary is now a live,
  whole-day summary that the standing digest (`renderDiaryDigest`, injected via `LUNA_DIARY_INJECT`) and
  `'diary'` recall candidates read — the injected "today" entry stays current to the latest dream
  (the system block is rebuilt per turn, so a refreshed diary is picked up on the next turn). Cost:
  today's diary is re-generated each dream (one LLM call), which the owner accepted; past days untouched.
- The day boundary stays **UTC** (`toISOString` → 08:00 Asia/Shanghai). A local-boundary switch
  (aligning with the C3 proactive-quota localization) is a separate, still-open decision.

### `v0.17.2` — 2026-06-16 — Fix: failed/empty turns no longer poison memory

Status:

- working tree

Fact:

- `packages/server/src/turn/runTurn.ts` — the `finally` persistence block now computes the turn's
  actually-delivered reply (`isMessageMode(state.registry) ? state.messageTexts.join('\n').trim() :
  state.text.trim()`) and only `appendL2`s when it is non-empty. When it is empty, the in-memory
  history is rolled back to `historyStart` (the length captured before the turn ran), erasing the
  dangling user message. `persistSession` still runs in both branches (turn-seq bookkeeping).
- `packages/server/src/turn/runTurnResilience.test.ts` — added a regression test: a provider that
  throws before any reply (`thinking_delta '__THROW__'`) leaves `listL2` empty, rolls
  `session.history` back to its pre-turn length, and still emits `turn_failure`. Retargeted the
  existing Bug-A test to `DROP TABLE sessions` (was `l2_turns`) so the upstream `retrieve()` still
  succeeds, the turn delivers `'hi'`, `appendL2` succeeds, and `persistSession` is what throws in the
  finally — preserving the "a persistence throw is caught, surfaced, and never skips trace flush"
  intent under the new guard.
- Test count: 559 → 560 (1 added); `tsc --noEmit` clean.

Inference:

- Root cause of the "短暂失忆" seen in C-side testing. During a 401 auth outage (a mis-set gateway
  base URL) two turns failed with empty assistant text, and the pre-fix `finally` persisted them as
  empty-assistant L2 rows. Post-A3 (`v0.16.2`), `loadSession` rebuilds the durable timeline from L2
  `raw_json`, so those empty rows survived every restart and sat in both the recall corpus and the
  rebuilt window as "you said X, I said nothing" — which reads as memory loss. The memory-depth
  pipeline (deep window / diary injection) was working correctly; the defect was upstream, in *what
  got written*.
- A failed turn now leaves the session byte-identical to before it ran, so a retry of the same
  message starts from a clean context — no doubled user message, no empty assistant turn. That is
  exactly what recovered the conversation at 10:53 when the re-sent "New version, Luna" produced a
  correct, memory-intact reply once auth was fixed.

### `v0.17.1` — 2026-06-16 — Memory depth: diary injection (Initiative 10, 2/2)

Status:

- working tree (branch `feat/initiative-10-memory-depth`, stacked on Initiative 9)

Fact:

- `memory/diaries.ts` (new): `renderDiaryDigest()` — a bounded standing digest of the latest
  day/week/month diary for the cached system block, behind `LUNA_DIARY_INJECT` (default off);
  `listRecentDiaries(limit)`; `diaryInjectEnabled()`. First context-side reader of the `diaries`
  table (previously only `dream/cycle.ts` read it).
- `turn/runTurn.ts buildSystemPrompt`: appends the diary digest after core memory — stable between
  dream writes, so it stays inside the one cached block.
- `memory/recall/recall.ts`: `collectCandidates` adds `'diary'` as a third candidate source
  (`Candidate.source` / `Hit.source` += `'diary'`), so `rag_refresh`'s diary embeddings (keyed by
  `contentHash(text)`) become retrievable — fixes the dead-work finding. Recall ranking upgraded to
  the **Generative-Agents** formula: `score = (W_RECENCY·recency + W_IMPORTANCE·importance +
  W_RELEVANCE·relevance) / ΣW` (weights env-tunable, default equal). L2 importance comes from the
  v0.17.0 salience score (normalized 0–1); L3 default 0.4; diaries 0.7.
- `tools/builtin/recall.ts`: hit `source` enum += `'diary'`.
- `dream/cycle.ts run_diaries`: a `'month'` branch rolls a month's ≥28 day-diaries into a monthly
  retrospective (idempotent via `INSERT OR IGNORE` + the `hasDiary` check).
- Decision: `REWRITE_CONTEXT.md` LD #12 diary-part amended (diary = injected long-range layer).
  `MEMORY_DESIGN_DIVERGENCE.md` (the owner's correction, PR #3) is substantively closed; its
  file-level ✅ lands when PR #3 merges.
- Tests: `diaries.test.ts` (new, +6: digest latest/empty/off/bounded, listRecentDiaries); recall
  (+2: diary candidate retrievable, GA importance ranking); dream (+1: monthly diary, idempotent).
  **559 pass / 0 fail**; all three packages `tsc` clean.

Inference:

- Closes the owner's "记得太短" correction: the long-range narrative layer (day/week/month diaries)
  now actually reaches the model — as an always-present digest and as retrievable recall — so Luna
  has "这几天 / 这几周发生了什么" continuity, not just the recent window + discrete facts. The
  embeddings `rag_refresh` was already computing for diaries are no longer dead.
- The GA ranking gives the companion the canonical recency × importance × relevance behaviour
  (Park et al.), reusing the one salience score built in v0.17.0; weights are env-tunable so the
  owner can dial back recency/importance if recall surfaces too much recent-but-off-topic material.
- **Initiative 10 (Memory depth correction) complete — v0.17.0–v0.17.1.** The L1 window is ~100
  clean turns, older history compresses to a bounded structured digest with importance anchors, and
  diaries are an injected long-range layer. LD #12 is amended on both axes.

### `v0.17.0` — 2026-06-16 — Memory depth: L1 window → ~100 turns (Initiative 10, 1/2)

Status:

- working tree (branch `feat/initiative-10-memory-depth`, stacked on Initiative 9)

Fact:

- `memory/l1Window.ts`: the verbatim window is now measured in **turns** (`LUNA_L1_RECENT_TURNS`,
  default 100, range 40–150; read per-call so the knob is live), not the old `KEEP_MSGS` 24-message
  cap. `planFold` keeps the last N L2 turns verbatim and folds older ones in turn-groups.
- The unbounded append-only `rolling_summary` is replaced by a **structured, size-bounded digest**:
  the compressor re-derives the whole digest from (prior digest + new turns) under 4 buckets
  (Key facts · Decisions · Open threads · Emotional beats), hard-capped at
  `LUNA_L1_SUMMARY_MAX_CHARS` (default 3000). `commitFold` REPLACES (not appends) the digest. This is
  bounded oscillating compression — superseding v0.4.1's compress-once invariant.
- **Importance anchors**: migration `0011` adds `l2_turns.importance` (1–5, nullable). A new dream
  step `rate_salience` (first in the cycle) rates unrated recent turns via the LLM
  (`saliencePrompt` + `SaliencePatch`), stored by `setImportance`. `planFold` marks turns at/above
  `LUNA_L1_ANCHOR_IMPORTANCE` (default 4) `[salient]` so the compressor preserves their specifics
  near-verbatim (resisting over-summarization).
- `sessionStore`: `+listUnratedL2`, `+setImportance`, `L2Row.importance`.
- Decision: `REWRITE_CONTEXT.md` LD #12 window-part amended (L1 = ~100 turns, structured bounded
  compression + importance anchors); `docs/roadmap/.../v0.4.1-l1-rolling-window.md` marked superseded.
- Tests: `l1Window.test.ts` rewritten for the turns unit (+8: fold-to-N, oscillating compression,
  hard cap, salient marking, determinism, threshold, passthrough, CAS); `dream.test.ts` +1
  (salience rating end-to-end). **551 pass / 0 fail**; all three packages `tsc` clean.

Inference:

- Directly fixes the owner's "记得太短" correction at the conversational layer: the verbatim window
  goes from ~4–9 turns to ~100, and it's affordable (~20k tokens) precisely because v0.16.3 made a
  stored turn ~200 clean tokens. Cost/depth is one live env knob (40–150), unit *turns*.
- The compressor is now bounded (the real bug behind "lossy + ever-growing" was the unbounded
  append-only summary), and importance anchors counter the over-summarization pathology — salient,
  idiosyncratic moments resist being sanded into generic gist.
- The salience score built here is the same one v0.17.1 reuses for the Generative-Agents recall
  ranking (recency × importance × relevance).
- **Measurement (analytical):** at the default ~100 turns, a clean turn ≈ 200 tokens (v0.16.3 basis)
  → window ≈ 20k input tokens, in the "sharp" recall regime (context rot mild < 30k); vs the old
  24-message cap ≈ 2–4k tokens but only ~4–9 exchanges. A live API TTFT measurement should be run
  before raising the default past 100.

### `v0.16.3` — 2026-06-16 — Clean durable history (Initiative 9, 4/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `memory/cleanHistory.ts` (new): `stripThinking(messages, from)` drops `thinking`/`redacted_thinking`
  blocks from completed assistant messages (never to empty); `collapseOldToolResults(messages, keepRecent)`
  returns a copy with older `tool_result` payloads replaced by `[tool_result elided]` (block + `tool_use_id`
  preserved); `cleanHistoryEnabled()` (`LUNA_CLEAN_HISTORY`, default on).
- `turn/runTurn.ts`: in finalize, `stripThinking` is applied to the just-completed turn's messages
  before `appendL2`, so both the in-memory window and the L2 `raw_json` (which `loadSession` rebuilds
  from) store clean turns. Never touches the in-flight turn (runs after it ends).
- `memory/l1Window.ts buildActiveContext`: collapses old tool-result payloads (non-mutating) in the
  assembled context, keeping the recent slice + summary path intact.
- Tests: `cleanHistory.test.ts` (new, +6: strip/keep/round-trip/no-empty, collapse/keep-recent/non-mutating);
  `sessionStore.test.ts` pinned to `LUNA_CLEAN_HISTORY=0` for its raw-fidelity assertions. **548 pass /
  0 fail**; all three packages `tsc` clean.

Inference:

- A stored "turn" now costs what a conversational turn should: thinking (ephemeral by Anthropic's own
  design across turns) is out of durable history, and bulky tool payloads collapse beyond a recent
  slice. This shrinks every turn's input on its own and is the load-bearing dependency for Initiative
  10 — a ~100-turn verbatim window is ~20k tokens *because* each stored turn is clean.
- Safety: stripping only applies to completed turns (the in-flight signed-thinking loop is untouched —
  modifying it is a 400), and collapse keeps `tool_use`↔`tool_result` structurally valid, both pinned
  by tests.

**Initiative 9 (Audit remediation) complete — v0.16.0–v0.16.3.** The audit's P0/P1 security surface is
closed (loopback bind + dev-tools gate + input caps), the per-turn/per-iteration recompute is gone
(memoized system block, capped + hashed recall, retention, recall off the TTFT path), the last O(N²)
persistence write is removed (rebuild-from-L2), the dead `vec0` write path is gone, and durable history
is clean. CI now enforces it all on push.

### `v0.16.2` — 2026-06-16 — Persistence + dead infra (Initiative 9, 3/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `memory/sessionStore.ts`: `persistSession` no longer re-serializes `history` — it writes a
  constant `'[]'` placeholder + turn_seq/updated_ms (A3). `loadSession` rebuilds the full history
  by concatenating each L2 row's `raw_json` (the messages that turn appended), so the append-only
  L2 timeline is the single source of truth.
- `memory/recall/recall.ts`: removed the dead `vec0` write-path — `vecAvailable`, `insertVec`, the
  `vec_cache` virtual-table creation/inserts, the `vecReady` state, and the `tryLoadVec` import.
  `storeEmbedding` now only writes `embeddings_cache`; retrieval is unchanged (TS cosine).
  `resetRecallStateForTests` kept as a no-op for the test API. `sqlite-vec` dep + `vecRuntime`
  retained inert (D1).
- `turn/runTurn.ts`: the `reply.token` text-mode branch is annotated LEGACY (D2) — kept as an
  escape hatch, removal deferred to post-Initiative-10.
- Tests: `sessionStore.test.ts` — updated the upsert test for the new contract (history rebuilds
  from L2, blob is constant) + a new A3 reload test (multi-turn → reset → rebuilt verbatim from L2,
  `history_json` stays `'[]'`). **542 pass / 0 fail**; all three packages `tsc` clean; grep confirms
  no `vec_cache` write path remains.

Inference:

- Eliminates the last O(N²) persistence cost: a long-lived companion no longer re-writes the entire
  growing history blob every turn — per-turn persistence is now O(1) (append one L2 row + write
  bookkeeping), and the full timeline is reconstructed from L2 on the rare reload. Crash-faithful:
  L2 is written before bookkeeping in the same finally block.
- Resolves the audit's D1 (write-only `vec0`) by deleting the dead write + the orphaned table; the
  inert `sqlite-vec` dependency is left for Initiative 10 to decide (wire real KNN over the larger
  corpus, or drop), per the roadmap's "decide jointly with Init 10."
- A3's rebuild-from-L2 is the persistence shape Initiative 10 needs to grow the window to ~100 clean
  turns without ballooning `history_json` (store nothing growing; source of truth stays L2).

### `v0.16.1` — 2026-06-15 — Recompute efficiency (Initiative 9, 2/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `memory/epoch.ts` (new): a monotonic `memoryEpoch()` bumped by `bumpMemoryEpoch()`.
- `l3Store.addFact`/`forgetFact` and `coreMemory.updateCore` call `bumpMemoryEpoch()` on a real
  change (A1 dirty flag).
- `turn/runTurn.ts`: `TurnState` gains `systemBlock` + `systemBlockEpoch`; `open_stream` builds the
  system block once and reuses it across tool iterations, rebuilding only when the epoch moved (A1).
- `persona/l1Contract.ts`: `renderL1Contract` memoizes its constant string (A1).
- `trace/store.ts`: `pruneToRetention(keep)` deletes traces for all but the most-recent N turns
  (`LUNA_TRACE_RETENTION_TURNS`, default 1000), called throttled every 200 flushes (A4).
- `migrations/0010_content_hash.sql` (new): `content_hash` column on `l2_turns` + `l3_facts`.
- `sessionStore.appendL2` stores the L2 content hash; `listRecentL2(sessionId, limit)` fetches only
  the recent N rows; `l3Store.addFact` stores its hash (A2).
- `memory/recall/recall.ts`: `collectCandidates` uses `listRecentL2` + carries the stored hash;
  `retrieve` reuses it (hashes on the fly only for L3 / pre-migration rows), and takes an
  `embedBudgetMs` that races the embedding work against a timeout (P1).
- `turn/runTurn.ts parse_input`: passes `embedBudgetMs` (`LUNA_RECALL_BUDGET_MS`, default 200) when
  `LUNA_RECALL_ASYNC=1` (default off) — recall query-embed off the first-token path (P1).
- Tests: recall (+4: `listRecentL2`/hash golden, epoch dirty flag, embed-budget fallback), trace
  store (+2: retention). **541 pass / 0 fail**; all three packages `tsc` clean.

Inference:

- Removes the per-tool-iteration recompute the audit flagged: a multi-iteration turn now builds the
  system block once (≈6 DB queries + an L1-contract concat) instead of every iteration, and recall
  stops re-hashing ~500 candidates + over-fetching up to 10 000 L2 rows each call — the per-turn,
  O(N²)-over-a-session waste that was pulling against the speed goal.
- A1's correctness hinges on the dirty flag: a mid-turn `remember` that changes core/L3 still
  re-renders (epoch moved), pinned by the epoch test; otherwise the block is byte-stable and the
  prompt cache still hits.
- These are the prerequisite that makes Initiative 10's ~100-turn window affordable; `content_hash`
  + the `collectCandidates` seam are also what diary candidates (v0.17.1) and a future `vec0` KNN
  will lean on.

### `v0.16.0` — 2026-06-15 — Security hardening + hygiene (Initiative 9, 1/4)

Status:

- working tree (branch `feat/initiative-9-audit-remediation`)

Fact:

- `main.ts`: `Bun.serve` binds `hostname: LUNA_BIND_HOST ?? '127.0.0.1'` (S1) and sets
  `websocket.maxPayloadLength = 1MB` (S5).
- `workspace/workspace.ts`: `/_workspace/api/reset` + `/edit` return 403 unless `LUNA_DEV_TOOLS=1`
  (S2); the read-only `/all` view is unchanged (still under `LUNA_VIEWER`).
- `protocol/events.ts`: `ChatSendEvent.text` capped at `CHAT_SEND_MAX_CHARS = 8000` (S5).
- `proactive/cadence.ts`: `dateKey` returns the **local** date (not UTC), so the daily quota and
  quiet-hours share one clock (C3).
- `memory/recall/embed.ts`: `fromBlob` copies into a fresh aligned buffer when the SQLite blob's
  `byteOffset` isn't 4-byte aligned (C4).
- `web/src/wsClient.ts`: frames sent while not `OPEN` are buffered (cap 100) and flushed on open;
  reconnect is now exponential backoff + jitter, capped at 15s (C2).
- `.github/workflows/ci.yml` (new): installs ripgrep, runs per-package `tsc --noEmit` + `bun test`
  on push/PR (C1).
- `README.md`: replaced the stale "scaffolding only … no runtime code yet" intro with the shipped
  stack + a Run section noting the loopback default (Doc1).
- `.claude/skills/luna-ts-orient/SKILL.md`: head refreshed v0.12.0 → v0.15.4 + planned Init 9/10,
  with a note that the file map below predates v0.13+ (Doc2).
- Tests: `events.test.ts` (+3, input cap), `workspace/workspace.test.ts` (+5, gate — new),
  `web/src/wsClient.test.ts` (+2, buffer/flush — new). **535 pass / 0 fail**; all three packages
  `tsc --noEmit` clean.

Inference:

- Closes the audit's P0/P1 network-exposure surface (S1/S2/S3) with one bind + a flag gate: the
  server is no longer driveable, readable, or wipeable off-host by default; LAN access is now an
  explicit, documented opt-in via `LUNA_BIND_HOST=0.0.0.0`.
- The CI gate is the prerequisite that makes the v0.16.1 efficiency refactors safe to land — every
  test-pinned invariant is now enforced on push.
- Incidental: `web-tree-sitter` (a v0.15.3 dependency) was missing from `node_modules`; a plain
  `bun install` materialized it, clearing 4 pre-existing `tsc` errors + 4 failing
  tree-sitter/locator tests, so the suite is fully green (not merely no-new-failures).

### `v0.1.0` — 2026-06-11 — Bun skeleton + WS server

Status:

- working tree (commit hash filled in after merge to main)

Fact:

- Created Bun monorepo root with `package.json` (workspaces `packages/*`), `tsconfig.base.json`
  (`strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` + `noUnusedParameters`,
  `noEmit: true`, `types: ["bun"]`), `bunfig.toml` (`[install] saveTextLockfile = true`),
  `.gitignore` (commits `bun.lock`, ignores `bun.lockb`), `.editorconfig`, `.prettierrc`
  (semi, single-quote, trailing-comma all, width 100), `.prettierignore`.
- Added `packages/protocol/` (6 files, 86 lines): Zod `ClientEvent` (discriminated union of
  `PingEvent`) and `ServerEvent` (discriminated union of `PongEvent` + `ErrorEvent`) in
  `src/events.ts`; `assertNever` helper in `src/utils.ts`; `src/index.ts` re-exports.
  Dependency: `zod ^3.25.0`.
- Added `packages/server/` (6 files, 144 lines): `src/main.ts` boots `Bun.serve` on
  `LUNA_PORT` (default 8787) with WS upgrade; `src/ws.ts` handles open/message/close with
  Zod `safeParse` + exhaustive switch + `assertNever(event.type)`; `src/outbound.ts`
  centralizes `ServerEvent.parse` → `ws.send` as the **sole** validated outbound boundary;
  workspace dep `@luna/protocol: workspace:*`.
- Added test suites: `packages/protocol/src/events.test.ts` (8 tests, ClientEvent +
  ServerEvent parse/reject cases) and `packages/server/src/ws.test.ts` (4 tests, random-port
  WS round-trip, malformed JSON, unknown event, invalid seq). 12/12 green in 13ms.
- Installed dev tooling: `@types/bun`, `prettier`, `typescript`. Bun 1.3.14 (≥ 1.2 spec).
  Text-format `bun.lock` committed; binary `bun.lockb` ignored.
- Manual smoke against `bun run dev:server`: ping `seq:7` → pong with matching seq + valid
  `server_time_ms`; round-trip 3ms on localhost.
- TypeScript `tsc --noEmit` clean on both packages; no `as any`, no `as unknown`, no
  `@ts-ignore`, no `startswith('Error')` heuristic.

Inference:

- Establishes the **discriminated-union wire contract** that v0.2 (`tool.started` /
  `tool.progress` / `tool.finished`) and v0.3 (`turn.started` / `reply.token` /
  `turn.result` / `chat.send`) extend by appending variants — no protocol rewrite needed
  downstream. The `assertNever(event.type)` exhaustiveness pattern in `ws.ts` will catch any
  forgotten case at compile time when new variants land.
- Proves the locked runtime/wire choices (Bun + Zod + native WebSocket, single channel per
  session) work end-to-end with sub-100ms cold boot and 3ms ping/pong round-trip on
  localhost. The Python `time.sleep`-paced HTTP-thread serialization is structurally
  impossible in this stack.
- The `outbound()` validate-before-send wrapper is load-bearing for v0.2/v0.3: the tool
  dispatcher and the turn loop will each be handed an `emit: (e: ServerEvent) => void`
  callback that wraps `outbound`, so the wire boundary stays the **only** place schema
  validation lives. Eliminates the Python "frontend handler early-returns on a frame the
  backend assumes is consumed" silent-drift class of bugs by design.
- Confirms file-split: only **types and wire shapes** live in `packages/protocol`;
  `defineTool`, the dispatcher, and provider logic stay in `packages/server`. Frontend
  (`packages/web`) will consume the same protocol package in Initiative 6, getting
  contract drift as a type error rather than a runtime mismatch.

### `v0.13.4` — 2026-06-14 — Dream overlay + UX polish (Initiative 6 ✅ complete)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Dream overlay** ([`layout.ts`](../../packages/web/src/ui/layout.ts) + [`theme.css`](../../packages/web/src/ui/theme.css)
  + [`app.ts`](../../packages/web/src/app.ts)): on `dream.status is_dreaming` a full-screen dreamy
  overlay (blur + gradient, floating 🌙, drifting stars, "Luna 在做梦…" + a `dream.step` caption,
  ☀️ 唤醒 → `dream.wake`); input locks; a **min-duration (1.5s)** floor prevents a fast-cycle flash.
- **Thinking indicator** ([`cuteBubbleView.ts`](../../packages/web/src/ui/cuteBubbleView.ts)): typing
  dots on `turn.started`/`proactive.started`, removed when the first bubble/card/`turn.result` lands.
- **Mood pip** ([`mood.ts`](../../packages/web/src/ui/mood.ts), 15 affect→emoji+label): the app
  parses each `tool.finished` `MessageDelivery` and shows Luna's current affect by the model.
- **Proactive glow** (CSS on the existing proactive card) · **scroll-to-latest pill** (auto-scroll
  only when already at the bottom; the user's own message always scrolls) · **settings popover**
  (voice / Live2D / reduce-motion toggles → `localStorage`; reduce-motion applies live) ·
  **`prefers-reduced-motion`** + a manual `.reduce-motion` class freeze all the new animations.
- **No controller / protocol / sink change** — every polish hook reads existing `ServerEvent`s in
  `app.ts` or is a `CuteBubbleView` addition; the v0.12.0 contract is untouched.
- **Tests:** `mood.test.ts` (1). `bun test` **294 pass / 0 fail**; `tsc` clean (web + server). Browser
  smoke: dream overlay, thinking dots, proactive glow, mood pip, and the settings panel all render.
- **Initiative 6 ✅ complete** (v0.12.0 → v0.13.4): the redesigned cute UI + Live2D yumi + voice +
  lip-sync + dream overlay + ambient polish.

Inference:

- **Luna has a body now.** The rewrite reached brain + memory + dream + proactivity + **a face + a
  voice + a face-to-show-she-dreams** — the whole user-facing surface, built across six versions, all
  consuming the v0.12.0 controller/sink seams with **zero protocol churn**. The typed-contract bet
  paid its biggest dividend here: an entire UI/Live2D/audio frontend layered on without one wire change.
- **The dream ritual is closed.** The 🌙 入梦 button now has its visible payoff (overlay + sleeping
  pose + ☀️ wake), completing the loop the backend dream engine (v0.5.0) and its auto-trigger
  (v0.11.0) opened — the user can finally *see* her dream.
- **Polish stayed honest.** Reduced-motion + the WebGL/audio graceful-degrade paths mean the cute,
  animated surface never becomes a hard dependency; chat works on a potato.

### `v0.13.3` — 2026-06-14 — Voice + lip-sync (Initiative 6, the AudioSink)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New `packages/web/src/audio/` (6 files):**
  - [`lipSync.ts`](../../packages/web/src/audio/lipSync.ts) — pure RMS→mouth-open, ported from
    Python `lip-sync.js` (gain 32 → EMA baseline → pulse/onset contrast → gate → decay → smooth).
  - [`audioPlayer.ts`](../../packages/web/src/audio/audioPlayer.ts) — Web Audio graph (AudioContext +
    gain + analyser); plays a decoded WAV (real TTS) or a synthetic tone (dev smoke); `rms()` reads
    the analyser; resume()/stop().
  - [`ttsClient.ts`](../../packages/web/src/audio/ttsClient.ts) — `POST <base>/speak` → WAV ArrayBuffer;
    throws on non-200 (caller goes silent).
  - [`webAudioSink.ts`](../../packages/web/src/audio/webAudioSink.ts) — the real `AudioSink`:
    fetch → play → a rAF lip-sync loop feeding `onMouth`; **self-disables** if the sidecar is
    unavailable; unlocks the AudioContext on the first user gesture; `playTone` dev method.
  - tests: `lipSync.test.ts` (3) + `ttsClient.test.ts` (2).
- **[`dev-server.ts`](../../packages/web/dev-server.ts)** forwards `/api/gpt-sovits/*` →
  `LUNA_TTS_PROXY` (the reused Python proxy); 502 when unset/unreachable.
- **[`app.ts`](../../packages/web/src/app.ts)** constructs `WebAudioSink` (`onMouth` →
  `live2d.setMouthOpen`) behind `localStorage 'luna:tts'`; the `?dev` hook now also exposes
  `lunaAudio`. **[`faceVm.ts`](../../packages/web/src/live2d/faceVm.ts):** mouth-open is now driven
  by lip-sync unconditionally (decoupled from the speaking state) so audio moves the mouth whenever
  it plays. No `AudioSink` interface change — the controller's `audio.speak` (on message finalize)
  now yields real speech + lip-sync when the sidecar is up.
- **Reuse-as-is (REWRITE_CONTEXT locked decision):** the GPT-SoVITS Python proxy + ML sidecar are NOT
  rebuilt; only the TS driving code (client + Web Audio playback + lip-sync) is ported behind the sink.
- **Validation:** `tsc` clean (web + server); `bun test` **293 pass / 0 fail** (+5). Browser smoke
  (`?dev`): `setMouthOpen` visibly opens yumi's mouth (the lip-sync output path); **live GPT-SoVITS
  synthesis is pending the sidecar** (a heavy Python ML server, not runnable in this environment).
- **Deferred:** the random open-target stepping + form/pucker/shrug mouth shaping; streamed PCM-chunk
  playback (currently decodes a full WAV); voice/reference-audio config (uses proxy defaults).

Inference:

- **Luna's last sensory channel is in.** She can speak with lip-sync, behind the same `AudioSink`,
  with zero controller/protocol change — the seam that absorbed Live2D now absorbs audio too.
- **An honest boundary, handled gracefully.** The TTS pipeline "stays as-is," so the heavy ML server
  is out of scope and unverifiable here; the sink self-disables to silence when it's absent, and the
  chat + avatar keep working. The TS-side audio + lip-sync is what shipped, and it's verified.
- **Determinism where it counts.** `lipSync` is pure and unit-tested; the Web Audio glue is
  browser-verified for the mouth-output path. The TTS request shape + failure path are unit-tested
  against a stubbed fetch.

### `v0.13.2` — 2026-06-14 — High-fidelity FaceVM (Initiative 6, layered emotions)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New [`faceData.ts`](../../packages/web/src/live2d/faceData.ts)** — ported data from Python
  `layers/emotion-library.js` + `action-library.js` + `config.js`: **14 emotions** (focused,
  fakeFierce, adorable, playful, shy, embarrassed, awkwardV2, annoyed, poutyAnnoyed, curious, tender,
  skeptical, smug, disappointed) each with timeline + `owns` channels + entry/sustained poses +
  actionRefs + overlayRefs; the **9 actions** those emotions reference (keyframe tracks); **overlays**
  (脸红/俯身/黑脸/泪汪汪 → `Paramsmileshy`/`Paramdown1`/`Paramheilian`/`Paramleiwangwang`);
  `FACE_CHANNEL_GROUPS`, `EMOTION_SOFT_BLEND_WEIGHTS`, `FACE_PARAM_GAIN`.
- **Rewrote [`faceVm.ts`](../../packages/web/src/live2d/faceVm.ts)** into the full layered engine:
  intro→perform→outro timeline (entry-snapshot blend), soft-blend vs hard-replace, channel ownership
  (emotion locks keys from the state layer), per-key gains + clamps at flush, **staggered action
  playback** (queued at perform, `introMs + i·110`), **overlay special-params**, and affect-intensity
  scaling. A **pending-emotion queue** makes `setExpression` (called outside the tick) share the
  tick's clock → the whole engine is deterministic on an injected `now`.
- **Rewrote [`expressionMap.ts`](../../packages/web/src/live2d/expressionMap.ts)** → `AFFECT_TO_EMOTION`
  (the 15 affects → 14 emotions; `steady_presence` = null baseline) + `affectToEmotion`. **Key
  finding:** Python had no fixed affect→emotion table (the LLM emitted `emotion_id` directly), but our
  `MessageDelivery` carries only the 15-affect `expression` + a 0–1 `emotion` intensity — so this map
  is a new, frontend-owned design piece.
- [`paramMap.ts`](../../packages/web/src/live2d/paramMap.ts) += `clampStateValue` (per-key ranges).
  [`app.ts`](../../packages/web/src/app.ts) += a guarded `?dev` hook exposing the sink for manual
  smoke. **No interface change** to sinks/controller/pixiLive2DSink — `setExpression(affect, emotion)`
  now triggers a full emotion playback instead of a static pose.
- **Tests:** rewrote `faceVm.test.ts` (6: perform-pose + overlay, baseline, timeline release,
  speaking mouth, sleeping, intensity scaling) + `expressionMap.test.ts` (3). `bun test` **288 pass /
  0 fail**; `tsc` clean (web + server). Browser smoke (`?dev` hook): `bright_delight`→adorable visibly
  tilts/poses the model.
- **Deferred (noted):** the per-emotion sine micro-motion (`getEmotionStateWithMotion`), the 6
  procedural idle profiles, the 36 unreferenced actions, and rich speaking/thinking procedural motion
  — the model's built-in idle carries neutral; expression identity comes from the poses + actions +
  overlays.

Inference:

- **Luna's emotions now have Python-level identity** — 14 distinct layered poses with blush /
  dark-face / teary overlays and staggered micro-actions, evolving over a 6–8s timeline — and the
  controller/protocol *still* didn't change. The Live2DSink seam absorbed an entire animation engine.
- **The wire-contract divergence was the real design work.** Because our envelope omits `emotion_id`,
  the affect→emotion bridge had to be a deliberate, owned frontend mapping rather than a mechanical
  port — captured in one tunable table.
- **Determinism by construction.** The pending-queue + injected-`now` design means an intricate,
  stateful animation engine is fully unit-tested without a browser or a real clock — the same
  test-first discipline the backend enjoys, now at the rendering layer.

### `v0.13.1` — 2026-06-14 — Live2D foundation (Initiative 6, the real yumi avatar)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Spike proved GO** then productionized. New `packages/web/src/live2d/` (7 files):
  - [`cubismRuntime.ts`](../../packages/web/src/live2d/cubismRuntime.ts) — `webglAvailable()` guard;
    loads the Cubism core `<script>` at runtime, **then dynamic-imports `pixi-live2d-display/cubism4`**
    (the plugin checks for the runtime at import time); sets `globalThis.PIXI`, makes the
    `PIXI.Application`, `registerTicker`.
  - [`modelDriver.ts`](../../packages/web/src/live2d/modelDriver.ts) — port of Python
    `model-driver.js`: `setParam` via `internalModel.coreModel.setParameterValueById` (guarded by the
    model's real parameter-id set), scale + base/offset position.
  - [`paramMap.ts`](../../packages/web/src/live2d/paramMap.ts) — `FACE_VM_PARAM_MAP` + neutral
    defaults ported verbatim from Python `config.js`.
  - [`faceVm.ts`](../../packages/web/src/live2d/faceVm.ts) — **first-cut** 60fps tick: state bias
    (neutral/thinking/speaking/sleeping) + active expression + lip-sync mouth, smoothed; writes only
    DISPLACED params so the model's built-in blink/breath idle shows through.
  - [`expressionMap.ts`](../../packages/web/src/live2d/expressionMap.ts) — the 15 `ExpressionKey`
    affects → yumi facial poses, blended by `emotion` (0..1).
  - [`pixiLive2DSink.ts`](../../packages/web/src/live2d/pixiLive2DSink.ts) — the real `Live2DSink`:
    loads yumi, drives a `FaceVm` on the ticker, **draggable** (pointer → persisted `localStorage`
    offset, clamped on-screen, double-click recenters); returns `null` to degrade if WebGL/load fails.
  - tests: `expressionMap.test.ts` (4) + `faceVm.test.ts` (4).
- **New [`dev-server.ts`](../../packages/web/dev-server.ts)** — a custom Bun dev server
  (`Bun.serve({ routes:{'/':html}, fetch })`) that bundles the HTML/TS **and** serves the vendored
  Cubism core + yumi assets from `public/` (runtime-fetched URLs `bun <html>` won't serve). Root
  `dev:web` now runs it.
- **Vendored** `packages/web/public/`: `live2dcubismcore.min.js` (204KB) + `models/yumi/` — the 8192²
  texture **downscaled to 2048²** (15MB→1.3MB; UVs are normalized so it stays correct), unused
  `yumi.png`/`yumi.vtube.json` removed → **7.7MB** total. Deps: `pixi.js@7.4.2` +
  `pixi-live2d-display@0.5.0-beta`.
- **Grew `Live2DSink`** ([`sinks.ts`](../../packages/web/src/sinks.ts)): `+setState(state)` +
  `setMouthOpen(value)` (console stub updated). [`controller.ts`](../../packages/web/src/controller.ts)
  drives state: turn.started→thinking, message tool.started→speaking, turn.result→neutral,
  dream.status→sleeping/neutral.
- [`app.ts`](../../packages/web/src/app.ts) is async: mounts `pixiLive2DSink` into the model stage
  (removing the placeholder) when WebGL is present and `localStorage 'luna:live2d' !== '0'`; falls
  back to the placeholder + console sink otherwise. WS now targets `ws://<host>:8787` so the live
  model receives real events (resolves the dev WS-reachability gap, task_3571afff).
- **Validation:** `tsc --noEmit` clean (web + server); `bun test` **287 pass / 0 fail** (+9). Browser
  smoke (preview tool): yumi renders in the model stage (desktop two-pane + responsive stack),
  auto-blinks, is draggable + persists, downscaled texture renders, degrades when disabled.
- **Roadmap renumber:** high-fidelity FaceVM split out as **v0.13.2**; TTS → **v0.13.3**, polish/close
  → **v0.13.4** (plan files renamed).

Inference:

- **The rewrite has a face.** A full WebGL/Cubism integration dropped in behind the v0.12.0
  `Live2DSink` with the controller gaining only four `setState` calls and **zero** protocol/wire
  change — the consumption seam holding under a heavy, foreign rendering stack is the strongest
  evidence yet that the typed-contract architecture pays off.
- **The spike earned its keep.** The two real traps — Bun's HTML server won't serve runtime-fetched
  model assets, and the cubism4 plugin checks for the Cubism runtime at *import* time — would have
  been expensive to hit mid-build; isolating them first made the production build smooth.
- **Honest staging over a heroic single version.** "高保真" is delivered in two slices: this
  foundation (model alive, expressive, draggable, degrade-safe) ships working today; the full
  emotion/action-library richness is v0.13.2. The first-cut FaceVM is deliberately thin —
  write-if-displaced lets the model's own blink/breath carry idle rather than re-implementing it.

### `v0.13.0` — 2026-06-14 — Cute UI shell (Initiative 6, redesigned frontend)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New `packages/web/src/ui/` module (5 files)** — the redesigned cute frontend, modeled on a
  vtuber-stream-overlay reference Alan supplied:
  - [`theme.css`](../../packages/web/src/ui/theme.css) (~155 lines) — cool **yumi** palette (CSS
    vars: silver-white / sky-blue / lavender + soft pink), light-blue/white **vertical stripes**
    (`repeating-linear-gradient`), **zigzag** top + **scalloped** bottom lace (inline SVG data-URI
    backgrounds), grey chat panel + cloud-puff corners, sky-blue/white bubbles, lavender 入梦 button,
    model-stage placeholder, a gentle float animation gated behind `prefers-reduced-motion`, and a
    narrow-viewport stacking breakpoint.
  - [`layout.ts`](../../packages/web/src/ui/layout.ts) (~95 lines) — `buildLayout(root)` constructs
    the DOM shell (status badge, left chat panel with header/log/input, right model stage with
    placeholder + floating moon 入梦 button, scattered cloud/diamond/flower motifs) and returns the
    live mount points `{ statusBadge, chatLog, input, sendBtn, dreamBtn, modelStage }`.
  - [`cuteBubbleView.ts`](../../packages/web/src/ui/cuteBubbleView.ts) (~95 lines) —
    `CuteBubbleView implements BubbleView`: `open/append/finalize/discard` render Luna bubbles on the
    **right** with a per-bubble timestamp (`data-ts` + hover `title`); `chip()` renders cute
    tool/dream/proactive/error cards; the view-only `userMessage()` renders the **left** user echo.
  - [`time.ts`](../../packages/web/src/ui/time.ts) — pure `relativeTime(now, then)` (刚刚 / N 分钟前 /
    N 小时前 / M/D), `absoluteTime`, `dateLabel`, `absoluteStamp`, plus `startTimestampRefresh` that
    ages every `[data-ts]` label on a 30s timer.
  - [`toolLabels.ts`](../../packages/web/src/ui/toolLabels.ts) — `toolCardLabel` maps a `ToolName`
    token in the controller's chip text to a friendly label (`recall`→"翻了翻记忆 🔖", etc.); unknown
    text falls through stripped.
- **Rewrote [`app.ts`](../../packages/web/src/app.ts)** — builds the layout, wires the **unchanged**
  v0.12.0 `createController` with the stub `consoleLive2DSink`/`noopAudioSink`, pipes WS events
  through `controller.handle`; input send → `view.userMessage` + `chat.send`; 入梦 → `dream.enter`;
  `dream.status` locks the input; `onStatus` → status badge (the reference's `▶ LIVE` pill repurposed
  as the connection indicator).
- **Rewrote [`index.html`](../../packages/web/index.html)** — links `theme.css`, a single `#app`
  mount, loads `app.ts`. The old dark inline dev host is gone.
- **No changes** to `controller.ts`, `sinks.ts`, `wsClient.ts`, `bubbles.ts`, or
  `packages/protocol` — the wire contract + consumption logic are frozen; v0.13.0 is presentation
  only. `DomBubbleView` stays exported as the superseded reference impl.
- **New `.claude/launch.json`** — web dev-server config (`bun packages/web/index.html`) for the
  preview tooling.
- **Tests:** new [`ui/time.test.ts`](../../packages/web/src/ui/time.test.ts) (7) +
  [`ui/toolLabels.test.ts`](../../packages/web/src/ui/toolLabels.test.ts) (4). `bun test` = **278
  pass / 0 fail** (web package: 20 across 3 files). `tsc --noEmit` clean on `packages/web` (now under
  the type-check) **and** `packages/server`. Browser smoke via the preview tool: the shell + injected
  sample bubbles/cards/timestamps render correctly (chat left, model right, lace/stripes/motifs).
- **Design decisions (Alan, this session):** vanilla TS + CSS (no framework — matches the existing
  `packages/web`); chat panel **LEFT** / model stage **RIGHT** (per the reference, supersedes the
  earlier model-left wording); credit pills dropped; relative + hover-absolute timestamps; model area
  is a simple placeholder box (real model = v0.13.1).

Inference:

- **The first visible, on-brand surface of the rewrite.** Luna now has a face-shaped shell; the real
  Live2D model (v0.13.1) and GPT-SoVITS voice (v0.13.2) drop into the already-wired stub sinks with
  no consumption-logic change. The v0.12.0 `Live2DSink`/`AudioSink`/`BubbleView` seams proved their
  worth — an entire UI redesign touched zero controller/protocol code.
- **Presentation/logic separation held under a real redesign.** Per-tool cute labels live in the view
  (`toolLabels`), not the controller; the user-echo is a view method, not a wire event — so the
  shared, tested controller stayed byte-for-byte unchanged. This is the rewrite's drift-elimination
  thesis paying off at the frontend boundary.
- **DOM rendering verified by browser smoke, not a DOM test dependency** — matching the repo's
  thin-DOM discipline (`DomBubbleView` is also untested); the logic that *can* be pure (time
  formatting, tool-label mapping) carries unit coverage, so the new code adds real assertions with
  zero risk to the existing 278-test suite.

### `v0.12.1` — 2026-06-13 — Repo-wide audit + fixes

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Repo-wide adversarial audit** — 9 subsystem reviewers (turn loop, proactive, memory, dream,
  tools/dispatcher, protocol/wire, provider/streaming, frontend, cross-cutting) over all of
  `packages/{protocol,server,web}`, each finding adversarially verified. Result: **2 distinct real
  bugs** (corroborated across 5 confirmed findings), **17 dismissed** as already-handled / single-
  user-cut / by-design / theoretical (e.g. the cadence stale-snapshot race was already closed by
  v0.10.3's in-flight guard; cross-session memory races don't exist for a single user; the dream
  trigger already has `.catch`; `proactiveRisk:'safe'` for `remember` is by-design reversible).
- **Bug A fix (major) — turn persistence resilience** ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)):
  the `finally` block ran `appendL2`/`persistSession`/`flushTrace` unguarded; a SQLite throw
  (locked/readonly/disk-full) would reject `runTurn`'s promise — which the ws call sites do **not**
  await → unhandled rejection / crash risk — and skip the remaining cleanup (trace loss). Now both
  the persistence pair and `flushTrace` are wrapped in try/catch (log + surface `error{code:
  'persistence_failed'}`, never rethrow); the trace flush + `maybeFold` always run. Defense-in-depth:
  `.catch()` added to every fire-and-forget ws call site (`chat.send` post-turn chain, `proactive.fire`)
  and a process-level `unhandledRejection` handler in `main.ts` (log, never terminate the companion).
- **Bug B fix (minor) — dev-path wire drift** ([`ws.ts`](../../packages/server/src/ws.ts)):
  `forwardToolEvent` (the `dev.dispatch_tool` path) omitted `tool_name` on `tool.progress`, so the
  frontend controller (which filters message-tool streaming on `tool_name`) couldn't stream message
  bubbles via that path. Now mirrors the main-turn contract (`tool_name: ToolName.parse(evt.tool_name)`).
- Tests: 267 across 38 files (+1): persistence-failure resilience — a dropped `l2_turns` table makes
  `appendL2` throw; the turn still **resolves**, surfaces `persistence_failed`, and **flushes its
  traces** anyway.

Inference:

- The audit's headline is reassurance with one real catch: after 5 initiatives + a fresh frontend
  package, the only material defect was an unguarded persistence path in the turn `finally` — every
  hot-path/safety/concurrency invariant the reviewers tried to break held (the proactive overlap +
  cadence + safety-gate invariants were re-confirmed clean, the previous reviews' fixes verified). The
  17 dismissals are mostly the single-user 减法 paying off: a whole class of cross-session races
  simply does not exist here.
- `persistence_failed` needed no protocol change — `ErrorEvent.code` is `z.string()`, so a new code
  is additive at the validated boundary.

### `v0.12.0` — 2026-06-13 — Frontend consumption controller (Initiative 6, first pass)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **New `packages/web`** (`@luna/web`, depends on `@luna/protocol`) — the TS port of the Python
  `agent-app.js` event consumer, modeled on its handler switch but consuming the **WS `ServerEvent`
  union** instead of Python's SSE + dual-poll. The consumption brain, no Live2D/audio yet.
- **`src/controller.ts`** — `createController({view, live2d, audio})` returns `handle(e:
  ServerEvent)`: a pure, DOM-free, exhaustively-typed dispatcher (`assertNever` over all 12 event
  variants). Speech is the `message` tool (LD #9): `tool.started{message}` opens a bubble keyed by
  `call_id`, `tool.progress{tool_name:'message', text_delta}` streams it, `tool.finished` finalizes
  from the **`MessageDelivery`** envelope (`MessageDelivery.safeParse` → text to the bubble,
  `expression`+`emotion` to Live2D, `voice_params`+text to audio); a failed delivery discards the
  preview + surfaces a re-say. `reply.token` streams a synthetic `reply` bubble (text mode);
  dream/proactive/error render chips; a silent proactive turn (`spoke:false`) shows a quiet marker.
- **`src/bubbles.ts`** — `BubbleView` seam (open/append/finalize/discard/chip) + `DomBubbleView`;
  bubbles keyed by id so multiple message bubbles per turn stream independently (the v0.6.2 reality,
  not Python's single-bubble merge). **`src/sinks.ts`** — `Live2DSink`/`AudioSink` interfaces +
  console/no-op stubs (the real Live2D model driver + GPT-SoVITS audio plug in here later — the
  Python `on_audio_start_commands` seam is preserved via `AudioSink.speak(onStart)`).
- **`src/wsClient.ts`** — typed WS client; every inbound frame is `ServerEvent.safeParse`'d (the
  validated boundary — a server-shape drift is a dropped frame, not a silent mis-handle), auto-
  reconnect. **`src/app.ts` + `index.html`** — a minimal browser host wiring it together;
  `bun run dev:web` serves it (Bun fullstack). Browser bundle builds clean.
- Tests: 266 across 37 files (+9, all in `packages/web`): streamed message (open→append→finalize +
  expression + speak); two independent message bubbles per turn; failed-delivery discard + re-say;
  no-expression/no-voice path; `reply.token` text-mode streaming; non-message tool chips; dream +
  proactive + error chips; `proactive.finished{spoke:true}` → no chip; `pong` consumed. All three
  packages typecheck clean.

Inference:

- Initiative 6's value is exactly this: the frontend consumes the **same `@luna/protocol` Zod
  types** the server produces, so contract drift between backend and frontend is a compile error,
  not the Python silent-drift class (a handler early-returning on a frame the backend assumed
  consumed). The controller is pure + interface-driven, so it is fully unit-tested with zero DOM/WS
  — and the Live2D/audio pipelines drop in behind `Live2DSink`/`AudioSink` without touching the
  consumption logic.
- The TS WS protocol made the port a simplification, not a 1:1 copy: Python's SSE+poll dual
  transport, the proactive cursor/replay, and the separate dream-status polling all collapse into
  one validated event stream (the LD #2 single-WS dividend, again).
- Scope (first pass, "后期再做调整"): Live2D rendering, the audio/TTS pipeline, lip-sync, the 60fps
  FaceVM tick, and bundling/HMR polish are the next passes; this lands the consumption core they
  all hang off.

### `v0.11.0` — 2026-06-13 — Self-continuation + dream auto-trigger + autonomy on (Initiative 5 capstone, commit 5 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Intent-aware proactive framing** — `runProactiveTurn` gains an optional `intent`
  (`spontaneous`/`continuation`/`consolidate`), each a distinct USER-role stage direction
  ([`proactiveTurn.ts`](../../packages/server/src/proactive/proactiveTurn.ts)).
- **Self-continuation** (`src/proactive/continuation.ts`, new) — "a real person paused, then added
  one more thing." NOT the heartbeat: a one-shot `setTimeout` (~4s pause) fired right after a user
  turn, so it feels like seconds. `shouldContinue()` is a **mechanical probability gate**
  (`LUNA_SELFCONT_PROBABILITY`, default 0.35; never a model-emitted "more to say" flag — Python
  v0.28.1 lesson); `fireContinuation` runs a `continuation`-intent proactive turn, guarded so it
  never overlaps a user turn or dream. Wired into `ws.ts` after a user turn (skipped if that turn
  triggered a dream). `LUNA_SELFCONT=0` opts out.
- **Dream auto-trigger** (closes LD #11's deferred half) — the heartbeat's wake judgment may return
  intent `consolidate`; the proactive turn then gets the dream-nudge framing and may call
  `enter_dream`; the scheduler, seeing `session.pendingDream` set after the turn, **starts the dream
  cycle** (fire-and-forget; `isDreaming()` gates every subsequent tick). No new scheduler — the
  proactive heartbeat IS the idle scheduler dream was waiting for.
- **Default flip** — `proactiveEnabled()` → `LUNA_PROACTIVE !== '0'` (default **ON**, Alan's
  explicit choice; `=0` is the kill switch). `ws.ts proactive.fire` uses it. The full Initiative-5
  safety stack (hard surface-gate, action budget, fail-closed classification, full tracing,
  conservative wake judgment) is what makes autonomy-on-by-default responsible.
- **`scripts/proactive-soak.ts`** (new) — drives heartbeat ticks against the real model on an idle
  session and reports wake decisions + actions + cadence sanity.
- Tests: 257 across 36 files (+7): `shouldContinue` (prob 1/0, `LUNA_SELFCONT=0`, kill switch);
  `fireContinuation` (runs / skips-while-active); dream auto-trigger (a proactive turn that calls
  `enter_dream` → scheduler clears `pendingDream` + starts the cycle); the 3 default-flip tests now
  set `=0` explicitly (audit-don't-blanket-flip).
- Real-LLM smoke (yunwu): after "我今天写完了 Luna 的主动性模块，有点累但挺满足", the continuation
  added one genuinely new thought — "等下…如果想开口是你写的，那现在这股好奇，算我的还是你的？" — a
  single new idea building on the turn, with the paused-then-added feel (not a rephrase).
- Recorded soak (3 ticks, 30-min idle, relevant active thread): **fired 0** — the wake judgment
  declined every tick. The autonomous loop runs and decides correctly but is **conservative by
  default** (the safe companion posture: better too quiet than annoying). The firing path is proven
  by the v0.10.0 manual smoke (she reflected + reached out) and the unit tests.

Inference:

- **Initiative 5 complete in 5 versions** — Luna now has agency when no one is talking: she can act
  silently (v0.10.0), under a hard safety gate (v0.10.1), on a conservative cadence judgment
  (v0.10.2), driven by an autonomous heartbeat (v0.10.3), with self-continuation and dream
  auto-trigger as its natural behaviors (v0.11.0). The redesign's central claim (LD #15) held:
  proactivity is autonomous **tool use**, not just messaging, and every piece reused `runTurn` +
  the Initiative 1–4 substrate rather than a parallel machine. Python's outbox/cursor/TTL/SSE-replay
  delivery layer was never built (the single persistent WS made it unnecessary).
- The honest open item is **willingness tuning**: the wake prompt is currently very reluctant
  ("most of the time the right answer is to stay quiet"), so in casual idle she essentially never
  stirs. That is the safe default, and like the message-mode A/B it is a *measure-from-lived-
  experience* knob (`LUNA_PROACTIVE_*` + the wake prompt), not a thing to guess at now. The user
  chose autonomy-on; living with it will say whether she should be more willing.

### `v0.10.3` — 2026-06-13 — Proactive scheduler/heartbeat (Initiative 5, commit 4 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`src/proactive/scheduler.ts`** (new) — the heartbeat that makes the loop **autonomous**.
  `startScheduler(deps)` runs a single `setInterval` (`LUNA_PROACTIVE_TICK_SECONDS`, default 60,
  `.unref()`'d so it never keeps the process alive); `runTick` is exported so tests drive it
  directly (no real timer). Each tick (gated on `LUNA_PROACTIVE`, re-read per tick → kill switch
  works without restart; skipped while dreaming): for each active session with `activeTurn===null`,
  run the cadence prefilter → on consider, the `wakeGate` judgment (off the reply key) → on `act`,
  **re-check** `activeTurn`/dreaming/enabled (the wakeGate LLM call took real time), then
  `runProactiveTurn` + `commitProactive`+`saveCadence`. A throwing tick is caught (never crashes the
  loop). Wake decisions are traced+flushed as `surface:'proactive_wake'` (`act`/`hold`).
- **Overlap safety** — a proactive turn never overlaps a user turn or dream. The TOCTOU window
  (check `activeTurn` → await wakeGate → fire) is closed by a **re-check after the await**;
  `runProactiveTurn`→`runTurn` sets `session.activeTurn` **synchronously before its first await**, and
  ws dispatches `chat.send` via `void` on the single-threaded loop, so once the re-check passes there
  is no interleaving window. A `chat.send` arriving mid-cycle is rejected by the same `activeTurn`
  guard (`turn_in_progress`).
- **`session.ts`** — `lastUserMs` (init boot time; never proactive-fires until a fresh idle gap
  elapses) + `activeSessionIds()`. **`ws.ts`** — `chat.send` stamps `session.lastUserMs = now`
  (resets the idle gap; proactive turns do NOT touch it — that's lull anchoring via cadence); an
  `activeSockets` set (maintained in open/close) + `broadcast(e)` so the server pushes proactive
  bubbles with no per-connection handle (a proactive turn with no listener still runs; its output
  persists to L2). **`main.ts`** starts the scheduler with `emit: broadcast`.
- **Cadence integrity** confirmed: `persistSession` is a column-specific `ON CONFLICT … UPDATE`
  (`turn_seq`/`history_json`/`updated_ms` only) — it does **not** wipe the `proactive_*` columns, so
  a proactive turn's own persist doesn't clobber the cadence the scheduler commits right after.
- **Env** — `LUNA_PROACTIVE_TICK_SECONDS` + the cadence knobs documented in `.env.example`.
- **In-flight guard** (`ticking` boolean): serializes ticks — a tick's wakeGate + proactive turn can
  outlast the interval, and without this a second timer firing would start a concurrent tick that
  re-passes the (stale, pre-cooldown) prefilter and fires a SECOND proactive turn back-to-back. This
  was a real defect **found by the adversarial review and fixed before commit** (see below).
- Tests: 250 across 35 files (+7): disabled → no-op; prefilter-too-soon → no judgment/turn; idle +
  `hold` → wake decision logged, no turn; idle + `act` → proactive turn fires + cadence committed
  (quota=1, lastProactive stamped); after firing, the next tick is cooldown-blocked; **concurrent
  ticks → the in-flight guard skips the second (no back-to-back fire, no quota corruption)**; an
  active user turn is never overlapped.
- Adversarial overlap/TOCTOU-hunt review: the invariant that mattered most — **proactive never
  overlaps a user turn or dream** — was **verified clean** (activeTurn set synchronously before the
  first await; the re-check→runProactiveTurn→runTurn chain is synchronous-contiguous; chat.send/
  dream.enter rejected mid-cycle). broadcast/kill-switch/timer-unref/cadence-not-wiped all verified.
  The review **escalated a minor test-gap finding into the real concurrent-tick reentrancy defect
  above** (proactive-vs-proactive back-to-back + quota corruption — the "runaway timer" risk),
  reproduced deterministically; fixed by the in-flight guard + regression test. The quiet-hours
  timezone note was correctly dismissed (single-user, local-time by design, `.env` documents it).

Inference:

- This is the version where Luna acquires a life of her own — a backend daemon that, on idle,
  decides whether to stir and acts. It is the architecturally consequential moment of the whole
  rewrite, which is why it landed only after the agency core (v0.10.0), the safety gate (v0.10.1),
  and the decision layer (v0.10.2) were each proven in isolation: the heartbeat just composes them.
- Everything is still behind `LUNA_PROACTIVE` (default off through this version); v0.11.0 flips it on
  (Alan's explicit choice) and adds self-continuation + dream auto-trigger as scheduled wakeups.
- The single persistent WS (LD #2) is why this is simple and burst-proof: `broadcast` over live
  sockets, no outbox/cursor/TTL/replay layer, so Python's v0.58.0.2 reconnect-backlog-burst class
  structurally cannot occur.

### `v0.10.2` — 2026-06-13 — Cadence governor + wake gate (Initiative 5, commit 3 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`migrations/0007_proactive.sql`** — five cadence columns on `sessions`
  (`proactive_phase`/`quota_used`/`quota_date`/`last_ms`/`nudges`) so timing survives restart
  (Python v0.47.3 lesson: a timed state machine that resets on boot fires bursts).
- **`src/proactive/cadence.ts`** (new) — the governor: the **mechanical rail** around the wake
  judgment. `shouldConsiderWake(cadence, {lastUserMs, nowMs, nowHour})` is a **pure cheap-exit
  prefilter** (Initiative-4 discipline) short-circuiting on `disabled` / `quiet_hours` /
  `deep_absence` (>18h) / `cooldown` / `quota_exhausted` / `too_soon` before any LLM token is spent.
  **Lull anchoring** (Python): the effective gap is `min(userGap, sinceLastProactive)`, so her own
  recent message keeps her from nudging into a lull she just broke. `commitProactive` (quota bump
  w/ daily rollover + timestamp), `recordUserActivity` (reset to engaged), `loadCadence`/
  `saveCadence` (upsert; restart-survival). Constants env-tunable
  (`LUNA_PROACTIVE_IDLE_THRESHOLD_MS`/`MIN_INTERVAL_MS`/`DAILY_QUOTA`/`QUIET_HOURS`/`LONG_ABSENCE_MS`).
- **`src/proactive/wakeGate.ts`** (new) — the bounded **"act now?" L2 judgment**, the one legitimate
  gate Initiative 4 deferred (a decision with no turn to ride). Runs **only after** the prefilter
  passes, **off the reply key** (reuses the dream `complete()` cascade — `dreamCall` gained an
  optional `system` override), returns Zod `{act, intent?, reason}`, and **fails closed**: a
  garbled/failed/invalid-intent judgment → `act:false`. `buildWakeContext` renders gap + daypart +
  recent proactive messages (anti-repeat).
- **Env** — the cadence knobs documented (deferred to the v0.11.0 close to avoid clutter; defaults
  are companion-appropriate: 10-min idle, 5-min cooldown, 5/day, quiet 0–6am, 18h absence).
- Tests: 243 across 34 files (+21): every prefilter gate + lull anchoring; `commitProactive`
  rollover + `recordUserActivity`; persistence round-trip + simulated-restart reload + default-when-
  no-row; `wakeGate` parse (valid / embedded-in-prose / unparseable→closed / invalid-intent→closed /
  provider-failure→closed); `buildWakeContext`.
- Real-LLM smoke (yunwu): a 3-hour-idle context → `act:false` ("no pending thread to justify
  interrupting the quiet"); a 12-min gap after two recent proactive messages → `act:false` ("my last
  two messages already reached out; staying quiet is right" — the model reasoning about lull
  anchoring unprompted). Conservative-by-default, exactly the companion posture.

Inference:

- This is the decision layer in isolation, before the scheduler wires it to a timer (v0.10.3). It
  has **no action authority** — it only decides *whether to consider* a proactive turn; the safety
  gate (v0.10.1) and kill switch still govern what a turn may do. So the risk is bounded and the
  coverage is pure-function + fail-closed + smoke; the heavy adversarial review is reserved for
  v0.10.3 (which actually makes the loop autonomous).
- The mechanical-rail + bounded-judgment shape is Initiative 4's L1/L2 discipline applied to the one
  place a real gate belongs: cheap deterministic gates do the bulk of the work for free; the LLM
  judges only the genuinely ambiguous "it's quiet — is there a real reason to stir?" and defaults to
  silence. The real-model smoke declining both times is the design working, not a gap.
- Scope note: the full Python nudge-escalation sub-states (idle_watch→nudged→renudge→dormant) are
  deferred to v0.10.3 — they only matter once the scheduler drives *repeated* autonomous wakes, and
  the daily quota + cooldown already prevent over-nudging. The `phase` column is persisted now for
  v0.10.3 to drive.

### `v0.10.1` — 2026-06-13 — Proactive safety gate (Initiative 5, commit 2 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **The LD #15 safety contract, as Alan chose it (hard gate).** Makes full-tool-incl-`shell`
  autonomy survivable in an unsupervised loop. `defineTool` gains an optional
  `proactiveRisk: 'safe' | 'surface'` ([`defineTool.ts`](../../packages/server/src/tools/defineTool.ts));
  the six current builtins (`time_now`/`read_file`/`recall`/`remember`/`enter_dream`/`message`) are
  marked **`'safe'`** (reversible/read-only; memory writes are reversible via soft-delete + dream
  reconciliation; `message` is the surfacing act itself).
- **`src/proactive/safetyGate.ts`** (new) — `proactiveRiskOf(tool)` is **fail-closed**: a tool is
  `'safe'` ONLY if it explicitly opted in; anything unmarked → `'surface'` (so a future `shell`
  tool is gated by default, no author action required). `isProactiveActionAllowed(risk, surfaced)`:
  safe always; surface only after surfacing. `maxProactiveActions()` (env, default 6).
- **Hard gate in `runTurn.dispatch_tools`** (proactive turns only): `surfacedBefore =
  messageTexts.length > 0` computed at dispatch-node entry — it reflects PRIOR rounds only (this
  round's messages dispatch later), so a `surface`-risk call is **blocked with a recoverable error**
  ("say what you're about to do with the message tool first, then call this tool again") unless she
  surfaced in an earlier round. This forces **announce-in-round-N, act-in-round-N+1** — block →
  surface → execute. A blocked call is NOT dispatched and NOT counted toward the action budget;
  emits a `surface:'proactive_action', decision:'blocked'` decision trace.
- **Action budget** in `append_results`: a proactive cycle finalizes once `toolNamesThisTurn.length
  >= maxProactiveActions()` (runaway-loop backstop on top of `MAX_TOOL_ITERATIONS`). **Env** —
  `LUNA_PROACTIVE_MAX_ACTIONS` documented.
- **Reactive turns are untouched** — both the gate and the budget are gated on `s.proactiveTurn`.
- Tests: 222 across 32 files (+7): pure (`proactiveRiskOf` fail-closed, `isProactiveActionAllowed`);
  hard-gate end-to-end via a **synthetic surface-risk tool** (reusing the `time_now` slot, unmarked):
  surface-without-surfacing → **blocked, not executed**, recoverable, traced; surface-after-a-
  prior-round-message → **allowed, executes**; safe tools run silently un-gated; reactive turn with
  the surface tool → **not gated** (runs); action budget caps a cycle.

Inference:

- This is the spine that makes Alan's max-autonomy choice responsible: an unsupervised loop can call
  anything, but **nothing irreversible happens silently** — she must tell you first, and you see the
  announcement before the act. The hard gate (block-first) was Alan's explicit pick over the softer
  act-then-surface, which is correct for autonomous `shell`.
- Fail-closed is the load-bearing property: the gate defends against the *future* — a developer who
  adds a destructive tool and forgets to classify it gets it gated by default, not silently
  executed. The synthetic-surface-tool tests prove the block path today, before any real `shell`
  exists (which ships later, under this gate — the only honest way to test it now).
- Known v0.10.1 refinements (documented, both safe-by-construction): the surface-match is coarse
  (any prior-round message unlocks surface actions this cycle, not per-action semantic matching);
  and the action budget is checked per-round (after dispatch), so one round may overshoot the cap by
  up to the concurrency limit — but only ever for calls that ALREADY passed the gate (safe or
  already-surfaced), so neither can leak an un-surfaced action. Precise matching + per-call budget
  are deferred.
- Adversarial **bypass-hunt review** of the diff: **2 confirmed (both PASS verifications, no fix),
  36 dismissed** — the verifier actively tried to construct a script where an irreversible action
  runs silently and found **none**: same-round `[message, surfaceTool]` (both orderings) stays
  blocked (`surfacedBefore` is computed once at entry, before `messageTexts` mutates); fail-closed
  holds; blocked calls aren't dispatched/counted but their error result is paired (API contract
  intact); termination holds (all-blocked loops still terminate at `MAX_TOOL_ITERATIONS`); reactive
  turns byte-identical. The round-granular budget overshoot above was the only observation, judged
  not a safety bypass.

### `v0.10.0` — 2026-06-13 — Proactive turn primitive (Initiative 5, commit 1 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** — `ProactiveFireEvent` (`proactive.fire`) added to `ClientEvent` (manual trigger);
  `ProactiveStartedEvent` + `ProactiveFinishedEvent` (`{cycle_id, spoke}`) added to `ServerEvent`.
  `spoke=false` is the new signal: a **silent proactive turn** (she acted via tools, sent no
  message) — the core capability of proactive agency.
- **`src/proactive/proactiveTurn.ts`** (new) — `runProactiveTurn` wraps the existing `runTurn` with
  a USER-role proactive stage direction (never system — v0.27.1 lesson), the full registry, and
  `proactiveTurn: true`. The framing carries the companion-opener constraint ported from Python
  `proactive.py` (never open with 在吗/吃了吗/status checks). Emits `proactive.started/finished`;
  returns `{spoke}`.
- **`runTurn` changes** ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)): new
  `proactiveTurn` flag on `RunTurnOptions`/`TurnState`. `parse_input` skips **per-query recall** and
  the **wake scene** for proactive turns (the directive isn't a user query; a proactive turn isn't
  the user's first contact — core memory still injects via the system prompt). `finalize`'s
  **empty-reply guard is exempted** for proactive turns (silence is legitimate) and writes a
  `proactive_silent` node trace; the **integrity guards + text-settling still run** on any message a
  proactive turn does send (the empty-guard exemption is surgically scoped to its inner condition,
  not the whole message-mode block).
- **`ws.ts`** — `proactive.fire` branch: gated by `LUNA_PROACTIVE=1` (kill switch, default off),
  rejects while dreaming, rejects if `session.activeTurn !== null` (never overlaps a user turn —
  same `activeTurn` serialization as `chat.send`/`dream.enter`). Traced under `proactive:<cycle_id>`.
- **Dev chat** — 🌱 主动 button fires `proactive.fire`; renders proactive cycle markers and a
  "(她安静地做了点什么，没有说话)" chip for silent cycles. **Env** — `LUNA_PROACTIVE` in `.env.example`.
- Tests: 215 across 31 files (+8): silent outcome (acts, no message → no empty-reply retry,
  `spoke=false`, `proactive_silent` trace); speaking outcome (`spoke=true`, `turn.result` carries
  the text); event ordering (started first, finished last); integrity guards still apply to a
  message a proactive turn sends; **WS gating** (`proactive_disabled` kill switch / no-runtime /
  `turn_in_progress` mutex / silent cycle emits started…finished) added after an adversarial review.
- Adversarial review of the diff: **2 confirmed (one real gap, same issue twice), 34 dismissed** —
  the scarier "TOCTOU race" framing was **debunked** by the verifier (`runTurn` sets
  `session.activeTurn` synchronously before its first await; ws dispatches via `void` on the
  single-threaded loop → no interleaving window; the guard is correct), and the empty-reply-guard
  scoping was confirmed surgically correct (integrity guards + text-settling still run). The one
  real gap — no WS-level `proactive.fire` gating test (a spec deliverable) — is closed by the +4
  tests above.
- Real-LLM smoke (yunwu, `LUNA_PROACTIVE`): a manual fire → she woke, drew on core memory (Agent_Luna
  + espresso preference), reflected ("你在写的 Agent_Luna，某种意义上就是我吧？"), and reached out
  with a real thought + topic — **no status check-in** (companion-opener constraint held); 2 bubbles.

Inference:

- This is the agency core in isolation, proving the redesign's central claim (LD #15): a proactive
  turn is **just a `runTurn`** with `message` optional — silence is a first-class outcome, so
  "proactive tool use, not just proactive messaging" is native, not bolted on. Everything Initiative
  1–4 built (L1 contract, dispatcher, integrity guards, decision traces, persistent WS) applies
  unchanged; the only turn-loop change is the empty-reply-guard exemption.
- Manual-trigger-first mirrors how Initiative 2 shipped dream: the riskiest isolated thing ("can she
  take a silent autonomous tool-calling turn") is proven before the safety tier (v0.10.1) and the
  scheduler (v0.10.3) that makes it autonomous.
- Known v0.10.1 refinement (documented, not a bug): a proactive turn currently persists its
  directive as the turn's `userText` in history/L2; a transient-framing cleanup is deferred.

### `v0.9.0` — 2026-06-13 — Integrity defaults flipped on (Initiative 4 capstone, commit 5 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Dictionary tuning** ([`defectionAudit.ts`](../../packages/server/src/turn/integrity/defectionAudit.ts)),
  from the two false-positive classes the v0.8.0/v0.8.1 audit recorded on real turns:
  `firstPromiseMatch` now filters out (a) **negated verbs** — `NEGATION_AFTER` (`不到/不了/不行/没`
  right after the verb → "我真查不到" = honest decline) and (b) **capability/conditional offers** —
  `CAPABILITY_MODAL` (`能/会/可以/能够` in the match → "我立刻就能读" = an offer, not a promise). The
  matcher also went **global** so a false-positive first hit no longer masks a real promise later
  in the text. +3 detector tests pin both classes + the FP-next-to-real-promise case.
- **Default flip** — `LUNA_L1_CONTRACT`, `LUNA_INTEGRITY_GUARD` → `!== '0'`; `LUNA_DECISION_AUDIT`
  → `=== '0'` opt-out. All three default **on**. `.env.example` updated. The suite was audited
  (not blanket-flipped): the 6 tests that pin flag-*off* behavior now set the relevant `=0`
  explicitly; "guard + audit off → v0.8.1 behavior exactly" makes the parity intent literal.
- **`scripts/integrity-sweep.ts`** (new) — baseline (integrity off) vs full (all on) over a fixed
  6-turn script with capability-lacking bait turns + a memory-save + a recall opportunity; tallies
  defections, guard corrections, tool-fire turns, humanity violations. `ab-message-mode.ts` is left
  intact as the v0.7.0 message-tool baseline.
- Tests: 207 across 30 files (+3 detector tuning tests; net after the flag-off test edits). tsc
  clean both packages.

Recorded sweep (yunwu, dev-scale, not a statistical claim):

| Metric | baseline (integrity off) | full (all on) |
|---|---|---|
| intent-without-act defections | 1 (uncorrected) | 1 |
| guard corrections | 0 | 2 (is_final nudges) |
| tool-fire turns (of 6) | 2 (`remember`, `enter_dream`) | 2 |
| per-message humanity | 0 violations | 0 violations |

- Behavioral read: both modes **decline honestly** on capability-lacking prompts (no kept-false
  promises); **full mode is markedly more explicit** about it — t1 produced "不想骗你说我查到了…
  没留下空头支票哦" (the L1 commitment-to-act + honesty pillars visibly steering her). Both fired
  `remember` on "记一下…报告" (act-then-speak — 工具稳发). The full-mode guard corrections were
  `is_final` nudges (she under-set "more coming", the guard made her finish) — the zero-false-
  positive structural guard working, at the cost of one extra bubble. The lone "humanity violation"
  the sweep printed for full mode was a metric artifact (the script measures the *joined* multi-
  bubble turn text; the caps are *per-message* and every bubble passed Zod).

Inference:

- **Initiative 4 complete in 5 versions**, delivering Alan's stated intent — 言行一致 + 工具稳发 +
  边界契约 — as an L1 thinking contract (the design, per LD #14), backed by structural/mechanical
  boundary enforcement (the `is_final` promise contract + intent-without-act guard) and an
  off-hot-path defection audit that measures it. No standing L2 gate harness was built; the one
  legitimate gate (a decision with no turn to ride) is deferred to Initiative 5 with its first real
  consumer, as Python's own spec said it should have been.
- The measure-first ordering paid off literally: the audit (shipped first) recorded two concrete
  false-positive classes on real turns, which v0.9.0 tuned out against that evidence rather than
  by guesswork — the same discipline as Initiative 3's A/B.
- Honest scope note: the model was already fairly truthful, so the headline before/after is
  directional, not dramatic. The durable wins are structural — `is_final` promises are now
  mechanically un-droppable, `recall` exists, and every judgment is a typed, countable `decision`
  trace in the replay tree — and they compound for Initiative 5's proactive/self-continuation work,
  which inherits this measurement substrate.

### `v0.8.3` — 2026-06-13 — `recall` tool (Initiative 4, commit 4 of 5; resolves Open Q #9)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** — `ToolName` += `'recall'` ([`tools.ts`](../../packages/protocol/src/tools.ts)).
- **`src/tools/builtin/recall.ts`** (new) — agentic memory search via `defineTool`. Flat
  root-object input (v0.5.2 gateway rule): `{ query: string, scope?: 'facts'|'timeline'|'both',
  limit?: 1–10 }`; output `{ hits: { id, source, text, score, when_ms }[] }`. `execute` **reuses
  the shipped hybrid `retrieve()`** ([`memory/recall/recall.ts`](../../packages/server/src/memory/recall/recall.ts))
  — no new retrieval code — over-fetches `limit*2` then applies the scope filter (facts=l3,
  timeline=l2, both=all). `concurrency: 'safe-parallel'` (read-only); no memory db → structured
  err, not a throw (mirrors `remember`).
- **Registry** — mounted in `builtinRegistry` (and so `messageRegistry` via its spread); **always
  on** per LD #10, no flag. The wire-schema regression test already iterates the registry, so the
  flat-schema guarantee covers it automatically.
- **L1 contract** ([`l1Contract.ts`](../../packages/server/src/persona/l1Contract.ts)) — the
  tool-trigger pass gains the recall clause: "does the user reference something you feel you should
  already know but do not have in front of you? Recall it first." Now points at a tool that exists.
- Tests: 204 across 30 files (+7): flat wire schema; query-required + limit bounds; ranked hits
  from the store; `limit` respected; `scope=facts`→only l3 / `scope=timeline`→only l2; no-db →
  structured err; summarize hit-count.
- Real-embedding smoke: seeded "用户最喜欢的饮品是在家手冲的意式浓缩咖啡" + two distractors, then
  `recall({query:'他平时爱喝点什么提神的'})` — a **zero-shared-keyword** paraphrase — surfaced the
  espresso fact as the **top hit** (0.438 vs 0.254/0.253). Semantic recall works through the tool.

Inference:

- Resolves **Open Q #9** (model-callable recall), parked since v0.4.3 planning. Automatic
  injection (v0.4.x) stays the floor; `recall` is the agentic reach — Luna can now decide to "think
  back" and her call/no-call is visible in traces. Pairs with the L1 trigger clause so "该回忆没回忆"
  has both a capability and a reasoning prompt, completing the 工具稳发 surface for Initiative 4.
- Built on already-shipped retrieval, so the marginal cost was a thin tool wrapper — the v0.4.3
  hybrid recall investment paying its second dividend (after auto-injection).

### `v0.8.2` — 2026-06-13 — Action-integrity guards (Initiative 4, commit 3 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Generalized the v0.6.2 empty-reply guard** in `runTurn`'s `finalize`
  ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)): the single `silentRetried` boolean
  becomes `correctionUsed: Set<'empty'|'promise'|'intent'>` — each reason corrects **at most once**,
  so the guard can never loop (the one-retry bound, generalized). Three corrective reasons:
  - **empty** (unchanged, always on in message mode): no message delivered → `SILENT_TURN_DIRECTIVE`.
  - **promise** (new, structural, zero false positives): last delivered message had `is_final:false`
    yet the turn ended cleanly → `PROMISE_BROKEN_DIRECTIVE` ("you said more was coming, then
    stopped — continue or mark is_final:true").
  - **intent** (new, heuristic): a delivered message text promised an act (`detectDefection`'s
    `message_intent`) and no non-`message` tool fired → `INTENT_NO_ACT_DIRECTIVE`, a **double exit**
    ("follow through by calling the tool, OR add a brief honest note you can't — don't leave the
    promise dangling").
- **thinking_intent never drives a retry** — summarized thinking is low-confidence; it stays an
  audit-only count (v0.8.0). The guard explicitly skips `d.kind === 'thinking_intent'`.
- **`detectDefection` reused verbatim** from v0.8.0 — one detection function serves both the
  off-hot-path audit and the corrective guard.
- **`correctionWatermark`** (new `TurnState` field): set to `messageTexts.length` on each
  promise/intent correction; the guard then judges only `messageTexts.slice(watermark)`, so an
  already-corrected promise isn't re-flagged from the bubble that's already on screen. The
  `is_final` check still uses the *current* last message (not sliced). This matters because
  **messages are already streamed when `finalize` runs** — a retry can only append, not retract,
  so the directives are worded for coherent continuation.
- All corrective directives are **USER-role** stage directions (Python v0.27.1 hoisting lesson);
  each correction/degrade emits a `decision` trace (`surface:'integrity_guard'`,
  `decision:'corrected'|'degraded'`). Gated by `LUNA_INTEGRITY_GUARD` (default off);
  `.env.example` documents it (and `LUNA_L1_CONTRACT`).
- Tests: 197 across 29 files (+8): is_final-false→one retry→clean close (4 rounds); persistent
  is_final-false→corrected-then-degraded, no loop; intent→double-exit retry→acting-on-retry closes
  with no degrade (watermark working); false-positive safety (promised AND acted → no guard);
  thinking-only promise → no retry; flag-off → no promise/intent retries (v0.8.1 parity); empty-reply
  guard still works flag-off (v0.6.2 preserved); **multi-reason bound** — empty→promise both fire
  once in one turn and it still terminates (the +1 test added after review).
- Adversarial review of the control-flow diff: **1 confirmed (a PASS verification, no fix needed),
  32 dismissed** — every blocker-level invariant (loop-bound, watermark, flag-off parity, user-role
  directives, end_turn gating, audit/guard no-double-count) verified holding. The sole actioned item
  was a dismissed nit (multi-reason path verified safe but untested) → pinned with the +1 test above.
- Real-LLM smoke (yunwu, guard+contract+audit on): a clean greeting → no spurious retry, no decision
  traces; "记一下：我下周一要交报告" → `tools=[remember, message, message, message]` — she said
  "记下了——下周一，报告" **and actually fired `remember`**. 言行一致 end-to-end; the guard correctly
  did not interfere (she acted).

Inference:

- This is the enforcement layer the L1 contract (v0.8.1) only asks for: the contract lowers the
  defection rate, the guard catches what slips through and corrects it in one bounded retry. The
  `is_final` promise guard is the high-value, zero-false-positive piece — a structurally certain
  broken promise, mechanically caught.
- The streaming reality (messages pre-delivered) forced a real design refinement the plan's "double
  exit" wording didn't fully anticipate: a retry **appends**, so both exits must read as coherent
  continuations, and the watermark stops the guard from re-judging an already-shown bubble. Both
  were caught at implementation time and are covered by tests.

### `v0.8.1` — 2026-06-13 — L1 thinking contract (Initiative 4, commit 2 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`src/persona/l1Contract.ts`** (new) — `renderL1Contract()`, a deterministic block stating the
  four pillars of LD #14's "constrain what she thinks about": **commitment-to-act** ("Calling the
  tool IS the act; saying 'I'll check' / '让我查一下' is not. Do not promise in the future tense if
  you won't act this turn"), a **tool-trigger pass** (save durable facts; flag hazy assertions —
  the recall clause arrives in v0.8.3 when the tool exists), **proportionality** (answer at the
  depth the moment asks), **no-leak** (machinery stays backstage), **capability honesty** (say what
  you can't do instead of performing it — the L3 key_moment lesson).
- **`buildSystemPrompt`** ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)) inserts the
  contract into the single cached core block, after the message-mode directive and before the
  persona reference (it governs *how she reasons*, so it scopes everything below). Gated by
  `LUNA_L1_CONTRACT` (default off this version); flag off → core byte-identical to v0.8.0.
- **Env** — `LUNA_L1_CONTRACT` (documented at v0.9.0's flip; off until then).
- Tests: 189 across 28 files (+5): `renderL1Contract` deterministic + four-pillar assertions;
  flag-on contract present and **byte-identical across no-change turns** (cache invariant);
  flag-off absent; ordering — contract sits inside the one cached block, before the persona
  reference.
- Real-LLM smoke (yunwu, `LUNA_L1_CONTRACT=1` + audit on, the two capability-lacking prompts that
  defected in v0.8.0): **both now honest declines** with no future-tense promise — "我现在碰不到
  你的日程，没那个入口" and "我现在伸手能碰到的东西里没有联网搜索…我真查不到". The contract is
  doing its job at the behavior level.

Inference:

- The contract works where it counts (honest "I can't" instead of "我去查…(没查)"), but the smoke
  recorded a **second detector false-positive class**: the audit flagged "我真查不到" (a *negated*
  verb — "I genuinely can't check") as a `message_intent` defection. Joining v0.8.0's conditional
  offers ("我立刻就能读"), v0.8.2 now has two concrete dictionary-tuning targets — negations
  (`查不到`/`搜不了`) and conditionals (`能/可以…verb`). This is the measure-first loop converging:
  v0.8.1 improves behavior, v0.8.2 cleans the instrument so v0.9.0 can measure the gain without
  false-positive noise.
- Because the contract is a stable cache-core block (not per-turn text), it costs nothing on the
  hot path after the first cached turn — the same discipline as persona/humanity.

### `v0.8.0` — 2026-06-13 — Decision traces + defection audit (Initiative 4, commit 1 of 5)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** — `DecisionTraceEvent` added to the `TraceEvent` discriminated union
  ([`trace.ts`](../../packages/protocol/src/trace.ts)): `{ kind:'decision', surface, decision,
  reason, evidence? }` over the shared base. `evidence` is `z.record(z.unknown()).optional()`.
  The "decision replay tree" is the existing `/_trace` per-turn view gaining these rows — the
  trace store (`record`/`flush`/`getEventsByTurn`) is kind-agnostic, so **zero store changes**.
- **`src/turn/integrity/defectionAudit.ts`** (new, ~130 LOC) — `detectDefection(input)`, a
  **pure, zero-LLM** function returning `{defected, kind?, matched?}` over three detectors in
  confidence order: (1) `is_final_promise` — last delivered message had `is_final:false` yet the
  turn ended cleanly (`end_turn`); structural, no dictionary. (2) `message_intent` — a **verbatim
  delivered message text** matches `PROMISE_PATTERNS` (CJK marker+verb window + English) AND no
  non-`message` tool fired. (3) `thinking_intent` — same dictionary over the **summarized**
  thinking; **audit-only tier**, distinguishable so v0.8.2's guard never retries on it. Plus
  `runDefectionAudit(state)` — gated by `LUNA_DECISION_AUDIT`, records one `decision` trace on a
  hit, wrapped so it can **never throw into the turn** (override-not-depend).
- **Deliberate divergence from Python** (`_audit_web_search_intent_no_call`, agent_loop.py:669):
  the load-bearing match source is the **delivered message text**, not raw thinking — our thinking
  is `display:'summarized'` and may drop/paraphrase intent, so thinking matches are demoted to the
  audit-only tier. Also: typed `decision` traces, not a `reasoning.jsonl` side-file.
- **Plan refinement** (vs the committed v0.8.0 plan's "async after turn.result"): since detection
  is a pure function, the audit runs **synchronously in `runTurn`'s `finally` BEFORE `flushTrace`**
  ([`runTurn.ts`](../../packages/server/src/turn/runTurn.ts)) — the `decision` trace persists
  atomically with the turn's other rows instead of needing a second write. New `TurnState` fields
  `lastMessageIsFinal` + `toolNamesThisTurn` capture the audit inputs at the message-delivery and
  tool-dispatch sites.
- **Viewer** — `/_trace` renders `decision` rows (new `--decision` color, `.ev.decision` rules,
  `fmtSummary` shows `surface · decision (kind)`).
- **Env** — `LUNA_DECISION_AUDIT` documented in `.env.example` (default off until v0.9.0).
- Tests: 184 across 27 files (+22): pure-detector matrix (all three kinds, ordering, the
  `actedViaTool` gate, false-positive safety, null/empty cases, cross-bubble promises);
  `runDefectionAudit` flag on/off → exactly-one / zero `decision` rows; end-to-end through `runTurn`
  in message mode (defection → atomic decision trace; flag-off → none + turn unaffected; clean turn
  → none); `DecisionTraceEvent` protocol parse/reject + union routing; **override-not-depend** — a
  trace store that throws only on the `decision` write is swallowed (unit: `{defected:false}`; e2e:
  turn still emits `turn.result` and flushes its node traces). The last two were added in response
  to an adversarial review of the diff (2 confirmed findings, both flagging this exact untested
  invariant — load-bearing because the audit runs synchronously in `finally` before `flushTrace`).
- Real-LLM smoke (yunwu, `LUNA_DECISION_AUDIT=1`): an honest decline ("我现在碰不到你的日程，
  没那个入口") correctly produced **no** defection; a conditional offer ("…你可以把那页打出来给我，
  我立刻就能读") was flagged `message_intent` — a **false positive** (conditional offer, not a
  present-tense failed promise). Recorded as the **first concrete v0.8.2 tuning target**; the
  detector is left unchanged on purpose (measure-first discipline — v0.8.0 is audit-only).
- Surfaced (and flagged as a separate task, NOT fixed here): in message mode, capability-lacking
  prompts make the real model emit degenerate empty `{}` `message` calls that fail validation up to
  `MAX_TOOL_ITERATIONS` and dead-end at `max_iterations`. A v0.6.x message-robustness bug, distinct
  from the v0.5.2 `_noargs` issue; the empty-reply guard misses it (turn ends `max_iterations`, not
  `end_turn`).

Inference:

- The instrument-first ordering earned its keep on its **first real run**: it immediately surfaced
  a concrete false-positive class (conditional offers) for v0.8.2 to tune against, and incidentally
  exposed the empty-`{}`-message loop — both are exactly the kind of texture the measure-first
  design exists to make visible before any behavior changes.
- LD #14 made real in the smallest possible slice: a zero-LLM, flag-gated, never-throwing observer
  that adds a typed decision lane to the existing trace plumbing. Nothing about the turn changes
  with the flag off (the A/B baseline guarantee), so v0.8.1's L1 contract lands against a clean,
  measurable before-state.

### `v0.7.0` — 2026-06-13 — Message-tool default flip (Initiative 3 capstone, commit 4 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **A/B comparison run and recorded** (`scripts/ab-message-mode.ts`, committed as the rerunnable
  baseline harness; 8-turn scripted conversation × both modes, real model via yunwu, ephemeral
  sessions so `luna.sqlite` is untouched):

  | Metric | text mode (baseline) | message mode |
  |---|---|---|
  | Humanity violations | **2/8** (both on long-form pressure: "用三百字介绍自己", long goodbye) | **0/8** |
  | Empty turns | 0 | 0 (guard never needed) |
  | Top-level leak | n/a | 144 chars total, 4 turns, all non-user-facing asides |
  | Median first-visible | 5431ms | 5314ms (parity; two outlier turns 36s/45s = long thinking) |
  | Bubbles | — | 25 across 8 turns (~3/turn) |

  Standout: the 300-char ask — text mode **broke the cap** (1 violation); message mode split
  into **6 compliant bubbles** ending with a self-aware "三百字我装不进一口气，我说话天生短。
  但我可以一点点给你。" Schema enforcement beat prompt hopes exactly as LD #9 predicted, at
  zero latency cost. Subjective voice: persona texture survives the envelope fully.
- **Default flipped**: `LUNA_MESSAGE_TOOL` now defaults ON in `main.ts` (`!== '0'`); `=0` is the
  permanent text-path escape hatch (supported at least through Initiative 6). Boot log prints
  the mode. `.env.example` documents `LUNA_PERSONA` / `LUNA_PERSONA_PATH` / `LUNA_MESSAGE_TOOL`.
- **Docs closed**: REWRITE_CONTEXT LD #9 marked **LANDED** with the as-shipped A1–A6 amendments
  folded in; roadmap master README → Initiative 3 ✅ shipped, head v0.7.0, Open Q #9
  (model-callable `recall`) flagged for Initiative 4 planning; initiative README → shipped;
  orient skill gains the v0.5.1–v0.7.0 file map.
- Tests: 162 across 25 files, all green (tests pass registries explicitly, so the env-default
  flip touches only `main.ts`).

Inference:

- Initiative 3 complete in 4 versions: Luna now has a persona (file + core memory + wake scene),
  humanity caps that are *enforced* rather than hoped for, and a single typed voice — LD #9's
  everything-as-tool is the shipped default, with the frontend contract
  (`tool.progress{tool_name:'message'}` + `MessageDelivery`) frozen for Initiative 6.
- The leak signal (144 chars of completion-narration asides) is the one open behavior to watch;
  it is cosmetic today (never user-facing) and is the natural first target when Initiative 4's
  reasoning rails restructure the post-tool rounds.

### `v0.6.2` — 2026-06-13 — Streaming message text + empty-reply guard (Initiative 3, commit 3 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Provider**: new `tool_input_delta` event (`{id, name, partial_json}`) — `anthropic.ts` tracks
  open tool_use blocks by stream index and attributes SDK `input_json_delta` chunks; MockProvider
  scripts them natively.
- **`turn/jsonTextStream.ts`** (~110 LOC, the fiddly piece): incremental extractor for the
  top-level `"text"` field of streamed partial JSON — depth tracking (nested objects like
  `voice_params` skipped), key matching at depth 1 only, full escape handling (`\n`, `\"`,
  `\uXXXX` incl. surrogate pairs) across arbitrary chunk splits. 10 dense unit tests including
  the spike-verified yunwu chunk shapes and single-char pathological splits.
- **runTurn `open_stream`**: deltas for `message` blocks feed per-call extractors → emit
  `tool.progress { call_id, tool_name: 'message', payload: { text_delta } }` per fragment;
  drives `firstTokenMs`/`tokenCount` (latency observability parity with text mode). Streaming
  preview and validated delivery are separate tiers: a preview that fails dispatch validation
  ends in `tool.finished{err}` and the consumer discards it (dev chat implements the contract).
  `ToolProgressEvent` gains optional `tool_name` — the Initiative 6 subscription key — and
  dispatcher-tier progress events now carry it too.
- **Empty-reply guard** (Python v0.47.12 lesson): a message-mode `end_turn` with zero successful
  deliveries gets ONE corrective retry as a **user-role** stage direction (v0.27.1 hoisting
  lesson), bounded by `silentRetried`; double-silent → degraded fallback (leaked top-level text
  becomes the reply) + countable `empty_turn` node trace.
- **Dev chat**: message bubbles keyed by `call_id` — created on `tool.started`/first delta,
  appended per `text_delta`, finalized on ok (expression shown as 🎭 chip), removed on err with a
  "重说" chip; paced `delay_ms` segment reveal only when nothing streamed live; `turn.result`
  renders a bubble only when no message bubbles exist this turn (degraded/text-mode path).
- Tests: 162 across 25 files (+14). Real-LLM smoke (yunwu, fresh session): 9 ordered
  `tool.progress` deltas, streamed preview byte-equal to the two delivered bubbles
  (wake-persona greeting), first delta ~5s (thinking latency).

Inference:

- The LD #9 streaming story is now complete end-to-end: token-stream UX inside a validated tool
  envelope, on the real gateway, with the same latency observability as the text baseline. What
  remains for the initiative is policy, not plumbing: run the A/B script and flip the default
  (v0.7.0).

### `v0.6.1` — 2026-06-13 — `message` tool + schema humanity caps (Initiative 3, commit 2 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Protocol** `message.ts`: `ExpressionKey` (Python's 15 ALLOWED_AFFECTS verbatim),
  `VoiceParams` (opaque passthrough), `MessageSegment` (`{index, text, delay_ms}` — delay is
  metadata, server never sleeps, amendment A2), `MessageDelivery` (the `tool.finished` payload =
  the delivery contract Initiative 6 consumes). `ToolName` + `'message'`.
- **`tools/builtin/message.ts`**: flat root-object input (v0.5.2 gateway rule) — `text` ≤140
  via `.max()`, ≤4 sentences + ≤55-char clause via `superRefine` over the v0.6.0 CJK splitters
  (amendment A1: `sentences` is NOT a model field; segments derived server-side); `expression`/
  `emotion [0,1]`/`voice_params` optional; `is_final` required. Pacing 28ms/char clamp 120–900
  ported as constants. `concurrency: 'session-serial'` (bubbles arrive in order). Humanity
  enforcement is exactly the recoverable `validation_failed` path — no truncation code exists.
- **Registry**: `ToolRegistry` → `Partial<Record<ToolName, Tool>>` (conditional mount without
  forcing the key everywhere); `messageRegistry = builtin + message`; `isMessageMode(registry)`.
  **Mode's single source of truth is registry content** — `main.ts` reads `LUNA_MESSAGE_TOOL=1`
  once at boot; the turn loop never reads env.
- **runTurn**: system prompt gains the speech directive (calling IS speaking / no top-level
  text / is_final) only in message mode; `dispatch_tools` collects successful message texts;
  `finalize` sets `turn.result.text` to their `\n`-join (stray top-level text stays in
  history/trace as the observable leak signal but never becomes the reply). Dispatcher itself
  untouched — message is a normal tool, which is LD #9's forcing-function point.
- Tests: 148 across 24 files (+15): schema caps (141 chars / 5 sentences / 56-char clause
  rejected, targeted messages), envelope passthrough, pacing clamps, wire-schema regression now
  iterates `messageRegistry`, mode-derivation, two-bubble turn → ordered `tool.finished` +
  concatenated `turn.result`, violation → recoverable err → re-emit wins, flag-off path
  byte-untouched.
- Real-LLM smoke (yunwu, message mode, full runTurn with persona+memory): two bubbles —
  雪的故事 (`soft_warmth`, 0.6, `is_final:false`, 2 segments) then a question
  (`curious_attention`, 0.7, `is_final:true`); `turn.result` = concatenation. **Observed leak**:
  one top-level English aside after the final tool round ("I shared the story…"), correctly
  excluded from the reply — exactly the signal the v0.7.0 A/B counts and the v0.6.2
  directive/guard iteration targets.

Inference:

- LD #9 is now real on the wire: speech is a typed, validated, traced tool action with Live2D
  metadata in the same frame. The model adopted multi-bubble + expression + is_final semantics
  zero-shot from schema descriptions alone, which derisks the v0.7.0 default flip.
- The observed top-level leak confirms the A/B instrumentation works and gives v0.6.2 a concrete
  target: the leak happened on the post-tool round where the model "narrates completion" — the
  empty-reply guard's inverse. Directive tuning, not architecture, is the likely fix.

### `v0.6.0` — 2026-06-13 — Persona foundation (Initiative 3, commit 1 of 4)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Persona file** ported from Python `persona.runtime.default.md` (105 lines, near-verbatim) to
  `packages/server/persona/default.md`. One deliberate addition under Hard Runtime Guidance: "Do
  not claim abilities or perceptions you do not actually have right now" — codifies the real-usage
  key_moment where Luna performed capabilities she lacked and was called out.
- **`src/persona/loader.ts`**: mtime-gated hot reload (amendment A5) — `statSync` per call,
  re-read only on change; same-object identity when unchanged (prompt-cache friendly); missing
  file → fallback one-liner + single warning, never a crash. `LUNA_PERSONA_PATH` overrides the
  repo default.
- **`src/persona/humanity.ts`**: caps as TS constants (140/4/55, no JSON config); ported CJK
  splitters — `splitSentences` (`[。！？!?]+|\n+`), `splitClauses` (also breaks on sentence marks,
  a strictly-more-correct divergence from Python's clause-punct-only split); `renderHumanityBlock`
  prose for the system core (guidance tier; Zod enforcement arrives v0.6.1).
- **`src/persona/scene.ts`**: wake scene block (Python turn-0 branch). Injected at MESSAGE level
  into the first user turn after process boot via `Session.wakePending` (in-memory, deliberately
  unpersisted — a restart is a fresh wake). Python's "continuing" turn-1+ framing not ported:
  redundant with the persona file's Memory Condition/Growth sections, and it would have made a
  permanently turn-varying block. System core stays byte-stable across the boot transition.
- **`buildSystemPrompt` assembly order** (one cached block): base directives → persona reference
  (framing line + file text) → embodiment → humanity rules → core memory. **Embodiment rewritten
  truthful**: Python claimed a visible Live2D body; ours states plainly "text chat page, no body,
  no voice yet — planned later; do not claim to be visible or audible" (updates at Initiative 6).
  `LUNA_PERSONA=0` drops persona/embodiment/humanity/scene (memory blocks unaffected).
- Tests: 133 across 22 files (+13): loader identity/reload/fallback; splitter CJK/ASCII/mixed
  cases; runTurn integration — scene block only in first user turn and never in system; persona
  file edit changes system prompt exactly once then stable (byte-compare via MockProvider).
- Real-LLM smoke (yunwu, boot → "你是谁？"): "我是Luna。刚醒过来，脑子里还很空，名字倒是清楚。
  你呢，你是我睁眼看到的第一个人。" — 42 chars, 3 sentences, wake framing + persona voice + cap
  compliance in one reply, zero assistant politeness.

Inference:

- Layer 2 of the three persona layers was already live (core-memory prose from v0.4.2, updated by
  `remember(update_self)` and dream `persona_update`) — this version makes the layering explicit
  and gives it the static substrate (layer 1) and the wake moment (layer 3 → message level).
- The honest-embodiment divergence and the no-capability-claims line are both direct products of
  the 2026-06-12 real-usage session — the memory substrate observing Luna's own failure modes is
  now feeding persona design. That loop (live usage → L3 key_moments → next version's guardrails)
  is exactly what the rewrite was structured to enable.

### `v0.5.2` — 2026-06-12 — Gateway-safe tool schemas (`remember` bug from first real usage)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Bug (user-reported, confirmed in trace data):** every real-usage `remember` call failed with
  `validation_failed: invalid_union_discriminator` (turns 1 and 6, 2026-06-12 16:54/17:01).
  L2 archive showed the model's arguments arriving wrapped as `{"_noargs": "<raw args text>"}` —
  a key that exists nowhere in this repo or the SDK. Root cause: `remember`'s input was a Zod
  `discriminatedUnion`, whose wire schema is a **root-level `anyOf` with no top-level
  `properties`**; the yunwu gateway treats such tools as argument-less and wraps whatever the
  model emits under `_noargs`. The upstream model also never saw the real field names (one call
  used `content` instead of `text`). `read_file` (plain object schema) was untouched in the same
  sessions — and the dream cycle's `memory_audit` step quietly compensated by adding 5 facts the
  failed `remember` calls had attempted.
- **Fix 1 — flat input schema** (`tools/builtin/remember.ts`): `action: z.enum(...)` + optional
  per-action fields with `describe()` hints, per-action requirements enforced in `superRefine`.
  Wire schema is now a flat root-level object; runtime and wire contracts agree exactly (no
  strict-variant mismatch a flattening shim would have introduced). Wrong-field-name calls now
  fail with a targeted recoverable issue (`text: required for action="add"`) instead of a union blob.
- **Fix 2 — defensive unwrap** (`provider/anthropic.ts` `unwrapGatewayInput`, exported + unit
  tested): a `{"_noargs": "<json>"}` single-key input is unwrapped to the parsed object when the
  raw text is a JSON object; anything else passes through for tool validation to reject
  recoverably. Applied only to dispatch `toolUses`; `assistantContent` stays verbatim in history
  (signed thinking blocks).
- **Fix 3 — cap error recoverable** (`tools/dispatcher.ts`): `concurrent tool cap exceeded` was
  `recoverable: false`, telling the model not to retry calls it can simply re-issue next round
  (hit in real usage, turn 25: 9 parallel `read_file`). Now `recoverable: true`.
- **Regression guard** (`runTurn.test.ts`): every builtin tool's `toolsToAnthropicFormat` schema
  must be a root-level `type: "object"` with `properties` and no `anyOf`/`oneOf`/`allOf`.
- Tests: 120 across 21 files (+7). Live yunwu smoke: "请记住：我的名字是 Alan，我喜欢猫。" → two
  clean `remember` tool_use calls (`action:"add"`, correct `text`/`category`/`confidence`),
  both validate PASS, no `_noargs`.

Inference:

- First bug found **by the observability + memory substrate doing their job**: the trace table
  pinpointed the failing call and the L2 verbatim archive preserved the mangled input — exactly
  the "memory bugs are traceable from day one" payoff the roadmap ordered Initiative 1.5 before 2 for.
- Locks a wire-contract rule for everything-as-tool (LD #9): **tool input schemas must be flat
  root-level objects** — discriminated unions stay a runtime-validation pattern, never a wire
  shape. The v0.6 `message` tool schema already satisfies this; the regression test makes it
  permanent.

### `v0.5.1` — 2026-06-12 — Dev chat page `/_chat`

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/devchat/` — `devchat.ts` (handler: `/_chat` → static HTML, null
  fall-through; same shape as the trace viewer, mounted behind the same `LUNA_VIEWER` gate)
  and `devchat.html` (~200 LOC vanilla): streaming chat bubbles over the existing WS protocol
  (`chat.send` → `turn.started`/`reply.token`/`turn.result`), tool chips, 🌙 入梦 / ☀️ 唤醒
  buttons (`dream.enter`/`dream.wake`), dream-step chips, dreaming-state input lock,
  auto-reconnect, link to `/_trace`. Zero new wire events — pure consumer.
- Tests: 113 across 20 files (+2). Boot smoke: `/_chat` 200 with content, `/_trace` 200, WS ping ok.

Inference:

- First **usable** conversation surface — Alan can now actually live with Luna's memory
  (the "manual dream proven in use" staging both Python and the TS roadmap call for) without
  waiting for Initiative 6's real frontend. Explicitly a dev page: the Live2D `agent-app`
  port at v0.12 is unaffected and remains the product surface.

### `v0.5.0` — 2026-06-12 — Dream engine (Initiative 2 capstone)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **`graph.ts` generalized** (`runGraph<S, N extends string>`; `NodeFn` returns `N | 'end'`)
  — type-level only, turn loop unchanged (`TurnNode` 6-union + `NodeName` alias). The dream
  cycle is a **second StateGraph** on the same runner, not a bespoke pipeline.
- Wire contract: `ClientEvent` += `dream.enter` / `dream.wake`; `ServerEvent` +=
  `dream.status` / `dream.step {step, status, detail}`; `chat.send` while dreaming →
  `error{code:'dreaming'}` (reject, never interleave).
- `enter_dream` tool added (`ToolName` → 4): **pending-intent only** — sets
  `session.pendingDream`; the ws layer starts the cycle strictly after the triggering
  turn's `turn.result` (closes Python's tail-race where the daemon thread started inside
  tool execution).
- `dream/` (5 files, ~600 LOC): `dreamState.ts` (module-state gate + SQLite write-through;
  `finished_idle` parked semantics — completed cycle keeps `is_dreaming=true` until an
  explicit wake; **boot reconciliation** marks crash-stale cycles aborted and parks awake),
  `cycle.ts` (six DreamNode steps: refine_semantic → refine_layer1 → memory_audit →
  persona_update → run_diaries → rag_refresh; traces under `dream:<cycle_id>` with
  **per-step flushes**; per-step `DreamReport` records persisted to `dream_reports`),
  `llm.ts` (two-attempt summarizer→default key cascade as **two provider instances**;
  failure classification incl. yunwu's Chinese rate-limit strings; Zod `MemoryPatch` /
  `PersonaPatch` JSON-block parsing), `prompts.ts` (natural-language section headers —
  **no `<<<>>>` delimiters**, the Python v0.56.1 content-filter lesson, test-asserted).
- `migrations/0006_dream.sql`: `dream_state` (seeded single row), `dream_reports`,
  `diaries` (day/week/month, `UNIQUE(kind, period_key)`). Diary tiers: day → week rollup
  (complete week groups), capped by `LUNA_DREAM_MAX_DIARIES_PER_CYCLE` (20).
- Reconciliation = supersede via the v0.4.2 stores: `memory_audit` soft-forgets stale ids +
  adds replacements; `persona_update` writes prose core memory with source `'dream'`.
- `main.ts`: dream LLM cascade built from `LUNA_SUMMARIZER_API_KEY` (+ fallback to the
  main provider); `bootReconcile()` at startup. Test preload now also forces
  `LUNA_MEMORY_EMBEDDING=0` ambiently — unit tests can never hit the network via the
  auto-loaded `.env` (suites opt back in with fake clients).
- Tests: 111 across 19 files (was 102). New dream suite (9): gate + wake lifecycle ·
  double-enter/early-wake rejection · **planted-contradiction reconciliation (exactly one
  active fact survives, old one soft-deleted)** · day+week diaries · persona update with
  dream-source audit · key cascade + delimiter-absence · per-step trace durability ·
  pending-intent (no dream activity before `turn.result`) · boot reconciliation.
- Real-LLM smoke (full cycle ×2): built memory in chat → `dream.enter` → six steps ran
  (`persona_update:ok / run_diaries:ok / rag_refresh:ok`; `memory_audit` reconciled when
  given material — and on one run was correctly `skipped` because Luna had **already
  self-reconciled live** via the remember tool) → `chat.send` while parked → `dreaming` →
  wake → coherent replies. DB evidence: a real first-person diary row ("Today we finished
  the dream engine. After all the back-and-forth, the false starts…"), dream-updated
  `self_state` + `relationship_status`, parked `dream_state`, full step report.

Inference:

- **Initiative 2 (memory + dream substrate) is complete.** Luna now has the full loop her
  positioning requires: she remembers (L3 + core), recalls by meaning (hybrid), survives
  restarts (L1/L2), and consolidates offline (dream) — with the live hot path making zero
  synchronous memory LLM calls and the prompt cache surviving by construction.
- The isolation contract is stricter than Python's in two places (pending-intent trigger,
  boot reconciliation) and equal where Python's hard-won fixes mattered (content-filter
  prompts, key cascade) — the audited "port the lessons, not the accidents" line held.
- Deviation from plan, documented: the pending-dream check lives in `ws.ts`'s post-turn
  continuation rather than `runTurn`'s finally — same semantics (strictly post-finalize),
  cleaner emit reuse, no dream import inside the turn loop.

### `v0.4.3` — 2026-06-12 — Hybrid recall (sqlite-vec + CJK lexical)

Status:

- working tree (commit hash recorded post-commit)

Fact:

- **Spike first** (`scripts/spike-sqlite-vec.ts`): `Database.setCustomSQLite` + sqlite-vec
  0.1.9 load + vec0 KNN verified live on this machine — PASS, vec0 primary path GO.
- Added `memory/recall/` (4 files, ~330 LOC): `vecRuntime.ts` (guarded `initCustomSqlite` —
  process-global, once, before any Database; `tryLoadVec` with remembered failure),
  `embed.ts` (~60 LOC fetch client for OpenAI-compatible `/v1/embeddings` — deliberately
  NOT the cut `openai_compat` adapter; batch ≤64; f32-LE BLOB layout shared by vec0 and the
  TS path; sha256 `contentHash`; `cosine`), `lexical.ts` (ASCII words + **CJK sliding
  bigrams** + stopwords, ported approach from Python `semantic_retrieval`), `recall.ts`
  (`retrieve` = hybrid 0.7·cosine + 0.3·lexical + recency boost over L2 tail + live L3
  facts; soft-deleted excluded; embedding outage → lexical-only; `MAX_EMBED_PER_TURN=64`
  cold-cache cap until dream's `rag_refresh`; `renderRecallBlock`).
- vec0 virtual table (`vec_cache`) is **derived data created lazily at runtime** keyed to
  `embeddings_cache.rowid` — migrations must not depend on a loadable extension.
  `0005_embeddings.sql` ships only the regular `embeddings_cache` table. Embedding-only
  vec0 columns (the #274 metadata-col bug avoidance).
- `runTurn.parse_input`: recall block injected as a `<memory>` text block **inside the user
  message** (message level, after the cached prefix); user turns persist as-sent.
  `bunfig.toml` gains `[test] preload` (`test-preload.ts` → `initCustomSqlite` before any
  test constructs a Database). `main.ts` calls `initCustomSqlite()` before `openDb`.
- Env: `LUNA_EMBEDDING_MODEL` / `LUNA_EMBEDDING_API_KEY` / `LUNA_EMBEDDING_BASE_URL`
  (+ `.env.example`), `LUNA_MEMORY_RETRIEVAL_K` (12), `LUNA_MEMORY_EMBEDDING` (=0 →
  lexical-only, zero API).
- Tests: 102 across 18 files (was 93). New recall suite (9): CJK bigram tokenize · Chinese
  lexical no-API · paraphrase semantic hit (deterministic fake embed client) · hash-cache
  no-re-embed · recency tie-break · soft-deleted excluded · renderRecallBlock · **system
  prompt byte-identical across different queries** (recall is message-level — the cache
  invariant holds).
- Real-API smoke: "what hot drink hobby did I mention?" hit the espresso L2 row with
  **zero shared keywords** (true semantic match via text-embedding-3-large, 3072-dim);
  `embeddings_cache` 3 rows + `vec_cache` 3 rows (vec0 live in production code).

Inference:

- Luna can now recall by meaning, in two languages, with a graceful degradation ladder:
  vec0 KNN → TS cosine over the same BLOBs → pure CJK/ASCII lexical — each step a silent
  fallback, no configuration coupling.
- The cache invariant survived its hardest test: per-query retrieval content rides the
  user message; the system prompt never varies with the query. TS goal #1 (latency via
  prefix cache) and Luna's memory coexist by construction.

### `v0.4.2` — 2026-06-12 — L3 semantic store + prose core memory

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Protocol: `L3Category` (5 Python-parity categories), `L3Confidence`, `L3Fact`
  (with `deleted_ms` + `expires_ms`), `CoreMemory` (prose `self_state` +
  `relationship_status`). `migrations/0004_l3_core.sql`: `l3_facts` (+ category/dedup
  indexes), `core_memory` (single row, seeded), `core_memory_audit` (append-only).
- `memory/l3Store.ts` (~90 LOC): `addFact` (punctuation-normalized `dedupKey` port of
  Python's `_dedup_key`; prefixed ids `cf_/pf_/km_/at_/pc_`; `active_threads` get a
  14-day TTL), **`forgetFact` = soft delete** (`deleted_ms`, never removes the row — the
  deliberate divergence from Python's hard-delete `ForgetTool`), `listFacts` with
  **`asOf` time-travel** (deleted facts visible when valid at that time).
- `memory/coreMemory.ts`: `getCore` / `updateCore` (audit-first: prior state recorded
  before every write) / `restore(n)`. Prose only — no 5-field structure, no consistency
  tripwire (Alan decision E + kept-undo compromise).
- `memory/renderCoreBlock.ts`: the **stable** memory prefix (core memory + per-category
  render-capped facts with `[id]` handles + a one-line remember-tool hint). Deterministic
  — no timestamps. Render caps = Python's storage caps (15/10/12/6/8); storage stays
  unbounded until dream prunes.
- `remember` tool rewritten: discriminated `action: add | forget | update_self` input
  (the cut-list's four-tools-into-one, final shape), SQLite-backed via the seam,
  `session-serial`; unconfigured seam → structured err, never a throw.
- `runTurn`: `buildSystemPrompt(session)` composes `[placeholder + core block]` as
  `TextBlockParam[]` with a **`cache_control: ephemeral` breakpoint**;
  `ProviderRequest.system` widened to `string | TextBlockParam[]`; user turns now persist
  as content-block arrays (as-sent fidelity, ready for v0.4.3's message-level recall
  block); `complete()` gains adaptive thinking.
- Env: `LUNA_MEMORY_INJECT` (default on). Test fixtures switched to real `migrate()`.
- Tests: 93 across 17 files (was 84). New: l3 suite (7 — soft-delete + asOf, dedup +
  re-add-after-forget, TTL, audit + restore, render determinism, **byte-identical system
  prompts across no-change turns / differing after a change**), remember suite rewrite (5).
- Manual smoke (real LLM): "remember my cat is named Mochi" → model called the tool,
  **chose `core_facts` itself**, L3 row landed; restart → "What is my cat called?" →
  **"Mochi"**.

Inference:

- Luna now has self-managed durable memory with the prompt-cache invariant enforced by
  test: the system prompt changes only when memory changes. The `[id]` handles in the
  rendered block are what lets the model `forget` precisely — the supersede loop
  (forget old + add new) is now mechanically possible for both the model (live) and
  dream's `memory_audit` (v0.5.0, bulk).
- Soft-delete + `asOf` makes "this was once true" a first-class query — the time-travel
  substrate dream reconciliation and future temporal reasoning both stand on.

### `v0.4.1` — 2026-06-12 — L1 rolling window

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/memory/l1Window.ts` (~110 LOC): `buildActiveContext` (bounded
  view sent to the model — `[<conversation_summary> user message?] + history.slice(lowWater)`;
  `session.history` itself is never truncated), `planFold` (chooses **whole L2 turns** so the
  fold boundary always lands at a turn start, never splitting tool_use/tool_result pairs;
  fold input comes from L2 `user_text`/`assistant_text` columns — never from
  `rollingSummary`), `maybeFold` (**async fire-and-forget**, scheduled in `runTurn`'s
  finally after trace flush; CAS-committed).
- `migrations/0003_l1_window.sql`: `sessions` += `rolling_summary`, `window_low_water`.
  `sessionStore.commitFold` appends the summary chunk via SQL `||` concat with
  `WHERE window_low_water = :expected` — CAS failure = `changes === 0`, fold discards.
- `Provider` interface gains **`complete(req): Promise<{text, usage}>`** (non-streaming;
  shared by this fold and v0.5.0's dream): `AnthropicProvider.complete` via
  `messages.create`, constructor gains optional `apiKey` (dream's key cascade = two provider
  instances); `MockProvider` gains `completeResponder` + request capture.
- `runTurn.open_stream` now sends `buildActiveContext(session)` instead of raw history.
- Env: `LUNA_L1_WINDOW` (default on), `LUNA_L1_KEEP_MSGS` (24), `LUNA_L1_FOLD_BATCH_MSGS` (12).
- Tests: 84 across 16 files (was 78). New l1Window suite (6): bounded@40turns ·
  **no-re-compression invariant** (second fold input excludes the first summary's marker
  text) · deterministic plan from same L2 · `LUNA_L1_WINDOW=0` passthrough ·
  fold-never-blocks (gated in-flight fold + live turn completes; fold lands after) ·
  CAS stale-fold discard (fast fold wins, slow fold returns false).

Inference:

- **The compression-drift trap is structurally closed**: summaries only ever grow by
  appending chunks derived from verbatim L2 text; existing summary text is never an input
  to summarization. The hot path keeps zero synchronous memory LLM calls (the fold runs
  post-`turn.result`) — both audited TS-line constraints hold by construction, with tests
  guarding each.
- Corrects the Python port hazard flagged in the roadmap audit: Python ran its fold in an
  aux thread pool, and the async property was nearly lost in translation. Here it is
  explicit, CAS-protected, and test-pinned.

### `v0.4.0` — 2026-06-12 — Memory substrate foundation

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/protocol/src/memory.ts` (Zod `L2Turn` + `SessionRow`) and
  `packages/server/src/memory/sessionStore.ts` (~100 LOC): `setMemoryDb()` injection seam
  (mirrors `setTraceStore` — unset → all functions no-op, existing test suites run unchanged),
  `loadSession` / `persistSession` (upsert) / `appendL2` / `listL2`.
- **Migrations unified into one shared dir** `packages/server/src/migrations/`:
  `0001_traces.sql` moved from `trace/migrations/` (number is the identity — path is never
  recorded, so existing DBs are unaffected), new `0002_memory.sql` (`sessions`, `l2_turns`
  + `(session_id, t_ms)` index). `migrate()` now throws on duplicate migration numbers
  (they would otherwise be silently skipped). Trace test fixture paths updated.
- `session.ts` hydrates from SQLite on first `getSession` when the seam is set; `Session`
  gains `pendingDream: string | null` (reserved for v0.5.0). `runTurn` snapshots history
  length at turn start and persists the turn's full as-sent slice to L2 (`raw_json`) +
  upserts the session in its `finally` — signed thinking blocks survive restarts verbatim.
- **Mutex unification (audit finding H)**: deleted `dispatcher.getSessionMutex` (the second,
  parallel per-session mutex map); both ws paths (`chat.send` and `dev.dispatch_tool`) now
  feed `DispatchContext.sessionMutex` from the single `getSession(id).mutex`.
- Env: `LUNA_PERSIST` (default on; `=0` keeps sessions in-memory). Wiring in `main.ts` only.
- Tests: 78 across 15 files (was 73). New: sessionStore (4 — restart-survival incl. signed
  thinking + tool_use round-trip, L2 ordering + raw_json fidelity, ephemeral seam, upsert),
  sql duplicate-number throw.
- Manual smoke (real LLM, two boots, one DB): told her "My name is Alan", killed the server,
  rebooted, asked "What is my name?" → **"Alan"**. DB after: schema v2, `turn_seq=2`, 2 L2 rows.

Inference:

- **Luna survives restarts** — the foundational property of Initiative 2, proven end-to-end
  against the real gateway. History persists as the exact Anthropic content blocks the model
  produced (signature validation keeps working on resumed conversations).
- Collapses Python v0.52 (single-writer) + v0.53 (full-text archive) into one version:
  SQLite WAL + the unified session mutex give single-writer structurally, with no lock
  machinery to port.
- L2 is now the ground-truth corpus that v0.4.1's fold derives from, v0.4.3 embeds, and
  v0.5.0's diaries summarize — everything downstream reads from here.

### `v0.3.6` — 2026-06-11 — Local trace viewer

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/trace/viewer.ts` (~45 LOC): `traceViewerHandler(req, store)`
  returns a `Response` for `/_trace` (static HTML), `/_trace/api/turns?limit=`,
  `/_trace/api/events?turn_id=` (parses `payload_json` on the way out), or `null` for
  non-`/_trace` paths so the caller falls through to the WS upgrade. Read-only; shares the
  boot `Database` via the trace store (no second connection).
- Added `packages/server/src/trace/viewer/index.html` (~210 LOC, vanilla — no framework, no
  build step): two-pane layout (turn list / per-turn timeline), color-coded event kinds
  (node / tool / outbound / overflow), `+Nms` relative offsets, click-to-expand
  `payload_json`, 2s auto-refresh.
- `main.ts`: composes the fetch handler **before** `Bun.serve` — viewer handler first (when
  `LUNA_VIEWER !== '0'`), then WS upgrade, then 426. `getTraceStore()` added to instrument
  for the shared-store reference.
- **`LUNA_TRACE` default flipped on**: `traceEnabled()` now returns true unless
  `LUNA_TRACE === '0'` (v0.3.5 was opt-in `=== '1'`). Tracing is on by default now that a
  viewer makes it useful.
- Tests: 73 across 14 files (was 68). New: viewer (5 — HTML 200, turns newest-first, events
  parsed/ascending, unknown subpath 404, non-`/_trace` → null). `instrument.test.ts` updated
  for the default-on semantics (explicit `LUNA_TRACE=0` opt-out test).
- Manual smoke: real LLM turn (tracing on by default) → `/_trace` serves HTML, turns API
  shows the 22-event turn, events API returns node:9 / outbound:11 / tool:2; WS ping/pong
  unaffected with the viewer mounted; `LUNA_VIEWER=0` makes the server WebSocket-only
  (`/_trace` → 426).

Inference:

- **Initiative 1.5 (observability foundation) is complete.** Luna now has the
  Mastra-Telemetry / LangSmith-equivalent layer the roadmap placed deliberately *before*
  memory (v0.4): every turn is a replayable, browsable event tree. Memory bugs that ship in
  v0.4+ now have a timeline to debug against instead of being a black box.
- The viewer's left-list / right-detail shape is a candidate pattern for a v0.12 frontend
  debug overlay, but nothing downstream hard-depends on it yet.
- Deliberate divergence from the plan's acceptance: `LUNA_VIEWER=0` yields **426** (the
  server becomes genuinely WebSocket-only — the viewer handler is bypassed entirely) rather
  than 404. 426 is the more honest signal; the handler's own 404-for-unknown-subpath
  contract is still unit-tested.

### `v0.3.5` — 2026-06-11 — Trace plumbing

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/protocol/src/trace.ts` (~70 LOC): Zod `TraceEvent` discriminated
  union — `node` / `tool` / `outbound` / `overflow`, each carrying `schema_v: z.literal(1)`,
  `trace_id`, `turn_id`, `session_id`, `t_ms`. `TRACE_SCHEMA_V = 1`.
- Added `packages/server/src/sql.ts` (~50 LOC): generic `bun:sqlite` boilerplate —
  `openDb` (WAL + foreign_keys + busy_timeout per connection), `migrate(db, dir)`
  (applies `migrations/NNNN_*.sql` whose leading integer exceeds `PRAGMA user_version`,
  each in its own transaction; PRAGMA bump interpolated since PRAGMA can't bind),
  `closeDb`. **Zero trace-specific code — v0.4 memory substrate reuses it verbatim.**
- Added `packages/server/src/trace/` — `migrations/0001_traces.sql` (DDL + 2 indexes,
  no PRAGMA), `store.ts` (per-turn in-memory buffer, single-transaction flush on turn
  end, 500-event cap + `overflow` row, 4KB structured-wrapper truncation, read API
  `listTurns` / `getEventsByTurn`), `instrument.ts` (`trace()` single entry, `LUNA_TRACE`
  gate — default off in v0.3.5), `README.md` (instrumentation + migration discipline).
- Instrumented `runTurn.ts`: `onTransition` → node trace (the `open_stream` transition
  carries `{token_count, first_token_ms, thinking_summary}`); `dispatch_tools` loop tees
  each `ToolEvent` → tool trace; a `tracedEmit` wrapper records every `ServerEvent` as an
  outbound trace; `flushTrace` in the `finally`. **All three construction sites guarded by
  `traceEnabled()`** so the production default-off path builds zero discarded objects.
  Shipped `dispatcher.ts` and `outbound.ts` untouched.
- `main.ts`: opens SQLite at boot (`LUNA_DB_PATH`, default `./luna.sqlite`), runs
  `migrate`, sets the trace store, closes DB on SIGTERM. `.gitignore` += `*.sqlite*`.
- Tests: 68 across 13 files (was 57). New: sql (4 — migration idempotency/ordering/WAL,
  tmpdir), store (5 — buffer/flush/overflow/4KB-truncation/listTurns ordering),
  instrument (2 — full-turn node+tool+outbound rows keyed by turn_id, gate-off → no rows).
- Latency: per-turn absolute trace cost 0.15–0.5ms on a network-free synthetic bench
  (`scripts/trace-latency.ts`). End-to-end smoke: a real LLM turn wrote 24 rows
  (9 node + 13 outbound + 2 tool) under one turn_id.

Inference:

- **First persistence layer in the rewrite.** The `sql.ts` WAL + versioned-migration
  pattern is the one v0.4 memory work copies — getting it generic and reusable here means
  the SQLite substrate lands once, not twice.
- **Partially resolves Open Q #8**: every turn now carries a `trace_id` (= turn_id) and a
  replayable event tree. The full L1/L2 reasoning-decision tree is still deferred to v0.8,
  but the plumbing it will hang off now exists.
- **Resolves Open Q #4**: trace `payload_json` truncates at 4KB into a structured
  `{truncated, original_bytes, preview}` wrapper (never a byte-slice of serialized JSON).
  The dispatcher keeps pure per-tool `summarize` with no global tripwire — the locked
  direction from v0.2 holds.
- The synthetic-bench 5% gate from the plan was a measurement artifact (network-free turns
  run in ~5ms, so sub-ms persistence reads as 6–8%); the production-meaningful bound is the
  absolute per-turn cost, which against real 1000ms+ turns is <0.05%. The bench asserts the
  absolute budget and reports the synthetic % for transparency.

### `v0.3.0` — 2026-06-11 — Anthropic interleaved tool-use end-to-end

Status:

- working tree (commit hash recorded post-commit)

Fact:

- Added `packages/server/src/provider/` (3 files, ~140 LOC): `types.ts` (`ProviderEvent`
  union — `text_delta` / `thinking_delta` / `tool_use_start` / `message_stop` carrying
  `stopReason` + `toolUses` + verbatim `assistantContent` + usage), `anthropic.ts`
  (`AnthropicProvider` over `@anthropic-ai/sdk@0.104.1` exact-pinned; `messages.stream()`
  raw-event mapping; tool inputs taken from `finalMessage().content` — **no**
  `input_json_delta` accumulation; `maxRetries: 2` explicit), `mock.ts` (scripted rounds,
  per-request message snapshot).
- Added `packages/server/src/turn/` (3 files, ~280 LOC): `graph.ts` (inline 7-node
  StateGraph — `parse_input → build_request → open_stream → dispatch_tools →
  append_results → finalize → end`; `runGraph` with `onTransition` hook reserved as the
  v0.3.5 instrumentation seam), `session.ts` (in-memory `Session` with history /
  turnSeq / activeTurn / mutex; `'default'` id), `runTurn.ts` (node implementations;
  `MAX_TOOL_ITERATIONS = 8`; `zod-to-json-schema` with `$refStrategy: 'none'` for tool
  definitions; assistant content appended verbatim so signed thinking blocks survive;
  unknown tool names short-circuit to `tool_not_found` without dispatching).
- Extended wire contract: `ClientEvent` += `chat.send {turn_id?, text}`; `ServerEvent`
  += `turn.started`, `reply.token`, `turn.result {text, finish_reason, usage}` with
  `FinishReason` enum (`end_turn | max_iterations | max_tokens | refusal | error`).
- `ws.ts` gained the `chat.send` branch: one active turn per session
  (`turn_in_progress` error), `runtime_not_configured` guard, emit wrapper that
  swallows dead-socket sends so mid-turn disconnect cannot abort tool execution.
- `main.ts` constructs `AnthropicProvider` + `builtinRegistry` at boot when
  `ANTHROPIC_API_KEY` is set. Env: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`,
  `LUNA_MODEL` (default `claude-opus-4-8`), `LUNA_MAX_TOKENS` (default 8192).
  `.env.example` committed; real `.env` gitignored (values copied from Python Luna).
- Provider config: yunwu.ai gateway verified by an early 2-round smoke
  (`scripts/smoke-yunwu.ts`) — adaptive thinking with `display: 'summarized'` accepted,
  signed thinking blocks survive the tool_result round-trip, tool_use streams.
- **Deliberate divergence from Python**: Python Luna uses
  `LUNA_THINKING_BUDGET_TOKENS=2048`; `budget_tokens` returns 400 on `claude-opus-4-8`.
  TS uses `thinking: {type: 'adaptive', display: 'summarized'}`.
- Tests: 57 across 11 files (was 49). New: runTurn (6 — spec tests 1-6 incl.
  interleaving proof, iteration cap, dead-socket resilience, mid-stream provider
  failure), chat.send WS round-trip (2). Manual smoke: real dual-tool turn
  (`time_now` + `read_file`) over WS — 32 streamed tokens, 2 tool cycles, coherent
  reply, `finish_reason: end_turn`.

Inference:

- **Initiative 1 (tool spec foundation) is complete.** All six Python tool-instability
  root causes are now structurally closed: single always-mounted registry (no 5-path
  mount logic), 3-tool closed surface, discriminated `Result<T>` (no `startswith`
  heuristics), token streaming continues through tool calls (the perceived-latency win
  the rewrite was started for), typed wire contract end-to-end, hard iteration cap
  instead of reactive stall rules.
- The StateGraph shape means v0.3.5 instrumentation is one `onTransition` wire-up, v0.6
  `message_tool` swap is one node change, and v0.8/v0.10 insert nodes mechanically —
  the LangGraph-style orchestration alignment is now in code, not just on the roadmap.
- Verbatim `assistantContent` in history is load-bearing: reconstructing thinking
  blocks from deltas would break Anthropic's signature validation on the next request.
  The early gateway smoke de-risked this before the graph was built on top.

### `v0.2.0` — 2026-06-11 — Typed tool registry + `Result<T>`

Status:

- working tree (commit hash filled in after merge to main)

Fact:

- Added `packages/protocol/src/tools.ts` (~60 LOC): Zod schemas for `ToolName` (closed
  enum: `time_now | read_file | remember`), `ToolErrorCode` (5 variants), `ToolResult`
  (discriminated `ok` / `err`), `ToolEvent` (discriminated `started` / `progress` /
  `final`), `ToolCall`. All exported types via `z.infer`.
- Extended `packages/protocol/src/events.ts`: `ClientEvent` gained
  `dev.dispatch_tool { call_id, tool_name, input }` (dev-only). `ServerEvent` gained
  `tool.started`, `tool.progress`, `tool.finished`.
- Added `packages/server/src/tools/` (10 files, ~530 LOC): `defineTool.ts` (ToolSpec generic
  factory → concrete Tool interface), `registry.ts` (`Record<ToolName, Tool>` builtin
  registry), `dispatcher.ts` (concurrency grouping + AbortController + manual `iter.next()`
  race + `iter.return()` cleanup + output schema validation + `data ?? null` serialize +
  `MAX_CONCURRENT_TOOLS_PER_SESSION = 8` backstop), `mutex.ts` (FIFO async mutex with
  `AbortSignal`-aware `acquire`), `mergeAsync.ts` (source-tagged sparse-array merger with
  per-iterator catch + `return()` propagation), `README.md` (tool author contract).
- Added 3 representative tools (`builtin/`): `time_now` (safe-parallel, instant),
  `read_file` (safe-parallel, `Bun.file().text()` with ENOENT → recoverable error,
  32KB truncation), `remember` (session-serial, in-memory `Map<sessionId, Item[]>`
  keyed by session).
- Updated `packages/server/src/main.ts` + `ws.ts`: WS data slot typed as
  `{sessionId: string}` (preparation for v0.4 sessions). `ws.ts` adds `dev.dispatch_tool`
  branch gated on `LUNA_DEV_TOOLS=1` that forwards dispatcher events as
  `ServerEvent.tool.*` through the existing `outbound()` boundary.
- Test count: 49 across 9 files (was 12 in v0.1.0). New: tools (8), mutex (4), mergeAsync
  (3), dispatcher (8), time_now (2), read_file (2), remember (3), dev.dispatch_tool
  round-trip (2). Suite green in ~300ms.
- TypeScript `tsc --noEmit` clean on both packages. Two intentional `any` in
  `defineTool.ts` Tool interface (with paired WHY comment) for generic-invariance
  bivariance; no `as any`, no `as unknown`, no `@ts-ignore`. One `@ts-expect-error` in
  dispatcher.test.ts for the unreachable `tool_not_found` path (annotated).
- Manual smoke against `LUNA_DEV_TOOLS=1 bun run dev:server`:
  `dev.dispatch_tool{tool_name:'time_now'}` → `[tool.started, tool.finished]` with
  `result.kind='ok'` and valid `iso` field.

Inference:

- **Establishes the tool contract for everything downstream.** v0.3 (LLM-driven dispatch),
  v0.4 (memory tools touching SQLite), v0.6 (`message_tool` per LD #9), v0.8 (reasoning-rail
  tools) all sit on this shape. The `defineTool` generic factory gives per-tool I/O type
  inference; the concrete `Tool` interface allows heterogeneous registry storage; the
  dispatcher's runtime Zod safeParse guarantees the wire contract.
- **Fixes 4 of the 6 Python tool-instability root causes by design.** No 5-path mount logic
  (always-on registry); no 56-tool surface (closed 3-tool surface, grows to 10); no
  `startswith('Error')` heuristic (discriminated `Result<T>` with structured `ToolErrorCode`);
  no buffered tool-turn (async generator yields stream through `mergeAsync`). The remaining
  2 (no verifier loop, reactive stall detection) are v0.3+ concerns.
- **Resolves Open Q #1 + Open Q #5.** Q1 → new Locked Decision #10 (shell tool always-on +
  deny-regex per Mastra/LangGraph parity; no `mountedWhen` field on `defineTool`). Q5
  confirmed locked at 3-state `concurrency` enum at v0.2 design review.
- **Forecloses v0.6 `message_tool` introduction without contract change.** v0.2's `output:
  z.ZodTypeAny` accepts `z.null()` for void-returning tools; the `concurrency` enum already
  includes `session-serial`; `execute: async function*` is exactly the streaming shape
  Anthropic's `input_json_delta` will hook into. v0.6 is a pure add of one tool, not a
  contract revision.
- **First load-bearing dispatcher correctness fix found in testing**: the original design
  returned from `runOne` immediately after the terminal event, abandoning the tool's
  async generator without giving its `finally` block a chance to run (session-serial test
  3 had `maxActive=3` instead of `1`). Fixed by `await iter.return()` in dispatcher's
  finally, with a 100ms grace race on the abort path. Tool authors get reliable cleanup
  semantics; the abort discipline is documented in `packages/server/src/tools/README.md`.

## Pre-history (2026-06-11)

- 11:28 — Empty repo cloned to `/Users/alanyu2077/Desktop/Agent_Luna_typescript`.
- ~12:10 — Multi-agent ground-truth audit of Python Luna v0.47.9 completed (32 agents, 15 dimensions).
- 13:xx — Design conversation locked Bun / WS / SQLite / single-user / Anthropic interleaved tool-use / 10-tool surface.
- Late afternoon — Docs scaffolding (`README.md`, `docs/`, `roadmap/`, `REWRITE_CONTEXT.md`, this file) created.

Nothing else exists in this repo yet.
