// Web Audio playback + an analyser tap for lip-sync. Plays a decoded WAV buffer
// (real TTS) or a synthetic tone (dev smoke); the analyser feeds RMS to LipSync.

type Nodes = { ctx: AudioContext; gain: GainNode; analyser: AnalyserNode };

export class WebAudioPlayer {
  private nodes: Nodes | null = null;
  private source: AudioBufferSourceNode | OscillatorNode | null = null;
  private readonly buf = new Float32Array(1024);

  private ensure(): Nodes {
    if (!this.nodes) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      this.nodes = { ctx, gain, analyser };
    }
    return this.nodes;
  }

  async resume(): Promise<void> {
    if (this.nodes && this.nodes.ctx.state === 'suspended') await this.nodes.ctx.resume();
  }

  async play(data: ArrayBuffer, onStart?: () => void, onEnd?: () => void): Promise<void> {
    const { ctx, gain } = this.ensure();
    await this.resume();
    const audioBuf = await ctx.decodeAudioData(data);
    this.stopSource();
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(gain);
    src.onended = () => {
      if (this.source === src) this.source = null;
      onEnd?.();
    };
    this.source = src;
    src.start();
    onStart?.();
  }

  // Synthetic source for smoke-testing lip-sync without the TTS sidecar.
  playTone(durationMs = 2000, onStart?: () => void, onEnd?: () => void): void {
    const { ctx, gain } = this.ensure();
    void this.resume();
    this.stopSource();
    const osc = ctx.createOscillator();
    osc.frequency.value = 180;
    const amp = ctx.createGain();
    amp.gain.value = 0.08; // quiet but enough RMS to drive the mouth
    osc.connect(amp);
    amp.connect(gain);
    osc.onended = () => {
      if (this.source === osc) this.source = null;
      onEnd?.();
    };
    this.source = osc;
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    onStart?.();
  }

  rms(): number {
    if (!this.nodes) return 0;
    this.nodes.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = this.buf[i] ?? 0;
      sum += v * v;
    }
    return Math.sqrt(sum / this.buf.length);
  }

  isPlaying(): boolean {
    return this.source !== null;
  }

  private stopSource(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source = null;
    }
  }

  stop(): void {
    this.stopSource();
  }
}
