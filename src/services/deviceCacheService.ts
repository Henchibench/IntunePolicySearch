import { ManagedDevice } from "@/types/managedDevice";

const CACHE_KEY = "intune-devices-cache";
const CACHE_DURATION_MS = 30 * 60 * 1000;

interface CachePayload {
  devices: ManagedDevice[];
  timestamp: number;
}

export class DeviceCacheService {
  static save(devices: ManagedDevice[]): void {
    try {
      const payload: CachePayload = { devices, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to cache devices:", err);
    }
  }

  static load(): ManagedDevice[] | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { devices, timestamp } = JSON.parse(raw) as CachePayload;
      if (Date.now() - timestamp > CACHE_DURATION_MS) {
        this.clear();
        return null;
      }
      return devices;
    } catch {
      this.clear();
      return null;
    }
  }

  static isValid(): boolean {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const { timestamp } = JSON.parse(raw) as CachePayload;
      return Date.now() - timestamp <= CACHE_DURATION_MS;
    } catch {
      return false;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* noop */
    }
  }

  static getInfo(): { exists: boolean; ageMinutes: number; count: number } | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { devices, timestamp } = JSON.parse(raw) as CachePayload;
      return {
        exists: true,
        ageMinutes: Math.round((Date.now() - timestamp) / 60000),
        count: devices.length,
      };
    } catch {
      return null;
    }
  }
}
