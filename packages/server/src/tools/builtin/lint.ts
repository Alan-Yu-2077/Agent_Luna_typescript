import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { activeSpawner, clampTimeout, SHELL_MAX_TIMEOUT_MS } from '../shellCore';

// lint (Initiative 8, v0.15.2) — runs the project's own linter and returns a
// structured result. This is the PROJECT-WIDE / formatting checker (prettier
// --check by default), distinct from the per-write fast syntactic parse in
// lintOnWrite.ts (v0.15.1). proactiveRisk:'surface' (it executes); cwd jailed.
//
// The project formatter is prettier (the evaluator firewall lists .prettierrc).
// `prettier --check` exits non-zero and lists each unformatted file; we surface
// those as the structured `issues`.
const Input = z.object({
  path: z
    .string()
    .optional()
    .describe('a file or glob to lint (default: the project default set)'),
  cwd: z.string().optional().describe('working directory (default: workspace root)'),
  timeout_ms: z.number().int().min(1).max(SHELL_MAX_TIMEOUT_MS).optional(),
});

const Output = z.object({
  ok: z.boolean(),
  issues: z.array(z.string()),
  truncated: z.boolean(),
});

export type LintOutput = z.infer<typeof Output>;

const MAX_ISSUES = 100;

// `prettier --check` prints a banner ("Checking formatting...") then one line per
// unformatted file, each prefixed "[warn] " — collect those as the issues. Any
// other non-prefixed noise is ignored.
export function parsePrettierOutput(text: string): { issues: string[]; truncated: boolean } {
  const issues: string[] = [];
  let truncated = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('[warn]')) continue;
    const body = line.slice('[warn]'.length).trim();
    // skip the summary "[warn] Code style issues found..." footer
    if (/code style issues|run .*--write/i.test(body)) continue;
    if (issues.length >= MAX_ISSUES) {
      truncated = true;
      break;
    }
    issues.push(body);
  }
  return { issues, truncated };
}

export const lintTool = defineTool({
  name: 'lint',
  description:
    'Run the project linter/formatter check (prettier --check) and return the files with issues. ' +
    'Use this after editing to confirm the code matches project style. This is the project-wide ' +
    'checker, separate from the inline syntax check that edit/write_file already fold in.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: SHELL_MAX_TIMEOUT_MS,
  summarize: (out) =>
    out.ok ? 'lint clean' : `lint: ${out.issues.length}${out.truncated ? '+' : ''} file(s) with issues`,
  execute: async function* (input, ctx) {
    const target = input.cwd ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'execute');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `lint: ${gate.reason}`, recoverable: false };
      return;
    }

    const scope = input.path ? JSON.stringify(input.path) : '.';
    const command = `bun x prettier --check ${scope}`;

    let result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean };
    try {
      result = await activeSpawner()({
        command,
        cwd: gate.resolved,
        timeoutMs: clampTimeout(input.timeout_ms),
        abortSignal: ctx.abortSignal,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `lint: ${message}`, recoverable: true };
      return;
    }

    const { issues, truncated } = parsePrettierOutput(result.stdout + '\n' + result.stderr);
    yield {
      kind: 'ok',
      data: { ok: result.exitCode === 0 && issues.length === 0, issues, truncated },
    };
  },
});
