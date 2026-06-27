import type { ProviderCapabilities } from '../capabilities';
import type {
  CompleteRequest,
  CompleteResult,
  Provider,
  ProviderEvent,
  ProviderRequest,
} from '../types';
import {
  mapStopReason,
  mapUsage,
  messagesToOpenAI,
  parseOpenAIResponse,
  systemToOpenAI,
  toAssistantContent,
  toProviderToolUses,
  toolsToOpenAI,
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

// Test seam (mirrors setWeatherFetcher / setWebFetcher): inject canned response JSON and assert on
// the request body, with no network/DNS. null restores the real fetch path.
export type OpenAIFetcher = (args: {
  url: string;
  apiKey: string;
  body: unknown;
  signal?: AbortSignal;
}) => Promise<unknown>;

async function defaultFetch(args: {
  url: string;
  apiKey: string;
  body: unknown;
  signal?: AbortSignal;
}): Promise<unknown> {
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

let rawFetch: OpenAIFetcher = defaultFetch;

export function setOpenAIFetcher(fn: OpenAIFetcher | null): void {
  rawFetch = fn ?? defaultFetch;
}

// v0.23.1: a correctness-first OpenAI Chat-Completions provider — `complete` + a NON-streaming
// `chatStream` (one message_stop). Real token streaming + interleaved tool-use is v0.23.2; the
// emitted ProviderEvent sequence shape is what the streaming path will reproduce.
export class OpenAIProvider implements Provider {
  private apiKey: string;

  // thinking/promptCache/interleavedToolStreaming flip per-model in v0.23.2/v0.23.3 (the registry).
  readonly capabilities: ProviderCapabilities = {
    thinking: false,
    promptCache: false,
    interleavedToolStreaming: false,
    toolUse: true,
    systemRole: true,
    maxOutputTokens: MAX_TOKENS,
  };

  constructor(opts?: { apiKey?: string }) {
    this.apiKey =
      opts?.apiKey ?? Bun.env['LUNA_OPENAI_API_KEY'] ?? Bun.env['ANTHROPIC_API_KEY'] ?? '';
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const body = {
      model: MODEL,
      max_tokens: req.maxTokens ?? 2048,
      messages: [systemToOpenAI(req.system), ...messagesToOpenAI(req.messages)],
    };
    const parsed = parseOpenAIResponse(
      await rawFetch({ url: chatUrl(), apiKey: this.apiKey, body }),
    );
    const choice = parsed.choices[0];
    if (!choice) throw new Error('openai: empty choices');
    return { text: choice.message.content ?? '', usage: mapUsage(parsed.usage) };
  }

  async *chatStream(req: ProviderRequest): AsyncIterable<ProviderEvent> {
    const tools = req.tools.length > 0 ? toolsToOpenAI(req.tools) : undefined;
    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [systemToOpenAI(req.system), ...messagesToOpenAI(req.messages)],
      ...(tools ? { tools } : {}),
      stream: false,
    };
    const parsed = parseOpenAIResponse(
      await rawFetch({ url: chatUrl(), apiKey: this.apiKey, body, signal: req.signal }),
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
}
