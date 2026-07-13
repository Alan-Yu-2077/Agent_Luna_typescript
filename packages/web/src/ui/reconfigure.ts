// v0.35.6 (Initiative 25 follow-up): the escape hatch back to the setup wizard when a bad config
// breaks the backend. Rides the status badge: whenever the WS is NOT open (connecting after a dead
// restart, reconnect-looping against a misconfigured server) a "Reconfigure" pill appears right
// where the user is staring. Desktop-only (needs the shell's openSetup bridge); a plain browser
// never shows it. Pure visibility rule so it unit-tests.

// Only 'closed' (the reconnect loop — the backend died or never came up): showing during the
// initial 'connecting' would flash the button on every healthy boot.
export function reconfigureVisible(status: string, canOpenSetup: boolean): boolean {
  return canOpenSetup && status === 'closed';
}

export function mountReconfigureButton(
  badge: HTMLElement,
  openSetup: (() => void) | undefined,
): (status: string) => void {
  if (!openSetup) return () => {};
  const doc = badge.ownerDocument;
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'reconfigure-btn';
  btn.textContent = '⚙ 重新配置 / Setup';
  btn.title = 'Open the setup wizard (fix keys, model, voice)';
  btn.style.display = 'none';
  btn.addEventListener('click', () => openSetup());
  badge.after(btn);
  return (status) => {
    btn.style.display = reconfigureVisible(status, true) ? '' : 'none';
  };
}
