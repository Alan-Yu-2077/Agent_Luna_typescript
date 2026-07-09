// One-command local dev launcher: brings up the agent server (WS 8787) + the web app (5173)
// together, with prefixed logs and Ctrl-C teardown. Run via `bun run dev`.
//
// Voice is bring-your-own and needs no process here: the web dev-server forwards /api/tts/* to a
// GPT-SoVITS api_v2 backend at LUNA_TTS_URL (inherited from the environment). Unset → the app uses the
// zero-setup browser voice (or runs muted). See docs/SETUP.md.

const BUN = process.execPath; // the bun binary running this script
const TTS_URL = Bun.env['LUNA_TTS_URL'];

type Service = { name: string; color: string; cmd: string[]; env?: Record<string, string> };

const services: Service[] = [
  {
    name: 'server',
    color: '32',
    cmd: [BUN, 'run', 'packages/server/src/main.ts'],
    // Proactive autonomous turns are OFF by default in dev so Luna never replies on
    // her own and confuses the feedback loop. Export LUNA_PROACTIVE=1 to test them.
    env: { LUNA_PROACTIVE: Bun.env['LUNA_PROACTIVE'] ?? '0' },
  },
  {
    name: 'web',
    color: '35',
    cmd: [BUN, 'packages/web/dev-server.ts'],
    // The web dev-server reads LUNA_TTS_* straight from the inherited env for its /api/tts forward.
  },
];

async function pipe(stream: ReadableStream<Uint8Array>, name: string, color: string): Promise<void> {
  const decoder = new TextDecoder();
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  let buffered = '';
  for await (const chunk of stream) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) console.log(prefix + line);
  }
  if (buffered) console.log(prefix + buffered);
}

const procs = services.map((s) => {
  const proc = Bun.spawn(s.cmd, {
    env: { ...process.env, ...s.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  void pipe(proc.stdout, s.name, s.color);
  void pipe(proc.stderr, s.name, s.color);
  return proc;
});

const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;
console.log('');
console.log(bold('  Luna is up — open the app at:'));
console.log(`     ${bold('\x1b[35mhttp://localhost:5173\x1b[0m')}   ${dim('← 在浏览器打开这个')}`);
console.log('');
console.log(dim('  services:'));
console.log(dim('     web      http://localhost:5173        (前端 / UI + Live2D)'));
console.log(dim('     server   ws://localhost:8787          (agent 后端 / WebSocket)'));
console.log(
  dim(
    TTS_URL
      ? `     voice    ${TTS_URL}   (GPT-SoVITS api_v2，经 /api/tts 转发)`
      : '     voice    (browser 语音，或设 LUNA_TTS_URL 接 GPT-SoVITS)',
  ),
);
console.log('');
console.log(dim('  Ctrl-C 停止全部'));
console.log('');

let shuttingDown = false;
function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) p.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
