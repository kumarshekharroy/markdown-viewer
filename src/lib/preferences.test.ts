import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, normalizePreferences, resetDockPreferences } from './preferences';
import { THEMES, isDarkTheme, resolveTheme } from '../data/themes';

describe('reading preferences', () => {
  it('migrates old preferences and rejects corrupt stored values', () => {
    expect(normalizePreferences({ theme: 'sky', fontSize: 21 })).toMatchObject({
      theme: 'sky',
      fontSize: 21,
      zoom: 100
    });
    expect(
      normalizePreferences({
        theme: 'unknown',
        fontSize: 'large',
        zoom: Infinity,
        highContrast: 'false'
      })
    ).toEqual(DEFAULT_PREFS);
    expect(normalizePreferences({ fontSize: 900, zoom: -10 })).toMatchObject({
      fontSize: 28,
      zoom: 80
    });
  });
  it('resets dock settings without changing unrelated reading preferences', () => {
    const current = {
      ...DEFAULT_PREFS,
      theme: 'forest' as const,
      fontChoice: 'serif' as const,
      fontSize: 24,
      zoom: 130,
      fontWeight: 700,
      highContrast: true,
      tocVisible: false
    };
    expect(resetDockPreferences(current)).toMatchObject({
      theme: 'forest',
      fontChoice: 'serif',
      fontSize: 18,
      zoom: 100,
      fontWeight: 400,
      highContrast: false,
      tocVisible: true
    });
  });
  it('recognizes every palette and its correct light/dark appearance', () => {
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(12);
    for (const theme of THEMES) {
      expect(normalizePreferences({ theme: theme.id }).theme).toBe(theme.id);
      expect(isDarkTheme(theme.id)).toBe(theme.appearance === 'dark');
    }
    expect(resolveTheme('system', false)).toBe('paper');
    expect(resolveTheme('system', true)).toBe('slate');
  });
});
