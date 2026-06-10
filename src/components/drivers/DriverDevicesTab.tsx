import { useEffect, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDriverApplicableDevices } from '@/hooks/useDriverApplicableDevices';
import { useAuth } from '@/hooks/useAuth';
import { useManagedDevices } from '@/hooks/useManagedDevices';
import { enrichWithDeviceMetadata } from '@/hooks/useDriverApplicableDevices.enrich';
import type { DriverApplicableDevice } from '@/types/drivers';

interface Props {
  catalogEntryIds: string[];
  enabled: boolean;
  /** Inventory's applicable-device count. The status report below counts a
   *  different population, so this is used only to explain an empty list. */
  applicableDeviceCount?: number;
  /** Reports the report's total device count once a fetch completes, so the
   *  parent can label the tab with a number that matches this list. */
  onLoaded?: (totalCount: number) => void;
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

function intuneDeviceUrl(deviceId: string): string {
  return `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${encodeURIComponent(deviceId)}`;
}

export function DriverDevicesTab({ catalogEntryIds, enabled, applicableDeviceCount = 0, onLoaded }: Props) {
  const { devices, totalCount, isLoading, error, retry } = useDriverApplicableDevices(
    catalogEntryIds,
    enabled
  );

  // Report the count only on a real loading→done transition, so the parent
  // label never flashes a premature "(0)" before the fetch has run.
  const wasLoading = useRef(false);
  useEffect(() => {
    if (isLoading) {
      wasLoading.current = true;
    } else if (wasLoading.current && !error) {
      wasLoading.current = false;
      onLoaded?.(totalCount);
    }
  }, [isLoading, error, totalCount, onLoaded]);

  const { dashboardService } = useAuth();
  const { devices: managedDevices } = useManagedDevices(dashboardService);
  const managedDeviceMap = useMemo(
    () => new Map(managedDevices.map((d) => [d.id, d])),
    [managedDevices]
  );
  const enriched = useMemo(
    () => enrichWithDeviceMetadata(devices, managedDeviceMap),
    [devices, managedDeviceMap]
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
    // The status report is empty. If the inventory still says the driver is
    // applicable to devices, explain the gap rather than contradict the list —
    // applicable devices only appear here once the driver is approved and
    // offered, so they have a reported update status.
    if (applicableDeviceCount > 0) {
      return (
        <div className="py-8 text-center text-sm text-slate">
          Applicable to {applicableDeviceCount} device{applicableDeviceCount !== 1 ? 's' : ''}, but
          none have a reported update status yet. Devices appear here once the
          driver is approved and offered to them.
        </div>
      );
    }
    return (
      <div className="py-8 text-center text-sm text-slate">
        No devices currently apply for this driver.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate">
        Showing {enriched.length} of {totalCount} device{totalCount !== 1 ? 's' : ''}.
      </div>
      <div className="space-y-3">
        {enriched.map((d) => (
          <article
            key={`${d.deviceId}|${d.policyName}`}
            aria-label={d.deviceName}
            className="rounded-2xl border border-border bg-background p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {d.deviceName ? (
                  <a
                    href={intuneDeviceUrl(d.deviceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
                  >
                    {d.deviceName}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                ) : (
                  <span className="font-medium text-ink">—</span>
                )}
                <div className="text-xs text-slate">{d.upn || '—'}</div>
              </div>
              <StateBadge device={d} />
            </div>

            <div className="mt-3 border-t border-border pt-3 space-y-1 text-xs text-slate">
              <div>
                <span className="text-ink">{d.model || '—'}</span>
                {d.manufacturer ? (
                  <>
                    <span className="text-slate"> · </span>
                    <span className="text-slate">{d.manufacturer}</span>
                  </>
                ) : null}
              </div>
              <div>
                {d.policyName || '—'} · scanned {safeRelative(d.lastWUScanTime)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
