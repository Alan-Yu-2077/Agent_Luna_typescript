import { z } from 'zod';
import { statSync } from 'node:fs';
import { defineTool } from '../defineTool';
import { isSecretTailPath, resolveInWorkspace, workspaceRoot } from '../workspace';
import { classifyShellCommand } from '../shellDeny';
import {
  activeSpawner,
  clampTimeout,
  SHELL_DEFAULT_TIMEOUT_MS,
  SHELL_MAX_TIMEOUT_MS,
} from '../shellCore';

// shell (Initiative 8, v0.15.2) — the single most dangerous surface in the
// rewrite, and the one LD #10 reserved for "when a concrete need arises". It is
// also the LD #9 減負 home for directory create/move/copy/delete (mkdir -p / mv /
// cp -r / rm within the jail) — no separate fs-mutation tools.
//
// Safety stacks (each tested):
//   1. deny-regex + interactive-block (shellDeny.ts) — hard refusal, always on.
//   2. resolveInWorkspace('execute') on BOTH the cwd AND any sensitive path named
//      in the command text — the secret/keychain block applies to the command.
//   3. proactiveRisk:'surface' — no silent shell in a proactive turn (gate +
//      LUNA_PROACTIVE_MAX_ACTIONS budget).
//   4. timeout (default 120 s, hard max 1800 s) → process-tree kill; output cap
//      (~120 KB middle-elided).
//   5. concurrency:'session-serial' — never two shells racing in one session.
// Mounted behind LUNA_SHELL (OWNER DECISION: default ON; `=0` is the off switch).
const Input = z.object({
  command: z
    .string()
    .min(1)
    .max(8000)
    .describe('the shell command to run (non-interactive; /bin/zsh -lc). Use for builds, tests, git, file ops.'),
  cwd: z
    .string()
    .optional()
    .describe('working directory (default: workspace root). Must not be a sensitive path.'),
  timeout_ms: z
    .number()
    .int()
    .min(1)
    .max(SHELL_MAX_TIMEOUT_MS)
    .optional()
    .describe(`timeout in ms (default ${SHELL_DEFAULT_TIMEOUT_MS}, hard max ${SHELL_MAX_TIMEOUT_MS})`),
});

const Output = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number().int(),
  timed_out: z.boolean(),
});

export type ShellOutput = z.infer<typeof Output>;

// Heuristic scan for an absolute/home path token in the command that lands in a
// sensitive area. The deny-regex catches the well-known cred writes; this routes
// any explicit path argument through the same blocklist resolveInWorkspace uses,
// so `cat ~/.aws/credentials` is refused exactly like reading it via read_file.
function blockedPathInCommand(command: string): string | null {
  // POSIX (`/…`, `~/…`) + v0.38.5 Windows shapes: a drive path (`C:\…`) and a
  // %VAR%-prefixed path (`%USERPROFILE%\.aws\…`). Defense-in-depth — `shell` is
  // unmounted on win32 today (registry.ts), so this guards a future win32 spawner.
  const tokens = command.match(/(?:~[/\\]|[/\\]|[A-Za-z]:[/\\]|%[A-Za-z_]+%[/\\])[^\s'"|;&<>]+/g) ?? [];
  for (const tok of tokens) {
    // Tail check first: catches `$HOME/.aws/...` / `${HOME}/.ssh/...` env-var
    // indirection, where the captured token is `/.aws/...` and resolves OUTSIDE
    // the real $HOME — so the absolute blocklist below would let it through.
    if (isSecretTailPath(tok)) {
      return `blocked: secret path (${tok}) — a secret location cannot be laundered through env-var indirection`;
    }
    const gate = resolveInWorkspace(tok, 'execute');
    if (!gate.ok) return gate.reason;
  }
  return null;
}

export const shellTool = defineTool({
  name: 'shell',
  description:
    'Run a non-interactive shell command on the local machine (builds, tests, git, file operations ' +
    'like mkdir/mv/cp/rm within the workspace). Dangerous patterns (rm -rf, sudo, dd, mkfs, fork bombs, ' +
    'curl|sh, writes to credentials) are hard-blocked; interactive commands (vim/less/ssh/top) are ' +
    'refused (no TTY). Output is capped. Prefer the dedicated typecheck/run_tests/lint tools for ' +
    'verification. After changing code, verify it — do not claim it works untested.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  // The dispatcher aborts at tool.timeoutMs; set it to the hard ceiling so a
  // long per-call timeout_ms is honored. The per-call default/clamp is enforced
  // inside execute via the spawner.
  timeoutMs: SHELL_MAX_TIMEOUT_MS,
  summarize: (out) =>
    out.timed_out
      ? `shell timed out (exit ${out.exit_code})`
      : `shell exit ${out.exit_code}`,
  execute: async function* (input, ctx) {
    // 1. deny-regex + interactive block
    const verdict = classifyShellCommand(input.command);
    if (!verdict.allowed) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `shell: ${verdict.reason}`,
        recoverable: true,
      };
      return;
    }

    // 2a. sensitive path named in the command text
    const blockedPath = blockedPathInCommand(input.command);
    if (blockedPath !== null) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `shell: ${blockedPath}`,
        recoverable: false,
      };
      return;
    }

    // 2b. cwd through the same blocklist (execute access)
    const target = input.cwd ?? workspaceRoot();
    const gate = resolveInWorkspace(target, 'execute');
    if (!gate.ok) {
      yield { kind: 'err', code: 'execution_exception', message: `shell: ${gate.reason}`, recoverable: false };
      return;
    }
    let isDir = false;
    try {
      isDir = statSync(gate.resolved).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: `shell: cwd is not a directory: ${target}`,
        recoverable: true,
      };
      return;
    }

    const timeoutMs = clampTimeout(input.timeout_ms);

    let result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean };
    try {
      result = await activeSpawner()({
        command: input.command,
        cwd: gate.resolved,
        timeoutMs,
        abortSignal: ctx.abortSignal,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      yield { kind: 'err', code: 'execution_exception', message: `shell: ${message}`, recoverable: true };
      return;
    }

    // Stream the captured output as progress before the final (the dispatcher
    // forwards progress as tool.progress; the model sees output as it lands).
    yield { kind: 'progress', payload: { stdout: result.stdout, stderr: result.stderr } };

    yield {
      kind: 'ok',
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        timed_out: result.timedOut,
      },
    };
  },
});
