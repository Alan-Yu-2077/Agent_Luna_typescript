import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { stageWebAssets, type StageFs } from './stageAssets';

function fakeFs(present: Set<string>) {
  const copiedFiles: Array<[string, string]> = [];
  const copiedDirs: Array<[string, string]> = [];
  const mkdirs: string[] = [];
  const fs: StageFs = {
    exists: (p) => present.has(p),
    mkdirp: (p) => mkdirs.push(p),
    copyFile: (from, to) => copiedFiles.push([from, to]),
    copyDir: (from, to) => copiedDirs.push([from, to]),
  };
  return { fs, copiedFiles, copiedDirs, mkdirs };
}

const PUB = '/w/public';
const DIST = '/w/dist';

describe('stageWebAssets (v0.38.1 portable build)', () => {
  test('copies the cubism core into dist and mkdirs dist first', () => {
    const { fs, copiedFiles, mkdirs } = fakeFs(new Set());
    stageWebAssets(PUB, DIST, fs);
    expect(mkdirs).toEqual([DIST]);
    expect(copiedFiles).toEqual([
      [join(PUB, 'live2dcubismcore.min.js'), join(DIST, 'live2dcubismcore.min.js')],
    ]);
  });

  test('models tree is copied when present', () => {
    const { fs, copiedDirs } = fakeFs(new Set([join(PUB, 'models')]));
    stageWebAssets(PUB, DIST, fs);
    expect(copiedDirs).toEqual([[join(PUB, 'models'), join(DIST, 'models')]]);
  });

  test('missing models tree is optional — no copy, no throw (the old `|| true`)', () => {
    const { fs, copiedDirs } = fakeFs(new Set());
    expect(() => stageWebAssets(PUB, DIST, fs)).not.toThrow();
    expect(copiedDirs).toEqual([]);
  });
});
