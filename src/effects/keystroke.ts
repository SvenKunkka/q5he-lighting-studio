import type { RGBColor } from '../types';
import { scaleRgbForOutput } from '../lighting/colorOutput';
import { RGB_KEY_GRID } from '../lighting/keyLayout';

export type KeystrokeMode =
  | 'left'
  | 'right'
  | 'both'
  | 'cross'
  | 'reverse-left'
  | 'reverse-right'
  | 'reverse-both'
  | 'reverse-cross';

export interface KeystrokeEvent {
  keyIndex: number;
  startTime: number;
}

const ROW_TOLERANCE = 0.36;
const COL_TOLERANCE = 0.55;

export function paintKeystrokes(
  events: KeystrokeEvent[],
  mode: KeystrokeMode,
  color: RGBColor,
  brightness: number,
  duration: number,
  totalLeds: number,
  time: number,
): RGBColor[] {
  const out: RGBColor[] = Array.from({ length: totalLeds }, () => ({ r: 0, g: 0, b: 0 }));
  const safeDuration = Math.max(180, duration);

  for (const event of events) {
    const elapsed = time - event.startTime;
    if (elapsed < 0 || elapsed > safeDuration) continue;

    const paths = buildPaths(event.keyIndex, mode);
    const travelEnd = safeDuration * 0.72;
    const lit = scaleColor(color, brightness);

    for (const path of paths) {
      if (path.length === 0) continue;
      const stepMs = travelEnd / Math.max(1, path.length);
      const activeStep = Math.min(path.length - 1, Math.floor(elapsed / stepMs));
      if (elapsed < travelEnd) {
        out[path[activeStep]] = lit;
      } else {
        const fade = 1 - (elapsed - travelEnd) / (safeDuration - travelEnd);
        out[event.keyIndex] = blend({ r: 0, g: 0, b: 0 }, lit, Math.max(0, fade));
      }
    }
  }

  return out;
}

function buildPaths(target: number, mode: KeystrokeMode): number[][] {
  const targetKey = RGB_KEY_GRID[target];
  if (!targetKey) return [];

  const row = RGB_KEY_GRID
    .map((k, index) => ({ ...k, index }))
    .filter(k => Math.abs(k.cy - targetKey.cy) <= ROW_TOLERANCE)
    .sort((a, b) => a.cx - b.cx);
  const col = RGB_KEY_GRID
    .map((k, index) => ({ ...k, index }))
    .filter(k => Math.abs(k.cx - targetKey.cx) <= COL_TOLERANCE)
    .sort((a, b) => a.cy - b.cy);

  const left = row.filter(k => k.cx <= targetKey.cx).map(k => k.index);
  const right = row.filter(k => k.cx >= targetKey.cx).reverse().map(k => k.index);
  const top = col.filter(k => k.cy <= targetKey.cy).map(k => k.index);
  const bottom = col.filter(k => k.cy >= targetKey.cy).reverse().map(k => k.index);
  const reverseLeft = [...left].reverse();
  const reverseRight = [...right].reverse();
  const reverseTop = [...top].reverse();
  const reverseBottom = [...bottom].reverse();

  if (mode === 'left') return [left];
  if (mode === 'right') return [right];
  if (mode === 'both') return [left, right];
  if (mode === 'cross') return [left, right, top, bottom];
  if (mode === 'reverse-left') return [reverseLeft];
  if (mode === 'reverse-right') return [reverseRight];
  if (mode === 'reverse-both') return [reverseLeft, reverseRight];
  return [reverseLeft, reverseRight, reverseTop, reverseBottom];
}

function scaleColor(c: RGBColor, brightness: number): RGBColor {
  return scaleRgbForOutput(c, brightness);
}

function blend(base: RGBColor, top: RGBColor, alpha: number): RGBColor {
  return {
    r: Math.round(base.r * (1 - alpha) + top.r * alpha),
    g: Math.round(base.g * (1 - alpha) + top.g * alpha),
    b: Math.round(base.b * (1 - alpha) + top.b * alpha),
  };
}
