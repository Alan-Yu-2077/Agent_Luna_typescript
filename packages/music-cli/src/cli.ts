#!/usr/bin/env bun
// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/** CLI entry. Every subcommand emits JSON on stdout; diagnostics go to stderr. */

import { now, send, doctor, MediaControlMissingError } from "./control";
import { watch } from "./watch";
import { positionAt } from "./adapter";
import { Library, libraryPath } from "./library";
import { fetchLyrics, lineAt } from "./lyrics";
import { enrich } from "./enrich";
import { Command, NETEASE_BUNDLE_ID } from "./types";

const USAGE = `luna-music — now-playing, perception & playback for Luna (macOS)

Observe
  luna-music now [--enrich]      current track as JSON (--enrich adds affinity + lyric)
  luna-music watch               NDJSON event stream: track | state | stopped
  luna-music doctor              check prerequisites

Perceive (local library, read-only, no network)
  luna-music library search <q>  search your local NetEase library
  luna-music library top         your most-listened tracks
  luna-music library history     recently played
  luna-music library playlists   your saved playlists

Lyrics (network, no credentials)
  luna-music lyrics [id]         full lyrics; id defaults to the current track
  luna-music lyrics --now        just the line playing right now

Control
  luna-music <command>           play pause toggle stop next prev

Options
  --netease                      only report NetEase Cloud Music
  --source <bundleId>            only report this player
  --artwork <dir>                write cover art here, expose artworkPath
  --debounce <ms>                watch: track-change settle window (default 400)
  --limit <n>                    library: max rows (default 10–20)
  --pretty                       indent JSON output

Environment
  LUNA_MUSIC_BIN                 path to media-control (default: media-control)
  LUNA_MUSIC_DB                  path to the NetEase SQLite cache (auto-detected)
`;

const COMMANDS = new Set<Command>([
  "play", "pause", "toggle", "stop", "next", "prev",
  "shuffle", "repeat", "back15", "skip15",
]);

function parse(argv: string[]) {
  const [verb = "", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg) continue;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { verb, flags, positionals };
}

async function main() {
  const { verb, flags, positionals } = parse(Bun.argv.slice(2));
  const indent = flags.pretty ? 2 : 0;
  const emit = (v: unknown) => console.log(JSON.stringify(v, null, indent));

  const source = flags.netease ? NETEASE_BUNDLE_ID : (flags.source as string | undefined);
  const artworkDir = typeof flags.artwork === "string" ? flags.artwork : undefined;
  const opts = { artworkDir };
  const limit = flags.limit ? Number(flags.limit) : undefined;

  if (!verb || verb === "help" || flags.help) {
    console.log(USAGE);
    return 0;
  }

  if (verb === "doctor") {
    const d = await doctor();
    emit(d);
    return d.problems.length === 0 ? 0 : 1;
  }

  if (verb === "now") {
    const track = await now(opts);
    if (!track || (source && track.source !== source)) {
      emit(null);
      return 0;
    }
    if (flags.enrich) {
      emit(await enrich(track, { noLyrics: flags["no-lyrics"] === true }));
      return 0;
    }
    // Report the live position rather than the sample-time one.
    emit({ ...track, position: positionAt(track) });
    return 0;
  }

  if (verb === "library") {
    const [sub, ...args] = positionals;
    const lib = new Library();
    try {
      if (!lib.available) {
        console.error(`NetEase library cache not found at ${libraryPath()}`);
        return 1;
      }
      switch (sub) {
        case "search":
          emit(lib.search(args.join(" "), limit ?? 20));
          return 0;
        case "top":
          emit(lib.top(limit ?? 10));
          return 0;
        case "history":
          emit(lib.history(limit ?? 20));
          return 0;
        case "playlists":
          emit(lib.playlists());
          return 0;
        default:
          console.error(`library: expected search|top|history|playlists`);
          return 2;
      }
    } finally {
      lib.close();
    }
  }

  if (verb === "lyrics") {
    let id = positionals[0];
    if (!id) {
      // Default to the current track: resolve its title through the library.
      const track = await now(opts);
      if (!track) {
        emit(null);
        return 0;
      }
      const lib = new Library();
      id =
        lib.resolveId(
          track.title,
          track.artist,
          track.duration === null ? null : track.duration * 1000,
        ) ?? undefined;
      lib.close();
      if (!id) {
        console.error(`current track "${track.title}" not found in local library`);
        return 1;
      }
      if (flags.now) {
        const lyrics = await fetchLyrics(id);
        emit(lyrics ? lineAt(lyrics, positionAt(track) * 1000) : null);
        return 0;
      }
    }
    emit(await fetchLyrics(id));
    return 0;
  }

  if (verb === "watch") {
    const controller = new AbortController();
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.on(sig, () => controller.abort());
    }
    const debounceMs = flags.debounce ? Number(flags.debounce) : undefined;
    for await (const ev of watch({ ...opts, source, debounceMs, signal: controller.signal })) {
      emit(ev);
    }
    return 0;
  }

  if (COMMANDS.has(verb as Command)) {
    emit(await send(verb as Command, opts));
    return 0;
  }

  console.error(`unknown command: ${verb}\n\n${USAGE}`);
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof MediaControlMissingError) {
      console.error(err.message);
      process.exit(127);
    }
    console.error(err?.message ?? String(err));
    process.exit(1);
  });
