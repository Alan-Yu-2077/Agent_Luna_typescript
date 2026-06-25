# Roadmap — Agent_Luna (TypeScript)

Forward development plan for the TypeScript rewrite. Each initiative is a folder of staged,
self-contained version plans, executed one at a time. Version numbers reserve across initiatives so
they never overlap.

> **Main head: v0.21.10** (branch `feat/weather-perception`). **Initiatives 8–12 all ✅ shipped + merged**: code-agent capability
> (v0.15.x), audit remediation (v0.16.x), memory-depth correction (v0.17.x), **web tools (Initiative 11,
> v0.18.0–v0.18.3)** — `web_search` + a DNS-**pinned** SSRF-guarded `web_fetch` + the standing injection
> defense + citations, default-on — and **time perception (Initiative 12, v0.19.0–v0.19.2)** — cache-safe
> passive time injection + memory temporal grounding + bounded subjective time, default-on. Plus C-side
> patches v0.17.2/v0.17.3 (memory) and v0.18.4 (a top-level text leak no longer stored as the reply).
> **Initiative 13 — deep-audit remediation** (v0.20.0–v0.20.9) ✅ **shipped on `feat/deep-audit-remediation`**:
> the 45 adversarially-confirmed findings from the 2026-06-20 26-domain line-by-line audit are fixed across
> 10 risk-ordered versions (all 6 high + the confirmed mediums, red→green regressions; 3 owner-decision
> items deferred). **735 tests green** (667→735, +68), `tsc` clean ×3. Awaiting merge to `main`.
> **Initiative 14 — weather perception ✅ shipped** (v0.21.0–v0.21.2, branch `feat/weather-perception`): a no-key location-based `weather` tool
> (A) + cache-safe ambient awareness in the uncached tail (B) + a natural after-a-night proactive mention
> (C) — the Initiative-12 shape, net-new over Python.
> **Initiative 15 — proactive pipeline redesign 🟡 PLANNED** (v0.22.0–v0.22.3): the proactive system is
> *configured on* but has **never once spoken** (live data: every `proactive_wake` decision is `hold`,
> **0 `act` ever**; 0 scheduler-driven proactive messages). Replace the per-tick **LLM wake-gate** with
> cheap **deterministic trigger detectors** feeding the existing **silence-capable** turn graph — the
> proactive turn's own `{spoke}` becomes the only "should I speak?" judgment (drafting-as-decision).
> ~100–300× less proactive token spend; **0 → a reliable handful of messages/day**.
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
> workspace IDE, persona fixes, clause-cap. **Next: Initiative 11 (web tools — agent-side networking)** — see
> below and [`../history/DEVELOPMENT.md`](../history/DEVELOPMENT.md).

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
| 8 | v0.15.0 – v0.15.4 | **Code-agent capability** — turn Luna's minimal, directory-locked code tools into a mainstream code-agent loop: a **workspace sandbox** + windowed read / list / ripgrep nav (v0.15.0), **str_replace-native edit** tools with read-before-edit + lint-on-write (v0.15.1), a **sandboxed `shell`** + typecheck/test/lint **verify loop** (v0.15.2), an Aider-style **repo map** + tree-sitter **symbol locator** + `plan` tool (v0.15.3), and a **self-verified skill library + firewalled, human-gated self-edit** (v0.15.4). Ports Python's filesystem/exec capability; diverges to str_replace-native editing + a hard **evaluator firewall** (the agent can never write the code that judges/sandboxes it — the DGM safeguard). v0.14.x skipped (reserved by cancelled Initiative 7). | [`code-agent-2026-06/`](code-agent-2026-06/) | ✅ shipped 2026-06-15 (5 versions) |
| 9 | v0.16.0 – v0.16.3 | **Audit remediation** — fix the code-verified findings from the audits in PRs #1/#2 (all re-confirmed at HEAD v0.13.13): close the **unauthenticated network surface** (loopback bind closes S1/S2/S3; dev-tools gate; input caps — v0.16.0), kill the **recompute-every-turn** pattern (memoize the system block, trace retention, recall over-fetch + `content_hash`, recall off the TTFT path — v0.16.1), finish the **structural** items (incremental `history_json`, decide `vec0` wire-or-remove, drop the dead text-mode path — v0.16.2), and **clean durable history** (strip thinking + collapse old tool I/O so a turn ≈ 200 tokens — v0.16.3, the foundation Init 10's deeper window builds on). `read_file` sandbox (S4) is already owned by Init 8/v0.15.0, not duplicated. | [`audit-remediation-2026-06/`](audit-remediation-2026-06/) | ✅ shipped 2026-06-16 (4 versions) |
| 10 | v0.17.0 – v0.17.1 | **Memory depth correction** — the **owner's design correction** (PR #3, all claims code-confirmed), target design settled with the owner after a SOTA review: the shipped L1 window is ~4–9 turns (a 24-message cap) and diaries are written but **never injected**. Restore depth as a **memory gradient** — a **~100 clean-turn verbatim window** (`LUNA_L1_RECENT_TURNS` 40–150; affordable because v0.16.3 makes a turn ≈ 200 tokens) + **structured bounded compression** + **importance anchors** (v0.17.0) + the **diary as the injected cross-day/week layer** (standing digest + recall candidates; monthly; recency×importance×relevance ranking — v0.17.1; amend LD #12). Ordered after Init 9 by *dependency* (clean history + efficiency fixes make the deep window cheap), not by priority. | [`memory-depth-2026-06/`](memory-depth-2026-06/) | ✅ shipped 2026-06-16 (2 versions) |
| 11 | v0.18.0 – v0.18.2 | **Web tools (agent-side networking)** — give Luna the open web: `web_search` (client-side, provider abstraction, Tavily default; the Python `web_search` ported + the *"嘴上说手没动"* defection guard) — v0.18.0; `web_fetch` + the **SSRF/extraction safety core** (deny-list IP guard + redirect re-validation + DNS-rebinding pin + Readability/Turndown extraction + `<untrusted_content>` delimiting) — v0.18.1; then **integration** — the search→fetch loop, standing injection system-rule + read/write boundary, citation surfacing, optional fetch cache, measured + **default-flipped on** — v0.18.2. Client-side because the yunwu gateway strips Anthropic's native server tools. | [`web-tools-2026-06/`](web-tools-2026-06/) | ✅ shipped 2026-06-16 |
| 12 | v0.19.0 – v0.19.2 | **Time perception** — give Luna a real sense of time (she has only a pull `time_now` tool today, so she drifts — calling an hour-ago event "yesterday"). Layered, from a 2023–2026 SOTA review: **(A)** cache-safe **passive time injection** in the per-turn uncached tail (local time + daypart + TS-precomputed elapsed-since-last + session bucket) — v0.19.0; **(B)** **memory temporal grounding** — relative-time labels + chronological order on recalled candidates, reusing Init 10's GA recall ranking — v0.19.1; **(C)** a bounded **subjective-time** layer (daypart-mood + felt absence) wired into the dream/proactive cycle, warmth-not-guilt — v0.19.2. Core rule: do all temporal arithmetic in TS, hand Claude labeled facts (benchmarks show LLMs can't reliably compute "how long ago"). Ports + beats Python's `temporal_reasoning` (adds B + cache-safe placement). | [`time-perception-2026-06/`](time-perception-2026-06/) | ✅ shipped 2026-06-17 (3 versions) |
| 13 | v0.20.0 – v0.20.9 | **Deep-audit remediation** — fix the **45 adversarially-confirmed findings** (6 high / 30 medium / 9 medium→low) from the 2026-06-20 26-domain line-by-line audit (78 agents, every source file + sibling tests read in full, each serious finding independently re-verified). Risk-ordered, independently-shippable slices: the **shell/verify safety-gate cluster** (argv-spawn the verify tools to kill command-injection + the deny-gate bypass, broaden the deny-regex, firewall the enforcer files, close the `$HOME` secret-path indirection + grep symlink-to-secret, real process-tree kill + abort + tree-sitter parser free — v0.20.0–v0.20.2), then **user-facing correctness** (IME-safe Enter for Chinese input, wire barge-in, `formatGap` "Nh 60m", `LUNA_TZ` brick — v0.20.3–v0.20.4), then **memory/data integrity** (recall diary-drop + starvation + embedding dim guard, keep-newest-turns, empty-digest guard, atomic writes, fuzzy uniqueness — v0.20.5–v0.20.7), then **resilience** (trace-flush guard, turn abort on disconnect, keepalive ping, TTS latch self-heal — v0.20.8), then **contract/config/test-debt** (dead schema prune, `.env.example`, the untested SSRF DNS-pin, cosmetic UI nits — v0.20.9). Distinct from Initiative 9 (the v0.16.x PR#1/#2 remediation); this is the v0.19.2 full-tree pass. | [`deep-audit-remediation-2026-06/`](deep-audit-remediation-2026-06/) | ✅ shipped 2026-06-20 (branch) |
| 14 | v0.21.0 – v0.21.2 | **Weather perception** — give Luna a sense of the **weather where her person is** + the judgment to mention it *naturally* (care, not forecast); layered like Initiative 12: a no-key **Open-Meteo** model-callable **`weather` pull tool** (A, v0.21.0) — location via an explicit `LUNA_LAT_LON` knob (IP-geolocation is out behind the fake-IP proxy); **passive ambient awareness** — a TTL-cached, background-refreshed snapshot in the per-turn **uncached** tail like the time block (B, v0.21.1); a **proactive weather note** in the after-a-night / morning wake, gated on the existing daypart+new-day signal (C, v0.21.2). Volatile→uncached-tail (cache invariant), off-hot-path (no inline fetch), care-not-forecast guardrail. Net-new (Python has no weather). | [`weather-perception-2026-06/`](weather-perception-2026-06/) | ✅ shipped 2026-06-21 (branch) |
| 15 | v0.22.0 – v0.22.3 | **Proactive pipeline redesign** — the proactive system is "on" but has **never once spoken** (live trace data: every `proactive_wake` decision is `hold`, **0 `act` ever**; 0 scheduler-driven proactive messages; the few `proactive%` L2 rows are continuations). Replace the per-tick **LLM wake-gate** (it decides *before* drafting, is calibrated to "stay quiet", and fails-closed on bad JSON) with cheap **deterministic trigger detectors** feeding the existing **silence-capable** turn graph — the proactive turn's own `{spoke}` becomes the only "should I speak?" judgment (drafting-as-decision). **Detector-MVP** (after-a-night + spoke/silent quota split; wake-gate→flag — v0.22.0), **registry + scheduled slots** + migration `0013` (v0.22.1), **event hooks + debounce + weather-shift** (v0.22.2), **fuzzy detectors + delete the wake-gate** (v0.22.3). ~100–300× less proactive token spend; **0 → a reliable handful of messages/day**. Distinct from Initiative 5 (which built the proactive *turn*; this replaces the *wake decision*). | [`proactive-pipeline-redesign-2026-06/`](proactive-pipeline-redesign-2026-06/) | 🟡 PLANNED |

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

## Initiative 9 — Audit remediation (v0.16.0 – v0.16.3) — ✅ SHIPPED

Remediates the **code-verified** findings from two audits (PRs #1 `CODE_AUDIT.md` + #2
`ARCH_EFFICIENCY.md`), every claim re-confirmed against HEAD v0.13.13 (28/28, 0 refuted). Three
risk-ordered slices: cheap-and-safe security/hygiene, then per-turn recompute removal, then the
structural persistence/dead-infra items. `read_file` sandbox (audit S4) is **not** here — Initiative 8 /
v0.15.0 already owns it. See [`audit-remediation-2026-06/`](audit-remediation-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.16.0 | [Security + hygiene](audit-remediation-2026-06/v0.16.0-security-hygiene.md) | Low | Loopback bind (S1→closes S2/S3 net exposure), `LUNA_DEV_TOOLS` gate (S2), `chat.send` caps + `maxPayloadLength` (S5), CI (C1), README/orient refresh (Doc1/2), WS-resilience / clock / blob nits (C2/C3/C4) |
| v0.16.1 | [Recompute efficiency](audit-remediation-2026-06/v0.16.1-recompute-efficiency.md) | Low–Med | Memoize the system block per turn w/ dirty-flag (A1), `traces` retention + bounded viewer (A4), cap `listL2` + persist `content_hash` column (A2), recall query-embed off the TTFT path (P1, `LUNA_RECALL_ASYNC`) |
| v0.16.2 | [Persistence + vec0](audit-remediation-2026-06/v0.16.2-persistence-vec0.md) | Medium | Incremental `history_json` / rebuild-window-from-L2 (A3/P2), **decide `vec0`** — wire KNN or remove the dep (D1/P3), remove the dead text-mode/`reply.token` path (D2) |
| v0.16.3 | [Clean durable history](audit-remediation-2026-06/v0.16.3-clean-history.md) | Low–Med | **Strip thinking + collapse old tool-result payloads** from stored history (keep the `tool_use` record, drop the re-fetchable payload — Anthropic's own context-editing pattern) → a turn ≈ 200 clean tokens. *Discussion-derived; the efficiency foundation Init 10's deep window needs* — **Initiative 9 ✅** |

## Initiative 10 — Memory depth correction (v0.17.0 – v0.17.1) — ✅ SHIPPED

The **project owner's** correction of memory-design intent (PR #3 `MEMORY_DESIGN_DIVERGENCE.md`, all 8
code claims confirmed): the shipped L1 window is ~4–9 turns (a hard 24-*message* cap) and the diary /
weekly summaries are written but **never injected** into context — so Luna "记得太短". Target design
settled with the owner after a SOTA review (Letta/MemGPT, Mem0, Generative Agents): restore depth as a
**memory gradient** — a **~100 clean-turn verbatim window** (`LUNA_L1_RECENT_TURNS` 40–150) + structured
bounded compression + importance anchors + the **diary as the injected cross-day/week layer** — amending
**LD #12**. Affordable because Luna's replies are short (a *clean* turn ≈ 200 tokens, so ~100 turns ≈ 20k
tokens) once thinking + tool-spew are kept out of durable history (v0.16.3). Ordered after Initiative 9 by
*dependency* — v0.16.3 clean history + the memoize/incremental/off-hot-path fixes make the deep window
cheap; *reorderable* if the owner wants depth first (then v0.16.3 + A1/A3/P1 land alongside v0.17.0). See
[`memory-depth-2026-06/`](memory-depth-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.17.0 | [L1 window depth](memory-depth-2026-06/v0.17.0-l1-window-depth.md) | Medium | L1 verbatim window → **~100 clean turns** (`LUNA_L1_RECENT_TURNS` 40–150, ≈ 20k tokens via v0.16.3) + **structured bounded compression** of older history (replaces the unbounded `rolling_summary`) + **importance anchors**; unit back to *turns*; amend LD #12 + supersede v0.4.1; cost measured before flip |
| v0.17.1 | [Diary injection](memory-depth-2026-06/v0.17.1-diary-injection.md) | Medium | Inject day/week/**month** diaries (standing system-block digest + `'diary'` recall candidates so `rag_refresh`'s embeddings are finally retrieved); generate monthly diaries; amend LD #12 diary part — **Initiative 10 ✅** |

## Initiative 11 — Web tools (agent-side networking) (v0.18.0 – v0.18.2) — ✅ SHIPPED

The brain, memory, dream, proactivity, body, and code-agent all ship; the missing capability is **the open
web**. Give Luna both halves of agent networking — **find** (`web_search`) and **read** (`web_fetch`) — driving
the search→fetch→reason loop herself. Python shipped only `web_search` (Tavily); this **ports that and adds the
fetch half she never had**, with the security a URL-reader demands done **client-side**, because the yunwu
gateway strips Anthropic's native server tools. The tools are ordinary `defineTool`s (inherit timeout/abort/
tracing), `proactiveRisk:'safe'` per LD #15 (*searches may run silently*), flag-gated until proven. The
risk-isolating split lands the SSRF/injection surface in its own version, the Initiative-8 `shell` discipline.
See [`web-tools-2026-06/`](web-tools-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.18.0 ✅ | [web_search](web-tools-2026-06/v0.18.0-web-search.md) | Medium | Client-side `web_search` on the dispatcher (provider abstraction, **Tavily** default); soft-fail + `[N]` citations; the **defection guard** (L1 commitment clause + intent-no-call audit, extending LD #14); conservative L1 "when to reach for the web". `proactiveRisk:'safe'`. Flag `LUNA_WEB_SEARCH` — **shipped 2026-06-16** |
| v0.18.1 ✅ | [web_fetch + safety core](web-tools-2026-06/v0.18.1-web-fetch-safety.md) | High | `web_fetch` + the **SSRF guard** (`assertPublicUrl`: deny-list IPs + non-`http(s)` + redirect re-validation + DNS-rebinding pin) + `@mozilla/readability`→Turndown extraction + size/time caps + `<untrusted_content>` envelope. Guard joins the evaluator-firewall set. Flag `LUNA_WEB_FETCH` — **shipped 2026-06-16** |
| v0.18.2 ✅ | [Integration + hardening](web-tools-2026-06/v0.18.2-integration-hardening.md) | Medium | search→fetch loop validated; standing injection system-rule + read/write boundary audit; **citation surfacing** (wire + L2 + UI source cards); optional fetch cache (migration `0012`); cost measured; **default-flip both on** — **Initiative 11 ✅ shipped 2026-06-16** |
| v0.18.3 ✅ | [web_fetch DNS pin](web-tools-2026-06/v0.18.3-fetch-pin-followup.md) | Medium | verified IP-pinned fetch (node:http(s) custom lookup) closing the rebinding TOCTOU; unblock the 198.18/15 fake-IP proxy range; `web_fetch` default-on; clickable scheme-validated citation chips — **shipped 2026-06-16** |

## Initiative 12 — Time perception (v0.19.0 – v0.19.2) — ✅ SHIPPED

Luna has no real sense of time — only a pull `time_now` tool — so she drifts (calls an hour-ago event
"yesterday"). A 2023–2026 SOTA review (TimeQA/Test-of-Time/TicToc temporal-reasoning benchmarks;
Generative-Agents recency memory; ComPeer proactive timing; Anthropic prompt-cache docs) settled a **layered**
design with one governing rule: **do all temporal arithmetic in TypeScript and hand Claude labeled facts** —
the benchmarks show LLMs can't reliably compute "how long ago", so her drift is *her doing the subtraction*.
Time content lives in the **uncached tail** (never the cached system prefix — prompt-cache invariant). Ports +
beats Python's `temporal_reasoning` (adds the memory-grounding layer B + cache-safe placement + a
warmth-not-guilt guardrail). See [`time-perception-2026-06/`](time-perception-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.19.0 | [A — passive time injection](time-perception-2026-06/v0.19.0-passive-time-injection.md) | Low–Med | TS-computed time block (local time + day-of-week + daypart + **elapsed-since-last** + **session bucket**) pushed into the per-turn **uncached** user message; L1 clause (inform tone, don't announce, don't self-compute). Kills the "yesterday" drift. Flag `LUNA_TIME_AWARE` |
| v0.19.1 | [B — memory temporal grounding](time-perception-2026-06/v0.19.1-memory-temporal-grounding.md) | Medium | `renderRecallBlock` renders a **relative-time label** (`3 days ago`/`this morning`) per recalled candidate from its `t_ms` + **chronological** order; reuses Init 10's GA recall ranking. The real fix for dating past events. Flag `LUNA_RECALL_TIME_LABELS` |
| v0.19.2 | [C — subjective time + close](time-perception-2026-06/v0.19.2-subjective-time-close.md) | Medium | bounded **daypart-mood + felt-absence** signal (code-computed, suggestive) threaded into the dream/proactive framing; **warmth-not-guilt** L1 guardrail; measure (cache hit-rate unchanged) + **default-flip** A/B/C on — **Initiative 12 ✅**. Flag `LUNA_TIME_SUBJECTIVE`. (Option D — bi-temporal memory — deferred.) |

## Initiative 13 — Deep-audit remediation (v0.20.0 – v0.20.9) — ✅ shipped (branch `feat/deep-audit-remediation`)

Remediates the **45 adversarially-confirmed findings** from the 2026-06-20 26-domain line-by-line deep
audit (78 agents read every source file + sibling tests in full; each serious finding was independently
re-verified by a second agent, refuting 6 false positives incl. a mis-flagged "high"). Baseline at audit
time: `tsc` clean ×3, **667/667 tests green** — the rewrite is structurally sound; these are correctness,
safety-gate, resource, and contract fixes, no new features. Risk-ordered, each version independently
shippable. Distinct from **Initiative 9** (the v0.16.x PR#1/#2 remediation). Governing context: Luna is
single-user / model-is-sole-actor / no-root-jail-by-owner-decision, so the "security" fixes harden
safety gates the model can trip (LD #10 deny-regex, LD #14 evaluator firewall), not remote-attacker
holes. See [`deep-audit-remediation-2026-06/`](deep-audit-remediation-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.20.0 | [Shell deny-gate integrity](deep-audit-remediation-2026-06/v0.20.0-shell-deny-gate-integrity.md) | High | argv-spawn `typecheck`/`run_tests`/`lint` (kill command-injection + the deny-gate bypass), broaden the deny-regex (`find -delete`, more interpreters, intermediate-pipe, empty-quote), add the enforcer files to `evaluatorFiles()`. Bypass strings added to the tests first |
| v0.20.1 | [Secret-blocklist hardening](deep-audit-remediation-2026-06/v0.20.1-secret-blocklist-hardening.md) | Medium | refuse `$HOME`/`${VAR}`/backtick path indirection to secret dirs, per-file `resolveInWorkspace` in grep's JS fallback, symlink-escape gate in `fsScan.walk` |
| v0.20.2 | [Subprocess & resource cleanup](deep-audit-remediation-2026-06/v0.20.2-subprocess-resource-cleanup.md) | Medium | real process-tree kill (own group / descendant enumeration), thread abort into grep/find_symbol/repo_map, free the tree-sitter `Parser`, clear escalation timers |
| v0.20.3 | [Frontend input & interrupt](deep-audit-remediation-2026-06/v0.20.3-frontend-input-interrupt.md) | Low–Med | IME-composition Enter guard (Chinese input), wire barge-in (`audio.stop()` on new turn) + abortable TTS fetch/decode, finalize the text-mode reply bubble |
| v0.20.4 | [Temporal correctness](deep-audit-remediation-2026-06/v0.20.4-temporal-correctness.md) | Low | `formatGap` "Nh 60m" carry fix, validate `LUNA_TZ` (degrade-not-brick) |
| v0.20.5 | [Recall correctness](deep-audit-remediation-2026-06/v0.20.5-recall-correctness.md) | Low–Med | `recall` timeline includes diary, scope pushed into `retrieve()` (no starvation), embedding dimension guard + model in cache key |
| v0.20.6 | [Memory fold & summarization integrity](deep-audit-remediation-2026-06/v0.20.6-memory-fold-integrity.md) | Medium | `loadSession` keeps newest turns, `maybeFold` empty-digest guard, drop adaptive thinking from `complete()`, dream salience length check |
| v0.20.7 | [Edit & code-map correctness](deep-audit-remediation-2026-06/v0.20.7-edit-codemap-correctness.md) | Low–Med | atomic temp+rename writes, fuzzy multi-window uniqueness fix, `isExported` class-method fix |
| v0.20.8 | [Resilience & lifecycle](deep-audit-remediation-2026-06/v0.20.8-resilience-lifecycle.md) | Low–Med | guard off-path trace flush, turn abort on disconnect, continuation `.unref()`+cancel, wakeGate anti-repeat; client keepalive ping, reconnect stability window, `warmUpTts` timeout, TTS latch self-heal |
| v0.20.9 | [Contract, config & test-debt](deep-audit-remediation-2026-06/v0.20.9-contract-config-testdebt.md) | Low | prune dead protocol schemas + tighten `Citation.url`/`ToolEvent.tool_name`, `.env.example` + `.prettierignore`, the **untested SSRF DNS-pin** + provider/`fsScan` tests, cosmetic UI nits — **Initiative 13 ✅** |

## Initiative 14 — Weather perception (v0.21.0 – v0.21.2) — ✅ shipped (branch `feat/weather-perception`)

Gives Luna a sense of the **weather where her person is** and the judgment to mention it *naturally*
(care, not forecast) — the layered shape of Initiative 12 (time): a model-callable **`weather` pull
tool** (A), **passive ambient awareness** injected into the per-turn **uncached** tail like the time
block (B), and a **proactive weather note** woven into the after-a-night / morning wake (C). Source:
**Open-Meteo** (free, **no API key**, lat/lon); location is an explicit `LUNA_LAT_LON` knob (degrade
like `LUNA_TZ`; IP-geolocation is out — the fake-IP proxy reports the exit node). Net-new (Python has
no weather feature). Governing constraints: weather is **volatile → uncached tail only** (the prompt-
cache invariant), **no blocking fetch on the reactive path** (a TTL-cached, background-refreshed
snapshot read synchronously), and **care-not-forecast** (the warmth-not-guilt sibling). See
[`weather-perception-2026-06/`](weather-perception-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.21.0 | [Weather tool + location config](weather-perception-2026-06/v0.21.0-weather-tool.md) | Low–Med | `LUNA_LAT_LON` resolver (degrade like `resolveTz`) + a no-key Open-Meteo client (WMO-code map, `assertPublicUrl` SSRF-validate + plain JSON GET — **not** `safeFetch`, whose text-only gate rejects JSON; soft-fail; test seam) + a `weather` pull tool registered in the 3 places. Flag `LUNA_WEATHER` (off) |
| v0.21.1 | [Passive ambient awareness](weather-perception-2026-06/v0.21.1-ambient-weather.md) | Medium | a TTL-cached, **background-refreshed** snapshot read **synchronously** + a pure `buildWeatherBlock` pushed into the **uncached** tail next to `buildTimeBlock`; a stable data-free `WEATHER_CLAUSE` in the cached contract. She *knows* without a tool call. Flag `LUNA_WEATHER_AMBIENT` (off) |
| v0.21.2 | [Proactive weather + close](weather-perception-2026-06/v0.21.2-proactive-weather-close.md) | Medium | the `afterANightOpening` boolean (composed from existing `temporalContext` helpers) gates a bounded `weatherNoteFor()` suggestion in `framing()` after the felt-absence clause (morning only); the care-not-forecast guardrail; measure cache-hit-rate + **default-flip A/B/C on** — **Initiative 14 ✅**. Flag `LUNA_WEATHER_PROACTIVE` (off→flip) |

## Initiative 15 — Proactive pipeline redesign (v0.22.0 – v0.22.3) — 🟡 PLANNED

The proactive system runs but **never fires**: every `proactive_wake` decision in the product's life is
`hold` (0 `act`), the LLM wake-gate decides *before* drafting + is calibrated to stay quiet + fails-closed
on bad JSON. Replace it with **deterministic trigger detectors** → the existing **silence-capable** turn
graph, where the proactive turn's own `{spoke}` is the only judgment (drafting-as-decision). LLM only
*drafts* on a concrete code-detected reason. Folder: [`proactive-pipeline-redesign-2026-06/`](proactive-pipeline-redesign-2026-06/).

| Version | Plan | Risk | Theme |
|---|---|---|---|
| v0.22.0 | [Detector-MVP](proactive-pipeline-redesign-2026-06/v0.22.0-detector-mvp.md) | Low | inline after-a-night detector replaces the wake-gate call; **spoke/silent quota split** (a silent draft doesn't burn the daily budget); `wakeGate` behind `LUNA_PROACTIVE_LLM_GATE` (default off). **She starts speaking.** |
| v0.22.1 | [Detector registry + scheduled slots](proactive-pipeline-redesign-2026-06/v0.22.1-detector-registry-slots.md) | Medium | `safetyRail`/`considerProactive` split; `detectors.ts` registry (after-night + scheduled-window); migration `0013` (per-day slot bitmask); `LUNA_PROACTIVE_SLOTS` — a guaranteed daily speaking floor |
| v0.22.2 | [Event hooks + debounce + weather-shift](proactive-pipeline-redesign-2026-06/v0.22.2-event-hooks-debounce.md) | Medium | per-detector debounce; `weatherShift` detector; fire the same `evaluateDetectors` funnel from `ws` reconnect-after-a-night + the weather refresher (natural-instant, not the 60s grid); one shared single-turn lock |
| v0.22.3 | [Fuzzy detectors + close](proactive-pipeline-redesign-2026-06/v0.22.3-fuzzy-detectors-close.md) | Low | `openThreadAged` + `promisedFollowThrough` (default OFF, soft-seed); **delete `wakeGate`** + its failure classes; a dev force-trigger; **Initiative 15 ✅** |
