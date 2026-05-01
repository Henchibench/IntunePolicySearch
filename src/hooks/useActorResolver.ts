import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';
import type { AuditEvent, ResolvedActor } from '@/types/audit';

export interface UseActorResolverResult {
  actors: Map<string, ResolvedActor>;
  isResolving: boolean;
}

/**
 * Batch-resolve unique actor.userId values to display names.
 * Caches results in a Map that persists across re-renders.
 */
export function useActorResolver(events: AuditEvent[]): UseActorResolverResult {
  const { getAccessToken } = useAuth();
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;
  const [actors, setActors] = useState<Map<string, ResolvedActor>>(new Map());
  const [isResolving, setIsResolving] = useState(false);
  const cacheRef = useRef<Map<string, ResolvedActor>>(new Map());

  useEffect(() => {
    const userIds = new Set<string>();
    for (const event of events) {
      const uid = event.actor?.userId;
      if (uid && !cacheRef.current.has(uid)) {
        userIds.add(uid);
      }
    }

    if (userIds.size === 0) {
      setActors(new Map(cacheRef.current));
      return;
    }

    setIsResolving(true);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessTokenRef.current() },
        });

        const resolvePromises = Array.from(userIds).map(async (userId) => {
          try {
            const user = await client
              .api(`/users/${userId}`)
              .version('v1.0')
              .select('displayName,userPrincipalName')
              .get();
            cacheRef.current.set(userId, {
              displayName: user.displayName || user.userPrincipalName || userId,
              upn: user.userPrincipalName || '',
            });
          } catch {
            // Deleted user or service principal — fall back
            cacheRef.current.set(userId, {
              displayName: userId,
              upn: '',
            });
          }
        });

        await Promise.all(resolvePromises);
        setActors(new Map(cacheRef.current));
      } finally {
        setIsResolving(false);
      }
    })();
  }, [events]);

  return { actors, isResolving };
}
