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
