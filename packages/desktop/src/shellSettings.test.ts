import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readShellSettings, writeShellSettings } from './shellSettings';

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), 'luna-shell-settings-'));
}

describe('shellSettings', () => {
  test('missing file → empty settings', () => {
    expect(readShellSettings(freshDir())).toEqual({});
  });

  test('write → read round-trips petMode', () => {
    const dir = freshDir();
    writeShellSettings(dir, { petMode: true });
    expect(readShellSettings(dir)).toEqual({ petMode: true });
    writeShellSettings(dir, { petMode: false });
    expect(readShellSettings(dir)).toEqual({ petMode: false });
  });

  test('corrupt JSON degrades to empty, next write heals', () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'settings.json'), '{not json');
    expect(readShellSettings(dir)).toEqual({});
    writeShellSettings(dir, { petMode: true });
    expect(readShellSettings(dir)).toEqual({ petMode: true });
  });

  test('non-boolean petMode is ignored', () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ petMode: 'yes' }));
    expect(readShellSettings(dir)).toEqual({});
    writeFileSync(join(dir, 'settings.json'), JSON.stringify([1, 2]));
    expect(readShellSettings(dir)).toEqual({});
  });
});
