import { afterEach, describe, expect, test } from 'bun:test';
import { resolveModel } from './registry';

afterEach(() => {
  delete Bun.env['LUNA_MODELS_JSON'];
});

describe('resolveModel (v0.23.3 model registry)', () => {
  test('claude-* → anthropic', () => {
    expect(resolveModel('claude-opus-4-8').protocol).toBe('anthropic');
  });
  test('gpt-4o → openai (default token param / system role)', () => {
    const e = resolveModel('gpt-4o');
    expect(e.protocol).toBe('openai');
    expect(e.tokenParam).toBeUndefined();
    expect(e.systemRole).toBeUndefined();
  });
  test('gpt-5* → openai + max_completion_tokens', () => {
    expect(resolveModel('gpt-5-turbo').tokenParam).toBe('max_completion_tokens');
  });
  test('o-series → openai + developer role + reasoning + max_completion_tokens', () => {
    const e = resolveModel('o3-mini');
    expect(e.protocol).toBe('openai');
    expect(e.systemRole).toBe('developer');
    expect(e.reasoning).toBe(true);
    expect(e.tokenParam).toBe('max_completion_tokens');
  });
  test('an unknown model id → safe anthropic default', () => {
    expect(resolveModel('mystery-model-9000').protocol).toBe('anthropic');
  });
  test('LUNA_MODELS_JSON override is added and beats a built-in (overrides matched first)', () => {
    Bun.env['LUNA_MODELS_JSON'] = JSON.stringify([
      { id: 'qwen', protocol: 'openai', tokenParam: 'max_tokens' },
      { id: 'claude-x', protocol: 'openai' },
    ]);
    expect(resolveModel('qwen2.5-72b').protocol).toBe('openai'); // a brand-new model, no code change
    expect(resolveModel('claude-x-1').protocol).toBe('openai'); // overrides the built-in `claude`→anthropic
    expect(resolveModel('claude-opus-4-8').protocol).toBe('anthropic'); // unaffected
  });
  test('invalid LUNA_MODELS_JSON is ignored (falls back to built-ins)', () => {
    Bun.env['LUNA_MODELS_JSON'] = '{not json';
    expect(resolveModel('claude-opus-4-8').protocol).toBe('anthropic');
    Bun.env['LUNA_MODELS_JSON'] = JSON.stringify([{ id: 'x', protocol: 'bogus' }]);
    expect(resolveModel('gpt-4o').protocol).toBe('openai'); // bad entry shape → ignored
  });
});
