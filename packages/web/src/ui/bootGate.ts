// A full-screen boot gate shown while the voice backend warms its model on first
// run — the page stays blocked until voice is ready (or the user skips / it
// fails). Degrades fast (no block) when no voice sidecar is configured, so running
// the web standalone (or voiceless) still works.

export type BootGate = {
  setStatus(text: string): void;
  done(): void;
  onSkip(cb: () => void): void;
  // v0.37.1: hide the skip during the first stretch of a MANAGED cold start (标准 2 wants a real
  // gate) — the caller reveals it after ~20s or instantly on failure, so no one is ever stranded.
  setSkipHidden(hidden: boolean): void;
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
    '<div class="boot-title">Luna is waking up…</div>' +
    '<div class="boot-sub">First launch loads the voice model, one moment…</div>' +
    '<div class="boot-status">Connecting…</div>' +
    '<div class="boot-elapsed"></div>' +
    '<button class="boot-skip" type="button">Skip · enter muted</button>';
  el.appendChild(card);
  root.appendChild(el);

  const status = card.querySelector('.boot-status') as HTMLElement;
  const elapsedEl = card.querySelector('.boot-elapsed') as HTMLElement;
  const skip = card.querySelector('.boot-skip') as HTMLButtonElement;

  const start = performance.now();
  const timer = globalThis.setInterval(() => {
    elapsedEl.textContent = `elapsed ${Math.round((performance.now() - start) / 1000)}s`;
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
    setSkipHidden: (hidden) => {
      skip.style.display = hidden ? 'none' : '';
    },
  };
}

const TTS_STATE_LABEL: Record<string, string> = {
  idle: 'Preparing voice…',
  starting: 'Starting the voice engine…',
  spawning: 'Starting the voice engine…',
  booting: 'Starting the voice engine…',
  restarting: 'Voice engine restarting…',
  loading: 'Loading the voice model…',
  loading_model: 'Loading the voice model…',
  warming: 'Loading the voice model…',
  ready: 'Voice ready ✓',
};

type HealthShape = { backend?: { ready?: boolean; state?: string } };

// v0.37.1: the states meaning "Luna owns the child and it is coming" — the gate WAITS through these
// (the warm synth retries instead of failing), per 标准 2. Anything else keeps BYO semantics.
function isManagedWait(state: string | undefined): boolean {
  return state === 'starting' || state === 'restarting';
}

export type WarmUpTiming = { pollMs?: number; deadlineMs?: number; synthRetryMs?: number; synthTimeoutMs?: number };

// Warms the TTS backend: returns 'unavailable' fast if no sidecar is configured,
// 'ready' once warm (firing one synth — which completes only after the model is
// loaded — and reporting progress from /health), or 'failed' on error/timeout.
// v0.37.1: `onStatus` also receives the raw health state so the caller can tell a
// managed wait from ordinary warming (drives the skip-button delay); timings are
// injectable for tests.
export async function warmUpTts(
  base: string,
  onStatus: (s: string, state?: string) => void,
  timing: WarmUpTiming = {},
): Promise<'ready' | 'unavailable' | 'failed'> {
  const pollMs = timing.pollMs ?? 1200;
  const deadlineMs = timing.deadlineMs ?? 120_000;
  const synthRetryMs = timing.synthRetryMs ?? 2000;
  const synthTimeoutMs = timing.synthTimeoutMs ?? 90_000;

  let first: Response;
  try {
    first = await fetch(`${base}/health`);
  } catch {
    return 'unavailable';
  }
  if (first.status === 502) return 'unavailable'; // dev-server has no upstream configured
  const j0 = (await first.json().catch(() => null)) as HealthShape | null;
  if (isReady(j0)) return 'ready'; // already warm (e.g. a reload)
  let lastState = j0?.backend?.state;
  if (lastState === 'gave-up') return 'failed'; // the managed child crash-looped out — fail fast
  onStatus(TTS_STATE_LABEL[lastState ?? 'idle'] ?? 'Preparing voice…', lastState);

  // Resolve as soon as EITHER /health reports ready (the model is loaded — don't
  // wait for the warmup synth to finish) OR the warmup synth returns. Firing
  // /speak is what actually triggers the backend to load; health-ready is usually
  // the earlier signal (the warmup phrase may still be synthesizing after load).
  return await new Promise<'ready' | 'failed'>((resolve) => {
    let settled = false;
    // Overall deadline so the gate ALWAYS lifts (the doc promised "failed on
    // timeout"): if a wedged sidecar accepts /speak but never responds while
    // /health keeps reporting non-ready, neither racer below would settle.
    const deadline = setTimeout(() => finish('failed'), deadlineMs);
    const finish = (r: 'ready' | 'failed'): void => {
      if (!settled) {
        settled = true;
        clearTimeout(deadline);
        resolve(r);
      }
    };
    void (async () => {
      while (!settled) {
        await new Promise((r) => setTimeout(r, pollMs));
        try {
          const j = (await (await fetch(`${base}/health`)).json()) as HealthShape;
          const st = j.backend?.state;
          lastState = st;
          if (st === 'gave-up') {
            finish('failed'); // supervisor exhausted its restarts — don't burn the deadline
            return;
          }
          if (st) onStatus(TTS_STATE_LABEL[st] ?? `Voice engine: ${st}…`, st);
          if (isReady(j)) finish('ready');
        } catch {
          /* transient — keep polling */
        }
      }
    })();
    // The warm-synth racer. v0.37.1: while the MANAGED child is still coming (starting/restarting),
    // a refused/failed /speak retries instead of finishing 'failed' — the old fast-fail turned the
    // gate into "enter muted" seconds into a managed cold start (the 'unavailable' semantic bug's
    // synth-side twin). Unmanaged failures keep the old fast-fail.
    const fireSynth = async (): Promise<void> => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), synthTimeoutMs);
      let ok = false;
      try {
        const r = await fetch(`${base}/speak`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'Ready when you are' }),
          signal: ctl.signal,
        });
        if (r.ok) await r.arrayBuffer().catch(() => undefined); // drain + discard the warmup audio
        ok = r.ok;
      } catch {
        ok = false;
      } finally {
        clearTimeout(t);
      }
      if (settled) return;
      if (ok) finish('ready');
      else if (isManagedWait(lastState)) setTimeout(() => void fireSynth(), synthRetryMs);
      else finish('failed');
    };
    void fireSynth();
  });
}

// The service reports loaded via either the `ready` flag or state==='ready';
// accept either so the gate never hangs on a single field's wording.
function isReady(j: HealthShape | null): boolean {
  return Boolean(j?.backend?.ready) || j?.backend?.state === 'ready';
}
