<!-- SVENKUNKKA-README-NAV:BEGIN -->
[中文项目说明](#project-overview-zh) · [English overview](#project-overview-en) · [维护者 X / Maintainer on X](https://x.com/Svenu1s5)
<!-- SVENKUNKKA-README-NAV:END -->

# Q5 HE RGB Studio

Q5 HE RGB Studio is a WebHID-based lighting console for the Keychron Q5 HE. It controls 101 per-key RGB LEDs over USB while preserving the full 102-control physical layout, including the top-right encoder.

## Product Scope

| Area | Definition |
| --- | --- |
| Target hardware | Keychron Q5 HE ANSI encoder variant |
| Physical controls | 102 controls, including encoder |
| RGB LED buffer | 101 LEDs; encoder has no per-key RGB slot |
| Transport | USB WebHID raw report, 32 bytes |
| Recommended browser | Chrome / Edge |
| Primary goal | Low-latency direct RGB preview and apply flow |

## Current Features

- Normal RGB: solid, breathing, flashing, wave, marquee.
- Factory RGB: pass-through QMK RGB matrix effect IDs.
- Per-key RGB: click-to-paint preview with auto-apply.
- Image mapping: compress image to keyboard grid and map dominant colors to keys.
- Screen mirror: sample screen color at each RGB key position.
- Microphone modes: level and spectrum visualization.
- Keystroke reaction: left, right, both-side, and cross sweep.
- Snake mode: graph-based auto-pilot over the RGB key layout.
- Vibe status: Codex / Claude busy, done, allow-needed indicators.
- Presets: local save, import, and export.

## Technical Notes

The Q5 HE physical layout and RGB LED buffer are intentionally separated:

- `Q5HE_LAYOUT`: full physical layout for preview geometry.
- `RGB_KEY_LAYOUT`: RGB-capable keys only; excludes `knob`.
- `TOTAL_KEYS`: physical controls.
- `TOTAL_LEDS`: firmware RGB slots.
- `LED_INDEX_BY_KEY_ID`: maps key IDs to firmware LED indices.

This prevents the encoder from shifting every downstream RGB index by 1. Firmware still defines `RGB_MATRIX_LED_COUNT` as `101`.

## WebHID Protocol

32-byte raw HID report. First byte is always `0xAC`.

| Report | Function |
| --- | --- |
| `AC 00` | idle / clear temporary override |
| `AC 01 [R G B]` | busy status |
| `AC 02 [R G B]` | done status |
| `AC 03 [R G B]` | allow-needed status |
| `AC 10 R G B` | solid RGB |
| `AC 11 R G B speed` | breathing |
| `AC 12 speed` | rainbow wave |
| `AC 13 R G B speed` | flashing |
| `AC 14 R G B speed` | marquee |
| `AC 20 fid h s v speed` | factory QMK effect |
| `AC 30 offset [R G B]x9` | per-key RGB batch |
| `AC FF` | clear override |

Per-key effects are throttled to about 30 fps in the web app to keep HID traffic stable.

## Development

```bash
npm install
npm run dev
npm run build
```

## Codex / Vibe Bridge

Codex does not automatically call browser functions. The production bridge uses a local status file: keep the web app open on the Vibe effect, then update the bridge file from Codex or any local script:

```bash
node scripts/vibe-status.mjs busy
node scripts/vibe-status.mjs allow
node scripts/vibe-status.mjs done
node scripts/vibe-status.mjs idle
```

The page polls `public/vibe-status.json` every 300 ms and sends the matching WebHID status command to the keyboard.

## Firmware

See [firmware/README.md](firmware/README.md) for the QMK keymap and raw HID implementation.

## Validation Checklist

- Build passes with `npm run build`.
- Preview shows 102 physical controls, with the encoder rendered but unlit.
- Per-key buffer length is 101 RGB entries.
- Pressing `NumpadEnter` maps to the final RGB LED slot, not an off-by-one shifted index.
- Snake, keystroke, mic, screen, image, and per-key effects all use `RGB_KEY_LAYOUT`.


---

<!-- SVENKUNKKA-PROJECT-INFO:BEGIN -->

<a id="project-overview-zh"></a>
## 中文项目说明

面向 Keychron Q5 HE ANSI 旋钮版本的 WebHID 灯光控制台，提供逐键配色、图像映射、屏幕与麦克风效果、按键响应及 AI 状态灯效，并区分 102 个实体控件与 101 个 RGB 灯位。

**使用入口：** 运行 `npm install`、`npm run dev`，使用 Chrome 或 Edge；匹配的 QMK 协议和键盘侧实现见 [固件说明](firmware/README.md)。

**范围说明：** 针对指定型号与协议，不能据此推定其他键盘兼容；Codex 状态需经本地状态文件桥接，不会自动连接。

<a id="project-overview-en"></a>
## English project overview

A WebHID lighting console for the Keychron Q5 HE ANSI encoder variant, with per-key painting, image mapping, screen and microphone effects, key reactions and AI status lighting. It distinguishes 102 physical controls from 101 RGB slots.

**Getting started:** Run `npm install` and `npm run dev` in Chrome or Edge. See the [firmware guide](firmware/README.md) for the matching QMK protocol and keyboard implementation.

**Scope:** Targets the specified model and protocol, not arbitrary keyboards. Codex state requires the local status-file bridge and is not connected automatically.

**仓库维护者 / Repository maintainer:** [SvenKunkka](https://github.com/SvenKunkka) · [X / Twitter](https://x.com/Svenu1s5)

<!-- SVENKUNKKA-PROJECT-INFO:END -->
