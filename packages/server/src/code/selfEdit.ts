// Self-edit proposal builder (Initiative 8, v0.15.4) — PROPOSE-ONLY. It computes
// a unified diff for a requested edit to Luna's own code entirely in memory and
// returns it for a human to review and apply. It NEVER writes the target file (or
// anything else). Two guardrails make this the DGM-safe ceiling:
//   1. The target is gated through resolveInWorkspace(path, 'write') — the SAME
//      firewall every edit/shell write goes through — so the evaluator firewall
//      (tests, lint/ts config, the shell deny-regex, the sandbox itself,
//      humanity.ts, l1Contract.ts, safetyGate.ts) and secrets are hard-rejected.
//      She may propose an edit to her own NON-critical code; never to the code
//      that judges/sandboxes/gates her.
//   2. There is no write path at all — applying a proposal is a separate human
//      action (review the diff, run the normal `edit`, or git apply).

import { readFileSync } from 'node:fs';
import { contentHash, resolveInWorkspace } from '../tools/workspace';
import { applyReplacement, findEditMatch, toLf, unifiedDiff } from '../tools/editCore';

export type ProposalOk = {
  ok: true;
  proposalId: string;
  diff: string;
  fuzzed: boolean;
  resolved: string;
};
export type ProposalErr = { ok: false; reason: string };
export type Proposal = ProposalOk | ProposalErr;

export function buildSelfEditProposal(opts: {
  targetPath: string;
  oldString: string;
  newString: string;
}): Proposal {
  // FIREWALL — the load-bearing check. A 'write'-access resolve rejects the
  // evaluator firewall + secrets exactly as it does for the edit/shell tools.
  const gate = resolveInWorkspace(opts.targetPath, 'write');
  if (!gate.ok) return { ok: false, reason: gate.reason };

  let raw: string;
  try {
    raw = readFileSync(gate.resolved, 'utf8');
  } catch {
    return {
      ok: false,
      reason: `cannot read ${opts.targetPath} — a proposal is computed against the current file`,
    };
  }

  const content = toLf(raw);
  const match = findEditMatch(content, toLf(opts.oldString));
  if (!match.found) {
    return { ok: false, reason: `old_string not found in ${opts.targetPath}` };
  }
  if (match.count > 1) {
    return {
      ok: false,
      reason: `old_string not unique in ${opts.targetPath} (${match.count} matches) — add surrounding context`,
    };
  }

  const updated = applyReplacement(content, match.matched, toLf(opts.newString), false);
  const diff = unifiedDiff(opts.targetPath, content, updated);
  // Deterministic id from the proposal's content (no clock needed).
  const proposalId = contentHash(`${gate.resolved}\n${opts.oldString}\n${opts.newString}`).slice(0, 12);
  return { ok: true, proposalId, diff, fuzzed: match.fuzzed, resolved: gate.resolved };
}
