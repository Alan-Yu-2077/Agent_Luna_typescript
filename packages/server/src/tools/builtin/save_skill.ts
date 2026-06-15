import { z } from 'zod';
import { defineTool } from '../defineTool';
import { workspaceRoot } from '../workspace';
import { activeSpawner, clampTimeout } from '../shellCore';
import { parseBunTestOutput } from './run_tests';
import { saveSkill } from '../../skills/skillStore';

// save_skill (Initiative 8, v0.15.4) — persist a reusable procedure to the skill
// library, but ONLY after the verify loop passes (the Voyager invariant: a skill
// that doesn't leave the workspace green doesn't enter the library). proactiveRisk:
// 'surface' (it executes the test suite). Skills are data the model recalls, never
// auto-executed. Behind LUNA_SKILLS.
const Input = z.object({
  name: z.string().min(1).max(80).describe('a short stable id for the skill'),
  description: z.string().min(1).max(400).describe('one line: what the skill is for (used for recall)'),
  body: z.string().min(1).max(8000).describe('the reusable procedure / steps / snippet to remember'),
  verify: z
    .boolean()
    .optional()
    .describe('run the test suite before saving (default true) — a skill saved from a red workspace is refused'),
});

const Output = z.object({
  saved: z.boolean(),
  verified: z.boolean(),
  pass: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  reason: z.string().optional(),
});

export type SaveSkillOutput = z.infer<typeof Output>;

export const saveSkillTool = defineTool({
  name: 'save_skill',
  description:
    'Save a reusable procedure to your skill library so you can recall it later. By default it runs ' +
    'the test suite first and REFUSES to save if anything is failing (only verified skills are kept). ' +
    'A skill is notes you reuse — it is never executed automatically.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'surface',
  timeoutMs: 1_800_000,
  summarize: (out) =>
    out.saved
      ? `saved skill (verified, ${out.pass} tests pass)`
      : `skill NOT saved${out.reason ? ` — ${out.reason}` : ''}`,
  execute: async function* (input, ctx) {
    const verify = input.verify ?? true;
    let pass = 0;
    let fail = 0;

    if (verify) {
      let result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean };
      try {
        result = await activeSpawner()({
          command: 'bun test',
          cwd: workspaceRoot(),
          timeoutMs: clampTimeout(undefined),
          abortSignal: ctx.abortSignal,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        yield { kind: 'err', code: 'execution_exception', message: `save_skill: verify failed to run — ${message}`, recoverable: true };
        return;
      }
      const parsed = parseBunTestOutput(result.stdout + '\n' + result.stderr);
      pass = parsed.pass;
      fail = parsed.fail;
      const green = result.exitCode === 0 && fail === 0;
      if (!green) {
        yield {
          kind: 'ok',
          data: {
            saved: false,
            verified: false,
            pass,
            fail,
            reason: `verify failed: ${fail} test(s) failing — the workspace must be green to save a skill`,
          },
        };
        return;
      }
    }

    const saved = saveSkill({ name: input.name, description: input.description, body: input.body }, Date.now());
    yield {
      kind: 'ok',
      data: {
        saved,
        verified: verify,
        pass,
        fail,
        ...(saved ? {} : { reason: 'skill persistence unavailable (no DB this session)' }),
      },
    };
  },
});
