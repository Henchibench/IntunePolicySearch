import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';

export interface EntraGroupMatch {
  id: string;
  displayName: string;
  mail?: string | null;
  description?: string | null;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const TOP = 10;

export function useEntraGroupSearch(query: string) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [matches, setMatches] = useState<EntraGroupMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (timer.current) clearTimeout(timer.current);
    if (aborter.current) aborter.current.abort();

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    timer.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      const ac = new AbortController();
      aborter.current = ac;
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessToken() },
        });
        const escaped = query.replace(/'/g, "''");
        const resp = (await client
          .api('/groups')
          .filter(`startswith(displayName,'${escaped}')`)
          .select('id,displayName,mail,description')
          .top(TOP)
          .get()) as { value: EntraGroupMatch[] };
        if (!ac.signal.aborted) setMatches(resp.value ?? []);
      } catch (e: any) {
        if (!ac.signal.aborted) setError(e?.message ?? 'Search failed');
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, isAuthenticated, getAccessToken]);

  return { matches, isLoading, error };
}
