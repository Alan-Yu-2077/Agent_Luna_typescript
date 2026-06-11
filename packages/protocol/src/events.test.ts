import { describe, expect, test } from 'bun:test';
import { ClientEvent, ServerEvent } from './events';

describe('ClientEvent', () => {
  test('parses a valid ping', () => {
    const result = ClientEvent.safeParse({ type: 'ping', seq: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('ping');
      expect(result.data.seq).toBe(0);
    }
  });

  test('rejects ping with negative seq', () => {
    const result = ClientEvent.safeParse({ type: 'ping', seq: -1 });
    expect(result.success).toBe(false);
  });

  test('rejects ping with float seq', () => {
    const result = ClientEvent.safeParse({ type: 'ping', seq: 1.5 });
    expect(result.success).toBe(false);
  });

  test('rejects unknown event type', () => {
    const result = ClientEvent.safeParse({ type: 'unknown', seq: 1 });
    expect(result.success).toBe(false);
  });

  test('rejects missing type field', () => {
    const result = ClientEvent.safeParse({ seq: 1 });
    expect(result.success).toBe(false);
  });
});

describe('ServerEvent', () => {
  test('parses a valid pong', () => {
    const result = ServerEvent.safeParse({
      type: 'pong',
      seq: 5,
      server_time_ms: 1717000000000,
    });
    expect(result.success).toBe(true);
  });

  test('parses an error event', () => {
    const result = ServerEvent.safeParse({
      type: 'error',
      code: 'invalid_event',
      message: 'bad input',
    });
    expect(result.success).toBe(true);
  });

  test('rejects pong with negative server_time_ms', () => {
    const result = ServerEvent.safeParse({
      type: 'pong',
      seq: 1,
      server_time_ms: -1,
    });
    expect(result.success).toBe(false);
  });
});
