import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogEntry } from '@/types/drivers';

interface Props {
  criticality: CatalogEntry['criticality'] | null;
}

const COLOR_MAP: Record<CatalogEntry['criticality'], string> = {
  Urgent: 'text-red-500',
  Recommended: 'text-amber-500',
  Optional: 'text-slate-400',
  Other: 'text-slate-400',
};

export function DriverCriticalityBadge({ criticality }: Props) {
  if (!criticality) return null;
  return (
    <span
      aria-label={`Criticality: ${criticality}`}
      title={criticality}
      className={cn('inline-flex h-4 w-4 items-center justify-center', COLOR_MAP[criticality])}
    >
      <AlertCircle className="h-4 w-4" />
    </span>
  );
}
