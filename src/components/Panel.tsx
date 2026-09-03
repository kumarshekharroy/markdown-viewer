import { X } from 'lucide-react';
export type PanelSide = 'files' | 'toc';

export function PanelResizer({
  side,
  label,
  onPointerDown,
  onKeyDown
}: {
  side: PanelSide;
  label: string;
  onPointerDown: (side: PanelSide, event: React.PointerEvent) => void;
  onKeyDown: (side: PanelSide, event: React.KeyboardEvent) => void;
}) {
  return (
    <div
      className={`panel-resizer panel-resizer--${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => onPointerDown(side, event)}
      onKeyDown={(event) => onKeyDown(side, event)}
    />
  );
}

export function PanelHeader({
  title,
  onClose,
  actions
}: {
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <div className="panel-header__actions">
        {actions}
        <button
          className="icon-button mobile-only"
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
