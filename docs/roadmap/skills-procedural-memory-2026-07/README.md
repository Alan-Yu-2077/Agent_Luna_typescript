# Initiative 23 — Skills as Procedural Memory (v0.32.0 – v0.32.3)

> **Status: ✅ SHIPPED 2026-07-05** (all 4 versions on `mainline`; see DEVELOPMENT.md
> v0.32.0–v0.32.3). Three adversarial reviews (14+9+11 agents: 25 confirmed findings, all fixed
> pre-commit — incl. one HIGH prompt-injection sink) + a 4-run live dream A/B (null-restraint +
> positive distillation verified against the real DB; one shape bug caught + fixed) gated the
> ship. Version range **v0.32.0 – v0.32.3**. Master index: [`../README.md`](../README.md).

## The idea

Turn the half-built v0.15.4 skill library into Luna's **fourth memory pillar — procedural
memory** ("how I do things"), alongside episodic (L2), semantic (L3), narrative (diaries) and
identity (soul). The 2026-07-04 audit proved the substrate works but the loop is open: in 19 live
days exactly **1 skill was saved and recalled 4 times** (~0.6% of tool traffic) because nothing
tells Luna *when to save*, nothing *surfaces* the library (she cannot see a shelf exists), and
recall is lexical-only. Luna diagnosed it herself in L2 (2026-07-03): *"recall_skill is lexical
search, not embeddings — and it's a tool I have to choose to call, nothing auto-injects it into
context yet."*

The design (owner-approved 2026-07-04) closes the loop in three moves, grounded in an external
SOTA review: **① a skill shelf** (progressive disclosure: name+description always visible in the
cached system block, body pulled on demand — the Anthropic Agent Skills pattern), **② an L1
trigger** (use-before-redo + when-to-save clauses — the missing behavioral driver every other
tool group already has), and **③ dream-time distillation** (a new dream step turns the day's
episodes into reusable procedures — the Letta "sleep-time compute" pattern Luna is uniquely
positioned for because she already has a dream engine). Plus the lifecycle plumbing every
skill-library paper says is mandatory: audit trail, usage counters, deprecation, and semantic
retrieval.

This is also the substrate the owner's next phase (openclaw/Hermes-style self-evolving code
agency) writes into: verified code procedures need a durable, surfaced, self-maintained home.

## Why prioritized

- The audit is fresh and the fix is cheap relative to value: v0.32.0 alone closes both open loops.
- The soul initiative just proved the exact patterns this reuses (audit-first store writes, epoch
  bumping, dream-authored sections with firewalls, /_workspace editors).
- The upcoming code-capability initiative depends on this substrate existing and being alive.

## Locked design decisions referenced (REWRITE_CONTEXT.md, verified 2026-07-04)

- **LD #9 (everything-as-tool)** — skills stay tools (`save_skill`/`recall_skill`); the shelf is
  prompt *surfacing*, not a new outbound action shape. No new wire event needed.
- **LD #12 (memory layer model, as amended through v0.30.3)** — L1/L2/L3 + diaries-as-injected
  layer + the soul. This initiative **amends LD #12 at v0.32.3** to name the skill library as the
  injected *procedural* memory layer (shelf in the cached block + recall candidate source), the
  same shape the v0.17.1 diary amendment took.
- **LD #13 (hybrid embedding-first recall)** — skills join `retrieve()` as a source and inherit
  the hybrid ranking; no new retrieval machinery.
- **LD #14 (L1 thinking contract is the design, not gates)** — the save/reuse triggers land as L1
  contract clauses, not enforcement machinery. No gate harness.
- **LD #11 (dream is the consolidation engine)** — distillation is a dream step, off the hot
  path, patch-shaped, audited, restorable — exactly like `persona_update`.
- **减负 list line 158** — the CUT Python "Skills subsystem" (`list_skills`/`activate_skill`/
  `exit_skill` + `state.active_skill`) was a **tool-filter**, unrelated to this library. Do not
  conflate; nothing here resurrects it.

## Verified architectural facts (all re-verified from source this session)

**Skills today**
- Table (migration `0009_skills.sql:6-14`): `skills(name PK, description, body, created_ms,
  verified_ms)` + `idx_skills_verified`. **No usage counter, no audit, no provenance column.**
- `skillStore.ts`: `saveSkill` (:32-51) is a **destructive upsert** — no audit, no no-op guard,
  **no `bumpMemoryEpoch()`**; `listSkills` (:61-69) orders `verified_ms DESC`; `searchSkills`
  (:74-83) = `lexicalScore` over `name + description` only (imported :11).
- `save_skill` tool: input caps name≤80 / description≤400 / body≤8000, `verify` default true runs
  literal `bun test` in `workspaceRoot()` with `timeoutMs 1_800_000` (:41-43, :53-84);
  `proactiveRisk:'surface'`, `concurrency:'session-serial'`.
- Mounting: `skillTools` + `skillsEnabled()` (`LUNA_SKILLS !== '0'`, default ON) + `withSkills()`
  at `tools/registry.ts:126-137`, composed at boot `main.ts:106,119`.
- **`LUNA_SKILLS` is NOT in the settings whitelist** (`settings/registry.ts` SETTING_SPECS) — the
  panel cannot see or toggle skills today. Categories in use: `Abilities`, `Companion`, `Memory`,
  `Model`, `Perception`.

**Prompt / L1 / cache**
- `renderL1Contract(webSearch, webFetch, timeAware, weatherAware, codeWrite, shell, repoMap)` —
  **seven positional booleans**, memo key `` `${a}|${b}|...` `` (`l1Contract.ts:78-90`), gated
  pushes at :124-130. **No skills param, no skills clause** — grep 'skill' in `turn/*.ts` +
  `persona/*.ts` = zero matches.
- Mount booleans derive from **registry contents, never env**: `isCodeWriteMode`/`isShellMode`/
  `isRepoMapMode` at `tools/registry.ts:239-249`; threaded at the `open_stream` call site.
- `buildSystemPrompt` (`runTurn.ts:126-181`): ordered parts BASE_DIRECTIVES → MESSAGE_MODE →
  L1 contract (`LUNA_L1_CONTRACT !== '0'`) → WEB_UNTRUSTED_RULE → soul + EMBODIMENT + humanity
  (`LUNA_PERSONA !== '0'`) → `renderCoreBlock()` + `renderDiaryDigest()`
  (`LUNA_MEMORY_INJECT !== '0'`) → **one** text block with `cache_control: ephemeral`. The shelf
  slots after the diary digest.
- Epoch: `memory/epoch.ts` counter; consumed **intra-turn only** (`TurnState.systemBlock`/
  `systemBlockEpoch`, `runTurn.ts:194-196`, rebuild check :335-347 — a new turn always rebuilds).
  Current bumpers: `l3Store.addFact/forgetFact`, `soulStore.seedFixedCore/updateFixedCore/
  updateEvolving`, `workspace.ts` soul-cell edits. **`saveSkill` does not bump** — required once
  the shelf enters the cached block.

**Recall substrate**
- `recall.ts`: `Hit.source` (:34) and `Candidate.source` (:80) are the closed union
  `'l2'|'l3'|'diary'`; `retrieve(sessionId, query, opts?: {k?, embedBudgetMs?, sources?})`
  (:134-146) filters sources **before** ranking; per-source importance consts at :30-31
  (`DEFAULT_IMPORTANCE 0.4`, `DIARY_IMPORTANCE 0.7`); the diary candidate loop (:116-124) is the
  add-a-source template; cold candidates are **lazily embedded** up to `MAX_EMBED_PER_TURN=64`
  via `embedCacheKey` (:176-188) — a new source needs no embedding plumbing.
- The agentic `recall` tool has a **closed output enum** `z.enum(['l2','l3','diary'])` and scope
  enum `['facts','timeline','both']` (`tools/builtin/recall.ts:12-24`) — both must extend or
  skill hits fail the tool's own output validation.
- **Pre-existing bug (fix in v0.32.1):** the dream's `rag_refresh` pre-warm writes embeddings
  keyed by `contentHash(text)` (`cycle.ts:346,356`) while `retrieve()` reads/writes
  `embedCacheKey(text) = contentHash(model + '\n' + text)` (`recall.ts:161,174`,
  `embed.ts:66-68`, changed v0.20.5). The keys never match → the pre-warm is dead work.

**Dream pipeline**
- `cycle.ts`: `DreamNode` union (:59-66) + `ORDER` (:79-87) = `rate_salience → refine_semantic →
  refine_layer1 → memory_audit → persona_update → run_diaries → rag_refresh`; `nextNode`
  (:89-92) derives edges from ORDER, so inserting a step = union + ORDER + one `dreamGraph`
  entry. `runStep` (:114-148) provides the `dream.step` event, StepRecord, per-step trace+flush,
  and exception→'failed' for free. Protocol imposes **no enum on step names**
  (`events.ts:166-171` `step: z.string()`) — a new step needs zero protocol change.
- `persona_update` (:215-241) is the template for a self-authoring step: patch-shaped LLM call,
  whole-patch reject on structural mismatch (:165-167 exemplar), null-default with JSON-literal
  example (the v0.27.4 lesson), similarity gate, writes only through audited store functions.
- Dreams can run at shutdown (SIGTERM shutdown dream, v0.21.7) — **a distillation step must
  never spawn `bun test`** (30-min timeout; the SIGTERM-orphan risk is on record).

**Owner surface**
- `/_workspace` soul editor (v0.31.0, `workspace/workspace.ts` + `index.html`) is the exact
  pattern for a skills panel: open GET, `LUNA_DEV_TOOLS=1`-gated POST writes, raw-cell edits on
  identity tables bump the epoch (workspace.ts soul precedent).
- `soulSeed.ts:23` lists `'skill shelf'` as a LEDGER_MARKER — it strips *soul evolving-bond
  sentences* only; it does not touch prompts and does not conflict with the shelf block.

## External research notes (SOTA grounding, 2026-07-04 review)

- **Anthropic Agent Skills**: 3-tier progressive disclosure — name+description always in the
  system prompt (~100 tokens/skill), body on demand (<5k tokens), deeper resources unbounded;
  **the description IS the trigger** (must say what + when, third person, deliberately "pushy"
  because models under-trigger); listing budget with least-used-evicted-first.
- **Voyager (2305.16291)**: description-embedding as retrieval key; **verification gate before
  save** (no gate → library rot); append-only + composition is what compounds.
- **AWM (2409.07429)**: **variable abstraction at induction** is what turns an episode into a
  procedure (WebArena +51% rel., steps 7.9→5.9); LM-as-success-judge closes the online loop.
- **CLIN (2310.10134)**: distill causes ("X is necessary for Y"), not transcripts.
- **ACE (2510.04618)**: incremental itemized deltas, never monolithic rewrites (context collapse
  is the #1 failure mode of self-updating memory).
- **Memp (2508.06433)**: build/retrieve/**update/deprecate** are all mandatory lifecycle stages;
  procedural memory built by a strong model transfers to weaker models.
- **Letta sleep-time compute (2504.13171)**: consolidation belongs on an idle background pass —
  Luna's dream engine is exactly this organ, already built.

## The hard part

1. **The prompt-cache invariant.** The shelf lives inside the ONE cached system block: its bytes
   must be identical across turns unless the library truly changed. Therefore: render
   **name-ordered**, never interpolate timestamps/counts, bump the epoch exactly once per real
   change, and keep `markUsed` epoch-silent (counts are not rendered, so usage must not thrash
   the cache).
2. **Positional-boolean threading.** `renderL1Contract` and `buildSystemPrompt` take long
   positional boolean lists; adding the 8th flag is mechanical but misordering silently swaps
   clauses — update the memo key + every call site + tests in the same change.
3. **Self-authoring safety.** The dream writes skills → every write audited + restorable,
   whole-patch rejection, per-night cap, null default, merge-over-duplicate, provenance column,
   and a default-OFF flag until a live dream A/B passes (the Initiative-22 discipline).

## Execution order & status

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.32.0-shelf-and-trigger.md](v0.32.0-shelf-and-trigger.md) | v0.32.0 | Lifecycle substrate (audit/usage/provenance/deprecation) + the skill shelf in the cached block + the L1 skills clause + settings exposure | **Low-Med** | nothing | ✅ SHIPPED 2026-07-04 |
| [v0.32.1-recall-source.md](v0.32.1-recall-source.md) | v0.32.1 | Skills as a `retrieve()` source (semantic recall) + usage tracking wired + the rag_refresh embed-key fix | **Low** | v0.32.0 | ✅ SHIPPED 2026-07-04 |
| [v0.32.2-dream-distillation.md](v0.32.2-dream-distillation.md) | v0.32.2 | The `distill_skills` dream step — dark launch behind `LUNA_DREAM_SKILLS=0` | **High** | v0.32.1 | ✅ SHIPPED 2026-07-04 (flip awaits the live A/B) |
| [v0.32.3-flip-owner-surface.md](v0.32.3-flip-owner-surface.md) | v0.32.3 | Flip distillation on (after a live dream A/B) + `/_workspace` Skills panel + LD #12 amendment + close | **Medium** | v0.32.2 + live A/B | ✅ SHIPPED 2026-07-05 |

## Acceptance criteria for the whole initiative

- [x] The shelf (names + descriptions, name-ordered, capped) renders in the cached system block
      whenever skill tools are mounted; an empty library renders nothing; bytes are stable across
      turns with no library change (cache-invariant test).
- [x] The L1 contract carries the skills clause (use-before-redo + when-to-save) iff skills are
      mounted, derived from registry contents.
- [x] Every skill write is audited (`skills_audit`) and restorable; `saveSkill` is
      no-op-guarded and epoch-bumped; usage (`used_count`/`last_used_ms`) is tracked on recall.
- [x] `retrieve()` surfaces relevant skills semantically (a paraphrased query finds a skill whose
      stored wording differs); the recall tool exposes them without output-validation failure.
- [x] The dream distills at most a capped number of provenance-tagged skills per cycle, merges
      rather than duplicates, deprecates stale entries, never runs the test suite, and every
      write is one-call restorable. A live dream A/B is recorded before the default flip.
- [x] The owner can view/edit/deprecate/restore skills in `/_workspace`; `LUNA_SKILLS` (and the
      distillation flag) are visible in the settings panel.
- [x] LD #12 amended at v0.32.3 (procedural-memory clause); full `bun test` green; `tsc` clean
      across packages at every version.

## Open questions blocking start

None blocking — all four LD dependencies are locked. Build-time tunables (decide at
implementation, defaults specced in the plans): shelf cap (default 20), skill candidate
importance (default 0.75), the recall tool's scope naming (`'skills'` scope value), and the
per-night distillation cap (default 2).
