// Proactive soak (Initiative 5, v0.11.0) — drive several heartbeat ticks on an
// idle session against the real model and report what the autonomous loop does:
// wake decisions (act/hold + reason), whether a turn fired, what she did (tools
// + bubbles), and that the cadence governor holds (cooldown/quota). Dev-scale,
// manual; not a deterministic test. Ephemeral db; the real luna.sqlite is safe.
// Run: ANTHROPIC_BASE_URL=https://yunwu.ai LUNA_PROACTIVE=1 bun scripts/proactive-soak.ts
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { initCustomSqlite } from '../src/memory/recall/vecRuntime';
initCustomSqlite();
import { migrate } from '../src/sql';
import { setMemoryDb } from '../src/memory/sessionStore';
import { addFact } from '../src/memory/l3Store';
import { AnthropicProvider } from '../src/provider/anthropic';
import { messageRegistry } from '../src/tools/registry';
import { getSession } from '../src/turn/session';
import { TraceStore } from '../src/trace/store';
import { setTraceStore } from '../src/trace/instrument';
import { runTick } from '../src/proactive/scheduler';
import { loadCadence } from '../src/proactive/cadence';

Bun.env['LUNA_PROACTIVE'] = '1';
// short idle threshold + no cooldown so the soak actually exercises the loop
Bun.env['LUNA_PROACTIVE_IDLE_THRESHOLD_MS'] = '1';
Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'] = '1';
Bun.env['LUNA_PROACTIVE_QUIET_HOURS'] = '';

const db = new Database(':memory:', { strict: true });
migrate(db, join(import.meta.dir, '..', 'src', 'migrations'));
setMemoryDb(db);
setTraceStore(new TraceStore(db));

addFact('core_facts', '用户叫 Alan，在做 Agent_Luna 的 TypeScript 重写');
addFact('preferences', 'Alan 喜欢猫，爱在家煮意式浓缩');
addFact('active_threads', '今天在做 Luna 的主动性模块（proactive agency）');

const provider = new AnthropicProvider();
const dreamLlm = { primary: provider, fallback: null };

const session = getSession('default');
session.lastUserMs = Date.now() - 30 * 60_000; // 30 min idle

const TICKS = Number(Bun.env['SOAK_TICKS'] ?? 4);
let fires = 0;
let silent = 0;

for (let i = 0; i < TICKS; i++) {
  const before = loadCadence('default').quotaUsed;
  const tools: string[] = [];
  const bubbles: string[] = [];
  const deps = {
    provider,
    registry: messageRegistry,
    dreamLlm,
    emit: (e: { type: string; tool_name?: string; result?: { kind: string; data?: { text?: string } } }) => {
      if (e.type === 'tool.started' && e.tool_name && e.tool_name !== 'message') tools.push(e.tool_name);
      if (e.type === 'tool.finished' && e.result?.kind === 'ok' && e.result.data?.text) {
        bubbles.push(e.result.data.text);
      }
    },
  };
  // reset the cooldown so each tick is eligible (soak only)
  await runTick(deps as Parameters<typeof runTick>[0]);
  const after = loadCadence('default').quotaUsed;
  const fired = after > before;
  if (fired) fires += 1;
  if (fired && bubbles.length === 0) silent += 1;
  console.log(
    `tick ${i}: fired=${fired} tools=${JSON.stringify(tools)} bubbles=${JSON.stringify(bubbles).slice(0, 140)}`,
  );
  // bump lastProactive back so the next tick isn't cooldown-blocked (soak only)
  const c = loadCadence('default');
  c.lastProactiveMs = 0;
  // (saveCadence not re-exported here; rely on MIN_INTERVAL=1 to keep eligible)
}

console.log(`\n== soak: ${TICKS} ticks, fired ${fires}, of which silent ${silent}, spoke ${fires - silent}`);
db.close(false);
