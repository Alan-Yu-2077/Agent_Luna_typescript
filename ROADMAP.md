# Roadmap

This is a high-level view of where Luna has been and where it's going, by theme. It is a plan, not a
promise — directions shift as reality demands. For how the pieces fit today, see
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Built

The foundations are in place and working:

- **Typed wire contract** — a single Zod-validated event protocol shared by server and web, eliminating
  silent client/server drift.
- **Streaming turn engine** — interleaved tool-use over a WebSocket, with per-token reply text and
  live tool progress (no buffered, blocking tool turns).
- **Provider seam** — a model-agnostic `Provider` interface with Anthropic and OpenAI-compatible
  implementations, selectable by config.
- **Three-layer memory** — a rolling working window, durable salience-scored turns, and structured
  long-lived facts, over a single SQLite store.
- **Hybrid recall** — lexical + embedding similarity blended with recency and salience, with a graceful
  pure-TS fallback when the native vector extension is unavailable.
- **Dream consolidation** — offline salience scoring, diaries, memory consolidation, persona/soul
  evolution, and skill distillation, on a separate model key.
- **Proactive agency** — a rail-guarded silence ladder and self-continuation, so Luna can speak first
  without becoming an interruption.
- **Action-integrity rails** — guards that keep stated intent and taken action consistent.
- **Perception** — time awareness and pluggable weather, injected into context and driving proactive
  cues.
- **Skills** — procedural memory: distill, save, and recall how-to skills.
- **Code-agent capability** — repo mapping, symbol search, and gated file edits.
- **Embodiment** — a Live2D avatar with expression/pose mapping, gaze-follow, voice, and audio-driven
  lip-sync, plus a desktop "pet" shell.

## Directions

Themes under active thought (subject to change):

- **Deeper code agency** — stronger repository addressing and target localization, moving from the
  current basic, directory-scoped capability toward a mainstream code-agent's reach, including safe
  self-editing/self-improvement paths.
- **Per-model avatar presets** — expression maps are currently tuned to one reference model; a stock
  Live2D model gets head/gaze/mouth but not blink/brows/cheek until a per-model preset exists.
- **Onboarding polish** — making "clone → running with your own model and voice" as frictionless as
  possible for a newcomer.
- **Observability** — richer tracing and introspection of turns, memory, and proactive decisions.

## Contributing direction

Luna is opinionated about latency and about a single typed contract between backend and frontend. New
work should preserve both: don't reintroduce blocking tool turns, and don't let the two sides of the
socket drift out of sync. Risky subsystems land behind a default-off flag first, are verified in
isolation, then enabled.
