// Isolated DEV launcher (dev worktree only). Brings up a SECOND, fully separate
// stack so development never disturbs the stable instance you test on:
//   - server (8888, --watch so edits hot-reload) with its OWN DB (luna-dev.sqlite)
//   - web (5273) pointed at the dev server via ?ws=8888
//   - TTS is SHARED with the stable instance (8788) — synthesis is stateless
// The stable `bun run dev` (8787/5173/8788, luna.sqlite) is untouched.
//
// Open: http://localhost:5273/?ws=8888
import { resolve } from 'node:path';

const BUN = process.execPath;
const ROOT = resolve(import.meta.dir, '..');
const DEV_DB = resolve(ROOT, 'luna-dev.sqlite');
const SERVER_PORT = Bun.env['LUNA_PORT'] ?? '8888';
const WEB_PORT = Bun.env['PORT'] ?? '5273';
const TTS_PROXY = Bun.env['LUNA_TTS_PROXY'] ?? 'http://localhost:8788'; // share the stable TTS

type Service = { name: string; color: string; cmd: string[]; env: Record<string, string> };
const services: Service[] = [
  {
    name: 'server',
    color: '\x1b[36m',
    cmd: [BUN, '--watch', 'run', 'packages/server/src/main.ts'],
    env: { LUNA_PORT: SERVER_PORT, LUNA_DB_PATH: DEV_DB, LUNA_PROACTIVE: Bun.env['LUNA_PROACTIVE'] ?? '0' },
  },
  {
    name: 'web',
    color: '\x1b[35m',
    cmd: [BUN, 'packages/web/dev-server.ts'],
    env: { PORT: WEB_PORT, LUNA_TTS_PROXY: TTS_PROXY },
  },
];

const procs = services.map((s) => {
  const proc = Bun.spawn(s.cmd, {
    cwd: ROOT,
    env: { ...process.env, ...s.env },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return { name: s.name, color: s.color, proc };
});

const dim = (t: string): string => `\x1b[2m${t}\x1b[0m`;
const bold = (t: string): string => `\x1b[1m${t}\x1b[0m`;
console.log('');
console.log(`  ${bold('Luna DEV (isolated)')} — separate from your stable instance`);
console.log(`     ${bold('\x1b[35mhttp://localhost:' + WEB_PORT + '/?ws=' + SERVER_PORT + '\x1b[0m')}   ${dim('← open this for dev')}`);
console.log(dim(`     server   ws://localhost:${SERVER_PORT}   (--watch, DB: luna-dev.sqlite)`));
console.log(dim(`     web      http://localhost:${WEB_PORT}`));
console.log(dim(`     tts      ${TTS_PROXY}   (shared with stable)`));
console.log(dim(`     stable instance (8787/5173, luna.sqlite) is untouched.`));
console.log('');

const shutdown = (): void => {
  for (const p of procs) p.proc.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
