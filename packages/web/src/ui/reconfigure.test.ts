import { describe, expect, test } from 'bun:test';
import { reconfigureVisible } from './reconfigure';

describe('reconfigureVisible (v0.35.6)', () => {
  test('shows on the reconnect loop — the backend died or never came up', () => {
    expect(reconfigureVisible('closed', true)).toBe(true);
  });
  test('hidden when healthy AND during the initial connect (no flash on a good boot)', () => {
    expect(reconfigureVisible('open', true)).toBe(false);
    expect(reconfigureVisible('connecting', true)).toBe(false);
  });
  test('never in a plain browser (no shell bridge)', () => {
    expect(reconfigureVisible('closed', false)).toBe(false);
  });
});
