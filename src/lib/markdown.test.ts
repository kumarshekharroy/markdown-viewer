import { describe, expect, it } from 'vitest';
import {
  convertGitHubBlobUrl,
  countMatches,
  extractHeadings,
  isSafeImageUrl,
  isSafeLinkUrl,
  resolveRelativePath
} from './markdown';

describe('markdown helpers', () => {
  it('extracts stable unique heading IDs outside fenced code', () => {
    const headings = extractHeadings('# Intro\n\n```md\n# Ignored\n```\n\n## Intro\n## Intro');

    expect(headings).toEqual([
      { id: 'intro', level: 1, text: 'Intro', from: 0 },
      { id: 'intro-2', level: 2, text: 'Intro', from: 30 },
      { id: 'intro-3', level: 2, text: 'Intro', from: 39 }
    ]);
  });

  it('tracks heading offsets through front matter and Windows line endings', () => {
    expect(extractHeadings('# One\r\n\r\n## Two', 12).map((heading) => heading.from)).toEqual([
      12, 21
    ]);
  });

  it('normalizes relative links from the active document path', () => {
    expect(resolveRelativePath('docs/guides/start.md', '../assets/logo.png')).toBe(
      'docs/assets/logo.png'
    );
  });

  it('blocks unsafe URL protocols', () => {
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:image/svg+xml;base64,PHN2Zy8+')).toBe(false);
    expect(isSafeLinkUrl('https://example.com/readme.md')).toBe(true);
  });

  it('converts clear GitHub blob URLs to raw content URLs', () => {
    expect(
      convertGitHubBlobUrl('https://github.com/openai/openai-cookbook/blob/main/README.md')
    ).toBe('https://raw.githubusercontent.com/openai/openai-cookbook/main/README.md');
  });

  it('counts whole-word matches', () => {
    expect(countMatches('cat catalog Cat', 'cat', { caseSensitive: false, wholeWord: true })).toBe(
      2
    );
  });
});
