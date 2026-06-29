import { z } from 'zod';

// v0.23.3 (Initiative 16 close): a model→provider registry so picking a model is one decision, not
// a scatter of env flags. providerFor() resolves LUNA_MODEL to an entry (protocol + per-model
// quirks). LUNA_PROVIDER, if set, overrides the protocol; LUNA_MODELS_JSON prepends user entries so
// a new model is addable without a code change. Quirks are entry-driven — NO model-id regex at the
// call sites (the registry is the one place model ids are matched).

export type ModelProtocol = 'anthropic' | 'openai';

// The OpenAI wire model when LUNA_PROVIDER=openai but LUNA_MODEL is unset — used by BOTH the factory
// and the provider so the logged model and the wired model can never disagree (v0.23.4 D2).
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export type ModelEntry = {
  id: string; // matched by prefix (startsWith) against LUNA_MODEL; first match wins
  protocol: ModelProtocol;
  tokenParam?: 'max_tokens' | 'max_completion_tokens';
  systemRole?: 'system' | 'developer';
  reasoning?: boolean;
  toolUse?: boolean;
  // OpenAI tool_choice: 'required' (default — everything-as-tool, LD #9: the model MUST call a tool,
  // so a GPT model can't answer in free `content` and bypass the message tool) vs 'auto'.
  toolChoice?: 'required' | 'auto';
};

const ModelEntrySchema = z.object({
  id: z.string().min(1), // an empty/blank id would prefix-match EVERY model (silent catch-all)
  protocol: z.enum(['anthropic', 'openai']),
  tokenParam: z.enum(['max_tokens', 'max_completion_tokens']).optional(),
  systemRole: z.enum(['system', 'developer']).optional(),
  reasoning: z.boolean().optional(),
  toolUse: z.boolean().optional(),
  toolChoice: z.enum(['required', 'auto']).optional(),
});

// Built-in coverage: the Claude family (anthropic), and the common OpenAI-protocol families. The
// o-series reasoning models reject a `system` role and require `max_completion_tokens`.
const BUILTINS: ModelEntry[] = [
  { id: 'claude', protocol: 'anthropic' },
  { id: 'o1', protocol: 'openai', tokenParam: 'max_completion_tokens', systemRole: 'developer', reasoning: true },
  { id: 'o3', protocol: 'openai', tokenParam: 'max_completion_tokens', systemRole: 'developer', reasoning: true },
  { id: 'o4', protocol: 'openai', tokenParam: 'max_completion_tokens', systemRole: 'developer', reasoning: true },
  { id: 'gpt-5', protocol: 'openai', tokenParam: 'max_completion_tokens' },
  { id: 'gpt-', protocol: 'openai' },
];

function overrides(): ModelEntry[] {
  const raw = Bun.env['LUNA_MODELS_JSON'];
  if (!raw || raw.trim() === '') return [];
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn('[provider] LUNA_MODELS_JSON is not valid JSON — ignored');
    return [];
  }
  const parsed = z.array(ModelEntrySchema).safeParse(json);
  if (!parsed.success) {
    console.warn('[provider] LUNA_MODELS_JSON does not match the model-entry shape — ignored');
    return [];
  }
  return parsed.data;
}

// Resolve a model id to its entry by FIRST prefix match (overrides first, then built-ins — order
// matters; more specific prefixes like `gpt-5` must precede `gpt-`). Unknown → a safe anthropic
// default (the rewrite's native protocol; the default model is claude).
export function resolveModel(modelId: string): ModelEntry {
  const table = [...overrides(), ...BUILTINS];
  return table.find((e) => modelId.startsWith(e.id)) ?? { id: modelId, protocol: 'anthropic' };
}
