import type { VoiceParams } from '@luna/protocol';
import type { AudioSink, LipSyncFrame } from '../sinks';
import { WebAudioPlayer } from './audioPlayer';
import { LipSync } from './lipSync';
import { SerialQueue } from './serialQueue';
import { fetchSpeech } from './ttsClient';

// The real AudioSink: synthesize via the GPT-SoVITS proxy, play through Web Audio,
// and drive the avatar's mouth from the audio RMS (lip-sync). Utterances are
// serialized — synthesis runs concurrently but PLAYBACK is strictly one-at-a-time
// (no overlapping voices). `onMouth(frame|null)` is wired to live2dSink.setMouth by
// the app; null releases the mouth back to the emotion/idle layer.

export type WebAudioSinkOpts = { onMouth: (frame: LipSyncFrame | null) => void; apiBase?: string };

export class WebAudioSink implements AudioSink {
  private readonly player = new WebAudioPlayer();
  private readonly lip = new LipSync();
  private readonly queue = new SerialQueue();
  private raf = 0;
  private lastFrameMs = 0;
  // Self-healing failure latch: after a run of hard failures, mute for a window and
  // re-attempt — a brief sidecar restart no longer mutes the whole session (the old
  // permanent `disabled` boolean did, until a full page reload).
  private mutedUntil = 0;
  private fails = 0;
  // One controller per "speech session" — stop() aborts every queued/in-flight
  // utterance (barge-in) and a fresh one is installed for what comes next.
  private aborter = new AbortController();

  constructor(private readonly opts: WebAudioSinkOpts) {
    const unlock = (): void => {
      void this.player.resume();
    };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  speak(text: string, voice?: VoiceParams, onStart?: () => void): Promise<void> {
    if (Date.now() < this.mutedUntil || !text.trim()) return Promise.resolve();
    const signal = this.aborter.signal;
    // Prefetch the audio now (concurrent), but gate PLAYBACK on the serial queue so
    // the next utterance only starts after the previous one has fully ended.
    const audio = this.fetch(text, voice, signal);
    return this.queue.run(async () => {
      if (signal.aborted) return; // barged-in while waiting in the queue
      const data = await audio;
      if (data && !signal.aborted) await this.playToEnd(data, signal, onStart);
    });
  }

  stop(): void {
    this.aborter.abort(); // cancel in-flight synthesis/decode for queued utterances
    this.aborter = new AbortController();
    this.queue.clear(); // drop anything queued (barge-in)
    this.player.stop();
    this.stopMouth();
  }

  // Dev smoke: drive lip-sync from a synthetic tone (no sidecar needed).
  playTone(durationMs = 2000): void {
    this.player.playTone(
      durationMs,
      () => this.startMouth(),
      () => this.stopMouth(),
    );
  }

  private async fetch(text: string, voice?: VoiceParams, signal?: AbortSignal): Promise<ArrayBuffer | null> {
    try {
      const data = await fetchSpeech(text, { voice, apiBase: this.opts.apiBase, signal });
      this.fails = 0; // recovered
      return data;
    } catch (e) {
      // An intentional barge-in abort is NOT a TTS failure — never count it toward
      // the latch, or repeated interruptions would mute the session.
      if (signal?.aborted || (e as { name?: string }).name === 'AbortError') return null;
      // Retryable statuses don't count: 503 = the voice backend warming its model on
      // the first /speak; 502/504 = the proxy during a sidecar restart. Only true
      // hard failures (network / 4xx) accrue toward the latch.
      const status = (e as { status?: number }).status;
      if (status !== 503 && status !== 502 && status !== 504) this.fails += 1;
      if (this.fails >= 5) {
        this.mutedUntil = Date.now() + 60_000; // mute 60s, then re-attempt
        this.fails = 0; // fresh window after the mute
      }
      return null;
    }
  }

  // Resolves only when playback ENDS (not when it starts) — that's the gate the
  // serial queue waits on, so utterances never overlap.
  private playToEnd(data: ArrayBuffer, signal: AbortSignal, onStart?: () => void): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.stopMouth();
        resolve();
      };
      void this.player
        .play(
          data,
          () => {
            onStart?.();
            this.startMouth();
          },
          finish,
          signal,
        )
        .catch(finish);
    });
  }

  private startMouth(): void {
    cancelAnimationFrame(this.raf);
    this.lip.reset();
    this.lastFrameMs = performance.now();
    const loop = (): void => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastFrameMs) / 1000); // clamp dt across tab stalls
      this.lastFrameMs = now;
      this.lip.ingest(this.player.rms());
      this.opts.onMouth(this.lip.tick(dt));
      if (this.player.isPlaying()) this.raf = requestAnimationFrame(loop);
      else this.stopMouth();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stopMouth(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lip.reset();
    this.opts.onMouth(null); // release the mouth back to emotion/idle
  }
}
