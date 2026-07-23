import type { LightingConfig, EffectType, NormalSubmode, MicMode, MicDirection } from '../types';
import { DEFAULT_CONFIG } from '../lighting/model';

/* Compact preset codec for the scalar fields only (we don't share
 * per-key colour maps or image data — those would blow up the code).
 * Format:  q5he:<base64url of 12 bytes>  → 21 chars total.
 *
 *   [0]  version (1)
 *   [1]  effect  (0=normal,1=snake,2=screen,3=mic,4=perkey,5=image,6=factory,7=off,8=vibe,9=keystroke)
 *   [2]  normalSubmode (0=solid,1=breathing,2=flashing,3=wave,4=marquee)
 *   [3]  factoryId
 *   [4]  R
 *   [5]  G
 *   [6]  B
 *   [7]  brightness
 *   [8]  speed
 *   [9]  duration
 *   [10..11] interval u16 LE
 *   [12] micMode (0=spectrum,1=dynamic,2=rhythm)
 *   [13] micDirection (0=right-left,1=left-right,2=top-bottom,3=bottom-top,4=inside-out,5=outside-in)
 */

const VERSION = 1;
const PREFIX  = 'q5he:';

const EFFECT_IDX: Record<EffectType, number> = {
  normal: 0, snake: 1, screen: 2, mic: 3, perkey: 4, image: 5, factory: 6, off: 7, vibe: 8, keystroke: 9,
};
const IDX_EFFECT: EffectType[] =
  ['normal','snake','screen','mic','perkey','image','factory','off','vibe','keystroke'];

const SUB_IDX: Record<NormalSubmode, number> = {
  solid: 0, breathing: 1, flashing: 2, wave: 3, marquee: 4,
};
const IDX_SUB: NormalSubmode[] = ['solid','breathing','flashing','wave','marquee'];

const MIC_IDX: Record<MicMode, number> = {
  spectrum: 0, dynamic: 1, rhythm: 2,
};
const IDX_MIC: MicMode[] = ['spectrum', 'dynamic', 'rhythm'];

const MIC_DIR_IDX: Record<MicDirection, number> = {
  'right-left': 0,
  'left-right': 1,
  'top-bottom': 2,
  'bottom-top': 3,
  'inside-out': 4,
  'outside-in': 5,
};
const IDX_MIC_DIR: MicDirection[] = ['right-left', 'left-right', 'top-bottom', 'bottom-top', 'inside-out', 'outside-in'];

export function encodeConfig(c: LightingConfig): string {
  const buf = new Uint8Array(14);
  buf[0]  = VERSION;
  buf[1]  = EFFECT_IDX[c.effect] ?? 0;
  buf[2]  = SUB_IDX[c.normalSubmode] ?? 0;
  buf[3]  = c.factoryId & 0xff;
  buf[4]  = c.color.r & 0xff;
  buf[5]  = c.color.g & 0xff;
  buf[6]  = c.color.b & 0xff;
  buf[7]  = clamp(c.brightness, 0, 100);
  buf[8]  = clamp(c.speed,      0, 100);
  buf[9]  = clamp(c.duration,   0, 60);
  const iv = clamp(c.interval, 0, 65535);
  buf[10] = iv & 0xff;
  buf[11] = (iv >> 8) & 0xff;
  buf[12] = MIC_IDX[c.micMode] ?? 0;
  buf[13] = MIC_DIR_IDX[c.micDirection] ?? 1;
  return PREFIX + b64UrlEncode(buf);
}

export function decodeConfig(input: string): LightingConfig {
  const t = input.trim();
  if (!t.startsWith(PREFIX)) throw new Error('Invalid code (expected q5he:…)');
  const buf = b64UrlDecode(t.slice(PREFIX.length));
  if (buf.length < 12) throw new Error('Code too short');
  if (buf[0] !== VERSION) throw new Error(`Unsupported version ${buf[0]}`);
  return {
    ...DEFAULT_CONFIG,
    effect:        IDX_EFFECT[buf[1]] ?? 'normal',
    normalSubmode: IDX_SUB[buf[2]]    ?? 'solid',
    factoryId:     buf[3],
    color:         { r: buf[4], g: buf[5], b: buf[6] },
    brightness:    buf[7],
    speed:         buf[8],
    duration:      buf[9],
    interval:      buf[10] | (buf[11] << 8),
    micMode:       IDX_MIC[buf[12]] ?? DEFAULT_CONFIG.micMode,
    micDirection:  IDX_MIC_DIR[buf[13]] ?? DEFAULT_CONFIG.micDirection,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
function b64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
