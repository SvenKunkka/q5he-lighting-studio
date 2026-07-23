# Q5 HE RGB Studio — Firmware

This folder contains the extended QMK firmware required by Q5 HE RGB Studio
to send arbitrary RGB colours and effects to the keyboard.

## Why custom firmware

The Q5 HE's SNLED27351 LED driver mangles QMK's HSV→RGB pipeline. Standard VIA
RGB commands therefore produce unpredictable colours. The fix is to bypass the
HSV path entirely and write RGB bytes directly via
`rgb_matrix_indicators_advanced_user()`.

The Q5 HE ANSI encoder layout has 102 physical controls, but the RGB matrix
buffer has 101 LED slots. The encoder is rendered in the web preview but does
not consume a per-key RGB packet index.

The base of this approach is the `claude-rgb` project:
https://github.com/cherish6/claude-rgb

This folder ships a **drop-in replacement** for `claude_rgb.c` that keeps the
4 status commands (busy/done/allow/idle) AND adds direct-RGB commands
(solid / breathing / wave / flashing / marquee / per-key / factory / clear) used by the Web tool.

## Protocol

32-byte raw HID report. First byte must be `0xAC`.

| Bytes | Effect |
|-------|--------|
| `AC 00` | idle / clear override |
| `AC 01 [R G B]` | Vibe busy (default blue; optional custom RGB) |
| `AC 02 [R G B]` | Vibe done (default green; optional custom RGB, 2 s flash) |
| `AC 03 [R G B]` | Vibe allow-needed (default red; optional custom RGB, 2 s flash) |
| `AC 10 R G B` | solid RGB |
| `AC 11 R G B speed` | breathing |
| `AC 12 speed` | rainbow wave |
| `AC 13 R G B speed` | flashing |
| `AC 14 R G B speed` | marquee |
| `AC 20 fid h s v speed` | factory QMK RGB matrix effect |
| `AC 30 offset [R G B]×9` | per-key RGB batch |
| `AC FF` | clear override |

## Install

1. Set up `qmk_firmware` per the original claude-rgb README (Steps 1-2).
2. Replace `keymaps/claude_rgb/claude_rgb.c` with [`keymap/claude_rgb.c`](keymap/claude_rgb.c) from this folder.
3. For Q5 HE ANSI, make sure `keymaps/claude_rgb/config.h` enables the factory/reactive QMK effects:
   ```c
   #pragma once
   #define RGB_MATRIX_KEYPRESSES
   #define RGB_MATRIX_FRAMEBUFFER_EFFECTS
   ```
4. Compile and flash:
   ```bash
   qmk compile -kb keychron/q5_he/ansi_encoder -km claude_rgb
   qmk flash    -kb keychron/q5_he/ansi_encoder -km claude_rgb
   ```
5. Open Q5 HE RGB Studio and click **Connect Keyboard**.
