import Anthropic from '@anthropic-ai/sdk';
import type { Provider, ProviderEvent, ProviderRequest } from './types';

const MODEL = Bun.env['LUNA_MODEL'] ?? 'claude-opus-4-8';
const MAX_TOKENS = Number(Bun.env['LUNA_MAX_TOKENS'] ?? 8192);

export class AnthropicProvider implements Provider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: Bun.env['ANTHROPIC_API_KEY'],
      baseURL: Bun.env['ANTHROPIC_BASE_URL'],
      maxRetries: 2,
    });
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
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));

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
