// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/** Playback control + one-shot reads. Wraps the `media-control` binary. */

import { RawPayload, normalise, isEmpty, NormaliseOptions } from "./adapter";
import { Command, NowPlaying } from "./types";

/** MediaRemote command codes. See mediaremote-adapter's `send COMMAND` table. */
const CODES: Record<Command, number> = {
  play: 0,
  pause: 1,
  toggle: 2,
  stop: 3,
  next: 4,
  prev: 5,
  shuffle: 6,
  repeat: 7,
  back15: 12,
  skip15: 13,
};

export const BIN = process.env.LUNA_MUSIC_BIN ?? "media-control";

export class MediaControlMissingError extends Error {
  constructor() {
    super(
      `\`${BIN}\` not found. Install it with:\n\n    brew install media-control\n\n` +
        `Or set LUNA_MUSIC_BIN to an absolute path.`,
    );
    this.name = "MediaControlMissingError";
  }
}

async function run(args: string[]): Promise<string> {
  let proc;
  try {
    proc = Bun.spawn([BIN, ...args], { stdout: "pipe", stderr: "pipe" });
  } catch {
    throw new MediaControlMissingError();
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    if (/not found|ENOENT/i.test(stderr)) throw new MediaControlMissingError();
    throw new Error(`${BIN} ${args.join(" ")} failed (exit ${code}): ${stderr.trim()}`);
  }
  return stdout;
}

/** Current track, or `null` when no player is reporting. */
export async function now(opts: NormaliseOptions = {}): Promise<NowPlaying | null> {
  const out = await run(["get"]);
  let raw: RawPayload;
  try {
    raw = JSON.parse(out);
  } catch {
    return null;
  }
  return isEmpty(raw) ? null : normalise(raw, opts);
}

/** Send a playback command. Returns the state ~250ms after, so callers can confirm. */
export async function send(cmd: Command, opts: NormaliseOptions = {}): Promise<NowPlaying | null> {
  await run(["send", String(CODES[cmd])]);
  await Bun.sleep(250);
  return now(opts);
}

export interface Diagnosis {
  binaryFound: boolean;
  binaryPath: string;
  playerDetected: boolean;
  source: string | null;
  neteaseRunning: boolean;
  problems: string[];
}

/** Pre-flight check. Luna should run this before mounting the tool group. */
export async function doctor(): Promise<Diagnosis> {
  const problems: string[] = [];
  let binaryFound = true;
  let track: NowPlaying | null = null;

  try {
    track = await now();
  } catch (e) {
    if (e instanceof MediaControlMissingError) {
      binaryFound = false;
      problems.push("media-control is not installed (brew install media-control)");
    } else {
      problems.push(String(e));
    }
  }

  const ps = Bun.spawn(["pgrep", "-f", "NeteaseMusic"], { stdout: "pipe", stderr: "ignore" });
  const neteaseRunning = (await new Response(ps.stdout).text()).trim().length > 0;

  if (binaryFound && !track) {
    problems.push(
      neteaseRunning
        ? "NetEase is running but reports no Now Playing info — play a track once to prime it."
        : "No media player is reporting. Open a player and start a track.",
    );
  }

  return {
    binaryFound,
    binaryPath: BIN,
    playerDetected: track !== null,
    source: track?.source ?? null,
    neteaseRunning,
    problems,
  };
}
