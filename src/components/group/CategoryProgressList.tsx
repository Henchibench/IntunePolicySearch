import { Clock, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_INTUNE_OBJECT_CATEGORIES,
  type CategoryState,
  type IntuneObjectCategory,
} from '@/types/graph';
import { categoryLabel } from './GroupTypeBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface CategoryProgressListProps {
  groupName: string;
  states: Record<IntuneObjectCategory, CategoryState>;
}

export function CategoryProgressList({
  groupName,
  states,
}: CategoryProgressListProps) {
  const total = ALL_INTUNE_OBJECT_CATEGORIES.length;
  const completed = ALL_INTUNE_OBJECT_CATEGORIES.filter(
    (c) => states[c].status === 'done' || states[c].status === 'error',
  ).length;
  const totalConnections = ALL_INTUNE_OBJECT_CATEGORIES.reduce(
    (sum, c) => sum + (states[c].count ?? 0),
    0,
  );

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-base font-semibold">Inspecting {groupName}…</div>
        <div className="text-sm text-muted-foreground">
          {completed} of {total} complete · {totalConnections} connections found
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {ALL_INTUNE_OBJECT_CATEGORIES.map((c) => {
          const s = states[c];
          return (
            <li
              key={c}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                s.status === 'loading' && 'animate-pulse',
              )}
            >
              <StatusIcon state={s} />
              <span className="flex-1 truncate">{categoryLabel(c)}</span>
              {s.count != null && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {s.count}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusIcon({ state }: { state: CategoryState }) {
  if (state.status === 'pending')
    return <Clock className="h-4 w-4 text-muted-foreground/50" />;
  if (state.status === 'loading')
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (state.status === 'done')
    return <Check className="h-4 w-4 text-emerald-600" />;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertCircle className="h-4 w-4 text-amber-600" />
        </TooltipTrigger>
        <TooltipContent>{state.error ?? 'Unknown error'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
