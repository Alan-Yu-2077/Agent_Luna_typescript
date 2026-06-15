# Initiative 10 — Memory depth correction (owner's design correction)

> **Status: 📋 PLANNED.** Priority: after Initiative 9 (audit remediation) — *by dependency, not by
> importance*. Version range: **v0.17.0 – v0.17.1** (2 versions). Master index:
> [`../README.md`](../README.md). Source: PR #3 ([`MEMORY_DESIGN_DIVERGENCE.md`]), the **project
> owner's** correction of memory-design intent, every code claim re-verified against HEAD (v0.13.13);
> the target design below was **settled with the owner after a SOTA review** (Letta/MemGPT, Mem0,
> Generative Agents, Anthropic context-engineering docs — June 2026).

## The idea

The shipped memory remembers **too little, too briefly** — *"完全不符合我本人的设计"*. Two code-confirmed
divergences: the **L1 active window is ~4–9 turns** (a hard 24-*message* cap) and the **diaries are
written but never injected** (the long-range layer contributes nothing to what Luna knows). This
initiative restores depth as a **memory gradient** (the shape SOTA companions converge on): a generous
**recent verbatim window of clean conversation**, a **structured bounded compression** of older history,
and the **diary as the injected cross-day/cross-week layer** — with thinking + tool-spew kept *out* of
durable context (Initiative 9 / v0.16.3) so the deep window is cheap. It amends LD #12.

## Why this is Order 10 (a dependency, not a deprioritization)

This is the owner's stated priority and arguably the most product-important work in the queue — *"她记得
太短"* is a core companion failure. It lands **after** Initiative 9 purely by technical dependency: the
deep window only stays within the speed goal once Init 9 has (a) **stripped thinking + collapsed tool I/O
from stored history (v0.16.3)** so a turn is ~200 tokens not ~1–2k, (b) **memoized the system block
(A1)**, (c) **made `history_json` incremental (A3)**, and (d) **taken recall off the TTFT path (P1)**.
With those, a ~100-turn window is ~20k tokens — cheap. *Reorderable if the owner wants depth first — but
then v0.16.3 + A1/A3/P1 must land alongside v0.17.0, not after.* As the owner put it: *"速度优化不得以牺牲
记忆深度为前提默默实现"* — depth is the requirement; the speed work serves it.

## Verified facts (PR #3 claims, re-confirmed at HEAD v0.13.13, with citations)
8/8 confirmed; central thesis code-accurate.
1. **Window values** — `KEEP_MSGS = 24`, `FOLD_MIN_BATCH_MSGS = 12`, fold fires when verbatim > 36
   (`memory/l1Window.ts:6,7,46`).
2. **Unit is messages, not turns** — the window slices `session.history` by message count
   (`l1Window.ts:20,45`); a message-mode turn appends ~4–6 messages (`runTurn.ts:173,239,372`) →
   `KEEP_MSGS=24` ≈ **4–9 turns verbatim**. (And each stored turn carries thinking + full tool_results,
   which is *why* 24 messages is so few exchanges — addressed by v0.16.3.)
3. **The v0.4.1 plan itself specified "12 pairs"** in a *turns* unit (`LUNA_L1_RECENT_TURNS`,
   `roadmap/memory-dream-substrate-2026-06/v0.4.1-l1-rolling-window.md:22`); the shipped code used
   `LUNA_L1_KEEP_MSGS` (messages) — an already-shrunken plan, unit changed.
4. **Diaries never injected** — no context-assembly path reads `diaries`: `renderCoreBlock.ts`,
   `l1Window.ts buildActiveContext`, `recall/recall.ts collectCandidates` (`Candidate.source` = `'l2' |
   'l3'`, `:109`). Only `dream/cycle.ts` reads diaries (day→week rollup + `rag_refresh`).
5. **LD #12 codified it** — `REWRITE_CONTEXT.md:47,188`: *"Diary … is a dream OUTPUT living in L2, not a
   4th layer"*; only core prose is always-injected.
6. **Diaries embedded but unretrievable** — `rag_refresh` embeds diary text (`dream/cycle.ts:214`) but
   `collectCandidates` excludes them → vectors never scored (dead work).
7. **Monthly diaries never generated** — `diaryPrompt` supports `'month'` (`dream/prompts.ts:71,77`) but
   `cycle.ts` only writes `'day'`/`'week'` (`:176,200`).
8. **What enters context today** — ~24-msg window + a growing `rolling_summary` + recall (500 L2 + L3,
   `RETRIEVAL_K=12`, 300-char slices) + core prose. **No periodic-diary narrative** — the root of "记忆太短".

## The target design (settled with the owner)

Decided after reviewing how the field handles recent-window-vs-long-term. The SOTA verdict: depth comes
from a **gradient + reflection**, not a giant verbatim buffer (Mem0's LOCOMO result: distillation beats
full-context on cross-day recall *and* is ~90% cheaper; Generative Agents' "reflection" = the diary
mechanism; "fidelity gradient" is the named pattern). Luna's twist: **her replies are short** (`message`
caps at 280 chars), so a *clean* turn is ~200 tokens — 50–250× smaller than a code-agent turn — so the
aggressive-eviction numbers in the literature don't bind, and a generous verbatim window is affordable.

| Layer | Decision | Delivers |
|---|---|---|
| Clean turns | strip thinking + collapse tool I/O from stored history (**v0.16.3**) | a turn ≈ 200 tokens → deep window is cheap |
| Recent verbatim window | **~100 clean turns** (`LUNA_L1_RECENT_TURNS`, range 40–150, default ~100 ≈ 20k tokens) | high-fidelity recent texture |
| Older history | **structured, size-bounded** compression (replaces the unbounded `rolling_summary`) + **importance anchors** (salient turns resist compression) | "记得这一两百轮的要点", without bloat |
| Cross-day/week | **diary injection** — standing system-block digest **and** `'diary'` recall candidates; generate monthly | "记得这几天、这几周" (highest leverage for 记得太短) |

Ceiling is **quality, not cost** (context rot mild at 20–30k; diminishing returns past ~100 recent
turns) — so ~100 sits in the sharp regime with env headroom to 150.

## Decision being amended
- **LD #12** (`REWRITE_CONTEXT.md`) — "diary is an L2 archive, not injected" + the L1-window size — is
  **superseded**: diary becomes an **injected long-range layer**; L1 window = **~100 verbatim turns**
  (env 40–150), unit *turns*, with structured-bounded compression + importance anchors. v0.17.x amends
  REWRITE_CONTEXT in the same change set.
- **v0.4.1 plan** — "12 pairs" default + messages unit — superseded.

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.17.0](v0.17.0-l1-window-depth.md) | v0.17.0 | L1 window → **~100 clean turns** (`LUNA_L1_RECENT_TURNS` 40–150) + structured bounded compression + importance anchors; amend LD #12 / v0.4.1 | Medium | Init 9 (v0.16.3, A1/A3/P1) | 📋 |
| [v0.17.1](v0.17.1-diary-injection.md) | v0.17.1 | Diary **injection** (standing digest + `'diary'` recall candidates) + monthly diaries + GA-style recency×importance×relevance recall; amend LD #12 diary part | Medium | v0.17.0 | 📋 |

## Acceptance criteria (whole initiative)
- [ ] L1 verbatim window = **~100 clean turns** (env 40–150), unit *turns*; older history compressed to a
      **structured, size-bounded** gist (no unbounded growth); importance anchors keep salient turns sharp.
- [ ] Day / week / **month** diaries are **injected** — a standing digest + retrievable `'diary'` recall
      candidates (so `rag_refresh`'s embeddings are actually scored); monthly diaries generated.
- [ ] `REWRITE_CONTEXT.md` LD #12 amended (diary = injected long-range layer; L1 = ~100 turns); v0.4.1
      marked superseded.
- [ ] Input-token + TTFT measured at the new window and recorded; depth met without a silent shrink.
- [ ] `tsc` clean + `bun test` green per version.

## Open questions (most now settled; remaining)
- **Settled:** window ≈ 100 clean turns (env 40–150); compression = structured-bounded + importance
  anchors; injection = standing digest **and** recall candidates; thinking/tool kept out of durable
  history (v0.16.3).
- **Open #1 — importance signal**: how is "importance" scored for the anchors + recall ranking — an LLM
  1–5 rating at fold/dream time, or a heuristic (named entities / first-person disclosure / emotional
  markers)? (Recommend: cheap heuristic first, LLM rating at dream time if it underperforms.)
- **Open #2 — vec0 (joint with Init 9 Open Q #2)**: the larger corpus (deeper window + diary candidates)
  may tip the `vec0` decision toward *wire KNN* rather than *remove*. Decide jointly at build.
- **Open #3 — digest cadence/size**: how long a standing diary digest, refreshed how often (per dream
  cycle)? (Recommend: a few hundred tokens, refreshed when a new day/week/month diary is written.)
