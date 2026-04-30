import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { GroupTypeBadge } from './GroupTypeBadge';
import { Badge } from '@/components/ui/badge';
import type { GroupAssignmentResult } from '@/types/graph';

export interface ResultsDetailDrawerProps {
  row: GroupAssignmentResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResultsDetailDrawer({ row, open, onOpenChange }: ResultsDetailDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {row && (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="text-lg">{row.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <GroupTypeBadge category={row.category} />
                <Badge variant={row.intent === 'exclude' ? 'destructive' : 'default'}>
                  {row.intent}
                </Badge>
                {row.appIntent && (
                  <Badge variant="outline">{row.appIntent}</Badge>
                )}
                {row.source.kind === 'parent' && (
                  <Badge variant="outline">via {row.source.groupName ?? row.source.groupId}</Badge>
                )}
              </div>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              {row.description && <p className="text-muted-foreground">{row.description}</p>}
              {row.platform && (
                <div><span className="text-muted-foreground">Platform:</span> {row.platform}</div>
              )}
              {row.filter && (
                <div>
                  <span className="text-muted-foreground">Filter:</span>{' '}
                  {row.filter.displayName ?? row.filter.id}
                  {' '}<Badge variant="outline">{row.filter.mode}</Badge>
                </div>
              )}
              {row.lastModified && (
                <div>
                  <span className="text-muted-foreground">Last modified:</span>{' '}
                  {new Date(row.lastModified).toLocaleString()}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRaw((s) => !s)}
              >
                {showRaw ? 'Hide raw JSON' : 'Raw JSON'}
              </Button>
              {showRaw && (
                <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(row.rawObject, null, 2)}
                </pre>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
