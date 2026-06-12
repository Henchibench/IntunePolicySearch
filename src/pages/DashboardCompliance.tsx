import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { useAuth } from "@/hooks/useAuth";
import { useManagedDevices } from "@/hooks/useManagedDevices";
import { groupByPlatform, groupByReason, groupByUser, PivotGroup } from "@/lib/compliance-pivots";
import { PivotTabs, PivotKey } from "@/components/dashboard/PivotTabs";
import { GroupList } from "@/components/dashboard/GroupList";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { DeviceDrawer } from "@/components/dashboard/DeviceDrawer";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagedDevice } from "@/types/managedDevice";

const VALID_PIVOTS: PivotKey[] = ["reason", "platform", "user"];

function pivotFromParam(p: string | null): PivotKey {
  return (VALID_PIVOTS as string[]).includes(p ?? "") ? (p as PivotKey) : "reason";
}

export default function DashboardCompliance() {
  const { isAuthenticated, dashboardService } = useAuth();
  const { devices, isLoading, error, refresh, cacheAgeMinutes } = useManagedDevices(dashboardService);

  const [searchParams, setSearchParams] = useSearchParams();
  const pivot = pivotFromParam(searchParams.get("pivot"));
  const groupKey = searchParams.get("group");
  const deviceId = searchParams.get("device");

  const groups: PivotGroup[] = useMemo(() => {
    if (pivot === "platform") return groupByPlatform(devices);
    if (pivot === "user") return groupByUser(devices);
    return groupByReason(devices);
  }, [devices, pivot]);

  const selectedGroup = useMemo(
    () => (groupKey ? groups.find(g => g.key === groupKey) ?? null : null),
    [groups, groupKey]
  );

  const selectedDevice = useMemo(
    () => (deviceId ? devices.find(d => d.id === deviceId) ?? null : null),
    [devices, deviceId]
  );

  const setPivot = (next: PivotKey) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("pivot", next);
      sp.delete("group");
      sp.delete("device");
      return sp;
    });
  };

  const setGroup = (key: string) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("group", key);
      sp.delete("device");
      return sp;
    });
  };

  const setDevice = (id: string | null) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      if (id) sp.set("device", id);
      else sp.delete("device");
      return sp;
    });
  };

  const [refinedGroups, setRefinedGroups] = useState<PivotGroup[] | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const refineReasons = async () => {
    if (!dashboardService) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const ids = devices
        .filter(d => d.complianceState !== "compliant" && d.complianceState !== "unknown")
        .map(d => d.id);
      const map = await dashboardService.getNonCompliantPolicyStatesBulk(ids);

      // Bucket devices by failing setting name. If a policy reports no per-setting
      // detail (settingStates omitted or empty), fall back to grouping by policy name
      // so the user still gets a meaningful refinement.
      const bucketMap = new Map<string, { label: string; devices: Set<ManagedDevice> }>();
      const addToBucket = (key: string, label: string, device: ManagedDevice) => {
        if (!bucketMap.has(key)) bucketMap.set(key, { label, devices: new Set() });
        bucketMap.get(key)!.devices.add(device);
      };

      for (const d of devices) {
        const entries = map.get(d.id) ?? [];
        for (const e of entries) {
          if (e.failingSettings.length > 0) {
            for (const s of e.failingSettings) {
              addToBucket(`setting:${s}`, s, d);
            }
          } else if (e.policyDisplayName) {
            addToBucket(`policy:${e.policyDisplayName}`, `Policy: ${e.policyDisplayName}`, d);
          }
        }
      }

      const groups: PivotGroup[] = [];
      for (const [key, v] of bucketMap.entries()) {
        groups.push({ key, label: v.label, devices: Array.from(v.devices) });
      }
      groups.sort((a, b) => b.devices.length - a.devices.length);
      setRefinedGroups(groups);
    } catch (err) {
      console.error("Refine reasons failed:", err);
      setRefineError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRefining(false);
    }
  };

  const displayedGroups = pivot === "reason" && refinedGroups ? refinedGroups : groups;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <PillNav />
        <div className="px-6">
          <UtilityRow />
        </div>
        <main className="mx-auto mt-12 max-w-[1280px] px-6 pb-24">
          <p className="text-xs font-semibold text-primary">Intune Policy Search</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Sign in to view compliance.
          </h1>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PillNav />
      <div className="px-6">
        <UtilityRow onRefresh={refresh} isRefreshing={isLoading} />
      </div>
      <main className="mx-auto mt-12 max-w-[1280px] px-6 pb-24 space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <p className="text-xs font-semibold text-primary">Compliance</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Every device, every policy.
        </h1>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load devices: {error}
          </div>
        )}
        {cacheAgeMinutes !== null && (
          <div className="text-xs text-muted-foreground">
            Showing data from {cacheAgeMinutes} minute(s) ago.
          </div>
        )}

        <PivotTabs value={pivot} onChange={setPivot} />

        {pivot === "reason" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button onClick={refineReasons} disabled={isRefining || !devices.length} variant="outline" size="sm">
                {isRefining ? "Refining…" : refinedGroups ? "Refine again" : "Refine reasons (slow, opt-in)"}
              </Button>
              {refinedGroups && (
                <Button onClick={() => { setRefinedGroups(null); setRefineError(null); }} variant="ghost" size="sm">
                  Clear refinement
                </Button>
              )}
            </div>
            {refineError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                Refine failed: {refineError}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <GroupList groups={displayedGroups} selectedKey={groupKey} onSelect={setGroup} total={devices.length} />
          <div>
            {selectedGroup ? (
              <DeviceTable
                devices={selectedGroup.devices}
                selectedDeviceId={deviceId}
                onSelect={id => setDevice(id)}
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Select a group to see its devices.
              </div>
            )}
          </div>
        </div>
      </main>

      <DeviceDrawer
        device={selectedDevice}
        open={!!selectedDevice}
        onOpenChange={open => { if (!open) setDevice(null); }}
      />
    </div>
  );
}
