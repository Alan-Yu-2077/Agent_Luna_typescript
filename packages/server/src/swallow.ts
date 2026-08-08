// v0.45.12 (Initiative 36, C4): the breathing hole for deliberate error-swallowing. Five
// proactive-path sites used bare `.catch(() => {})` — any bug there evaporated silently, which
// is exactly why two forensic attempts (turn_failure, the silent-rate) hit walls the same day.
// Semantics unchanged: the loops still never die; the error is merely VISIBLE now.
export function logSwallowed(tag: string): (e: unknown) => void {
  return (e) => console.warn(`[swallowed:${tag}]`, e);
}
