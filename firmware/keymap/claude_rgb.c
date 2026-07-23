/* claude_rgb.c — extended RGB control for Keychron Q5 HE
 *
 * Drop-in replacement for v1 claude_rgb.c from
 * https://github.com/cherish6/claude-rgb
 *
 * Protocol (32-byte raw HID report, first byte 0xAC):
 *   AC 00                  → idle / clear override
 *   AC 01..03 [R G B]      → Vibe busy/done/allow indicators
 *   AC 10 R G B            → solid RGB                  常亮
 *   AC 11 R G B speed      → breathing                  呼吸
 *   AC 12 speed            → rainbow wave               流水
 *   AC 13 R G B speed      → flashing                   闪烁
 *   AC 14 R G B speed      → marquee                    跑马
 *   AC 20 fid h s v speed  → factory QMK effect (fid maps to RGB_MATRIX_*)
 *   AC FF                  → clear override
 *
 * For custom modes (0x10..0x14) we override every render frame.
 * For factory mode (0x20) we drop the override and call rgb_matrix_*.
 */

#include QMK_KEYBOARD_H
#include "rgb_matrix.h"
#include "timer.h"
#include "claude_rgb.h"
#include <math.h>

/* ── Protocol ────────────────────────────────────────────── */
#define CMD_IDLE       0x00
#define CMD_BUSY       0x01
#define CMD_DONE       0x02
#define CMD_ERROR      0x03
#define CMD_SOLID_RGB  0x10
#define CMD_BREATHING  0x11
#define CMD_WAVE       0x12
#define CMD_FLASHING   0x13
#define CMD_MARQUEE    0x14
#define CMD_FACTORY    0x20
#define CMD_PER_KEY    0x30  /* AC 30 offset [R G B]*9 — write 9 LEDs */
#define CMD_CLEAR      0xFF

#define FLASH_MS         2000
#define BUSY_WATCHDOG_MS (30UL * 60UL * 1000UL)

/* ── State ───────────────────────────────────────────────── */
typedef enum {
    MODE_OFF       = 0,
    MODE_SOLID,
    MODE_BREATHING,
    MODE_WAVE,
    MODE_FLASHING,
    MODE_MARQUEE,
    MODE_PER_KEY,
} effect_mode_t;

#ifndef RGB_MATRIX_LED_COUNT
#define RGB_MATRIX_LED_COUNT 101
#endif
static uint8_t s_perkey_rgb[RGB_MATRIX_LED_COUNT * 3];

static effect_mode_t s_mode          = MODE_OFF;
static uint8_t       s_r             = 0;
static uint8_t       s_g             = 0;
static uint8_t       s_b             = 0;
static uint8_t       s_speed         = 128;

static bool          s_override      = false;
static bool          s_flash_active  = false;
static uint32_t      s_flash_start   = 0;
static bool          s_busy_active   = false;
static uint32_t      s_busy_start    = 0;

/* ── Helpers ─────────────────────────────────────────────── */
static uint8_t scale8(uint8_t v, uint8_t s) {
    return ((uint16_t)v * (uint16_t)s) >> 8;
}

static void local_hsv_to_rgb(uint8_t h, uint8_t s, uint8_t v,
                             uint8_t *r, uint8_t *g, uint8_t *b) {
    uint8_t region = h * 6 / 255;
    uint8_t remainder = (h * 2 - region * 85) * 3;
    uint8_t p = (v * (255 - s)) >> 8;
    uint8_t q = (v * (255 - ((s * remainder) >> 8))) >> 8;
    uint8_t t = (v * (255 - ((s * (255 - remainder)) >> 8))) >> 8;
    switch (region) {
        case 6:
        case 0:  *r = v; *g = t; *b = p; break;
        case 1:  *r = q; *g = v; *b = p; break;
        case 2:  *r = p; *g = v; *b = t; break;
        case 3:  *r = p; *g = q; *b = v; break;
        case 4:  *r = t; *g = p; *b = v; break;
        default: *r = v; *g = p; *b = q; break;
    }
}

static void set_indicator_rgb(uint8_t *data, uint8_t fallback_r, uint8_t fallback_g, uint8_t fallback_b) {
    if (data[2] || data[3] || data[4]) {
        s_r = data[2];
        s_g = data[3];
        s_b = data[4];
    } else {
        s_r = fallback_r;
        s_g = fallback_g;
        s_b = fallback_b;
    }
}

/* ── Indicators: paint when override is active ───────────── */
bool rgb_matrix_indicators_advanced_user(uint8_t led_min, uint8_t led_max) {
    if (!s_override) return true;

    uint32_t now = timer_read32();

    switch (s_mode) {
        case MODE_SOLID:
            for (uint8_t i = led_min; i < led_max; i++) {
                rgb_matrix_set_color(i, s_r, s_g, s_b);
            }
            break;

        case MODE_BREATHING: {
            uint16_t period = 4000 - ((uint16_t)s_speed * 14);
            if (period < 400) period = 400;
            float phase = (float)(now % period) / (float)period;
            float env   = 0.5f - 0.5f * cosf(phase * 6.2831853f);
            uint8_t br  = (uint8_t)(env * 255.0f);
            uint8_t r = scale8(s_r, br), g = scale8(s_g, br), b = scale8(s_b, br);
            for (uint8_t i = led_min; i < led_max; i++) rgb_matrix_set_color(i, r, g, b);
            break;
        }

        case MODE_WAVE: {
            uint16_t period = 6000 - ((uint16_t)s_speed * 22);
            if (period < 500) period = 500;
            uint16_t time_hue = (uint16_t)((now * 256UL / period) & 0xFF);
            for (uint8_t i = led_min; i < led_max; i++) {
                uint8_t hue = (i * 6 + time_hue) & 0xFF;
                uint8_t r, g, b;
                local_hsv_to_rgb(hue, 255, 255, &r, &g, &b);
                rgb_matrix_set_color(i, r, g, b);
            }
            break;
        }

        case MODE_FLASHING: {
            uint16_t period = 2000 - ((uint16_t)s_speed * 7);
            if (period < 200) period = 200;
            bool on = (now % period) < (period / 2);
            uint8_t r = on ? s_r : 0, g = on ? s_g : 0, b = on ? s_b : 0;
            for (uint8_t i = led_min; i < led_max; i++) rgb_matrix_set_color(i, r, g, b);
            break;
        }

        case MODE_MARQUEE: {
            uint16_t period = 4000 - ((uint16_t)s_speed * 14);
            if (period < 500) period = 500;
            uint8_t total = led_max - led_min;
            if (total == 0) break;
            uint16_t head = (uint16_t)((now * (uint32_t)total) / period) % total;
            uint8_t band_width = total / 6;
            if (band_width < 6) band_width = 6;
            for (uint8_t i = led_min; i < led_max; i++) {
                uint8_t local = i - led_min;
                uint8_t dist = (local + total - (head % total)) % total;
                if (dist < band_width) {
                    uint8_t intensity = 255 - (uint8_t)((uint16_t)dist * 255 / band_width);
                    rgb_matrix_set_color(i,
                        scale8(s_r, intensity), scale8(s_g, intensity), scale8(s_b, intensity));
                } else {
                    rgb_matrix_set_color(i, 0, 0, 0);
                }
            }
            break;
        }

        case MODE_PER_KEY: {
            for (uint8_t i = led_min; i < led_max; i++) {
                rgb_matrix_set_color(i,
                    s_perkey_rgb[i * 3 + 0],
                    s_perkey_rgb[i * 3 + 1],
                    s_perkey_rgb[i * 3 + 2]);
            }
            break;
        }

        case MODE_OFF:
        default:
            for (uint8_t i = led_min; i < led_max; i++) rgb_matrix_set_color(i, 0, 0, 0);
            break;
    }
    return true;
}

/* ── matrix_scan_user: expire timed flashes ──────────────── */
void matrix_scan_user(void) {
    if (s_flash_active && timer_elapsed32(s_flash_start) >= FLASH_MS) {
        s_flash_active = false;
        s_override     = false;
        s_mode         = MODE_OFF;
    }
    if (s_busy_active && timer_elapsed32(s_busy_start) >= BUSY_WATCHDOG_MS) {
        s_busy_active  = false;
        s_override     = false;
        s_mode         = MODE_OFF;
    }
}

/* ── Switch to a QMK built-in effect by Web-side id ─────── */
static void apply_factory_effect(uint8_t fid, uint8_t h, uint8_t s, uint8_t v, uint8_t speed) {
    s_override     = false;
    s_flash_active = false;
    s_busy_active  = false;
    rgb_matrix_enable_noeeprom();
    if (v > 0) rgb_matrix_sethsv_noeeprom(h, s, v);
    if (speed > 0) rgb_matrix_set_speed_noeeprom(speed);

    /* Order matches the Q5 HE info.json animations list (alphabetical) */
    switch (fid) {
        case  0: rgb_matrix_mode_noeeprom(RGB_MATRIX_BAND_SPIRAL_VAL);            break;
        case  1: rgb_matrix_mode_noeeprom(RGB_MATRIX_BREATHING);                  break;
        case  2: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_ALL);                  break;
        case  3: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_LEFT_RIGHT);           break;
        case  4: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_OUT_IN);               break;
        case  5: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_OUT_IN_DUAL);          break;
        case  6: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_PINWHEEL);             break;
        case  7: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_SPIRAL);               break;
        case  8: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_UP_DOWN);              break;
        case  9: rgb_matrix_mode_noeeprom(RGB_MATRIX_DIGITAL_RAIN);               break;
        case 10: rgb_matrix_mode_noeeprom(RGB_MATRIX_DUAL_BEACON);                break;
        case 11: rgb_matrix_mode_noeeprom(RGB_MATRIX_JELLYBEAN_RAINDROPS);        break;
        case 12: rgb_matrix_mode_noeeprom(RGB_MATRIX_PIXEL_RAIN);                 break;
        case 13: rgb_matrix_mode_noeeprom(RGB_MATRIX_RAINBOW_BEACON);             break;
        case 14: rgb_matrix_mode_noeeprom(RGB_MATRIX_RAINBOW_MOVING_CHEVRON);     break;
        case 15: rgb_matrix_mode_noeeprom(RGB_MATRIX_SOLID_REACTIVE_MULTINEXUS);  break;
        case 16: rgb_matrix_mode_noeeprom(RGB_MATRIX_SOLID_REACTIVE_MULTIWIDE);   break;
        case 17: rgb_matrix_mode_noeeprom(RGB_MATRIX_SOLID_REACTIVE_SIMPLE);      break;
        case 18: rgb_matrix_mode_noeeprom(RGB_MATRIX_SOLID_SPLASH);               break;
        case 19: rgb_matrix_mode_noeeprom(RGB_MATRIX_SPLASH);                     break;
        case 20: rgb_matrix_mode_noeeprom(RGB_MATRIX_TYPING_HEATMAP);             break;
        default: rgb_matrix_mode_noeeprom(RGB_MATRIX_CYCLE_ALL);                  break;
    }
}

/* ── claude_rgb_hid_rx ───────────────────────────────────── */
void claude_rgb_hid_rx(uint8_t *data, uint8_t length) {
    uint8_t cmd = data[1];

    s_flash_active = false;
    s_busy_active  = false;

    switch (cmd) {
        case CMD_BUSY:
            set_indicator_rgb(data, 0, 0, 255);
            s_mode = MODE_SOLID; s_override = true;
            s_busy_active = true; s_busy_start = timer_read32();
            break;

        case CMD_DONE:
            set_indicator_rgb(data, 0, 255, 0);
            s_mode = MODE_SOLID; s_override = true;
            s_flash_active = true; s_flash_start = timer_read32();
            break;

        case CMD_ERROR:
            set_indicator_rgb(data, 255, 0, 0);
            s_mode = MODE_SOLID; s_override = true;
            s_flash_active = true; s_flash_start = timer_read32();
            break;

        case CMD_SOLID_RGB:
            s_r = data[2]; s_g = data[3]; s_b = data[4];
            s_mode = MODE_SOLID; s_override = true;
            break;

        case CMD_BREATHING:
            s_r = data[2]; s_g = data[3]; s_b = data[4];
            s_speed = data[5] ? data[5] : 128;
            s_mode = MODE_BREATHING; s_override = true;
            break;

        case CMD_WAVE:
            s_speed = data[2] ? data[2] : 128;
            s_mode = MODE_WAVE; s_override = true;
            break;

        case CMD_FLASHING:
            s_r = data[2]; s_g = data[3]; s_b = data[4];
            s_speed = data[5] ? data[5] : 128;
            s_mode = MODE_FLASHING; s_override = true;
            break;

        case CMD_MARQUEE:
            s_r = data[2]; s_g = data[3]; s_b = data[4];
            s_speed = data[5] ? data[5] : 128;
            s_mode = MODE_MARQUEE; s_override = true;
            break;

        case CMD_FACTORY:
            /* data[2]=factory_id  data[3..5]=H S V  data[6]=speed */
            apply_factory_effect(data[2], data[3], data[4], data[5], data[6]);
            break;

        case CMD_PER_KEY: {
            /* data[2]=offset  data[3..29]=9 LEDs * 3 bytes */
            uint8_t offset = data[2];
            for (uint8_t i = 0; i < 9 && (offset + i) < RGB_MATRIX_LED_COUNT; i++) {
                s_perkey_rgb[(offset + i) * 3 + 0] = data[3 + i * 3 + 0];
                s_perkey_rgb[(offset + i) * 3 + 1] = data[3 + i * 3 + 1];
                s_perkey_rgb[(offset + i) * 3 + 2] = data[3 + i * 3 + 2];
            }
            s_mode     = MODE_PER_KEY;
            s_override = true;
            break;
        }

        case CMD_CLEAR:
            s_mode     = MODE_OFF;
            s_override = true;
            break;

        case CMD_IDLE:
        default:
            s_override = false;
            s_mode     = MODE_OFF;
            break;
    }
}
