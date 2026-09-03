import type { ThemeMode } from '../types';

export interface ThemeDefinition {
  id: Exclude<ThemeMode, 'system'>;
  name: string;
  description: string;
  appearance: 'light' | 'dark';
  background: string;
  ink: string;
  accent: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'light',
    name: 'Linen',
    description: 'Warm and familiar',
    appearance: 'light',
    background: '#f6f3ec',
    ink: '#1d2733',
    accent: '#0f766e'
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Crisp, quiet whites',
    appearance: 'light',
    background: '#fafafa',
    ink: '#25272b',
    accent: '#475569'
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'An easy afternoon read',
    appearance: 'light',
    background: '#f3ead8',
    ink: '#2e2418',
    accent: '#9f5d1b'
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'Fresh botanical greens',
    appearance: 'light',
    background: '#eef7f0',
    ink: '#192a24',
    accent: '#16845b'
  },
  {
    id: 'sky',
    name: 'Sky',
    description: 'Cool, airy blues',
    appearance: 'light',
    background: '#eef5fb',
    ink: '#182536',
    accent: '#176c9c'
  },
  {
    id: 'plum',
    name: 'Plum',
    description: 'Soft lilac and violet',
    appearance: 'light',
    background: '#f6f0f5',
    ink: '#2b2230',
    accent: '#8a4f76'
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Muted blush and clay',
    appearance: 'light',
    background: '#fcf1ed',
    ink: '#392822',
    accent: '#a2483e'
  },
  {
    id: 'dark',
    name: 'Charcoal',
    description: 'Soft charcoal and teal',
    appearance: 'dark',
    background: '#17191a',
    ink: '#f0eee6',
    accent: '#5ee2c5'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue, starlit accents',
    appearance: 'dark',
    background: '#111827',
    ink: '#e7edf8',
    accent: '#90baff'
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Evergreen after dusk',
    appearance: 'dark',
    background: '#101e19',
    ink: '#e3eee5',
    accent: '#a0d6a8'
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Balanced blue-gray',
    appearance: 'dark',
    background: '#202730',
    ink: '#edf1f5',
    accent: '#a9c9dc'
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm amber at night',
    appearance: 'dark',
    background: '#241b19',
    ink: '#f5e9df',
    accent: '#f2b179'
  }
];

export function resolveTheme(theme: ThemeMode, systemDark: boolean): Exclude<ThemeMode, 'system'> {
  return theme === 'system' ? (systemDark ? 'slate' : 'paper') : theme;
}

export function isDarkTheme(theme: Exclude<ThemeMode, 'system'>): boolean {
  return THEMES.find((item) => item.id === theme)?.appearance === 'dark';
}

export function themeName(theme: ThemeMode): string {
  return theme === 'system'
    ? 'System'
    : (THEMES.find((item) => item.id === theme)?.name ?? 'Linen');
}
