import type { TraceEvent } from '@luna/protocol';
import type { TraceStore } from './store';

let store: TraceStore | null = null;

export function setTraceStore(s: TraceStore | null): void {
  store = s;
}

// v0.3.5 default: writes only when LUNA_TRACE === '1'.
// v0.3.6 flips this to "on unless LUNA_TRACE === '0'".
export function traceEnabled(): boolean {
  return Bun.env['LUNA_TRACE'] === '1';
}

export function trace(event: TraceEvent): void {
  if (!store || !traceEnabled()) return;
  store.record(event);
}

export function flushTrace(turnId: string): void {
  if (!store) return;
  store.flush(turnId);
}
