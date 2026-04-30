import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';

export interface EntraGroupMatch {
  id: string;
  displayName: string;
  mail?: string | null;
  description?: string | null;
}

export type SearchMode = 'typeahead' | 'full';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const TYPEAHEAD_TOP = 25;
const FULL_PAGE_SIZE = 100;
const FULL_RESULT_CAP = 500;

interface GraphGroupListResponse {
  value: EntraGroupMatch[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

export function useEntraGroupSearch(query: string) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [matches, setMatches] = useState<EntraGroupMatch[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode>('typeahead');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aborter = useRef<AbortController | null>(null);

  // Stable ref so the effect doesn't re-run when MSAL refreshes accounts.
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  useEffect(() => {
    setMode('typeahead');
  }, [query]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (timer.current) clearTimeout(timer.current);
    if (aborter.current) aborter.current.abort();

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setTotal(null);
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
          authProvider: { getAccessToken: async () => await getAccessTokenRef.current() },
          defaultVersion: 'beta',
        });
        // Graph /groups doesn't support $filter=contains, but $search supports
        // tokenised substring matching when used with ConsistencyLevel: eventual.
        // Wrap the value in quotes per the search spec; escape embedded quotes.
        const escaped = query.replace(/"/g, '\\"');
        const searchClause = `"displayName:${escaped}"`;
        const top = mode === 'full' ? FULL_PAGE_SIZE : TYPEAHEAD_TOP;

        const firstPage = (await client
          .api('/groups')
          .header('ConsistencyLevel', 'eventual')
          .count(true)
          .search(searchClause)
          .select('id,displayName,mail,description')
          .top(top)
          .get()) as GraphGroupListResponse;

        if (ac.signal.aborted) return;
        const collected: EntraGroupMatch[] = [...(firstPage.value ?? [])];
        const reportedTotal = firstPage['@odata.count'] ?? null;

        if (mode === 'full') {
          let nextLink = firstPage['@odata.nextLink'];
          while (nextLink && collected.length < FULL_RESULT_CAP) {
            if (ac.signal.aborted) return;
            const next = (await client
              .api(nextLink)
              .header('ConsistencyLevel', 'eventual')
              .get()) as GraphGroupListResponse;
            collected.push(...(next.value ?? []));
            nextLink = next['@odata.nextLink'];
          }
        }

        if (!ac.signal.aborted) {
          setMatches(collected);
          setTotal(reportedTotal);
        }
      } catch (e: unknown) {
        if (!ac.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Search failed');
        }
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, mode, isAuthenticated]);

  const expandToFullList = useCallback(() => setMode('full'), []);

  return { matches, total, isLoading, error, mode, expandToFullList };
}
