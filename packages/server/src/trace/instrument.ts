import type { TraceEvent } from '@luna/protocol';
import type { TraceStore } from './store';

let store: TraceStore | null = null;

export function setTraceStore(s: TraceStore | null): void {
  store = s;
}

export function getTraceStore(): TraceStore | null {
  return store;
}

// Default on unless LUNA_TRACE === '0' (flipped from v0.3.5's default-off now that
// v0.3.6 ships a viewer that makes traces useful).
export function traceEnabled(): boolean {
  return Bun.env['LUNA_TRACE'] !== '0';
}

export function trace(event: TraceEvent): void {
  if (!store || !traceEnabled()) return;
  store.record(event);
}

export function flushTrace(turnId: string): void {
  if (!store) return;
  store.flush(turnId);
}
