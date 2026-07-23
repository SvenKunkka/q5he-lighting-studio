import { useState, useRef, useEffect, useCallback } from 'react';
import { Toolbar } from './ui/components/Toolbar';
import { EffectSidebar } from './ui/components/EffectSidebar';
import { ParameterBar } from './ui/components/ParameterBar';
import { KeyboardPreview } from './ui/components/KeyboardPreview';
import { IntegrationPanel } from './ui/components/IntegrationPanel';
import { PresetPanel } from './ui/components/PresetPanel';
import { useAnimationFrame } from './ui/hooks/useAnimationFrame';

import { DEFAULT_CONFIG, computeNormalKeyFrameColor } from './lighting/model';
import type { NormalRenderTarget } from './lighting/model';
import { scaleRgbForOutput, uncalibrateRgbForPreview } from './lighting/colorOutput';
import { RGB_KEY_LAYOUT, TOTAL_LEDS } from './lighting/keyLayout';
import { loadPresets, savePresets, migrateConfig } from './presets/storage';
import { WebHIDDriver } from './device/webhid';
import { ScreenSampler } from './screen/sampler';

import { createSnake, startSnake, tickSnake, paintSnake } from './effects/snake';
import type { SnakeState } from './effects/snake';
import { codeToLedIndex } from './effects/keyCodeMap';
import { ScreenMirror } from './effects/screenMap';
import { MicMapper } from './effects/micMap';
import { imageToKeyColors } from './effects/imageMap';
import { paintKeystrokes } from './effects/keystroke';
import type { KeystrokeEvent } from './effects/keystroke';
import { getI18n } from './i18n';

import type {
  LightingConfig, AudioConfig, ScreenConfig,
  DeviceStatus, DeviceInfo, Preset, Theme, RGBColor, LedFrameColor, VibeStatus, Language,
} from './types';

const FRAME_INTERVAL_MS = 33;          // ~30 fps for per-key effects
const THEME_KEY = 'q5he_theme';
const LANGUAGE_KEY = 'q5he_language';
const CONFIG_KEY = 'q5he_lighting_config';
const SCALAR_APPLY_DEBOUNCE_MS = 120;
const VIBE_BRIDGE_URL = '/vibe-status.json';

const screenSampler = new ScreenSampler();
const screenMirror = new ScreenMirror(screenSampler);
const micMapper = new MicMapper();

declare global {
  interface Window {
    q5heVibeStatus?: (status: 'busy' | 'done' | 'allow' | 'idle') => Promise<void>;
  }
}

type HIDNavigatorWithEvents = Navigator & {
  hid?: {
    addEventListener(type: 'disconnect', listener: () => void): void;
    removeEventListener(type: 'disconnect', listener: () => void): void;
  };
};

function loadLightingConfig(): LightingConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    if (parsed.effect === 'claude') parsed.effect = 'vibe';
    return migrateConfig(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function makeBlankFrame(): LedFrameColor[] {
  return Array.from({ length: TOTAL_LEDS }, () => ({
    r: 0,
    g: 0,
    b: 0,
    active: false,
  }));
}

/* For effects that do not yet have a dedicated preview render path (mic,
 * snake, screen, keystroke, per-key, image), the device-bound frame is
 * post-processed for on-screen display: reverse the LED calibration so the
 * UI shows the user's chosen hue, and lift any active-but-near-black pixels
 * to a visible floor so they don't read as "off". Normal-mode effects
 * (breathing, marquee, etc.) bypass this helper entirely — their preview
 * path is computed directly with scaleRgbForPreview, which is cleaner. */
const FALLBACK_PREVIEW_MIN_PEAK = 55;

function decalibrateFrameForPreview(frame: LedFrameColor[]): LedFrameColor[] {
  return frame.map(led => {
    if (!led.active || (led.r === 0 && led.g === 0 && led.b === 0)) {
      return led;
    }
    const decal = uncalibrateRgbForPreview(led);
    const peak = Math.max(decal.r, decal.g, decal.b);
    if (peak === 0) {
      return { r: 0, g: 0, b: 0, active: led.active };
    }
    if (peak >= FALLBACK_PREVIEW_MIN_PEAK) {
      return { r: decal.r, g: decal.g, b: decal.b, active: led.active };
    }
    const scale = FALLBACK_PREVIEW_MIN_PEAK / peak;
    return {
      r: Math.min(255, Math.round(decal.r * scale)),
      g: Math.min(255, Math.round(decal.g * scale)),
      b: Math.min(255, Math.round(decal.b * scale)),
      active: led.active,
    };
  });
}

export default function App() {
  const [lightingConfig, setLightingConfig] = useState<LightingConfig>(() => loadLightingConfig());
  const [audioConfig, setAudioConfig] = useState<AudioConfig>({ mode: 'off', sensitivity: 60, deviceId: null });
  const [screenConfig, setScreenConfig] = useState<ScreenConfig>({ enabled: false });
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('disconnected');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');
  const [snakeActive, setSnakeActive] = useState(false);
  const [vibeStatus, setVibeStatus] = useState<VibeStatus>('idle');

  const [volumeLevel, setVolumeLevel] = useState(0);
  const [micActive, setMicActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [screenError, setScreenError] = useState('');
  /* Live preview override for animated effects */
  const [livePreview, setLivePreview] = useState<LedFrameColor[] | undefined>(undefined);

  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY) as Language | null;
    return stored === 'en' || stored === 'ja' || stored === 'zh' || stored === 'ko' ? stored : 'zh';
  });
  const t = getI18n(language);

  const driverRef = useRef<WebHIDDriver | null>(null);
  const snakeRef  = useRef<SnakeState>(createSnake());
  const keystrokeEventsRef = useRef<KeystrokeEvent[]>([]);
  const lastFrameSendRef = useRef(0);
  const blankSentForInvalidStateRef = useRef<string | null>(null);
  const pendingBlankReasonRef = useRef<string | null>(null);
  const micStartIdRef = useRef(0);
  const screenStartIdRef = useRef(0);
  const micStartingForRef = useRef<{ id: number; deviceId: string | null } | null>(null);
  const screenStartingIdRef = useRef<number | null>(null);

  const scalarTimerRef = useRef<number | null>(null);
  const pendingScalarRef = useRef<LightingConfig | null>(null);
  const inFlightRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const sendBlankFrameOnce = useCallback((reason: string, force = false) => {
    if (!force && blankSentForInvalidStateRef.current === reason) return;

    const driver = driverRef.current;
    if (!driver || deviceStatus !== 'connected') return;
    if (inFlightRef.current) {
      pendingBlankReasonRef.current = reason;
      return;
    }

    blankSentForInvalidStateRef.current = reason;
    inFlightRef.current = true;
    setSyncing(true);
    driver.sendPerKeyBuffer(makeBlankFrame())
      .catch((e: unknown) => showToast(`${t.toast.syncFailed}: ${errorMessage(e)}`))
      .finally(() => {
        inFlightRef.current = false;
        setSyncing(false);
        const pendingReason = pendingBlankReasonRef.current;
        pendingBlankReasonRef.current = null;
        if (pendingReason) {
          queueMicrotask(() => sendBlankFrameOnce(pendingReason, true));
        }
      });
  }, [deviceStatus, showToast, t.toast.syncFailed]);

  const cleanupScreenState = useCallback(() => {
    screenStartIdRef.current += 1;
    screenStartingIdRef.current = null;
    screenMirror.stop();
    setScreenConfig(c => ({ ...c, enabled: false }));
    setScreenActive(false);
    setLivePreview(undefined);
    sendBlankFrameOnce('screen:cleanup', true);
  }, [sendBlankFrameOnce]);

  const cleanupMicState = useCallback(() => {
    micStartIdRef.current += 1;
    micStartingForRef.current = null;
    micMapper.stop();
    setAudioConfig(c => ({ ...c, mode: 'off' }));
    setMicActive(false);
    setVolumeLevel(0);
    sendBlankFrameOnce('mic:cleanup', true);
  }, [sendBlankFrameOnce]);

  const handleScreenEnded = useCallback(() => {
    screenStartIdRef.current += 1;
    screenStartingIdRef.current = null;
    setScreenConfig(c => ({ ...c, enabled: false }));
    setScreenActive(false);
    setLivePreview(undefined);
    sendBlankFrameOnce('screen:ended', true);
  }, [sendBlankFrameOnce]);

  async function flushScalar() {
    const driver = driverRef.current;
    const cfg = pendingScalarRef.current;
    if (!driver || !cfg) return;
    if (inFlightRef.current) {
      scalarTimerRef.current = window.setTimeout(flushScalar, SCALAR_APPLY_DEBOUNCE_MS);
      return;
    }
    inFlightRef.current = true;
    setSyncing(true);
    try {
      await driver.applyLighting(cfg);
    } catch (e: unknown) {
      showToast(`${t.toast.syncFailed}: ${errorMessage(e)}`);
    } finally {
      inFlightRef.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => { savePresets(presets); }, [presets]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(lightingConfig));
  }, [lightingConfig]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const onDisconnect = () => {
      if (!driverRef.current) return;
      driverRef.current = null;
      setDeviceInfo(null);
      setDeviceStatus('disconnected');
      setSyncing(false);
    };
    const hid = (navigator as HIDNavigatorWithEvents).hid;
    hid?.addEventListener('disconnect', onDisconnect);
    return () => hid?.removeEventListener('disconnect', onDisconnect);
  }, []);

  useEffect(() => {
    if (deviceStatus !== 'connected') return;
    const timer = window.setInterval(() => {
      if (!driverRef.current?.isConnected()) {
        driverRef.current = null;
        setDeviceInfo(null);
        setDeviceStatus('disconnected');
        setSyncing(false);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deviceStatus]);

  useEffect(() => {
    window.q5heVibeStatus = async (status) => {
      setVibeStatus(status);
      await driverRef.current?.sendVibeStatus(status, lightingConfig);
    };
    return () => { delete window.q5heVibeStatus; };
  }, [lightingConfig]);

  useEffect(() => {
    if (lightingConfig.effect !== 'vibe') return;
    let active = true;
    let lastSeq = '';
    const poll = async () => {
      try {
        const res = await fetch(`${VIBE_BRIDGE_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as { status?: VibeStatus; seq?: string | number };
        const status = data.status;
        const seq = data.seq === undefined ? String(status ?? '') : String(data.seq);
        if (!active || !isVibeStatus(status) || seq === lastSeq) return;
        lastSeq = seq;
        setVibeStatus(status);
        await driverRef.current?.sendVibeStatus(status, lightingConfig);
      } catch {
        // The bridge file is optional; silence polling misses.
      }
    };
    poll();
    const timer = window.setInterval(poll, 300);
    return () => { active = false; window.clearInterval(timer); };
  }, [lightingConfig]);

  /* Scalar (non-per-key) effects use a debounced firmware-level command. */
  useEffect(() => {
    if (deviceStatus !== 'connected' || !driverRef.current) return;
    if (isRealtimeEffect(lightingConfig)) return;  // frame effects handled by RAF

    pendingScalarRef.current = lightingConfig;
    if (scalarTimerRef.current) window.clearTimeout(scalarTimerRef.current);
    scalarTimerRef.current = window.setTimeout(flushScalar, SCALAR_APPLY_DEBOUNCE_MS);
    return () => { if (scalarTimerRef.current) window.clearTimeout(scalarTimerRef.current); };
  // flushScalar reads mutable driver refs; re-running this effect on each render would spam HID writes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightingConfig, deviceStatus]);

  function computeFrame(
    cfg: LightingConfig,
    time: number,
    target: NormalRenderTarget = 'device',
  ): LedFrameColor[] | null {
    if (isRealtimeNormalEffect(cfg)) {
      return Array.from({ length: TOTAL_LEDS }, (_, i) =>
        computeNormalKeyFrameColor(cfg, i, TOTAL_LEDS, time, target),
      );
    }
    if (cfg.effect === 'snake') {
      const tickMs = Math.max(60, 600 - cfg.speed * 5);
      snakeRef.current = tickSnake(snakeRef.current, time, tickMs, cfg.snakeMaxLength);
      if (!snakeRef.current.active && snakeActive) setSnakeActive(false);
      return paintSnake(snakeRef.current, cfg.snakeHeadColor, cfg.brightness, TOTAL_LEDS, time);
    }
    if (cfg.effect === 'screen') {
      if (!screenMirror.isActive()) return null;
      return screenMirror.sampleKeys(cfg.brightness, TOTAL_LEDS);
    }
    if (cfg.effect === 'mic') {
      if (!micMapper.isActive()) return null;
      return micMapper.sampleKeys(
        cfg.micMode,
        cfg.micDirection,
        cfg.color,
        audioConfig.sensitivity,
        cfg.speed,
        cfg.brightness,
        TOTAL_LEDS,
      );
    }
    if (cfg.effect === 'keystroke') {
      const duration = Math.max(180, cfg.keystrokeDuration);
      keystrokeEventsRef.current = keystrokeEventsRef.current
        .filter(event => time - event.startTime <= duration);
      return paintKeystrokes(
        keystrokeEventsRef.current,
        cfg.keystrokeMode,
        cfg.keystrokeColor,
        cfg.brightness,
        duration,
        TOTAL_LEDS,
        time,
      );
    }
    if (cfg.effect === 'perkey') {
      const out: RGBColor[] = new Array(TOTAL_LEDS);
      for (let i = 0; i < TOTAL_LEDS; i++) {
        const id = RGB_KEY_LAYOUT[i]?.id;
        const c = id ? cfg.perKeyColors[id] : undefined;
        out[i] = c
          ? scaleRgbForOutput(c, cfg.brightness)
          : { r: 0, g: 0, b: 0 };
      }
      return out;
    }
    if (cfg.effect === 'image') {
      return cfg.imageColors.length === TOTAL_LEDS
        ? cfg.imageColors.map(color => scaleRgbForOutput(color, cfg.brightness))
        : null;
    }
    return null;
  }

  /* Per-key animated effect loop: ~30 fps. Computes a frame then both
   * updates the on-screen preview AND pushes to the keyboard. */
  useAnimationFrame((time) => {
    if (!isRealtimeEffect(lightingConfig)) {
      if (livePreview) setLivePreview(undefined);
      return;
    }
    if (time - lastFrameSendRef.current < FRAME_INTERVAL_MS) return;
    lastFrameSendRef.current = time;

    let frame: LedFrameColor[] | null;
    try {
      frame = computeFrame(lightingConfig, time);
    } catch (e: unknown) {
      const reason = `${lightingConfig.effect}:exception`;
      const shouldReport = blankSentForInvalidStateRef.current !== reason;
      setLivePreview(undefined);
      sendBlankFrameOnce(reason);
      if (shouldReport) showToast(`${t.toast.syncFailed}: ${errorMessage(e)}`);
      return;
    }

    if (!frame) {
      if (livePreview) setLivePreview(undefined);

      const shouldBlank =
        lightingConfig.effect === 'screen' ||
        lightingConfig.effect === 'mic' ||
        lightingConfig.effect === 'image';

      if (shouldBlank) sendBlankFrameOnce(`${lightingConfig.effect}:invalid`);
      return;
    }

    blankSentForInvalidStateRef.current = null;

    // Normal-mode effects (breathing, marquee, …) compute the preview frame
    // directly via the dedicated sRGB-aware path so dim phases stay legibly
    // hued. Other effects fall back to the older decalibrate-and-lift hack
    // over the device frame.
    const previewFrame = isRealtimeNormalEffect(lightingConfig)
      ? (computeFrame(lightingConfig, time, 'preview') as LedFrameColor[])
      : decalibrateFrameForPreview(frame);
    setLivePreview(previewFrame);

    const driver = driverRef.current;
    if (driver && !inFlightRef.current && deviceStatus === 'connected') {
      inFlightRef.current = true;
      setSyncing(true);
      driver.sendPerKeyBuffer(frame)
        .catch((e: unknown) => showToast(`${t.toast.syncFailed}: ${errorMessage(e)}`))
        .finally(() => { inFlightRef.current = false; setSyncing(false); });
    }
  }, isRealtimeEffect(lightingConfig));

  /* Lifecycle: start/stop mic and screen capture as their effect is
   * entered/left. Reset snake on entering snake mode. */
  useEffect(() => {
    const eff = lightingConfig.effect;
    keystrokeEventsRef.current = [];

    if (eff === 'mic' && audioConfig.mode !== 'off') {
      if (!micMapper.isActiveFor(audioConfig.deviceId)) {
        if (!micStartingForRef.current) {
          const startId = micStartIdRef.current + 1;
          micStartIdRef.current = startId;
          micStartingForRef.current = { id: startId, deviceId: audioConfig.deviceId };
          micMapper.start(audioConfig.deviceId)
            .then(() => {
              micStartingForRef.current = null;
              if (micStartIdRef.current !== startId) {
                micMapper.stop();
                return;
              }
              setMicActive(true);
              setMicError('');
            })
            .catch((e: unknown) => {
              micStartingForRef.current = null;
              if (micStartIdRef.current !== startId) return;
              const msg = errorMessage(e);
              cleanupMicState();
              setMicError(msg);
              showToast(`${t.toast.micFailed}: ${msg}`);
            });
        }
      } else {
        queueMicrotask(() => setMicActive(true));
      }
    } else if (micMapper.isActive()) {
      micStartIdRef.current += 1;
      micStartingForRef.current = null;
      micMapper.stop();
      queueMicrotask(() => {
        setMicActive(false);
        setVolumeLevel(0);
      });
    } else {
      micStartIdRef.current += 1;
      micStartingForRef.current = null;
      queueMicrotask(() => {
        if (eff !== 'mic' && audioConfig.mode !== 'off') {
          setAudioConfig(c => ({ ...c, mode: 'off' }));
        }
        setMicActive(false);
        setVolumeLevel(0);
      });
    }

    if (eff === 'screen' && screenConfig.enabled) {
      if (!screenMirror.isActive()) {
        if (screenStartingIdRef.current === null) {
          const startId = screenStartIdRef.current + 1;
          screenStartIdRef.current = startId;
          screenStartingIdRef.current = startId;
          screenMirror.start(handleScreenEnded)
            .then(() => {
              screenStartingIdRef.current = null;
              if (screenStartIdRef.current !== startId) {
                screenMirror.stop();
                return;
              }
              setScreenActive(true);
              setScreenError('');
            })
            .catch((e: unknown) => {
              screenStartingIdRef.current = null;
              if (screenStartIdRef.current !== startId) return;
              const msg = errorMessage(e);
              cleanupScreenState();
              setScreenError(msg);
              showToast(`${t.toast.screenFailed}: ${msg}`);
            });
        }
      } else {
        queueMicrotask(() => setScreenActive(true));
      }
    } else if (screenMirror.isActive()) {
      screenStartIdRef.current += 1;
      screenStartingIdRef.current = null;
      screenMirror.stop();
      queueMicrotask(() => {
        setScreenActive(false);
        setLivePreview(undefined);
      });
    } else {
      screenStartIdRef.current += 1;
      screenStartingIdRef.current = null;
      queueMicrotask(() => setScreenActive(false));
    }

    if (eff === 'snake') {
      snakeRef.current = createSnake();
    }
  }, [
    audioConfig.deviceId,
    audioConfig.mode,
    cleanupMicState,
    cleanupScreenState,
    handleScreenEnded,
    lightingConfig.effect,
    screenConfig.enabled,
    showToast,
    t.toast.micFailed,
    t.toast.screenFailed,
  ]);

  /* Global keydown: first key press in snake mode spawns the head at
   * the corresponding LED. Subsequent presses are ignored — AI takes over. */
  useEffect(() => {
    if (lightingConfig.effect !== 'snake') return;
    const onKey = (e: KeyboardEvent) => {
      if (snakeRef.current.active) return;
      const idx = codeToLedIndex(e.code);
      if (idx < 0) return;
      e.preventDefault();
      snakeRef.current = startSnake(snakeRef.current, idx, performance.now());
      setSnakeActive(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightingConfig.effect]);

  useEffect(() => {
    if (lightingConfig.effect !== 'keystroke') return;
    const onKey = (e: KeyboardEvent) => {
      const idx = codeToLedIndex(e.code);
      if (idx < 0) return;
      e.preventDefault();
      keystrokeEventsRef.current = [
        ...keystrokeEventsRef.current.slice(-7),
        { keyIndex: idx, startTime: performance.now() },
      ];
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightingConfig.effect]);

  /* Audio source is shared by the volume meter and Mic lighting. */
  useAnimationFrame(() => {
    if (lightingConfig.effect !== 'mic' || audioConfig.mode === 'off') {
      if (volumeLevel !== 0) setVolumeLevel(0);
      return;
    }
    const raw = micMapper.getVolume();
    const vol = Math.min(raw * (audioConfig.sensitivity / 30), 1);
    setVolumeLevel(vol);
  }, lightingConfig.effect === 'mic' && audioConfig.mode !== 'off');

  async function handleConnect() {
    setDeviceStatus('connecting');
    try {
      const driver = new WebHIDDriver();
      const info = await driver.connect();
      driverRef.current = driver;
      setDeviceInfo(info);
      setDeviceStatus('connected');
      showToast(`${t.toast.connected}: ${info.name}`);
      pendingScalarRef.current = lightingConfig;
      flushScalar();
    } catch (e: unknown) {
      setDeviceStatus('error');
      driverRef.current = null;
      setDeviceInfo(null);
      showToast(`${t.toast.connectFailed}: ${errorMessage(e)}`);
      setTimeout(() => setDeviceStatus('disconnected'), 2000);
    }
  }

  async function handleDisconnect() {
    await driverRef.current?.disconnect();
    driverRef.current = null;
    setDeviceStatus('disconnected');
    setDeviceInfo(null);
  }

  function applyLightingConfig(nextConfig: LightingConfig, nextPresetId: string | null) {
    const migrated = migrateConfig(nextConfig);
    blankSentForInvalidStateRef.current = null;
    setLivePreview(undefined);
    keystrokeEventsRef.current = [];
    if (migrated.effect === 'snake') setSnakeActive(false);

    if (migrated.effect === 'mic') {
      if (screenConfig.enabled || screenActive || screenMirror.isActive()) cleanupScreenState();
      setMicError('');
      setAudioConfig(c => c.mode === 'off' ? { ...c, mode: 'brightness' } : c);
    } else if (audioConfig.mode !== 'off' || micActive || micMapper.isActive()) {
      cleanupMicState();
    }

    if (migrated.effect === 'screen') {
      if (audioConfig.mode !== 'off' || micActive || micMapper.isActive()) cleanupMicState();
      setScreenError('');
      setScreenConfig(c => ({ ...c, enabled: true }));
    } else if (screenConfig.enabled || screenActive || screenMirror.isActive()) {
      cleanupScreenState();
    }

    setLightingConfig(migrated);
    setActivePresetId(nextPresetId);
  }

  function updateLighting(update: Partial<LightingConfig>) {
    if (update.effect && update.effect !== lightingConfig.effect) {
      setLivePreview(undefined);
      keystrokeEventsRef.current = [];
      if (update.effect === 'snake') setSnakeActive(false);
      if (update.effect === 'mic' && audioConfig.mode === 'off') {
        setMicError('');
        setAudioConfig(c => ({ ...c, mode: 'brightness' }));
      } else if (lightingConfig.effect === 'mic' && update.effect !== 'mic') {
        cleanupMicState();
      }
      if (update.effect === 'screen' && !screenConfig.enabled) {
        setScreenError('');
        setScreenConfig(c => ({ ...c, enabled: true }));
      } else if (lightingConfig.effect === 'screen' && update.effect !== 'screen') {
        cleanupScreenState();
      }
    }
    setLightingConfig(c => ({ ...c, ...update }));
    setActivePresetId(null);
  }

  /* Per-key click: paint with current brush colour.
   * In snake mode, clicking spawns the snake head (fallback when the
   * page can't capture physical keystrokes). */
  const handleKeyClick = useCallback((keyId: string, idx: number) => {
    if (lightingConfig.effect === 'perkey') {
      setLightingConfig(c => ({
        ...c,
        perKeyColors: { ...c.perKeyColors, [keyId]: c.color },
      }));
    } else if (lightingConfig.effect === 'snake' && !snakeRef.current.active) {
      snakeRef.current = startSnake(snakeRef.current, idx, performance.now());
      setSnakeActive(true);
    } else if (lightingConfig.effect === 'keystroke') {
      keystrokeEventsRef.current = [
        ...keystrokeEventsRef.current.slice(-7),
        { keyIndex: idx, startTime: performance.now() },
      ];
    }
  }, [lightingConfig.effect]);

  async function handleImageUpload(dataUrl: string) {
    const colors = await imageToKeyColors(dataUrl, TOTAL_LEDS);
    setLightingConfig(c => ({ ...c, imageData: dataUrl, imageColors: colors }));
    showToast(t.toast.imageMapped);
  }

  function handlePresetApply(preset: Preset) {
    applyLightingConfig(preset.config, preset.id);
  }
  function handlePresetSave(preset: Preset) {
    setPresets(ps => {
      const idx = ps.findIndex(p => p.id === preset.id);
      if (idx >= 0) { const next = [...ps]; next[idx] = preset; return next; }
      return [...ps, preset];
    });
    setActivePresetId(preset.id);
    showToast(`${t.toast.saved}: "${preset.name}"`);
  }
  function handlePresetDelete(id: string) {
    setPresets(ps => ps.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  }
  function handleImport(cfg: LightingConfig) {
    applyLightingConfig(cfg, null);
    showToast(t.toast.imported);
  }

  const isPerKey = lightingConfig.effect === 'perkey';
  const isSnake  = lightingConfig.effect === 'snake';
  const isKeystroke = lightingConfig.effect === 'keystroke';
  const allowClick = isPerKey || isSnake || isKeystroke;
  const selectedKeys = isPerKey
    ? new Set(Object.keys(lightingConfig.perKeyColors))
    : undefined;
  const showIntegrationPanel = lightingConfig.effect === 'mic' || lightingConfig.effect === 'screen';

  return (
    <div className="app">
      <Toolbar
        status={deviceStatus} deviceInfo={deviceInfo}
        onConnect={handleConnect} onDisconnect={handleDisconnect}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        language={language}
        onLanguageChange={setLanguage}
        syncing={syncing}
        t={t}
      />

      <div className={`workspace${showIntegrationPanel ? ' has-integration' : ''}`}>
        <aside className="sidebar-left">
          <EffectSidebar
            active={lightingConfig.effect}
            onChange={e => updateLighting({ effect: e })}
            t={t}
          />
        </aside>

        <section className="main-area">
          <div className="preview-section">
            <div className="preview-header">
              <span className="preview-label">{t.previewTitle}</span>
              <div className="preview-badges">
                {lightingConfig.effect === 'mic' && micActive && (
                  <span className="badge audio-badge">{t.badges.mic}</span>
                )}
                {lightingConfig.effect === 'screen' && screenActive && (
                  <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>{t.badges.screen}</span>
                )}
                {lightingConfig.effect === 'snake' && !snakeActive && (
                  <span className="badge snake-hint">{t.badges.snake}</span>
                )}
              </div>
            </div>
            <div className="preview-stage">
              <KeyboardPreview
                config={lightingConfig}
                vibeStatus={vibeStatus}
                perKeyOverride={livePreview}
                showLabels={false}
                onKeyClick={allowClick ? handleKeyClick : undefined}
                selectedKeys={selectedKeys}
              />
            </div>
          </div>

          <div className="params-section">
            <ParameterBar
              config={lightingConfig}
              onChange={updateLighting}
              onImageUpload={handleImageUpload}
              onPerKeyClear={() => setLightingConfig(c => ({ ...c, perKeyColors: {} }))}
              perKeySelectedCount={Object.keys(lightingConfig.perKeyColors).length}
              screenActive={screenActive}
              t={t}
            />
          </div>
        </section>

        {showIntegrationPanel && (
          <aside className="sidebar-right">
            <IntegrationPanel
              effect={lightingConfig.effect}
              audioConfig={audioConfig} screenConfig={screenConfig}
              onAudioChange={u => setAudioConfig(c => ({ ...c, ...u }))}
              onScreenChange={u => setScreenConfig(c => ({ ...c, ...u }))}
              micActive={micActive}
              screenActive={screenActive}
              micError={micError}
              screenError={screenError}
              onMicErrorChange={setMicError}
              onScreenErrorChange={setScreenError}
              volumeLevel={volumeLevel}
              t={t}
          />
          </aside>
        )}
      </div>

      <footer className="preset-footer">
        <PresetPanel
          presets={presets} activeId={activePresetId} currentConfig={lightingConfig}
          onApply={handlePresetApply} onSave={handlePresetSave}
          onDelete={handlePresetDelete} onImport={handleImport}
          t={t}
        />
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function isPerKeyEffect(e: string): boolean {
  return e === 'snake' || e === 'screen' || e === 'mic' || e === 'keystroke' || e === 'perkey' || e === 'image';
}

function isRealtimeNormalEffect(config: LightingConfig): boolean {
  return config.effect === 'normal' &&
    (config.normalSubmode === 'breathing' || config.normalSubmode === 'marquee');
}

function isRealtimeEffect(config: LightingConfig): boolean {
  return isPerKeyEffect(config.effect) || isRealtimeNormalEffect(config);
}

function isVibeStatus(status: unknown): status is VibeStatus {
  return status === 'busy' || status === 'done' || status === 'allow' || status === 'idle';
}
