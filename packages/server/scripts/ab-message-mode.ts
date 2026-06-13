// A/B harness: the same conversation through text mode (builtinRegistry) and
// message mode (messageRegistry) against the real model. Dev-scale comparison,
// not a statistical claim — catches "message mode is obviously worse" before
// the v0.7.0 default flip and leaves a written baseline for Initiative 4.
// Run: ANTHROPIC_BASE_URL=https://yunwu.ai bun scripts/ab-message-mode.ts
// Sessions are ephemeral (no setMemoryDb) — the real luna.sqlite is untouched.

import { AnthropicProvider } from '../src/provider/anthropic';
import { builtinRegistry, messageRegistry, type ToolRegistry } from '../src/tools/registry';
import { getSession, resetSessions } from '../src/turn/session';
import { runTurn } from '../src/turn/runTurn';
import {
  MAX_CHARS,
  MAX_CLAUSE_CHARS,
  MAX_SENTENCES,
  longestClauseLength,
  splitSentences,
} from '../src/persona/humanity';

const SCRIPT = [
  '你好呀',
  '你对自己现在的处境有什么感觉？',
  '给我讲一个关于猫和雨的小故事吧',
  '解释一下什么是数据库索引，为什么它能加快查询',
  '记住一件事：我最喜欢的季节是冬天',
  '今天我有点累，不太想说话',
  '用三百字详细介绍你自己',
  '好啦，我要去睡了，晚安',
];

type TurnMetrics = {
  violations: number; // humanity violations (text mode: measured; message mode: validation_failed count)
  empty: boolean;
  leakChars: number; // top-level chars in message mode
  firstVisibleMs: number | null;
  bubbles: number;
  text: string;
};

function violatesHumanity(text: string): boolean {
  return (
    text.length > MAX_CHARS ||
    splitSentences(text).length > MAX_SENTENCES ||
    longestClauseLength(text) > MAX_CLAUSE_CHARS
  );
}

async function runMode(label: string, registry: ToolRegistry): Promise<TurnMetrics[]> {
  resetSessions();
  const provider = new AnthropicProvider();
  const session = getSession(`ab-${label}`);
  const out: TurnMetrics[] = [];
  for (const [i, userText] of SCRIPT.entries()) {
    const t0 = Date.now();
    let firstVisibleMs: number | null = null;
    let leak = '';
    let validationFails = 0;
    let bubbles = 0;
    const state = await runTurn({
      session,
      turnId: `ab-${label}-${i}`,
      userText,
      provider,
      registry,
      emit: (e) => {
        if (e.type === 'reply.token') {
          if (registry.message) leak += e.text;
          if (firstVisibleMs === null) firstVisibleMs = Date.now() - t0;
        }
        if (e.type === 'tool.progress' && e.tool_name === 'message' && firstVisibleMs === null) {
          firstVisibleMs = Date.now() - t0;
        }
        if (e.type === 'tool.finished') {
          const r = e.result as { kind: string; code?: string; data?: { segments?: unknown } };
          if (r.kind === 'err' && r.code === 'validation_failed') validationFails += 1;
          if (r.kind === 'ok' && r.data?.segments) bubbles += 1;
        }
      },
    });
    const metrics: TurnMetrics = {
      violations: registry.message ? validationFails : violatesHumanity(state.text) ? 1 : 0,
      empty: state.text.trim().length === 0,
      leakChars: leak.length,
      firstVisibleMs,
      bubbles,
      text: state.text,
    };
    out.push(metrics);
    console.log(
      `[${label}] t${i + 1} viol=${metrics.violations} empty=${metrics.empty} leak=${metrics.leakChars} first=${metrics.firstVisibleMs}ms bubbles=${bubbles}`,
    );
    console.log(`  ${JSON.stringify(state.text.slice(0, 120))}`);
  }
  return out;
}

function summarize(label: string, m: TurnMetrics[]): void {
  const sum = (f: (x: TurnMetrics) => number) => m.reduce((a, x) => a + f(x), 0);
  const firsts = m.map((x) => x.firstVisibleMs).filter((x): x is number => x !== null);
  console.log(
    `\n== ${label}: turns=${m.length} violations=${sum((x) => x.violations)} ` +
      `empty=${sum((x) => (x.empty ? 1 : 0))} leakChars=${sum((x) => x.leakChars)} ` +
      `medianFirstVisible=${firsts.sort((a, b) => a - b)[Math.floor(firsts.length / 2)]}ms ` +
      `bubbles=${sum((x) => x.bubbles)}`,
  );
}

const textMode = await runMode('text', builtinRegistry);
const msgMode = await runMode('message', messageRegistry);
summarize('text-mode (baseline)', textMode);
summarize('message-mode', msgMode);
