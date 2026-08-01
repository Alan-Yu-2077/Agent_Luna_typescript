import { describe, expect, test } from 'bun:test';
import { UtteranceGestures, classifyUtterance } from './utterance';

const id = (text: string): string | null => classifyUtterance(text)?.id ?? null;

describe('classifyUtterance — what kind of sentence that was', () => {
  test('questions, in both scripts', () => {
    expect(id('你今天过得怎么样？')).toBe('question');
    expect(id('How was your day?')).toBe('question');
  });

  test('exclamations, in both scripts', () => {
    expect(id('太好了！')).toBe('exclaim');
    expect(id('That is wonderful!')).toBe('exclaim');
  });

  // The Chinese ellipsis has three written forms in the wild and the model uses all of them.
  test('every ellipsis variant trails off', () => {
    expect(id('我不知道该说什么……')).toBe('trailOff');
    expect(id('I guess...')).toBe('trailOff');
    expect(id('那个。。。')).toBe('trailOff');
    expect(id('hmm…')).toBe('trailOff');
  });

  test('the tilde lilts', () => {
    expect(id('好呀～')).toBe('lilt');
    expect(id('okay~')).toBe('lilt');
  });

  test('an ordinary statement gets nothing', () => {
    expect(id('今天下雪了。')).toBeNull();
    expect(id('It snowed today.')).toBeNull();
    expect(id('no punctuation at all')).toBeNull();
    expect(id('')).toBeNull();
    expect(id('   ')).toBeNull();
  });

  // The mark has to END the sentence — a question mark in the middle is someone quoting a question,
  // not asking one.
  test('a mark inside the sentence does not trigger', () => {
    expect(id('他问了我一个问题？然后就走了。')).toBeNull();
    expect(id('She asked why? and then left.')).toBeNull();
  });

  test('closing quotes and brackets sit after the mark that matters', () => {
    expect(id('他说"真的吗？"')).toBe('question');
    expect(id('（真的吗？）')).toBe('question');
    expect(id('"Are you sure?"')).toBe('question');
    expect(id('好呀～ ')).toBe('lilt');
  });

  test('a sentence ending in ellipsis-then-question reads as the question', () => {
    expect(id('那……真的吗？')).toBe('question');
  });
});

describe('gesture timing and shape', () => {
  test('emphasis runs through the utterance; a question tilts in the pause after it', () => {
    expect(classifyUtterance('太好了！')?.when).toBe('start');
    expect(classifyUtterance('好呀～')?.when).toBe('start');
    expect(classifyUtterance('真的吗？')?.when).toBe('end');
    expect(classifyUtterance('我不知道……')?.when).toBe('end');
  });

  test('every gesture is bounded and small — these ride under a performance, not over it', () => {
    for (const text of ['真的吗？', '太好了！', '我不知道……', '好呀～']) {
      const g = classifyUtterance(text);
      expect(g).not.toBeNull();
      expect(g!.durationMs).toBeGreaterThan(0);
      expect(g!.durationMs).toBeLessThanOrEqual(1000);
      for (const v of Object.values(g!.pose)) expect(Math.abs(v)).toBeLessThanOrEqual(5);
    }
  });

  // v0.43.0's invariant and the lip-sync's ownership, both still standing.
  test('no gesture touches an eyelid or the mouth', () => {
    for (const text of ['真的吗？', '太好了！', '我不知道……', '好呀～']) {
      for (const key of Object.keys(classifyUtterance(text)?.pose ?? {})) {
        expect(key.startsWith('eyeOpen')).toBe(false);
        expect(key.startsWith('mouth')).toBe(false);
        expect(key).not.toBe('jawOpen');
      }
    }
  });
});

describe('UtteranceGestures — three questions in a row must not look like a stuck animation', () => {
  test('a repeated gesture alternates its lateral direction', () => {
    const g = new UtteranceGestures();
    const a = g.next('真的吗？');
    const b = g.next('是吗？');
    const c = g.next('你确定？');
    expect(a?.pose.headRoll).toBeGreaterThan(0);
    expect(b?.pose.headRoll).toBeLessThan(0);
    expect(c?.pose.headRoll).toBeGreaterThan(0);
  });

  // Mirroring a brow lift would turn an emphasis into a frown — only the lateral channels flip.
  test('only lateral channels flip; the expression keeps its meaning', () => {
    const g = new UtteranceGestures();
    g.next('真的吗？');
    const second = g.next('是吗？');
    expect(second?.pose.headRoll).toBeLessThan(0);
    expect(second?.pose.browLY).toBeGreaterThan(0);
  });

  test('a different gesture resets the direction', () => {
    const g = new UtteranceGestures();
    g.next('真的吗？');
    g.next('是吗？'); // now mirrored
    g.next('太好了！'); // different id
    expect(g.next('真的吗？')?.pose.headRoll).toBeGreaterThan(0);
  });

  test('an unpunctuated sentence between two questions clears the run', () => {
    const g = new UtteranceGestures();
    g.next('真的吗？');
    expect(g.next('今天下雪了。')).toBeNull();
    expect(g.next('是吗？')?.pose.headRoll).toBeGreaterThan(0);
  });
});
