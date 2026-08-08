#!/usr/bin/env bun
// Vendored from ~/Desktop/luna-music-cli (built + live-verified 2026-08-07: macOS 26.5.2, NeteaseMusic 3.1.8.3368, media-control 0.7.6).
/** CLI entry. Every subcommand emits JSON on stdout; diagnostics go to stderr. */

import { now, send, doctor, MediaControlMissingError } from "./control";
import { watch } from "./watch";
import { positionAt } from "./adapter";
import { Command, NETEASE_BUNDLE_ID } from "./types";

const USAGE = `luna-music — now-playing + playback control for Luna (macOS)

  luna-music now                 current track as JSON (null when nothing plays)
  luna-music watch               NDJSON event stream: track | state | stopped
  luna-music doctor              check prerequisites
  luna-music <command>           play pause toggle stop next prev
                                 shuffle repeat back15 skip15

Options
  --netease                      only report NetEase Cloud Music
  --source <bundleId>            only report this player
  --artwork <dir>                write cover art here, expose artworkPath
  --debounce <ms>                watch: track-change settle window (default 400)
  --pretty                       indent JSON output

Environment
  LUNA_MUSIC_BIN                 path to media-control (default: media-control)
`;

const COMMANDS = new Set<Command>([
  "play", "pause", "toggle", "stop", "next", "prev",
  "shuffle", "repeat", "back15", "skip15",
]);

function parse(argv: string[]) {
  const [verb = "", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg || !arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { verb, flags };
}

async function main() {
  const { verb, flags } = parse(Bun.argv.slice(2));
  const indent = flags.pretty ? 2 : 0;
  const emit = (v: unknown) => console.log(JSON.stringify(v, null, indent));

  const source = flags.netease ? NETEASE_BUNDLE_ID : (flags.source as string | undefined);
  const artworkDir = typeof flags.artwork === "string" ? flags.artwork : undefined;
  const opts = { artworkDir };

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
    if (track && source && track.source !== source) {
      emit(null);
      return 0;
    }
    // Report the live position rather than the sample-time one.
    emit(track ? { ...track, position: positionAt(track) } : null);
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
