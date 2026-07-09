import { z } from 'zod';
import { L3Category, L3Confidence } from '@luna/protocol';
import { defineTool } from '../defineTool';
import { addFact, forgetFact } from '../../memory/l3Store';
import { updateEvolving } from '../../memory/soulStore';

// Flat object on purpose, NOT z.discriminatedUnion: a root-level anyOf wire
// schema (no top-level `properties`) makes some proxy gateways treat the tool as
// argument-less and wrap the model's args as {"_noargs": "<raw>"} — every call
// then fails validation. Per-action requirements are enforced in superRefine.
const Input = z
  .object({
    action: z.enum(['add', 'forget', 'update_self']),
    category: L3Category.optional().describe('required when action="add"'),
    text: z.string().min(1).optional().describe('the fact to store; required when action="add"'),
    confidence: L3Confidence.optional().describe('only meaningful when action="add"'),
    id: z.string().min(1).optional().describe('entry id to forget; required when action="forget"'),
    self_state: z.string().optional().describe('only meaningful when action="update_self"'),
    relationship_status: z
      .string()
      .optional()
      .describe('only meaningful when action="update_self"'),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'add') {
      if (!v.category) {
        ctx.addIssue({ code: 'custom', path: ['category'], message: 'required for action="add"' });
      }
      if (!v.text) {
        ctx.addIssue({ code: 'custom', path: ['text'], message: 'required for action="add"' });
      }
    }
    if (v.action === 'forget' && !v.id) {
      ctx.addIssue({ code: 'custom', path: ['id'], message: 'required for action="forget"' });
    }
    if (v.action === 'update_self' && v.self_state === undefined && v.relationship_status === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['self_state'],
        message: 'action="update_self" needs self_state and/or relationship_status',
      });
    }
  });

const Output = z.object({
  status: z.enum(['added', 'deduped', 'forgotten', 'not_found', 'self_updated']),
  id: z.string().optional(),
});

export const rememberTool = defineTool({
  name: 'remember',
  description:
    'Manage your long-term memory. action="add": store a durable fact about the user or your shared history (pick its category). action="forget": mark an outdated entry invalid by its id (it stays in history as "was once true"). action="update_self": revise your sense of self and/or the relationship (prose).',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'safe',
  timeoutMs: 2000,
  summarize: (out) => (out.id ? `${out.status}: ${out.id}` : out.status),
  execute: async function* (input) {
    switch (input.action) {
      case 'add': {
        // superRefine guarantees both; guards narrow the optional-field type
        if (!input.category || !input.text) return;
        const result = addFact(input.category, input.text, input.confidence);
        if (!result) {
          yield {
            kind: 'err',
            code: 'execution_exception',
            message: 'memory persistence not configured',
            recoverable: false,
          };
          return;
        }
        yield { kind: 'ok', data: { status: result.status, id: result.id } };
        return;
      }
      case 'forget': {
        if (!input.id) return;
        const result = forgetFact(input.id);
        if (!result) {
          yield {
            kind: 'err',
            code: 'execution_exception',
            message: 'memory persistence not configured',
            recoverable: false,
          };
          return;
        }
        yield { kind: 'ok', data: { status: result.status, id: result.id } };
        return;
      }
      case 'update_self': {
        // v0.30.3 (Initiative 22): self/relationship prose is the soul's evolving section now
        // (core_memory retired). self_state → self, relationship_status → bond.
        const patch: { self?: string; bond?: string } = {};
        if (input.self_state !== undefined) patch.self = input.self_state;
        if (input.relationship_status !== undefined) patch.bond = input.relationship_status;
        const result = updateEvolving(patch, 'tool');
        if (!result) {
          yield {
            kind: 'err',
            code: 'execution_exception',
            message: 'memory persistence not configured',
            recoverable: false,
          };
          return;
        }
        yield { kind: 'ok', data: { status: 'self_updated' as const } };
        return;
      }
    }
  },
});
