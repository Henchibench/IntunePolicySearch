import { useEffect, useState, useRef } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from './useAuth';
import type { DriverInventory } from '@/types/drivers';

type FetchFn = (profileId: string) => Promise<DriverInventory[]>;

export interface FanOutResult {
  results: Map<string, DriverInventory[]>;
  errors: Map<string, string>;
}

export async function fetchInventoriesForProfiles(
  profileIds: string[],
  fetcher: FetchFn,
  opts: { collectErrors?: boolean } = {}
): Promise<FanOutResult> {
  const results = new Map<string, DriverInventory[]>();
  const errors = new Map<string, string>();
  await Promise.all(
    profileIds.map(async (id) => {
      try {
        const list = await fetcher(id);
        results.set(id, list);
      } catch (err) {
        if (opts.collectErrors) {
          errors.set(id, err instanceof Error ? err.message : String(err));
        } else {
          throw err;
        }
      }
    })
  );
  return { results, errors };
}

export function useDriverInventories(profileIds: string[], enabled: boolean) {
  const { getAccessToken } = useAuth();
  const [inventories, setInventories] = useState<Map<string, DriverInventory[]>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    if (!enabled || profileIds.length === 0) return;
    let cancelled = false;
    setIsLoading(true);

    const client = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => await tokenRef.current() },
    });

    const fetcher: FetchFn = async (profileId) => {
      const collected: DriverInventory[] = [];
      let response = await client
        .api(`/deviceManagement/windowsDriverUpdateProfiles/${profileId}/driverInventories`)
        .version('beta')
        .get();
      while (response) {
        if (Array.isArray(response.value)) collected.push(...response.value);
        if (!response['@odata.nextLink']) break;
        response = await client.api(response['@odata.nextLink']).get();
      }
      return collected;
    };

    fetchInventoriesForProfiles(profileIds, fetcher, { collectErrors: true })
      .then(({ results, errors: errMap }) => {
        if (cancelled) return;
        setInventories(results);
        setErrors(errMap);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [profileIds.join('|'), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { inventories, errors, isLoading };
}
