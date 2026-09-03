import { Contrast, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Preferences } from '../types';
import {
  clamp,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_WEIGHT,
  MAX_FONT_WEIGHT,
  MIN_ZOOM,
  MAX_ZOOM
} from '../lib/preferences';
import { SidebarToggle } from './SidebarControls';

interface ReadingControlsProps {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  filesVisible: boolean;
  tocVisible: boolean;
  isEditing: boolean;
  dirty: boolean;
  onToggleFiles: () => void;
  onToggleToc: () => void;
  onReset: () => void;
}

export function ReadingControls({
  preferences,
  setPreferences,
  filesVisible,
  tocVisible,
  isEditing,
  dirty,
  onToggleFiles,
  onToggleToc,
  onReset
}: ReadingControlsProps) {
  const adjust = (
    key: 'fontSize' | 'fontWeight' | 'zoom',
    delta: number,
    min: number,
    max: number
  ) => setPreferences((current) => ({ ...current, [key]: clamp(current[key] + delta, min, max) }));
  return (
    <div
      className="reading-controls"
      role="toolbar"
      aria-label={isEditing ? 'Sidebar controls' : 'Reading controls'}
    >
      <SidebarToggle side="left" visible={filesVisible} onClick={onToggleFiles} dirty={dirty} />
      <Divider />
      {isEditing ? (
        <span className="reading-controls__context">Editor layout</span>
      ) : (
        <>
          <div className="reading-controls__group" role="group" aria-label="Font size">
            <DockButton
              label={`Decrease font size. Current size ${preferences.fontSize} pixels`}
              tooltip={`Smaller text · ${preferences.fontSize}px`}
              disabled={preferences.fontSize <= MIN_FONT_SIZE}
              onClick={() => adjust('fontSize', -1, MIN_FONT_SIZE, MAX_FONT_SIZE)}
            >
              <span aria-hidden="true">A−</span>
            </DockButton>
            <DockButton
              label={`Increase font size. Current size ${preferences.fontSize} pixels`}
              tooltip={`Larger text · ${preferences.fontSize}px`}
              disabled={preferences.fontSize >= MAX_FONT_SIZE}
              onClick={() => adjust('fontSize', 1, MIN_FONT_SIZE, MAX_FONT_SIZE)}
            >
              <span aria-hidden="true">A+</span>
            </DockButton>
          </div>
          <Divider />
          <div className="reading-controls__group" role="group" aria-label="Content zoom">
            <DockButton
              label={`Zoom out. Current zoom ${preferences.zoom} percent`}
              tooltip={`Zoom out · ${preferences.zoom}%`}
              disabled={preferences.zoom <= MIN_ZOOM}
              onClick={() => adjust('zoom', -10, MIN_ZOOM, MAX_ZOOM)}
            >
              <ZoomOut size={18} aria-hidden="true" />
            </DockButton>
            <DockButton
              label={`Zoom in. Current zoom ${preferences.zoom} percent`}
              tooltip={`Zoom in · ${preferences.zoom}%`}
              disabled={preferences.zoom >= MAX_ZOOM}
              onClick={() => adjust('zoom', 10, MIN_ZOOM, MAX_ZOOM)}
            >
              <ZoomIn size={18} aria-hidden="true" />
            </DockButton>
          </div>
          <Divider />
          <div className="reading-controls__group" role="group" aria-label="Font weight">
            <DockButton
              label={`Decrease font weight. Current weight ${preferences.fontWeight}`}
              tooltip={`Lighter text · ${preferences.fontWeight}`}
              disabled={preferences.fontWeight <= MIN_FONT_WEIGHT}
              onClick={() => adjust('fontWeight', -100, MIN_FONT_WEIGHT, MAX_FONT_WEIGHT)}
            >
              <span className="reading-control__weight--light" aria-hidden="true">
                B−
              </span>
            </DockButton>
            <DockButton
              label={`Increase font weight. Current weight ${preferences.fontWeight}`}
              tooltip={`Bolder text · ${preferences.fontWeight}`}
              disabled={preferences.fontWeight >= MAX_FONT_WEIGHT}
              onClick={() => adjust('fontWeight', 100, MIN_FONT_WEIGHT, MAX_FONT_WEIGHT)}
            >
              <span className="reading-control__weight--bold" aria-hidden="true">
                B+
              </span>
            </DockButton>
          </div>
          <Divider />
          <DockButton
            label={`${preferences.highContrast ? 'Disable' : 'Enable'} high contrast`}
            pressed={preferences.highContrast}
            onClick={() =>
              setPreferences((current) => ({ ...current, highContrast: !current.highContrast }))
            }
          >
            <Contrast size={18} aria-hidden="true" />
          </DockButton>
          <DockButton
            label="Reset dock controls"
            tooltip="Reset text, zoom, weight, contrast & sidebars"
            onClick={onReset}
          >
            <RotateCcw size={16} aria-hidden="true" />
          </DockButton>
        </>
      )}
      <Divider />
      <SidebarToggle side="right" visible={tocVisible} onClick={onToggleToc} />
    </div>
  );
}

function Divider() {
  return <span className="reading-controls__divider" aria-hidden="true" />;
}

function DockButton({
  label,
  tooltip,
  children,
  onClick,
  disabled,
  pressed
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      className="reading-control tooltip-button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={tooltip ?? label}
    >
      {children}
    </button>
  );
}
