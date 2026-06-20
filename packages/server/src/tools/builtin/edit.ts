import { z } from 'zod';
import { defineTool } from '../defineTool';
import { contentHash, resolveInWorkspace } from '../workspace';
import { wasRead } from '../readTracking';
import {
  applyReplacement,
  atomicWrite,
  closestMatchHint,
  findEditMatch,
  restoreEol,
  toLf,
  unifiedDiff,
  usesCrlf,
} from '../editCore';
import { isLintable, lintContent, lintSummary, type LintDiagnostic } from '../lintOnWrite';

// edit (Initiative 8, v0.15.1) — the Anthropic text_editor / Claude Code `Edit`
// shape: replace old_string with new_string in a file. The riskiest capability
// (it mutates the user's files), so: jailed (resolveInWorkspace write →
// evaluator firewall + secrets), read-before-edit (no edits from stale memory),
// uniqueness-checked, optimistic-concurrency (expected_hash), fuzzy-fallback that
// REPORTS when it fuzzed, and every result carries a unified diff + new hash.
const Input = z.object({
  path: z.string().min(1).describe('file path (absolute, ~-relative, or relative to the workspace)'),
  old_string: z.string().min(1).describe('exact text to replace (copy it verbatim from read_file)'),
  new_string: z.string().describe('replacement text (may be empty to delete)'),
  replace_all: z
    .boolean()
    .optional()
    .describe('replace every occurrence; required when old_string matches more than once'),
  expected_hash: z
    .string()
    .optional()
    .describe('content_hash from a prior read_file; the edit is rejected (stale_file) if the file changed'),
});

const Diagnostic = z.object({
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  message: z.string(),
});

const Output = z.object({
  path: z.string(),
  replacements: z.number().int().nonnegative(),
  fuzzed: z.boolean(),
  diff: z.string(),
  previous_hash: z.string(),
  content_hash: z.string(),
  lint: z.array(Diagnostic),
});

export type EditOutput = z.infer<typeof Output>;

export const editTool = defineTool({
  name: 'edit',
  description:
    'Edit a text file by replacing old_string with new_string. You MUST read_file the path this ' +
    'session first (read-before-edit). old_string must be unique unless you set replace_all. Returns a ' +
    'unified diff, the new content_hash, and any lint diagnostics. Prefer this over write_file for ' +
    'existing files. Tolerates minor whitespace differences and reports when it did (fuzzed:true) — ' +
    'verify the diff in that case.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: 10000,
  summarize: (out) =>
    `edited ${out.path} (${out.replacements} replacement${out.replacements === 1 ? '' : 's'}${out.fuzzed ? ', fuzzy match' : ''})${lintSummary(out.lint)}`,
  execute: async function* (input, ctx) {
    const gate = resolveInWorkspace(input.path, 'write');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `edit: ${gate.reason}`, recoverable: false };
      return;
    }
    const resolved = gate.resolved;

    // read-before-edit: never edit from stale memory. Recoverable + actionable.
    if (!wasRead(ctx.sessionId, resolved)) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `edit: read the file first — call read_file on ${input.path} before editing it (read-before-edit).`,
        recoverable: true,
      };
      return;
    }

    let raw: string;
    try {
      raw = await Bun.file(resolved).text();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `edit: ${message}`, recoverable: true };
      return;
    }

    const previous_hash = contentHash(raw);
    if (input.expected_hash !== undefined && input.expected_hash !== previous_hash) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `edit: stale_file — ${input.path} changed since you read it (expected ${input.expected_hash.slice(0, 12)}…, found ${previous_hash.slice(0, 12)}…). Re-read and try again.`,
        recoverable: true,
      };
      return;
    }

    const crlf = usesCrlf(raw);
    const content = toLf(raw);
    const oldLf = toLf(input.old_string);
    const newLf = toLf(input.new_string);

    const match = findEditMatch(content, oldLf);
    if (!match.found) {
      const hint = closestMatchHint(content, oldLf);
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `edit: old_string not found in ${input.path}${hint ? ` — ${hint}` : ''}.`,
        recoverable: true,
      };
      return;
    }

    if (match.occurrences > 1 && !input.replace_all) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `edit: old_string found ${match.occurrences} times in ${input.path} — add surrounding context to make it unique, or set replace_all:true.`,
        recoverable: true,
      };
      return;
    }

    const updatedLf = applyReplacement(content, match.matched, newLf, input.replace_all ?? false);
    const toWrite = restoreEol(updatedLf, crlf);

    try {
      await atomicWrite(resolved, toWrite);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `edit: write failed — ${message}`, recoverable: false };
      return;
    }

    const replacements = input.replace_all ? match.count : 1;
    const newHash = contentHash(toWrite);
    const diff = unifiedDiff(input.path, content, updatedLf);
    const lint: LintDiagnostic[] = isLintable(resolved) ? lintContent(resolved, updatedLf) : [];

    yield {
      kind: 'ok',
      data: {
        path: input.path,
        replacements,
        fuzzed: match.fuzzed,
        diff,
        previous_hash,
        content_hash: newHash,
        lint,
      },
    };
  },
});
