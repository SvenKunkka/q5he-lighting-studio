import { useEffect, useState } from 'react';
import type { AudioConfig, ScreenConfig, EffectType } from '../../types';
import { Slider } from './Slider';
import type { I18nDict } from '../../i18n';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Props {
  effect: EffectType;
  audioConfig: AudioConfig;
  screenConfig: ScreenConfig;
  onAudioChange: (u: Partial<AudioConfig>) => void;
  onScreenChange: (u: Partial<ScreenConfig>) => void;
  micActive: boolean;
  screenActive: boolean;
  micError: string;
  screenError: string;
  onMicErrorChange: (error: string) => void;
  onScreenErrorChange: (error: string) => void;
  volumeLevel: number; // 0–1
  t: I18nDict;
}

export function IntegrationPanel({
  effect,
  audioConfig, screenConfig,
  onAudioChange, onScreenChange,
  micActive,
  screenActive,
  micError,
  screenError,
  onMicErrorChange,
  onScreenErrorChange,
  volumeLevel,
  t,
}: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (audioConfig.mode !== 'off' || micActive) {
      navigator.mediaDevices?.enumerateDevices()
        .then(all => setDevices(all.filter(d => d.kind === 'audioinput')))
        .catch(() => {});
    }
  }, [audioConfig.mode, micActive]);

  async function toggleMic() {
    if (audioConfig.mode !== 'off') {
      onAudioChange({ mode: 'off' });
      onMicErrorChange('');
    } else {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter(d => d.kind === 'audioinput'));
        onAudioChange({ mode: 'brightness' });
        onMicErrorChange('');
      } catch (e: unknown) {
        onMicErrorChange(errorMessage(e) || t.integration.micDenied);
      }
    }
  }

  function toggleScreen() {
    if (screenConfig.enabled) {
      onScreenChange({ enabled: false });
      onScreenErrorChange('');
    } else {
      onScreenChange({ enabled: true });
      onScreenErrorChange('');
    }
  }

  const volPct = Math.round(volumeLevel * 100);
  const showMic = effect === 'mic';
  const showScreen = effect === 'screen';

  return (
    <div className="panel">
      <div className="panel-title">
        {showMic ? t.integration.micTitle : t.integration.screenTitle}
      </div>

      {/* Microphone */}
      {showMic && <section className="integration-section">
        <div className="integration-header">
          <div className="integration-label">
            <span className={`indicator${micActive ? ' active' : ''}`} />
            {t.integration.microphone}
          </div>
          <button
            className={`toggle-btn${micActive ? ' active' : ''}`}
            onClick={toggleMic}
          >
            {micActive ? t.integration.on : t.integration.off}
          </button>
        </div>

        {micActive && (
          <div className="integration-body">
            {devices.length > 0 && (
              <div className="field-group">
                <label className="field-label">{t.integration.inputDevice}</label>
                <select
                  className="select"
                  value={audioConfig.deviceId ?? ''}
                  onChange={e => onAudioChange({ deviceId: e.target.value || null })}
                >
                  <option value="">{t.integration.defaultDevice}</option>
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</option>
                  ))}
                </select>
              </div>
            )}

            <Slider
              label={t.integration.sensitivity}
              value={audioConfig.sensitivity}
              unit="%"
              onChange={v => onAudioChange({ sensitivity: v })}
            />

            <div className="vol-meter-wrap">
              <span className="field-label">{t.integration.volume}</span>
              <div className="vol-meter">
                <div
                  className="vol-meter-fill"
                  style={{ width: `${Math.min(volPct * (100 / audioConfig.sensitivity) * 1.5, 100)}%` }}
                />
              </div>
              <span className="vol-value">{volPct}%</span>
            </div>
          </div>
        )}

        {micError && <p className="error-text">{micError}</p>}
      </section>}

      {/* Screen sampling */}
      {showScreen && <section className="integration-section">
        <div className="integration-header">
          <div className="integration-label">
            <span className={`indicator${screenActive ? ' active' : ''}`} />
            {t.integration.screenColor}
          </div>
          <button
            className={`toggle-btn${screenActive ? ' active' : ''}`}
            onClick={toggleScreen}
          >
            {screenActive ? t.integration.on : t.integration.off}
          </button>
        </div>

        {screenError && <p className="error-text">{screenError}</p>}
      </section>}
    </div>
  );
}
