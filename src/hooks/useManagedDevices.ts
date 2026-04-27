import { useCallback, useEffect, useState } from "react";
import { ManagedDevice } from "@/types/managedDevice";
import { DashboardService } from "@/services/dashboardService";
import { DeviceCacheService } from "@/services/deviceCacheService";

interface UseManagedDevicesResult {
  devices: ManagedDevice[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  cacheAgeMinutes: number | null;
}

export function useManagedDevices(service: DashboardService | null): UseManagedDevicesResult {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);

  const fetchFromGraph = useCallback(async () => {
    if (!service) return;
    setIsLoading(true);
    setError(null);
    try {
      const fresh = await service.getManagedDevices();
      setDevices(fresh);
      DeviceCacheService.save(fresh);
      setCacheAgeMinutes(0);
    } catch (err) {
      console.error("Failed to load managed devices:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  // Initial load: prefer cache; fall back to Graph
  useEffect(() => {
    if (!service) return;
    const cached = DeviceCacheService.load();
    if (cached) {
      setDevices(cached);
      const info = DeviceCacheService.getInfo();
      setCacheAgeMinutes(info?.ageMinutes ?? null);
      return;
    }
    fetchFromGraph();
  }, [service, fetchFromGraph]);

  const refresh = useCallback(async () => {
    DeviceCacheService.clear();
    await fetchFromGraph();
  }, [fetchFromGraph]);

  return { devices, isLoading, error, refresh, cacheAgeMinutes };
}
