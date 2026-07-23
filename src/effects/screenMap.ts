/* Sample the captured screen at each key's normalised (nx, ny) position
 * and return per-key colours. */
import type { RGBColor } from '../types';
import { scaleRgbForOutput } from '../lighting/colorOutput';
import { RGB_KEY_GRID } from '../lighting/keyLayout';
import { ScreenSampler } from '../screen/sampler';

export class ScreenMirror {
  private sampler: ScreenSampler;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(sampler: ScreenSampler) {
    this.sampler = sampler;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 24;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  async start(onEnded?: () => void): Promise<void> { await this.sampler.start(onEnded); }
  stop(): void { this.sampler.stop(); }
  isActive(): boolean { return this.sampler.isActive(); }

  /** Sample current frame at each key position. */
  sampleKeys(brightness: number, totalLeds: number): RGBColor[] | null {
    const video = this.sampler.video;
    if (!video || video.readyState < 2) return null;
    const w = this.canvas.width, h = this.canvas.height;
    this.ctx.drawImage(video, 0, 0, w, h);
    const img = this.ctx.getImageData(0, 0, w, h).data;

    const out: RGBColor[] = new Array(totalLeds).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
    for (let i = 0; i < RGB_KEY_GRID.length && i < totalLeds; i++) {
      const g = RGB_KEY_GRID[i];
      const x = Math.min(w - 1, Math.floor(g.nx * w));
      const y = Math.min(h - 1, Math.floor(g.ny * h));
      const p = (y * w + x) * 4;
      out[i] = scaleRgbForOutput({ r: img[p], g: img[p + 1], b: img[p + 2] }, brightness);
    }
    return out;
  }
}
