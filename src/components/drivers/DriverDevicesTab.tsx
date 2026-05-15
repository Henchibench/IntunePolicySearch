import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDriverApplicableDevices } from '@/hooks/useDriverApplicableDevices';
import type { DriverApplicableDevice } from '@/types/drivers';

interface Props {
  catalogEntryId: string | null;
  enabled: boolean;
}

function stateBadgeClasses(loc: string): string {
  const s = loc.toLowerCase();
  if (s.includes('installed')) return 'bg-emerald-100 text-emerald-900';
  if (s.includes('error') || s.includes('failed')) return 'bg-red-100 text-red-900';
  if (s.includes('offer')) return 'bg-amber-100 text-amber-900';
  if (s.includes('cancel') || s.includes('declined')) return 'bg-slate-100 text-slate-900';
  return 'bg-muted text-muted-foreground';
}

function StateBadge({ device }: { device: DriverApplicableDevice }) {
  const label = device.currentDeviceUpdateStateLoc || device.aggregateState || '—';
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs', stateBadgeClasses(label))}>
      {label}
    </span>
  );
}

function safeRelative(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function DriverDevicesTab({ catalogEntryId, enabled }: Props) {
  const { devices, totalCount, isLoading, error, retry } = useDriverApplicableDevices(
    catalogEntryId,
    enabled
  );

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate">
        Loading device report…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 rounded-2xl border border-signal/30 bg-signal/[0.10] p-3 text-sm text-signal-light">
        <div>Failed to load device report.</div>
        <div className="text-xs opacity-75">{error}</div>
        <Button type="button" size="sm" variant="outline" onClick={retry}>Retry</Button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate">
        No devices currently apply for this driver.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate">
        Showing {devices.length} of {totalCount} device{totalCount !== 1 ? 's' : ''}.
      </div>
      <div role="table" className="overflow-hidden rounded-2xl border border-border">
        <div
          role="row"
          className="grid grid-cols-[1fr_140px_1fr_140px] gap-3 border-b border-border bg-muted px-3 py-2 text-xs font-medium text-slate"
        >
          <div role="columnheader">Device</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Policy</div>
          <div role="columnheader" className="text-right">Last scan</div>
        </div>
        {devices.map((d) => (
          <div
            key={`${d.deviceId}|${d.policyName}`}
            role="row"
            aria-label={d.deviceName}
            className="grid grid-cols-[1fr_140px_1fr_140px] items-center gap-3 border-b border-border px-3 py-2"
          >
            <div role="cell">
              <div className="font-medium text-ink">{d.deviceName || '—'}</div>
              <div className="text-xs text-slate">{d.upn || '—'}</div>
            </div>
            <div role="cell"><StateBadge device={d} /></div>
            <div role="cell" className="text-xs text-slate">{d.policyName || '—'}</div>
            <div role="cell" className="text-right text-xs text-slate">
              {safeRelative(d.lastWUScanTime)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
