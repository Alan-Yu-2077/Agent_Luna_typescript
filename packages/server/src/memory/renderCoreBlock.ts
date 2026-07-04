import type { L3Category } from '@luna/protocol';
import { listFacts } from './l3Store';

// Render caps per category (Python's storage caps, applied at render time —
// storage stays unbounded; dream's refine_semantic prunes).
const RENDER_CAPS: Record<L3Category, number> = {
  core_facts: 15,
  preferences: 10,
  key_moments: 12,
  active_threads: 6,
  project_context: 8,
};

const CATEGORY_LABELS: Record<L3Category, string> = {
  core_facts: 'Facts about the user',
  preferences: 'Their preferences',
  key_moments: 'Key moments together',
  active_threads: 'Active threads',
  project_context: 'Project context',
};

const CATEGORY_ORDER: L3Category[] = [
  'core_facts',
  'preferences',
  'key_moments',
  'active_threads',
  'project_context',
];

// The STABLE memory prefix for the system prompt. Determinism is load-bearing:
// this string must be byte-identical across turns unless memory actually
// changed (the Anthropic prefix cache invalidates on any byte difference).
// Never interpolate timestamps or per-turn values here.
// v0.30.3 (Initiative 22): L3-only. The self_state / relationship prose moved to the soul
// (renderSoulBlock); core_memory is retired. The function name is kept to avoid churning call
// sites — it now renders solely the durable-fact list.
export function renderCoreBlock(): string {
  const lines: string[] = [];

  const factLines: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const facts = listFacts({ category });
    if (facts.length === 0) continue;
    const capped = facts.slice(-RENDER_CAPS[category]);
    factLines.push(`### ${CATEGORY_LABELS[category]}`);
    for (const f of capped) {
      factLines.push(`- ${f.text} [${f.id}]`);
    }
  }
  if (factLines.length > 0) {
    lines.push('## Long-term memory', ...factLines, '');
    lines.push(
      'To remember something new, forget an outdated entry (by its [id]), or update your sense of self/relationship, use the remember tool.',
    );
  }

  return lines.join('\n').trim();
}
