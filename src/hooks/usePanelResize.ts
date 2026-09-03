import { useCallback, useEffect, useRef } from 'react';
import type { PanelSide } from '../components/Panel';
import type { Preferences } from '../types';
import { clamp, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from '../lib/preferences';

export function usePanelResize(
  preferences: Preferences,
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>,
  compact: boolean
) {
  const cleanupRef = useRef<() => void>(() => undefined);
  useEffect(() => () => cleanupRef.current(), []);
  const updateWidth = useCallback(
    (side: PanelSide, width: number) => {
      const key = side === 'files' ? 'filePanelWidth' : 'tocPanelWidth';
      const value = clamp(Math.round(width), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
      setPreferences((current) =>
        current[key] === value ? current : { ...current, [key]: value }
      );
    },
    [setPreferences]
  );
  const startPanelResize = useCallback(
    (side: PanelSide, event: React.PointerEvent) => {
      if (compact) return;
      event.preventDefault();
      cleanupRef.current();
      const startX = event.clientX;
      const startWidth = side === 'files' ? preferences.filePanelWidth : preferences.tocPanelWidth;
      let nextWidth = startWidth;
      let frame = 0;
      const apply = () => {
        frame = 0;
        updateWidth(side, nextWidth);
      };
      const move = (pointer: PointerEvent) => {
        nextWidth = startWidth + (pointer.clientX - startX) * (side === 'files' ? 1 : -1);
        if (!frame) frame = window.requestAnimationFrame(apply);
      };
      const cleanup = () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
      const end = () => {
        cleanup();
        updateWidth(side, nextWidth);
      };
      cleanupRef.current = cleanup;
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerup', end, { once: true });
      window.addEventListener('pointercancel', end, { once: true });
    },
    [compact, preferences.filePanelWidth, preferences.tocPanelWidth, updateWidth]
  );

  const handlePanelResizeKeydown = useCallback(
    (side: PanelSide, event: React.KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const amount = event.shiftKey ? 32 : 12;
      const sign = event.key === 'ArrowRight' ? 1 : -1;
      const current = side === 'files' ? preferences.filePanelWidth : preferences.tocPanelWidth;
      updateWidth(side, current + (side === 'files' ? sign : -sign) * amount);
    },
    [preferences.filePanelWidth, preferences.tocPanelWidth, updateWidth]
  );
  return { startPanelResize, handlePanelResizeKeydown };
}
