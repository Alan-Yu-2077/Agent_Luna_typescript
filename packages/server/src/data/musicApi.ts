import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { positionAt, send } from '@luna/music-cli';
import { MusicControlRequest, MusicNow } from '@luna/protocol';
import { artworkDir, getMusicEnrichment, getNowPlaying } from '../tools/media/nowPlaying';
import { musicEnabled } from '../tools/registry';

// Initiative 32 (v0.45.4) — the player card's three endpoints. Same posture as dataApi (v0.44.2):
// PRODUCT surface before the viewer gate, loopback bind as the boundary, zod both ends. The whole
// face rides LUNA_MUSIC: main.ts only consults this handler when musicEnabled(), so off = 404 and
// the card never mounts. Dormant provider (flag on, doctor failed) = an explicit 503, not a lie.

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const DORMANT = json({ error: 'music provider dormant' }, 503);

// v0.45.8: the affinity slice of the enrich state, when it belongs to this track.
function affinityOf(trackId: string): { sessions: number; listenedSeconds: number; rank: number | null } | null {
  const e = getMusicEnrichment();
  if (!e || e.trackId !== trackId || e.affinity === null) return null;
  return {
    sessions: e.affinity.sessions,
    listenedSeconds: e.affinity.listenedSeconds,
    rank: e.affinity.rank,
  };
}

function nowPayload(): Response | null {
  const s = getNowPlaying();
  if (s === null) return null;
  const t = s.track;
  const body: MusicNow =
    t === null
      ? { track: null, playing: false, position: 0, duration: null }
      : {
          track: { title: t.title, artist: t.artist, album: t.album, artworkHash: t.artworkHash },
          playing: s.playing,
          position: Math.round(positionAt(t) * 10) / 10,
          duration: t.duration,
          affinity: affinityOf(t.id),
        };
  return json(MusicNow.parse(body));
}

// The artwork filename is derived HERE from a validated hash — never from request text — so no
// traversal shape exists (the /api/data fixed-path discipline, one directory down).
const HASH_RE = /^[0-9a-f]{8,64}$/;
const ARTWORK_EXTS = ['jpg', 'png', 'webp'] as const;

export function artworkPathFor(dir: string, hash: string): string | null {
  if (!HASH_RE.test(hash)) return null;
  for (const ext of ARTWORK_EXTS) {
    const p = join(dir, `${hash}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Returns null when the path is not ours (the caller falls through). Mounted only when
// musicEnabled() — an off flag never even reaches here. `platform` is injectable so the CI legs
// (linux/windows) can exercise the darwin-gated paths.
export async function musicApiHandler(
  req: Request,
  platform: string = process.platform,
): Promise<Response | null> {
  if (!musicEnabled(platform)) return null;
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/music/')) return null;
  const sub = url.pathname.slice('/api/music/'.length);

  if (sub === 'now' && req.method === 'GET') {
    return nowPayload() ?? DORMANT;
  }

  if (sub === 'control' && req.method === 'POST') {
    if (getNowPlaying() === null) return DORMANT;
    let op: MusicControlRequest['op'];
    try {
      const parsed = MusicControlRequest.safeParse(await req.json());
      if (!parsed.success) return json({ error: 'bad op' }, 400);
      op = parsed.data.op;
    } catch {
      return json({ error: 'bad body' }, 400);
    }
    try {
      // send() confirms with a ~250ms-later read-back — that snapshot is the response so the
      // card can correct its optimistic state immediately.
      const after = await send(op);
      const body: MusicNow =
        after === null
          ? { track: null, playing: false, position: 0, duration: null }
          : {
              track: {
                title: after.title,
                artist: after.artist,
                album: after.album,
                artworkHash: after.artworkHash,
              },
              playing: after.playing,
              position: Math.round(positionAt(after) * 10) / 10,
              duration: after.duration,
            };
      return json(MusicNow.parse(body));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

  if (sub === 'artwork' && req.method === 'GET') {
    const h = url.searchParams.get('h') ?? '';
    const p = artworkPathFor(artworkDir(), h);
    if (p === null) return new Response('not found', { status: 404 });
    const ext = p.slice(p.lastIndexOf('.') + 1);
    return new Response(Bun.file(p), {
      headers: { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': 'max-age=86400' },
    });
  }

  return new Response('not found', { status: 404 });
}
