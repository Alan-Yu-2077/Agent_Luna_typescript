import type { ProviderCapabilities } from '../capabilities';
import type {
  CompleteRequest,
  CompleteResult,
  Provider,
  ProviderEvent,
  ProviderRequest,
} from '../types';
import {
  consumeSSE,
  mapStopReason,
  mapUsage,
  messagesToOpenAI,
  parseOpenAIResponse,
  parseStreamChunk,
  streamedAssistantContent,
  streamedToolUses,
  systemToOpenAI,
  toAssistantContent,
  toProviderToolUses,
  toolsToOpenAI,
  type ToolCallParts,
} from './translate';

const MODEL = Bun.env['LUNA_MODEL'] ?? 'gpt-4o-mini';
const MAX_TOKENS = Number(Bun.env['LUNA_MAX_TOKENS'] ?? 8192);

// The OpenAI-compatible endpoint is the user's configured, trusted LLM gateway (the yunwu OpenAI
// route by default — same host/key as the Anthropic path). Like ANTHROPIC_BASE_URL it is NOT
// SSRF-guarded; it is not user-content-derived.
function chatUrl(): string {
  const base = (
    Bun.env['LUNA_OPENAI_BASE_URL'] ??
    Bun.env['ANTHROPIC_BASE_URL'] ??
    'https://api.openai.com/v1'
  ).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

type FetchArgs = { url: string; apiKey: string; body: unknown; signal?: AbortSignal };

// Test seams (mirror setWeatherFetcher / setWebFetcher): inject canned response JSON or canned SSE
// chunk objects and assert on the request body, with no network. null restores the real path.
export type OpenAIFetcher = (args: FetchArgs) => Promise<unknown>;
export type OpenAIStreamFetcher = (args: FetchArgs) => AsyncIterable<unknown>;

async function defaultFetch(args: FetchArgs): Promise<unknown> {
  const res = await fetch(args.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify(args.body),
    signal: args.signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`openai_http_${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

// Reads the chat-completions SSE stream and yields each parsed `data:` payload (skips `[DONE]`,
// comments, and keepalives). One JSON object per data line is the OpenAI shape.
async function* defaultStreamFetch(args: FetchArgs): AsyncIterable<unknown> {
  const res = await fetch(args.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.apiKey}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify(args.body),
    signal: args.signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`openai_http_${res.status}: ${detail.slice(0, 200)}`);
  }
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function* emit(payloads: string[]): Generator<unknown> {
    for (const p of payloads) {
      try {
        yield JSON.parse(p);
      } catch {
        /* a comment/keepalive that isn't valid JSON — skip */
      }
    }
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      // flush a final data line that arrived without a trailing newline
      const tail = consumeSSE(buffer.length > 0 ? `${buffer}\n` : '');
      yield* emit(tail.payloads);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const { payloads, rest, done: sawDone } = consumeSSE(buffer);
    buffer = rest;
    yield* emit(payloads);
    if (sawDone) return;
  }
}

let rawFetch: OpenAIFetcher = defaultFetch;
let streamFetch: OpenAIStreamFetcher = defaultStreamFetch;

export function setOpenAIFetcher(fn: OpenAIFetcher | null): void {
  rawFetch = fn ?? defaultFetch;
}

export function setOpenAIStreamFetcher(fn: OpenAIStreamFetcher | null): void {
  streamFetch = fn ?? defaultStreamFetch;
}

// The OpenAI Chat-Completions provider (Initiative 16). v0.23.1 shipped `complete` + a
// correctness-first non-streaming `chatStream`; v0.23.2 adds the real SSE streaming path
// (interleaved tool-use + reasoning→thinking), behind LUNA_OPENAI_STREAM. Both paths emit the same
// ProviderEvent sequence shape and reuse the same block builders → identical replayed history.
export class OpenAIProvider implements Provider {
  private apiKey: string;
  readonly capabilities: ProviderCapabilities;

  constructor(opts?: { apiKey?: string }) {
    this.apiKey =
      opts?.apiKey ?? Bun.env['LUNA_OPENAI_API_KEY'] ?? Bun.env['ANTHROPIC_API_KEY'] ?? '';
    this.capabilities = {
      // reasoning models surface reasoning as thinking_delta; flagged until the v0.23.3 registry.
      thinking: Bun.env['LUNA_OPENAI_REASONING'] === '1',
      promptCache: false,
      interleavedToolStreaming: Bun.env['LUNA_OPENAI_STREAM'] === '1',
      toolUse: true,
      systemRole: true,
      maxOutputTokens: MAX_TOKENS,
    };
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const body = {
      model: MODEL,
      max_tokens: req.maxTokens ?? 2048,
      messages: [systemToOpenAI(req.system), ...messagesToOpenAI(req.messages)],
    };
    const parsed = parseOpenAIResponse(await rawFetch({ url: chatUrl(), apiKey: this.apiKey, body }));
    const choice = parsed.choices[0];
    if (!choice) throw new Error('openai: empty choices');
    return { text: choice.message.content ?? '', usage: mapUsage(parsed.usage) };
  }

  chatStream(req: ProviderRequest): AsyncIterable<ProviderEvent> {
    return Bun.env['LUNA_OPENAI_STREAM'] === '1'
      ? this.chatStreamSSE(req)
      : this.chatStreamBuffered(req);
  }

  private requestBody(req: ProviderRequest, stream: boolean): Record<string, unknown> {
    const tools = req.tools.length > 0 ? toolsToOpenAI(req.tools) : undefined;
    return {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [systemToOpenAI(req.system), ...messagesToOpenAI(req.messages)],
      ...(tools ? { tools } : {}),
      ...(stream ? { stream: true, stream_options: { include_usage: true } } : { stream: false }),
    };
  }

  // v0.23.1 path: one non-streaming call → an optional text_delta then one message_stop.
  private async *chatStreamBuffered(req: ProviderRequest): AsyncIterable<ProviderEvent> {
    const parsed = parseOpenAIResponse(
      await rawFetch({
        url: chatUrl(),
        apiKey: this.apiKey,
        body: this.requestBody(req, false),
        signal: req.signal,
      }),
    );
    const choice = parsed.choices[0];
    if (!choice) throw new Error('openai: empty choices');
    const msg = choice.message;
    const text = msg.content ?? '';
    if (text.length > 0) yield { kind: 'text_delta', text };
    yield {
      kind: 'message_stop',
      stopReason: mapStopReason(choice.finish_reason),
      toolUses: toProviderToolUses(msg),
      assistantContent: toAssistantContent(msg),
      usage: mapUsage(parsed.usage),
    };
  }

  // v0.23.2 path: real SSE. Emits text_delta / thinking_delta / tool_use_start / tool_input_delta
  // as they arrive (interleaved), accumulating tool calls per `index`, then one message_stop built
  // from the same parts the non-streaming path uses.
  private async *chatStreamSSE(req: ProviderRequest): AsyncIterable<ProviderEvent> {
    let text = '';
    let usage = { input_tokens: 0, output_tokens: 0 };
    let finishReason: string | null = null;
    const acc = new Map<number, ToolCallParts & { started: boolean }>();

    for await (const raw of streamFetch({
      url: chatUrl(),
      apiKey: this.apiKey,
      body: this.requestBody(req, true),
      signal: req.signal,
    })) {
      const chunk = parseStreamChunk(raw);
      if (chunk.usage) usage = mapUsage(chunk.usage);
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        yield { kind: 'text_delta', text: delta.content };
      }
      const reasoning = delta?.reasoning ?? delta?.reasoning_content;
      if (reasoning) yield { kind: 'thinking_delta', text: reasoning };
      for (const tc of delta?.tool_calls ?? []) {
        let t = acc.get(tc.index);
        if (!t) {
          t = { id: '', name: '', arguments: '', started: false };
          acc.set(tc.index, t);
        }
        if (tc.id) t.id = tc.id;
        if (tc.function?.name) t.name = tc.function.name;
        if (!t.started && t.id && t.name) {
          t.started = true;
          yield { kind: 'tool_use_start', id: t.id, name: t.name };
          // flush any argument fragments that arrived before the id/name
          if (t.arguments.length > 0) {
            yield { kind: 'tool_input_delta', id: t.id, name: t.name, partial_json: t.arguments };
          }
        }
        const frag = tc.function?.arguments;
        if (frag) {
          t.arguments += frag;
          if (t.started) {
            yield { kind: 'tool_input_delta', id: t.id, name: t.name, partial_json: frag };
          }
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    const parts: ToolCallParts[] = [...acc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, t]) => ({ id: t.id, name: t.name, arguments: t.arguments }));
    // If tools were accumulated but a non-conformant stream never sent the terminal
    // `finish_reason: tool_calls` chunk, default to a tool stop — otherwise stopReason would be
    // 'end_turn' and runTurn would NOT dispatch the tools, orphaning the tool_use blocks in
    // history (and 400-ing the next OpenAI request). Conformant OpenAI always sets it.
    const effectiveFinish = finishReason ?? (parts.length > 0 ? 'tool_calls' : null);
    yield {
      kind: 'message_stop',
      stopReason: mapStopReason(effectiveFinish),
      toolUses: streamedToolUses(parts),
      assistantContent: streamedAssistantContent(text, parts),
      usage,
    };
  }
}
