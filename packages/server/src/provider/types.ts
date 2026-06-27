import type Anthropic from '@anthropic-ai/sdk';
import type { ProviderCapabilities } from './capabilities';

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
  // raw partial-JSON chunk of an open tool_use block's input (SDK
  // input_json_delta), keyed to the block announced by tool_use_start
  | { kind: 'tool_input_delta'; id: string; name: string; partial_json: string }
  | {
      kind: 'message_stop';
      stopReason: string;
      toolUses: ProviderToolUse[];
      // The assistant turn to replay into session.history — a PARAM type (input for the next
      // turn), so a non-Anthropic provider can synthesize it without response-only fields
      // (ToolUseBlock.caller etc.). Anthropic's response ContentBlock[] assigns to this directly.
      assistantContent: Anthropic.ContentBlockParam[];
      usage: ProviderUsage;
    };

export type ProviderRequest = {
  system: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  // Reactive (chat) turns pass a signal so a client disconnect aborts the upstream
  // stream instead of running to completion. Proactive/continuation turns are
  // socket-less and leave this unset (they run to completion by design, LD #15).
  signal?: AbortSignal;
};

export type CompleteRequest = {
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
};

export type CompleteResult = {
  text: string;
  usage: ProviderUsage;
};

export interface Provider {
  readonly capabilities: ProviderCapabilities;
  chatStream(req: ProviderRequest): AsyncIterable<ProviderEvent>;
  complete(req: CompleteRequest): Promise<CompleteResult>;
}
