# Roadmap — Agent_Luna (TypeScript)

Forward development plan for the TypeScript rewrite. Each initiative is a folder of staged,
self-contained version plans, executed one at a time. Version numbers reserve across initiatives so
they never overlap.

> **Current shipped head: v0.13.11** (2026-06-15, clause-cap relaxation + silenced validation retries —
> end of the C 端 bug-fix pass, tagged `v0.13.11`).
> **Initiatives 1, 1.5, 2, 3, 4, 5, 6 all ✅ complete.** The rewrite now has the full stack: the agent
> brain + three-layer memory + dream consolidation + proactive agency, **and the body** — a redesigned
> cute UI (chat left / model right, light-blue stripes + lace), the live Live2D **yumi** avatar with 14
> high-fidelity layered emotions, GPT-SoVITS voice + Python-ported lip-sync + serial speech queue, a boot
> gate, and a VSCode-style workspace dev IDE — the whole `packages/web` frontend consuming the shared
> `@luna/protocol` types (backend↔frontend drift = a compile error).
>
> **Initiative 7 (open-source packaging) is ❌ cancelled** — the open-source/Docker premise was dropped;
> TTS stays the original GPT-SoVITS, **local-only, not open-sourced**, brought up by a local one-command
> launcher (`bun run dev` → `scripts/dev-all.ts` + `scripts/tts-proxy.cjs`, outside the roadmap). The C 端
> bug-fix pass (v0.13.5–v0.13.11) is **done** — gaze/physics, lip-sync rewrite, serial queue, boot gate,
> workspace IDE, persona fixes, clause-cap. **Next: Initiative 8 (code-agent capability)** — see below and
> [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md).

## Planned initiatives (execution order)

| Order | Version range | Initiative | Folder | Status |
|---|---|---|---|---|
| 1 | v0.1.0 – v0.3.0 | **Tool spec foundation** — Bun skeleton + WS server + typed tool registry + `Result<T>` + 3 representative tools + first end-to-end LLM round trip with Anthropic interleaved tool-use | [`tool-spec-foundation-2026-06/`](tool-spec-foundation-2026-06/) | ✅ shipped 2026-06-11 |
| 1.5 | v0.3.5 – v0.3.6 | **Observability foundation** — `trace_id` propagation through the v0.3 StateGraph; SQLite trace table (one row per node transition + per tool call); minimal local viewer. Mastra Telemetry / LangSmith parity, table-stakes for every later initiative | [`observability-foundation-2026-06/`](observability-foundation-2026-06/) | ✅ shipped 2026-06-11 |
| 2 | v0.4.0 – v0.5.0 | **Memory + dream substrate** — SQLite three-layer memory (L1 window / L2 full-text archive / L3 semantic) + prose core memory + hybrid `sqlite-vec`/CJK recall + the **dream** consolidation engine (manual + `enter_dream` tool; reconciliation, diaries, persona update). Merges the old "memory" + "dream" initiatives — dream is the engine memory needs. Port of Python v0.52–v0.57 | [`memory-dream-substrate-2026-06/`](memory-dream-substrate-2026-06/) | ✅ shipped 2026-06-12 (5 versions) |
| 3 | v0.6.0 – v0.7.0 | **Persona + humanity guardrails + `message` tool** — three-layer persona resolution with mtime-cached hot-reload; humanity hard caps as Zod schema on `message` input (not prompt-only, not truncation). **Introduces `message` tool** per LD #9 (everything-as-tool) behind `LUNA_MESSAGE_TOOL`, default-flipped at v0.7.0; frontend wire-event shape (`tool.progress{tool_name:'message'}`) is fixed here for Initiative 6 to consume | [`persona-message-tool-2026-06/`](persona-message-tool-2026-06/) | ✅ shipped 2026-06-13 (4 versions) |
| 4 | v0.8.0 – v0.9.0 | **Action integrity rails** — 言行一致 + 工具稳发. **L1 thinking contract** (commitment-to-act + tool-trigger checklist + proportionality) in the cached core; structural/mechanical boundary enforcement (`is_final` promise contract + intent-without-act guard, generalizing the v0.6.2 empty-reply guard); off-hot-path defection audit → `decision` traces + replay tree; `recall` tool (Open Q #9). **No L2 gate harness** (LD #14 corrects a Python misreading) | [`action-integrity-2026-06/`](action-integrity-2026-06/) | ✅ shipped 2026-06-13 (5 versions) |
| 5 | v0.10.0 – v0.11.0 | **Proactive agency** — autonomous tool-calling turns when no one is talking, not just proactive messaging (the 2026 ambient/Hermes paradigm, companion-scaled). A proactive turn is a `runTurn` with the full tool surface and **`message` optional** (she can act silently). Idle + scheduled wakeups; the wake gate is the one legitimate L2 gate (reuses Initiative 4's audit lane). **Safety contract (LD #15): reversible-silent / irreversible-surfaced** + kill switch + action budget, because Alan chose full-tool-incl-`shell` autonomy. **Carries the deferred dream auto-trigger** + self-continuation (a delayed micro-wake) | [`proactive-agency-2026-06/`](proactive-agency-2026-06/) | ✅ shipped 2026-06-13 (5 versions) |
| 6 | v0.12.0 – v0.13.4 | **Frontend port — the body** — the consumption controller (v0.12.0, shipped) + a freshly **redesigned** cute UI (Alan's design, not a Python-page port) + the real Live2D avatar (yumi) + GPT-SoVITS voice + lip-sync, all behind the v0.12.0 `Live2DSink`/`AudioSink` interfaces. Reuses the pixi-live2d/Cubism runtime + yumi assets + the SoVITS sidecar; the TS driver glue is ported fresh ("参考 Python 但不照搬"). **v0.12.0 shipped; v0.13.0–v0.13.3 planned** | [`frontend-port-2026-06/`](frontend-port-2026-06/) | ✅ shipped 2026-06-14 (6 versions) |
| ~~7~~ | ~~v0.14.0 – v0.14.2~~ | **Open-source packaging + one-command startup** — ❌ **cancelled.** Open-source/Docker premise dropped; TTS stays original GPT-SoVITS, local-only, not open-sourced. The local one-command launcher was delivered outside the roadmap (`bun run dev`). The still-useful, OSS-independent bits (LICENSE, README rewrite, secret-scan) may return as a smaller future initiative if/when open-sourcing is revisited. | [`oss-packaging-2026-06/`](oss-packaging-2026-06/) | ❌ cancelled |
| 8 | v0.15.0 – v0.15.4 | **Code-agent capability** — turn Luna's minimal, directory-locked code tools into a mainstream code-agent loop: a **workspace sandbox** + windowed read / list / ripgrep nav (v0.15.0), **str_replace-native edit** tools with read-before-edit + lint-on-write (v0.15.1), a **sandboxed `shell`** + typecheck/test/lint **verify loop** (v0.15.2), an Aider-style **repo map** + tree-sitter **symbol locator** + `plan` tool (v0.15.3), and a **self-verified skill library + firewalled, human-gated self-edit** (v0.15.4). Ports Python's filesystem/exec capability; diverges to str_replace-native editing + a hard **evaluator firewall** (the agent can never write the code that judges/sandboxes it — the DGM safeguard). v0.14.x skipped (reserved by cancelled Initiative 7). | [`code-agent-2026-06/`](code-agent-2026-06/) | 🟡 planned |

## Ordering philosophy

**Align with Mastra/LangGraph's functional surface first, then layer Luna's distinctive
positioning on top.** Initiatives 1, 1.5, and the storage half of 2 (tool spec, observability,
SQLite memory) are table-stakes that any production agent framework ships by default — without
them, the character work sits on a foundation that can't be seen, evaluated, or reproduced.
**Observability (1.5) is deliberately placed before memory (2)** because memory that ships
untraced is memory that can't be debugged when it misbehaves in a v0.10 proactive turn. The
**dream** half of Initiative 2 is where Luna's positioning starts — it is not a generic agent
feature, so it lands as the capstone of the memory work (v0.5.0), once the three layers exist for
it to consolidate. Frontend (6) is last because the wire contract has to stabilize first or the
controller re-ports every minor version. Frame: *build the framework, then build the character on
top* — anything Mastra or LangGraph would ship unmodified goes early; anything that requires
Luna's specific positioning (companion agent, dream, Live2D, proactive) goes later, atop a
foundation already proven.

**Note on the dissolved "Dream engine" initiative (old Order 7):** the original roadmap parked
dream at v0.14+ as a standalone initiative. That was wrong — dream is the consolidation engine the
memory layers cannot function without (reconciliation, diaries, core-memory updates all live in
it). It is now the capstone of Initiative 2 (v0.5.0). Its **auto-trigger** piece is the only part
that defers: it lands with Initiative 5 (proactive), whose idle scheduler it reuses.

## How an initiative is structured

Each initiative folder contains:
- `README.md` — initiative overview + version table + acceptance criteria for "this initiative is
  done."
- One `vX.Y.Z-<theme>.md` per planned version with: **Goal / Status / Backend / Frontend / Tests /
  Risk / Acceptance / Depends / Flag**. Self-contained — should be readable in isolation.

## How versions move

- Versions can shift between initiatives, be deferred, or be merged when reality demands.
- **Always update both the initiative README and this file in the same commit** as the change.
- A version that ships gets removed from this roadmap and logged in
  [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md) with date and theme.
- Initiatives that complete get marked ✅ shipped here (kept for orientation), then archived under
  `../history/roadmap-archived-YYYY-MM/` if the folder gets noisy.

## Initiative 1 — Tool spec foundation (v0.1.0 – v0.3.0)

The single most important block. The Python rewrite was triggered partly because tool calling is
unstable in the current system; the audit traced that to six root causes (five-path mount logic,
56-tool surface, `startswith('Error')` heuristic, no streaming during tools, no verifier loop,
reactive stall detection). v0.1–v0.3 fix all six **by design** before any other feature lands.

| Version | Plan | Theme |
|---|---|---|
| v0.1.0 ✅ | [Bun skeleton + WS server](tool-spec-foundation-2026-06/v0.1.0-bun-skeleton.md) | Project bootstrap; one WS endpoint that echoes typed events — **shipped 2026-06-11** |
| v0.2.0 ✅ | [Typed tool registry + `Result<T>`](tool-spec-foundation-2026-06/v0.2.0-tool-registry.md) | Zod-first tool definitions; discriminated `Result<T>`; 3-state concurrency policy; per-tool `summarize()`; 3 representative tools end-to-end through dispatcher — **shipped 2026-06-11** |
| v0.3.0 ✅ | [Anthropic interleaved tool-use end-to-end](tool-spec-foundation-2026-06/v0.3.0-interleaved-tool-use.md) | First real LLM round trip; tools stream progress through the WS; StateGraph turn loop with `onTransition` instrumentation seam — **shipped 2026-06-11**. yunwu.ai gateway verified (adaptive thinking + signed-block round-trip). |

## Initiative 1.5 — Observability foundation (v0.3.5 – v0.3.6)

The piece Mastra (Telemetry) and LangGraph (LangSmith) ship by default and Luna currently
lacks. Inserted **before** memory because memory bugs that ship untraced are nearly
impossible to debug in proactive turns. See
[`observability-foundation-2026-06/`](observability-foundation-2026-06/).

| Version | Plan | Theme |
|---|---|---|
| v0.3.5 ✅ | [Trace plumbing](observability-foundation-2026-06/v0.3.5-trace-plumbing.md) | `trace_id` propagation; SQLite trace table; instrument the StateGraph + dispatcher tee + outbound. First `bun:sqlite` touch; `sql.ts` WAL/migration pattern v0.4 reuses verbatim — **shipped 2026-06-11**. |
| v0.3.6 ✅ | [Local viewer](observability-foundation-2026-06/v0.3.6-local-viewer.md) | Read-only `/_trace` HTML route over the trace table; per-turn timeline; `LUNA_TRACE` default on — **shipped 2026-06-11**. |

## Initiative 2 — Memory + Dream substrate (v0.4.0 – v0.5.0)

Planned in detail (next up). The three-layer SQLite memory + the dream consolidation engine, ported
from Python Luna's shipped `memory-redesign-dream` initiative (v0.52–v0.57). See
[`memory-dream-substrate-2026-06/`](memory-dream-substrate-2026-06/).

| Version | Plan | Theme |
|---|---|---|
| v0.4.0 | [Memory substrate foundation](memory-dream-substrate-2026-06/v0.4.0-memory-substrate.md) | SQLite-backed `Session` (L1) + L2 full-text timeline; single-writer free via WAL |
| v0.4.1 | [L1 rolling window](memory-dream-substrate-2026-06/v0.4.1-l1-rolling-window.md) | recent-N verbatim + compress-once; never re-compress; L2 re-derive |
| v0.4.2 | [L3 semantic + core memory](memory-dream-substrate-2026-06/v0.4.2-l3-semantic-core.md) | SQLite L3 (5 categories) + `remember`/`forget` upgrade + prose core memory + per-turn injection |
| v0.4.3 | [Hybrid recall](memory-dream-substrate-2026-06/v0.4.3-hybrid-recall.md) | `sqlite-vec` embedding-first + CJK-bigram lexical over L2 + L3 |
| v0.5.0 | [Dream engine](memory-dream-substrate-2026-06/v0.5.0-dream-engine.md) | manual + `enter_dream` tool; 6-step cycle (reconcile / diaries / persona); isolated, manual-wake |

## Initiatives 3, 4, 5 — shipped

Detailed plans live in their folders (kept for orientation, all ✅ shipped):
[`persona-message-tool-2026-06/`](persona-message-tool-2026-06/) (v0.6.0–v0.7.0),
[`action-integrity-2026-06/`](action-integrity-2026-06/) (v0.8.0–v0.9.0),
[`proactive-agency-2026-06/`](proactive-agency-2026-06/) (v0.10.0–v0.11.0).

## Initiative 6 — Frontend port: the body (v0.12.0 – v0.13.3)

The brain, memory, dream, and proactivity ship; this initiative gives Luna a visible, audible body.
v0.12.0 (consumption controller) is shipped; v0.13.x is the **redesigned cute UI + real Live2D + voice**
behind the v0.12.0 sink interfaces — reusing the pixi-live2d/Cubism runtime, the yumi model assets, and
the GPT-SoVITS sidecar, while porting the TS driver glue + the whole page fresh. See
[`frontend-port-2026-06/`](frontend-port-2026-06/).

| Version | Plan | Theme |
|---|---|---|
| v0.12.0 ✅ | (shipped) consumption controller | event → bubble state machine + `Live2DSink`/`AudioSink` interfaces (`packages/web`) — **shipped 2026-06-13** |
| v0.13.0 ✅ | [Cute UI shell](frontend-port-2026-06/v0.13.0-cute-ui-shell.md) | the redesigned page: striped/lace cute style, two-pane layout (**chat LEFT / model RIGHT**, per Alan's overlay reference), user-left/Luna-right bubbles + timestamps + cute tool cards, input bar, 🌙 入梦 — on the shipped controller, stub sinks — **shipped 2026-06-14** |
| v0.13.1 ✅ | [Live2D foundation](frontend-port-2026-06/v0.13.1-live2d.md) | real `Live2DSink`: pixi-live2d + Cubism + yumi; first-cut FaceVM; draggable + persisted; WebGL-guard degrade — **shipped 2026-06-14** |
| v0.13.2 ✅ | [Live2D high-fidelity FaceVM](frontend-port-2026-06/v0.13.2-live2d-fidelity.md) | layered engine + 14 emotions (timelines/overlays/actions) + affect→emotion map — **shipped 2026-06-14** |
| v0.13.3 ✅ | [Voice + lip-sync](frontend-port-2026-06/v0.13.3-tts-lipsync.md) | Web Audio `AudioSink` + RMS lip-sync + GPT-SoVITS proxy client (sidecar reused as-is) — **shipped 2026-06-14** |
| v0.13.4 ✅ | [Polish + close](frontend-port-2026-06/v0.13.4-polish-close.md) | dream overlay + ☀️ wake, thinking indicator, proactive glow, mood pip, scroll pill, settings, reduced-motion + responsive — **shipped 2026-06-14; Initiative 6 ✅ complete** |

## Initiative 7 — Open-source packaging + one-command startup (v0.14.0 – v0.14.2) — ❌ CANCELLED

**Cancelled.** The open-source / Docker-distribution premise was dropped: the project stays local for
now, and TTS keeps the original GPT-SoVITS (local-only, not open-sourced). The one-command startup goal
was met locally outside the roadmap — `bun run dev` ([`scripts/dev-all.ts`](../../scripts/dev-all.ts))
spawns server + web + the GPT-SoVITS sidecar ([`scripts/tts-proxy.cjs`](../../scripts/tts-proxy.cjs), a
thin standalone wrapper over the Python `GptSovitsService`). The plan files below are kept for reference
only; if open-sourcing is revisited, the OSS-hygiene pieces (LICENSE, README rewrite, secret-scan) can
return as a smaller standalone initiative. See [`oss-packaging-2026-06/`](oss-packaging-2026-06/).

| Version | Plan | Theme |
|---|---|---|
| v0.14.0 | [Bundle GPT-SoVITS service](oss-packaging-2026-06/v0.14.0-bundle-tts.md) | `services/tts/gpt-sovits/` (docker-compose) + dev-server translates `{text,voice}`→`api_v2` (drop the Python proxy); weights gitignored |
| v0.14.1 | [One-command launcher](oss-packaging-2026-06/v0.14.1-one-command.md) | `bun run dev`/`start` via `concurrently` (server + web + sidecar) + `bun run setup` (pull image + yumi voice model); cross-platform |
| v0.14.2 | [OSS hygiene + close](oss-packaging-2026-06/v0.14.2-oss-hygiene.md) | MIT LICENSE, README rewrite, `.env.example`, `THIRD_PARTY_LICENSES`, secret-scan, `.gitignore models/` — **Initiative 7 ✅** |

## Initiative 8 — Code-agent capability (v0.15.0 – v0.15.4) — 🟡 PLANNED

Luna's code tools today are minimal, weak at targeting, and locked to one directory. This initiative
rebuilds them into a mainstream code-agent loop — **locate → read → edit → run → verify → iterate** — by
porting Python Luna's filesystem/exec capability and the reliability levers SOTA agents converge on
(read-before-edit, lint-on-write, str_replace-native editing, an Aider-style repo map, a hybrid
ripgrep→tree-sitter locator). The openclaw/Hermes "自编辑·自进化" ask lands the **safe** way the research
mandates: a self-verified skill library + a **human-gated, evaluator-firewalled** self-edit — the agent
can never write the code that judges, sandboxes, or gates it (the Darwin-Gödel-Machine safeguard). Each
risky version is default-off-flagged, jailed, and `proactiveRisk:'surface'`. v0.14.x is skipped (reserved
by cancelled Initiative 7). See [`code-agent-2026-06/`](code-agent-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.15.0 | [Workspace sandbox + read/nav](code-agent-2026-06/v0.15.0-workspace-sandbox-nav.md) | Medium | `resolveInWorkspace` jail + sensitive-path blocklist; windowed `read_file` (+`content_hash`); new `list_files` + ripgrep `grep`. Read-only, ships on |
| v0.15.1 | [Edit tools](code-agent-2026-06/v0.15.1-edit-tools.md) | High | `edit` (str_replace + read-before-edit + uniqueness + fuzzy fallback + `expected_hash`), atomic `multi_edit`, `write_file`, lint-on-write. Flag `LUNA_CODE_WRITE` |
| v0.15.2 | [`shell` + verify loop](code-agent-2026-06/v0.15.2-shell-verify.md) | High | sandboxed `shell` (deny-regex + interactive-block + timeout + jail; subsumes fs-mutation per LD #9) + `typecheck`/`run_tests`/`lint`. Flag `LUNA_SHELL` |
| v0.15.3 | [Repo map + locator + plan](code-agent-2026-06/v0.15.3-repo-map-locator.md) | Medium | Aider-style mtime-cached `repo_map` (tree-sitter WASM) + hybrid `find_symbol` (ripgrep→tree-sitter verify) + `plan` todo spine. Flag `LUNA_REPO_MAP` |
| v0.15.4 | [Skills + firewalled self-edit](code-agent-2026-06/v0.15.4-skills-self-edit.md) | High | self-verified skill library (`save_skill` verify-before-persist / `recall_skill`) + propose-only `propose_self_edit` with the evaluator firewall in `resolveInWorkspace`. Flags `LUNA_SKILLS`, `LUNA_SELF_EDIT` — **Initiative 8 ✅** |
