import type { Preset, LightingConfig, EffectType } from '../types';
import { DEFAULT_CONFIG } from '../lighting/model';

const STORAGE_KEY = 'q5he_presets';
type LegacyLightingConfig = Omit<Partial<LightingConfig>, 'micMode'> & {
  effect?: unknown;
  micMode?: unknown;
  snakeBodyColor?: LightingConfig['snakeHeadColor'];
};
const VALID_EFFECTS: EffectType[] =
  ['normal', 'snake', 'screen', 'mic', 'vibe', 'keystroke', 'perkey', 'image', 'factory', 'off'];

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPresets();
    const ps = JSON.parse(raw) as Preset[];
    return ps.map(p => ({ ...p, config: migrateConfig(p.config) }));
  } catch {
    return getDefaultPresets();
  }
}

export function savePresets(presets: Preset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function createPreset(name: string, config: LightingConfig): Preset {
  return {
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    config: { ...config },
    createdAt: Date.now(),
  };
}

/* Migrate legacy effect names into the new 'normal' grouping */
export function migrateConfig(c: LegacyLightingConfig): LightingConfig {
  const { micMode, ...rest } = c;
  const merged: LightingConfig = { ...DEFAULT_CONFIG, ...rest };
  if (!VALID_EFFECTS.includes(merged.effect)) {
    const sub = ['solid', 'breathing', 'flashing', 'wave', 'marquee'].includes(String(c.effect))
      ? c.effect : 'solid';
    merged.effect = 'normal';
    merged.normalSubmode = sub as LightingConfig['normalSubmode'];
  }
  merged.perKeyColors = merged.perKeyColors ?? {};
  merged.imageColors  = merged.imageColors  ?? [];
  merged.snakeHeadColor = merged.snakeHeadColor
    ?? (c.snakeBodyColor as LightingConfig['snakeHeadColor'] | undefined)   // migrate legacy field name
    ?? DEFAULT_CONFIG.snakeHeadColor;
  merged.snakeMaxLength = merged.snakeMaxLength ?? DEFAULT_CONFIG.snakeMaxLength;
  if (micMode === 'level') merged.micMode = 'rhythm';
  else if (micMode === 'spectrum' || micMode === 'dynamic' || micMode === 'rhythm') merged.micMode = micMode;
  merged.micMode = merged.micMode ?? 'spectrum';
  merged.micDirection = merged.micDirection ?? 'left-right';
  return merged;
}

function getDefaultPresets(): Preset[] {
  return [
    createPreset('海蓝常亮', {
      ...DEFAULT_CONFIG, effect: 'normal', normalSubmode: 'solid',
      color: { r: 0, g: 120, b: 255 },
    }),
    createPreset('呼吸红', {
      ...DEFAULT_CONFIG, effect: 'normal', normalSubmode: 'breathing',
      color: { r: 255, g: 30, b: 30 }, speed: 40,
    }),
    createPreset('彩虹流水', {
      ...DEFAULT_CONFIG, effect: 'normal', normalSubmode: 'wave', speed: 60,
    }),
    createPreset('原厂彩虹横移', {
      ...DEFAULT_CONFIG, effect: 'factory', factoryId: 14,
    }),
  ];
}
