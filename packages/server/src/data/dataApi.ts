import {
  DataDiaries,
  DataDreams,
  DataSkills,
  SoulData,
  type DreamRecord,
  type DreamStep,
} from '@luna/protocol';
import { getMemoryDb } from '../memory/sessionStore';
import { isLoopbackHost } from '../shutdownRoute';
import { wsOriginAllowed } from '../wsOrigin';
import { listSkills } from '../skills/skillStore';
import { getSoul, updateFixedCore } from '../memory/soulStore';

// v0.44.2 — the read-only data surface. Diary, skills and dream reports lived only in SQLite with
// zero front-end doors; these endpoints are the doors. PRODUCT surface, not a debug one: mounted
// BEFORE the `viewerEnabled` gate in main.ts (M2), with the loopback bind as the security boundary —
// the same principle the WS itself rides (S1). Read-only except `soul/fixed`, which is an existing
// owner capability (the workspace editor) re-addressed; Luna's own `self-edit` tool remains unable
// to touch the fixed core — that firewall lives in the tool, not in this route.
//
// Every payload is zod-parsed on the way OUT against the same schema the web parses IN — drift
// between the two ends is a loud failure on whichever side moved, never a silent shape change.

const DEFAULT_LIMIT = 1000; // her scale: 28 diaries, 3 skills, 59 dreams — "all of it" is small

function limitOf(url: URL): number {
  const raw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, DEFAULT_LIMIT) : DEFAULT_LIMIT;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// `report_json.steps[]` flattened server-side; the client never sees the raw string (M10). Three
// real shapes exist in the table: steps present, `{"steps":[]}` and `{"steps":[],"aborted":true}` —
// and a malformed row must degrade to an aborted-empty record, never take the whole list down.
function flattenReport(raw: string): { steps: DreamStep[]; aborted: boolean } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { steps: [], aborted: true };
    const obj = parsed as { steps?: unknown; aborted?: unknown };
    const steps: DreamStep[] = [];
    if (Array.isArray(obj.steps)) {
      for (const s of obj.steps) {
        if (typeof s !== 'object' || s === null) continue;
        const step = s as Record<string, unknown>;
        steps.push({
          step: typeof step['step'] === 'string' ? step['step'] : 'unknown',
          status: typeof step['status'] === 'string' ? step['status'] : 'unknown',
          detail: typeof step['detail'] === 'string' ? step['detail'] : '',
          ms: typeof step['ms'] === 'number' ? step['ms'] : 0,
        });
      }
    }
    return { steps, aborted: obj.aborted === true };
  } catch {
    return { steps: [], aborted: true };
  }
}

// v0.45.15 (A3): the two conditions a soul write must satisfy — the server is loopback-bound
// (parity with /shutdown) AND the caller is not a foreign web page (absent Origin = a native
// client or our own desktop forward; loopback Origin = our own web surface).
export function soulWriteAllowed(origin: string | null, bindHost: string): boolean {
  if (!isLoopbackHost(bindHost)) return false;
  return wsOriginAllowed(origin);
}

export async function dataApiHandler(
  req: Request,
  bindHost: string = Bun.env['LUNA_BIND_HOST'] ?? '127.0.0.1',
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith('/api/data/')) return null;

  const db = getMemoryDb();

  if (path === '/api/data/diaries' && req.method === 'GET') {
    const entries = db
      ? db
          .prepare(
            'SELECT kind, period_key, text, generated_ms FROM diaries ORDER BY period_key DESC LIMIT ?',
          )
          .all(limitOf(url))
      : [];
    return json(DataDiaries.parse({ entries }));
  }

  if (path === '/api/data/skills' && req.method === 'GET') {
    // Deprecated ones included — the skills page is a growth record, and a retired skill is part of
    // the growth, not something to hide.
    const skills = listSkills(limitOf(url), true).map((s) => ({
      name: s.name,
      description: s.description,
      body: s.body,
      used_count: s.used_count,
      last_used_ms: s.last_used_ms,
      verified_ms: s.verified_ms,
      source: s.source,
      deprecated_ms: s.deprecated_ms,
    }));
    return json(DataSkills.parse({ skills }));
  }

  if (path === '/api/data/dreams' && req.method === 'GET') {
    const rows = db
      ? (db
          .prepare(
            'SELECT cycle_id, started_ms, ended_ms, report_json FROM dream_reports ORDER BY started_ms DESC LIMIT ?',
          )
          .all(limitOf(url)) as Array<{
          cycle_id: string;
          started_ms: number;
          ended_ms: number | null;
          report_json: string;
        }>)
      : [];
    const dreams: DreamRecord[] = rows.map((r) => ({
      cycle_id: r.cycle_id,
      started_ms: r.started_ms,
      ended_ms: r.ended_ms,
      ...flattenReport(r.report_json),
    }));
    return json(DataDreams.parse({ dreams }));
  }

  if (path === '/api/data/soul' && req.method === 'GET') {
    const s = getSoul();
    return json(
      SoulData.parse({
        fixed_text: s.fixed_text,
        evolving_self: s.evolving_self,
        evolving_bond: s.evolving_bond,
        updated_ms: s.updated_ms,
      }),
    );
  }

  // The one write: the fixed core, an owner capability since v0.31.0 (the workspace editor), now
  // addressable without the dev-tools env. Luna's self-edit tool still cannot reach the fixed core
  // — that firewall is in the tool layer and this route does not change it.
  //
  // v0.45.15 (A3): "loopback is the gate" was a comment, not code. /shutdown really checks
  // isLoopbackHost(bindHost); this route — which OVERWRITES her soul — checked nothing, so a
  // LAN-exposed instance accepted it from anywhere. And loopback alone never covered the browser
  // case: a page on any site can POST text/plain to 127.0.0.1 with no preflight, so the Origin
  // check (same rule as the WS gate) is what actually closes the CSRF.
  if (path === '/api/data/soul/fixed' && req.method === 'POST') {
    if (!soulWriteAllowed(req.headers.get('origin'), bindHost)) {
      return json({ error: 'forbidden' }, 403);
    }
    if (!db) return json({ error: 'no db' }, 400);
    const body = (await req.json().catch(() => ({}))) as { fixed?: unknown };
    if (typeof body.fixed !== 'string' || body.fixed.trim().length === 0) {
      return json({ error: 'fixed text required' }, 400);
    }
    updateFixedCore(body.fixed);
    const s = getSoul();
    return json(
      SoulData.parse({
        fixed_text: s.fixed_text,
        evolving_self: s.evolving_self,
        evolving_bond: s.evolving_bond,
        updated_ms: s.updated_ms,
      }),
    );
  }

  return json({ error: 'not found' }, 404);
}
