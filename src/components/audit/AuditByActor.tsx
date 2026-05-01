import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditEvent, ResolvedActor } from '@/types/audit';

interface AuditByActorProps {
  events: AuditEvent[];
  actors: Map<string, ResolvedActor>;
  onEventClick: (event: AuditEvent) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function operationColor(op: string): string {
  const lower = op.toLowerCase();
  if (lower === 'create' || lower === 'post') return 'bg-emerald-500';
  if (lower === 'delete') return 'bg-red-500';
  return 'bg-amber-500';
}

interface ActorGroup {
  key: string;
  displayName: string;
  upn: string;
  events: AuditEvent[];
}

function groupByActor(events: AuditEvent[], actors: Map<string, ResolvedActor>): ActorGroup[] {
  const groups = new Map<string, ActorGroup>();

  for (const event of events) {
    const userId = event.actor?.userId;
    const key = userId || event.actor?.userPrincipalName || 'unknown';

    if (!groups.has(key)) {
      const resolved = userId ? actors.get(userId) : null;
      groups.set(key, {
        key,
        displayName: resolved?.displayName || event.actor?.userPrincipalName || event.actor?.applicationDisplayName || 'Unknown',
        upn: resolved?.upn || event.actor?.userPrincipalName || '',
        events: [],
      });
    }
    groups.get(key)!.events.push(event);
  }

  return Array.from(groups.values()).sort((a, b) => b.events.length - a.events.length);
}

export function AuditByActor({ events, actors, onEventClick }: AuditByActorProps) {
  const groups = groupByActor(events, actors);

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate">
        No audit events found for this time range.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <ActorGroupSection key={group.key} group={group} onEventClick={onEventClick} />
      ))}
    </div>
  );
}

function ActorGroupSection({
  group,
  onEventClick,
}: {
  group: ActorGroup;
  onEventClick: (event: AuditEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-lifted overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-canvas transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <div className="normal-case min-w-0">
          <span className="text-sm font-medium text-ink block truncate">{group.displayName}</span>
          {group.upn && group.upn !== group.displayName && (
            <span className="text-[11px] text-slate block truncate">{group.upn}</span>
          )}
        </div>
        <span className="ml-auto tabular-nums text-muted-foreground/60">{group.events.length}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {group.events.map(event => {
            const resourceName = event.resources?.[0]?.displayName || event.displayName;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick(event)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-canvas transition-colors"
              >
                <span className="w-20 shrink-0 text-xs tabular-nums text-slate">
                  {formatRelativeTime(event.activityDateTime)}
                </span>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', operationColor(event.activityOperationType))} />
                <span className="flex-1 truncate text-ink">{event.activity}</span>
                <span className="hidden sm:block text-xs text-slate truncate">{resourceName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
