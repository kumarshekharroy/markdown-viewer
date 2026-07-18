import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from './frontmatter';

describe('parseFrontMatter', () => {
  it('strips valid YAML from rendered body while keeping raw content available', () => {
    const parsed = parseFrontMatter('---\ntitle: Test\ncount: 2\n---\n# Hello');

    expect(parsed.raw).toContain('title: Test');
    expect(parsed.data).toMatchObject({ title: 'Test', count: 2 });
    expect(parsed.body).toBe('# Hello');
  });

  it('preserves invalid YAML as a non-blocking warning', () => {
    const parsed = parseFrontMatter('---\ntitle: [broken\n---\n# Hello');

    expect(parsed.error).toBeTruthy();
    expect(parsed.body).toBe('# Hello');
  });
});
