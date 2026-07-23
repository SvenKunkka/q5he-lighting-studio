import React, { useEffect, useRef, useState } from 'react';
import type { LightingConfig } from '../../types';
import { encodeConfig, decodeConfig } from '../../presets/codec';
import type { I18nDict } from '../../i18n';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Props {
  mode: 'export' | 'import';
  currentConfig: LightingConfig;
  onClose: () => void;
  onImport: (config: LightingConfig) => void;
  t: I18nDict;
}

export function ShareModal({ mode, currentConfig, onClose, onImport, t }: Props) {
  const [code, setCode] = useState(() => mode === 'export' ? encodeConfig(currentConfig) : '');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (mode === 'export') inputRef.current?.select();
  }, [mode]);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleImport() {
    try {
      const cfg = decodeConfig(code);
      onImport(cfg);
      onClose();
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel">
        <div className="modal-title">
          {mode === 'export' ? t.modal.exportTitle : t.modal.importTitle}
        </div>
        <div className="modal-hint">
          {mode === 'export'
            ? t.modal.exportHint
            : t.modal.importHint}
        </div>

        <input
          ref={inputRef}
          type="text"
          className="modal-input"
          value={code}
          onChange={e => { setCode(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && mode === 'import') handleImport(); }}
          placeholder="q5he:…"
          readOnly={mode === 'export'}
        />

        <div className="modal-meta">
          {t.modal.length}: <b>{code.length}</b> {t.modal.chars}
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t.modal.cancel}</button>
          {mode === 'export' ? (
            <button className="btn btn-accent" onClick={handleCopy}>
              {copied ? `✓ ${t.modal.copied}` : t.modal.copy}
            </button>
          ) : (
            <button className="btn btn-accent" onClick={handleImport}>{t.modal.import}</button>
          )}
        </div>
      </div>
    </div>
  );
}
