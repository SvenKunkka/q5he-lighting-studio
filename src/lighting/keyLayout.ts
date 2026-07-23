/* Keychron Q5 HE — exact physical layout from the QMK keyboard.json.
 * Coordinates are in 1u units. The top-right encoder is a physical control,
 * but it does not consume a per-key RGB LED slot in the 101-LED firmware
 * buffer, so RGB effects use RGB_KEY_LAYOUT / TOTAL_LEDS below. */

interface KeyDef {
  id: string;
  label: string;
  x: number; y: number;
  w: number; h: number;
}

export const Q5HE_LAYOUT: KeyDef[] = [
  { id: 'esc',   label: 'Esc',   x: 0,     y: 0,    w: 1,    h: 1 },
  { id: 'f1',    label: 'F1',    x: 2,     y: 0,    w: 1,    h: 1 },
  { id: 'f2',    label: 'F2',    x: 3,     y: 0,    w: 1,    h: 1 },
  { id: 'f3',    label: 'F3',    x: 4,     y: 0,    w: 1,    h: 1 },
  { id: 'f4',    label: 'F4',    x: 5,     y: 0,    w: 1,    h: 1 },
  { id: 'f5',    label: 'F5',    x: 6.5,   y: 0,    w: 1,    h: 1 },
  { id: 'f6',    label: 'F6',    x: 7.5,   y: 0,    w: 1,    h: 1 },
  { id: 'f7',    label: 'F7',    x: 8.5,   y: 0,    w: 1,    h: 1 },
  { id: 'f8',    label: 'F8',    x: 9.5,   y: 0,    w: 1,    h: 1 },
  { id: 'f9',    label: 'F9',    x: 11,    y: 0,    w: 1,    h: 1 },
  { id: 'f10',   label: 'F10',   x: 12,    y: 0,    w: 1,    h: 1 },
  { id: 'f11',   label: 'F11',   x: 13,    y: 0,    w: 1,    h: 1 },
  { id: 'f12',   label: 'F12',   x: 14,    y: 0,    w: 1,    h: 1 },
  { id: 'del',   label: 'Del',   x: 15.25, y: 0,    w: 1,    h: 1 },
  { id: 'f13',   label: 'F13',   x: 16.5,  y: 0,    w: 1,    h: 1 },
  { id: 'f14',   label: 'F14',   x: 17.5,  y: 0,    w: 1,    h: 1 },
  { id: 'f15',   label: 'F15',   x: 18.5,  y: 0,    w: 1,    h: 1 },
  { id: 'knob',  label: '◉',     x: 19.5,  y: 0,    w: 1,    h: 1 },

  { id: 'grave', label: '`',     x: 0,     y: 1.25, w: 1,    h: 1 },
  { id: '1',     label: '1',     x: 1,     y: 1.25, w: 1,    h: 1 },
  { id: '2',     label: '2',     x: 2,     y: 1.25, w: 1,    h: 1 },
  { id: '3',     label: '3',     x: 3,     y: 1.25, w: 1,    h: 1 },
  { id: '4',     label: '4',     x: 4,     y: 1.25, w: 1,    h: 1 },
  { id: '5',     label: '5',     x: 5,     y: 1.25, w: 1,    h: 1 },
  { id: '6',     label: '6',     x: 6,     y: 1.25, w: 1,    h: 1 },
  { id: '7',     label: '7',     x: 7,     y: 1.25, w: 1,    h: 1 },
  { id: '8',     label: '8',     x: 8,     y: 1.25, w: 1,    h: 1 },
  { id: '9',     label: '9',     x: 9,     y: 1.25, w: 1,    h: 1 },
  { id: '0',     label: '0',     x: 10,    y: 1.25, w: 1,    h: 1 },
  { id: 'minus', label: '-',     x: 11,    y: 1.25, w: 1,    h: 1 },
  { id: 'equal', label: '=',     x: 12,    y: 1.25, w: 1,    h: 1 },
  { id: 'bspc',  label: 'Bksp',  x: 13,    y: 1.25, w: 2,    h: 1 },
  { id: 'pgup',  label: 'PgUp',  x: 15.25, y: 1.25, w: 1,    h: 1 },
  { id: 'numlock', label: 'Num', x: 16.5,  y: 1.25, w: 1,    h: 1 },
  { id: 'kp/',   label: '/',     x: 17.5,  y: 1.25, w: 1,    h: 1 },
  { id: 'kp*',   label: '*',     x: 18.5,  y: 1.25, w: 1,    h: 1 },
  { id: 'kp-',   label: '-',     x: 19.5,  y: 1.25, w: 1,    h: 1 },

  { id: 'tab',   label: 'Tab',   x: 0,     y: 2.25, w: 1.5,  h: 1 },
  { id: 'q',     label: 'Q',     x: 1.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'w',     label: 'W',     x: 2.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'e',     label: 'E',     x: 3.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'r',     label: 'R',     x: 4.5,   y: 2.25, w: 1,    h: 1 },
  { id: 't',     label: 'T',     x: 5.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'y',     label: 'Y',     x: 6.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'u',     label: 'U',     x: 7.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'i',     label: 'I',     x: 8.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'o',     label: 'O',     x: 9.5,   y: 2.25, w: 1,    h: 1 },
  { id: 'p',     label: 'P',     x: 10.5,  y: 2.25, w: 1,    h: 1 },
  { id: 'lbrc',  label: '[',     x: 11.5,  y: 2.25, w: 1,    h: 1 },
  { id: 'rbrc',  label: ']',     x: 12.5,  y: 2.25, w: 1,    h: 1 },
  { id: 'bsls',  label: '\\',    x: 13.5,  y: 2.25, w: 1.5,  h: 1 },
  { id: 'pgdn',  label: 'PgDn',  x: 15.25, y: 2.25, w: 1,    h: 1 },
  { id: 'kp7',   label: '7',     x: 16.5,  y: 2.25, w: 1,    h: 1 },
  { id: 'kp8',   label: '8',     x: 17.5,  y: 2.25, w: 1,    h: 1 },
  { id: 'kp9',   label: '9',     x: 18.5,  y: 2.25, w: 1,    h: 1 },

  { id: 'caps',  label: 'Caps',  x: 0,     y: 3.25, w: 1.75, h: 1 },
  { id: 'a',     label: 'A',     x: 1.75,  y: 3.25, w: 1,    h: 1 },
  { id: 's',     label: 'S',     x: 2.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'd',     label: 'D',     x: 3.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'f',     label: 'F',     x: 4.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'g',     label: 'G',     x: 5.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'h',     label: 'H',     x: 6.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'j',     label: 'J',     x: 7.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'k',     label: 'K',     x: 8.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'l',     label: 'L',     x: 9.75,  y: 3.25, w: 1,    h: 1 },
  { id: 'scln',  label: ';',     x: 10.75, y: 3.25, w: 1,    h: 1 },
  { id: 'quot',  label: '\'',    x: 11.75, y: 3.25, w: 1,    h: 1 },
  { id: 'ent',   label: 'Enter', x: 12.75, y: 3.25, w: 2.25, h: 1 },
  { id: 'home',  label: 'Home',  x: 15.25, y: 3.25, w: 1,    h: 1 },
  { id: 'kp4',   label: '4',     x: 16.5,  y: 3.25, w: 1,    h: 1 },
  { id: 'kp5',   label: '5',     x: 17.5,  y: 3.25, w: 1,    h: 1 },
  { id: 'kp6',   label: '6',     x: 18.5,  y: 3.25, w: 1,    h: 1 },
  /* tall 2u key spanning rows 2-3 */
  { id: 'kp+',   label: '+',     x: 19.5,  y: 2.25, w: 1,    h: 2 },

  { id: 'lsft',  label: 'Shift', x: 0,     y: 4.25, w: 2.25, h: 1 },
  { id: 'z',     label: 'Z',     x: 2.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'x',     label: 'X',     x: 3.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'c',     label: 'C',     x: 4.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'v',     label: 'V',     x: 5.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'b',     label: 'B',     x: 6.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'n',     label: 'N',     x: 7.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'm',     label: 'M',     x: 8.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'comm',  label: ',',     x: 9.25,  y: 4.25, w: 1,    h: 1 },
  { id: 'dot',   label: '.',     x: 10.25, y: 4.25, w: 1,    h: 1 },
  { id: 'slsh',  label: '/',     x: 11.25, y: 4.25, w: 1,    h: 1 },
  { id: 'rsft',  label: 'Shift', x: 12.25, y: 4.25, w: 1.75, h: 1 },
  /* Arrow keys sit half-row lower than their nominal row */
  { id: 'up',    label: '↑',     x: 14.25, y: 4.5,  w: 1,    h: 1 },
  { id: 'kp1',   label: '1',     x: 16.5,  y: 4.25, w: 1,    h: 1 },
  { id: 'kp2',   label: '2',     x: 17.5,  y: 4.25, w: 1,    h: 1 },
  { id: 'kp3',   label: '3',     x: 18.5,  y: 4.25, w: 1,    h: 1 },

  { id: 'lctl',  label: 'Ctrl',  x: 0,     y: 5.25, w: 1.25, h: 1 },
  { id: 'lwin',  label: 'Win',   x: 1.25,  y: 5.25, w: 1.25, h: 1 },
  { id: 'lalt',  label: 'Alt',   x: 2.5,   y: 5.25, w: 1.25, h: 1 },
  { id: 'spc',   label: '',      x: 3.75,  y: 5.25, w: 6.25, h: 1 },
  { id: 'ralt',  label: 'Alt',   x: 10,    y: 5.25, w: 1,    h: 1 },
  { id: 'fn',    label: 'Fn',    x: 11,    y: 5.25, w: 1,    h: 1 },
  { id: 'rctl',  label: 'Ctrl',  x: 12,    y: 5.25, w: 1,    h: 1 },
  { id: 'left',  label: '←',     x: 13.25, y: 5.5,  w: 1,    h: 1 },
  { id: 'down',  label: '↓',     x: 14.25, y: 5.5,  w: 1,    h: 1 },
  { id: 'right', label: '→',     x: 15.25, y: 5.5,  w: 1,    h: 1 },
  { id: 'kp0',   label: '0',     x: 16.5,  y: 5.25, w: 2,    h: 1 },
  { id: 'kpdot', label: '.',     x: 18.5,  y: 5.25, w: 1,    h: 1 },
  /* tall 2u encoder enter spanning rows 4-5 */
  { id: 'kpent', label: 'Ent',   x: 19.5,  y: 4.25, w: 1,    h: 2 },
];

const TOTAL_KEYS = Q5HE_LAYOUT.length;
export const RGB_KEY_LAYOUT = Q5HE_LAYOUT.filter(k => k.id !== 'knob');
export const TOTAL_LEDS = RGB_KEY_LAYOUT.length;
if (TOTAL_KEYS !== 102 || TOTAL_LEDS !== 101) {
  throw new Error('Q5 HE layout invariant failed: physical controls must be 102 and RGB LEDs must be 101.');
}

export const LED_INDEX_BY_KEY_ID: Record<string, number> = RGB_KEY_LAYOUT.reduce(
  (acc, key, index) => {
    acc[key.id] = index;
    return acc;
  },
  {} as Record<string, number>,
);

/* Bounding box (for SVG sizing) */
const _maxX = Math.max(...Q5HE_LAYOUT.map(k => k.x + k.w));
const _maxY = Math.max(...Q5HE_LAYOUT.map(k => k.y + k.h));
export const BOARD_W = _maxX;
export const BOARD_H = _maxY;

type GridPoint = {
  nx: number;
  ny: number;
  cx: number;
  cy: number;
};

export const RGB_KEY_GRID: GridPoint[] = RGB_KEY_LAYOUT.map(k => ({
  nx: (k.x + k.w / 2) / BOARD_W,
  ny: (k.y + k.h / 2) / BOARD_H,
  cx: k.x + k.w / 2,
  cy: k.y + k.h / 2,
}));

export const GRID_COLS = Math.ceil(BOARD_W);
export const GRID_ROWS = Math.ceil(BOARD_H);

/* ── Symmetric cardinal adjacency ─────────────────────────
 *
 * For each key, find the nearest other key in each of 4 directions (up,
 * down, left, right) based on physical centre proximity. This naturally
 * bridges the alpha-nav-numpad gaps: the key with the smallest |Δx| (and
 * a Δy close to 0) on the right is that key's "right" neighbour, no matter
 * how big the visual gap. Snake walks this graph. */
function _buildAdj(grid: GridPoint[]): number[][] {
  const N = grid.length;
  const adj: Set<number>[] = Array.from({ length: N }, () => new Set());

  for (let i = 0; i < N; i++) {
    const ki = grid[i];
    let up = -1, upD = Infinity;
    let down = -1, downD = Infinity;
    let left = -1, leftD = Infinity;
    let right = -1, rightD = Infinity;

    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const kj = grid[j];
      const dx = kj.cx - ki.cx;
      const dy = kj.cy - ki.cy;
      // 'Vertical' direction: |dy| dominates
      if (Math.abs(dy) > Math.abs(dx) * 0.6) {
        const d = Math.abs(dy) + Math.abs(dx) * 0.3;
        if (dy < 0 && d < upD)   { upD   = d; up   = j; }
        if (dy > 0 && d < downD) { downD = d; down = j; }
      } else {
        // 'Horizontal' direction: |dx| dominates
        const d = Math.abs(dx) + Math.abs(dy) * 0.3;
        if (dx < 0 && d < leftD)  { leftD  = d; left  = j; }
        if (dx > 0 && d < rightD) { rightD = d; right = j; }
      }
    }
    for (const n of [up, down, left, right]) {
      if (n >= 0) { adj[i].add(n); adj[n].add(i); }
    }
  }
  return adj.map(s => Array.from(s));
}

export const RGB_ADJACENCY: number[][] = _buildAdj(RGB_KEY_GRID);
