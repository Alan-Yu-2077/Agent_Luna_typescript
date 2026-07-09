import type { VoiceParams } from '@luna/protocol';
import type { AudioSink, LipSyncFrame } from '../sinks';

// A zero-setup voice using the browser's built-in Web Speech API (speechSynthesis). No backend and no
// model download — a fresh install can speak. The API exposes no audio samples, so lip-sync is a
// coarse time-based mouth flap while the utterance plays, released (setMouth(null)) when it ends.
export class WebSpeechSink implements AudioSink {
  private readonly onMouth: (frame: LipSyncFrame | null) => void;
  private readonly synth: SpeechSynthesis | null;
  private flapTimer = 0;
  private open = 0.5;

  constructor(opts: { onMouth?: (frame: LipSyncFrame | null) => void } = {}) {
    this.onMouth = opts.onMouth ?? (() => {});
    this.synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  }

  speak(text: string, _voice?: VoiceParams, onStart?: () => void): Promise<void> {
    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined' || text.trim() === '') {
      onStart?.();
      return Promise.resolve();
    }
    const synth = this.synth;
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      let started = false;
      const begin = (): void => {
        if (started) return;
        started = true;
        onStart?.();
        this.startFlap();
      };
      const finish = (): void => {
        this.stopFlap();
        resolve();
      };
      u.onstart = begin;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
      // Some engines never fire onstart (WebKit); nudge so onStart + resolve still happen.
      globalThis.setTimeout(begin, 250);
    });
  }

  stop(): void {
    this.synth?.cancel();
    this.stopFlap();
  }

  private startFlap(): void {
    this.stopTimer();
    this.flapTimer = globalThis.setInterval(() => {
      this.open = this.open > 0.3 ? 0.08 : 0.55; // toggle a gentle open/close while speaking
      this.onMouth({ open: this.open, form: 0, shrug: 0, pucker: 0 });
    }, 110) as unknown as number;
  }

  private stopFlap(): void {
    this.stopTimer();
    this.onMouth(null); // release the mouth back to the emotion/idle layer
  }

  private stopTimer(): void {
    if (this.flapTimer) {
      globalThis.clearInterval(this.flapTimer);
      this.flapTimer = 0;
    }
  }
}
