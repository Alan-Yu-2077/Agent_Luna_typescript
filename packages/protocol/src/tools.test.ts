import { describe, expect, test } from 'bun:test';
import { ToolCall, ToolEvent, ToolName, ToolResult } from './tools';

describe('ToolName', () => {
  test('parses each valid name', () => {
    expect(ToolName.safeParse('time_now').success).toBe(true);
    expect(ToolName.safeParse('read_file').success).toBe(true);
    expect(ToolName.safeParse('remember').success).toBe(true);
  });

  test('rejects unknown name', () => {
    expect(ToolName.safeParse('unknown').success).toBe(false);
  });
});

describe('ToolResult', () => {
  test('parses ok result', () => {
    const r = ToolResult.safeParse({
      kind: 'ok',
      data: { foo: 1 },
      summary: 'did something',
    });
    expect(r.success).toBe(true);
  });

  test('parses err result', () => {
    const r = ToolResult.safeParse({
      kind: 'err',
      code: 'validation_failed',
      message: 'bad input',
      recoverable: true,
    });
    expect(r.success).toBe(true);
  });

  test('rejects err with unknown code', () => {
    expect(
      ToolResult.safeParse({
        kind: 'err',
        code: 'made_up_code',
        message: 'x',
        recoverable: false,
      }).success,
    ).toBe(false);
  });

  test('rejects ok without summary', () => {
    expect(
      ToolResult.safeParse({
        kind: 'ok',
        data: {},
      }).success,
    ).toBe(false);
  });
});

describe('ToolEvent', () => {
  test('parses started event', () => {
    expect(
      ToolEvent.safeParse({
        kind: 'started',
        tool_name: 'time_now',
        call_id: 'c1',
        input: {},
      }).success,
    ).toBe(true);
  });

  test('parses progress event', () => {
    expect(
      ToolEvent.safeParse({
        kind: 'progress',
        tool_name: 'time_now',
        call_id: 'c1',
        payload: { step: 1 },
      }).success,
    ).toBe(true);
  });

  test('parses final event with ok result', () => {
    expect(
      ToolEvent.safeParse({
        kind: 'final',
        tool_name: 'time_now',
        call_id: 'c1',
        result: { kind: 'ok', data: null, summary: 'done' },
      }).success,
    ).toBe(true);
  });

  test('parses final event with err result', () => {
    expect(
      ToolEvent.safeParse({
        kind: 'final',
        tool_name: 'time_now',
        call_id: 'c1',
        result: {
          kind: 'err',
          code: 'timeout',
          message: 'too long',
          recoverable: false,
        },
      }).success,
    ).toBe(true);
  });
});

describe('ToolCall', () => {
  test('parses valid call', () => {
    expect(
      ToolCall.safeParse({
        call_id: 'c1',
        tool_name: 'time_now',
        input: {},
      }).success,
    ).toBe(true);
  });

  test('rejects unknown tool_name', () => {
    expect(
      ToolCall.safeParse({
        call_id: 'c1',
        tool_name: 'fake',
        input: {},
      }).success,
    ).toBe(false);
  });

  test('rejects missing call_id', () => {
    expect(
      ToolCall.safeParse({
        tool_name: 'time_now',
        input: {},
      }).success,
    ).toBe(false);
  });
});
