import { useState } from 'react';
import { Q5HE_LAYOUT, TOTAL_LEDS, BOARD_W, BOARD_H, LED_INDEX_BY_KEY_ID } from '../../lighting/keyLayout';
import type { LedFrameColor, LightingConfig, RGBColor, VibeStatus } from '../../types';
import {
  computeFactoryPreviewKeyColor,
  computeNormalKeyFrameColor,
  colorToHex,
  applyBrightness,
} from '../../lighting/model';
import { useAnimationFrame } from '../hooks/useAnimationFrame';

interface Props {
  config: LightingConfig;
  perKeyOverride?: LedFrameColor[];
  showLabels?: boolean;
  onKeyClick?: (keyId: string, ledIndex: number) => void;
  selectedKeys?: Set<string>;
  vibeStatus?: VibeStatus;
}

const UNIT = 56;      // px per 1u (large so SVG looks crisp)
const PAD  = 0.06;    // gap between keys, in 1u

type KeyRenderState = {
  rgb: RGBColor;
  active: boolean;
};

export function KeyboardPreview({
  config, perKeyOverride, showLabels = false,
  onKeyClick, selectedKeys, vibeStatus = 'idle',
}: Props) {
  const [time, setTime] = useState(0);
  const animated = (config.effect === 'normal' && config.normalSubmode !== 'solid') || config.effect === 'factory';
  useAnimationFrame(t => setTime(t), animated);

  const canvasW = BOARD_W * UNIT;
  const canvasH = BOARD_H * UNIT;

  function getKeyRenderState(idx: number): KeyRenderState {
    const keyId = Q5HE_LAYOUT[idx]?.id;
    const ledIndex = keyId ? LED_INDEX_BY_KEY_ID[keyId] : undefined;
    if (ledIndex === undefined) return inactiveKey();
    if (perKeyOverride && perKeyOverride[ledIndex]) {
      const frameColor = perKeyOverride[ledIndex];
      return {
        rgb: frameColor,
        active: frameColor.active ?? !isBlack(frameColor),
      };
    }
    if (config.effect === 'perkey') {
      const c = keyId ? config.perKeyColors[keyId] : undefined;
      return c ? activeKey(applyBrightness(c, config.brightness)) : inactiveKey();
    }
    if (config.effect === 'off') return inactiveKey();
    if (config.effect === 'vibe') {
      if (vibeStatus === 'busy') return activeKey(applyBrightness(config.vibeBusyColor, config.brightness));
      if (vibeStatus === 'done') return activeKey(applyBrightness(config.vibeDoneColor, config.brightness));
      if (vibeStatus === 'allow') return activeKey(applyBrightness(config.vibeAllowColor, config.brightness));
      return inactiveKey();
    }
    if (config.effect === 'normal') {
      const frameColor = computeNormalKeyFrameColor(config, ledIndex, TOTAL_LEDS, time);
      return {
        rgb: frameColor,
        active: frameColor.active ?? !isBlack(frameColor),
      };
    }
    if (config.effect === 'factory') {
      const key = Q5HE_LAYOUT[idx];
      const rgb = computeFactoryPreviewKeyColor(config, ledIndex, TOTAL_LEDS, time, key.x / BOARD_W, key.y / BOARD_H);
      return { rgb, active: !isBlack(rgb) };
    }
    return inactiveKey();
  }

  return (
    <div className="keyboard-preview-frame">
      <svg
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          <filter id="keyGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {Q5HE_LAYOUT.map((key, idx) => {
          const ledIndex = LED_INDEX_BY_KEY_ID[key.id];
          const { rgb, active } = getKeyRenderState(idx);
          const color = colorToHex(rgb);
          const isOff = !active;
          const isActiveBlack = active && isBlack(rgb);
          const isSelected = selectedKeys?.has(key.id);
          const isKnob = key.id === 'knob';
          const clickHandler = onKeyClick && ledIndex !== undefined
            ? () => onKeyClick(key.id, ledIndex)
            : undefined;

          const x = (key.x + PAD) * UNIT;
          const y = (key.y + PAD) * UNIT;
          const w = (key.w - PAD * 2) * UNIT;
          const h = (key.h - PAD * 2) * UNIT;

          const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
          const labelFill = lum > 140 ? '#0a0a0c' : '#e8e8ec';
          const rx = isKnob ? w / 2 : 7;

          return (
            <g
              key={key.id}
              style={clickHandler ? { cursor: 'pointer' } : undefined}
              onClick={clickHandler}
            >
              {!isOff && (
                <rect
                  x={x - 4} y={y - 4}
                  width={w + 8} height={h + 8}
                  rx={rx + 2} ry={rx + 2}
                  fill={color} opacity={0.32}
                  filter="url(#keyGlow)"
                />
              )}
              <rect
                x={x} y={y} width={w} height={h}
                rx={rx} ry={rx}
                fill={isOff ? 'var(--kbd-body)' : color}
                stroke={isSelected ? 'var(--accent)' : isActiveBlack ? 'var(--kbd-active-black-stroke)' : 'var(--kbd-stroke)'}
                strokeWidth={isSelected ? 2 : isActiveBlack ? 1.6 : 1}
              />
              {showLabels && (
                <text
                  x={x + w / 2} y={y + h / 2 + 4}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(w, h) > 36 ? 13 : 9}
                  fontFamily="ui-monospace, monospace"
                  fill={isOff ? 'var(--kbd-label)' : labelFill}
                >
                  {key.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function activeKey(rgb: RGBColor): KeyRenderState {
  return { rgb, active: true };
}

function inactiveKey(): KeyRenderState {
  return { rgb: { r: 0, g: 0, b: 0 }, active: false };
}

function isBlack(rgb: RGBColor): boolean {
  return rgb.r === 0 && rgb.g === 0 && rgb.b === 0;
}
