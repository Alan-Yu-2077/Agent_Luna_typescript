# Tools — contract + discipline

Every tool in `builtin/` is defined via `defineTool({...})` and registered in `registry.ts`.
The dispatcher (`dispatcher.ts`) orchestrates them with concurrency policy, timeout, output
schema validation, and a unified `Result<T>` shape.

## The internal contract

A tool's `execute` is an `AsyncGenerator` yielding **internal** events:

```ts
type InternalEvent<T> =
  | { kind: 'progress'; payload: unknown }
  | { kind: 'ok'; data: T }
  | { kind: 'err'; code: ToolErrorCode; message: string; recoverable: boolean };
```

The dispatcher wraps these in **wire** `ToolEvent`s (`started` → `progress*` → `final`) and
the WS layer forwards them as `ServerEvent.tool.*` frames.

## Abort discipline (read this if you write a tool)

`AbortController.abort()` does **NOT** automatically propagate into a running
`async function*`. The dispatcher will still emit `Result.err('timeout')` after the
configured `timeoutMs`, but **your tool keeps running in the background** until it returns
naturally — unless you wire it to the signal.

**You must do one of:**

1. **Use signal-aware primitives.** `fetch(url, { signal: ctx.abortSignal })`, an
   abortable sleep, etc.
2. **Poll `ctx.abortSignal.aborted` at yield boundaries** and `return` early.

For long awaits without a signal arg, wrap with a race:

```ts
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  ctx.abortSignal.addEventListener('abort', () => {
    clearTimeout(t);
    reject(new Error('aborted'));
  }, { once: true });
});
```

Put cleanup in `finally`; the dispatcher calls `iterator.return()` to give it a 100ms grace
window.

## Concurrency policy (3-state, locked at v0.2 per Open Q #5)

- `safe-parallel` — fire concurrently. No shared mutable state inside the tool.
- `session-serial` — queued behind a per-session mutex. Use when the tool mutates
  session-keyed state (`remember` is the canonical example).
- `global-serial` — queued behind a process-wide mutex. Reserved for cross-session shared
  state. Rare.

Open Q #5 was resolved to "3-state, no per-resource locks" at v0.2 design review. Revisit
only if v0.4 memory work demands finer granularity.

## Output schema validation

The dispatcher calls `tool.output.safeParse(data)` on the `ok` event. Schema mismatch
becomes `Result.err('validation_failed', 'tool output schema mismatch')` for the caller.

`undefined` data is serialized as `null` on the wire — `JSON.stringify` drops `undefined`
keys, so the dispatcher writes `data ?? null` to avoid the silent footgun. If your tool has
no meaningful output, use `output: z.null()` (not `z.undefined()`).

## Concurrent tool cap

`MAX_CONCURRENT_TOOLS_PER_SESSION = 8` (`dispatcher.ts`) is a static backstop against a
runaway LLM emitting hundreds of tool calls in one batch. Overflow calls immediately receive
`Result.err('execution_exception', 'concurrent tool cap exceeded')`.

## Adding a new tool

1. Add the name to `ToolName` in `packages/protocol/src/tools.ts` (`z.enum([...])`).
2. Create `builtin/<name>.ts` with `defineTool({...})`.
3. Add the entry to `registry.ts`'s object literal. The
   `as const satisfies Record<ToolName, ...>` constraint flags missing or unknown keys at
   compile time.
4. Write `builtin/<name>.test.ts` covering happy path + at least one error path.

## What's not in here

- Per-tool rate limiting
- Auto-retry on `recoverable: true` (that's a signal to the LLM, not dispatcher behavior)
- Telemetry hooks (wait for v0.3.5 observability foundation)
- `progressSchema` (defer to v0.6 when `message_tool` ships streaming text)
- Tool middleware / interceptors
- Mount conditions (`mountedWhen`) — per LD #10, `shell` is always-on with deny-regex
