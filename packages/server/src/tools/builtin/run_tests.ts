import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveInWorkspace, workspaceRoot } from '../workspace';
import { activeSpawner, clampTimeout, SHELL_MAX_TIMEOUT_MS } from '../shellCore';

// run_tests (Initiative 8, v0.15.2) — runs `bun test [path]` through the shared
// injectable spawner and parses the summary into { pass, fail, failures[] } so the
// verify loop is first-class. proactiveRisk:'surface' (it executes); cwd jailed.
const Input = z.object({
  path: z
    .string()
    .optional()
    .describe('a test file or directory to scope the run (default: the whole suite from the workspace root)'),
  cwd: z.string().optional().describe('working directory (default: workspace root)'),
  timeout_ms: z.number().int().min(1).max(SHELL_MAX_TIMEOUT_MS).optional(),
});

const Output = z.object({
  ok: z.boolean(),
  pass: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  failures: z.array(z.string()),
  truncated: z.boolean(),
});

export type RunTestsOutput = z.infer<typeof Output>;

const MAX_FAILURES = 50;

// Parse `bun test` output. The summary lines look like:
//   " 12 pass" / " 2 fail" / " 0 skip"
// and each failing test is prefixed with "(fail)" on its own line:
//   "(fail) my suite > does the thing [3.20ms]"
export function parseBunTestOutput(text: string): {
  pass: number;
  fail: number;
  failures: string[];
  truncated: boolean;
} {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];
  let truncated = false;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const passM = /^(\d+)\s+pass\b/.exec(line);
    if (passM) pass = Number(passM[1]);
    const failM = /^(\d+)\s+fail\b/.exec(line);
    if (failM) fail = Number(failM[1]);

    if (line.startsWith('(fail)')) {
      const name = line.slice('(fail)'.length).replace(/\s*\[[\d.]+m?s\]\s*$/, '').trim();
      if (failures.length >= MAX_FAILURES) {
        truncated = true;
      } else {
        failures.push(name);
      }
    }
  }

  return { pass, fail, failures, truncated };
}

export const runTestsTool = defineTool({
  name: 'run_tests',
  description:
    'Run the project test suite with bun test and return a structured result ({pass, fail, failures}). ' +
    'Pass a path to scope the run to one file or directory. Use this after editing code to confirm your ' +
    'change works and nothing regressed — do not claim a fix works untested.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: SHELL_MAX_TIMEOUT_MS,
  summarize: (out) =>
    out.ok
      ? `tests pass (${out.pass})`
      : `tests: ${out.fail} failed, ${out.pass} passed`,
  execute: async function* (input, ctx) {
    const target = input.cwd ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'execute');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `run_tests: ${gate.reason}`, recoverable: false };
      return;
    }

    if (input.path) {
      const pathGate = resolveInWorkspace(input.path, 'execute');
      if (!pathGate.ok) {
        yield { kind: 'err', code: 'execution_exception', message: `run_tests: ${pathGate.reason}`, recoverable: false };
        return;
      }
    }

    // argv (no shell string) — input.path is a literal arg, never interpreted.
    const argv = input.path ? ['bun', 'test', input.path] : ['bun', 'test'];

    let result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean };
    try {
      result = await activeSpawner()({
        command: argv.join(' '),
        argv,
        cwd: gate.resolved,
        timeoutMs: clampTimeout(input.timeout_ms),
        abortSignal: ctx.abortSignal,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `run_tests: ${message}`, recoverable: true };
      return;
    }

    // bun writes the run summary to stderr; parse both streams.
    const parsed = parseBunTestOutput(result.stdout + '\n' + result.stderr);
    yield {
      kind: 'ok',
      data: {
        ok: result.exitCode === 0 && parsed.fail === 0,
        pass: parsed.pass,
        fail: parsed.fail,
        failures: parsed.failures,
        truncated: parsed.truncated,
      },
    };
  },
});
