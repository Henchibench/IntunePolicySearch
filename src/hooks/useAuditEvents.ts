import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';
import type { AuditEvent, AuditFilters } from '@/types/audit';

/**
 * Build OData $filter string for audit events.
 * Exported for testing.
 */
export function buildAuditFilter(
  from: Date,
  to: Date,
  categories: string[],
): string {
  let filter = `activityDateTime gt ${from.toISOString()} and activityDateTime lt ${to.toISOString()}`;

  if (categories.length > 0) {
    const catClauses = categories.map(c => `category eq '${c}'`).join(' or ');
    filter += ` and (${catClauses})`;
  }

  return filter;
}

export interface UseAuditEventsResult {
  events: AuditEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAuditEvents(filters: AuditFilters): UseAuditEventsResult {
  const { getAccessToken } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;
  const aborter = useRef<AbortController | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => setFetchTrigger(n => n + 1), []);

  useEffect(() => {
    if (aborter.current) aborter.current.abort();
    const ac = new AbortController();
    aborter.current = ac;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessTokenRef.current() },
        });

        const oDataFilter = buildAuditFilter(filters.from, filters.to, filters.categories);
        let url: string | null = `/deviceManagement/auditEvents?$filter=${encodeURIComponent(oDataFilter)}&$orderby=activityDateTime desc&$top=200`;

        const allEvents: AuditEvent[] = [];

        while (url) {
          if (ac.signal.aborted) return;
          const response = await client.api(url).version('v1.0').get();
          const page: AuditEvent[] = response.value ?? [];
          allEvents.push(...page);
          url = response['@odata.nextLink']
            ? response['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
            : null;
        }

        if (!ac.signal.aborted) {
          setEvents(allEvents);
        }
      } catch (e: unknown) {
        if (!ac.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Failed to load audit events');
        }
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => ac.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from.getTime(), filters.to.getTime(), filters.categories.join(','), fetchTrigger]);

  return { events, isLoading, error, refetch };
}
