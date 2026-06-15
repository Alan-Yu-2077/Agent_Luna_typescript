import { z } from 'zod';
import { defineTool } from '../defineTool';
import { buildSelfEditProposal } from '../../code/selfEdit';

// propose_self_edit (Initiative 8, v0.15.4) — the bounded "self-evolution" surface.
// PROPOSE-ONLY: it returns a unified diff + rationale for a human to review and
// apply; it never writes. The evaluator firewall (resolveInWorkspace 'write')
// hard-rejects any edit to the code that judges/sandboxes/gates her, so this can
// never disable its own guardrails. proactiveRisk:'surface' (a self-modification
// proposal should announce itself); behind LUNA_SELF_EDIT.
const Input = z.object({
  target_path: z.string().min(1).describe('the file you propose to change (your own non-critical code)'),
  rationale: z.string().min(1).max(2000).describe('why this change is worth making — for the human reviewer'),
  old_string: z.string().min(1).describe('exact text to replace (must be unique in the file)'),
  new_string: z.string().describe('the replacement text'),
});

const Output = z.object({
  proposal_id: z.string(),
  target_path: z.string(),
  rationale: z.string(),
  diff: z.string(),
  fuzzed: z.boolean(),
  applied: z.literal(false),
});

export type ProposeSelfEditOutput = z.infer<typeof Output>;

export const proposeSelfEditTool = defineTool({
  name: 'propose_self_edit',
  description:
    'Propose a change to your OWN code for a human to review — it produces a unified diff and does NOT ' +
    'apply it. A human reviews the diff and applies it (or not). You can never propose a change to the ' +
    'code that judges, sandboxes, or gates you (tests, the sandbox, the safety gate, the humanity caps, ' +
    'the deny-regex) — that is refused. Use this for genuine improvements to your non-critical code.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'surface',
  timeoutMs: 10000,
  summarize: (out) => `proposed edit to ${out.target_path} (id ${out.proposal_id}, awaiting human review)`,
  execute: async function* (input) {
    const proposal = buildSelfEditProposal({
      targetPath: input.target_path,
      oldString: input.old_string,
      newString: input.new_string,
    });
    if (!proposal.ok) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `propose_self_edit: ${proposal.reason}`,
        recoverable: true,
      };
      return;
    }
    yield {
      kind: 'ok',
      data: {
        proposal_id: proposal.proposalId,
        target_path: input.target_path,
        rationale: input.rationale,
        diff: proposal.diff,
        fuzzed: proposal.fuzzed,
        applied: false as const,
      },
    };
  },
});
