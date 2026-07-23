import type { LightingConfig, DeviceInfo } from '../types';

export interface DeviceDriver {
  connect(): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  applyLighting(config: LightingConfig): Promise<void>;
  isConnected(): boolean;
}
