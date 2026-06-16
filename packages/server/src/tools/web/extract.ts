import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// Boilerplate stripping (Initiative 11, v0.18.1): isolate the main article with
// @mozilla/readability over a linkedom DOM (lighter than jsdom, no browser),
// convert to markdown with turndown. Hostile arbitrary HTML in → bounded, never-
// throwing text out (size caps live in safeFetch before this runs; this caps
// chars). The fallback path guarantees something readable even when extraction
// fails entirely.

function defaultMaxChars(): number {
  return Number(Bun.env['LUNA_WEB_FETCH_MAX_CHARS'] ?? 12000);
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export type Extracted = { title: string; markdown: string; truncated: boolean };

// linkedom's document → @mozilla/readability (the canonical pairing). The two
// ship divergent DOM types and this server package has no "dom" lib, so bridge
// via Readability's own constructor parameter type rather than the unavailable
// global Document — Readability only reads standard DOM methods here.
type ReadabilityDoc = ConstructorParameters<typeof Readability>[0];

export function extractMarkdown(html: string, maxChars?: number): Extracted {
  let title = '';
  let contentHtml = '';
  try {
    const { document } = parseHTML(html);
    title = document.title ?? '';
    const reader = new Readability(document as unknown as ReadabilityDoc, { charThreshold: 200 });
    const article = reader.parse();
    if (article) {
      if (article.title) title = article.title;
      contentHtml = article.content ?? '';
    }
  } catch {
    /* fall through to the tag-strip fallback */
  }

  let markdown = '';
  try {
    markdown = contentHtml.length > 0 ? turndown.turndown(contentHtml) : '';
  } catch {
    markdown = '';
  }
  if (markdown.trim().length === 0) {
    markdown = stripTags(html);
  }
  markdown = collapseWhitespace(markdown);

  const cap = maxChars ?? defaultMaxChars();
  let truncated = false;
  if (markdown.length > cap) {
    markdown = `${markdown.slice(0, cap)}\n…[truncated]`;
    truncated = true;
  }
  return { title: title.trim(), markdown, truncated };
}

// The untrusted-content envelope (v0.18.1): every web-returned body is wrapped so
// the delimiter is intrinsic from the first fetch. v0.18.2 adds the standing
// system rule that tells the model what the delimiter MEANS (data, not orders).
export function wrapUntrusted(markdown: string, sourceUrl: string): string {
  return `<untrusted_content source="${sourceUrl}">\n${markdown}\n</untrusted_content>`;
}
