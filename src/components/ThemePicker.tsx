import { Check, Monitor } from 'lucide-react';
import { useId } from 'react';
import { THEMES } from '../data/themes';
import type { ThemeMode } from '../types';

export function ThemePicker({
  value,
  onChange,
  highContrast,
  compact = false
}: {
  value: ThemeMode;
  onChange: (theme: ThemeMode) => void;
  highContrast: boolean;
  compact?: boolean;
}) {
  const name = useId();
  return (
    <div className={`theme-picker ${compact ? 'theme-picker--compact' : ''}`}>
      {!compact ? (
        <p className="theme-picker__intro">
          Find your reading atmosphere. Changes apply instantly.
        </p>
      ) : null}
      {highContrast ? (
        <p className="theme-picker__hint">
          High contrast is on. Turn it off in the dock to see the full theme colors.
        </p>
      ) : null}
      <label className={`theme-system ${value === 'system' ? 'is-selected' : ''}`}>
        <input
          type="radio"
          name={name}
          value="system"
          checked={value === 'system'}
          onChange={() => onChange('system')}
        />
        <Monitor size={22} aria-hidden="true" />
        <span>
          <strong>Follow system</strong>
          <small>Automatically match your device’s light or dark mode</small>
        </span>
        {value === 'system' ? <Check size={18} aria-hidden="true" /> : null}
      </label>
      {(['light', 'dark'] as const).map((appearance) => (
        <fieldset className="theme-group" key={appearance}>
          <legend>{appearance === 'light' ? 'Light themes' : 'Dark themes'}</legend>
          <div className="theme-grid">
            {THEMES.filter((theme) => theme.appearance === appearance).map((theme) => (
              <label
                key={theme.id}
                className={`theme-card ${value === theme.id ? 'is-selected' : ''}`}
                style={
                  {
                    '--preview-bg': theme.background,
                    '--preview-ink': theme.ink,
                    '--preview-accent': theme.accent
                  } as React.CSSProperties
                }
              >
                <input
                  type="radio"
                  name={name}
                  value={theme.id}
                  checked={value === theme.id}
                  onChange={() => onChange(theme.id)}
                />
                <span className="theme-card__preview" aria-hidden="true">
                  <b>Aa</b>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="theme-card__name">
                  {theme.name}
                  {value === theme.id ? <Check size={14} aria-hidden="true" /> : null}
                </span>
                <small>{theme.description}</small>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
