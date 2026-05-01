import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AuditEvent, ResolvedActor } from '@/types/audit';

interface AuditTimelineProps {
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
  return 'bg-amber-500'; // update, patch
}

function getActorDisplay(event: AuditEvent, actors: Map<string, ResolvedActor>): { name: string; secondary: string } {
  const userId = event.actor?.userId;
  if (userId && actors.has(userId)) {
    const resolved = actors.get(userId)!;
    return { name: resolved.displayName, secondary: resolved.upn };
  }
  const upn = event.actor?.userPrincipalName;
  if (upn) return { name: upn, secondary: '' };
  const app = event.actor?.applicationDisplayName;
  if (app) return { name: app, secondary: 'Application' };
  return { name: 'Unknown', secondary: '' };
}

export function AuditTimeline({ events, actors, onEventClick }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate">
        No audit events found for this time range. Try widening the date range.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-lifted overflow-hidden divide-y divide-border">
      {events.map((event) => {
        const actor = getActorDisplay(event, actors);
        const resourceName = event.resources?.[0]?.displayName || event.displayName;
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onEventClick(event)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-canvas transition-colors"
          >
            {/* Time */}
            <span className="w-20 shrink-0 text-xs tabular-nums text-slate">
              {formatRelativeTime(event.activityDateTime)}
            </span>

            {/* Operation dot */}
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', operationColor(event.activityOperationType))}
              title={event.activityOperationType}
            />

            {/* Activity + resource */}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-ink truncate block">{event.activity}</span>
              <span className="text-xs text-slate truncate block">{resourceName}</span>
            </div>

            {/* Actor */}
            <div className="hidden sm:block w-40 shrink-0 text-right">
              <span className="text-xs text-ink truncate block">{actor.name}</span>
              {actor.secondary && (
                <span className="text-[11px] text-slate truncate block">{actor.secondary}</span>
              )}
            </div>

            {/* Result */}
            <Badge
              variant={event.activityResult?.toLowerCase() === 'success' ? 'default' : 'destructive'}
              className="shrink-0 text-[10px]"
            >
              {event.activityResult || 'Unknown'}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
