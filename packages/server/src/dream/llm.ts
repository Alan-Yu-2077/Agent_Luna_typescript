import { z } from 'zod';
import type { CompleteResult, Provider } from '../provider/types';

export type DreamLLM = {
  primary: Provider;
  fallback: Provider | null;
};

export type DreamCallResult =
  | { ok: true; text: string }
  | {
      ok: false;
      failure: 'rate_limited' | 'content_filter' | 'auth' | 'empty_text' | 'exception';
      detail: string;
    };

function classify(e: unknown): 'rate_limited' | 'content_filter' | 'auth' | 'exception' {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (
    msg.includes('rate') ||
    msg.includes('429') ||
    msg.includes('overload') ||
    msg.includes('饱和')
  ) {
    return 'rate_limited';
  }
  if (msg.includes('content') && msg.includes('filter')) return 'content_filter';
  if (msg.includes('401') || msg.includes('auth') || msg.includes('api key')) return 'auth';
  return 'exception';
}

// Two-attempt cascade (Python v0.56.2): summarizer-key provider first so dream
// work never competes with the main reply key's quota; fall back to the default
// provider on empty text or exception.
export async function dreamCall(
  llm: DreamLLM,
  prompt: string,
  maxTokens = 2048,
  system = 'You are Luna in a dream state, doing quiet internal housekeeping.',
): Promise<DreamCallResult> {
  const attempts: Provider[] = llm.fallback ? [llm.primary, llm.fallback] : [llm.primary];
  let last: DreamCallResult = { ok: false, failure: 'empty_text', detail: 'no attempts made' };

  for (const provider of attempts) {
    try {
      const result: CompleteResult = await provider.complete({
        system,
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
      });
      if (result.text.trim().length > 0) return { ok: true, text: result.text };
      last = { ok: false, failure: 'empty_text', detail: 'provider returned empty text' };
    } catch (e) {
      last = {
        ok: false,
        failure: classify(e),
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return last;
}

export const MemoryPatch = z.object({
  remove_ids: z.array(z.string()),
  add: z.array(
    z.object({
      category: z.enum([
        'core_facts',
        'preferences',
        'key_moments',
        'active_threads',
        'project_context',
      ]),
      text: z.string().min(1),
    }),
  ),
});
export type MemoryPatch = z.infer<typeof MemoryPatch>;

export const PersonaPatch = z.object({
  self_state: z.string().nullable(),
  relationship_status: z.string().nullable(),
  reason: z.string().optional(),
});
export type PersonaPatch = z.infer<typeof PersonaPatch>;

// v0.17.0 (Initiative 10): per-turn salience scores, one 1–5 integer per rated
// exchange in order. Wrapped in an object so parseJsonBlock (object extractor)
// can read it.
export const SaliencePatch = z.object({
  scores: z.array(z.number().int().min(1).max(5)),
});
export type SaliencePatch = z.infer<typeof SaliencePatch>;

export function parseJsonBlock<T>(schema: z.ZodType<T>, text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
