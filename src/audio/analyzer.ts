import { MicMapper } from '../effects/micMap';

export interface AudioAnalyzer {
  start(deviceId: string | null): Promise<void>;
  stop(): void;
  getVolume(): number;
  getDevices(): Promise<MediaDeviceInfo[]>;
}

export class MicAnalyzer extends MicMapper implements AudioAnalyzer {}
