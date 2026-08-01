// v0.44.0: does this boot go through the main menu (the cold lobby), or straight into the session?
//
// The menu only exists in the NORMAL window. Every other mode keeps today's behaviour byte for byte:
// `?setup` and `?workbench` early-return before this is ever consulted; `?pet` and agent-only are
// direct boots (a pet floating on the desktop has no lobby, and agent-only opted out of the avatar
// the lobby exists to stage). `luna:menu = '0'` is the escape hatch, same convention as every other
// proven feature; `?menu=0` is the same bypass as a query — the packaged smoke uses it to exercise
// the full WS path in one load.
export function menuEnabled(opts: {
  search: string;
  storage?: Pick<Storage, 'getItem'> | null;
  agentOnly: boolean;
}): boolean {
  const q = new URLSearchParams(opts.search);
  if (q.has('pet')) return false;
  if (q.get('menu') === '0') return false;
  if (opts.agentOnly) return false;
  try {
    if (opts.storage?.getItem('luna:menu') === '0') return false;
  } catch {
    /* storage disabled — the default (menu on) stands */
  }
  return true;
}
