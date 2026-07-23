import { useState } from 'react';
import type { Preset, LightingConfig } from '../../types';
import { colorToHex, EFFECT_META } from '../../lighting/model';
import { createPreset } from '../../presets/storage';
import { ShareModal } from './ShareModal';
import type { I18nDict } from '../../i18n';

interface Props {
  presets: Preset[];
  activeId: string | null;
  currentConfig: LightingConfig;
  onApply: (preset: Preset) => void;
  onSave: (preset: Preset) => void;
  onDelete: (id: string) => void;
  onImport: (config: LightingConfig) => void;
  t: I18nDict;
}

export function PresetPanel({
  presets, activeId, currentConfig,
  onApply, onSave, onDelete, onImport, t,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [modal, setModal] = useState<'export' | 'import' | null>(null);

  function handleQuickSave() {
    const fallback = EFFECT_META.find(m => m.key === currentConfig.effect)?.label ?? t.presets.defaultName;
    const name = t.effects[currentConfig.effect]?.name ?? fallback;
    const p = createPreset(`${name} ${presets.length + 1}`, currentConfig);
    onSave(p);
  }

  function handleRename(id: string) {
    const existing = presets.find(p => p.id === id);
    if (!existing) return;
    onSave({ ...existing, name: editName.trim() || existing.name });
    setEditing(null);
  }

  return (
    <>
      <div className="preset-panel">
        <div className="panel-title-inline">{t.presets.title}</div>

        <div className="preset-list">
          {presets.map(p => {
            const isActive = p.id === activeId;
            const previewColor = colorToHex(p.config.color);
            return (
              <div
                key={p.id}
                className={`preset-item${isActive ? ' active' : ''}`}
                onClick={() => onApply(p)}
                title={t.presets.applyRename}
              >
                <div className="preset-color-dot" style={{ background: previewColor }} />
                {editing === p.id ? (
                  <input
                    className="preset-rename-input"
                    value={editName}
                    autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleRename(p.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(p.id);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                ) : (
                  <span
                    className="preset-name"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditing(p.id); setEditName(p.name); }}
                    title={t.presets.rename}
                  >
                    {p.name}
                    <span className="preset-effect">{p.config.effect}</span>
                  </span>
                )}
                <div className="preset-actions">
                  <button
                    className="preset-btn del"
                    onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                    title={t.presets.delete}
                  >✕</button>
                </div>
              </div>
            );
          })}
          {presets.length === 0 && <div className="preset-empty">{t.presets.empty}</div>}
        </div>

        <div className="preset-actions-right">
          <button className="preset-icon-btn" onClick={handleQuickSave} title={t.presets.save}>
            <span className="preset-icon">＋</span><span>{t.presets.save}</span>
          </button>
          <button className="preset-icon-btn" onClick={() => setModal('export')} title={t.presets.export}>
            <span className="preset-icon">⇪</span><span>{t.presets.export}</span>
          </button>
          <button className="preset-icon-btn" onClick={() => setModal('import')} title={t.presets.import}>
            <span className="preset-icon">⇩</span><span>{t.presets.import}</span>
          </button>
        </div>
      </div>

      {modal && (
        <ShareModal
          mode={modal}
          currentConfig={currentConfig}
          onClose={() => setModal(null)}
          onImport={onImport}
          t={t}
        />
      )}
    </>
  );
}
