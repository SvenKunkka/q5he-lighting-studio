/* Auto-piloted Snake — keyboard graph mode.
 *
 *  Idle until the user presses the first key.
 *  Every RGB key on the Q5 HE is traversable. The wall is outside the
 *  physical key graph, not the outer ring of keys. The graph bridges
 *  alpha/nav/numpad regions through nearest-cardinal neighbours.
 *  Food appears at a random unlit non-wall position with a random colour.
 *  AI uses BFS toward the food while avoiding itself. If food is unreachable,
 *  the snake takes a survival step toward food via the closest free neighbour.
 *  If no neighbour is free → death (red flash).
 *  Body segments keep the colour of the food that created them.
 */

import type { RGBColor } from '../types';
import { scaleRgbForOutput } from '../lighting/colorOutput';
import { RGB_KEY_LAYOUT, RGB_ADJACENCY } from '../lighting/keyLayout';

export interface SnakeState {
  active: boolean;
  positions: number[];          // [0]=head, [1..N]=body
  bodyColors: RGBColor[];       // length = positions.length - 1
  food: { idx: number; color: RGBColor } | null;
  resetUntil: number;
  nextTickAt: number;
}

const ALL_KEYS: number[] = RGB_ADJACENCY.map((_, i) => i);

export function createSnake(): SnakeState {
  return {
    active: false, positions: [], bodyColors: [],
    food: null, resetUntil: 0, nextTickAt: 0,
  };
}

export function startSnake(s: SnakeState, headIdx: number, now: number): SnakeState {
  if (headIdx < 0 || headIdx >= RGB_KEY_LAYOUT.length) return s;
  return {
    active: true,
    positions: [headIdx],
    bodyColors: [],
    food: spawnFood([headIdx]),
    resetUntil: 0,
    nextTickAt: now,
  };
}

export function tickSnake(s: SnakeState, now: number, tickMs: number, maxLen: number): SnakeState {
  if (s.resetUntil > 0) {
    if (now >= s.resetUntil) return createSnake();
    return s;
  }
  if (!s.active || now < s.nextTickAt) return s;
  if (!s.food) return s;

  const head = s.positions[0];
  const next = chooseNextMove(head, s.positions, s.food.idx);

  if (next === -1) return { ...s, resetUntil: now + 350 };

  if (next === s.food.idx) {
    const newPositions = [next, ...s.positions];
    const newColors    = [s.food.color, ...s.bodyColors];
    while (newPositions.length > maxLen) {
      newPositions.pop();
      newColors.pop();
    }
    return {
      ...s, positions: newPositions, bodyColors: newColors,
      food: spawnFood(newPositions), nextTickAt: now + tickMs,
    };
  }

  const newPositions = [next, ...s.positions];
  newPositions.pop();
  return { ...s, positions: newPositions, nextTickAt: now + tickMs };
}

export function paintSnake(
  s: SnakeState, headColor: RGBColor, brightness: number, totalLeds: number, now: number,
): RGBColor[] {
  const out: RGBColor[] = new Array(totalLeds).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));

  if (s.resetUntil > 0 && now < s.resetUntil) {
    const fadeOut = 1 - (now % 200) / 200;
    for (let i = 0; i < totalLeds; i++) out[i] = scaleRgbForOutput({ r: 255, g: 0, b: 0 }, brightness, { intensity: fadeOut });
    return out;
  }

  for (let i = 1; i < s.positions.length; i++) {
    const idx = s.positions[i];
    const c = s.bodyColors[i - 1];
    if (idx >= 0 && idx < totalLeds && c) {
      out[idx] = scaleRgbForOutput(c, brightness);
    }
  }

  if (s.positions.length > 0) {
    const head = s.positions[0];
    if (head >= 0 && head < totalLeds) {
      out[head] = scaleRgbForOutput(headColor, brightness);
    }
  }

  if (s.food && s.food.idx < totalLeds) {
    const whiteMix = 0.5 + 0.5 * Math.sin(now / 120);
    const c = mixColor(s.food.color, { r: 255, g: 255, b: 255 }, whiteMix);
    out[s.food.idx] = scaleRgbForOutput(c, brightness);
  }
  return out;
}

function mixColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
  };
}

/* BFS on the physical key adjacency graph. Returns the first step on
 * the shortest path to food,
 * or a greedy safe step if food is unreachable, or -1 if trapped. */
function chooseNextMove(head: number, body: number[], foodIdx: number): number {
  const blocked = new Set<number>();
  for (let i = 0; i < body.length - 1; i++) blocked.add(body[i]); // tail will move

  const parent: Record<number, number> = {};
  const visited = new Set<number>([head]);
  const queue: number[] = [head];
  let found = false;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === foodIdx) { found = true; break; }
    for (const n of RGB_ADJACENCY[cur]) {
      if (visited.has(n)) continue;
      if (blocked.has(n) && n !== foodIdx) continue;
      visited.add(n);
      parent[n] = cur;
      queue.push(n);
    }
  }

  if (found) {
    let cur = foodIdx;
    while (parent[cur] !== undefined && parent[cur] !== head) cur = parent[cur];
    return cur;
  }

  // Survival step: any safe neighbour (no body collision), greedy toward food
  const safe = RGB_ADJACENCY[head].filter(n => !blocked.has(n));
  if (safe.length === 0) return -1;
  const foodK = RGB_KEY_LAYOUT[foodIdx];
  safe.sort((a, b) => {
    const ka = RGB_KEY_LAYOUT[a], kb = RGB_KEY_LAYOUT[b];
    const da = Math.hypot(ka.x - foodK.x, ka.y - foodK.y);
    const db = Math.hypot(kb.x - foodK.x, kb.y - foodK.y);
    return da - db;
  });
  return safe[0];
}

function spawnFood(occupied: number[]): { idx: number; color: RGBColor } {
  const free = ALL_KEYS.filter(i => !occupied.includes(i));
  const idx = free[Math.floor(Math.random() * free.length)] ?? 0;
  return { idx, color: randomVividColor() };
}

function randomVividColor(): RGBColor {
  const h = Math.random() * 360;
  const c = 1, x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) {         g = c; b = x; }
  else if (h < 240) {         g = x; b = c; }
  else if (h < 300) { r = x;         b = c; }
  else              { r = c;         b = x; }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
