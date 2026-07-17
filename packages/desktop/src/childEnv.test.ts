import { describe, expect, test } from 'bun:test';
import { childPathValue, pathKeyFor, serverBinName } from './childEnv';

describe('serverBinName', () => {
  test('.exe on win32 only', () => {
    expect(serverBinName('win32')).toBe('luna-server.exe');
    expect(serverBinName('darwin')).toBe('luna-server');
    expect(serverBinName('linux')).toBe('luna-server');
  });
});

describe('pathKeyFor', () => {
  test('darwin/linux → PATH', () => {
    expect(pathKeyFor('darwin', { PATH: '/usr/bin' })).toBe('PATH');
    expect(pathKeyFor('linux', { PATH: '/usr/bin' })).toBe('PATH');
  });
  test('win32 → the existing case-variant key (Path), by case-insensitive match', () => {
    expect(pathKeyFor('win32', { Path: 'C:\\Windows' })).toBe('Path');
    expect(pathKeyFor('win32', { PATH: 'C:\\Windows' })).toBe('PATH');
  });
  test('win32 with no path key → defaults to Path', () => {
    expect(pathKeyFor('win32', { FOO: 'bar' })).toBe('Path');
  });
});

describe('childPathValue', () => {
  test('darwin: ffmpeg dir prepended, ":" join, homebrew dirs appended', () => {
    const v = childPathValue('darwin', { PATH: '/usr/bin:/bin' }, '/opt/homebrew/bin');
    expect(v).toBe('/opt/homebrew/bin:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin');
  });
  test('win32: ";" join, NO unix dirs, reads the Path key', () => {
    const v = childPathValue('win32', { Path: 'C:\\Windows;C:\\Windows\\System32' }, 'C:\\ff\\bin');
    expect(v).toBe('C:\\ff\\bin;C:\\Windows;C:\\Windows\\System32');
    expect(v).not.toContain('/opt/homebrew/bin');
    expect(v).not.toContain(':/'); // no unix-delimiter fusion
  });
  test('no ffmpeg dir → parent PATH leads; linux gets no extra dirs (darwin-only)', () => {
    expect(childPathValue('win32', { Path: 'C:\\Windows' }, null)).toBe('C:\\Windows');
    expect(childPathValue('linux', { PATH: '/usr/bin' }, null)).toBe('/usr/bin');
  });
  test('empty parent PATH is dropped, not left as an empty segment', () => {
    expect(childPathValue('win32', {}, 'C:\\ff')).toBe('C:\\ff');
  });
});
