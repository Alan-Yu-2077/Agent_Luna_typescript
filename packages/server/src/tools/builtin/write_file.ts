import { z } from 'zod';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { defineTool } from '../defineTool';
import { contentHash, resolveInWorkspace } from '../workspace';
import { markRead } from '../readTracking';
import { unifiedDiff } from '../editCore';
import { isLintable, lintContent, lintSummary, type LintDiagnostic } from '../lintOnWrite';

// write_file (Initiative 8, v0.15.1) — full-file create/overwrite (Python
// write_file port). The description DISCOURAGES it for existing files (prefer
// edit, which is surgical + diff-auditable); it REFUSES to clobber an existing
// file unless overwrite:true. Same jail as the edit tools. A successful write
// marks the path read (so a follow-up edit on the just-written file is allowed).
const Input = z.object({
  path: z.string().min(1).describe('file path (absolute, ~-relative, or relative to the workspace)'),
  content: z.string().describe('entire file contents to write'),
  create_dirs: z.boolean().optional().describe('create missing parent directories (default true)'),
  overwrite: z.boolean().optional().describe('allow replacing an existing file (default false)'),
  expected_hash: z
    .string()
    .optional()
    .describe('content_hash from a prior read_file; rejected (stale_file) if the existing file differs'),
});

const Diagnostic = z.object({
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  message: z.string(),
});

const Output = z.object({
  path: z.string(),
  created: z.boolean(),
  bytes_written: z.number().int().nonnegative(),
  line_count: z.number().int().nonnegative(),
  diff: z.string(),
  previous_hash: z.string().nullable(),
  content_hash: z.string(),
  lint: z.array(Diagnostic),
});

export type WriteFileOutput = z.infer<typeof Output>;

export const writeFileTool = defineTool({
  name: 'write_file',
  description:
    'Create a new text file or overwrite an existing one with full content. Prefer edit for changing ' +
    'an EXISTING file (it is surgical and diff-auditable); use write_file mainly for new files. ' +
    'Refuses to clobber an existing file unless overwrite:true. Creates parent directories by default. ' +
    'Returns a unified diff, the new content_hash, and lint diagnostics.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: 10000,
  summarize: (out) =>
    `${out.created ? 'created' : 'overwrote'} ${out.path} (${out.line_count} line${out.line_count === 1 ? '' : 's'})${lintSummary(out.lint)}`,
  execute: async function* (input, ctx) {
    const gate = resolveInWorkspace(input.path, 'write');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `write_file: ${gate.reason}`, recoverable: false };
      return;
    }
    const resolved = gate.resolved;

    const exists = existsSync(resolved);

    // Don't silently clobber. A directory at the path is always a hard error.
    if (exists) {
      let isDir = false;
      try {
        isDir = (await Bun.file(resolved).stat()).isDirectory();
      } catch {
        isDir = false;
      }
      if (isDir) {
        yield { kind: 'err', code: 'execution_exception', message: `write_file: ${input.path} is a directory.`, recoverable: false };
        return;
      }
      if (input.overwrite !== true) {
        yield {
          kind: 'err',
          code: 'execution_exception',
          message: `write_file: ${input.path} already exists — set overwrite:true to replace it (or use edit to change part of it).`,
          recoverable: true,
        };
        return;
      }
    }

    // Optimistic concurrency against the existing file.
    let before: string | null = null;
    let previous_hash: string | null = null;
    if (exists) {
      try {
        before = await Bun.file(resolved).text();
        previous_hash = contentHash(before);
      } catch {
        before = null;
        previous_hash = null;
      }
      if (input.expected_hash !== undefined && input.expected_hash !== previous_hash) {
        yield {
          kind: 'err',
          code: 'execution_exception',
          message: `write_file: stale_file — ${input.path} changed since you read it. Re-read and try again.`,
          recoverable: true,
        };
        return;
      }
    }

    const createDirs = input.create_dirs ?? true;
    const parent = dirname(resolved);
    if (!existsSync(parent)) {
      if (createDirs) {
        try {
          await mkdir(parent, { recursive: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          yield { kind: 'err', code: 'execution_exception', message: `write_file: mkdir failed — ${message}`, recoverable: false };
          return;
        }
      } else {
        yield {
          kind: 'err',
          code: 'execution_exception',
          message: `write_file: parent directory does not exist (set create_dirs:true): ${parent}`,
          recoverable: true,
        };
        return;
      }
    }

    try {
      await Bun.write(resolved, input.content);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `write_file: write failed — ${message}`, recoverable: false };
      return;
    }

    // The file is now current in memory + on disk → eligible for a follow-up edit.
    markRead(ctx.sessionId, resolved);

    const newHash = contentHash(input.content);
    const diff = unifiedDiff(input.path, before ?? '', input.content);
    const lint: LintDiagnostic[] = isLintable(resolved) ? lintContent(resolved, input.content) : [];
    const line_count = input.content.length === 0 ? 0 : input.content.split('\n').length;

    yield {
      kind: 'ok',
      data: {
        path: input.path,
        created: !exists,
        bytes_written: Buffer.byteLength(input.content, 'utf8'),
        line_count,
        diff,
        previous_hash,
        content_hash: newHash,
        lint,
      },
    };
  },
});
