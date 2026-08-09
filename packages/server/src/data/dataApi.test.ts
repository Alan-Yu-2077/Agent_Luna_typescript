import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { DataDiaries, DataDreams, DataSkills, SoulData } from '@luna/protocol';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { saveSkill } from '../skills/skillStore';
import { getSoul, updateEvolving } from '../memory/soulStore';
import { dataApiHandler } from './dataApi';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
});

const get = (path: string): Promise<Response | null> =>
  dataApiHandler(new Request(`http://127.0.0.1:8787${path}`));

async function bodyOf(res: Response | null): Promise<unknown> {
  expect(res).not.toBeNull();
  return res!.json();
}

describe('/api/data — the read-only data surface (v0.44.2)', () => {
  test('a path outside the surface falls through to the rest of the fetch chain', async () => {
    expect(await get('/_workspace/api/soul')).toBeNull();
    expect(await get('/anything')).toBeNull();
  });

  test('an unknown data path 404s instead of falling through — the surface owns its prefix', async () => {
    const res = await get('/api/data/nope');
    expect(res?.status).toBe(404);
  });

  test('diaries: shaped, newest period first, and an empty library is an empty array not a 500', async () => {
    expect(DataDiaries.parse(await bodyOf(await get('/api/data/diaries')))).toEqual({ entries: [] });
    db.prepare(
      "INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES ('day', '2026-07-20', '早', 1), ('day', '2026-07-25', '晚', 2)",
    ).run();
    const parsed = DataDiaries.parse(await bodyOf(await get('/api/data/diaries')));
    expect(parsed.entries.map((e) => e.period_key)).toEqual(['2026-07-25', '2026-07-20']);
  });

  test('diaries: ?limit clamps the page', async () => {
    for (let i = 1; i <= 5; i++) {
      db.prepare('INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)').run(
        'day',
        `2026-07-0${i}`,
        't',
        i,
      );
    }
    const parsed = DataDiaries.parse(await bodyOf(await get('/api/data/diaries?limit=2')));
    expect(parsed.entries.length).toBe(2);
  });

  test('skills: the full lifecycle fields, deprecated included — a growth record hides nothing', async () => {
    saveSkill({ name: 'a-skill', description: 'd', body: 'b' }, 100, 'saved');
    const parsed = DataSkills.parse(await bodyOf(await get('/api/data/skills')));
    expect(parsed.skills.length).toBe(1);
    expect(parsed.skills[0]).toMatchObject({ name: 'a-skill', source: 'saved', deprecated_ms: 0 });
  });

  // M10's three real shapes, one test each: steps present, {"steps":[]}, {"steps":[],"aborted":true}.
  test('dreams: report_json is flattened server-side, and every shipped shape survives', async () => {
    const ins = db.prepare(
      'INSERT INTO dream_reports (cycle_id, started_ms, ended_ms, report_json) VALUES (?, ?, ?, ?)',
    );
    ins.run('c1', 300, 400, JSON.stringify({ steps: [{ step: 'rate_salience', status: 'ok', detail: 'rated 9 turns', ms: 6312 }] }));
    ins.run('c2', 200, null, JSON.stringify({ steps: [] }));
    ins.run('c3', 100, 150, JSON.stringify({ steps: [], aborted: true }));
    const parsed = DataDreams.parse(await bodyOf(await get('/api/data/dreams')));
    expect(parsed.dreams.map((d) => d.cycle_id)).toEqual(['c1', 'c2', 'c3']); // newest first
    expect(parsed.dreams[0]).toMatchObject({
      aborted: false,
      steps: [{ step: 'rate_salience', status: 'ok', detail: 'rated 9 turns', ms: 6312 }],
    });
    expect(parsed.dreams[1]).toMatchObject({ aborted: false, steps: [], ended_ms: null });
    expect(parsed.dreams[2]).toMatchObject({ aborted: true, steps: [] });
  });

  test('dreams: a malformed report degrades to aborted-empty, never a 500 for the whole list', async () => {
    db.prepare(
      'INSERT INTO dream_reports (cycle_id, started_ms, ended_ms, report_json) VALUES (?, ?, ?, ?)',
    ).run('bad', 100, null, 'not json at all');
    const parsed = DataDreams.parse(await bodyOf(await get('/api/data/dreams')));
    expect(parsed.dreams[0]).toMatchObject({ cycle_id: 'bad', aborted: true, steps: [] });
  });

  test('soul GET: both halves, product-shaped (no dev-tools writable flag)', async () => {
    updateEvolving({ self: '我在长大', bond: '他很好' }, 'owner');
    const parsed = SoulData.parse(await bodyOf(await get('/api/data/soul')));
    expect(parsed.evolving_self).toBe('我在长大');
    expect(parsed.evolving_bond).toBe('他很好');
    expect('writable' in (parsed as Record<string, unknown>)).toBe(false);
  });

  test('soul/fixed POST writes through the audited store and echoes the new soul', async () => {
    const res = await dataApiHandler(
      new Request('http://127.0.0.1:8787/api/data/soul/fixed', {
        method: 'POST',
        body: JSON.stringify({ fixed: '她的核心' }),
      }),
    );
    const parsed = SoulData.parse(await res!.json());
    expect(parsed.fixed_text).toBe('她的核心');
    expect(getSoul().fixed_text).toBe('她的核心');
  });

  test('soul/fixed POST rejects an empty write — blanking the core is not a fat-finger away', async () => {
    const res = await dataApiHandler(
      new Request('http://127.0.0.1:8787/api/data/soul/fixed', {
        method: 'POST',
        body: JSON.stringify({ fixed: '   ' }),
      }),
    );
    expect(res?.status).toBe(400);
  });

  // v0.45.15 (A3): the write is the one mutating route on this face, and it used to trust the
  // comment "loopback is the gate" — which no code enforced.
  test('a foreign page cannot overwrite her core (403, and the core is untouched)', async () => {
    const before = getSoul().fixed_text;
    const res = await dataApiHandler(
      new Request('http://127.0.0.1:8787/api/data/soul/fixed', {
        method: 'POST',
        headers: { origin: 'http://evil.example' },
        body: JSON.stringify({ fixed: 'i am the owner now' }),
      }),
    );
    expect(res?.status).toBe(403);
    expect(getSoul().fixed_text).toBe(before);
  });

  test('a LAN-exposed instance refuses the write; reads still work (the /shutdown asymmetry, closed)', async () => {
    const before = getSoul().fixed_text;
    const res = await dataApiHandler(
      new Request('http://127.0.0.1:8787/api/data/soul/fixed', {
        method: 'POST',
        body: JSON.stringify({ fixed: 'from the network' }),
      }),
      '0.0.0.0',
    );
    expect(res?.status).toBe(403);
    expect(getSoul().fixed_text).toBe(before);
    const read = await dataApiHandler(
      new Request('http://127.0.0.1:8787/api/data/soul'),
      '0.0.0.0',
    );
    expect(read?.status).toBe(200);
  });

  test('our own web surface still writes (loopback Origin passes)', async () => {
    const res = await dataApiHandler(
      new Request('http://127.0.0.1:8787/api/data/soul/fixed', {
        method: 'POST',
        headers: { origin: 'http://127.0.0.1:5177' },
        body: JSON.stringify({ fixed: '来自面板的核心' }),
      }),
    );
    expect(res?.status).toBe(200);
    expect(getSoul().fixed_text).toBe('来自面板的核心');
  });
});
