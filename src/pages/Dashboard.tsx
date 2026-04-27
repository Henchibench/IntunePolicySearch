import { useMemo } from "react";
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { useAuth } from "@/hooks/useAuth";
import { useManagedDevices } from "@/hooks/useManagedDevices";

export default function Dashboard() {
  const { isAuthenticated, dashboardService } = useAuth();
  const { devices, isLoading, error, refresh, cacheAgeMinutes } = useManagedDevices(dashboardService);

  const stats = useMemo(() => {
    const total = devices.length;
    const compliant = devices.filter(d => d.complianceState === "compliant").length;
    const failing = total - compliant;
    const pct = total ? Math.round((compliant / total) * 100) : 0;
    return { total, compliant, failing, pct };
  }, [devices]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="px-6">
          <PillNav />
          <UtilityRow />
        </div>
        <main className="mx-auto mt-12 max-w-[1240px] px-8 pb-24">
          <EyebrowLabel>INTUNE POLICY SEARCH</EyebrowLabel>
          <h1 className="mt-3 text-[44px] font-medium leading-tight tracking-tight2 text-ink">
            Sign in to view the dashboard.
          </h1>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="px-6">
        <PillNav />
        <UtilityRow onRefresh={refresh} isRefreshing={isLoading} />
      </div>
      <main className="mx-auto mt-12 max-w-[1240px] px-8 pb-24">
        <EyebrowLabel>DASHBOARD</EyebrowLabel>
        <h1 className="mt-3 text-[44px] font-medium leading-tight tracking-tight2 text-ink">
          Your Intune estate at a glance.
        </h1>

        <div className="mt-8 space-y-4">
          {error && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
              Failed to load devices: {error}
            </div>
          )}
          {cacheAgeMinutes !== null && (
            <div className="text-xs text-muted-foreground">
              Showing data from {cacheAgeMinutes} minute(s) ago. Click Refresh for live data.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiTile
              label="Compliance"
              value={`${stats.pct}%`}
              subStat={`${stats.failing} failing of ${stats.total}`}
              to="/dashboard/compliance"
              tone={stats.failing > 0 ? "danger" : "default"}
            />
            <KpiTile label="Apps" value="—" disabled />
            <KpiTile label="OS & Patch" value="—" disabled />
            <KpiTile label="Enrollment" value="—" disabled />
            <KpiTile label="Users" value="—" disabled />
            <KpiTile label="Assignment Health" value="—" disabled />
          </div>
        </div>
      </main>
    </div>
  );
}
