import type { VoiceParams } from '@luna/protocol';

// Client for the TTS forward — `POST <base>/speak {text}` → WAV. The server-side forward
// (dev-server.ts / serve.ts) translates this into a direct GPT-SoVITS api_v2 `/tts` call using the
// BYO voice config in env; the browser only supplies the text.

export type FetchSpeechOpts = { voice?: VoiceParams; apiBase?: string; signal?: AbortSignal };

export async function fetchSpeech(text: string, opts: FetchSpeechOpts = {}): Promise<ArrayBuffer> {
  const base = opts.apiBase ?? '/api/tts';
  const res = await fetch(`${base}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voice: opts.voice?.voice, provider: opts.voice?.provider }),
    signal: opts.signal, // barge-in: stop() aborts an in-flight synthesis request
  });
  if (!res.ok) {
    const err = new Error(`tts request failed: ${res.status}`) as Error & { status?: number };
    err.status = res.status; // lets the sink treat 503 (model warming up) as retryable
    throw err;
  }
  return res.arrayBuffer();
}
