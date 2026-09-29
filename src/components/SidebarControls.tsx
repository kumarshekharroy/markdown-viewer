import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { clamp } from '../lib/preferences';

interface SidebarToggleProps {
  side: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
  dirty?: boolean;
}

function SidebarIcon({ side, visible }: Pick<SidebarToggleProps, 'side' | 'visible'>) {
  const Icon =
    side === 'left'
      ? visible
        ? PanelLeftClose
        : PanelLeftOpen
      : visible
        ? PanelRightClose
        : PanelRightOpen;
  return <Icon size={18} aria-hidden="true" />;
}

export function SidebarToggle({ side, visible, onClick, dirty }: SidebarToggleProps) {
  const label = `${visible ? 'Hide' : 'Show'} ${side === 'left' ? 'file sidebar' : 'table of contents'}`;
  return (
    <button
      className={`reading-control reading-control--sidebar tooltip-button ${dirty ? 'is-dirty' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={visible}
      aria-controls={side === 'left' ? 'files-panel' : 'contents-panel'}
      data-tooltip={label}
    >
      <SidebarIcon side={side} visible={visible} />
      {dirty ? <span className="edge-toggle__dot" aria-hidden="true" /> : null}
    </button>
  );
}

/** Pointer tracking stays outside React rendering and updates at most once per frame. */
export const EdgePanelToggle = memo(function EdgePanelToggle({
  side,
  visible,
  onClick,
  dirty = false,
  panelWidth,
  rightOffset = 0,
  editing = false
}: SidebarToggleProps & { panelWidth: number; rightOffset?: number; editing?: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    let frame = 0;
    let revealTimer = 0;
    let pointer = { x: 0, y: 0 };
    const hide = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(revealTimer);
      frame = 0;
      revealTimer = 0;
      button.classList.remove('is-revealed');
    };
    const update = () => {
      frame = 0;
      const edge = side === 'left' ? 0 : window.innerWidth - rightOffset;
      const boundary = edge + (visible ? panelWidth * (side === 'left' ? 1 : -1) : 0);
      const nearSide = editing
        ? visible
          ? side === 'left'
            ? pointer.x >= boundary - 18 && pointer.x <= boundary
            : pointer.x >= boundary && pointer.x <= boundary + 18
          : side === 'left'
            ? pointer.x >= edge && pointer.x <= edge + 12
            : pointer.x <= edge && pointer.x >= edge - 12
        : Math.abs(pointer.x - boundary) < 48 || Math.abs(pointer.x - edge) < 24;
      if (!nearSide && !button.matches(':hover')) {
        hide();
        return;
      }
      const workspaceTop = document.querySelector('.workspace')?.getBoundingClientRect().top ?? 116;
      const visualBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;
      const minimum = workspaceTop + 24;
      const maximum = Math.max(minimum, visualBottom - button.offsetHeight - 32);
      button.style.setProperty(
        '--edge-follow-top',
        `${clamp(pointer.y - button.offsetHeight / 2, minimum, maximum)}px`
      );
      if (editing && !button.classList.contains('is-revealed')) {
        if (!revealTimer) {
          revealTimer = window.setTimeout(() => {
            revealTimer = 0;
            button.classList.add('is-revealed');
          }, 450);
        }
      } else {
        button.classList.add('is-revealed');
      }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
    };
  }, [side, visible, panelWidth, rightOffset, editing]);
  const label = `${visible ? 'Collapse' : 'Expand'} ${side === 'left' ? 'Files' : 'Contents'} panel`;
  return (
    <button
      ref={buttonRef}
      className={`edge-toggle tooltip-button edge-toggle--${side} ${visible ? 'is-open' : ''} ${editing ? 'edge-toggle--editing' : ''} ${dirty ? 'is-dirty' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={visible}
      data-tooltip={label}
    >
      <SidebarIcon side={side} visible={visible} />
      {dirty ? <span className="edge-toggle__dot" aria-hidden="true" /> : null}
    </button>
  );
});
