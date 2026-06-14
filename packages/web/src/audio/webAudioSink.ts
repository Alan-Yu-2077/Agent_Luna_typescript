import type { VoiceParams } from '@luna/protocol';
import type { AudioSink } from '../sinks';
import { WebAudioPlayer } from './audioPlayer';
import { LipSync } from './lipSync';
import { fetchSpeech } from './ttsClient';

// The real AudioSink: synthesize via the GPT-SoVITS proxy, play through Web
// Audio, and drive the avatar's mouth from the audio RMS (lip-sync). Degrades
// to silence if the sidecar is unavailable. `onMouth` is wired to
// live2dSink.setMouthOpen by the app.

export type WebAudioSinkOpts = { onMouth: (value: number) => void; apiBase?: string };

export class WebAudioSink implements AudioSink {
  private readonly player = new WebAudioPlayer();
  private readonly lip = new LipSync();
  private raf = 0;
  private disabled = false;
  private fails = 0;

  constructor(private readonly opts: WebAudioSinkOpts) {
    const unlock = (): void => {
      void this.player.resume();
    };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  async speak(text: string, voice?: VoiceParams, onStart?: () => void): Promise<void> {
    if (this.disabled || !text.trim()) return;
    let data: ArrayBuffer;
    try {
      data = await fetchSpeech(text, { voice, apiBase: this.opts.apiBase });
      this.fails = 0; // recovered
    } catch (e) {
      // Don't latch off on the first failure: GPT-SoVITS loads a ~5GB model on
      // first /speak and returns 503 while warming — that's retryable, so the
      // next message can succeed. Only give up after several consecutive hard
      // failures (sidecar genuinely down), so we don't spam a dead endpoint.
      const status = (e as { status?: number }).status;
      if (status !== 503) this.fails += 1;
      if (this.fails >= 5) this.disabled = true;
      return;
    }
    try {
      await this.player.play(
        data,
        () => {
          onStart?.();
          this.startMouth();
        },
        () => this.stopMouth(),
      );
    } catch {
      this.stopMouth();
    }
  }

  stop(): void {
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

  private startMouth(): void {
    cancelAnimationFrame(this.raf);
    const loop = (): void => {
      this.opts.onMouth(this.lip.ingest(this.player.rms()));
      if (this.player.isPlaying()) this.raf = requestAnimationFrame(loop);
      else this.stopMouth();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stopMouth(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lip.reset();
    this.opts.onMouth(0);
  }
}
