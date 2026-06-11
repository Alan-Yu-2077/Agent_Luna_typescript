import type Anthropic from '@anthropic-ai/sdk';

export type ProviderToolUse = {
  id: string;
  name: string;
  input: unknown;
};

export type ProviderUsage = {
  input_tokens: number;
  output_tokens: number;
};

export type ProviderEvent =
  | { kind: 'text_delta'; text: string }
  | { kind: 'thinking_delta'; text: string }
  | { kind: 'tool_use_start'; id: string; name: string }
  | {
      kind: 'message_stop';
      stopReason: string;
      toolUses: ProviderToolUse[];
      assistantContent: Anthropic.ContentBlock[];
      usage: ProviderUsage;
    };

export type ProviderRequest = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
};

export interface Provider {
  chatStream(req: ProviderRequest): AsyncIterable<ProviderEvent>;
}
