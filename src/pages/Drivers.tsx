import { useMemo, useState } from 'react';
import { PillNav } from '@/components/PillNav';
import { UtilityRow } from '@/components/UtilityRow';
import { useAuth } from '@/hooks/useAuth';
import { useDrivers } from '@/hooks/useDrivers';
import { DriverFilterBar } from '@/components/drivers/DriverFilterBar';
import { DriverTable } from '@/components/drivers/DriverTable';
import { DriverByPolicy } from '@/components/drivers/DriverByPolicy';
import { DriverDetailDrawer } from '@/components/drivers/DriverDetailDrawer';
import { CatalogSyncStatus } from '@/components/drivers/CatalogSyncStatus';
import { cn } from '@/lib/utils';
import type { Driver, DriverFilters, DriverPivot } from '@/types/drivers';

const PIVOT_TABS: Array<{ key: DriverPivot; label: string }> = [
  { key: 'all', label: 'All Drivers' },
  { key: 'byPolicy', label: 'By Policy' },
];

function defaultFilters(): DriverFilters {
  return {
    manufacturers: [],
    driverClasses: [],
    approvalStatuses: [],
    criticalities: [],
    affectsDevicesOnly: true,
    freeText: '',
  };
}

function applyFilters(drivers: Driver[], filters: DriverFilters): Driver[] {
  let result = drivers;
  if (filters.affectsDevicesOnly) {
    result = result.filter((d) => d.applicableDeviceCount > 0);
  }
  if (filters.manufacturers.length > 0) {
    const set = new Set(filters.manufacturers);
    result = result.filter((d) => set.has(d.manufacturer));
  }
  if (filters.driverClasses.length > 0) {
    const set = new Set(filters.driverClasses);
    result = result.filter((d) => set.has(d.driverClass));
  }
  if (filters.approvalStatuses.length > 0) {
    const set = new Set(filters.approvalStatuses);
    result = result.filter((d) => d.policies.some((p) => set.has(p.approvalStatus)));
  }
  if (filters.criticalities.length > 0) {
    const set = new Set(filters.criticalities);
    result = result.filter((d) => d.catalog && set.has(d.catalog.criticality));
  }
  if (filters.freeText.trim()) {
    const q = filters.freeText.toLowerCase();
    result = result.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.manufacturer.toLowerCase().includes(q) ||
      d.driverClass.toLowerCase().includes(q) ||
      d.version.toLowerCase().includes(q)
    );
  }
  return result;
}

export default function Drivers() {
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<DriverFilters>(defaultFilters);
  const [pivot, setPivot] = useState<DriverPivot>('all');
  const [selected, setSelected] = useState<Driver | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { drivers, profiles, catalog, isLoading, error, inventoryErrors } = useDrivers(isAuthenticated);

  const manufacturers = useMemo(
    () => Array.from(new Set(drivers.map((d) => d.manufacturer))).sort(),
    [drivers]
  );
  const driverClasses = useMemo(
    () => Array.from(new Set(drivers.map((d) => d.driverClass))).sort(),
    [drivers]
  );

  const filtered = useMemo(() => applyFilters(drivers, filters), [drivers, filters]);

  const handleClick = (driver: Driver) => {
    setSelected(driver);
    setDrawerOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-canvas">
        <PillNav />
        <div className="mx-auto max-w-7xl px-4 py-6">
          <UtilityRow />
          <p className="mt-12 text-center text-sm text-slate">Sign in to view driver updates.</p>
        </div>
      </div>
    );
  }

  const noProfiles = !isLoading && !error && profiles.length === 0;

  return (
    <div className="min-h-screen bg-canvas">
      <PillNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <UtilityRow />

        <div className="mt-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-medium tracking-tight2 text-ink">Driver Updates</h1>
            <CatalogSyncStatus
              isElectron={!!window.__IS_ELECTRON__}
              source={catalog.source}
              lastSyncedAt={catalog.lastSyncedAt}
              syncStatus={catalog.syncStatus}
              syncError={catalog.syncError}
              onSync={() => void catalog.sync()}
            />
          </div>

          {!noProfiles && (
            <div className="sticky top-14 z-40 bg-canvas border-b border-border pb-3 space-y-3">
              <DriverFilterBar
                filters={filters}
                onChange={setFilters}
                manufacturers={manufacturers}
                driverClasses={driverClasses}
                catalogAvailable={catalog.source !== 'none'}
              />

              <div className="flex items-center justify-between">
                <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
                  {PIVOT_TABS.map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={pivot === t.key}
                      onClick={() => setPivot(t.key)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-sm transition-colors',
                        pivot === t.key
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs tabular-nums text-slate">
                  {filtered.length} driver{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-signal/30 bg-signal/[0.10] p-3 text-sm text-signal-light">
              Failed to load driver update profiles. {error}
            </div>
          )}

          {inventoryErrors.size > 0 && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-50 p-3 text-sm text-amber-900">
              Failed to load drivers for {inventoryErrors.size} profile{inventoryErrors.size === 1 ? '' : 's'}. Some data may be incomplete.
            </div>
          )}

          {isLoading && (
            <div className="py-12 text-center text-sm text-slate">Loading driver updates…</div>
          )}

          {noProfiles && (
            <div className="rounded-2xl border border-border p-8 text-center text-sm text-slate">
              No Windows Driver Update profiles found in this tenant.{' '}
              <a
                className="underline"
                href="https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesWindowsMenu/~/windowsDriverUpdates"
                target="_blank"
                rel="noreferrer"
              >
                Create one in the Intune portal
              </a>
              .
            </div>
          )}

          {!isLoading && !error && !noProfiles && (
            <>
              {pivot === 'all' && <DriverTable drivers={filtered} onDriverClick={handleClick} />}
              {pivot === 'byPolicy' && (
                <DriverByPolicy
                  profiles={profiles}
                  drivers={filtered}
                  onDriverClick={handleClick}
                  inventoryErrors={inventoryErrors}
                />
              )}
            </>
          )}
        </div>
      </div>

      <DriverDetailDrawer
        driver={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
