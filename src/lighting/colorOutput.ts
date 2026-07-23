import type { RGBColor } from '../types';

type OutputOptions = {
  intensity?: number;
  allowBlack?: boolean;
  calibrated?: boolean;
};

const DEFAULT_CALIBRATION = {
  rGain: 1,
  gGain: 0.72,
  bGain: 0.62,
  gamma: 1.18,
};

export function scaleRgbForOutput(
  color: RGBColor,
  brightness: number,
  options: OutputOptions = {},
): RGBColor {
  const safe = clampRgb(color);
  const intensity = clamp01(options.intensity ?? 1);
  const level = clamp01(brightness / 100) * intensity;
  const isRawBlack = safe.r <= 0 && safe.g <= 0 && safe.b <= 0;

  if (options.allowBlack || isRawBlack || level <= 0) return { r: 0, g: 0, b: 0 };

  const scaled = {
    r: scaleChannel(safe.r, level),
    g: scaleChannel(safe.g, level),
    b: scaleChannel(safe.b, level),
  };

  return options.calibrated === false ? scaled : calibrateRgbForKeyboard(scaled);
}

export function clampRgb(color: RGBColor): RGBColor {
  return {
    r: clampByte(color.r),
    g: clampByte(color.g),
    b: clampByte(color.b),
  };
}

export function calibrateRgbForKeyboard(color: RGBColor): RGBColor {
  const safe = clampRgb(color);
  return {
    r: calibrateChannel(safe.r, DEFAULT_CALIBRATION.rGain, DEFAULT_CALIBRATION.gamma),
    g: calibrateChannel(safe.g, DEFAULT_CALIBRATION.gGain, DEFAULT_CALIBRATION.gamma),
    b: calibrateChannel(safe.b, DEFAULT_CALIBRATION.bGain, DEFAULT_CALIBRATION.gamma),
  };
}

export function uncalibrateRgbForPreview(color: RGBColor): RGBColor {
  const safe = clampRgb(color);
  return {
    r: uncalibrateChannel(safe.r, DEFAULT_CALIBRATION.rGain, DEFAULT_CALIBRATION.gamma),
    g: uncalibrateChannel(safe.g, DEFAULT_CALIBRATION.gGain, DEFAULT_CALIBRATION.gamma),
    b: uncalibrateChannel(safe.b, DEFAULT_CALIBRATION.bGain, DEFAULT_CALIBRATION.gamma),
  };
}

/* Scale a colour for on-screen preview rendering. Differs from
 * scaleRgbForOutput in three ways:
 *
 *   1. No per-channel min-floor clamp. The hardware path uses Math.max(1, …)
 *      to keep an LED visibly lit when the maths would otherwise round it
 *      off, but on screen that lift turns dim sibling channels into hue
 *      distortion (a low-intensity green ends up tinted teal because the B
 *      channel is forced up to 1 alongside G).
 *   2. No LED-physics calibration. The display is sRGB; the user picked the
 *      colour they want to see, so we render that colour directly.
 *   3. Perceptual gamma applied to the intensity envelope. A linear-light
 *      level of 0.1 maps to roughly 1% perceived brightness on a 2.2-gamma
 *      monitor — invisible. We apply gamma 1/2.2 to the intensity factor so
 *      the dim portion of breathing / marquee animations stays visibly the
 *      chosen hue while still feeling dim. The brightness slider stays
 *      linear so static modes (solid, etc.) match what the user dialled in.
 */
export function scaleRgbForPreview(
  color: RGBColor,
  brightness: number,
  intensity: number,
): RGBColor {
  const safe = clampRgb(color);
  if (safe.r <= 0 && safe.g <= 0 && safe.b <= 0) return { r: 0, g: 0, b: 0 };
  const brightnessLevel = clamp01(brightness / 100);
  const intensityLevel = clamp01(intensity);
  if (brightnessLevel <= 0 || intensityLevel <= 0) return { r: 0, g: 0, b: 0 };
  const perceptualIntensity = Math.pow(intensityLevel, 1 / 2.2);
  const level = brightnessLevel * perceptualIntensity;
  return {
    r: Math.min(255, Math.round(safe.r * level)),
    g: Math.min(255, Math.round(safe.g * level)),
    b: Math.min(255, Math.round(safe.b * level)),
  };
}

function scaleChannel(value: number, level: number): number {
  if (value <= 0) return 0;
  return Math.max(1, Math.min(255, Math.round(value * level)));
}

function calibrateChannel(value: number, gain: number, gamma: number): number {
  if (value <= 0) return 0;
  const normalized = value / 255;
  const corrected = Math.pow(normalized, gamma) * gain;
  return Math.max(1, Math.min(255, Math.round(corrected * 255)));
}

function uncalibrateChannel(value: number, gain: number, gamma: number): number {
  if (value <= 0 || gain <= 0) return 0;
  const normalized = Math.min(1, value / 255 / gain);
  return Math.max(1, Math.min(255, Math.round(Math.pow(normalized, 1 / gamma) * 255)));
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
