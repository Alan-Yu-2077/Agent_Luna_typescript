# Agent_Luna (TypeScript)

A clean-room TypeScript rewrite of [Agent_Luna](https://github.com/Alan-Yu-2077/Agent_Luna), focused on
two goals the Python version cannot reach without further surgery:

1. **End-to-end response speed** — eliminate the blocking-on-tool-turn,
   `time.sleep`-on-HTTP-thread, and per-turn TCP teardown patterns that dominate the current
   latency budget.
2. **A single typed contract shared by backend and frontend** — eliminate the silent SSE / tool /
   memory drift that has accumulated over 47 versions of Python iteration.

The full stack ships: the agent brain (Bun + WebSocket runtime, interleaved tool-use), three-layer
SQLite memory + dream consolidation, proactive agency, action-integrity rails, a code-agent
capability, and the body — a Live2D avatar with voice and lip-sync. See
[`docs/history/DEVELOPMENT.md`](docs/history/DEVELOPMENT.md) for the per-version log (the truth source
for the current shipped version), [`docs/roadmap/README.md`](docs/roadmap/README.md) for the forward
plan, and [`docs/REWRITE_CONTEXT.md`](docs/REWRITE_CONTEXT.md) for the audited facts + locked design
decisions.

## Run

```sh
bun install
bun run dev          # one-command local launcher (server + web + TTS proxy)
# or individually:
bun run dev:server   # Bun WS server (needs .env — see .env.example)
bun run dev:web      # the web frontend
bun test             # the test suite
```

The server binds **loopback (`127.0.0.1`) by default**; set `LUNA_BIND_HOST=0.0.0.0` to expose it on
the LAN (only on a trusted network).

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
