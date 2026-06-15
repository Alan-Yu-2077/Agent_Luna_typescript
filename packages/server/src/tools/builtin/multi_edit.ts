import { z } from 'zod';
import { defineTool } from '../defineTool';
import { contentHash, resolveInWorkspace } from '../workspace';
import { wasRead } from '../readTracking';
import {
  applyReplacement,
  closestMatchHint,
  findEditMatch,
  restoreEol,
  toLf,
  unifiedDiff,
  usesCrlf,
} from '../editCore';
import { isLintable, lintContent, lintSummary, type LintDiagnostic } from '../lintOnWrite';

// multi_edit (Initiative 8, v0.15.1) — Claude Code `MultiEdit` / Python
// patch_file: apply a SEQUENCE of edits to one file ATOMICALLY. Each hunk is
// applied to the running in-memory text in order; on the FIRST hunk that fails
// (not found / ambiguous), NOTHING is written and the failing index is reported.
// This is the half-edited-file guard — a broken hunk can't leave the file in a
// partial state. Same jail + read-before-edit + optimistic concurrency as `edit`.
const Hunk = z.object({
  old_string: z.string().min(1).describe('exact text to replace (verbatim from read_file)'),
  new_string: z.string().describe('replacement text (may be empty to delete)'),
  replace_all: z.boolean().optional().describe('replace every occurrence of this hunk'),
});

const Input = z.object({
  path: z.string().min(1).describe('file path (absolute, ~-relative, or relative to the workspace)'),
  edits: z.array(Hunk).min(1).describe('edits applied in order, atomically (all-or-nothing)'),
  expected_hash: z
    .string()
    .optional()
    .describe('content_hash from a prior read_file; rejected (stale_file) if the file changed'),
});

const Diagnostic = z.object({
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  message: z.string(),
});

const Output = z.object({
  path: z.string(),
  edits_applied: z.number().int().nonnegative(),
  replacements: z.number().int().nonnegative(),
  fuzzed: z.boolean(),
  diff: z.string(),
  previous_hash: z.string(),
  content_hash: z.string(),
  lint: z.array(Diagnostic),
});

export type MultiEditOutput = z.infer<typeof Output>;

export const multiEditTool = defineTool({
  name: 'multi_edit',
  description:
    'Apply several edits to one file atomically (all-or-nothing). You MUST read_file the path this ' +
    'session first. Edits apply in order; if any hunk is not found or ambiguous, nothing is written ' +
    'and the failing index is reported. Returns a unified diff, the new content_hash, and lint ' +
    'diagnostics. Use this instead of multiple edit calls when changing one file in several places.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: 15000,
  summarize: (out) =>
    `${out.edits_applied} edit${out.edits_applied === 1 ? '' : 's'} on ${out.path} (${out.replacements} replacement${out.replacements === 1 ? '' : 's'}${out.fuzzed ? ', fuzzy' : ''})${lintSummary(out.lint)}`,
  execute: async function* (input, ctx) {
    const gate = resolveInWorkspace(input.path, 'write');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `multi_edit: ${gate.reason}`, recoverable: false };
      return;
    }
    const resolved = gate.resolved;

    if (!wasRead(ctx.sessionId, resolved)) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `multi_edit: read the file first — call read_file on ${input.path} before editing it (read-before-edit).`,
        recoverable: true,
      };
      return;
    }

    let raw: string;
    try {
      raw = await Bun.file(resolved).text();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `multi_edit: ${message}`, recoverable: true };
      return;
    }

    const previous_hash = contentHash(raw);
    if (input.expected_hash !== undefined && input.expected_hash !== previous_hash) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `multi_edit: stale_file — ${input.path} changed since you read it (expected ${input.expected_hash.slice(0, 12)}…, found ${previous_hash.slice(0, 12)}…). Re-read and try again.`,
        recoverable: true,
      };
      return;
    }

    const crlf = usesCrlf(raw);
    const original = toLf(raw);

    // Apply all hunks to the in-memory text. A failure aborts WITHOUT writing.
    let working = original;
    let anyFuzzed = false;
    let totalReplacements = 0;
    for (let i = 0; i < input.edits.length; i++) {
      const hunk = input.edits[i]!;
      const oldLf = toLf(hunk.old_string);
      const newLf = toLf(hunk.new_string);

      const match = findEditMatch(working, oldLf);
      if (!match.found) {
        const hint = closestMatchHint(working, oldLf);
        yield {
          kind: 'err',
          code: 'execution_exception',
          message: `multi_edit: edit[${i}] old_string not found in ${input.path}${hint ? ` — ${hint}` : ''}. No changes written (atomic).`,
          recoverable: true,
        };
        return;
      }
      if (match.count > 1 && !hunk.replace_all) {
        yield {
          kind: 'err',
          code: 'execution_exception',
          message: `multi_edit: edit[${i}] old_string found ${match.count} times — add context or set replace_all:true. No changes written (atomic).`,
          recoverable: true,
        };
        return;
      }
      if (match.fuzzed) anyFuzzed = true;
      totalReplacements += hunk.replace_all ? match.count : 1;
      working = applyReplacement(working, match.matched, newLf, hunk.replace_all ?? false);
    }

    if (working === original) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `multi_edit: edits produced no change to ${input.path}.`,
        recoverable: true,
      };
      return;
    }

    const toWrite = restoreEol(working, crlf);
    try {
      await Bun.write(resolved, toWrite);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `multi_edit: write failed — ${message}`, recoverable: false };
      return;
    }

    const newHash = contentHash(toWrite);
    const diff = unifiedDiff(input.path, original, working);
    const lint: LintDiagnostic[] = isLintable(resolved) ? lintContent(resolved, working) : [];

    yield {
      kind: 'ok',
      data: {
        path: input.path,
        edits_applied: input.edits.length,
        replacements: totalReplacements,
        fuzzed: anyFuzzed,
        diff,
        previous_hash,
        content_hash: newHash,
        lint,
      },
    };
  },
});
