import { useEffect } from 'react';
import { PREFS_KEY } from '../lib/preferences';
import type { Preferences } from '../types';

/** Coalesce resize/slider writes and flush the latest value before leaving. */
export function usePreferenceStorage(preferences: Preferences) {
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
      } catch {
        /* Private mode or storage quota. */
      }
    };
    const timer = window.setTimeout(save, 150);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [preferences]);
}
