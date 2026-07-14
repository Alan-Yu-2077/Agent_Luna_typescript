import { describe, expect, test } from 'bun:test';
import { autoPicksFrom, swapResultText, type PackScan } from './packDrop';

const scan = (o: Partial<PackScan>): PackScan => ({
  gpt: ['/p/a.ckpt'],
  sovits: ['/p/b.pth'],
  refWavs: ['/p/ref.wav'],
  transcripts: [],
  ...o,
});

describe('autoPicksFrom — single-candidate packs auto-pick, ambiguity routes to the wizard', () => {
  test('the bilibili pack shape (one of each) picks itself', () => {
    expect(autoPicksFrom(scan({}))).toEqual({
      gptCkpt: '/p/a.ckpt',
      sovitsPth: '/p/b.pth',
      referenceWav: '/p/ref.wav',
    });
  });
  test('a transcript rides along when present', () => {
    expect(autoPicksFrom(scan({ transcripts: ['/p/ref.txt'] }))?.transcriptTxt).toBe('/p/ref.txt');
  });
  test('multiple candidates → null (the wizard has the picker)', () => {
    expect(autoPicksFrom(scan({ gpt: ['/p/a.ckpt', '/p/c.ckpt'] }))).toBeNull();
    expect(autoPicksFrom(scan({ refWavs: ['/1.wav', '/2.wav'] }))).toBeNull();
  });
  test('a missing essential → null', () => {
    expect(autoPicksFrom(scan({ sovits: [] }))).toBeNull();
  });
});

describe('swapResultText', () => {
  test('managed + ready → swapped', () => {
    expect(swapResultText({ ok: true, managed: true, ready: true })).toContain('已切换');
  });
  test('managed + not ready → deferred apply', () => {
    expect(swapResultText({ ok: true, managed: true, ready: false })).toContain('自动应用');
  });
  test('legacy BYO → manual restart hint', () => {
    expect(swapResultText({ ok: true })).toContain('重启');
  });
  test('failure surfaces the error', () => {
    expect(swapResultText({ ok: false, error: 'no space' })).toBe('no space');
  });
});
