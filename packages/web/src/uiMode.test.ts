import { describe, expect, test } from 'bun:test';
import { resolveUiMode } from './uiMode';

// v0.39.2: which front end to build. luna.env is the source of truth (the wizard writes it); the
// query param is a browser-only preview hatch and localStorage a per-browser override, both matching
// the precedence resolveModelUrl / resolveTtsBackend already established.
describe('resolveUiMode', () => {
  const store = (v: string | null): Pick<Storage, 'getItem'> => ({ getItem: () => v });

  test('defaults to the full companion — nothing configured must not silently strip the avatar', () => {
    expect(resolveUiMode({ storage: null, search: '' })).toBe('full');
    expect(resolveUiMode({ storage: null, config: {}, search: '' })).toBe('full');
  });

  test('the desktop-injected config decides', () => {
    expect(resolveUiMode({ storage: null, config: { uiMode: 'agent' }, search: '' })).toBe('agent');
    expect(resolveUiMode({ storage: null, config: { uiMode: 'full' }, search: '' })).toBe('full');
  });

  test('an unrecognised config value falls back to full rather than to a broken front end', () => {
    expect(resolveUiMode({ storage: null, config: { uiMode: 'AGENT' }, search: '' })).toBe('full');
    expect(resolveUiMode({ storage: null, config: { uiMode: '' }, search: '' })).toBe('full');
  });

  test('?agent wins outright — the preview hatch works with no config and no storage', () => {
    expect(resolveUiMode({ storage: store('full'), config: { uiMode: 'full' }, search: '?agent=1' })).toBe('agent');
    expect(resolveUiMode({ storage: null, search: '?agent' })).toBe('agent');
  });

  test('localStorage overrides the config, in both directions', () => {
    expect(resolveUiMode({ storage: store('agent'), config: { uiMode: 'full' }, search: '' })).toBe('agent');
    expect(resolveUiMode({ storage: store('full'), config: { uiMode: 'agent' }, search: '' })).toBe('full');
  });

  test('a junk localStorage value defers to the config instead of overriding it', () => {
    expect(resolveUiMode({ storage: store('yes'), config: { uiMode: 'agent' }, search: '' })).toBe('agent');
  });
});
