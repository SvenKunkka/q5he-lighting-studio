/* Map an uploaded image to per-key colours.
 *
 * Algorithm (matches user's spec):
 *   1. Compress the image to the keyboard grid's aspect ratio.
 *   2. Split into a grid of cells, one cell per key.
 *   3. For each cell, find the dominant colour (quantised mode).
 *   4. Return one colour per key.
 */
import type { RGBColor } from '../types';
import { RGB_KEY_GRID, GRID_COLS, GRID_ROWS } from '../lighting/keyLayout';

const GRID_W = GRID_COLS;  // 1 cell per 1u column
const GRID_H = GRID_ROWS;

export async function imageToKeyColors(
  dataUrl: string,
  totalLeds: number,
): Promise<RGBColor[]> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width  = GRID_W * 8;   // 8 samples per cell for dominant color
  canvas.height = GRID_H * 8;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Cover-fit: stretch image to fill keyboard aspect ratio
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const cellW = canvas.width  / GRID_W;
  const cellH = canvas.height / GRID_H;

  // Compute dominant color per cell
  const cells: RGBColor[][] = [];
  for (let cy = 0; cy < GRID_H; cy++) {
    const row: RGBColor[] = [];
    for (let cx = 0; cx < GRID_W; cx++) {
      row.push(dominantInCell(data, canvas.width, cx * cellW, cy * cellH, cellW, cellH));
    }
    cells.push(row);
  }

  // Map each key to its corresponding cell
  const out: RGBColor[] = new Array(totalLeds).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
  for (let i = 0; i < RGB_KEY_GRID.length && i < totalLeds; i++) {
    const k = RGB_KEY_GRID[i];
    const cx = Math.min(GRID_W - 1, Math.floor(k.nx * GRID_W));
    const cy = Math.min(GRID_H - 1, Math.floor(k.ny * GRID_H));
    const c = cells[cy][cx];
    out[i] = c;
  }
  return out;
}

function dominantInCell(
  data: Uint8ClampedArray, imgW: number,
  x0: number, y0: number, w: number, h: number,
): RGBColor {
  /* Quantise to 32-step buckets and find the most common one. */
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const xStart = Math.floor(x0), xEnd = Math.floor(x0 + w);
  const yStart = Math.floor(y0), yEnd = Math.floor(y0 + h);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const p = (y * imgW + x) * 4;
      const r = data[p] & 0xe0;
      const g = data[p + 1] & 0xe0;
      const b = data[p + 2] & 0xe0;
      const key = `${r},${g},${b}`;
      const e = buckets.get(key);
      if (e) e.count++;
      else buckets.set(key, { count: 1, r: data[p], g: data[p + 1], b: data[p + 2] });
    }
  }
  let best = { count: 0, r: 0, g: 0, b: 0 };
  for (const v of buckets.values()) if (v.count > best.count) best = v;
  return { r: best.r, g: best.g, b: best.b };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
