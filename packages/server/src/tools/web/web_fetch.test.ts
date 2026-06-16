import { afterEach, describe, expect, test } from 'bun:test';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { InternalEvent, ToolContext } from '../defineTool';
import { webFetchTool, setWebFetcher } from './web_fetch';
import { SafeFetchError, type SafeFetchResult } from './safeFetch';
import { withWebFetch } from '../registry';
import { resolveInWorkspace } from '../workspace';

function ctx(signal?: AbortSignal): ToolContext {
  return { sessionId: 's', callId: 'c', abortSignal: signal ?? new AbortController().signal };
}

async function run(
  input: Record<string, unknown>,
  c: ToolContext,
): Promise<InternalEvent<unknown>[]> {
  const events: InternalEvent<unknown>[] = [];
  for await (const e of webFetchTool.execute(input, c)) events.push(e);
  return events;
}

const PAGE = `<!doctype html><html><head><title>Doc Title</title></head><body>
<article><h1>Heading</h1><p>This is the article body with enough words to be the main content the readability extractor will lock on to as the primary node of the page.</p></article>
</body></html>`;

function okFetcher(finalUrl = 'http://example.com/p'): SafeFetchResult {
  return { status: 200, contentType: 'text/html', body: PAGE, finalUrl };
}

afterEach(() => {
  setWebFetcher(null);
  delete Bun.env['LUNA_WEB_FETCH'];
});

describe('webFetchTool — happy path + envelope', () => {
  test('extracts the page and wraps content in <untrusted_content>', async () => {
    setWebFetcher(async () => okFetcher('http://example.com/final'));
    const events = await run({ url: 'http://example.com/p' }, ctx());

    expect(events[0]).toEqual({ kind: 'progress', payload: { note: '正在读这一页…' } });
    const ok = events.find((e) => e.kind === 'ok');
    expect(ok).toBeDefined();
    const data = (ok as { kind: 'ok'; data: Record<string, unknown> }).data;
    expect(data.final_url).toBe('http://example.com/final');
    expect(data.title).toBe('Doc Title');
    expect(String(data.content)).toContain('<untrusted_content source="http://example.com/final">');
    expect(String(data.content)).toContain('article body');
    expect(String(data.content)).toContain('</untrusted_content>');
  });

  test('summarize + proactiveRisk', () => {
    expect(webFetchTool.proactiveRisk).toBe('safe');
    const line = webFetchTool.summarize({
      url: 'u',
      final_url: 'http://x/y',
      title: 'T',
      content: 'abcde',
      truncated: false,
      fetched_ms: 0,
    });
    expect(line).toContain('read T (http://x/y)');
    expect(line).toContain('5 chars');
  });
});

describe('webFetchTool — soft-fail (no throw escapes)', () => {
  test('an SSRF block is a recoverable err carrying the code', async () => {
    setWebFetcher(async () => {
      throw new SafeFetchError('blocked_url', 'host resolves to blocked ip 10.0.0.1');
    });
    const events = await run({ url: 'http://internal/' }, ctx());
    const err = events.find((e) => e.kind === 'err');
    expect(err).toMatchObject({ kind: 'err', code: 'execution_exception', recoverable: true });
    expect((err as { message: string }).message).toContain('blocked_url');
  });

  test('a generic throw is caught as a recoverable err, never escapes', async () => {
    setWebFetcher(async () => {
      throw new Error('socket hang up');
    });
    let threw = false;
    let events: InternalEvent<unknown>[] = [];
    try {
      events = await run({ url: 'http://example.com/' }, ctx());
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(events.find((e) => e.kind === 'err')).toMatchObject({ recoverable: true });
  });

  test('pre-aborted signal → prompt aborted err, fetcher never called', async () => {
    let called = false;
    setWebFetcher(async () => {
      called = true;
      return okFetcher();
    });
    const ac = new AbortController();
    ac.abort();
    const events = await run({ url: 'http://example.com/' }, ctx(ac.signal));
    expect(events.find((e) => e.kind === 'err')).toMatchObject({ code: 'aborted' });
    expect(called).toBe(false);
  });
});

describe('webFetchTool — gating + firewall', () => {
  test('withWebFetch mounts web_fetch only under LUNA_WEB_FETCH=1', () => {
    Bun.env['LUNA_WEB_FETCH'] = '1';
    expect(withWebFetch({}).web_fetch).toBeDefined();
    Bun.env['LUNA_WEB_FETCH'] = '0';
    expect(withWebFetch({}).web_fetch).toBeUndefined();
  });

  test('safeFetch.ts is in the evaluator firewall (Luna cannot write the SSRF guard)', () => {
    const guard = realpathSync(join(import.meta.dir, 'safeFetch.ts'));
    const r = resolveInWorkspace(guard, 'write');
    expect(r.ok).toBe(false);
    // read is allowed (she can inspect it, per the DGM safeguard)
    expect(resolveInWorkspace(guard, 'read').ok).toBe(true);
  });
});
