// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/**
 * Long-lived event stream.
 *
 * This is the half a request/response CLI cannot express, and the reason Luna
 * should hold one child process open rather than polling: MediaRemote pushes,
 * so a track change reaches Luna in ~0ms of extra latency and 0 idle cost.
 */

import { RawPayload, normalise, isEmpty, isSameTrack, NormaliseOptions } from "./adapter";
import { MusicEvent, NowPlaying } from "./types";
import { BIN, MediaControlMissingError } from "./control";

export interface WatchOptions extends NormaliseOptions {
  /**
   * Swallow the transition window. media-control's README warns that during a
   * track change a payload can carry the previous title with the next artist,
   * and it emits duplicate snapshots per change. Default 400ms.
   */
  debounceMs?: number;
  /** Only emit for this bundle id (e.g. `com.netease.163music`). */
  source?: string;
  signal?: AbortSignal;
}

/**
 * A payload with no fields at all — the stream's way of saying no player is
 * reporting. Distinct from `isEmpty`, which also covers sparse updates.
 */
function isVacant(raw: RawPayload | null | undefined): boolean {
  return !raw || Object.keys(raw).length === 0;
}

/** Minimal push queue: producer calls `push`/`close`, consumer async-iterates. */
class EventQueue<T> {
  private items: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    const resolve = this.waiting.shift();
    if (resolve) resolve({ value, done: false });
    else this.items.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.waiting) resolve({ value: undefined as never, done: true });
    this.waiting = [];
  }

  async *drain(): AsyncGenerator<T> {
    while (true) {
      if (this.items.length > 0) {
        yield this.items.shift()!;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<T>>((r) => this.waiting.push(r));
      if (next.done) return;
      yield next.value;
    }
  }
}

/**
 * Async-iterate semantic events. Yields `track` on a new song, `state` on a
 * play/pause flip, `stopped` when every player goes away.
 *
 *   for await (const ev of watch({ source: NETEASE_BUNDLE_ID })) { ... }
 *
 * A new song is emitted by a timer, not by the arrival of a later event — the
 * upstream stream falls silent between changes, so waiting for the next payload
 * would drop the last track change indefinitely.
 */
export async function* watch(opts: WatchOptions = {}): AsyncGenerator<MusicEvent> {
  const debounceMs = opts.debounceMs ?? 400;

  let proc;
  try {
    // `--no-diff` is load-bearing. With diffing (the upstream default) most
    // payloads carry only the changed keys — e.g. `{"elapsedTime":20.4}` — which
    // is indistinguishable from "nothing is playing" without replaying every
    // prior event. Full snapshots keep this loop stateless and correct.
    proc = Bun.spawn([BIN, "stream", "--no-diff"], { stdout: "pipe", stderr: "ignore" });
  } catch {
    throw new MediaControlMissingError();
  }

  const queue = new EventQueue<MusicEvent>();
  let current: NowPlaying | null = null;
  let pending: NowPlaying | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearPending = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  const schedule = (track: NowPlaying) => {
    pending = track;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const settled = pending;
      pending = null;
      if (!settled) return;
      current = settled;
      queue.push({ event: "track", track: settled });
    }, debounceMs);
  };

  const stop = () => {
    clearPending();
    proc.kill();
    queue.close();
  };
  opts.signal?.addEventListener("abort", stop, { once: true });

  // Producer: consume stdout in the background, feeding the queue.
  (async () => {
    try {
      const decoder = new TextDecoder();
      let buffered = "";

      for await (const chunk of proc.stdout) {
        buffered += decoder.decode(chunk, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let raw: RawPayload;
          try {
            const env = JSON.parse(line);
            // `stream` wraps snapshots as {type:"data",payload:{…}}; tolerate bare payloads.
            raw = env?.payload ?? env;
          } catch {
            continue; // partial or non-JSON line; the next chunk completes it
          }

          // Only a genuinely empty payload means "no player is reporting".
          // A sparse payload that merely lacks a title is an update we cannot
          // act on — drop it rather than mistaking it for a stop.
          if (isVacant(raw)) {
            clearPending();
            if (current !== null) {
              current = null;
              queue.push({ event: "stopped", at: new Date().toISOString() });
            }
            continue;
          }
          if (isEmpty(raw)) continue;

          const track = normalise(raw, opts);
          if (opts.source && track.source !== opts.source) continue;

          if (isSameTrack(current, track)) {
            clearPending(); // a bounce back to the current song is not a change
            if (current!.playing !== track.playing) {
              current = track;
              queue.push({ event: "state", playing: track.playing, position: track.position, track });
            } else {
              current = track; // refresh position silently
            }
            continue;
          }

          schedule(track); // different song — let the metadata settle first
        }
      }
    } finally {
      clearPending();
      queue.close();
    }
  })();

  try {
    yield* queue.drain();
  } finally {
    stop();
  }
}
