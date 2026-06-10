import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Driver, DriverInventory } from '@/types/drivers';
import { DriverCriticalityBadge } from './DriverCriticalityBadge';

interface Props {
  drivers: Driver[];
  onDriverClick: (driver: Driver) => void;
}

const APPROVAL_VARIANT: Record<DriverInventory['approvalStatus'], string> = {
  needsReview: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-slate-100 text-slate-900',
  suspended: 'bg-muted text-muted-foreground',
};

function ApprovalBadge({ status }: { status: DriverInventory['approvalStatus'] }) {
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs', APPROVAL_VARIANT[status])}>
      {status}
    </span>
  );
}

function summaryStatus(driver: Driver): DriverInventory['approvalStatus'] {
  // Worst-case across policies for a single representative badge in flat view
  const order: DriverInventory['approvalStatus'][] = ['needsReview', 'suspended', 'declined', 'approved'];
  for (const s of order) {
    if (driver.policies.some((p) => p.approvalStatus === s)) return s;
  }
  return 'approved';
}

export function DriverTable({ drivers, onDriverClick }: Props) {
  if (drivers.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center text-sm text-slate">
        No drivers match the current filters.
      </div>
    );
  }
  return (
    <div role="table" className="overflow-hidden rounded-2xl border border-border">
      <div role="row" className="grid grid-cols-[24px_1fr_120px_120px_120px_96px_80px] gap-3 border-b border-border bg-muted px-3 py-2 text-xs font-medium text-slate">
        <div role="columnheader" aria-label="Criticality" />
        <div role="columnheader">Driver</div>
        <div role="columnheader">Version</div>
        <div role="columnheader">Released</div>
        <div role="columnheader">Approval</div>
        <div role="columnheader" className="text-right">Applicable</div>
        <div role="columnheader" className="text-right">Policies</div>
      </div>
      {drivers.map((d) => (
        <div
          key={`${d.key}|${d.version}`}
          role="row"
          aria-label={d.name}
          onClick={() => onDriverClick(d)}
          className="grid cursor-pointer grid-cols-[24px_1fr_120px_120px_120px_96px_80px] items-center gap-3 border-b border-border px-3 py-2 hover:bg-muted/50"
        >
          <div role="cell"><DriverCriticalityBadge criticality={d.catalog?.criticality ?? null} /></div>
          <div role="cell">
            <div className="font-medium text-ink">{d.name}</div>
            <div className="text-xs text-slate">{d.manufacturer} · {d.driverClass}</div>
          </div>
          <div role="cell" className="tabular-nums">{d.version}</div>
          <div role="cell" className="text-xs text-slate">
            {formatDistanceToNow(new Date(d.releaseDateTime), { addSuffix: true })}
          </div>
          <div role="cell"><ApprovalBadge status={summaryStatus(d)} /></div>
          <div role="cell" className="text-right tabular-nums">{d.applicableDeviceCount}</div>
          <div role="cell" className="text-right">
            {d.policies.length > 1 ? (
              <Badge variant="secondary">{d.policies.length} policies</Badge>
            ) : (
              <span className="text-xs text-slate">{d.policies[0]?.profileName ?? '—'}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
