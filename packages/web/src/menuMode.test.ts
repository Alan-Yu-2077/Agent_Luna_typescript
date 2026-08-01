import { describe, expect, test } from 'bun:test';
import { menuEnabled } from './menuMode';

const store = (m: Record<string, string>): Pick<Storage, 'getItem'> => ({ getItem: (k) => m[k] ?? null });

describe('menuEnabled — who gets the lobby (v0.44.0)', () => {
  test('the normal window does', () => {
    expect(menuEnabled({ search: '', storage: store({}), agentOnly: false })).toBe(true);
    expect(menuEnabled({ search: '?ws=8888', storage: store({}), agentOnly: false })).toBe(true);
  });

  // M12: every other mode keeps today's behaviour byte for byte. `?setup` / `?workbench` never even
  // reach this decision (they early-return first); these are the two that do and must say no.
  test('pet and agent-only boot direct, exactly as today', () => {
    expect(menuEnabled({ search: '?pet=1', storage: store({}), agentOnly: false })).toBe(false);
    expect(menuEnabled({ search: '?pet', storage: store({}), agentOnly: false })).toBe(false);
    expect(menuEnabled({ search: '', storage: store({}), agentOnly: true })).toBe(false);
  });

  test('luna:menu=0 is the escape hatch, ?menu=0 the query twin the smoke rides', () => {
    expect(menuEnabled({ search: '', storage: store({ 'luna:menu': '0' }), agentOnly: false })).toBe(false);
    expect(menuEnabled({ search: '?menu=0', storage: store({}), agentOnly: false })).toBe(false);
    // Any other stored value means on — absent means on, same as every proven feature flag.
    expect(menuEnabled({ search: '', storage: store({ 'luna:menu': '1' }), agentOnly: false })).toBe(true);
  });

  test('no storage at all still gets the menu', () => {
    expect(menuEnabled({ search: '', storage: null, agentOnly: false })).toBe(true);
  });
});
