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
  | { role: 'system' | 'developer' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OAToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type OATool = {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
};

// ── request translation (Anthropic-shaped → OpenAI) ──

// The system param (string or cache_control-marked text blocks) → a single system/developer
// message (some reasoning models reject the `system` role). The cache_control breakpoint is simply
// NOT read here — OpenAI has no explicit cache control.
export function systemToOpenAI(
  system: string | Anthropic.TextBlockParam[],
  role: 'system' | 'developer' = 'system',
): OAChatMessage {
  const content = typeof system === 'string' ? system : system.map((b) => b.text).join('\n\n');
  return { role, content };
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
        // OpenAI's `tool` message has no per-result error flag — prefix so the model still learns
        // the tool failed (Anthropic carries is_error structurally).
        const body = toolResultText(b.content);
        out.push({
          role: 'tool',
          tool_call_id: b.tool_use_id,
          content: b.is_error ? `[tool error] ${body}` : body,
        });
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

// A tool call reduced to its replayable parts — the shared currency of the non-streaming response
// path and the streaming accumulator, so both synthesize byte-identical history.
export type ToolCallParts = { id: string; name: string; arguments: string };

function blocksFromParts(text: string | null, toolCalls: ToolCallParts[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  if (text && text.length > 0) blocks.push({ type: 'text', text });
  for (const tc of toolCalls) {
    blocks.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.name,
      input: unwrapGatewayInput(parseToolArguments(tc.arguments)),
    });
  }
  return blocks;
}

function toolUsesFromParts(toolCalls: ToolCallParts[]): ProviderToolUse[] {
  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.name,
    input: unwrapGatewayInput(parseToolArguments(tc.arguments)),
  }));
}

function messageParts(message: OAMessage): ToolCallParts[] {
  return (message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));
}

// Synthesize the assistant turn runTurn stores in session.history (a ContentBlockParam[] — input
// for the next turn), so replay is unchanged and the NEXT turn translates it back to OpenAI.
export function toAssistantContent(message: OAMessage): Anthropic.ContentBlockParam[] {
  return blocksFromParts(message.content ?? null, messageParts(message));
}

export function toProviderToolUses(message: OAMessage): ProviderToolUse[] {
  return toolUsesFromParts(messageParts(message));
}

// The streaming path's counterparts: assemble from accumulated text + tool-call parts. Same
// builders as the non-streaming path → identical history whether or not streaming is on.
export function streamedAssistantContent(
  text: string,
  toolCalls: ToolCallParts[],
): Anthropic.ContentBlockParam[] {
  return blocksFromParts(text.length > 0 ? text : null, toolCalls);
}

export function streamedToolUses(toolCalls: ToolCallParts[]): ProviderToolUse[] {
  return toolUsesFromParts(toolCalls);
}

// ── streaming chunk translation (OpenAI SSE delta → ProviderEvent pieces) ──

const StreamChunk = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullable().optional(),
            reasoning: z.string().nullable().optional(),
            reasoning_content: z.string().nullable().optional(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number().default(0), // some gateways omit it on a single-tool stream
                  id: z.string().optional(),
                  function: z
                    .object({ name: z.string().optional(), arguments: z.string().optional() })
                    .optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).partial().optional(),
  // a streaming error frame (HTTP 200 + an in-band error) — modeled so it's detectable, not
  // swallowed. Accept both the canonical object shape and a bare string (non-conformant gateways).
  error: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
});

export type OAStreamChunk = z.infer<typeof StreamChunk>;

// Tolerant chunk parse: a slightly-off but harmless chunk should NOT crash a turn that has already
// streamed text. Returns null on a shape mismatch so the caller skips it and keeps going.
export function parseStreamChunkSafe(json: unknown): OAStreamChunk | null {
  const r = StreamChunk.safeParse(json);
  return r.success ? r.data : null;
}

// A human-readable message if a chunk is an error frame (rate-limit/quota/server error on a 200).
export function streamErrorMessage(chunk: OAStreamChunk): string | null {
  if (chunk.error == null) return null;
  if (typeof chunk.error === 'string') return chunk.error.length > 0 ? chunk.error : 'openai stream error';
  const m = chunk.error['message'];
  return typeof m === 'string' && m.length > 0 ? m : 'openai stream error';
}

// Pure SSE framing: pull complete `data:` payloads out of a text buffer, returning the unconsumed
// remainder (a line split across network reads) and whether `[DONE]` was seen. Handles CRLF
// (trim strips the trailing \r) + multiple data lines. The caller force-terminates the final line
// at stream end so a payload without a trailing newline isn't lost.
export function consumeSSE(buffer: string): { payloads: string[]; rest: string; done: boolean } {
  const payloads: string[] = [];
  let rest = buffer;
  let nl = rest.indexOf('\n');
  while (nl !== -1) {
    const line = rest.slice(0, nl).trim();
    rest = rest.slice(nl + 1);
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data === '[DONE]') return { payloads, rest: '', done: true };
      if (data) payloads.push(data);
    }
    nl = rest.indexOf('\n');
  }
  return { payloads, rest, done: false };
}

export function mapStopReason(finish: string | null | undefined): string {
  if (finish === 'tool_calls') return 'tool_use';
  if (finish === 'length') return 'max_tokens';
  if (finish === 'stop') return 'end_turn';
  // `content_filter` (and any other reason) passes through verbatim, not masked as a clean end_turn,
  // so a blocked completion is visible downstream rather than looking like a normal stop.
  return finish ?? 'end_turn';
}

export function mapUsage(usage: OAParsedResponse['usage']): ProviderUsage {
  return { input_tokens: usage?.prompt_tokens ?? 0, output_tokens: usage?.completion_tokens ?? 0 };
}
