import type { Provider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai/openaiProvider';
import { resolveModel, type ModelEntry } from './registry';

// The single construction point for a chat provider (Initiative 16). v0.23.3: resolves LUNA_MODEL
// via the registry to pick the protocol + per-model quirks; LUNA_PROVIDER (if set) overrides the
// protocol (and must be 'anthropic' | 'openai' — an unknown value fails fast). `opts.apiKey` is
// threaded per-instance (the dream summarizer-key cascade in main.ts).
export function providerFor(opts?: { apiKey?: string }): Provider {
  const override = Bun.env['LUNA_PROVIDER'];
  if (override && override !== 'anthropic' && override !== 'openai') {
    throw new Error(`unknown LUNA_PROVIDER: ${override} (expected 'anthropic' or 'openai')`);
  }
  const entry = resolveModel(Bun.env['LUNA_MODEL'] ?? 'claude-opus-4-8');
  const protocol = override ?? entry.protocol;
  if (protocol === 'anthropic') return new AnthropicProvider(opts);
  // forced openai on a non-openai (or unknown) model → a default openai entry for that id
  const oentry: ModelEntry = entry.protocol === 'openai' ? entry : { id: entry.id, protocol: 'openai' };
  return new OpenAIProvider({ ...opts, entry: oentry });
}
