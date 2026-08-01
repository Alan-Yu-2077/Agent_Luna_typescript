import type { Live2DSink } from '../sinks';

// v0.44.0 — the main menu, her front door. Opening the app no longer drops you mid-conversation:
// she sleeps on the right (pure front-end state, the backend is not even connected), and the left
// 42% is a floating text menu — no button shells, no emoji, no containers (D1). The menu overlays
// the chat panel's own grid slot, which is the whole trick behind D4: when Talk swaps menu for
// chat (v0.44.1), she is already standing exactly where the session layout puts her, so she wakes
// in place and moves not one pixel — she does not belong to any "page".

export type MenuItemId = 'talk' | 'diary' | 'skills' | 'dream' | 'settings' | 'quit';

export type MenuItem = {
  id: MenuItemId;
  label: string;
  // D1's two tiers: the four doors to her (38px/800) vs the two meta items (27px/700).
  primary: boolean;
  disabled?: boolean;
};

// `hasQuit` — Quit only exists where something can actually quit (the desktop bridge); a browser
// tab's close button is not ours to duplicate.
export function menuItems(opts: { hasQuit: boolean; dreamEnabled: boolean }): MenuItem[] {
  const items: MenuItem[] = [
    { id: 'talk', label: 'Talk', primary: true },
    { id: 'diary', label: 'Diary', primary: true },
    { id: 'skills', label: 'Skills', primary: true },
    { id: 'dream', label: 'Dream', primary: true, disabled: !opts.dreamEnabled },
    { id: 'settings', label: 'Settings', primary: false },
  ];
  if (opts.hasQuit) items.push({ id: 'quit', label: 'Quit', primary: false });
  return items;
}

// Arrow-key cycling over the enabled items only — a disabled Dream is skipped, not a dead stop.
export function nextFocusIndex(current: number, delta: 1 | -1, enabled: readonly boolean[]): number {
  const n = enabled.length;
  if (n === 0 || !enabled.some(Boolean)) return -1;
  let i = current;
  for (let step = 0; step < n; step++) {
    i = (i + delta + n) % n;
    if (enabled[i]) return i;
  }
  return current;
}

// D2 — the hover is a REAL spring, not an ease-out that apologises. A damped spring x(t) is sampled
// into a CSS `linear()` easing, so one curve drives translateX + scale together with a genuine
// overshoot (k≈190, c≈11, m=1 → ζ≈0.4, first-peak overshoot ≈25%). Sampled over the physical
// settle time and normalised, so the CSS duration replays the whole spring at any speed.
export function springLinear(k = 190, c = 11, m = 1, samples = 28): string {
  const omega = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  // Sample until the envelope has decayed to ~1% — the curve must END at 1 or the easing snaps.
  const settle = 4.6 / (zeta * omega);
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * settle;
    let x: number;
    if (zeta < 1) {
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      x = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    } else {
      // Overdamped/critical: no oscillation, plain exponential approach — never overshoots.
      x = 1 - Math.exp(-omega * t) * (1 + omega * t);
    }
    pts.push(i === samples ? '1' : `${Math.round(x * 1000) / 1000}`);
  }
  return `linear(${pts.join(', ')})`;
}

// Transition I (D3), for every non-Talk item: the menu is pushed away and fades, the page rises
// from below on a pop ease, and she fades out to yield the room. Slow is ORCHESTRATED (D10): the
// menu leaves in 600ms, a beat, then the page takes 900ms — 1.6s total, never one long tween.
export const MENU_OUT_MS = 600;
export const PAGE_IN_DELAY_MS = 700;
export const PAGE_IN_MS = 900;

export type MainMenuDeps = {
  stage: HTMLElement;
  sink: Pick<Live2DSink, 'setState'>;
  hasAvatar: boolean;
  onTalk: () => void;
  // undefined = the item renders disabled (v0.44.0 ships it grey; v0.44.1 wires it).
  onDream?: () => void;
  openSettings: () => void;
  quit?: () => void;
  // v0.44.3/4 replace the built-in placeholder with the real page for these ids.
  pageBody?: (id: 'diary' | 'skills') => HTMLElement | null;
};

export function mountMainMenu(root: HTMLElement, deps: MainMenuDeps): { dispose: () => void } {
  const doc = root.ownerDocument;
  root.classList.add('menu-mode');
  // The lobby pose. Sleeping is a pure front-end state — the FaceVm shuts the idle layer down and
  // the built-in breath carries her (v0.43.x behaviour the owner accepted for the lobby).
  deps.sink.setState('sleeping');

  const menu = doc.createElement('nav');
  menu.className = 'main-menu';
  menu.style.setProperty('--spring-ease', springLinear());
  menu.setAttribute('aria-label', 'Main menu');

  const mark = doc.createElement('div');
  mark.className = 'menu-mark';
  mark.textContent = 'LUNA';
  menu.appendChild(mark);

  const items = menuItems({ hasQuit: deps.quit !== undefined, dreamEnabled: deps.onDream !== undefined });
  const buttons: HTMLButtonElement[] = [];
  for (const item of items) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = `menu-item ${item.primary ? 'primary' : 'secondary'}`;
    b.dataset['item'] = item.id;
    b.textContent = item.label;
    if (item.disabled) b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', () => {
      if (item.disabled) return;
      activate(item.id);
    });
    buttons.push(b);
    menu.appendChild(b);
  }
  root.appendChild(menu);

  // zzz over her head, riding the same --luna-head-x/y anchor the speech bubbles use. Only when a
  // model actually rendered — z's floating over the empty-state card would be decoration on a fault.
  let zzz: HTMLElement | null = null;
  if (deps.hasAvatar) {
    zzz = doc.createElement('div');
    zzz.className = 'menu-zzz';
    for (const [i, ch] of ['z', 'z', 'z'].entries()) {
      const s = doc.createElement('span');
      s.textContent = ch;
      s.style.animationDelay = `${i * 0.7}s`;
      zzz.appendChild(s);
    }
    deps.stage.appendChild(zzz);
  }

  // Keyboard: arrows cycle the enabled items, Enter activates (native button semantics).
  const enabled = items.map((i) => !i.disabled);
  const keydown = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const current = buttons.findIndex((b) => b === doc.activeElement);
    const next = nextFocusIndex(current, e.key === 'ArrowDown' ? 1 : -1, enabled);
    if (next >= 0) {
      buttons[next]?.focus();
      e.preventDefault();
    }
  };
  menu.addEventListener('keydown', keydown);

  let page: HTMLElement | null = null;
  let pageTimer: ReturnType<typeof setTimeout> | undefined;

  const leaveToPage = (id: 'diary' | 'skills'): void => {
    menu.classList.add('leaving');
    deps.stage.classList.add('menu-away');
    page = doc.createElement('section');
    page.className = 'menu-page';
    page.dataset['page'] = id;
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'menu-page-back';
    back.textContent = '← Menu';
    back.addEventListener('click', returnToMenu);
    const title = doc.createElement('h2');
    title.textContent = id === 'diary' ? 'Diary' : 'Skills';
    page.append(back, title);
    const body = deps.pageBody?.(id) ?? null;
    if (body) page.appendChild(body);
    else {
      const ph = doc.createElement('p');
      ph.className = 'menu-page-placeholder';
      ph.textContent = id === 'diary' ? 'Her diary opens here soon.' : 'Her skills gather here soon.';
      page.appendChild(ph);
    }
    root.appendChild(page);
    pageTimer = setTimeout(() => page?.classList.add('in'), PAGE_IN_DELAY_MS);
  };

  function returnToMenu(): void {
    clearTimeout(pageTimer);
    page?.classList.remove('in');
    const leaving = page;
    page = null;
    setTimeout(() => leaving?.remove(), MENU_OUT_MS);
    setTimeout(() => {
      menu.classList.remove('leaving');
      deps.stage.classList.remove('menu-away');
      // She never woke (Talk is the only waker), but the pose is re-asserted so a page visit can
      // never leave her stranded in another state once real pages start driving her (v0.44.3+).
      deps.sink.setState('sleeping');
    }, 500);
  }

  const activate = (id: MenuItemId): void => {
    switch (id) {
      case 'talk':
        deps.onTalk();
        return;
      case 'diary':
      case 'skills':
        leaveToPage(id);
        return;
      case 'dream':
        deps.onDream?.();
        return;
      case 'settings':
        deps.openSettings();
        return;
      case 'quit':
        deps.quit?.();
        return;
    }
  };

  return {
    dispose: () => {
      clearTimeout(pageTimer);
      menu.removeEventListener('keydown', keydown);
      menu.remove();
      page?.remove();
      zzz?.remove();
      deps.stage.classList.remove('menu-away');
      root.classList.remove('menu-mode');
    },
  };
}
