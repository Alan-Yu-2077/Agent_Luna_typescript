// v0.38.5: a loopback-only POST /shutdown so the desktop shell can ask the sidecar to shut down
// GRACEFULLY (run the shutdown dream) before killing it — on win32 SIGTERM is never delivered
// (a taskkill /T /F just terminates the process), so without this the dream never runs on quit.
// Honored ONLY when the server is loopback-bound: a LAN-exposed instance (LUNA_BIND_HOST=0.0.0.0)
// must never be remotely killable. Token-less + idempotent — the same trust argument as the WS on
// loopback. Pure so the gate is unit-testable without booting the server.

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export function shouldHonorShutdown(method: string, pathname: string, bindHost: string): boolean {
  return method === 'POST' && pathname === '/shutdown' && isLoopbackHost(bindHost);
}
