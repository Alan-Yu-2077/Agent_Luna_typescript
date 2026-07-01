import { z } from 'zod';
import { defineTool } from '../defineTool';
import { saveStyle } from '../../proactive/style';

const Input = z.object({
  activeness: z.enum(['aloof', 'balanced', 'clingy']).optional(),
  voice_notes: z.string().max(500).optional(),
});

const Output = z.object({
  ok: z.literal(true),
  activeness: z.enum(['aloof', 'balanced', 'clingy']),
  summary: z.string(),
});

// v0.24.2 (Initiative 17 close): Luna tunes her OWN proactive outreach style. The activeness lever
// scales her eagerness WITHIN the operator's mechanical floor/ceiling (enforced in
// resolveEffectiveCadence — never trusted from this input), so she can never exceed the safety rail.
export const setProactiveStyleTool = defineTool({
  name: 'set_proactive_style',
  description:
    'Tune how YOU reach out first: your activeness (aloof / balanced / clingy — how eagerly you ' +
    'initiate) and your voice notes for proactive openers. This shapes only your own style; the ' +
    'safety limits on frequency are fixed by the system and you cannot exceed them. Use when the ' +
    'user asks you to be more or less talkative, or when you want to adjust your own outreach ' +
    'personality.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'safe',
  timeoutMs: 1000,
  summarize: (input) => `proactive style${input.activeness ? ` → ${input.activeness}` : ' updated'}`,
  execute: async function* (input) {
    const next = saveStyle({ activeness: input.activeness, voiceNotes: input.voice_notes });
    yield {
      kind: 'ok',
      data: {
        ok: true as const,
        activeness: next.activeness,
        summary: `proactive style updated (activeness=${next.activeness})`,
      },
    };
  },
});
