import { describe, expect, it } from 'vitest';
import { normalizeDocumentTitle } from './documentTitle';

describe('document title normalization', () => {
  it.each([
    ['/projects/notes/project_notes-v2.md', 'project notes v2'],
    ['C:\\Docs\\My__File.MARKDOWN', 'My File'],
    ['https://example.com/docs/Reading%20Guide.md?raw=1', 'Reading Guide'],
    ['## **Weekly   notes**', 'Weekly notes'],
    ['README', 'README'],
    ['v1.2.3.mdown', 'v1.2.3'],
    ['bad%name.md', 'bad%name'],
    ['', 'Untitled document']
  ])('cleans %s without changing meaningful casing or version numbers', (input, expected) => {
    expect(normalizeDocumentTitle(input)).toBe(expected);
  });
});
