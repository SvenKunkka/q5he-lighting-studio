import type { DeviceDriver } from './interface';
import type { LightingConfig, DeviceInfo, RGBColor, VibeStatus } from '../types';
import { rgbToHsv } from '../lighting/model';
import { clampRgb, scaleRgbForOutput } from '../lighting/colorOutput';
import { TOTAL_LEDS } from '../lighting/keyLayout';

const VENDOR_ID  = 0x3434;
const PRODUCT_IDS = [0x0B50, 0x0B51, 0x0B52];

const RAW_HID_USAGE_PAGE = 0xFF60;
const RAW_HID_USAGE      = 0x61;

const MAGIC = 0xAC;
const CMD_IDLE      = 0x00;
const CMD_BUSY      = 0x01;
const CMD_DONE      = 0x02;
const CMD_ALLOW     = 0x03;
const CMD_SOLID     = 0x10;
const CMD_BREATHING = 0x11;
const CMD_WAVE      = 0x12;
const CMD_FLASHING  = 0x13;
const CMD_MARQUEE   = 0x14;
const CMD_FACTORY   = 0x20;
const CMD_PER_KEY   = 0x30;

const HID_REPORT_BYTES = 32;
const PER_KEY_HEADER_BYTES = 3;
const LEDS_PER_PACKET = 9;

if (LEDS_PER_PACKET * 3 + PER_KEY_HEADER_BYTES > HID_REPORT_BYTES) {
  throw new Error('Q5 HE RGB packet configuration exceeds the 32-byte HID report size.');
}

type WebHIDDevice = {
  opened: boolean;
  productName: string;
  vendorId: number;
  productId: number;
  collections: Array<{ usagePage?: number; usage?: number }>;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
};

type WebHIDNavigator = Navigator & {
  hid: {
    requestDevice(options: {
      filters: Array<{
        vendorId: number;
        productId?: number;
        usagePage?: number;
        usage?: number;
      }>;
    }): Promise<WebHIDDevice[]>;
  };
};

export class WebHIDDriver implements DeviceDriver {
  private device: WebHIDDevice | null = null;

  async connect(): Promise<DeviceInfo> {
    if (!('hid' in navigator)) throw new Error('WebHID requires Chrome or Edge.');
    const webHid = navigator as WebHIDNavigator;
    let devices: WebHIDDevice[] = await webHid.hid.requestDevice({
      filters: PRODUCT_IDS.map(pid => ({
        vendorId: VENDOR_ID, productId: pid,
        usagePage: RAW_HID_USAGE_PAGE, usage: RAW_HID_USAGE,
      })),
    });
    if (!devices?.length) {
      devices = await webHid.hid.requestDevice({ filters: [{ vendorId: VENDOR_ID }] });
    }
    if (!devices?.length) throw new Error('No device selected. Use a USB cable.');

    const iface = devices.find(d => d.collections.some(c =>
      c.usagePage === RAW_HID_USAGE_PAGE && c.usage === RAW_HID_USAGE)) ?? devices[0];
    this.device = iface;
    await this.device.open();
    return {
      name: this.device.productName || 'Keychron Q5 HE',
      vendorId: this.device.vendorId,
      productId: this.device.productId,
    };
  }

  async disconnect(): Promise<void> {
    if (this.device?.opened) await this.device.close();
    this.device = null;
  }

  isConnected(): boolean { return this.device?.opened ?? false; }

  /* Per-key buffer push: 12 packets to cover the Q5 HE's 101 RGB LEDs. */
  async sendPerKeyBuffer(colors: RGBColor[]): Promise<void> {
    if (!this.device?.opened) return;
    for (let off = 0; off < TOTAL_LEDS; off += LEDS_PER_PACKET) {
      const buf = new Uint8Array(HID_REPORT_BYTES);
      buf[0] = MAGIC;
      buf[1] = CMD_PER_KEY;
      buf[2] = off;
      for (let i = 0; i < LEDS_PER_PACKET && off + i < TOTAL_LEDS; i++) {
        const c = clampRgb(colors[off + i] ?? { r: 0, g: 0, b: 0 });
        buf[3 + i * 3 + 0] = c.r;
        buf[3 + i * 3 + 1] = c.g;
        buf[3 + i * 3 + 2] = c.b;
      }
      await this.device.sendReport(0x00, buf);
    }
  }

  async sendVibeStatus(
    status: VibeStatus,
    colors?: Pick<LightingConfig, 'vibeBusyColor' | 'vibeDoneColor' | 'vibeAllowColor' | 'brightness'>
  ): Promise<void> {
    if (!this.device?.opened) return;
    const brightness = colors?.brightness ?? 100;
    if (status === 'busy') {
      const c = colors?.vibeBusyColor ? scaleRgbForOutput(colors.vibeBusyColor, brightness) : undefined;
      await this.send(CMD_BUSY, c ? [c.r, c.g, c.b] : []);
      return;
    }
    if (status === 'done') {
      const c = colors?.vibeDoneColor ? scaleRgbForOutput(colors.vibeDoneColor, brightness) : undefined;
      await this.send(CMD_DONE, c ? [c.r, c.g, c.b] : []);
      return;
    }
    if (status === 'allow') {
      const c = colors?.vibeAllowColor ? scaleRgbForOutput(colors.vibeAllowColor, brightness) : undefined;
      await this.send(CMD_ALLOW, c ? [c.r, c.g, c.b] : []);
      return;
    }
    await this.send(CMD_IDLE, []);
  }

  async applyLighting(config: LightingConfig): Promise<void> {
    if (!this.device?.opened) return;

    switch (config.effect) {
      case 'off':
        await this.sendPerKeyBuffer(Array.from({ length: TOTAL_LEDS }, () => ({ r: 0, g: 0, b: 0 })));
        return;

      case 'normal': {
        const { color, brightness, speed } = config;
        const { r: R, g: G, b: B } = scaleRgbForOutput(color, brightness);
        const sp = Math.round(speed * 255 / 100);
        switch (config.normalSubmode) {
          case 'solid':     await this.send(CMD_SOLID,     [R, G, B]); return;
          case 'breathing': await this.send(CMD_BREATHING, [R, G, B, sp]); return;
          case 'flashing':  await this.send(CMD_FLASHING,  [R, G, B, sp]); return;
          case 'wave':      await this.send(CMD_WAVE,      [sp]); return;
          case 'marquee':   await this.send(CMD_MARQUEE,   [R, G, B, sp]); return;
        }
        break;
      }

      case 'factory': {
        const { h, s, v } = rgbToHsv(config.color.r, config.color.g, config.color.b);
        const vScaled = scaleRgbForOutput({ r: v, g: v, b: v }, config.brightness).r;
        const sp = Math.round(config.speed * 255 / 100);
        await this.send(CMD_FACTORY, [config.factoryId, h, s, vScaled, sp]);
        return;
      }

      case 'vibe':
        await this.send(CMD_IDLE, []);
        return;

      /* Animated/per-key effects are driven from App.tsx by sending
       * sendPerKeyBuffer() at the desired frame rate. applyLighting
       * is only called for one-shot transitions (e.g. switching effect),
       * so no-op for these. */
      case 'snake':
      case 'screen':
      case 'mic':
      case 'keystroke':
      case 'perkey':
      case 'image':
        return;
    }
  }

  private async send(cmd: number, payload: number[]): Promise<void> {
    const buf = new Uint8Array(HID_REPORT_BYTES);
    buf[0] = MAGIC;
    buf[1] = cmd;
    payload.forEach((v, i) => { buf[i + 2] = clampByte(v); });
    await this.device!.sendReport(0x00, buf);
  }
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}
