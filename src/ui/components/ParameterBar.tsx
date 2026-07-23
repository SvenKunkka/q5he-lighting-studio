import React, { useRef } from 'react';
import type { LightingConfig, NormalSubmode } from '../../types';
import {
  applyBrightness, colorToHex, hexToColor, FACTORY_EFFECTS, NORMAL_SUBMODES,
} from '../../lighting/model';
import { QMK_RGB } from '../../lighting/qmkColor';
import { TOTAL_LEDS } from '../../lighting/keyLayout';
import type { I18nDict } from '../../i18n';

interface Props {
  config: LightingConfig;
  onChange: (u: Partial<LightingConfig>) => void;
  onImageUpload: (dataUrl: string) => void;
  onPerKeyClear: () => void;
  perKeySelectedCount: number;
  screenActive: boolean;
  t: I18nDict;
}

const COLOR_SWATCHES = [
  { name: 'Azure', color: QMK_RGB.azure },
  { name: 'Blue', color: QMK_RGB.blue },
  { name: 'Purple', color: QMK_RGB.purple },
  { name: 'Pink', color: QMK_RGB.pink },
  { name: 'Red', color: QMK_RGB.red },
  { name: 'Orange', color: QMK_RGB.orange },
  { name: 'Spring Green', color: QMK_RGB.springgreen },
  { name: 'White', color: QMK_RGB.white },
];

export function ParameterBar({
  config, onChange, onImageUpload, onPerKeyClear, perKeySelectedCount, screenActive, t,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onImageUpload(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = '';
  }

  switch (config.effect) {
    case 'off':
      return <div className="parameter-bar empty">{p(t, 'off')}</div>;

    case 'normal': {
      // Breathing owns its own brightness envelope (0 → peak → off → peak →
      // 0), so a separate brightness slider would just compress the visible
      // amplitude. Hide it and show the colour swatch at full peak instead.
      const isBreathing = config.normalSubmode === 'breathing';
      const swatchBrightness = isBreathing ? 100 : config.brightness;
      return (
        <div className="parameter-bar with-sub">
          <SubmodePicker
            value={config.normalSubmode}
            t={t}
            onChange={normalSubmode => onChange({ normalSubmode })}
          />
          <ColorBlock disabled={config.normalSubmode === 'wave'}
            label={p(t, 'color')} outputLabel={p(t, 'output')}
            value={config.color} brightness={swatchBrightness}
            onChange={c => onChange({ color: c })} />
          {!isBreathing && (
            <ParamSlider label={p(t, 'brightness')} unit="%"
              value={config.brightness} min={0} max={100}
              onChange={v => onChange({ brightness: v })} />
          )}
          <ParamSlider label={p(t, 'speed')} unit="%"
            value={config.speed} min={0} max={100}
            disabled={config.normalSubmode === 'solid'}
            onChange={v => onChange({ speed: v })} />
        </div>
      );
    }

    case 'factory':
      return (
        <div className="parameter-bar with-factory">
          <div className="param-block param-factory">
            <label className="param-label">{p(t, 'factory')}</label>
            <select className="factory-select" value={config.factoryId}
              onChange={e => onChange({ factoryId: Number(e.target.value) })}>
              {FACTORY_EFFECTS.map(f =>
                <option key={f.id} value={f.id}>{factoryName(t, f.zh, f.label)}</option>)}
            </select>
          </div>
          <ColorBlock label={p(t, 'color')} outputLabel={p(t, 'output')}
            value={config.color} brightness={config.brightness}
            onChange={c => onChange({ color: c })} />
          <ParamSlider label={p(t, 'brightness')} unit="%"
            value={config.brightness} min={0} max={100}
            onChange={v => onChange({ brightness: v })} />
          <ParamSlider label={p(t, 'speed')} unit="%"
            value={config.speed} min={0} max={100}
            onChange={v => onChange({ speed: v })} />
        </div>
      );

    case 'snake':
      return (
        <div className="parameter-bar">
          <ColorBlock label={p(t, 'snakeHead')} outputLabel={p(t, 'output')}
            value={config.snakeHeadColor} brightness={config.brightness}
            onChange={c => onChange({ snakeHeadColor: c })} />
          <ParamSlider label={p(t, 'speed')} unit="%"
            value={config.speed} min={5} max={100}
            onChange={v => onChange({ speed: v })} />
          <ParamSlider label={p(t, 'maxLength')} unit=""
            value={config.snakeMaxLength} min={3} max={TOTAL_LEDS}
            onChange={v => onChange({ snakeMaxLength: v })} />
          <ParamSlider label={p(t, 'brightness')} unit="%"
            value={config.brightness} min={0} max={100}
            onChange={v => onChange({ brightness: v })} />
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'help')}</div>
            <div className="param-info">{p(t, 'snakeHelp')}</div>
          </div>
        </div>
      );

    case 'screen':
      return (
        <div className="parameter-bar">
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'screenMirror')}</div>
            <div className="param-info">
              {screenActive ? p(t, 'screenCaptured') : p(t, 'screenWaiting')}
            </div>
          </div>
          <ParamSlider label={p(t, 'brightness')} unit="%"
            value={config.brightness} min={0} max={100}
            onChange={v => onChange({ brightness: v })} />
        </div>
      );

    case 'mic':
      return (
        <div className="parameter-bar mic-bar">
          <div className="param-block">
            <label className="param-label">{p(t, 'style')}</label>
            <div className="pill-row status-pill-row">
              {([
                ['spectrum', t.micModes.spectrum],
                ['dynamic', t.micModes.dynamic],
                ['rhythm', t.micModes.rhythm],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  className={`pill-btn${config.micMode === mode ? ' active' : ''}`}
                  onClick={() => onChange({ micMode: mode })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="param-block mic-direction-block">
            <label className="param-label">{p(t, 'direction')}</label>
            <div className="mic-direction-grid">
              {([
                ['right-left', t.micDirections['right-left']],
                ['left-right', t.micDirections['left-right']],
                ['top-bottom', t.micDirections['top-bottom']],
                ['bottom-top', t.micDirections['bottom-top']],
                ['inside-out', t.micDirections['inside-out']],
                ['outside-in', t.micDirections['outside-in']],
              ] as const).map(([direction, label]) => (
                <button
                  key={direction}
                  className={`pill-btn mic-direction-btn${config.micDirection === direction ? ' active' : ''}`}
                  onClick={() => onChange({ micDirection: direction })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ColorBlock label={p(t, 'baseColor')} outputLabel={p(t, 'output')}
            value={config.color} brightness={config.brightness}
            onChange={c => onChange({ color: c })} />
          <div className="param-block mic-sliders-block">
            <ParamSlider label={p(t, 'brightness')} unit="%"
              value={config.brightness} min={0} max={100}
              onChange={v => onChange({ brightness: v })} />
            <ParamSlider label={p(t, 'speed')} unit="%"
              value={config.speed} min={5} max={100}
              onChange={v => onChange({ speed: v })} />
          </div>
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'help')}</div>
            <div className="param-info">{p(t, 'micHelp')}</div>
          </div>
        </div>
      );

    case 'vibe':
      return (
        <div className="parameter-bar">
          <div className="param-block">
            <label className="param-label">{p(t, 'source')}</label>
            <div className="pill-row status-pill-row">
              {([['claude', 'Claude'], ['codex', 'Codex']] as const).map(([provider, label]) => (
                <button
                  key={provider}
                  className={`pill-btn${config.vibeProvider === provider ? ' active' : ''}`}
                  onClick={() => onChange({ vibeProvider: provider })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ColorBlock label={p(t, 'vibeBusy')} outputLabel={p(t, 'output')}
            value={config.vibeBusyColor} brightness={config.brightness}
            onChange={c => onChange({ vibeBusyColor: c })} />
          <ColorBlock label={p(t, 'vibeDone')} outputLabel={p(t, 'output')}
            value={config.vibeDoneColor} brightness={config.brightness}
            onChange={c => onChange({ vibeDoneColor: c })} />
          <ColorBlock label={p(t, 'vibeAllow')} outputLabel={p(t, 'output')}
            value={config.vibeAllowColor} brightness={config.brightness}
            onChange={c => onChange({ vibeAllowColor: c })} />
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'vibeStatus')}</div>
            <div className="param-info">{p(t, 'vibeHelp')}</div>
          </div>
        </div>
      );

    case 'keystroke':
      return (
        <div className="parameter-bar keystroke-bar">
          <div className="param-block keystroke-direction-block">
            <label className="param-label">{p(t, 'direction')}</label>
            <div className="keystroke-mode-grid">
              <div className="mode-group-label">{p(t, 'forward')}</div>
              {([
                ['left', t.keystroke.left],
                ['right', t.keystroke.right],
                ['both', t.keystroke.both],
                ['cross', t.keystroke.cross],
              ] as const).map(([mode, label]) => (
                <KeystrokeModeButton
                  key={mode}
                  active={config.keystrokeMode === mode}
                  label={label}
                  onClick={() => onChange({ keystrokeMode: mode })}
                />
              ))}
              <div className="mode-group-label reverse">{p(t, 'reverse')}</div>
              {([
                ['reverse-left', t.keystroke['reverse-left']],
                ['reverse-right', t.keystroke['reverse-right']],
                ['reverse-both', t.keystroke['reverse-both']],
                ['reverse-cross', t.keystroke['reverse-cross']],
              ] as const).map(([mode, label]) => (
                <KeystrokeModeButton
                  key={mode}
                  active={config.keystrokeMode === mode}
                  label={label}
                  onClick={() => onChange({ keystrokeMode: mode })}
                />
              ))}
            </div>
          </div>
          <ColorBlock label={p(t, 'lightColor')} outputLabel={p(t, 'output')}
            value={config.keystrokeColor} brightness={config.brightness}
            onChange={c => onChange({ keystrokeColor: c })} />
          <ParamSlider label={p(t, 'duration')} unit="ms"
            value={config.keystrokeDuration} min={180} max={2000} step={20}
            onChange={v => onChange({ keystrokeDuration: v })} />
          <ParamSlider label={p(t, 'brightness')} unit="%"
            value={config.brightness} min={0} max={100}
            onChange={v => onChange({ brightness: v })} />
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'help')}</div>
            <div className="param-info">{p(t, 'keystrokeHelp')}</div>
          </div>
        </div>
      );

    case 'perkey':
      return (
        <div className="parameter-bar">
          <ColorBlock label={p(t, 'brush')} outputLabel={p(t, 'output')}
            value={config.color} brightness={config.brightness}
            onChange={c => onChange({ color: c })} />
          <ParamSlider label={p(t, 'brightness')} unit="%"
            value={config.brightness} min={0} max={100}
            onChange={v => onChange({ brightness: v })} />
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'howTo')}</div>
            <div className="param-info">{perKeyHelp(t, perKeySelectedCount)}</div>
          </div>
          <div className="param-block">
            <label className="param-label">{p(t, 'operation')}</label>
            <button className="btn btn-secondary small" onClick={onPerKeyClear}>
              {p(t, 'clear')}
            </button>
          </div>
        </div>
      );

    case 'image':
      return (
        <div className="parameter-bar">
          <div className="param-block">
            <label className="param-label">{p(t, 'image')}</label>
            <button className="btn btn-primary small" onClick={() => fileRef.current?.click()}>
              {config.imageData ? p(t, 'replace') : p(t, 'upload')}
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleFile} />
          </div>
          {config.imageData && (
            <div className="param-block image-thumb-block">
              <label className="param-label">{p(t, 'thumbnail')}</label>
              <img className="image-thumb" src={config.imageData} alt="" />
            </div>
          )}
          <ParamSlider label={p(t, 'brightness')} unit="%"
            value={config.brightness} min={0} max={100}
            onChange={v => onChange({ brightness: v })} />
          <div className="param-block info-block">
            <div className="param-label">{p(t, 'algorithm')}</div>
            <div className="param-info">{p(t, 'imageHelp')}</div>
          </div>
        </div>
      );
  }
}

function KeystrokeModeButton({ active, label, onClick }: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`pill-btn keystroke-mode-btn${active ? ' active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function SubmodePicker({ value, onChange, t }: {
  value: NormalSubmode;
  onChange: (v: NormalSubmode) => void;
  t: I18nDict;
}) {
  return (
    <div className="param-block">
      <label className="param-label">{p(t, 'submode')}</label>
      <select className="factory-select" value={value} onChange={e => onChange(e.target.value as NormalSubmode)}>
        {NORMAL_SUBMODES.map(s =>
          <option key={s.key} value={s.key}>{t.normalSubmodes[s.key]}</option>)}
      </select>
    </div>
  );
}

function ColorBlock({ label, outputLabel, value, brightness = 100, onChange, disabled }: {
  label?: string;
  outputLabel: string;
  value: { r: number; g: number; b: number };
  brightness?: number;
  onChange: (c: { r: number; g: number; b: number }) => void;
  disabled?: boolean;
}) {
  const outputColor = applyBrightness(value, brightness);
  const outputHex = colorToHex(outputColor).toUpperCase();

  return (
    <div className={`param-block${disabled ? ' disabled' : ''}`}>
      <label className="param-label">{label}</label>
      <div className="color-control">
        <input
          type="color"
          value={colorToHex(value)}
          onChange={e => onChange(hexToColor(e.target.value))}
          className="color-picker-big"
          disabled={disabled}
        />
        <div className="rgb-inputs" aria-label={`${label} RGB channels`}>
          {(['r', 'g', 'b'] as const).map(channel => (
            <input
              key={channel}
              type="number"
              min={0}
              max={255}
              value={value[channel]}
              className="rgb-number"
              aria-label={`${channel.toUpperCase()} 0-255`}
              onChange={e => onChange({
                ...value,
                [channel]: clampChannel(Number(e.target.value)),
              })}
              disabled={disabled}
            />
          ))}
        </div>
        <input
          type="text"
          className="color-hex-input"
          value={colorToHex(value).toUpperCase()}
          onChange={e => {
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(hexToColor(e.target.value));
          }}
          disabled={disabled}
        />
      </div>
      <div className="output-color-row" aria-label={`${label} output color`}>
        <span className="output-color-label">{outputLabel}</span>
        <span className="output-color-dot" style={{ background: outputHex }} />
        <span className="output-color-hex">{outputHex}</span>
      </div>
      <div className="swatch-row">
        {COLOR_SWATCHES.map(({ name, color }) => (
          <button
            key={name}
            type="button"
            className="color-swatch"
            title={name}
            aria-label={`Set ${name}`}
            style={{ background: colorToHex(color) }}
            onClick={() => onChange(color)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function p(t: I18nDict, key: string): string {
  const value = t.params[key];
  return typeof value === 'function' ? value(0) : value ?? key;
}

function perKeyHelp(t: I18nDict, count: number): string {
  const value = t.params.perKeyHelp;
  return typeof value === 'function' ? value(count) : String(value ?? '');
}

function factoryName(t: I18nDict, zh: string, label: string): string {
  return t.language === 'zh' ? zh : label;
}

function clampChannel(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

interface SliderProps {
  label: string; value: number;
  min: number; max: number; step?: number;
  unit: string; disabled?: boolean;
  onChange: (v: number) => void;
}
function ParamSlider({ label, value, min, max, step = 1, unit, disabled, onChange }: SliderProps) {
  return (
    <div className={`param-block${disabled ? ' disabled' : ''}`}>
      <div className="param-row">
        <label className="param-label">{label}</label>
        <span className="param-value">{value}{unit}</span>
      </div>
      <input
        type="range" className="param-slider"
        min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}
