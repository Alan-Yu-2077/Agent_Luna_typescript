import { z } from 'zod';

// v0.44.2 — the read-only data surface (`/api/data/*`): her diaries, skills and dream reports,
// finally reachable by the front end. This is an HTTP face, deliberately separate from the WS
// contract in `events.ts` — the two evolve independently. One schema, both ends: the server parses
// on the way OUT and the web parses on the way IN, so drift is a loud failure on whichever side
// moved.

export const DiaryEntry = z.object({
  kind: z.string(),
  period_key: z.string(),
  text: z.string(),
  generated_ms: z.number(),
});
export type DiaryEntry = z.infer<typeof DiaryEntry>;

export const DataDiaries = z.object({ entries: z.array(DiaryEntry) });
export type DataDiaries = z.infer<typeof DataDiaries>;

export const SkillRecord = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string(),
  used_count: z.number(),
  last_used_ms: z.number(),
  verified_ms: z.number(),
  // 'saved' = she wrote it herself (the dream's distillation); anything else names the installer.
  source: z.string(),
  deprecated_ms: z.number(),
});
export type SkillRecord = z.infer<typeof SkillRecord>;

export const DataSkills = z.object({ skills: z.array(SkillRecord) });
export type DataSkills = z.infer<typeof DataSkills>;

// One consolidation step of a dream, as the cycle recorded it ("rate_salience: rated 28 turns").
// The server flattens `report_json` into this — the client never touches the raw JSON string (M10).
export const DreamStep = z.object({
  step: z.string(),
  status: z.string(),
  detail: z.string(),
  ms: z.number(),
});
export type DreamStep = z.infer<typeof DreamStep>;

export const DreamRecord = z.object({
  cycle_id: z.string(),
  started_ms: z.number(),
  ended_ms: z.number().nullable(),
  steps: z.array(DreamStep),
  // A dream that broke off mid-cycle — the book shows these as "梦断了", not as an empty success.
  aborted: z.boolean(),
});
export type DreamRecord = z.infer<typeof DreamRecord>;

export const DataDreams = z.object({ dreams: z.array(DreamRecord) });
export type DataDreams = z.infer<typeof DataDreams>;

// The soul as the product surface sees it (v0.44.6's persona editor). `writable` is gone from this
// shape on purpose — it was the workspace's dev-tools flag; the product POST is loopback-gated like
// everything else (S1), not env-gated.
export const SoulData = z.object({
  fixed_text: z.string(),
  evolving_self: z.string(),
  evolving_bond: z.string(),
  updated_ms: z.number(),
});
export type SoulData = z.infer<typeof SoulData>;
