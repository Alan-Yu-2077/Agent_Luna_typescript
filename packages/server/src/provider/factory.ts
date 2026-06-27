import type { Provider } from './types';
import { AnthropicProvider } from './anthropic';

// The single construction point for a chat provider (Initiative 16, v0.23.0). Selects by
// LUNA_PROVIDER (default `anthropic` — zero behavior change). The `openai` branch throws until
// v0.23.1 lands the OpenAIProvider; an unknown value fails fast rather than silently defaulting.
// `opts.apiKey` is threaded per-instance (the dream summarizer-key cascade in main.ts).
export function providerFor(opts?: { apiKey?: string }): Provider {
  const kind = Bun.env['LUNA_PROVIDER'] ?? 'anthropic';
  if (kind === 'anthropic') return new AnthropicProvider(opts);
  if (kind === 'openai') {
    throw new Error('LUNA_PROVIDER=openai is not implemented until v0.23.1');
  }
  throw new Error(`unknown LUNA_PROVIDER: ${kind} (expected 'anthropic' or 'openai')`);
}
