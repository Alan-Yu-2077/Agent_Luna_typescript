# Initiative 13 — Deep-Audit Remediation (v0.20.0 – v0.20.9)

> **Status: PLANNED.** Order 13 (next, after Initiative 12 ✅). Version range **v0.20.0 – v0.20.9**
> (10 versions). Back to the master plan: [`../README.md`](../README.md).
> Source of findings: the 2026-06-20 26-domain line-by-line deep audit (78 agents, every source
> file + sibling tests read in full, each serious finding adversarially re-verified). Baseline at
> audit time: `tsc` clean ×3, **667/667 tests green**.

## The idea

The 2026-06-20 deep audit read **every line** of `packages/{protocol,server,web}` and found the
rewrite is, structurally, in very good shape — the load-bearing invariants (prompt-cache stability,
L2-as-single-source-of-truth, dream-never-overlaps-a-turn, fail-closed proactive, SSRF DNS-pin) all
hold in code. But it surfaced **45 adversarially-confirmed real defects** (6 high / 30 medium / 9
medium-downgraded-to-low) and a tail of lower nits. This initiative fixes them in risk-ordered,
independently-shippable slices — the same remediation pattern as Initiative 9 (audit-remediation
v0.16.x), but for the much deeper second-pass audit. No new features; every version is a correctness,
safety-gate, resource, or contract fix grounded in a cited symbol.

This is distinct from **Initiative 9** (`audit-remediation-2026-06/`, v0.16.x), which remediated the
PR #1/#2 audits at HEAD v0.13.13. This one ("deep audit") is the v0.19.2 full-tree pass.

## Why prioritized now

Most-recently-shipped features (web tools, code-agent, time perception, proactive) are the ones the
audit found the live defects in — they are in active use, and the highest-value fixes (a command-
injection / deny-gate bypass in the verify tools; a Chinese-IME input bug hit on *every* multi-char
message; silent recall/fold degradation) are cheap and self-contained. Ordering is **riskiest-and-
most-security-relevant first** (the shell/verify safety-gate cluster), then user-facing correctness,
then memory/data integrity, then robustness, then contract/config/test-debt. Every version is
independently revertible; later versions never depend on earlier behavior changes except where the
table's `Depends` column says so.

> **Framing that governs severity (read before implementing).** Luna is **single-user**, the model
> is the **sole actor on the owner's own machine**, and the workspace has **no root jail by explicit
> owner decision** (`tools/workspace.ts:4-8`) — only a sensitive-path blocklist + the `shell` deny-
> regex (LD #10). So the "security" findings here are **safety-gate / defense-in-depth gaps the model
> can trip**, *not* remote-attacker RCE. They are still worth closing (the gates exist precisely so a
> confused or adversarial-toward-itself turn can't exfiltrate a key or wipe a tree), but de-risk
> accordingly: these are hardenings of an already-deliberate trust model, not a breach.

## Locked design decisions referenced

Pulled verbatim from [`../../REWRITE_CONTEXT.md`](../../REWRITE_CONTEXT.md):

- **LD #10 — Risky-tool mount policy: always-on + deny-regex inside the tool** ("no judgment-gated
  mounting … deny-regex provably testable"). The shell/verify hardening in v0.20.0–v0.20.2 *upholds*
  this: the deny-regex **is** the security model, so a bypassable deny-regex is a direct LD #10
  defect, and the fix strengthens the regex + extends it to the verify tools that currently skip it.
- **LD #14 — Action integrity + the evaluator firewall** ("the agent can never write the code that
  judges/sandboxes/gates it — the DGM safeguard"). v0.20.0 closes the firewall gap (`evaluatorFiles()`
  protects `shellDeny.ts` data but not the `shell.ts`/`shellCore.ts` enforcers that read it).
- **LD #15 — Proactive = reversible-silent / irreversible-surfaced, fail-closed, deny-regex on
  `shell`.** v0.20.8's proactive fixes (anti-repeat context, continuation lifecycle) operate inside
  this contract and change no safety semantics.
- **LD #9 — Everything-as-tool; humanity caps as Zod on `message`; speech via `message` only.** The
  message-tool path is the reply contract; v0.20.3's text-mode bubble fix touches only the documented
  `LUNA_MESSAGE_TOOL=0` legacy escape hatch, not the default path.
- **LD #12/#13 — 3-layer memory + hybrid embedding-first recall; the prompt-cache invariant (cached
  system prefix byte-stable, per-turn-volatile data in the uncached tail).** v0.20.4–v0.20.6 keep all
  temporal/recall content in the uncached tail and every fold/cache-key change preserves byte-stability.

No referenced decision is still Open. No decision is amended by this initiative (these are bug fixes,
not design changes). One *latent* design question (`restore(n)` semantics) is surfaced as an Open
Question below rather than silently resolved.

## Verified architectural facts (cited; every later plan references these)

Each was independently re-read and confirmed by an adversarial verifier during the audit.

**Shell / verify safety gate (v0.20.0–v0.20.2)**
1. `typecheck` builds `bun x tsc --noEmit -p ${JSON.stringify(input.path)}` and `run_tests` builds
   `bun test ${JSON.stringify(input.path)}`, both handed to `/bin/zsh -lc` — `tools/builtin/typecheck.ts:87-89`,
   `tools/builtin/run_tests.ts:88`, identical flaw in `tools/builtin/lint.ts:75-76`. zsh expands
   `$(...)`/backticks *inside* double quotes, so `JSON.stringify` does not neutralize them. None of
   these tools call `classifyShellCommand` — only `tools/builtin/shell.ts:91,103` does. → command
   injection **and** a clean deny-gate bypass.
2. `realSpawner` calls `Bun.spawn(['/bin/zsh','-lc', cmd])` with **no** process-group/detached option
   — `tools/shellCore.ts:49`; `killTree` (`:57-68`) does `process.kill(-pid)`, which throws `ESRCH`
   (child shares parent bun's group), falls back to `proc.kill()`, and leaks grandchildren. The
   SIGKILL-escalation `setTimeout`s (`:74,86`) are never cleared on clean exit (`finally :101-104`
   clears only `timer`).
3. `blockedPathInCommand` token regex `tools/builtin/shell.ts:60-67`; directory-secret rules live in
   `tools/workspace.ts:57-73,217-221` and only match paths `isWithin` the *real* `~/.aws` etc. — so
   `$HOME/.aws/credentials` (token extracted as `/.aws/credentials`, resolves outside home) passes,
   and zsh expands `$HOME` at runtime. `classifyShellCommand` (`tools/shellDeny.ts:20-39`) only gates
   *writes* to secret paths, not `cat` reads.
4. `tools/shellDeny.ts:21` rm rule `/\brm\s+-[a-z]*[rf][a-z]*\b/`; `:34` curl|sh rule
   `/\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/`; `:9-13` comment claims it "ALWAYS hard-
   blocks". Live-verified bypasses on macOS+zsh: `r""m -rf <p>` and `find <p> -delete` **really delete**;
   `curl … | python|perl|node|ruby|php` and `curl … | tee x | sh` fetch+exec. (`rm --recursive --force`
   and `$IFS` splits are inert on BSD-rm + zsh — do **not** over-claim those.)
5. `evaluatorFiles()` (`tools/workspace.ts:108-125`) lists `shellDeny.ts`, `humanity.ts`, `l1Contract.ts`,
   `web/safeFetch.ts`, `safetyGate.ts` — but **not** `tools/builtin/shell.ts`, `tools/shellCore.ts`, or
   `tools/builtin/run_tests.ts`; `isEvaluatorBasename()` (`:129-140`) only matches `*.test.ts`/config.
   A plain `.ts` under `tools/` is writable (`workspace.test.ts:155-160`), so Luna can edit the enforcer.
6. `fsScan.ts:104-119` `walk` emits symlinked **files** (`entries.push` at `:115` precedes the
   `!ent.isSymlink` descent gate at `:117`); `grep.ts` jsRunner reads each walked file via
   `Bun.file(ent.abs).text()` (~`:126`) with no per-file `resolveInWorkspace` — only the search ROOT is
   gated (`:182`). ripgrep path is unaffected (no `--follow`), so this is JS-fallback-only.
7. `grep.execute` is `async function* (input)` — never destructures `ctx`, so `ctx.abortSignal` is
   unused; `ripgrepRunner` `grep.ts:51-95` spawns `rg` with no abort wiring. `find_symbol.ts:54` /
   `repo_map.ts:57` share the gap. Contrast `shell.ts:145` which forwards `ctx.abortSignal`.

**Turn / time / provider (v0.20.4, v0.20.6, v0.20.8)**
8. `formatGap` sub-24h branch `turn/temporalContext.ts:136-140`: `m = Math.round((s%3600)/60)` →
   `60` when within-hour remainder ≥ 59m30s → `"1h 60m"` / `"23h 60m"`. `buildTimeBlock` feeds it
   into the request (`runTurn.ts:238-246`). No hour-boundary test (`temporalContext.test.ts:26-33`).
9. `resolveTz()` `turn/temporalContext.ts:76-78` returns `Bun.env['LUNA_TZ']` unvalidated; first
   `new Intl.DateTimeFormat({timeZone:bad})` throws `RangeError` inside `buildTimeBlock` at
   `runTurn.ts:240` (parse_input, no local try/catch); `graph.ts:22-28` has no try/catch → every
   reactive turn fails `turn_failure` before the LLM is called. Same root reaches `proactiveTurn.ts:50`
   and `recall.ts:249`.
10. `complete()` `provider/anthropic.ts:48-59` unconditionally sets `thinking:{type:'adaptive'}` and
    filters TextBlocks; `CompleteResult` (`provider/types.ts:41-44`) has no `stop_reason`. `maybeFold`
    `memory/l1Window.ts:144` does `digest = result.text.trim()` with **no empty guard** → `commitFold`
    (`memory/sessionStore.ts:55-62`) unconditionally writes even `''` and advances `window_low_water`.
    Precedent: `dream/llm.ts:51` *does* guard empty text.
11. `provider.chatStream` `runTurn.ts:278-282` is called with no `AbortSignal`; `ProviderRequest`
    (`provider/types.ts:29-33`) has no `signal`; `handleClose` (`ws.ts:98-105`) only deletes the socket.
    A disconnected client's turn runs to completion (≤ `MAX_TOOL_ITERATIONS=8`).

**Memory / recall (v0.20.5, v0.20.6)**
12. `recall` scope filter `tools/builtin/recall.ts:58-62`: over-fetches `k*2` from `retrieve()`, then
    filters by scope, then slices — `retrieve()` (`memory/recall/recall.ts:140-233`) has no source
    param and returns the GLOBAL top-k, so off-scope sources can starve the wanted source. The else
    branch hard-codes `h.source === 'l2'`, **dropping every `'diary'` hit** under both non-default scopes
    (diaries are first-class candidates: `memory/recall/recall.ts:122-130`, `DIARY_IMPORTANCE=0.7`).
13. `cosine` `memory/recall/embed.ts:57-67` loops `for i < a.length` reading `b[i]!` with no length
    guard → NaN on a query/candidate dim mismatch → `NaN > 0.05` false → hit silently dropped. The
    `dim` column (`migrations/0005_embeddings.sql:4`) is written but never read; cache key is content-
    only (`embed.ts:53-54`), so a `LUNA_EMBEDDING_MODEL` swap reuses stale-dim vectors.
14. `loadSession` `memory/sessionStore.ts:34` → `listL2` (`:122-127`) `ORDER BY t_ms ASC … LIMIT 10000`
    → past 10k turns returns the OLDEST 10k and **drops the newest**; `planFold` (`l1Window.ts:77`)
    inherits the truncation.
15. `rate_salience` `dream/cycle.ts:142-148` maps `patch.scores[i]→unrated[i]` positionally;
    `SaliencePatch` (`dream/llm.ts:91-93`) validates only `int 1–5`, not `length === unrated.length`;
    `setImportance` (`sessionStore.ts:152-155`) writes permanently → a mid-list score shift mis-rates
    every later turn.

**Edit / code-map (v0.20.7)**
16. `edit`/`multi_edit`/`write_file` persist via a single `await Bun.write(resolved, toWrite)`
    (`tools/builtin/multi_edit.ts:157`, `edit.ts:139`, `write_file.ts:138`) — truncate-in-place, no
    temp+rename; `multi_edit` advertises "atomically (all-or-nothing)" (`:30,:59`) but that is the
    in-memory guard only. These are the *only* three `Bun.write` call sites in the server.
17. `findEditMatch` fuzzy path `tools/editCore.ts:55-58` returns `count = countOccurrences(content,
    candidates[0])` — counts only the FIRST window, so two distinct-whitespace fuzzy windows report
    `count:1`, defeating `selfEdit.ts:53`'s `match.count > 1` uniqueness guard (shared by `edit`/`multi_edit`).
18. `isExported` `code/symbols.ts:63-73` climbs to `export_statement` but its stop-set omits
    `class_body`/`class_declaration`, so **every method of an exported class** is flagged `exported`,
    skewing the `repoMap.ts:188` ×1.5 boost.
19. tree-sitter `Parser` leak: `loadParserFor()` does `new ParserCtor()` per call (`code/treeSitter.ts:108`);
    `parseWithLoaded` (`code/symbols.ts:148-164`) calls `tree.delete()` but never `parser.delete()`
    (`web-tree-sitter.d.ts:165-166` documents it frees WASM-heap). Reachable via `repo_map`/`find_symbol`.

**Frontend (v0.20.3, v0.20.8, v0.20.9)**
20. `app.ts:132-134` Enter handler `if (e.key==='Enter') send()` — no `isComposing`/`keyCode===229`
    guard (none anywhere in `packages/web/src`); the chat input is the primary `<input>` (`ui/layout.ts:143-145`).
21. `WebAudioSink.stop()` (`audio/webAudioSink.ts:44-48`, contains the only barge-in `queue.clear()`)
    has **zero** production callers; `controller.ts:82` calls only `speak()`; `app.ts:124-130` `send()`
    never touches audio. `audioPlayer.play()` (`:30-42`) has no abort across `decodeAudioData`;
    `ttsClient.ts:11` fetch has no `signal`.
22. text-mode `reply` bubble: `controller.ts:43-49,101-114` opens/append `TEXT_BUBBLE='reply'` but
    `turn.result` never finalizes/discards it; `cuteBubbleView.ts:73` `open()` no-ops on an existing id
    → consecutive text-mode replies merge. Reachable only under `LUNA_MESSAGE_TOOL=0` (`main.ts:76-77`).
23. `wsClient.ts:36` resets `attempt=0` in the `open` listener (no stability window) → flapping server
    reconnects at the ~1.5s base floor; no client keepalive ping (none in `packages/web/src` WS path);
    `main.ts:133-141` sets no `idleTimeout` (Bun default ~120s) though the server handles `ping`
    (`ws.ts:137`). `webAudioSink.ts:68-71` latches `disabled=true` after 5 non-503 fails, never reset.
    `ui/bootGate.ts:64-121` `warmUpTts` has no timeout/AbortController despite its doc claim.
24. `faceVm.ts:200-210,608`: the `gazeActive` gate that yields the eyes to the mouse focusController
    exists only in `applyIdle` — `applyEmotion`/`applyActions` write `ParamEyeBall*` ungated.

**Contract / config / observability (v0.20.9)**
25. dead protocol schemas `protocol/src/memory.ts:3-11 (L2Turn)` + `:13-19 (SessionRow)` (0 refs, stale
    vs the live `sessions` shape); `Citation.url` `events.ts:109-113` is loose `z.string()` (untrusted
    origin); `ToolEvent.tool_name` `tools.ts:62-79` is `z.string()` yet consumers hard-`.parse()` it as
    `ToolName` (`ws.ts:320,328`, `runTurn.ts:431,439`).
26. `safeFetch` `pinnedFetch`/`pinnedLookup` (`web/safeFetch.ts:252-304,258-261`) — the DNS-pin closing
    the rebinding TOCTOU — has **zero** automated coverage (every `safeFetch.test.ts` call injects
    `fetchImpl`); the "real-HTTPS smoke" cited in the source comment + DEVELOPMENT.md is a one-off manual
    check, not a repeatable test. provider `chatStream` SSE→ProviderEvent mapping is untested
    (`anthropic.test.ts` covers only `unwrapGatewayInput`). `fsScan`/`readTracking`/`defineTool` have no
    sibling tests.
27. `.env.example` is missing ~37 code-read flags incl. security-relevant `LUNA_BIND_HOST` (`main.ts:120`),
    `LUNA_MEMORY_EMBEDDING` (`memory/recall/embed.ts:6`), `LUNA_CODE_WRITE`/`LUNA_SHELL`/`LUNA_SELF_EDIT`
    (`tools/registry.ts:61,89,143`). `.prettierignore:1-4` omits `packages/web/public/` → `prettier
    --write .` (`package.json:12`) reformats 24 vendored Live2D assets incl. the 206KB minified core.

**Refuted by the audit's adversarial pass — do NOT "fix" these (no defect):**
- `packages/web/dev-server.ts:36-37` path traversal → **no exploit**: Bun's HTTP server + WHATWG URL
  normalize `../` before `req.url`/`join()` ever sees it. (Adding `hostname:'127.0.0.1'` + a confine
  check is fine as defense-in-depth, but there is no arbitrary-read / key-exfil hole.)
- `dispatcher.ts:124-176` abort-listener "leak" → Bun's `AbortSignal` is a Web `EventTarget` with no
  MaxListeners warning, and every shipped tool emits a single `progress`; the controller is GC-bounded.
- `recall_skill` / `enter_dream` "untested" + fuzzy `replace_all` "count divergence" → all actually
  covered / count and splice use the same string. (The narrow `replace_all`+fuzzy multi-indent gap is
  the real residual — folded into v0.20.7's `code-agent-4` fix.)

## The hard part

- **Shell/verify hardening must not regress LD #10's testability.** Every deny-regex broadening and
  every argv-vs-shell change ships with the **bypass strings added to `shellDeny.test.ts`/sibling
  tests first** (the gap that hid these is precisely that the tests only asserted canonical forms).
  Prefer **argv spawning** (`Bun.spawn(['bun','x','tsc',…,path])`) over shell-string escaping for the
  verify tools — it removes the injection class structurally rather than patching the quoting.
- **Cache invariant is sacred (LD #12/#13).** Any change touching `renderCoreBlock`, the diary digest,
  or the embedding cache key must keep the cached system prefix byte-stable; the existing pin test
  (`recall.test.ts:193-238`) must stay green. Embedding cache-key changes must not silently invalidate
  the whole cache for existing rows without a migration story.
- **Off-hot-path discipline.** The trace-flush guards (v0.20.8) and any new validation must add **zero
  synchronous memory LLM calls** to the reactive path and must never let instrumentation throw into the
  work it instruments (mirror `runTurn.ts:840-844`; ideally push the guard into `store.flush()`).
- **Frontend fixes are behavior-additive, not redesigns.** Barge-in wiring, keepalive ping, and the
  IME guard reuse the existing protocol (`PingEvent`/`PongEvent`) and sink interfaces — no new wire
  events except where v0.20.9 tightens an existing schema.

## Execution order & status table

| Plan | Version | Theme | Risk | Depends | Status |
|---|---|---|---|---|---|
| [v0.20.0](v0.20.0-shell-deny-gate-integrity.md) | v0.20.0 | **Shell deny-gate integrity** — argv-spawn verify tools (close injection + route through the gate), broaden deny-regex (`find -delete`, more interpreters, intermediate-pipe, empty-quote), firewall the enforcer files | **High** | nothing | PLANNED |
| [v0.20.1](v0.20.1-secret-blocklist-hardening.md) | v0.20.1 | **Secret-blocklist hardening** — `$VAR`/backtick path-indirection refusal, per-file `resolveInWorkspace` in grep's JS fallback, symlink-escape gate in `fsScan.walk` | Medium | nothing | PLANNED |
| [v0.20.2](v0.20.2-subprocess-resource-cleanup.md) | v0.20.2 | **Subprocess & resource cleanup** — real process-tree kill, abort signal into grep/find_symbol/repo_map, free tree-sitter `Parser`, clear escalation timers | Medium | nothing | PLANNED |
| [v0.20.3](v0.20.3-frontend-input-interrupt.md) | v0.20.3 | **Frontend input & interrupt** — IME-composition Enter guard (Chinese input), wire barge-in (`audio.stop()` on send/new turn) + abortable TTS fetch/decode, finalize the text-mode reply bubble | Low–Med | nothing | PLANNED |
| [v0.20.4](v0.20.4-temporal-correctness.md) | v0.20.4 | **Temporal correctness** — `formatGap` "Nh 60m" carry fix, validate `LUNA_TZ` (degrade-not-brick) | Low | nothing | PLANNED |
| [v0.20.5](v0.20.5-recall-correctness.md) | v0.20.5 | **Recall correctness** — `recall` timeline includes diary, scope pushed into `retrieve()`/over-fetch loop (no starvation), embedding dimension guard | Low–Med | nothing | PLANNED |
| [v0.20.6](v0.20.6-memory-fold-integrity.md) | v0.20.6 | **Memory fold & summarization integrity** — `loadSession` keeps newest turns, `maybeFold` empty-digest guard, drop adaptive thinking from `complete()`, dream salience length check | Medium | nothing | PLANNED |
| [v0.20.7](v0.20.7-edit-codemap-correctness.md) | v0.20.7 | **Edit & code-map correctness** — atomic temp+rename writes, fuzzy multi-window uniqueness fix, `isExported` class-method fix | Low–Med | nothing | PLANNED |
| [v0.20.8](v0.20.8-resilience-lifecycle.md) | v0.20.8 | **Resilience & lifecycle** — guard off-path trace flush, turn abort on disconnect, continuation `.unref()`+cancel, wakeGate anti-repeat; client keepalive ping, reconnect stability window, `warmUpTts` timeout, TTS latch self-heal | Low–Med | nothing | PLANNED |
| [v0.20.9](v0.20.9-contract-config-testdebt.md) | v0.20.9 | **Contract, config & test-debt** — prune dead protocol schemas + tighten `Citation.url`/`ToolEvent.tool_name`, `.env.example` + `.prettierignore`, `pinnedFetch`/provider/`fsScan` tests, cosmetic UI nits (gaze gate, tool labels) | Low | v0.20.0 (firewall list)·v0.20.4 (time labels) | PLANNED |

## Acceptance criteria for the whole initiative

- [ ] All 6 high findings closed (injection/deny-bypass, process leak, `$HOME` secret bypass, IME Enter,
      `formatGap`, barge-in) with a **regression test that fails before the fix and passes after**.
- [ ] All deny-regex / argv / firewall changes have their **bypass strings checked into the relevant
      `*.test.ts`** (the gap that hid these is closed at the test layer too).
- [ ] Every confirmed medium has a fix or an explicit, documented deferral in its plan file.
- [ ] `tsc --noEmit` clean ×3 and the full suite green at every shipped version (no version lands red).
- [ ] The prompt-cache invariant test (`recall.test.ts:193-238`) and the off-hot-path discipline stay
      intact — no version adds a synchronous memory LLM call to the reactive turn.
- [ ] No "fix" lands for the three refuted findings (dev-server traversal, dispatcher listener,
      recall_skill/enter_dream coverage); their non-defect status is noted where touched.
- [ ] Each version logged in [`../../history/DEVELOPMENT.md`](../../history/DEVELOPMENT.md) on ship.

## Open questions blocking start

None block the start — every plan is grounded in a confirmed code fact, and no referenced Locked
Decision is Open. Two **design micro-decisions** to settle *with the owner during the relevant version*
(they do not block earlier versions):

1. **`restore(n)` semantics (v0.20.9).** Repeated `restore(1)` is stuck after one effective step
   (`coreMemory.ts:40-55`, `source != 'restore'` filter), and `restore()` has **no production caller**
   today. Decide: implement a real undo/redo walk, or delete the unreachable method + its misleading
   comment. Default proposal: delete until an undo surface actually needs it.
2. **Embedding cache-key migration (v0.20.5).** Folding `model`/`dim` into the cache key is correct but
   invalidates existing content-only cache rows. Decide: lazy re-embed on miss (simplest, costs one
   re-embed per row after a model swap) vs a one-time migration. Default proposal: lazy re-embed +
   the `cosine` length-guard as the safety net, no migration.
