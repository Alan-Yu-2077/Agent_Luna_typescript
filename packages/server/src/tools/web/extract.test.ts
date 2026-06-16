import { describe, expect, test } from 'bun:test';
import { extractMarkdown, wrapUntrusted } from './extract';

const ARTICLE = `<!doctype html><html><head><title>My Title</title></head><body>
<nav>HOME ABOUT CONTACT</nav><header>site header junk</header>
<article><h1>Main Heading</h1>
<p>This is the first substantial paragraph of the article with enough words to be considered the main content by the readability heuristic, which needs a reasonable amount of text to lock on to a node.</p>
<p>This is a second paragraph that continues the article body so the extractor has clear main content to isolate from the surrounding navigation and footer chrome around it.</p>
</article><footer>copyright 2026 footer junk</footer><script>console.log('tracking-pixel')</script>
</body></html>`;

describe('extractMarkdown', () => {
  test('isolates the article, drops nav/footer/script, captures the title', () => {
    const r = extractMarkdown(ARTICLE);
    expect(r.title).toContain('Title');
    expect(r.markdown).toContain('first substantial paragraph');
    expect(r.markdown).not.toContain('CONTACT'); // nav gone
    expect(r.markdown).not.toContain('tracking-pixel'); // script gone
    expect(r.truncated).toBe(false);
  });

  test('truncates at max_chars with a marker', () => {
    const r = extractMarkdown(ARTICLE, 50);
    expect(r.truncated).toBe(true);
    expect(r.markdown).toContain('…[truncated]');
  });

  test('empty / garbage html falls back without throwing', () => {
    expect(() => extractMarkdown('')).not.toThrow();
    const r = extractMarkdown('<<<not really html>>> just some plain words here');
    expect(typeof r.markdown).toBe('string');
    expect(r.markdown).toContain('plain words');
  });

  test('wrapUntrusted delimits content with the source url', () => {
    const w = wrapUntrusted('body text', 'https://example.com/x');
    expect(w).toBe(
      '<untrusted_content source="https://example.com/x">\nbody text\n</untrusted_content>',
    );
  });
});
