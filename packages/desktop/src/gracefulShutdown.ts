// v0.38.5: ask the loopback sidecar to shut down GRACEFULLY (run the shutdown dream) before the
// supervisor kills it. On win32 the tree-kill delivers no SIGTERM, so this POST /shutdown is the
// only path to a graceful exit there. Best-effort + bounded: resolves true on a 2xx, false on any
// error/timeout — the caller proceeds to the hard kill regardless, so a hung sidecar never blocks
// quit. Injectable fetch for tests.
export async function postShutdown(
  port: number,
  timeoutMs = 8000,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchFn(`http://127.0.0.1:${port}/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false; // dead/absent/slow upstream — the hard kill follows
  }
}
