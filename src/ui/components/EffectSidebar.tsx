import type { EffectType } from '../../types';
import { EFFECT_META } from '../../lighting/model';
import type { I18nDict } from '../../i18n';

interface Props {
  active: EffectType;
  onChange: (e: EffectType) => void;
  t: I18nDict;
}

export function EffectSidebar({ active, onChange, t }: Props) {
  return (
    <div className="effect-sidebar">
      <div className="sidebar-section-title">{t.effectsTitle}</div>
      <div className="effect-list">
        {EFFECT_META.map(m => (
          <button
            key={m.key}
            className={`effect-tile${active === m.key ? ' active' : ''}`}
            onClick={() => onChange(m.key)}
            title={t.effects[m.key].desc}
          >
            <span className="effect-tile-icon">{m.icon}</span>
            <span className="effect-tile-body">
              <span className="effect-tile-zh">{t.effects[m.key].name}</span>
              <span className="effect-tile-en">{m.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
