// v0.26.0 (Initiative 19): the WS endpoint resolver — pure + unit-testable. The old inline
// `ws://${location.hostname}:${port}` broke the moment the page wasn't served from the same host as
// the server (a desktop shell's custom protocol yields 'tauri.localhost'/''; file:// yields '').
// The desktop app ALWAYS talks to a local server, so the default host is a fixed 127.0.0.1; the
// `?ws=` override keeps the isolated-dev flow (`:5273/?ws=8888`) working unchanged.
export function resolveWsUrl(search: string, defaultPort = '8787'): string {
  const port = new URLSearchParams(search).get('ws') ?? defaultPort;
  return `ws://127.0.0.1:${port}`;
}
