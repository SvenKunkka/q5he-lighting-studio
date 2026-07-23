import type { RGBColor, LedFrameColor, LightingConfig, EffectType, NormalSubmode } from '../types';
import { scaleRgbForOutput, scaleRgbForPreview } from './colorOutput';
import { hueByteFromDegrees, qmkHsvToRgb, QMK_RGB } from './qmkColor';

/* Render targets for the normal-effect frame computation.
 *  - 'device'  → physically calibrated, min-floor clamped (for HID output).
 *  - 'preview' → sRGB-direct with perceptual gamma on intensity, no
 *                hue-shifting min-floor (for the on-screen keyboard view).
 * Breathing additionally locks the brightness slider to 100% so the
 * animation is fully expressed by its envelope, not muted by a second
 * brightness multiplier. */
export type NormalRenderTarget = 'device' | 'preview';

/* Brightness used during breathing regardless of the config slider. The
 * breathing envelope already owns the bright→off→bright sweep, so layering
 * the brightness slider on top would just shrink the visible amplitude. */
const BREATHING_PEAK_BRIGHTNESS = 100;

export const DEFAULT_CONFIG: LightingConfig = {
  effect: 'normal',
  normalSubmode: 'solid',
  color: QMK_RGB.azure,
  brightness: 50,
  speed: 50,
  duration: 0,
  interval: 500,
  factoryId: 14,
  snakeHeadColor: QMK_RGB.springgreen,
  snakeMaxLength: 30,
  micMode: 'spectrum',
  micDirection: 'left-right',
  vibeProvider: 'codex',
  vibeBusyColor: QMK_RGB.blue,
  vibeDoneColor: QMK_RGB.green,
  vibeAllowColor: QMK_RGB.red,
  keystrokeMode: 'left',
  keystrokeColor: QMK_RGB.azure,
  keystrokeDuration: 650,
  perKeyColors: {},
  imageData: null,
  imageColors: [],
};

export const EFFECT_META: Array<{
  key: EffectType; label: string; icon: string;
}> = [
  { key: 'normal',  label: 'Normal',     icon: '◐' },
  { key: 'snake',   label: 'Snake',      icon: '⌇' },
  { key: 'screen',  label: 'Screen',     icon: '▦' },
  { key: 'mic',     label: 'Mic',        icon: '♪' },
  { key: 'vibe',    label: 'Vibe',       icon: '◆' },
  { key: 'keystroke', label: 'Keystroke', icon: '↯' },
  { key: 'perkey',  label: 'Per-Key',    icon: '⊞' },
  { key: 'image',   label: 'Image',      icon: '🖼' },
  { key: 'factory', label: 'Factory',    icon: '✦' },
  { key: 'off',     label: 'Off',        icon: '○' },
];

export const NORMAL_SUBMODES: Array<{ key: NormalSubmode }> = [
  { key: 'solid' },
  { key: 'breathing' },
  { key: 'flashing' },
  { key: 'wave' },
  { key: 'marquee' },
];

export const FACTORY_EFFECTS: Array<{ id: number; zh: string; label: string }> = [
  { id:  0, zh: '螺旋亮度带',  label: 'Band Spiral Val' },
  { id:  1, zh: '呼吸',        label: 'Breathing' },
  { id:  2, zh: '彩虹循环',    label: 'Cycle All' },
  { id:  3, zh: '左右循环',    label: 'Cycle Left ↔ Right' },
  { id:  4, zh: '外向内循环',  label: 'Cycle Out → In' },
  { id:  5, zh: '双向外向内',  label: 'Cycle Out → In Dual' },
  { id:  6, zh: '风车循环',    label: 'Cycle Pinwheel' },
  { id:  7, zh: '螺旋循环',    label: 'Cycle Spiral' },
  { id:  8, zh: '上下循环',    label: 'Cycle Up ↕ Down' },
  { id:  9, zh: '数字雨',      label: 'Digital Rain' },
  { id: 10, zh: '双灯塔',      label: 'Dual Beacon' },
  { id: 11, zh: '彩虹雨滴',    label: 'Jellybean Raindrops' },
  { id: 12, zh: '像素雨',      label: 'Pixel Rain' },
  { id: 13, zh: '彩虹灯塔',    label: 'Rainbow Beacon' },
  { id: 14, zh: '彩虹横移',    label: 'Rainbow Moving Chevron' },
  { id: 15, zh: '反应多枢',    label: 'Solid Reactive Multinexus' },
  { id: 16, zh: '反应多波',    label: 'Solid Reactive Multiwide' },
  { id: 17, zh: '简单反应',    label: 'Solid Reactive Simple' },
  { id: 18, zh: '单色泼溅',    label: 'Solid Splash' },
  { id: 19, zh: '彩色泼溅',    label: 'Splash' },
  { id: 20, zh: '打字热力图',  label: 'Typing Heatmap' },
];

export function colorToHex(c: RGBColor): string {
  return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function hexToColor(hex: string): RGBColor {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
export function applyBrightness(color: RGBColor, brightness: number): RGBColor {
  return scaleRgbForOutput(color, brightness);
}
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r)      h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h = Math.round((h / 6) * 255);
    if (h < 0) h += 255;
  }
  const s = max === 0 ? 0 : Math.round((d / max) * 255);
  const v = Math.round(max * 255);
  return { h, s, v };
}

/* Fraction of the breathing cosine envelope (and marquee linear ramp) that
 * is mapped to the LED being fully OFF rather than just dim. The intent is
 * "fade -> off -> fade", so the user perceives the key extinguishing in the
 * middle of the cycle instead of fading to a near-black mystery colour. */
const BREATHING_OFF_FLOOR = 0.18;
const MARQUEE_TAIL_OFF_FLOOR = 0.12;

export function computeNormalKeyFrameColor(
  config: LightingConfig,
  keyIndex: number,
  totalKeys: number,
  time: number,
  target: NormalRenderTarget = 'preview',
): LedFrameColor {
  const { normalSubmode: sub, color, brightness, speed } = config;
  const speedFactor = Math.max(0.2, speed / 50);

  if (sub === 'solid') return activeNormalColor(color, brightness, 1, target);
  if (sub === 'breathing') {
    const period = 3000 / speedFactor;
    const env = 0.5 - 0.5 * Math.cos(((time % period) / period) * Math.PI * 2);
    // Reshape the cosine envelope so the bottom slice of the curve maps to
    // a true OFF state. The visible range (env > BREATHING_OFF_FLOOR) is
    // remapped to 0..1 so the user still gets the full bright→dim sweep
    // before the LED extinguishes, then re-ignites and ramps back up.
    if (env <= BREATHING_OFF_FLOOR) return offFrameColor();
    const intensity = (env - BREATHING_OFF_FLOOR) / (1 - BREATHING_OFF_FLOOR);
    // Breathing ignores the brightness slider; the envelope IS the brightness
    // expression. The UI hides the slider in this mode, so don't double-dip.
    return activeNormalColor(color, BREATHING_PEAK_BRIGHTNESS, intensity, target);
  }
  if (sub === 'flashing') {
    const period = 1500 / speedFactor;
    const on = (time % period) < period / 2;
    return on ? activeNormalColor(color, brightness, 1, target) : offFrameColor();
  }
  if (sub === 'wave') {
    const period = 2000 / speedFactor;
    const offset = keyIndex / totalKeys;
    const phase = ((time % period) / period + offset) % 1;
    const hue = (phase * 360 + 200) % 360;
    return activeNormalColor(qmkWheel(hue), brightness, 1, target);
  }
  if (sub === 'marquee') {
    const period = 3000 / speedFactor;
    const head = ((time % period) / period) * totalKeys;
    const bandWidth = Math.max(6, totalKeys / 6);
    let dist = (keyIndex - head + totalKeys) % totalKeys;
    if (dist < 0) dist += totalKeys;
    // Keys outside the moving band are OFF (key cap shown) — no background
    // glow, so the user reads "the marquee is travelling across an otherwise
    // dark keyboard" rather than "everything is faintly tinted".
    if (dist >= bandWidth) return offFrameColor();
    // Inside the band, head is brightest; the tail fades smoothly into OFF
    // via the same threshold treatment as breathing, so the trailing edge
    // does not snap from dim glow to key cap.
    const linear = 1 - dist / bandWidth;
    if (linear <= MARQUEE_TAIL_OFF_FLOOR) return offFrameColor();
    const intensity = (linear - MARQUEE_TAIL_OFF_FLOOR) / (1 - MARQUEE_TAIL_OFF_FLOOR);
    return activeNormalColor(color, brightness, intensity, target);
  }
  return offFrameColor();
}

export function computeFactoryPreviewKeyColor(
  config: LightingConfig,
  keyIndex: number,
  totalKeys: number,
  time: number,
  nx = keyIndex / Math.max(1, totalKeys - 1),
  ny = 0.5,
): RGBColor {
  const speedFactor = Math.max(0.25, config.speed / 50);
  const t = (time / (3500 / speedFactor)) % 1;
  const baseHue = (t * 360) % 360;
  const phaseX = (nx + t) % 1;
  const phaseY = (ny + t) % 1;
  const color = config.color;

  switch (config.factoryId) {
    case 0:
      return scaleRgbForOutput(color, config.brightness, { intensity: pulse((nx + ny + t) % 1) });
    case 1:
      return computeNormalKeyFrameColor({ ...config, normalSubmode: 'breathing' }, keyIndex, totalKeys, time);
    case 2:
      return applyBrightness(qmkWheel(baseHue), config.brightness);
    case 3:
      return applyBrightness(qmkWheel((phaseX * 360) % 360), config.brightness);
    case 4:
    case 5: {
      const d = Math.abs(nx - 0.5) + Math.abs(ny - 0.5);
      return applyBrightness(qmkWheel(((d + t) % 1) * 360), config.brightness);
    }
    case 6: {
      const angle = Math.atan2(ny - 0.5, nx - 0.5) / (Math.PI * 2) + 0.5;
      return applyBrightness(qmkWheel(((angle + t) % 1) * 360), config.brightness);
    }
    case 7:
      return applyBrightness(qmkWheel(((nx + ny + t) % 1) * 360), config.brightness);
    case 8:
      return applyBrightness(qmkWheel((phaseY * 360) % 360), config.brightness);
    case 9:
    case 12: {
      const rain = seededNoise(keyIndex, Math.floor(time / Math.max(80, 260 - config.speed * 1.6)));
      return rain > 0.72
        ? scaleRgbForOutput(QMK_RGB.springgreen, config.brightness, { intensity: rain })
        : { r: 0, g: 0, b: 0 };
    }
    case 10:
      return scaleRgbForOutput(color, config.brightness, { intensity: Math.max(pulse(phaseX), pulse((1 - nx + t) % 1)) });
    case 11:
      return applyBrightness(qmkWheel(seededNoise(keyIndex, Math.floor(time / 180)) * 360), config.brightness);
    case 13:
      return applyBrightness(qmkWheel(baseHue + pulse(phaseX) * 80), config.brightness);
    case 14:
      return applyBrightness(qmkWheel(((nx * 0.7 + ny * 0.3 + t) % 1) * 360), config.brightness);
    case 15:
    case 16:
    case 17:
      return scaleRgbForOutput(color, config.brightness, { intensity: Math.max(0.16, pulse((nx + t) % 1)) });
    case 18:
      return scaleRgbForOutput(color, config.brightness, { intensity: pulse((Math.abs(nx - 0.5) + Math.abs(ny - 0.5) + t) % 1) });
    case 19:
      return scaleRgbForOutput(qmkWheel(((nx + ny + t * 1.4) % 1) * 360), config.brightness, { intensity: pulse((nx + t) % 1) });
    case 20: {
      const heat = Math.max(0, 1 - ((ny + t) % 1));
      return scaleRgbForOutput({ r: 255, g: Math.round(180 * heat), b: 0 }, config.brightness, { intensity: heat });
    }
    default:
      return applyBrightness(qmkWheel((baseHue + keyIndex * 7) % 360), config.brightness);
  }
}

function pulse(x: number): number {
  return 0.5 - 0.5 * Math.cos(x * Math.PI * 2);
}

function activeNormalColor(
  color: RGBColor,
  brightness: number,
  intensity = 1,
  target: NormalRenderTarget = 'preview',
): LedFrameColor {
  if (brightness <= 0) return offFrameColor();
  const scaled = target === 'device'
    ? scaleRgbForOutput(color, brightness, { intensity, calibrated: true })
    : scaleRgbForPreview(color, brightness, intensity);
  return { ...scaled, active: !isBlack(scaled) };
}

function offFrameColor(): LedFrameColor {
  return { r: 0, g: 0, b: 0, active: false };
}

function isBlack(color: RGBColor): boolean {
  return color.r === 0 && color.g === 0 && color.b === 0;
}

function seededNoise(index: number, frame: number): number {
  const n = Math.sin(index * 12.9898 + frame * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function qmkWheel(hueDegrees: number): RGBColor {
  return qmkHsvToRgb({ h: hueByteFromDegrees(hueDegrees), s: 255, v: 255 });
}
