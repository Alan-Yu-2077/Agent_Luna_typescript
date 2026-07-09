import { describe, expect, test } from 'bun:test';
import { resolveModelUrl } from './resolveModelUrl';

const store = (v: string | null): Pick<Storage, 'getItem'> => ({ getItem: () => v });

describe('resolveModelUrl', () => {
  test('localStorage override wins', () => {
    const url = resolveModelUrl({ storage: store('/models/hana/hana.model3.json'), config: { modelUrl: '/other.json' } });
    expect(url).toBe('/models/hana/hana.model3.json');
  });

  test('falls back to lunaConfig.modelUrl when storage is empty', () => {
    expect(resolveModelUrl({ storage: store(null), config: { modelUrl: '/injected.json' } })).toBe('/injected.json');
  });

  test('blank storage value is ignored (falls through to config)', () => {
    expect(resolveModelUrl({ storage: store('   '), config: { modelUrl: '/injected.json' } })).toBe('/injected.json');
  });

  test('undefined when neither is set — the default BYO empty state', () => {
    expect(resolveModelUrl({ storage: store(null), config: {} })).toBeUndefined();
    expect(resolveModelUrl({ storage: null, config: undefined })).toBeUndefined();
  });

  test('blank config value is treated as unset', () => {
    expect(resolveModelUrl({ storage: store(null), config: { modelUrl: '' } })).toBeUndefined();
  });
});
