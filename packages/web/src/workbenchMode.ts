// v0.43.7: `?workbench=1` — the Live2D workbench, an early-exit URL mode alongside `?setup`.
// It is NOT a second app: it mounts the same `createPixiLive2DSink` on the same build, because a
// bench that renders through a different pipeline than the real thing is a bench that lies.
//
// `debugBridgeEnabled` widens the pre-existing `__lunaDbg` gate rather than adding a second one —
// the workbench reads the mood/playback/action state through that same bridge, so the Live2DSink
// interface gains nothing. The `includes('dev')` half is kept verbatim: it is a loose substring
// match by design (`?dev`, `?dev=1`, `&dev` all work) and narrowing it here would be an unrelated
// behaviour change riding along.

export function isWorkbenchMode(search: string): boolean {
  return new URLSearchParams(search).has('workbench');
}

export function debugBridgeEnabled(search: string): boolean {
  return search.includes('dev') || isWorkbenchMode(search);
}

// The workbench may be opened from a plain browser pointed at the desktop shell's static server
// (127.0.0.1:5177), which has no `lunaConfig` injection and no model picked in ITS localStorage —
// hence `?model=<url>` as a last-resort override. Precedence: explicit query wins, then whatever
// `resolveModelUrl()` already found.
export function workbenchModelUrl(search: string, resolved: string | undefined): string | undefined {
  const fromQuery = new URLSearchParams(search).get('model');
  if (fromQuery !== null && fromQuery.trim() !== '') return fromQuery;
  return resolved;
}
