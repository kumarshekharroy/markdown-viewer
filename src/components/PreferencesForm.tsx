import { RotateCcw } from 'lucide-react';
import { useId } from 'react';
import type { FontChoice, Preferences } from '../types';
import {
  MIN_CONTENT_WIDTH,
  FULL_WIDTH_SLIDER_VALUE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_WEIGHT,
  MAX_FONT_WEIGHT,
  MIN_ZOOM,
  MAX_ZOOM
} from '../lib/preferences';
import { ThemePicker } from './ThemePicker';

const FONT_CHOICES: Array<{ id: FontChoice; name: string; description: string }> = [
  { id: 'system', name: 'System', description: 'Native and familiar' },
  { id: 'sans', name: 'Sans', description: 'Clean and neutral' },
  { id: 'serif', name: 'Serif', description: 'Editorial and relaxed' },
  { id: 'slab', name: 'Slab', description: 'Sturdy and distinct' },
  { id: 'mono', name: 'Mono', description: 'Technical and precise' },
  { id: 'rounded', name: 'Rounded', description: 'Soft and friendly' }
];

export function PreferencesForm({
  preferences,
  setPreferences,
  onReset
}: {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  onReset: () => void;
}) {
  const id = useId();
  const update = <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) =>
    setPreferences((current) => ({ ...current, [key]: value }));

  return (
    <div className="settings-form">
      <SettingsSection
        title="Color theme"
        description="Follow your device, or choose a palette for this reader."
      >
        <ThemePicker
          compact
          value={preferences.theme}
          highContrast={preferences.highContrast}
          onChange={(theme) =>
            setPreferences((current) => ({
              ...current,
              theme,
              lastThemeOverride: theme === 'system' ? current.lastThemeOverride : theme
            }))
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Typography"
        description="Choose a reading voice, then tune its scale and density."
      >
        <fieldset className="font-choice-group">
          <legend>Reading font</legend>
          <div className="font-choice-grid">
            {FONT_CHOICES.map((font) => (
              <label
                key={font.id}
                className={`font-choice font-choice--${font.id} ${preferences.fontChoice === font.id ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name={`${id}-font`}
                  value={font.id}
                  checked={preferences.fontChoice === font.id}
                  onChange={() => update('fontChoice', font.id)}
                />
                <span className="font-choice__sample" aria-hidden="true">
                  Aa
                </span>
                <span>
                  <strong>{font.name}</strong>
                  <small>{font.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="setting-control-grid">
          <SliderControl
            id={`${id}-font-size`}
            label="Text size"
            hint="Size of document text"
            value={`${preferences.fontSize}px`}
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step={1}
            numberValue={preferences.fontSize}
            onChange={(value) => update('fontSize', value)}
          />
          <SliderControl
            id={`${id}-font-weight`}
            label="Text weight"
            hint="Light to bold"
            value={String(preferences.fontWeight)}
            min={MIN_FONT_WEIGHT}
            max={MAX_FONT_WEIGHT}
            step={100}
            numberValue={preferences.fontWeight}
            onChange={(value) => update('fontWeight', value)}
          />
          <SliderControl
            id={`${id}-line-height`}
            label="Line spacing"
            hint="Space between lines"
            value={preferences.lineHeight.toFixed(2)}
            min={1.35}
            max={1.9}
            step={0.05}
            numberValue={preferences.lineHeight}
            onChange={(value) => update('lineHeight', value)}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Page layout"
        description="Control how much of the display the document can use."
      >
        <div className="setting-control-grid setting-control-grid--layout">
          <SliderControl
            id={`${id}-content-width`}
            label="Maximum content width"
            hint={
              preferences.fullWidth
                ? 'Uses all available width at every zoom level'
                : 'The maximum setting uses the full available width'
            }
            value={preferences.fullWidth ? 'Full' : `${preferences.contentWidth}px`}
            min={MIN_CONTENT_WIDTH}
            max={FULL_WIDTH_SLIDER_VALUE}
            step={20}
            numberValue={preferences.fullWidth ? FULL_WIDTH_SLIDER_VALUE : preferences.contentWidth}
            onChange={(value) =>
              setPreferences((current) =>
                value >= FULL_WIDTH_SLIDER_VALUE
                  ? { ...current, fullWidth: true }
                  : { ...current, fullWidth: false, contentWidth: value }
              )
            }
          />
          <SliderControl
            id={`${id}-content-zoom`}
            label="Page zoom"
            hint="Scale all document content"
            value={`${preferences.zoom}%`}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={10}
            numberValue={preferences.zoom}
            onChange={(value) => update('zoom', value)}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Reader behavior"
        description="Accessibility, code, and workspace display options."
      >
        <div className="setting-toggle-grid">
          <ToggleRow
            label="High contrast"
            description="Strengthen text and boundaries"
            checked={preferences.highContrast}
            onChange={(checked) => update('highContrast', checked)}
          />
          <ToggleRow
            label="Reduce motion"
            description="Minimize animated movement"
            checked={preferences.reducedMotion}
            onChange={(checked) => update('reducedMotion', checked)}
          />
          <ToggleRow
            label="Wrap long code"
            description="Wrap code and editor lines"
            checked={preferences.codeWrap}
            onChange={(checked) => update('codeWrap', checked)}
          />
          <ToggleRow
            label="Files sidebar"
            description="Show files by default"
            checked={preferences.filePanelVisible}
            onChange={(checked) => update('filePanelVisible', checked)}
          />
          <ToggleRow
            label="Contents sidebar"
            description="Show headings by default"
            checked={preferences.tocVisible}
            onChange={(checked) => update('tocVisible', checked)}
          />
        </div>
      </SettingsSection>

      <div className="settings-footer">
        <p>Changes are saved automatically in this browser.</p>
        <button className="ghost-button" type="button" onClick={onReset}>
          <RotateCcw size={16} aria-hidden="true" />
          Reset all settings
        </button>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <div className="settings-section__heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="settings-section__content">{children}</div>
    </section>
  );
}

function SliderControl({
  id,
  label,
  hint,
  value,
  numberValue,
  min,
  max,
  step,
  disabled = false,
  onChange
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  numberValue: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={`slider-control ${disabled ? 'is-disabled' : ''}`}>
      <div className="slider-control__heading">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{value}</output>
      </div>
      <span className="slider-control__hint">{hint}</span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={numberValue}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
