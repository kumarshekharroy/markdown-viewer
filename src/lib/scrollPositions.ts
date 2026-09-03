export const SCROLL_POSITIONS_KEY = 'markdown-viewer-scroll-positions';

export function loadScrollPosition(id: string): number {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SCROLL_POSITIONS_KEY) ?? '{}')[id];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function saveScrollPosition(id: string, position: number): void {
  try {
    const current = JSON.parse(localStorage.getItem(SCROLL_POSITIONS_KEY) ?? '{}') as Record<
      string,
      number
    >;
    // Reinsert the active ID so eviction follows recency, not its first visit.
    delete current[id];
    const entries = Object.entries({ ...current, [id]: Math.max(0, Math.round(position)) });
    localStorage.setItem(
      SCROLL_POSITIONS_KEY,
      JSON.stringify(Object.fromEntries(entries.slice(-50)))
    );
  } catch {
    /* Scroll persistence must never interrupt reading. */
  }
}
