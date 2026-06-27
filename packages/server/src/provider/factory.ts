import type { Provider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai/openaiProvider';

// The single construction point for a chat provider (Initiative 16). Selects by LUNA_PROVIDER
// (default `anthropic` — zero behavior change); `openai` (v0.23.1) routes to the OpenAI
// Chat-Completions provider; an unknown value fails fast rather than silently defaulting.
// `opts.apiKey` is threaded per-instance (the dream summarizer-key cascade in main.ts).
export function providerFor(opts?: { apiKey?: string }): Provider {
  const kind = Bun.env['LUNA_PROVIDER'] ?? 'anthropic';
  if (kind === 'anthropic') return new AnthropicProvider(opts);
  if (kind === 'openai') return new OpenAIProvider(opts);
  throw new Error(`unknown LUNA_PROVIDER: ${kind} (expected 'anthropic' or 'openai')`);
}
