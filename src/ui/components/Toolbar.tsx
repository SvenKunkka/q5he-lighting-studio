import type { DeviceStatus, DeviceInfo, Language, Theme } from '../../types';
import { LANGUAGE_OPTIONS, type I18nDict } from '../../i18n';

interface Props {
  status: DeviceStatus;
  deviceInfo: DeviceInfo | null;
  onConnect: () => void;
  onDisconnect: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  syncing: boolean;
  t: I18nDict;
}

export function Toolbar({
  status, deviceInfo, onConnect, onDisconnect,
  theme, onToggleTheme, language, onLanguageChange, syncing, t,
}: Props) {
  const isConnected = status === 'connected';
  const isBusy = status === 'connecting';
  const statusLabel = t.toolbar[status];
  const connectLabel = status === 'error' ? t.toolbar.reconnect : t.toolbar.connect;

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="app-name">Q5 HE RGB Studio</div>
        <div className={`status-card status-${status}`}>
          <span className="status-dot" />
          <span className="status-text">{statusLabel}</span>
          {isConnected && deviceInfo && (
            <span className="device-name">{deviceInfo.name}</span>
          )}
        </div>
        {isConnected && (
          <div className={`sync-indicator${syncing ? ' active' : ''}`}>
            <span className="sync-dot" />
            {syncing ? t.toolbar.syncing : t.toolbar.synced}
          </div>
        )}
      </div>

      <div className="toolbar-right">
        <select
          className="language-select"
          value={language}
          onChange={e => onLanguageChange(e.target.value as Language)}
          title={t.toolbar.language}
          aria-label={t.toolbar.language}
        >
          {LANGUAGE_OPTIONS.map(option => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? t.toolbar.switchLight : t.toolbar.switchDark}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        {!isConnected ? (
          <button className="btn btn-primary connect-btn" onClick={onConnect} disabled={isBusy}>
            {isBusy ? t.toolbar.connecting : connectLabel}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={onDisconnect}>{t.toolbar.disconnect}</button>
        )}
      </div>
    </header>
  );
}
