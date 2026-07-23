import type { RGBColor } from '../types';

export type QmkHsv = { h: number; s: number; v: number };

export const QMK_RGB = {
  azure: { r: 0x99, g: 0xF5, b: 0xFF },
  blue: { r: 0x00, g: 0x00, b: 0xFF },
  cyan: { r: 0x00, g: 0xFF, b: 0xFF },
  green: { r: 0x00, g: 0xFF, b: 0x00 },
  orange: { r: 0xFF, g: 0x80, b: 0x00 },
  pink: { r: 0xFF, g: 0x80, b: 0xBF },
  purple: { r: 0x7A, g: 0x00, b: 0xFF },
  red: { r: 0xFF, g: 0x00, b: 0x00 },
  springgreen: { r: 0x00, g: 0xFF, b: 0x80 },
  white: { r: 0xFF, g: 0xFF, b: 0xFF },
  yellow: { r: 0xFF, g: 0xFF, b: 0x00 },
} as const satisfies Record<string, RGBColor>;

export function qmkHsvToRgb(hsv: QmkHsv): RGBColor {
  const h = clampByte(hsv.h);
  const s = clampByte(hsv.s);
  const v = clampByte(hsv.v);

  if (s === 0) return { r: v, g: v, b: v };

  const region = Math.floor(h * 6 / 255);
  const remainder = (h * 2 - region * 85) * 3;
  const p = (v * (255 - s)) >> 8;
  const q = (v * (255 - ((s * remainder) >> 8))) >> 8;
  const t = (v * (255 - ((s * (255 - remainder)) >> 8))) >> 8;

  switch (region) {
    case 0:
    case 6:
      return { r: v, g: t, b: p };
    case 1:
      return { r: q, g: v, b: p };
    case 2:
      return { r: p, g: v, b: t };
    case 3:
      return { r: p, g: q, b: v };
    case 4:
      return { r: t, g: p, b: v };
    default:
      return { r: v, g: p, b: q };
  }
}

export function hueByteFromDegrees(hue: number): number {
  return clampByte(Math.round((((hue % 360) + 360) % 360) * 255 / 360));
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}
