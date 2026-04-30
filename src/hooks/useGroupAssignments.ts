import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';
import {
  ALL_INTUNE_OBJECT_CATEGORIES,
  type CategoryState,
  type GroupAssignmentResult,
  type IntuneObjectCategory,
  type ParentGroupRef,
} from '@/types/graph';
import { fetchGroupAssignments } from '@/services/groupAssignmentService';

function makePendingMap(): Record<IntuneObjectCategory, CategoryState> {
  const m = {} as Record<IntuneObjectCategory, CategoryState>;
  for (const c of ALL_INTUNE_OBJECT_CATEGORIES) m[c] = { status: 'pending' };
  return m;
}

export interface UseGroupAssignmentsResult {
  perCategory: Record<IntuneObjectCategory, CategoryState>;
  results: GroupAssignmentResult[];
  parentGroups: ParentGroupRef[];
  isLoading: boolean;
  fatalError: string | null;
}

export function useGroupAssignments(
  groupId: string | null,
): UseGroupAssignmentsResult {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [perCategory, setPerCategory] = useState(makePendingMap);
  const [resultsByCat, setResultsByCat] = useState<
    Record<IntuneObjectCategory, GroupAssignmentResult[]>
  >({} as Record<IntuneObjectCategory, GroupAssignmentResult[]>);
  const [parentGroups, setParentGroups] = useState<ParentGroupRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    if (aborter.current) aborter.current.abort();
    if (!groupId || !isAuthenticated) {
      setPerCategory(makePendingMap());
      setResultsByCat({} as Record<IntuneObjectCategory, GroupAssignmentResult[]>);
      setParentGroups([]);
      setIsLoading(false);
      setFatalError(null);
      return;
    }

    const ac = new AbortController();
    aborter.current = ac;
    setPerCategory(makePendingMap());
    setResultsByCat({} as Record<IntuneObjectCategory, GroupAssignmentResult[]>);
    setParentGroups([]);
    setIsLoading(true);
    setFatalError(null);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessToken() },
        });
        await fetchGroupAssignments(client, groupId, {
          signal: ac.signal,
          onParentGroups: (p) => {
            if (!ac.signal.aborted) setParentGroups(p);
          },
          onCategoryStatus: (cat, state) => {
            if (ac.signal.aborted) return;
            setPerCategory((prev) => ({ ...prev, [cat]: state }));
          },
          onResults: (cat, rows) => {
            if (ac.signal.aborted) return;
            setResultsByCat((prev) => ({ ...prev, [cat]: rows }));
          },
        });
      } catch (e: unknown) {
        if (!ac.signal.aborted) {
          setFatalError(e instanceof Error ? e.message : 'Failed');
        }
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [groupId, isAuthenticated, getAccessToken]);

  const results = Object.values(resultsByCat).flat();
  return { perCategory, results, parentGroups, isLoading, fatalError };
}
