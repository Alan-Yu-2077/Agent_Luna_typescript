// Translate a browser `/api/tts/*` request into a DIRECT GPT-SoVITS api_v2 call — no owner glue, no
// vendored Python. The web posts `/api/tts/speak {text}` and probes `/api/tts/health`; we map speak to
// api_v2's `POST /tts` and health to a reachability check. Every api_v2 parameter (the user's BYO voice
// reference) comes from env, so the browser never needs to know them. Pure so it unit-tests; the
// per-runtime HTTP plumbing (Bun in dev-server.ts, Node in serve.ts) adapts around it.

export type TtsEnv = {
  url?: string; // LUNA_TTS_URL — the api_v2 base, e.g. http://127.0.0.1:9880
  refAudio?: string; // LUNA_TTS_REF_AUDIO — reference-audio path ON the api_v2 host (the BYO voice)
  promptText?: string; // LUNA_TTS_PROMPT_TEXT — transcript of that reference clip
  textLang?: string; // LUNA_TTS_TEXT_LANG — synthesis language (default 'auto')
  promptLang?: string; // LUNA_TTS_PROMPT_LANG — reference language (default = textLang)
};

export type TtsForwardPlan =
  | { kind: 'speak'; url: string; body: string }
  | { kind: 'health'; url: string }
  | { kind: 'error'; status: number; message: string };

export function readTtsEnv(env: Record<string, string | undefined>): TtsEnv {
  return {
    url: env['LUNA_TTS_URL'],
    refAudio: env['LUNA_TTS_REF_AUDIO'],
    promptText: env['LUNA_TTS_PROMPT_TEXT'],
    textLang: env['LUNA_TTS_TEXT_LANG'],
    promptLang: env['LUNA_TTS_PROMPT_LANG'],
  };
}

// `subpath` is the part after `/api/tts/` (e.g. 'speak', 'health'). Only those two are recognized — an
// unknown subpath is a plain 404, never forwarded, so a traversal like `..%2fadmin` can't reach the
// upstream (the target URL is CONSTRUCTED from a fixed path, never derived from the request path).
export function planTtsForward(subpath: string, bodyText: string, env: TtsEnv): TtsForwardPlan {
  const base = (env.url ?? '').replace(/\/+$/, '');
  if (!base) return { kind: 'error', status: 502, message: 'tts upstream not configured' };

  if (subpath === 'health') return { kind: 'health', url: base };

  if (subpath === 'speak') {
    if (!env.refAudio) return { kind: 'error', status: 502, message: 'LUNA_TTS_REF_AUDIO not set' };
    let text: string;
    try {
      text = String((JSON.parse(bodyText || '{}') as { text?: unknown }).text ?? '');
    } catch {
      return { kind: 'error', status: 400, message: 'invalid json' };
    }
    if (text.trim() === '') return { kind: 'error', status: 400, message: 'empty text' };
    const textLang = env.textLang ?? 'auto';
    const payload = {
      text,
      text_lang: textLang,
      ref_audio_path: env.refAudio,
      prompt_text: env.promptText ?? '',
      prompt_lang: env.promptLang ?? textLang,
      media_type: 'wav',
      streaming_mode: false,
    };
    return { kind: 'speak', url: `${base}/tts`, body: JSON.stringify(payload) };
  }

  return { kind: 'error', status: 404, message: 'unknown tts endpoint' };
}
