import { describe, expect, test } from 'bun:test';
import { unwrapGatewayInput } from './anthropic';

describe('unwrapGatewayInput (proxy-gateway _noargs artifact)', () => {
  test('unwraps {"_noargs": "<json object string>"} to the real object', () => {
    const wrapped = {
      _noargs: '{"action": "add", "category": "core_facts", "text": "用户的名字是 Sam"}',
    };
    expect(unwrapGatewayInput(wrapped)).toEqual({
      action: 'add',
      category: 'core_facts',
      text: '用户的名字是 Sam',
    });
  });

  test('non-JSON raw text passes through unchanged (validation rejects it later)', () => {
    const wrapped = { _noargs: '用户名字是 Sam，正在开发 Agent_Luna' };
    expect(unwrapGatewayInput(wrapped)).toBe(wrapped);
  });

  test('JSON that is not an object (string/array/number) passes through unchanged', () => {
    expect(unwrapGatewayInput({ _noargs: '"just a string"' })).toEqual({
      _noargs: '"just a string"',
    });
    expect(unwrapGatewayInput({ _noargs: '[1,2]' })).toEqual({ _noargs: '[1,2]' });
  });

  test('normal inputs untouched', () => {
    const normal = { path: 'README.md' };
    expect(unwrapGatewayInput(normal)).toBe(normal);
    expect(unwrapGatewayInput({})).toEqual({});
    expect(unwrapGatewayInput(null)).toBe(null);
    // _noargs alongside other keys is not the artifact shape
    const mixed = { _noargs: '{}', other: 1 };
    expect(unwrapGatewayInput(mixed)).toBe(mixed);
  });
});
