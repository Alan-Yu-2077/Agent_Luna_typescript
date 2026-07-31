import { describe, expect, test } from 'bun:test';
import { debugBridgeEnabled, isWorkbenchMode, workbenchModelUrl } from './workbenchMode';

describe('isWorkbenchMode', () => {
  test('any form of the flag opens the bench', () => {
    expect(isWorkbenchMode('?workbench=1')).toBe(true);
    expect(isWorkbenchMode('?workbench')).toBe(true);
    expect(isWorkbenchMode('?ws=8888&workbench=1')).toBe(true);
  });

  test('the ordinary app is untouched', () => {
    expect(isWorkbenchMode('')).toBe(false);
    expect(isWorkbenchMode('?ws=8888')).toBe(false);
    expect(isWorkbenchMode('?setup=1')).toBe(false);
    // A near-miss must not open a mode that skips the WS and the chat UI entirely.
    expect(isWorkbenchMode('?workbenchy=1')).toBe(false);
  });
});

describe('debugBridgeEnabled', () => {
  test('workbench gets the bridge the console mode already had', () => {
    expect(debugBridgeEnabled('?workbench=1')).toBe(true);
  });

  // v0.43.7 widened this gate; the pre-existing half is loose on purpose and must stay loose.
  test('every ?dev form that worked before still works', () => {
    expect(debugBridgeEnabled('?dev')).toBe(true);
    expect(debugBridgeEnabled('?dev=1')).toBe(true);
    expect(debugBridgeEnabled('?ws=8888&dev')).toBe(true);
  });

  test('a plain session exposes nothing', () => {
    expect(debugBridgeEnabled('')).toBe(false);
    expect(debugBridgeEnabled('?ws=8888')).toBe(false);
  });
});

describe('workbenchModelUrl', () => {
  test('?model wins so an external browser can point at an installed model', () => {
    expect(workbenchModelUrl('?workbench=1&model=/models/yumi/yumi.model3.json', undefined)).toBe(
      '/models/yumi/yumi.model3.json',
    );
    expect(workbenchModelUrl('?model=/a.json', '/b.json')).toBe('/a.json');
  });

  test('without the override the normal resolution stands', () => {
    expect(workbenchModelUrl('?workbench=1', '/b.json')).toBe('/b.json');
    expect(workbenchModelUrl('?workbench=1&model=', '/b.json')).toBe('/b.json');
    expect(workbenchModelUrl('?workbench=1', undefined)).toBeUndefined();
  });
});
