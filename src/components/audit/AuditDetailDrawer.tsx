import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AuditDiffSection } from './AuditDiffSection';
import type { AuditEvent, ResolvedActor } from '@/types/audit';

interface AuditDetailDrawerProps {
  event: AuditEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actors: Map<string, ResolvedActor>;
}

function formatFullTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditDetailDrawer({ event, open, onOpenChange, actors }: AuditDetailDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!event) return null;

  const userId = event.actor?.userId;
  const resolved = userId ? actors.get(userId) : null;
  const actorName = resolved?.displayName || event.actor?.userPrincipalName || 'Unknown';
  const actorUpn = resolved?.upn || event.actor?.userPrincipalName || '';

  const resource = event.resources?.[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-lg">{event.activity}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{event.activityOperationType}</Badge>
            <Badge
              variant={event.activityResult?.toLowerCase() === 'success' ? 'default' : 'destructive'}
            >
              {event.activityResult}
            </Badge>
            <Badge variant="outline">{event.category}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          {/* When */}
          <div>
            <span className="text-slate">When:</span>{' '}
            {formatFullTimestamp(event.activityDateTime)}
          </div>

          {/* Who */}
          <div>
            <span className="text-slate">Who:</span>{' '}
            <span className="font-medium">{actorName}</span>
            {actorUpn && actorUpn !== actorName && (
              <span className="ml-1 text-xs text-slate">({actorUpn})</span>
            )}
          </div>
          {event.actor?.applicationDisplayName && (
            <div>
              <span className="text-slate">Application:</span>{' '}
              {event.actor.applicationDisplayName}
            </div>
          )}
          {event.actor?.ipAddress && (
            <div>
              <span className="text-slate">IP Address:</span>{' '}
              {event.actor.ipAddress}
            </div>
          )}

          {/* Resource */}
          {resource && (
            <div>
              <span className="text-slate">Resource:</span>{' '}
              {resource.displayName}
              <span className="ml-1 text-xs text-slate">({resource.type})</span>
            </div>
          )}

          {/* Correlation ID */}
          {event.correlationId && (
            <div>
              <span className="text-slate">Correlation ID:</span>{' '}
              <span className="font-mono text-xs">{event.correlationId}</span>
            </div>
          )}

          <Separator />

          {/* Changes / Diffs */}
          <AuditDiffSection resources={event.resources ?? []} />

          <Separator />

          {/* Raw JSON */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRaw(s => !s)}
          >
            {showRaw ? 'Hide raw JSON' : 'Raw JSON'}
          </Button>
          {showRaw && (
            <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
              {JSON.stringify(event, null, 2)}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
