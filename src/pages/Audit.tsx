import { useState, useMemo, useEffect, useRef } from 'react';
import { PillNav } from '@/components/PillNav';
import { UtilityRow } from '@/components/UtilityRow';
import { useAuth } from '@/hooks/useAuth';
import { useAuditEvents } from '@/hooks/useAuditEvents';
import { useActorResolver } from '@/hooks/useActorResolver';
import { AuditFilterBar } from '@/components/audit/AuditFilterBar';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { AuditByResource } from '@/components/audit/AuditByResource';
import { AuditByActor } from '@/components/audit/AuditByActor';
import { AuditDetailDrawer } from '@/components/audit/AuditDetailDrawer';
import { cn } from '@/lib/utils';
import type { AuditFilters, AuditPivot, AuditEvent } from '@/types/audit';
import { Client } from '@microsoft/microsoft-graph-client';

const PIVOT_TABS: Array<{ key: AuditPivot; label: string }> = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'byResource', label: 'By Resource' },
  { key: 'byActor', label: 'By Actor' },
];

function defaultFilters(): AuditFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return { from, to, categories: [], actorSearch: '', freeText: '' };
}

export default function Audit() {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [pivot, setPivot] = useState<AuditPivot>('timeline');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch audit categories for the filter dropdown
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessTokenRef.current() },
        });
        const result = await client.api('/deviceManagement/auditEvents/getAuditCategories').version('v1.0').get();
        const cats: string[] = result?.value ?? result ?? [];
        setAvailableCategories(Array.isArray(cats) ? cats.sort() : []);
      } catch {
        // Non-critical — category filter just won't populate
      }
    })();
  }, [isAuthenticated]);

  // Fetch events
  const { events, isLoading, error } = useAuditEvents(filters, isAuthenticated);

  // Resolve actor names
  const { actors } = useActorResolver(events);

  // Client-side filtering (actor search + free text)
  const filteredEvents = useMemo(() => {
    let result = events;

    if (filters.actorSearch) {
      const search = filters.actorSearch.toLowerCase();
      result = result.filter(e => {
        const userId = e.actor?.userId;
        const resolved = userId ? actors.get(userId) : null;
        const name = resolved?.displayName?.toLowerCase() || '';
        const upn = (resolved?.upn || e.actor?.userPrincipalName || '').toLowerCase();
        return name.includes(search) || upn.includes(search);
      });
    }

    if (filters.freeText) {
      const search = filters.freeText.toLowerCase();
      result = result.filter(e => {
        const resourceName = e.resources?.[0]?.displayName || '';
        return (
          e.displayName.toLowerCase().includes(search) ||
          e.activity.toLowerCase().includes(search) ||
          resourceName.toLowerCase().includes(search) ||
          e.category.toLowerCase().includes(search)
        );
      });
    }

    return result;
  }, [events, filters.actorSearch, filters.freeText, actors]);

  const handleEventClick = (event: AuditEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <PillNav />
        <div className="mx-auto max-w-7xl px-4 py-6">
          <UtilityRow />
          <p className="mt-12 text-center text-sm text-muted-foreground">Sign in to view audit events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PillNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <UtilityRow />

        <div className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>

          {/* Filter bar */}
          <AuditFilterBar
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
          />

          {/* Pivot tabs */}
          <div className="flex items-center justify-between">
            <div role="tablist" className="inline-flex gap-1 rounded-md bg-muted p-1">
              {PIVOT_TABS.map(t => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={pivot === t.key}
                  onClick={() => setPivot(t.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    pivot === t.key
                      ? 'bg-background shadow-sm font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading audit events...</div>
          )}

          {/* Results */}
          {!isLoading && !error && (
            <>
              {pivot === 'timeline' && (
                <AuditTimeline events={filteredEvents} actors={actors} onEventClick={handleEventClick} />
              )}
              {pivot === 'byResource' && (
                <AuditByResource events={filteredEvents} actors={actors} onEventClick={handleEventClick} />
              )}
              {pivot === 'byActor' && (
                <AuditByActor events={filteredEvents} actors={actors} onEventClick={handleEventClick} />
              )}
            </>
          )}
        </div>
      </div>

      <AuditDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        actors={actors}
      />
    </div>
  );
}
