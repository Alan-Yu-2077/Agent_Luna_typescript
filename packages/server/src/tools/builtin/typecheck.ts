import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { activeSpawner, clampTimeout, SHELL_MAX_TIMEOUT_MS } from '../shellCore';

// typecheck (Initiative 8, v0.15.2) — a first-class verifier so the locate → edit
// → VERIFY loop is built-in and the model doesn't hand-roll shell for it. Runs
// `bun x tsc --noEmit` (optionally `-p <pkg>`) through the shared injectable
// spawner and PARSES the diagnostics into { ok, diagnostics[] }. proactiveRisk:
// 'surface' because it executes; cwd jailed via resolveInWorkspace('execute').
const Input = z.object({
  path: z
    .string()
    .optional()
    .describe('a tsconfig path or package dir to check with -p (default: whole repo from the workspace root)'),
  cwd: z
    .string()
    .optional()
    .describe('working directory to run from (default: workspace root)'),
  timeout_ms: z.number().int().min(1).max(SHELL_MAX_TIMEOUT_MS).optional(),
});

const Diagnostic = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative().optional(),
  message: z.string(),
});

const Output = z.object({
  ok: z.boolean(),
  diagnostics: z.array(Diagnostic),
  truncated: z.boolean(),
});

export type TypecheckOutput = z.infer<typeof Output>;

const MAX_DIAGNOSTICS = 100;

// tsc default (non-pretty) line shape:
//   src/foo.ts(12,5): error TS2322: Type 'x' is not assignable to type 'y'.
const TSC_LINE = /^(.+?)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.*)$/;

export function parseTscOutput(text: string): { diagnostics: z.infer<typeof Diagnostic>[]; truncated: boolean } {
  const diagnostics: z.infer<typeof Diagnostic>[] = [];
  let truncated = false;
  for (const line of text.split('\n')) {
    const m = TSC_LINE.exec(line.trim());
    if (!m) continue;
    if (diagnostics.length >= MAX_DIAGNOSTICS) {
      truncated = true;
      break;
    }
    diagnostics.push({
      file: m[1] ?? '',
      line: Number(m[2] ?? 0),
      column: Number(m[3] ?? 0),
      message: m[4] ?? '',
    });
  }
  return { diagnostics, truncated };
}

export const typecheckTool = defineTool({
  name: 'typecheck',
  description:
    'Type-check the project with tsc --noEmit and return structured diagnostics ({file, line, message}). ' +
    'Pass a package dir or tsconfig path to scope it. Use this after editing TypeScript to verify your ' +
    'change compiles before claiming it works.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: SHELL_MAX_TIMEOUT_MS,
  summarize: (out) =>
    out.ok
      ? 'typecheck clean'
      : `typecheck: ${out.diagnostics.length}${out.truncated ? '+' : ''} error${out.diagnostics.length === 1 ? '' : 's'}`,
  execute: async function* (input, ctx) {
    const target = input.cwd ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'execute');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `typecheck: ${gate.reason}`, recoverable: false };
      return;
    }

    const command = input.path
      ? `bun x tsc --noEmit -p ${JSON.stringify(input.path)}`
      : 'bun x tsc --noEmit';

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
      yield { kind: 'err', code: 'execution_exception', message: `typecheck: ${message}`, recoverable: true };
      return;
    }

    const { diagnostics, truncated } = parseTscOutput(result.stdout + '\n' + result.stderr);
    yield {
      kind: 'ok',
      data: { ok: result.exitCode === 0 && diagnostics.length === 0, diagnostics, truncated },
    };
  },
});
