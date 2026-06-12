import { z } from 'zod';
import { L3Category, L3Confidence } from '@luna/protocol';
import { defineTool } from '../defineTool';
import { addFact, forgetFact } from '../../memory/l3Store';
import { updateCore } from '../../memory/coreMemory';

const Input = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    category: L3Category,
    text: z.string().min(1),
    confidence: L3Confidence.optional(),
  }),
  z.object({
    action: z.literal('forget'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('update_self'),
    self_state: z.string().optional(),
    relationship_status: z.string().optional(),
  }),
]);

const Output = z.object({
  status: z.enum(['added', 'deduped', 'forgotten', 'not_found', 'self_updated']),
  id: z.string().optional(),
});

export const rememberTool = defineTool({
  name: 'remember',
  description:
    'Manage your long-term memory. action="add": store a durable fact about the user or your shared history (category: core_facts | preferences | key_moments | active_threads | project_context). action="forget": mark an outdated entry invalid by its id (it stays in history as "was once true"). action="update_self": revise your sense of self and/or the relationship (prose).',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  timeoutMs: 2000,
  summarize: (out) => (out.id ? `${out.status}: ${out.id}` : out.status),
  execute: async function* (input) {
    switch (input.action) {
      case 'add': {
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
        const patch: { self_state?: string; relationship_status?: string } = {};
        if (input.self_state !== undefined) patch.self_state = input.self_state;
        if (input.relationship_status !== undefined) {
          patch.relationship_status = input.relationship_status;
        }
        const result = updateCore(patch, 'tool');
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
