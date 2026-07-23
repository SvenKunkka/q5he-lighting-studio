export type RGBColor = { r: number; g: number; b: number };
export type LedFrameColor = RGBColor & { active?: boolean };
export type VibeStatus = 'busy' | 'done' | 'allow' | 'idle';
export type MicMode = 'spectrum' | 'dynamic' | 'rhythm';
export type MicDirection = 'right-left' | 'left-right' | 'top-bottom' | 'bottom-top' | 'inside-out' | 'outside-in';

/* Top-level effect category */
export type EffectType =
  | 'normal'    // 普通: solid / breathing / flashing / wave / marquee
  | 'snake'     // 贪吃蛇
  | 'screen'    // 屏幕镜像
  | 'mic'       // 拾音
  | 'vibe'      // Vibe 指示灯
  | 'keystroke' // 敲击光效
  | 'perkey'    // 自定义 Per-Key RGB
  | 'image'     // 图片
  | 'factory'   // 原厂 QMK 效果
  | 'off';

/* Sub-mode for 'normal' category */
export type NormalSubmode = 'solid' | 'breathing' | 'flashing' | 'wave' | 'marquee';

export interface LightingConfig {
  effect: EffectType;
  normalSubmode: NormalSubmode;

  color: RGBColor;
  brightness: number;   // 0–100
  speed: number;        // 0–100
  duration: number;     // seconds, 0 = continuous
  interval: number;     // ms between blinks
  factoryId: number;

  /* Snake */
  snakeHeadColor: RGBColor;
  snakeMaxLength: number;        // total length (head + body)

  /* Mic */
  micMode: MicMode;
  micDirection: MicDirection;

  /* Vibe status indicator */
  vibeProvider: 'claude' | 'codex';
  vibeBusyColor: RGBColor;
  vibeDoneColor: RGBColor;
  vibeAllowColor: RGBColor;

  /* Keystroke */
  keystrokeMode:
    | 'left'
    | 'right'
    | 'both'
    | 'cross'
    | 'reverse-left'
    | 'reverse-right'
    | 'reverse-both'
    | 'reverse-cross';
  keystrokeColor: RGBColor;
  keystrokeDuration: number; // ms

  /* Per-key */
  perKeyColors: Record<string, RGBColor>; // keyId → color

  /* Image */
  imageData: string | null;  // data URL
  imageColors: RGBColor[];   // sampled grid colors
}

export interface Preset {
  id: string;
  name: string;
  config: LightingConfig;
  createdAt: number;
}

export type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DeviceInfo {
  name: string;
  vendorId: number;
  productId: number;
}

export type AudioMode = 'off' | 'brightness' | 'color';

export interface AudioConfig {
  mode: AudioMode;
  sensitivity: number;
  deviceId: string | null;
}

export interface ScreenConfig {
  enabled: boolean;
}

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'ja' | 'zh' | 'ko';
