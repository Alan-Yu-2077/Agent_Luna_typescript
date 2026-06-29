import type { ProviderCapabilities } from '../capabilities';
import { DEFAULT_OPENAI_MODEL, type ModelEntry } from '../registry';
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
  parseStreamChunkSafe,
  streamErrorMessage,
  streamedAssistantContent,
  streamedToolUses,
  systemToOpenAI,
  toAssistantContent,
  toProviderToolUses,
  toolsToOpenAI,
  type ToolCallParts,
} from './translate';

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const MAX_TOKENS = num('LUNA_MAX_TOKENS', 8192); // NaN-guarded — a mistyped env can't 400 every turn
const SSE_LINE_CAP = 1_000_000; // a data line that never terminates → bail rather than grow forever

// The OpenAI-compatible endpoint. v0.23.4: do NOT fall back to ANTHROPIC_BASE_URL — that is by
// convention the bare Anthropic host (drops `/v1` → 404, and would ship the OpenAI request + bearer
// key to the Anthropic host). Require LUNA_OPENAI_BASE_URL or default to OpenAI's own. It is the
// user's configured, trusted LLM endpoint (not user-content-derived), so it is not SSRF-guarded.
function chatUrl(): string {
  const base = (Bun.env['LUNA_OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

type FetchArgs = { url: string; apiKey: string; body: unknown; signal?: AbortSignal };

export type OpenAIFetcher = (args: FetchArgs) => Promise<unknown>;
export type OpenAIStreamFetcher = (args: FetchArgs) => AsyncIterable<unknown>;

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// One fetch with a small bounded retry on a transient (connect error / 429 / 5xx) BEFORE the first
// byte — parity with the Anthropic SDK's maxRetries:2. On a final non-ok, the raw upstream body is
// logged server-side but NOT surfaced (it may carry gateway internals / key fragments); the thrown
// error carries only the status.
async function fetchOk(args: FetchArgs, accept?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${args.apiKey}`,
  };
  if (accept) headers['accept'] = accept;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(args.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(args.body),
        signal: args.signal,
      });
      if (res.ok) return res;
      if (attempt < 2 && RETRYABLE.has(res.status)) {
        await res.body?.cancel().catch(() => {});
        await Bun.sleep(250 * (attempt + 1));
        continue;
      }
      const detail = await res.text().catch(() => '');
      console.warn(`[openai] HTTP ${res.status}: ${detail.slice(0, 300)}`);
      throw new Error(`openai_http_${res.status}`);
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && e.message.startsWith('openai_http_')) throw e; // final, non-retryable
      if (args.signal?.aborted) throw e;
      if (attempt >= 2) break;
      await Bun.sleep(250 * (attempt + 1));
    }
  }
  throw new Error(
    `openai_fetch_failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

async function defaultFetch(args: FetchArgs): Promise<unknown> {
  const res = await fetchOk(args);
  return res.json();
}

// Reads the chat-completions SSE stream and yields each parsed `data:` payload (skips `[DONE]`,
// comments, keepalives). Releases the reader on any exit (normal/throw/abort) so the connection
// isn't leaked; caps the line buffer so a never-terminating stream can't grow unbounded.
async function* defaultStreamFetch(args: FetchArgs): AsyncIterable<unknown> {
  const res = await fetchOk(args, 'text/event-stream');
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
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = consumeSSE(buffer.length > 0 ? `${buffer}\n` : '');
        yield* emit(tail.payloads);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > SSE_LINE_CAP) throw new Error('openai stream: line buffer exceeded cap');
      const { payloads, rest, done: sawDone } = consumeSSE(buffer);
      buffer = rest;
      yield* emit(payloads);
      if (sawDone) return;
    }
  } finally {
    await reader.cancel().catch(() => {});
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

// The OpenAI Chat-Completions provider (Initiative 16). `complete` + `chatStream` (non-streaming
// default; real SSE behind LUNA_OPENAI_STREAM). Both paths emit the same ProviderEvent sequence and
// reuse the same block builders → identical replayed history. v0.23.4 hardened the config, parsing,
// retry, and tool-stop/forcing behavior for the third-party gateways this adapter targets.
export class OpenAIProvider implements Provider {
  private apiKey: string;
  private model: string;
  private tokenParam: 'max_tokens' | 'max_completion_tokens';
  private systemRole: 'system' | 'developer';
  private toolChoice: 'required' | 'auto';
  readonly capabilities: ProviderCapabilities;

  constructor(opts?: { apiKey?: string; entry?: ModelEntry; model?: string }) {
    this.apiKey =
      opts?.apiKey ?? Bun.env['LUNA_OPENAI_API_KEY'] ?? Bun.env['ANTHROPIC_API_KEY'] ?? '';
    const envModel = Bun.env['LUNA_MODEL'];
    this.model = opts?.model ?? (envModel && envModel.trim() !== '' ? envModel : DEFAULT_OPENAI_MODEL);
    const entry = opts?.entry;
    this.tokenParam = entry?.tokenParam ?? 'max_tokens';
    this.systemRole = entry?.systemRole ?? 'system';
    this.toolChoice = entry?.toolChoice ?? 'required'; // everything-as-tool (LD #9): force a tool call
    this.capabilities = {
      thinking: entry?.reasoning ?? Bun.env['LUNA_OPENAI_REASONING'] === '1',
      promptCache: false,
      interleavedToolStreaming: Bun.env['LUNA_OPENAI_STREAM'] === '1',
      toolUse: entry?.toolUse ?? true,
      systemRole: this.systemRole === 'system',
      maxOutputTokens: MAX_TOKENS,
    };
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const body = {
      model: this.model,
      [this.tokenParam]: req.maxTokens ?? 2048,
      messages: [systemToOpenAI(req.system, this.systemRole), ...messagesToOpenAI(req.messages)],
      // a reasoning model would otherwise spend the token budget on hidden reasoning and return
      // empty for these utility (dream/summarize) calls — keep it minimal (mirrors Anthropic
      // complete() omitting thinking).
      ...(this.capabilities.thinking ? { reasoning_effort: 'low' } : {}),
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
    // omit tools for a no-tool model (degrades to text — it can't call the message tool)
    const useTools = this.capabilities.toolUse && req.tools.length > 0;
    const tools = useTools ? toolsToOpenAI(req.tools) : undefined;
    return {
      model: this.model,
      [this.tokenParam]: MAX_TOKENS,
      messages: [systemToOpenAI(req.system, this.systemRole), ...messagesToOpenAI(req.messages)],
      // force a tool call so a GPT model can't answer in free `content` and bypass the message tool
      // (LD #9: speaking IS the message tool). Registry can opt a model to 'auto'.
      ...(tools ? { tools, tool_choice: this.toolChoice } : {}),
      ...(stream ? { stream: true, stream_options: { include_usage: true } } : { stream: false }),
    };
  }

  // Non-streaming (default): one call → an optional text_delta then one message_stop.
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
    // Same tool-stop guard the SSE path has: if tool_calls are present but finish_reason was
    // 'stop'/'length', force a tool_use stop so runTurn dispatches them (else orphaned tool_use
    // blocks poison history → next request 400s). This is the DEFAULT path.
    const hasTools = (msg.tool_calls?.length ?? 0) > 0;
    const mapped = mapStopReason(choice.finish_reason);
    yield {
      kind: 'message_stop',
      stopReason: hasTools && mapped !== 'tool_use' ? 'tool_use' : mapped,
      toolUses: toProviderToolUses(msg),
      assistantContent: toAssistantContent(msg),
      usage: mapUsage(parsed.usage),
    };
  }

  // SSE (LUNA_OPENAI_STREAM=1): emit text_delta / thinking_delta / tool_use_start / tool_input_delta
  // as they arrive (interleaved), accumulating tool calls per `index`, then one message_stop from
  // the same parts the non-streaming path uses.
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
      const chunk = parseStreamChunkSafe(raw);
      if (!chunk) continue; // a slightly-off chunk must not crash a turn mid-stream
      const errMsg = streamErrorMessage(chunk);
      if (errMsg) throw new Error(`openai stream error: ${errMsg}`); // 200 + in-band error frame
      if (chunk.usage) usage = mapUsage(chunk.usage);
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        if (text.length > SSE_LINE_CAP) throw new Error('openai stream: output exceeded cap');
        yield { kind: 'text_delta', text: delta.content };
      }
      const reasoning = delta?.reasoning ?? delta?.reasoning_content;
      if (reasoning) yield { kind: 'thinking_delta', text: reasoning };
      for (const tc of delta?.tool_calls ?? []) {
        let t = acc.get(tc.index);
        if (!t) {
          // synthesize a stable id keyed by index — a gateway that echoes ids only on the final
          // message would otherwise leave id='' → empty/colliding tool_call_id → next request 400s
          t = { id: `call_${tc.index}`, name: '', arguments: '', started: false };
          acc.set(tc.index, t);
        }
        if (tc.id) t.id = tc.id;
        if (tc.function?.name) t.name = tc.function.name;
        if (!t.started && t.name) {
          t.started = true;
          yield { kind: 'tool_use_start', id: t.id, name: t.name };
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
    // no terminal finish_reason but tools accumulated → force a tool stop (see chatStreamBuffered).
    const effectiveFinish = finishReason ?? (parts.length > 0 ? 'tool_calls' : null);
    const mapped = mapStopReason(effectiveFinish);
    yield {
      kind: 'message_stop',
      stopReason: parts.length > 0 && mapped !== 'tool_use' ? 'tool_use' : mapped,
      toolUses: streamedToolUses(parts),
      assistantContent: streamedAssistantContent(text, parts),
      usage,
    };
  }
}
