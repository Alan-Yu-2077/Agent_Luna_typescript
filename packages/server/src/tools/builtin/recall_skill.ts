import { z } from 'zod';
import { defineTool } from '../defineTool';
import { listSkills, searchSkills } from '../../skills/skillStore';

// recall_skill (Initiative 8, v0.15.4) — list or search the skill library. Pure
// read of saved (verified) skills, so proactiveRisk:'safe'. Returns the body so
// the model can reuse the procedure as guidance; any side effect still goes
// through the normal flag/surface-gated tools. Behind LUNA_SKILLS.
const Input = z.object({
  query: z
    .string()
    .optional()
    .describe('search skills by description/name; omit to list the most recently verified'),
  limit: z.number().int().min(1).max(50).optional().describe('max results (default 10)'),
});

const SkillView = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string(),
  verified_ms: z.number().int(),
});

const Output = z.object({
  skills: z.array(SkillView),
  count: z.number().int().nonnegative(),
});

export type RecallSkillOutput = z.infer<typeof Output>;

export const recallSkillTool = defineTool({
  name: 'recall_skill',
  description:
    'Look up a saved skill from your library by description (or list recent ones). Use this before ' +
    'redoing a procedure you have done before — reuse the verified steps instead of re-deriving them.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 2000,
  summarize: (out) => `${out.count} skill${out.count === 1 ? '' : 's'}`,
  execute: async function* (input) {
    const limit = input.limit ?? 10;
    const skills = input.query ? searchSkills(input.query, limit) : listSkills(limit);
    yield {
      kind: 'ok',
      data: {
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
          body: s.body,
          verified_ms: s.verified_ms,
        })),
        count: skills.length,
      },
    };
  },
});
