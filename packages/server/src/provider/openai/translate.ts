import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { unwrapGatewayInput } from '../anthropic';
import type { ProviderToolUse, ProviderUsage } from '../types';

// v0.23.1 (Initiative 16): the pure Anthropic⇄OpenAI translation core. The internal canonical
// format stays Anthropic-shaped (session.history, assistantContent); this module is the only place
// that knows the OpenAI Chat-Completions wire shape. No I/O — exhaustively unit-tested.

// ── OpenAI Chat-Completions wire types (local — no OpenAI SDK dependency) ──
export type OAToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
export type OAChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OAToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type OATool = {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
};

// ── request translation (Anthropic-shaped → OpenAI) ──

// The system param (string or cache_control-marked text blocks) → a single system message. The
// cache_control breakpoint is simply NOT read here — OpenAI has no explicit cache control.
export function systemToOpenAI(system: string | Anthropic.TextBlockParam[]): OAChatMessage {
  const content = typeof system === 'string' ? system : system.map((b) => b.text).join('\n\n');
  return { role: 'system', content };
}

function toolResultText(content: Anthropic.ToolResultBlockParam['content']): string {
  if (typeof content === 'string') return content;
  if (!content) return '';
  return content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');
}

// One Anthropic MessageParam can expand into several OpenAI messages: an assistant turn with
// tool_use → one assistant message carrying tool_calls; a user turn with tool_result blocks → one
// OpenAI `tool` message per result (tool messages must follow the assistant tool_calls), plus a
// user text message if it also carries text. Thinking blocks are dropped on replay.
export function messagesToOpenAI(messages: Anthropic.MessageParam[]): OAChatMessage[] {
  const out: OAChatMessage[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push(
        m.role === 'assistant'
          ? { role: 'assistant', content: m.content }
          : { role: 'user', content: m.content },
      );
      continue;
    }
    if (m.role === 'assistant') {
      let text = '';
      const toolCalls: OAToolCall[] = [];
      for (const b of m.content) {
        if (b.type === 'text') text += b.text;
        else if (b.type === 'tool_use') {
          toolCalls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
          });
        }
      }
      out.push(
        toolCalls.length > 0
          ? { role: 'assistant', content: text.length > 0 ? text : null, tool_calls: toolCalls }
          : { role: 'assistant', content: text },
      );
      continue;
    }
    // user role: tool_result blocks become standalone `tool` messages; text becomes a user message
    let text = '';
    for (const b of m.content) {
      if (b.type === 'text') text += b.text;
      else if (b.type === 'tool_result') {
        out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: toolResultText(b.content) });
      }
    }
    if (text.length > 0) out.push({ role: 'user', content: text });
  }
  return out;
}

export function toolsToOpenAI(tools: Anthropic.Tool[]): OATool[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description ?? '', parameters: t.input_schema },
  }));
}

// OpenAI tool_call arguments are a JSON string. Tolerate the empty/no-arg case and malformed JSON
// (→ {}), so tool validation produces a recoverable error the model can fix rather than a throw.
export function parseToolArguments(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return {};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// ── response translation (OpenAI → Anthropic-shaped) ──

const OAResponse = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .optional(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).partial().optional(),
});

export type OAParsedResponse = z.infer<typeof OAResponse>;
export type OAMessage = OAParsedResponse['choices'][number]['message'];

export function parseOpenAIResponse(json: unknown): OAParsedResponse {
  return OAResponse.parse(json);
}

// Synthesize the assistant turn runTurn stores in session.history (a ContentBlockParam[] — input
// for the next turn), so replay is unchanged and the NEXT turn translates it back to OpenAI.
export function toAssistantContent(message: OAMessage): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  if (message.content && message.content.length > 0) {
    blocks.push({ type: 'text', text: message.content });
  }
  for (const tc of message.tool_calls ?? []) {
    blocks.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input: unwrapGatewayInput(parseToolArguments(tc.function.arguments)),
    });
  }
  return blocks;
}

export function toProviderToolUses(message: OAMessage): ProviderToolUse[] {
  return (message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    input: unwrapGatewayInput(parseToolArguments(tc.function.arguments)),
  }));
}

export function mapStopReason(finish: string | null | undefined): string {
  if (finish === 'tool_calls') return 'tool_use';
  if (finish === 'length') return 'max_tokens';
  if (finish === 'stop') return 'end_turn';
  return finish ?? 'end_turn';
}

export function mapUsage(usage: OAParsedResponse['usage']): ProviderUsage {
  return { input_tokens: usage?.prompt_tokens ?? 0, output_tokens: usage?.completion_tokens ?? 0 };
}
