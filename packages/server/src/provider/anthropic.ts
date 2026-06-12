import Anthropic from '@anthropic-ai/sdk';
import type {
  CompleteRequest,
  CompleteResult,
  Provider,
  ProviderEvent,
  ProviderRequest,
} from './types';

const MODEL = Bun.env['LUNA_MODEL'] ?? 'claude-opus-4-8';
const MAX_TOKENS = Number(Bun.env['LUNA_MAX_TOKENS'] ?? 8192);

// The yunwu gateway wraps tool arguments it failed to map upstream as
// {"_noargs": "<raw args text>"} (observed 2026-06-12 on `remember` while its
// wire schema was a root-level anyOf). Recover the real object when the raw
// text is JSON; otherwise pass through and let tool validation reject it with
// a recoverable error the model can act on.
export function unwrapGatewayInput(input: unknown): unknown {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    const rec = input as Record<string, unknown>;
    const keys = Object.keys(rec);
    const raw = rec['_noargs'];
    if (keys.length === 1 && keys[0] === '_noargs' && typeof raw === 'string') {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // not JSON — fall through unchanged
      }
    }
  }
  return input;
}

export class AnthropicProvider implements Provider {
  private client: Anthropic;

  constructor(opts?: { apiKey?: string }) {
    this.client = new Anthropic({
      apiKey: opts?.apiKey ?? Bun.env['ANTHROPIC_API_KEY'],
      baseURL: Bun.env['ANTHROPIC_BASE_URL'],
      maxRetries: 2,
    });
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: req.maxTokens ?? 2048,
      system: req.system,
      messages: req.messages,
      thinking: { type: 'adaptive' },
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }

  async *chatStream(req: ProviderRequest): AsyncIterable<ProviderEvent> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: req.system,
      messages: req.messages,
      tools: req.tools.length > 0 ? req.tools : undefined,
      thinking: { type: 'adaptive', display: 'summarized' },
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          yield {
            kind: 'tool_use_start',
            id: event.content_block.id,
            name: event.content_block.name,
          };
        }
        continue;
      }
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { kind: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'thinking_delta') {
          yield { kind: 'thinking_delta', text: event.delta.thinking };
        }
        continue;
      }
    }

    const final = await stream.finalMessage();

    const toolUses = final.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: unwrapGatewayInput(b.input) }));

    yield {
      kind: 'message_stop',
      stopReason: final.stop_reason ?? 'end_turn',
      toolUses,
      assistantContent: final.content,
      usage: {
        input_tokens: final.usage.input_tokens,
        output_tokens: final.usage.output_tokens,
      },
    };
  }
}
