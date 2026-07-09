// Manual smoke: 2-round tool turn through the gateway. Run with:
//   bun --env-file=../../.env scripts/smoke-gateway.ts
// Verifies the 3 gateway risks before building the turn loop:
// 1. adaptive thinking + display:'summarized' accepted
// 2. signed thinking blocks survive history round-trip (round 2 would 400 otherwise)
// 3. tool_use streaming works
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: Bun.env['ANTHROPIC_API_KEY'],
  baseURL: Bun.env['ANTHROPIC_BASE_URL'],
  maxRetries: 0,
});

const MODEL = Bun.env['LUNA_MODEL'] ?? 'claude-opus-4-8';

const tools: Anthropic.Tool[] = [
  {
    name: 'time_now',
    description: 'Returns the current time.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const messages: Anthropic.MessageParam[] = [
  { role: 'user', content: 'What time is it right now? Use the tool, then answer in one short sentence.' },
];

console.log(`[smoke] round 1 → ${Bun.env['ANTHROPIC_BASE_URL']} model=${MODEL}`);
const stream1 = client.messages.stream({
  model: MODEL,
  max_tokens: 2048,
  messages,
  tools,
  thinking: { type: 'adaptive', display: 'summarized' },
});

let textCount1 = 0;
let thinkingCount1 = 0;
for await (const ev of stream1) {
  if (ev.type === 'content_block_delta') {
    if (ev.delta.type === 'text_delta') textCount1++;
    if (ev.delta.type === 'thinking_delta') thinkingCount1++;
  }
}
const final1 = await stream1.finalMessage();
console.log(`[smoke] round 1 done: stop=${final1.stop_reason} text_deltas=${textCount1} thinking_deltas=${thinkingCount1}`);
console.log(`[smoke] content blocks: ${final1.content.map((b) => b.type).join(', ')}`);

const toolUse = final1.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
if (!toolUse) {
  console.log('[smoke] FAIL: model did not call the tool');
  process.exit(1);
}

messages.push({ role: 'assistant', content: final1.content });
messages.push({
  role: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: JSON.stringify({ iso: new Date().toISOString(), tz: 'America/New_York' }),
    },
  ],
});

console.log('[smoke] round 2 → sending tool_result with verbatim assistant content (signed thinking blocks)');
const stream2 = client.messages.stream({
  model: MODEL,
  max_tokens: 2048,
  messages,
  tools,
  thinking: { type: 'adaptive', display: 'summarized' },
});

let text2 = '';
for await (const ev of stream2) {
  if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
    text2 += ev.delta.text;
  }
}
const final2 = await stream2.finalMessage();
console.log(`[smoke] round 2 done: stop=${final2.stop_reason}`);
console.log(`[smoke] reply: ${text2.trim().slice(0, 200)}`);
console.log(`[smoke] usage r1=${final1.usage.input_tokens}/${final1.usage.output_tokens} r2=${final2.usage.input_tokens}/${final2.usage.output_tokens}`);
console.log('[smoke] PASS — gateway supports adaptive thinking + signed-block round-trip + tool streaming');
