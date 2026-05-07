import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Driver, DriverInventory } from '@/types/drivers';
import { DriverCriticalityBadge } from './DriverCriticalityBadge';

interface Props {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wide text-slate">{children}</div>;
}

export function DriverDetailDrawer({ driver, open, onOpenChange }: Props) {
  if (!driver) return null;
  const dellSearchUrl = `https://www.dell.com/support/search/results?q=${encodeURIComponent(driver.name)}`;
  const msUpdateUrl = `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(driver.name)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{driver.name}</SheetTitle>
          <div className="text-sm text-slate">
            {driver.manufacturer} · {driver.driverClass} · {driver.version}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DriverCriticalityBadge criticality={driver.catalog?.criticality ?? null} />
            {driver.policies.length === 1 ? (
              <ApprovalBadge status={driver.policies[0].approvalStatus} />
            ) : (
              <Badge variant="secondary">In {driver.policies.length} policies</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <EyebrowLabel>OVERVIEW</EyebrowLabel>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate">Released</dt>
              <dd className="text-ink">{new Date(driver.releaseDateTime).toLocaleDateString()}</dd>
              <dt className="text-slate">Driver class</dt>
              <dd className="text-ink">{driver.driverClass}</dd>
              <dt className="text-slate">Manufacturer</dt>
              <dd className="text-ink">{driver.manufacturer}</dd>
              <dt className="text-slate">Applicable devices</dt>
              <dd className="text-ink tabular-nums">{driver.applicableDeviceCount}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <EyebrowLabel>POLICIES</EyebrowLabel>
            <ul className="space-y-2">
              {driver.policies.map((p) => (
                <li key={p.profileId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <div className="text-ink">{p.profileName}</div>
                    <div className="text-xs text-slate">{p.approvalType === 'manual' ? 'Manual' : 'Automatic'} approval</div>
                  </div>
                  <ApprovalBadge status={p.approvalStatus} />
                </li>
              ))}
            </ul>
          </section>

          {driver.catalog ? (
            <section className="space-y-2">
              <EyebrowLabel>DETAILS FROM DELL CATALOG</EyebrowLabel>
              {driver.catalog.fixes.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Fixes / enhancements</div>
                  <ul className="ml-4 list-disc text-sm text-slate">
                    {driver.catalog.fixes.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {driver.catalog.knownIssues.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Known issues</div>
                  <ul className="ml-4 list-disc text-sm text-slate">
                    {driver.catalog.knownIssues.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
              {driver.catalog.supportedModels.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Supported hardware</div>
                  <div className="text-sm text-slate">{driver.catalog.supportedModels.join(', ')}</div>
                </div>
              )}
              {driver.catalog.supportedOperatingSystems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Operating systems</div>
                  <div className="flex flex-wrap gap-1">
                    {driver.catalog.supportedOperatingSystems.map((os) => (
                      <Badge key={os} variant="outline">{os}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {driver.catalog.releaseNotesUrl && (
                <a
                  href={driver.catalog.releaseNotesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary underline"
                >
                  Release notes <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </section>
          ) : (
            <section className="space-y-2">
              <EyebrowLabel>CATALOG</EyebrowLabel>
              <p className="text-sm text-slate">
                No catalog data for this driver. Use the links below to look up release notes externally.
              </p>
            </section>
          )}

          <section className="space-y-2">
            <EyebrowLabel>LOOKUP</EyebrowLabel>
            <div className="flex flex-wrap gap-2">
              <a
                href={dellSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
              >
                Search Dell support <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={msUpdateUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
              >
                Search Microsoft Update Catalog <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
