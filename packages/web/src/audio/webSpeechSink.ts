import type { VoiceParams } from '@luna/protocol';
import type { AudioSink, LipSyncFrame } from '../sinks';
import { detectVoiceLang, pickVoice } from './voicePick';

// A zero-setup voice using the browser's built-in Web Speech API (speechSynthesis). No backend and no
// model download — a fresh install can speak. The API exposes no audio samples, so lip-sync is a
// coarse time-based mouth flap while the utterance plays, released (setMouth(null)) when it ends.
//
// v0.37.12: the voice is CHOSEN (voicePick), not inherited. Leaving `utterance.voice` unset hands the
// OS default to a girl's avatar — on macOS/EN a deep male voice. `luna:voice` in localStorage names an
// explicit override.
export class WebSpeechSink implements AudioSink {
  private readonly onMouth: (frame: LipSyncFrame | null) => void;
  private readonly synth: SpeechSynthesis | null;
  private readonly preferredName: string | undefined;
  private flapTimer = 0;
  private open = 0.5;

  constructor(opts: { onMouth?: (frame: LipSyncFrame | null) => void; preferredVoice?: string } = {}) {
    this.onMouth = opts.onMouth ?? (() => {});
    this.synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    this.preferredName = opts.preferredVoice;
    void this.voices(); // warm the list NOW — getVoices() is empty until the engine loads it
  }

  // getVoices() is EMPTY on the first call in Chrome/Electron and fills asynchronously; a first
  // utterance fired before it populates would speak in the default (male) voice — the exact bug.
  // Resolve on `voiceschanged`, bounded, and cache.
  private voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
  private voices(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
    const synth = this.synth;
    if (!synth) return Promise.resolve([]);
    this.voicesReady ??= new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const now = synth.getVoices();
      if (now.length > 0) {
        resolve(now);
        return;
      }
      let done = false;
      const settle = (): void => {
        if (done) return;
        done = true;
        resolve(synth.getVoices());
      };
      synth.addEventListener?.('voiceschanged', settle, { once: true });
      globalThis.setTimeout(settle, timeoutMs); // never hang a reply on the voice list
    });
    return this.voicesReady;
  }

  async speak(text: string, _voice?: VoiceParams, onStart?: () => void): Promise<void> {
    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined' || text.trim() === '') {
      onStart?.();
      return Promise.resolve();
    }
    const synth = this.synth;
    const lang = detectVoiceLang(text);
    const chosen = pickVoice(await this.voices(), lang, this.preferredName);
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; // even with no voice match, at least don't read 中文 with an English engine
      if (chosen) u.voice = chosen as SpeechSynthesisVoice;
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
