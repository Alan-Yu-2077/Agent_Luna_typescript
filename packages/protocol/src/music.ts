import { z } from 'zod';

// Initiative 32 (v0.45.4) — the player-card HTTP surface. Product HTTP like /api/data/* (v0.44.2):
// zod-parsed on the way out of the server and on the way into the web, loopback-bounded, mounted
// before the viewer gate, and the whole face rides LUNA_MUSIC (off = not mounted = 404).

export const MusicTrackInfo = z.object({
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  // sha256 prefix of the artwork bytes — the card fetches /api/music/artwork?h=<hash>. The image
  // itself only ever travels this HTTP face; the prompt-side artwork ban (v0.45.1) is untouched.
  artworkHash: z.string().nullable(),
});
export type MusicTrackInfo = z.infer<typeof MusicTrackInfo>;

// v0.45.8 (Initiative 34): the companionship payload — optional so every pre-.8 consumer keeps
// parsing untouched. Affinity comes from the client's own local play accounting (read-only).
export const MusicAffinity = z.object({
  sessions: z.number(),
  listenedSeconds: z.number(),
  rank: z.number().nullable(),
});
export type MusicAffinity = z.infer<typeof MusicAffinity>;

export const MusicNow = z.object({
  track: MusicTrackInfo.nullable(), // null = nothing playing (the card's exit condition)
  playing: z.boolean(),
  position: z.number(), // seconds, server-extrapolated at response time
  duration: z.number().nullable(),
  affinity: MusicAffinity.nullable().optional(),
});
export type MusicNow = z.infer<typeof MusicNow>;

export const MusicControlRequest = z.object({
  op: z.enum(['play', 'pause', 'toggle', 'next', 'prev']),
});
export type MusicControlRequest = z.infer<typeof MusicControlRequest>;
