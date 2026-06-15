// Read-before-edit tracking seam (Initiative 8, v0.15.1).
//
// SOTA edit agents converge on one reliability lever above all others: never
// edit from stale memory. `edit` / `multi_edit` reject a path that was not
// `read_file`'d this session — forcing the model to look before it leaps. This
// module is that seam: read_file records the (sessionId, canonical path) pair
// after a successful read; the edit tools consult it.
//
// Keyed by the *canonical* resolved path (post-realpath) so a relative-vs-
// absolute spelling of the same file still counts as read. Session-scoped so a
// fresh session starts with an empty set (a restart genuinely is fresh state).
// In-memory only — read tracking is a within-turn-loop discipline, not durable
// state worth persisting.

// sessionId -> set of canonical paths read this session.
const readBySession = new Map<string, Set<string>>();

// Record that `canonicalPath` was read in `sessionId`. Called by read_file
// after a successful read (the gate already canonicalized the path).
export function markRead(sessionId: string, canonicalPath: string): void {
  let set = readBySession.get(sessionId);
  if (!set) {
    set = new Set<string>();
    readBySession.set(sessionId, set);
  }
  set.add(canonicalPath);
}

// Was `canonicalPath` read in `sessionId`? Consumed by edit / multi_edit.
export function wasRead(sessionId: string, canonicalPath: string): boolean {
  return readBySession.get(sessionId)?.has(canonicalPath) ?? false;
}

// Test/reset seam — clear all tracking (or one session's).
export function resetReadTracking(sessionId?: string): void {
  if (sessionId === undefined) {
    readBySession.clear();
  } else {
    readBySession.delete(sessionId);
  }
}
