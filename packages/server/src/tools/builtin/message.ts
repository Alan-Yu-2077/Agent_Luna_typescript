import { z } from 'zod';
import { ExpressionKey, MessageDelivery, VoiceParams } from '@luna/protocol';
import { defineTool } from '../defineTool';
import {
  MAX_CHARS,
  MAX_CLAUSE_CHARS,
  MAX_SENTENCES,
  longestClauseLength,
  splitSentences,
} from '../../persona/humanity';

// Pacing constants ported from Python segment_streaming (28ms/char, clamp
// 120–900). delay_ms ships as metadata; the server never sleeps (A2).
export const PACE_MS_PER_CHAR = 28;
export const PACE_MIN_MS = 120;
export const PACE_MAX_MS = 900;

export function paceDelayMs(text: string): number {
  return Math.min(Math.max(text.length * PACE_MS_PER_CHAR, PACE_MIN_MS), PACE_MAX_MS);
}

// Flat root object (v0.5.2 gateway rule); humanity caps live in the schema —
// a violation is a recoverable validation_failed and the model re-emits.
// `sentences` is deliberately NOT a model field (amendment A1): text is the
// single source of truth, segments are derived server-side below.
const Input = z
  .object({
    text: z
      .string()
      .min(1)
      .max(MAX_CHARS)
      .describe(`what you say to the user, spoken style, at most ${MAX_CHARS} characters`),
    expression: ExpressionKey.optional().describe(
      'how your face/body reads while saying this; pick the closest key',
    ),
    emotion: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('expression intensity, 0 = barely visible, 1 = full'),
    voice_params: VoiceParams.optional().describe('per-message TTS overrides; usually omit'),
    is_final: z
      .boolean()
      .describe('true when this is your last message of the turn, false if more is coming'),
  })
  .superRefine((v, ctx) => {
    const sentences = splitSentences(v.text);
    if (sentences.length > MAX_SENTENCES) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: `at most ${MAX_SENTENCES} sentences per message (got ${sentences.length}) — split into multiple message calls`,
      });
    }
    const longest = longestClauseLength(v.text);
    if (longest > MAX_CLAUSE_CHARS) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: `longest clause is ${longest} chars, cap is ${MAX_CLAUSE_CHARS} — break it up or shorten`,
      });
    }
  });

export const messageTool = defineTool({
  name: 'message',
  description:
    'Speak to the user. Calling this tool IS speaking — it is your only voice. Each call is one ' +
    'chat bubble; prefer several short calls over one long one. Set is_final=true on the last ' +
    'message of your turn.',
  input: Input,
  output: MessageDelivery,
  concurrency: 'session-serial',
  timeoutMs: 1000,
  summarize: (out) => out.text.slice(0, 30),
  execute: async function* (input) {
    const segments = splitSentences(input.text).map((text, index) => ({
      index,
      text,
      delay_ms: paceDelayMs(text),
    }));
    yield {
      kind: 'ok',
      data: {
        text: input.text,
        segments,
        ...(input.expression !== undefined ? { expression: input.expression } : {}),
        ...(input.emotion !== undefined ? { emotion: input.emotion } : {}),
        ...(input.voice_params !== undefined ? { voice_params: input.voice_params } : {}),
        is_final: input.is_final,
      },
    };
  },
});
