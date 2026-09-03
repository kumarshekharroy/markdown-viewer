import { useLayoutEffect } from 'react';
import { loadScrollPosition, saveScrollPosition } from '../lib/scrollPositions';

export function useReaderScroll(
  id: string,
  isEditing: boolean,
  ready: boolean,
  stageRef: React.RefObject<HTMLElement>
) {
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || isEditing || !ready) return;
    const saved = loadScrollPosition(id);
    stage.scrollTop = saved;
    let lastPosition = stage.scrollTop;
    let timer = 0;
    const flush = () => {
      window.clearTimeout(timer);
      saveScrollPosition(id, lastPosition);
    };
    const onScroll = () => {
      lastPosition = stage.scrollTop;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 180);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    stage.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      // The DOM may already contain the next document: save the last observed
      // position, not a newly clamped scrollTop from the incoming content.
      flush();
      stage.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id, isEditing, ready, stageRef]);
}
