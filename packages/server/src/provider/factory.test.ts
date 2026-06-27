import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import { OpenAIProvider } from './openai/openaiProvider';
import { providerFor } from './factory';
import type { ProviderCapabilities } from './capabilities';

const CAP_KEYS: (keyof ProviderCapabilities)[] = [
  'thinking',
  'promptCache',
  'interleavedToolStreaming',
  'toolUse',
  'systemRole',
  'maxOutputTokens',
];

describe('providerFor (provider factory, v0.23.0)', () => {
  let savedProvider: string | undefined;
  let savedKey: string | undefined;
  beforeEach(() => {
    savedProvider = Bun.env['LUNA_PROVIDER'];
    savedKey = Bun.env['ANTHROPIC_API_KEY'];
    Bun.env['ANTHROPIC_API_KEY'] = 'test-key'; // the Anthropic SDK requires a key at construction
  });
  afterEach(() => {
    if (savedProvider === undefined) delete Bun.env['LUNA_PROVIDER'];
    else Bun.env['LUNA_PROVIDER'] = savedProvider;
    if (savedKey === undefined) delete Bun.env['ANTHROPIC_API_KEY'];
    else Bun.env['ANTHROPIC_API_KEY'] = savedKey;
  });

  test('defaults to AnthropicProvider when LUNA_PROVIDER is unset', () => {
    delete Bun.env['LUNA_PROVIDER'];
    expect(providerFor()).toBeInstanceOf(AnthropicProvider);
  });

  test('LUNA_PROVIDER=anthropic → AnthropicProvider', () => {
    Bun.env['LUNA_PROVIDER'] = 'anthropic';
    expect(providerFor()).toBeInstanceOf(AnthropicProvider);
  });

  test('LUNA_PROVIDER=openai → OpenAIProvider (v0.23.1)', () => {
    Bun.env['LUNA_PROVIDER'] = 'openai';
    expect(providerFor()).toBeInstanceOf(OpenAIProvider);
  });

  test('an unknown LUNA_PROVIDER fails fast', () => {
    Bun.env['LUNA_PROVIDER'] = 'gemini';
    expect(() => providerFor()).toThrow(/unknown LUNA_PROVIDER/);
  });

  test('the returned provider exposes the capability descriptor + the Provider methods', () => {
    delete Bun.env['LUNA_PROVIDER'];
    const p = providerFor();
    for (const k of CAP_KEYS) expect(p.capabilities[k]).toBeDefined();
    expect(typeof p.chatStream).toBe('function');
    expect(typeof p.complete).toBe('function');
  });

  test('apiKey is threaded to the provider without error', () => {
    delete Bun.env['LUNA_PROVIDER'];
    expect(() => providerFor({ apiKey: 'summarizer-key' })).not.toThrow();
  });

  test('AnthropicProvider and MockProvider both declare every capability field', () => {
    const providers = [new AnthropicProvider(), new MockProvider([])];
    for (const p of providers) {
      for (const k of CAP_KEYS) expect(p.capabilities[k]).toBeDefined();
      expect(typeof p.capabilities.maxOutputTokens).toBe('number');
    }
  });
});
