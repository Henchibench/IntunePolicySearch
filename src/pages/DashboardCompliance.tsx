import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useManagedDevices } from "@/hooks/useManagedDevices";
import { groupByPlatform, groupByReason, groupByUser, PivotGroup } from "@/lib/compliance-pivots";
import { PivotTabs, PivotKey } from "@/components/dashboard/PivotTabs";
import { GroupList } from "@/components/dashboard/GroupList";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { DeviceDrawer } from "@/components/dashboard/DeviceDrawer";
import { ChevronLeft } from "lucide-react";

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

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-6">
          <p className="text-muted-foreground">Sign in to view the dashboard.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header onRefresh={refresh} isRefreshing={isLoading} />
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <h2 className="text-xl font-semibold">Compliance</h2>

        {error && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm">
            Failed to load devices: {error}
          </div>
        )}
        {cacheAgeMinutes !== null && (
          <div className="text-xs text-muted-foreground">
            Showing data from {cacheAgeMinutes} minute(s) ago.
          </div>
        )}

        <PivotTabs value={pivot} onChange={setPivot} />

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <GroupList groups={groups} selectedKey={groupKey} onSelect={setGroup} total={devices.length} />
          <div>
            {selectedGroup ? (
              <DeviceTable
                devices={selectedGroup.devices}
                selectedDeviceId={deviceId}
                onSelect={id => setDevice(id)}
              />
            ) : (
              <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
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
    </>
  );
}
