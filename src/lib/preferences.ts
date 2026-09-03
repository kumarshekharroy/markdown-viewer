import { THEMES } from '../data/themes';
import type { FontChoice, Preferences, ThemeMode } from '../types';

export const MIN_CONTENT_WIDTH = 600;
export const MAX_CONTENT_WIDTH = 1280;
export const FULL_WIDTH_SLIDER_VALUE = MAX_CONTENT_WIDTH + 20;
export const MIN_PANEL_WIDTH = 220;
export const MAX_PANEL_WIDTH = 460;
export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 28;
export const MIN_FONT_WEIGHT = 300;
export const MAX_FONT_WEIGHT = 700;
export const MIN_ZOOM = 80;
export const MAX_ZOOM = 140;
export const PREFS_KEY = 'markdown-viewer-preferences';
export const LEGACY_PREFS_KEY = 'quietmark-preferences';

export const DEFAULT_PREFS: Preferences = {
  theme: 'system',
  lastThemeOverride: 'slate',
  fontSize: 18,
  fontWeight: 400,
  zoom: 100,
  lineHeight: 1.68,
  contentWidth: MAX_CONTENT_WIDTH,
  fullWidth: false,
  fontChoice: 'sans',
  highContrast: false,
  codeWrap: false,
  reducedMotion: false,
  filePanelVisible: true,
  tocVisible: true,
  filePanelWidth: 280,
  tocPanelWidth: 296
};

const FONT_CHOICES: FontChoice[] = ['system', 'sans', 'serif', 'slab', 'mono', 'rounded'];
const THEME_IDS: string[] = THEMES.map((theme) => theme.id);

export function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

export function normalizePreferences(raw: unknown): Preferences {
  const value = raw && typeof raw === 'object' ? (raw as Partial<Preferences>) : {};
  const result = { ...DEFAULT_PREFS };
  const theme = value.theme;
  if (theme === 'system' || (typeof theme === 'string' && THEME_IDS.includes(theme))) {
    result.theme = theme as ThemeMode;
  }
  if (value.lastThemeOverride && THEME_IDS.includes(value.lastThemeOverride)) {
    result.lastThemeOverride = value.lastThemeOverride;
  }
  if (value.fontChoice && FONT_CHOICES.includes(value.fontChoice))
    result.fontChoice = value.fontChoice;
  const ranges = {
    fontSize: [MIN_FONT_SIZE, MAX_FONT_SIZE],
    fontWeight: [MIN_FONT_WEIGHT, MAX_FONT_WEIGHT],
    zoom: [MIN_ZOOM, MAX_ZOOM],
    lineHeight: [1.35, 1.9],
    contentWidth: [MIN_CONTENT_WIDTH, MAX_CONTENT_WIDTH],
    filePanelWidth: [MIN_PANEL_WIDTH, MAX_PANEL_WIDTH],
    tocPanelWidth: [MIN_PANEL_WIDTH, MAX_PANEL_WIDTH]
  } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const number = value[key];
    if (typeof number === 'number' && Number.isFinite(number)) {
      result[key] = clamp(number, ranges[key][0], ranges[key][1]);
    }
  }
  for (const key of [
    'highContrast',
    'fullWidth',
    'codeWrap',
    'reducedMotion',
    'filePanelVisible',
    'tocVisible'
  ] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  return result;
}

export function loadPreferences(): Preferences {
  try {
    return normalizePreferences(
      JSON.parse(localStorage.getItem(PREFS_KEY) ?? localStorage.getItem(LEGACY_PREFS_KEY) ?? '{}')
    );
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Reset only settings owned by the dock; preserve theme, font family, files and drafts. */
export function resetDockPreferences(current: Preferences): Preferences {
  return {
    ...current,
    fontSize: DEFAULT_PREFS.fontSize,
    fontWeight: DEFAULT_PREFS.fontWeight,
    zoom: DEFAULT_PREFS.zoom,
    highContrast: DEFAULT_PREFS.highContrast,
    filePanelVisible: DEFAULT_PREFS.filePanelVisible,
    tocVisible: DEFAULT_PREFS.tocVisible
  };
}
