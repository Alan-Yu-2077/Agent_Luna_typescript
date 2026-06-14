// Timestamp helpers for the cute UI. Pure (relativeTime takes `now` as an arg)
// so they're deterministic and unit-testable; the DOM refresher is the only
// part that reads the clock + touches elements.

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function absoluteTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Full stamp for the hover title, e.g. "2026/6/14 14:32".
export function absoluteStamp(ms: number): string {
  return `${new Date(ms).getFullYear()}/${dateLabel(ms)} ${absoluteTime(ms)}`;
}

export function relativeTime(nowMs: number, thenMs: number): string {
  const min = Math.floor(Math.max(0, nowMs - thenMs) / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  return dateLabel(thenMs);
}

// Re-render every [data-ts] element's relative label on a timer, so "刚刚"
// ages into "3 分钟前" without a page interaction.
export function startTimestampRefresh(root: ParentNode, intervalMs = 30_000): () => void {
  const tick = (): void => {
    const now = Date.now();
    root.querySelectorAll<HTMLElement>('[data-ts]').forEach((el) => {
      const ts = Number(el.dataset['ts']);
      if (Number.isFinite(ts)) el.textContent = relativeTime(now, ts);
    });
  };
  const id: ReturnType<typeof setInterval> = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
