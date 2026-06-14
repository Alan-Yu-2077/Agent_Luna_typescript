import type { ExpressionKey, VoiceParams } from '@luna/protocol';

// The seam between the consumption controller and the Live2D + audio pipelines.
// The controller drives these interfaces; the real Live2D model driver
// (v0.13.1, pixiLive2DSink) plugs in here, and GPT-SoVITS audio later. The
// console/no-op stubs let the whole consumption path run without rendering/audio.

export type Live2DState = 'neutral' | 'thinking' | 'speaking' | 'sleeping';

export interface Live2DSink {
  // emotion is the normalized [0,1] intensity from the message envelope
  setExpression(key: ExpressionKey, emotion?: number): void;
  // coarse posture/idle state, driven from turn/dream events
  setState(state: Live2DState): void;
  // lip-sync mouth-open [0,1] (fed by the audio pipeline; 0 until v0.13.3)
  setMouthOpen(value: number): void;
  clear(): void;
  // optional — only the real pixi sink implements these:
  // toggle pointer gaze-follow (autoFocus) vs pure performance-choreography mode
  setGazeFollow?(on: boolean): void;
  // play a named preset emotion directly (dev / manual trigger)
  triggerEmotion?(id: string, intensity?: number): void;
  // the available preset emotion ids (for a dev trigger UI)
  listEmotions?(): string[];
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
  setState(state) {
    console.log(`[live2d] state=${state}`);
  },
  setMouthOpen() {
    /* no-op stub — would be 60fps spam to log */
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
