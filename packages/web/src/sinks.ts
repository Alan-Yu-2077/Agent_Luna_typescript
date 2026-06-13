import type { ExpressionKey, VoiceParams } from '@luna/protocol';

// The seam between the consumption controller and the (later) Live2D + audio
// pipelines. The controller drives these interfaces; the real Live2D model
// driver and GPT-SoVITS audio plug in here in a later pass (Initiative 6 cont.).
// Until then, console/no-op stubs let the whole consumption path run and be
// tested without any rendering or audio.

export interface Live2DSink {
  // emotion is the normalized [0,1] intensity from the message envelope
  setExpression(key: ExpressionKey, emotion?: number): void;
  clear(): void;
}

export interface AudioSink {
  // resolves when playback finishes (or immediately for the stub); onStart fires
  // when audio actually begins, so the controller can drive on-audio-start Live2D
  // commands later (the Python on_audio_start_commands seam).
  speak(text: string, voice?: VoiceParams, onStart?: () => void): Promise<void>;
  stop(): void;
}

export const consoleLive2DSink: Live2DSink = {
  setExpression(key, emotion) {
    console.log(`[live2d] expression=${key}${emotion === undefined ? '' : ` @${emotion}`}`);
  },
  clear() {
    console.log('[live2d] clear');
  },
};

export const noopAudioSink: AudioSink = {
  async speak(_text, _voice, onStart) {
    onStart?.();
  },
  stop() {
    /* no-op */
  },
};
