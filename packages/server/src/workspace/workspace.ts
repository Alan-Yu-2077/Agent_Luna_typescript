import { getMemoryDb } from '../memory/sessionStore';
import { resetSessions } from '../turn/session';
import { lazyHtml } from '../devHtml';

// Developer data IDE (the TS analog of the Python project's `.workspace`). A
// VSCode-style read view over every SQLite table, plus dev-only write actions:
// one-click reset, row delete, and cell edit. Local dev tool — gated by
// LUNA_VIEWER like the trace viewer; mutating routes require POST.

const indexHtml = lazyHtml(import.meta.dir, 'index.html');

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sanitize(v: unknown): unknown {
  if (v instanceof Uint8Array) return `‹blob ${v.byteLength}b›`;
  if (typeof v === 'string' && v.length > 4000)
    return `${v.slice(0, 4000)}… (+${v.length - 4000} chars)`;
  return v;
}

function tableNames(): string[] {
  const db = getMemoryDb();
  if (!db) return [];
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

type TableDump = {
  name: string;
  count: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  editable: boolean;
  error?: string;
};

function dumpAll(limit: number): TableDump[] {
  const db = getMemoryDb();
  if (!db) return [];
  const out: TableDump[] = [];
  for (const name of tableNames()) {
    try {
      const count = (db.prepare(`SELECT count(*) AS c FROM "${name}"`).get() as { c: number }).c;
      const columns = (
        db.prepare(`PRAGMA table_info("${name}")`).all() as Array<{ name: string }>
      ).map((c) => c.name);
      // __rowid lets the UI delete/edit; WITHOUT ROWID / virtual tables lack it → read-only
      let editable = true;
      let raw: Array<Record<string, unknown>>;
      try {
        raw = db
          .prepare(`SELECT rowid AS __rowid, * FROM "${name}" ORDER BY rowid DESC LIMIT ?`)
          .all(limit) as Array<Record<string, unknown>>;
      } catch {
        editable = false;
        raw = db.prepare(`SELECT * FROM "${name}" LIMIT ?`).all(limit) as Array<
          Record<string, unknown>
        >;
      }
      const rows = raw.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, val]) => [k, sanitize(val)])),
      );
      out.push({ name, count, columns, rows, editable });
    } catch (e) {
      out.push({
        name,
        count: -1,
        columns: [],
        rows: [],
        editable: false,
        error: (e as Error).message,
      });
    }
  }
  return out;
}

// One-click reset: clear the conversational + memory + trace data, drop the live
// in-memory session so the open socket reloads fresh. Schema + identity tables
// (core_memory / dream_state) are left intact.
function resetData(): Record<string, number> {
  const db = getMemoryDb();
  if (!db) return {};
  const targets = [
    'l2_turns',
    'traces',
    'l3_facts',
    'embeddings_cache',
    'diaries',
    'dream_reports',
    'core_memory_audit',
    'sessions',
  ];
  const cleared: Record<string, number> = {};
  for (const t of targets) {
    try {
      cleared[t] = db.prepare(`DELETE FROM "${t}"`).run().changes;
    } catch {
      cleared[t] = -1;
    }
  }
  resetSessions(); // drop the in-memory session cache → next turn reloads from the now-empty DB
  return cleared;
}

export async function workspaceHandler(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith('/_workspace')) return null;

  if (path === '/_workspace' && req.method === 'GET') {
    return new Response(indexHtml(), { headers: { 'content-type': 'text/html' } });
  }
  if (path === '/_workspace/api/all' && req.method === 'GET') {
    const raw = Number(url.searchParams.get('limit') ?? 100);
    const limit = Number.isFinite(raw) ? Math.max(1, Math.min(1000, raw)) : 100;
    return json({ enabled: getMemoryDb() !== null, limit, tables: dumpAll(limit) });
  }
  // S2 (v0.16.0): the read-only view stays under LUNA_VIEWER, but the MUTATING
  // routes (reset/edit) require an explicit LUNA_DEV_TOOLS=1 — so even on-host
  // they are not a stray-click data-wipe, and (with the loopback bind) never an
  // off-host one.
  if (path === '/_workspace/api/reset' && req.method === 'POST') {
    if (Bun.env['LUNA_DEV_TOOLS'] !== '1') {
      return json({ error: 'mutating routes require LUNA_DEV_TOOLS=1' }, 403);
    }
    const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
    if (!body.confirm) return json({ error: 'confirm:true required' }, 400);
    return json({ ok: true, cleared: resetData() });
  }
  if (path === '/_workspace/api/edit' && req.method === 'POST') {
    if (Bun.env['LUNA_DEV_TOOLS'] !== '1') {
      return json({ error: 'mutating routes require LUNA_DEV_TOOLS=1' }, 403);
    }
    const db = getMemoryDb();
    if (!db) return json({ error: 'no db' }, 400);
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      table?: string;
      rowid?: number;
      column?: string;
      value?: unknown;
    };
    const { action, table, rowid, column } = body;
    if (!table || !tableNames().includes(table)) return json({ error: 'unknown table' }, 400);
    if (typeof rowid !== 'number') return json({ error: 'rowid required' }, 400);
    try {
      if (action === 'delete') {
        const r = db.prepare(`DELETE FROM "${table}" WHERE rowid = ?`).run(rowid);
        return json({ ok: true, changes: r.changes });
      }
      if (action === 'update') {
        const cols = (
          db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
        ).map((c) => c.name);
        if (!column || !cols.includes(column)) return json({ error: 'unknown column' }, 400);
        const r = db
          .prepare(`UPDATE "${table}" SET "${column}" = ? WHERE rowid = ?`)
          .run(body.value as never, rowid);
        return json({ ok: true, changes: r.changes });
      }
      return json({ error: 'unknown action' }, 400);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  return new Response('not found', { status: 404 });
}
