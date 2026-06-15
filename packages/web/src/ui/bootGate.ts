// A full-screen boot gate shown while GPT-SoVITS warms its (~5GB) model on first
// run — the page stays blocked until voice is ready (or the user skips / it
// fails), per the "TTS 预热好之前页面不可用" ask. Degrades fast (no block) when no
// sidecar is configured, so running the web standalone still works.

export type BootGate = {
  setStatus(text: string): void;
  done(): void;
  onSkip(cb: () => void): void;
};

export function createBootGate(root: HTMLElement): BootGate {
  const doc = root.ownerDocument;
  const el = doc.createElement('div');
  el.className = 'boot-gate';
  const card = doc.createElement('div');
  card.className = 'boot-card';
  card.innerHTML =
    '<div class="boot-moon">🌙</div>' +
    '<div class="boot-spinner"><i></i><i></i><i></i></div>' +
    '<div class="boot-title">Luna 正在醒来…</div>' +
    '<div class="boot-sub">首次启动要加载语音模型（~5GB），请稍候</div>' +
    '<div class="boot-status">连接中…</div>' +
    '<div class="boot-elapsed"></div>' +
    '<button class="boot-skip" type="button">跳过 · 静音进入</button>';
  el.appendChild(card);
  root.appendChild(el);

  const status = card.querySelector('.boot-status') as HTMLElement;
  const elapsedEl = card.querySelector('.boot-elapsed') as HTMLElement;
  const skip = card.querySelector('.boot-skip') as HTMLButtonElement;

  const start = performance.now();
  const timer = globalThis.setInterval(() => {
    elapsedEl.textContent = `已等待 ${Math.round((performance.now() - start) / 1000)}s`;
  }, 1000);

  return {
    setStatus: (t) => {
      status.textContent = t;
    },
    done: () => {
      globalThis.clearInterval(timer);
      el.classList.add('gone');
      globalThis.setTimeout(() => el.remove(), 400);
    },
    onSkip: (cb) => skip.addEventListener('click', cb),
  };
}

const TTS_STATE_LABEL: Record<string, string> = {
  idle: '准备唤醒语音…',
  starting: '启动语音引擎…',
  spawning: '启动语音引擎…',
  booting: '启动语音引擎…',
  loading: '加载语音模型（~5GB）…',
  loading_model: '加载语音模型（~5GB）…',
  warming: '加载语音模型（~5GB）…',
  ready: '语音就绪 ✓',
};

type HealthShape = { backend?: { ready?: boolean; state?: string } };

// Warms the TTS backend: returns 'unavailable' fast if no sidecar is configured,
// 'ready' once warm (firing one synth — which completes only after the model is
// loaded — and reporting progress from /health), or 'failed' on error/timeout.
export async function warmUpTts(
  base: string,
  onStatus: (s: string) => void,
): Promise<'ready' | 'unavailable' | 'failed'> {
  let first: Response;
  try {
    first = await fetch(`${base}/health`);
  } catch {
    return 'unavailable';
  }
  if (first.status === 502) return 'unavailable'; // dev-server has no upstream configured
  const j0 = (await first.json().catch(() => null)) as HealthShape | null;
  if (isReady(j0)) return 'ready'; // already warm (e.g. a reload)
  onStatus(TTS_STATE_LABEL[j0?.backend?.state ?? 'idle'] ?? '准备唤醒语音…');

  // Resolve as soon as EITHER /health reports ready (the model is loaded — don't
  // wait for the warmup synth to finish) OR the warmup synth returns. Firing
  // /speak is what actually triggers the backend to load; health-ready is usually
  // the earlier signal (the warmup phrase may still be synthesizing after load).
  return await new Promise<'ready' | 'failed'>((resolve) => {
    let settled = false;
    const finish = (r: 'ready' | 'failed'): void => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    void (async () => {
      while (!settled) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          const j = (await (await fetch(`${base}/health`)).json()) as HealthShape;
          const st = j.backend?.state;
          if (st) onStatus(TTS_STATE_LABEL[st] ?? `语音引擎：${st}…`);
          if (isReady(j)) finish('ready');
        } catch {
          /* transient — keep polling */
        }
      }
    })();
    void (async () => {
      try {
        const r = await fetch(`${base}/speak`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: '准备好了' }),
        });
        if (r.ok) await r.arrayBuffer().catch(() => undefined); // drain + discard the warmup audio
        finish(r.ok ? 'ready' : 'failed');
      } catch {
        finish('failed');
      }
    })();
  });
}

// The service reports loaded via either the `ready` flag or state==='ready';
// accept either so the gate never hangs on a single field's wording.
function isReady(j: HealthShape | null): boolean {
  return Boolean(j?.backend?.ready) || j?.backend?.state === 'ready';
}
