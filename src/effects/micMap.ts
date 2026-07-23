/* Audio-reactive per-key colour buffer.
 *
 * Three styles:
 *  - spectrum: frequency bins distributed along the selected direction.
 *  - dynamic:  a smooth volume wave travelling along the selected direction.
 *  - rhythm:   beat-triggered pulses with a short travelling flash.
 */
import type { RGBColor, LedFrameColor, MicDirection, MicMode } from '../types';
import { scaleRgbForOutput } from '../lighting/colorOutput';
import { RGB_KEY_GRID } from '../lighting/keyLayout';
import { hueByteFromDegrees, qmkHsvToRgb } from '../lighting/qmkColor';

const MIC_ACTIVE_FLOOR = 0.16;
const SPECTRUM_SIGNAL_THRESHOLD = 0.035;
const SPECTRUM_BAR_THRESHOLD = 0.075;
const DYNAMIC_ACTIVITY_THRESHOLD = 0.08;
const DYNAMIC_WAVE_THRESHOLD = 0.16;
const AUDIO_NOISE_FLOOR_DB = -40;
const AUDIO_MAX_DB = -10;
const AUDIO_RESPONSE_GAMMA = 1.8;
const AUDIO_IDLE_GATE = 0.05;
const AUDIO_ATTACK_MS = 55;
const AUDIO_RELEASE_MS = 260;
const DEFAULT_SENSITIVITY = 60;

export class MicMapper {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private prevVolume = 0;
  private avgVolume = 0;
  private beatPulse = 0;
  private rhythmEnv = 0;
  private lastBeatAt = 0;
  private smoothedLevel = 0;
  private lastSampleAt = 0;
  private sampleRate = 48000;
  private activeDeviceId: string | null = null;

  async start(deviceId: string | null): Promise<void> {
    this.stop();
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      await ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.stream = stream;

      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      this.analyser = analyser;
      this.sampleRate = ctx.sampleRate;
      this.activeDeviceId = deviceId;
      this.freqData = new Uint8Array(analyser.frequencyBinCount);
      this.timeData = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
    } catch (e) {
      this.stop();
      throw e;
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach(track => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    const ctx = this.ctx;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {
        // ignore
      });
    }
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.prevVolume = 0;
    this.avgVolume = 0;
    this.beatPulse = 0;
    this.rhythmEnv = 0;
    this.lastBeatAt = 0;
    this.smoothedLevel = 0;
    this.lastSampleAt = 0;
    this.sampleRate = 48000;
    this.activeDeviceId = null;
    this.freqData = new Uint8Array(0);
    this.timeData = new Uint8Array(0);
  }

  isActive(): boolean { return this.analyser !== null; }
  isActiveFor(deviceId: string | null): boolean {
    return this.isActive() && this.activeDeviceId === deviceId;
  }

  /** Get RMS volume 0..1 from time-domain data. */
  getVolume(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (const v of this.timeData) { const n = (v - 128) / 128; sum += n * n; }
    return Math.sqrt(sum / this.timeData.length);
  }

  /** Sample audio and produce per-key colours. */
  sampleKeys(
    mode: MicMode,
    direction: MicDirection,
    baseColor: RGBColor,
    sensitivity: number,
    animationSpeed: number,
    brightness: number,
    totalLeds: number,
  ): LedFrameColor[] {
    const out: LedFrameColor[] = new Array(totalLeds).fill(null).map(() => offLed());
    const sensitivityDb = sensitivityDbOffset(sensitivity);

    if (!this.analyser) return out;
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    this.analyser.getByteFrequencyData(this.freqData);

    const now = performance.now();
    const dt = this.lastSampleAt > 0 ? Math.max(1, now - this.lastSampleAt) : 33;
    this.lastSampleAt = now;
    const rawRms = this.getVolume();
    const targetLevel = normalizeDb(
      dbFromRms(rawRms) + sensitivityDb,
      AUDIO_NOISE_FLOOR_DB,
      AUDIO_MAX_DB,
      AUDIO_RESPONSE_GAMMA,
    );
    const volume = targetLevel <= 0
      ? 0
      : smoothAudioLevel(this.smoothedLevel, targetLevel, dt);
    this.smoothedLevel = volume;
    const idle = volume < AUDIO_IDLE_GATE;
    const musicLevel = idle ? 0 : Math.min(1, Math.pow(volume, 0.72));
    const rise = volume - this.prevVolume;
    this.avgVolume = this.avgVolume * 0.94 + volume * 0.06;
    const beatGate = Math.max(0.11, this.avgVolume * 1.35);
    if (volume > beatGate && rise > 0.035 && now - this.lastBeatAt > 130) {
      this.beatPulse = 1;
      this.lastBeatAt = now;
    } else {
      this.beatPulse *= 0.88;
    }
    this.prevVolume = volume;

    const targetEnv = Math.max(volume, this.beatPulse);
    const envRate = targetEnv > this.rhythmEnv ? 0.45 : 0.075;
    this.rhythmEnv += (targetEnv - this.rhythmEnv) * envRate;
    const rhythmPulse = Math.max(
      this.beatPulse,
      Math.min(1, Math.max(0, (volume - this.avgVolume) * 4)),
      this.rhythmEnv * 0.55,
    );
    const beatAge = this.lastBeatAt ? now - this.lastBeatAt : 9999;
    const bins = this.freqData.length;
    const speedFactor = 0.55 + animationSpeed / 55;
    for (let i = 0; i < RGB_KEY_GRID.length && i < totalLeds; i++) {
      if (idle && (mode === 'spectrum' || mode === 'dynamic')) {
        out[i] = offLed();
        continue;
      }
      const g = RGB_KEY_GRID[i];
      const axis = axisPosition(g.nx, g.ny, direction);
      const cross = crossPosition(g.nx, g.ny, direction);
      const bandLevel = bandEnergy(this.freqData, axis, bins, sensitivityDb, this.sampleRate);
      const amp = Math.min(1, bandLevel * (0.08 + musicLevel * 1.55));
      const paint = paintMicKey(mode, axis, cross, amp, musicLevel, baseColor, now, rhythmPulse, beatAge, speedFactor);
      out[i] = paint.active ? activeLed(paint.color, brightness) : offLed();
    }
    return out;
  }

  async getDevices(): Promise<MediaDeviceInfo[]> {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter(d => d.kind === 'audioinput');
  }
}

type MicPaint = {
  active: boolean;
  color: RGBColor;
};

function paintMicKey(
  mode: MicMode,
  axis: number,
  cross: number,
  amp: number,
  volume: number,
  baseColor: RGBColor,
  now: number,
  rhythmPulse: number,
  beatAge: number,
  speedFactor: number,
): MicPaint {
  if (mode === 'spectrum') {
    const signal = Math.max(amp, volume);
    if (volume < AUDIO_IDLE_GATE || signal < SPECTRUM_SIGNAL_THRESHOLD) return inactivePaint();
    const level = Math.min(1, Math.pow(amp, 0.78) * (0.22 + volume * 0.95));
    if (cross > level) return inactivePaint();
    const edgeSpark = Math.max(0, 1 - Math.abs(cross - level) / 0.18) * amp;
    const barEnergy = Math.max((1 - cross / Math.max(0.08, level)) * (0.22 + amp * 0.72), edgeSpark * 0.82);
    if (signal < SPECTRUM_SIGNAL_THRESHOLD || barEnergy < SPECTRUM_BAR_THRESHOLD) return inactivePaint();
    const energy = activeIntensity(barEnergy);
    const hue = axis * 250 + 180 + Math.sin(now * 0.00038) * 10;
    return activePaint(musicColor(hue, energy, 0.08 + amp * 0.12));
  }

  if (mode === 'dynamic') {
    if (volume < AUDIO_IDLE_GATE) return inactivePaint();
    const head = (now * 0.00022 * speedFactor + volume * 0.18) % 1;
    const runner = 1 - smoothstep(0.02, 0.2 + volume * 0.24, circularDistance(axis, head));
    const wave = Math.pow(0.5 + 0.5 * Math.sin(axis * 18 - now * 0.003 * speedFactor + amp * 5), 1.8);
    const crossWave = 0.45 + 0.55 * Math.sin(cross * Math.PI + now * 0.0018 * speedFactor);
    const coverage = smoothstep(0.06, 0.92, volume);
    if (cross > Math.min(1, 0.12 + coverage * 0.95)) return inactivePaint();
    const activity = Math.min(1, amp * 0.25 + volume * 0.75);
    const waveEnergy = (runner * 0.5 + wave * crossWave * 0.5) * (0.12 + activity * 0.9);
    if (activity < DYNAMIC_ACTIVITY_THRESHOLD || waveEnergy < DYNAMIC_WAVE_THRESHOLD) return inactivePaint();
    const energy = activeIntensity(waveEnergy + activity * 0.18);
    const hue = axis * 165 + now * 0.04 * speedFactor + volume * 75;
    return activePaint(musicColor(hue, energy, 0.14 + volume * 0.12));
  }

  if (volume <= 0.001 && rhythmPulse <= 0.01) return inactivePaint();
  const travel = Math.min(1, beatAge / 520);
  const travellingFlash = 1 - smoothstep(0.05, 0.2, Math.abs(axis - travel));
  const fill = Math.min(1, volume * 1.18 + rhythmPulse * 0.18);
  const volumeFront = 1 - smoothstep(fill, Math.min(1, fill + 0.16), axis);
  const hit = Math.pow(Math.min(1, rhythmPulse), 0.72);
  const punch = Math.max(volumeFront * (0.22 + volume * 0.45), travellingFlash * hit);
  const energy = Math.min(1, 0.18 + punch * 0.82);
  return activePaint(tintColor(baseColor, energy, 0.42 + hit * 0.28));
}

function axisPosition(nx: number, ny: number, direction: MicDirection): number {
  if (direction === 'left-right') return nx;
  if (direction === 'right-left') return 1 - nx;
  if (direction === 'top-bottom') return ny;
  if (direction === 'bottom-top') return 1 - ny;
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const dist = Math.min(1, Math.hypot(dx, dy) / 0.58);
  return direction === 'inside-out' ? dist : 1 - dist;
}

function crossPosition(nx: number, ny: number, direction: MicDirection): number {
  if (direction === 'left-right' || direction === 'right-left') return 1 - ny;
  if (direction === 'top-bottom' || direction === 'bottom-top') return nx;
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const angle = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
  return angle;
}

function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function scaleColor(c: RGBColor, v: number): RGBColor {
  return {
    r: Math.round(c.r * v),
    g: Math.round(c.g * v),
    b: Math.round(c.b * v),
  };
}

function tintColor(color: RGBColor, energy: number, whiteMix: number): RGBColor {
  const lifted = 0.32 + Math.max(0, Math.min(1, energy)) * 0.68;
  return scaleColor(mixColor(color, { r: 255, g: 255, b: 255 }, whiteMix), lifted);
}

function mixColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
  };
}

function bandEnergy(
  data: Uint8Array<ArrayBuffer>,
  axis: number,
  bins: number,
  sensitivityDb: number,
  sampleRate: number,
): number {
  const center = logFrequencyBin(axis, bins, sampleRate);
  const radius = Math.max(2, Math.floor(center * 0.08));
  let sum = 0;
  let weight = 0;
  const start = Math.max(1, center - radius);
  const end = Math.min(bins - 1, center + radius);
  for (let i = start; i <= end; i++) {
    const w = 1 - Math.abs(i - center) / Math.max(1, radius + 1);
    sum += (data[i] ?? 0) * w;
    weight += w;
  }
  const magnitude = sum / Math.max(1, weight) / 255;
  return normalizeDb(
    dbFromRms(magnitude) + sensitivityDb,
    AUDIO_NOISE_FLOOR_DB,
    AUDIO_MAX_DB,
    AUDIO_RESPONSE_GAMMA,
  );
}

function musicColor(hue: number, energy: number, whiteMix: number): RGBColor {
  const e = Math.max(0, Math.min(1, energy));
  const saturation = Math.round(255 - Math.max(0, Math.min(1, whiteMix)) * 96);
  const color = qmkHsvToRgb({ h: hueByteFromDegrees(hue), s: saturation, v: 255 });
  return scaleColor(mixColor(color, { r: 255, g: 255, b: 255 }, whiteMix), e);
}

function activeIntensity(energy: number): number {
  const e = Math.max(0, Math.min(1, energy));
  return MIC_ACTIVE_FLOOR + e * (1 - MIC_ACTIVE_FLOOR);
}

function activePaint(color: RGBColor): MicPaint {
  return { active: true, color };
}

function inactivePaint(): MicPaint {
  return { active: false, color: { r: 0, g: 0, b: 0 } };
}

function activeLed(color: RGBColor, brightness: number): LedFrameColor {
  if (brightness <= 0) return offLed();
  const scaled = scaleRgbForOutput(color, brightness);
  // paintMicKey can produce (0,0,0) for very-low-energy frames (e.g. quiet music);
  // marking those as active causes the preview to render solid black keys. Treat
  // a fully black output as "off" so the UI shows the empty key cap instead.
  if (scaled.r === 0 && scaled.g === 0 && scaled.b === 0) return offLed();
  return { ...scaled, active: true };
}

function offLed(): LedFrameColor {
  return { r: 0, g: 0, b: 0, active: false };
}

function logFrequencyBin(axis: number, bins: number, sampleRate: number): number {
  const nyquist = sampleRate / 2;
  const minHz = 45;
  const maxHz = Math.min(12000, nyquist * 0.9);
  const hz = minHz * Math.pow(maxHz / minHz, Math.max(0, Math.min(1, axis)));
  return Math.max(1, Math.min(bins - 1, Math.round((hz / nyquist) * bins)));
}

function dbFromRms(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-6));
}

function normalizeDb(db: number, noiseFloorDb: number, maxDb: number, gamma: number): number {
  if (!Number.isFinite(db) || db <= noiseFloorDb) return 0;
  const normalized = Math.max(0, Math.min(1, (db - noiseFloorDb) / (maxDb - noiseFloorDb)));
  return Math.pow(normalized, gamma);
}

function smoothAudioLevel(previous: number, target: number, dtMs: number): number {
  const tau = target > previous ? AUDIO_ATTACK_MS : AUDIO_RELEASE_MS;
  const alpha = 1 - Math.exp(-dtMs / tau);
  return previous + (target - previous) * alpha;
}

function sensitivityDbOffset(sensitivity: number): number {
  const normalized = Math.max(0, Math.min(100, sensitivity));
  return Math.max(-9, Math.min(6, (normalized - DEFAULT_SENSITIVITY) * 0.15));
}
