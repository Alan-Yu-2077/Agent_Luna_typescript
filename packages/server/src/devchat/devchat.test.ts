import { describe, expect, test } from 'bun:test';
import { devChatHandler } from './devchat';

describe('devChatHandler', () => {
  test('GET /_chat returns the chat page', async () => {
    const res = devChatHandler(new Request('http://x/_chat'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get('content-type')).toContain('text/html');
    const body = await res!.text();
    expect(body).toContain('Dev Chat');
    expect(body).toContain('chat.send');
  });

  test('non-/_chat paths fall through (null)', () => {
    expect(devChatHandler(new Request('http://x/'))).toBeNull();
    expect(devChatHandler(new Request('http://x/_trace'))).toBeNull();
  });
});
