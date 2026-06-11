# Agent_Luna (TypeScript)

A clean-room TypeScript rewrite of [Agent_Luna](https://github.com/Alan-Yu-2077/Agent_Luna), focused on
two goals the Python version cannot reach without further surgery:

1. **End-to-end response speed** — eliminate the blocking-on-tool-turn,
   `time.sleep`-on-HTTP-thread, and per-turn TCP teardown patterns that dominate the current
   latency budget.
2. **A single typed contract shared by backend and frontend** — eliminate the silent SSE / tool /
   memory drift that has accumulated over 47 versions of Python iteration.

This repo is **scaffolding only** at this point. No runtime code yet. See
[`docs/roadmap/README.md`](docs/roadmap/README.md) for the planned development sequence and
[`docs/REWRITE_CONTEXT.md`](docs/REWRITE_CONTEXT.md) for the audited facts about Python Luna that
inform every decision here.

## Layout (planned)

```
Agent_Luna_typescript/
├── README.md                  ← you are here
├── docs/
│   ├── README.md              ← docs index
│   ├── REWRITE_CONTEXT.md     ← Python-Luna audit findings + locked design decisions
│   ├── history/
│   │   └── DEVELOPMENT.md     ← per-version shipped log (truth source for "what version are we on")
│   └── roadmap/
│       ├── README.md          ← forward plan, initiatives in execution order
│       └── <initiative>-YYYY-MM/
│           ├── README.md
│           └── vX.Y.Z-<theme>.md
├── packages/                  ← to be created in v0.1
│   ├── protocol/              ← shared Zod schemas + types (the wire contract)
│   ├── server/                ← Bun + WebSocket runtime
│   └── web/                   ← TS-ported agent-app controller (Live2D + audio kept as-is)
└── ...
```

## Reference

The Python original lives at `/Users/alanyu2077/Desktop/Agent_Luna` and stays the running production
system during the rewrite. Its `docs/history/DEVELOPMENT.md` is the authoritative log of what shipped
on the Python side (current head: v0.47.11, 2026-06-11). When this rewrite reaches feature parity, it
will replace the Python runtime; until then, both exist.
