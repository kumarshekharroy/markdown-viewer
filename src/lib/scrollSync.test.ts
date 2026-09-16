import { describe, expect, it } from 'vitest';
import { mapAnchoredScroll } from './scrollSync';

describe('anchored scroll synchronization', () => {
  const anchors = [
    { editor: 100, preview: 200 },
    { editor: 300, preview: 550 }
  ];

  it('aligns corresponding headings and interpolates between them', () => {
    expect(mapAnchoredScroll(100, anchors, 'editor', 500, 900)).toBe(200);
    expect(mapAnchoredScroll(200, anchors, 'editor', 500, 900)).toBe(375);
    expect(mapAnchoredScroll(375, anchors, 'preview', 900, 500)).toBe(200);
  });

  it('keeps both endpoints and ignores out-of-range anchors', () => {
    expect(mapAnchoredScroll(0, anchors, 'editor', 500, 900)).toBe(0);
    expect(mapAnchoredScroll(500, anchors, 'editor', 500, 900)).toBe(900);
    expect(
      mapAnchoredScroll(250, [{ editor: -20, preview: 40 }, ...anchors], 'editor', 500, 900)
    ).toBe(462.5);
  });
});
