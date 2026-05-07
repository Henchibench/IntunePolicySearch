import { useEffect, useState, useRef } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from './useAuth';
import type { DriverProfile } from '@/types/drivers';

export function useDriverProfiles(enabled: boolean) {
  const { getAccessToken } = useAuth();
  const [profiles, setProfiles] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await tokenRef.current() },
        });
        const collected: DriverProfile[] = [];
        let response = await client
          .api('/deviceManagement/windowsDriverUpdateProfiles')
          .version('beta')
          .get();
        while (response) {
          if (Array.isArray(response.value)) collected.push(...response.value);
          if (!response['@odata.nextLink']) break;
          response = await client.api(response['@odata.nextLink']).get();
        }
        if (!cancelled) setProfiles(collected);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  return { profiles, isLoading, error };
}
