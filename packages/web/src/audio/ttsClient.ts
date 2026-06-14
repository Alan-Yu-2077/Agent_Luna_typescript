import type { VoiceParams } from '@luna/protocol';

// Client for the (reused, as-is) GPT-SoVITS proxy — `POST <base>/speak` → WAV.
// The proxy + the Python sidecar are NOT rebuilt here (REWRITE_CONTEXT locked
// decision); the dev server forwards /api/gpt-sovits/* to the configured upstream.

export type FetchSpeechOpts = { voice?: VoiceParams; apiBase?: string };

export async function fetchSpeech(text: string, opts: FetchSpeechOpts = {}): Promise<ArrayBuffer> {
  const base = opts.apiBase ?? '/api/gpt-sovits';
  const res = await fetch(`${base}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voice: opts.voice?.voice, provider: opts.voice?.provider }),
  });
  if (!res.ok) {
    const err = new Error(`tts request failed: ${res.status}`) as Error & { status?: number };
    err.status = res.status; // lets the sink treat 503 (model warming up) as retryable
    throw err;
  }
  return res.arrayBuffer();
}
