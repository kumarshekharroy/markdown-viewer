import { describe, expect, it } from 'vitest';
import { findSourceMatches, replaceAllSourceMatches, replaceSourceMatch } from './search';

describe('shared document search', () => {
  it('uses the same case and whole-word matches for navigation and replacement', () => {
    const text = 'Cat catalog cat CAT';
    const options = { caseSensitive: false, wholeWord: true };
    expect(findSourceMatches(text, 'cat', options)).toEqual([
      { from: 0, to: 3 },
      { from: 12, to: 15 },
      { from: 16, to: 19 }
    ]);
    expect(replaceSourceMatch(text, { from: 12, to: 15 }, 'dog')).toBe('Cat catalog dog CAT');
    expect(replaceAllSourceMatches(text, 'cat', options, '$&')).toBe('$& catalog $& $&');
  });

  it('treats search text literally', () => {
    const options = { caseSensitive: true, wholeWord: false };
    expect(findSourceMatches('a.b a-b', 'a.b', options)).toEqual([{ from: 0, to: 3 }]);
    expect(replaceAllSourceMatches('a.b a-b', 'a.b', options, 'x')).toBe('x a-b');
  });
});
