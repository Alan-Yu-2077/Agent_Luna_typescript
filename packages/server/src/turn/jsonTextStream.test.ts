import { describe, expect, test } from 'bun:test';
import { JsonTextStream } from './jsonTextStream';

function extract(chunks: string[]): string {
  const s = new JsonTextStream();
  return chunks.map((c) => s.push(c)).join('');
}

describe('JsonTextStream', () => {
  test('spike-verified gateway chunk shapes', () => {
    const chunks = [
      '',
      '{"text": "小猫',
      '第一次',
      '看见雪，伸',
      '出爪子轻轻一碰，',
      '惊讶地跳了起来。"',
      ', "is_final',
      '": false}',
    ];
    expect(extract(chunks)).toBe('小猫第一次看见雪，伸出爪子轻轻一碰，惊讶地跳了起来。');
  });

  test('single-char chunks (pathological split)', () => {
    const raw = '{"text":"ab。c","is_final":true}';
    expect(extract([...raw])).toBe('ab。c');
  });

  test('escape split across chunks', () => {
    expect(extract(['{"text":"a\\', 'nb"}'])).toBe('a\nb');
    expect(extract(['{"text":"q\\', '"quoted\\"', ' end"}'])).toBe('q"quoted" end');
  });

  test('unicode escape split across chunks (incl. surrogate pair)', () => {
    expect(extract(['{"text":"\\u',  '4f60\\u59',  '7d"}'])).toBe('你好');
    expect(extract(['{"text":"\\ud83d\\ude00"}'])).toBe('😀');
  });

  test('text not the first key', () => {
    expect(extract(['{"is_final": false, "expression": "soft_warmth", "text": "好的"}'])).toBe(
      '好的',
    );
  });

  test('no text field yields empty', () => {
    expect(extract(['{"is_final": true}'])).toBe('');
  });

  test('nested "text" at depth>1 is ignored; top-level wins', () => {
    expect(
      extract(['{"voice_params": {"text": "nope", "voice": "luna"}, "text": "yes"}']),
    ).toBe('yes');
  });

  test('key containing escaped quote does not confuse key matching', () => {
    expect(extract(['{"no\\"text": "x", "text": "real"}'])).toBe('real');
  });

  test('stops at value end — trailing fields emit nothing', () => {
    const s = new JsonTextStream();
    expect(s.push('{"text": "done"')).toBe('done');
    expect(s.push(', "is_final": true}')).toBe('');
  });

  test('whitespace around colon and value', () => {
    expect(extract(['{ "text"  :   "spaced" }'])).toBe('spaced');
  });
});
