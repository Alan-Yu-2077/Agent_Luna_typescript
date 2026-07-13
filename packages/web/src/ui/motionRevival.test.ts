import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// v0.36.0 source-gate: Reduce-motion is removed for good (Initiative 26 constitution — the app is
// always alive). These read the real source so the machinery can never silently creep back, and
// assert the replacements (关窗户 collapse, 无边模式, motion tokens) are present.
const HERE = import.meta.dir;
const read = (rel: string): string => readFileSync(join(HERE, rel), 'utf8');

describe('v0.36.0 motion revival — reduce-motion is gone', () => {
  const css = read('theme.css');
  const app = read('../app.ts');
  const sink = read('../live2d/pixiLive2DSink.ts');
  const layout = read('layout.ts');

  test('no reduce-motion class or media query survives in the stylesheet', () => {
    expect(css).not.toContain('reduce-motion');
    expect(css).not.toContain('prefers-reduced-motion');
  });

  test('the sink no longer has a reduced-motion snap branch', () => {
    expect(sink).not.toContain('reducedMotion');
    expect(sink).not.toContain('reduce-motion');
  });

  test('app.ts only touches the key to CLEAN it up, never to re-apply the class', () => {
    expect(app).not.toContain("classList.add('reduce-motion')");
    expect(app).not.toContain("classList.toggle('reduce-motion'");
    expect(app).not.toContain('prefers-reduced-motion');
    // the one allowed reference is the stale-key cleanup
    expect(app).toContain("removeItem('luna:reduce-motion')");
  });

  test('the Reduce motion settings row is gone from the layout', () => {
    expect(layout).not.toContain('Reduce motion');
    expect(layout).not.toContain('motionToggle');
  });
});

describe('v0.36.0 motion revival — replacements are in place', () => {
  const css = read('theme.css');
  const app = read('../app.ts');
  const layout = read('layout.ts');

  test('shared motion tokens exist', () => {
    for (const tok of ['--m-fast', '--m-soft', '--m-slow', '--ease-pop', '--ease-glide']) {
      expect(css).toContain(tok);
    }
  });

  test('关窗户 collapse: grid-rows sash close + two-phase choreography', () => {
    expect(css).toContain('grid-template-rows');
    expect(css).toContain('.luna-app.collapsing .chat-panel');
    expect(app).toContain("classList.add('collapsing')");
    expect(layout).toContain("'chat-body'");
  });

  test('无边模式: the lace letterbox strips are removed', () => {
    expect(css).not.toContain('lace-top');
    expect(css).not.toContain('lace-bottom');
    expect(layout).not.toContain('lace-top');
    expect(layout).not.toContain('lace-bottom');
  });

  test('Fredoka + 快乐体 fonts are declared and bundled', () => {
    expect(css).toContain('Fredoka');
    expect(css).toContain('ZCOOL KuaiLe');
    // relative paths so Bun's bundler resolves + emits the woff2 into dist (hashed)
    expect(css).toContain('public/fonts/Fredoka.woff2');
    expect(css).toContain('public/fonts/ZCOOLKuaiLe.woff2');
  });
});
