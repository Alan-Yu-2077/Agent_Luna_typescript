# luna-music-cli

Now-playing observation and playback control for Luna, on macOS.

Lets Luna know what you are listening to — and control it — so she can listen
along and talk about it. Built against the **official NeteaseMusic.app**, with no
reverse-engineered API and no DRM in the path.

Status: the CLI in this repo is done and verified end-to-end. The Luna
integration described below is **a plan, not yet written**.

---

## Why it is built this way

The obvious approach — wrap one of the community NetEase API projects — is a
trap. The ecosystem's keystone, `Binaryify/NeteaseCloudMusicApi` (30.3k stars),
was **archived on 2024-02-28**; everything downstream survives on vendored
copies of its endpoints with nobody maintaining the upstream. And
`go-musicfox`, the healthiest client left, is a pure TUI: its `internal/commands/`
holds only config/notify/reset verbs, and its README's entire usage section is
`$ musicfox`. There is no scriptable surface to wrap.

So the design inverts: **let the official client play the music, and observe it
from the outside.**

macOS publishes a system-wide Now Playing record through the private
MediaRemote framework. NeteaseMusic.app populates it — verified, see below — and
`media-control` reads and drives it. That buys:

- no reverse-engineered API, so nothing to break when NetEase rotates endpoints
- no DRM, no VIP gating, no account credentials anywhere in this code
- your own paid client, playing your own library
- Apple Music, Spotify and browser playback for free, same contract

The cost is that this layer knows *what* is playing, not *about* it. Lyrics and
comments need a second, optional layer — see [Layer 2](#layer-2--enrichment-not-built).

### Verified on this machine

macOS 26.5.2 · NeteaseMusic 3.1.8.3368 · media-control 0.7.6 · Bun 1.3.14

| Claim | Evidence |
|---|---|
| NetEase publishes to MediaRemote | `bundleIdentifier: com.netease.163music`, full metadata |
| Metadata is complete | title, artist, album, `duration`, `elapsedTime`, cover JPEG |
| Control works | `play` `pause` `next` round-tripped, state confirmed after each |
| Push, not poll | stream is silent while idle (2 events / 5s), fires on change |
| Track changes are detectable | 3 distinct songs cleanly separated in one session |

---

## Install

```bash
brew install media-control
bun install
bun src/cli.ts doctor
```

`doctor` is the pre-flight check — Luna should gate the whole feature on it.

## Use

```bash
luna-music now --netease --pretty      # current track as JSON, null when idle
luna-music watch --netease             # NDJSON event stream (long-lived)
luna-music play|pause|toggle|next|prev
luna-music doctor
```

Flags: `--source <bundleId>`, `--artwork <dir>`, `--debounce <ms>`, `--pretty`.
`LUNA_MUSIC_BIN` overrides the `media-control` path.

`watch` emits one JSON object per line:

```jsonc
{"event":"track","track":{…}}                       // a different song started
{"event":"state","playing":true,"position":55.2,…}  // play/pause flipped
{"event":"stopped","at":"…"}                        // no player reporting
```

A real session — play, skip, pause — produces exactly:

```
track  'BAD ENDING FUNK'  playing=False
state  playing=True   pos=55.2
state  playing=False  pos=57.8     ← the player's own pause while switching
track  'ATM'          playing=False
state  playing=True   pos=0.0
state  playing=False  pos=0.6
```

## Use from Luna directly

Luna is Bun/TS, so **import the module — do not spawn the CLI.** The tool and
the ambient-context provider should share one `watch()` subscription rather than
paying a subprocess per read.

```ts
import { watch, now, send, positionAt, NETEASE_BUNDLE_ID } from "luna-music-cli";

for await (const ev of watch({ source: NETEASE_BUNDLE_ID, signal })) {
  if (ev.event === "track") announce(ev.track);
}
```

`positionAt(track)` extrapolates the live playhead from the last snapshot, so
lyrics can follow without re-reading.

---

## The plan: wiring this into Luna

Luna already has the exact shape this needs. `ARCHITECTURE.md` describes weather
as surfacing *"as a tool, as ambient context, and as a proactive weather-shift
detector — all dormant until a location is configured."* Music is the same
triple, gated the same way. Copy that structure, file for file.

### Layer 1 — this repo (built)

| Concern | Where it goes in Luna | Modelled on |
|---|---|---|
| Provider — hold one `watch()`, keep latest track in memory | `server/src/tools/media/nowPlaying.ts` | `tools/web/weather/` |
| Tool — `play/pause/next/prev/search`, Zod schema, `defineTool` | `server/src/tools/builtin/music.ts` | `tools/builtin/weather.ts` |
| Ambient context — inject current track into the uncached prompt tail | `server/src/turn/nowPlayingContext.ts` | `turn/weatherContext.ts` |
| Proactive — a track-change detector on the silence ladder | `server/src/proactive/` | `proactive/proactiveWeather.ts` |
| Gate — `LUNA_MUSIC`, dormant unless `doctor()` passes | capability gates | `LUNA_LAT_LON` |

Four notes that matter more than they look:

1. **Do not make Luna call a tool to know what is playing.** Route it through
   ambient context like time and weather. The stream pushes, so the current
   track is already in memory — a tool call per turn would be pure waste.
2. **Keep artwork out of the prompt.** `artworkData` is base64 JPEG, tens of
   kilobytes per track. This CLI already strips it, exposing `artworkHash` for
   change detection and `--artwork <dir>` for the web/desktop surfaces. Never
   let the raw field reach a model.
3. **Read-only is `safe`, control is not.** Now-playing reads are parallel-safe.
   `next`/`prev` mutate shared external state and should carry a `proactiveRisk`
   marker — Luna skipping your track unprompted is a bad first impression.
4. **Rate-limit the proactive detector.** A track change every three minutes is
   a *lot* of proactive triggers. It belongs on the existing ladder with its own
   cooldown and daily quota, not as a free-firing hook.

### Layer 2 — enrichment (not built)

Lyrics and hot comments are what actually give Luna something to *say*, and they
are the only part that needs the NetEase API. Deliberately separate, and
optional: when it is unavailable, Layer 1 still works and Luna simply knows the
title without the words.

Wrap `2061360308/NeteaseCloudMusic_PythonSDK` (197★, active 2026-03) or
reimplement the two endpoints directly. Match by title+artist from Layer 1.
Cache aggressively — lyrics are immutable.

Out of scope, on purpose: downloading DRM-protected audio and anything that
works around VIP gating. Layer 1 never touches audio bytes, and it should stay
that way.

---

## Three bugs found while building this

All three were only visible against the live player. Each has a regression test.

**1. `contentItemIdentifier` is not an identity.** NeteaseMusic mints a fresh
UUID every play/pause cycle of the *same* song — verified over three cycles:
`1796CF0E…`, `4EEEC79F…`, `5DF07769…`. Keying off it made Luna see a new song
every time playback resumed. Identity is now a hash of title+artist+album, with
the volatile value kept as `sessionId` for debugging.

**2. The stream diffs by default.** `media-control stream` emits only changed
keys, so most payloads look like `{"elapsedTime":20.4}` — indistinguishable from
"nothing is playing" without replaying history. That produced a `stopped` storm.
Fixed with `--no-diff`, plus a distinction between a *vacant* payload (no keys,
a real stop) and a merely *sparse* one (ignore).

**3. `playing` contradicts `playbackRate` mid-transition.** Observed live:
`{playing: false, playbackRate: 1}` between two consistent snapshots. Trusting
`playing` produced about twenty state flips for four real commands. `playbackRate`
is the speed the track is actually advancing at and is now authoritative;
`playing` is the fallback for players that omit a rate.

A fourth, upstream: **media-control's own README warns its API "may experience
breaking changes across minor revisions."** `src/adapter.ts` is the only file
that knows its JSON shape — everything else consumes `NowPlaying`. Keep it that
way.

## Layout

```
src/types.ts     the contract Luna depends on
src/adapter.ts   the ONLY file that knows media-control's JSON
src/control.ts   one-shot reads, commands, doctor()
src/watch.ts     long-lived event stream, debounce, semantic events
src/cli.ts       CLI entry
src/index.ts     module surface for Luna
test/            16 tests, real captured payloads
```

```bash
bun test          # 16 pass
bunx tsc --noEmit # clean, strict + noUncheckedIndexedAccess
```

## Limits

- **macOS only.** MediaRemote is Apple-private. Linux would use MPRIS/D-Bus, and
  the `NowPlaying` contract would survive that swap.
- **Observation, not authority.** If the player reports nothing, this reports
  nothing. `doctor()` tells you which.
- **No search or queue control.** MediaRemote offers transport commands only.
  Search belongs to Layer 2.
