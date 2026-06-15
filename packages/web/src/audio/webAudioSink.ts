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
  private disabled = false;
  private fails = 0;

  constructor(private readonly opts: WebAudioSinkOpts) {
    const unlock = (): void => {
      void this.player.resume();
    };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  speak(text: string, voice?: VoiceParams, onStart?: () => void): Promise<void> {
    if (this.disabled || !text.trim()) return Promise.resolve();
    // Prefetch the audio now (concurrent), but gate PLAYBACK on the serial queue so
    // the next utterance only starts after the previous one has fully ended.
    const audio = this.fetch(text, voice);
    return this.queue.run(async () => {
      const data = await audio;
      if (data) await this.playToEnd(data, onStart);
    });
  }

  stop(): void {
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

  private async fetch(text: string, voice?: VoiceParams): Promise<ArrayBuffer | null> {
    try {
      const data = await fetchSpeech(text, { voice, apiBase: this.opts.apiBase });
      this.fails = 0; // recovered
      return data;
    } catch (e) {
      // Don't latch off on the first failure: GPT-SoVITS loads a ~5GB model on the
      // first /speak and returns 503 while warming — retryable. Give up only after
      // several consecutive hard failures (sidecar genuinely down).
      const status = (e as { status?: number }).status;
      if (status !== 503) this.fails += 1;
      if (this.fails >= 5) this.disabled = true;
      return null;
    }
  }

  // Resolves only when playback ENDS (not when it starts) — that's the gate the
  // serial queue waits on, so utterances never overlap.
  private playToEnd(data: ArrayBuffer, onStart?: () => void): Promise<void> {
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
