import type { ExpressionKey, VoiceParams } from '@luna/protocol';

// The seam between the consumption controller and the Live2D + audio pipelines.
// The controller drives these interfaces; the real Live2D model driver
// (v0.13.1, pixiLive2DSink) plugs in here, and GPT-SoVITS audio later. The
// console/no-op stubs let the whole consumption path run without rendering/audio.

export type Live2DState = 'neutral' | 'thinking' | 'speaking' | 'sleeping';

// One frame of lip-sync mouth articulation (ported from Python lip-sync.js): the
// four mouth params driven together — open + form/width + shrug + pucker. `null`
// releases the mouth back to the emotion/idle layer (speech ended).
export type LipSyncFrame = { open: number; form: number; shrug: number; pucker: number };

export interface Live2DSink {
  // emotion is the normalized [0,1] intensity from the message envelope
  setExpression(key: ExpressionKey, emotion?: number): void;
  // coarse posture/idle state, driven from turn/dream events
  setState(state: Live2DState): void;
  // lip-sync mouth articulation (fed by the audio pipeline); null = release
  setMouth(frame: LipSyncFrame | null): void;
  clear(): void;
  // optional — only the real pixi sink implements these:
  // toggle pointer gaze-follow (autoFocus) vs pure performance-choreography mode
  setGazeFollow?(on: boolean): void;
  // play a named preset emotion directly (dev / manual trigger)
  triggerEmotion?(id: string, intensity?: number): void;
  // the available preset emotion ids (for a dev trigger UI)
  listEmotions?(): string[];
  // switch the resting-state idle animation (settings switcher)
  setIdleProfile?(id: string): void;
  // the available idle profiles, ordered, with display labels
  listIdleProfiles?(): ReadonlyArray<{ id: string; label: string }>;
  // v0.25.2: run a layout change and GLIDE the model between its before/after positions (FLIP on
  // the pixi ticker; reduce-motion snaps). Callers without a real sink just run `mutate()`.
  glideLayout?(mutate: () => void): void;
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
  setMouth() {
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
