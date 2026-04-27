import { useCallback, useState } from "react";
import { DashboardService } from "@/services/dashboardService";
import { DeviceDeepDetails } from "@/types/managedDevice";

interface UseDeviceDeepDetailsResult {
  details: DeviceDeepDetails | null;
  isLoading: boolean;
  error: string | null;
  load: (deviceId: string, userPrincipalName?: string) => Promise<void>;
  reset: () => void;
}

export function useDeviceDeepDetails(service: DashboardService | null): UseDeviceDeepDetailsResult {
  const [details, setDetails] = useState<DeviceDeepDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (deviceId: string, userPrincipalName?: string) => {
      if (!service) {
        setError("Not authenticated");
        return;
      }
      setIsLoading(true);
      setError(null);
      setDetails(null);
      try {
        const data = await service.getDeviceDeepDetails(deviceId, userPrincipalName);
        setDetails(data);
      } catch (err) {
        console.error("Failed to load deep details:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  const reset = useCallback(() => {
    setDetails(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { details, isLoading, error, load, reset };
}
