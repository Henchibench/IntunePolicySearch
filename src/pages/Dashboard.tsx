import { useMemo, useState, useEffect, useCallback } from "react";
import { Loader2, FileStack, Settings, ShieldCheck, AppWindow } from "lucide-react";
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { StatCard } from "@/components/dashboard/StatCard";
import { PlatformDonutChart } from "@/components/dashboard/PlatformDonutChart";
import { PolicyTypeBarChart } from "@/components/dashboard/PolicyTypeBarChart";
import { UnassignedPoliciesTable } from "@/components/dashboard/UnassignedPoliciesTable";
import { RecentlyModifiedTable } from "@/components/dashboard/RecentlyModifiedTable";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { useAuth } from "@/hooks/useAuth";
import { useManagedDevices } from "@/hooks/useManagedDevices";
import { usePolicyStats } from "@/hooks/usePolicyStats";
import { CacheService } from "@/services/cacheService";
import { Policy } from "@/types/graph";

export default function Dashboard() {
  const { isAuthenticated, graphService, dashboardService } = useAuth();
  const { devices, isLoading: devicesLoading, error: devicesError, refresh, cacheAgeMinutes } = useManagedDevices(dashboardService);

  /* ── Policy data ── */
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);

  const loadPolicies = useCallback(async (force = false) => {
    if (!graphService) return;
    setPoliciesLoading(true);
    setPoliciesError(null);
    try {
      if (!force && CacheService.isCacheValid()) {
        const cached = CacheService.loadPolicies();
        if (cached) { setPolicies(cached); return; }
      }
      const all = await graphService.getAllPolicies();
      setPolicies(all);
      CacheService.savePolicies(all);
    } catch (err) {
      setPoliciesError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setPoliciesLoading(false);
    }
  }, [graphService]);

  useEffect(() => {
    if (isAuthenticated && graphService) loadPolicies();
  }, [isAuthenticated, graphService, loadPolicies]);

  const policyStats = usePolicyStats(policies);

  /* ── Device compliance stats ── */
  const deviceStats = useMemo(() => {
    const total = devices.length;
    const compliant = devices.filter(d => d.complianceState === "compliant").length;
    const failing = total - compliant;
    const pct = total ? Math.round((compliant / total) * 100) : 0;
    return { total, compliant, failing, pct };
  }, [devices]);

  const isLoading = devicesLoading || policiesLoading;

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), loadPolicies(true)]);
  }, [refresh, loadPolicies]);

  const getTypeCount = (type: string) =>
    policyStats.byType.find(t => t.type === type)?.count || 0;

  /* ── Unauthenticated state ── */
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
        <UtilityRow onRefresh={handleRefresh} isRefreshing={isLoading} />
      </div>
      <main className="mx-auto mt-12 max-w-[1240px] px-8 pb-24">
        <EyebrowLabel>DASHBOARD</EyebrowLabel>
        <h1 className="mt-3 text-[44px] font-medium leading-tight tracking-tight2 text-ink">
          Your Intune estate at a glance.
        </h1>

        <div className="mt-8 space-y-4">
          {(devicesError || policiesError) && (
            <div className="rounded-2xl border border-signal/30 bg-signal/[0.10] p-3 text-sm text-signal-light">
              {devicesError && <p>Failed to load devices: {devicesError}</p>}
              {policiesError && <p>Failed to load policies: {policiesError}</p>}
            </div>
          )}
          {cacheAgeMinutes !== null && (
            <div className="text-xs text-muted-foreground">
              Showing data from {cacheAgeMinutes} minute(s) ago. Click Refresh for live data.
            </div>
          )}

          {/* ── Device health KPIs ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiTile
              label="Compliance"
              value={`${deviceStats.pct}%`}
              subStat={`${deviceStats.failing} failing of ${deviceStats.total}`}
              to="/dashboard/compliance"
              tone={deviceStats.failing > 0 ? "danger" : "default"}
            />
            <KpiTile label="Apps" value="—" disabled />
            <KpiTile label="OS & Patch" value="—" disabled />
            <KpiTile label="Enrollment" value="—" disabled />
            <KpiTile label="Users" value="—" disabled />
            <KpiTile label="Assignment Health" value="—" disabled />
          </div>
        </div>

        {/* ── Policy Health ── */}
        <div className="mt-16">
          <EyebrowLabel>POLICY HEALTH</EyebrowLabel>
          <h2 className="mt-3 text-[28px] font-medium leading-tight tracking-tight2 text-ink">
            Policy landscape overview.
          </h2>

          {policiesLoading && policies.length === 0 ? (
            <div className="mt-8 flex items-center gap-3 text-sm font-[450] text-slate">
              <Loader2 className="size-4 animate-spin" />
              Loading policies from Intune...
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                  title="Total"
                  value={policyStats.total}
                  icon={FileStack}
                  color="#141413"
                />
                <StatCard
                  title="Device Config"
                  value={getTypeCount("Device Configuration")}
                  icon={Settings}
                  color="#3860BE"
                />
                <StatCard
                  title="Compliance"
                  value={getTypeCount("Compliance Policy")}
                  icon={ShieldCheck}
                  color="#5CC58A"
                />
                <StatCard
                  title="App Protection"
                  value={getTypeCount("App Protection")}
                  icon={AppWindow}
                  color="#CF4500"
                />
                <StatCard
                  title="Settings Catalog"
                  value={getTypeCount("Configuration Policy")}
                  icon={Settings}
                  color="#9A3A0A"
                />
              </div>

              {/* Charts */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PlatformDonutChart data={policyStats.byPlatform} />
                <PolicyTypeBarChart data={policyStats.byType} />
              </div>

              {/* Tables */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UnassignedPoliciesTable policies={policyStats.unassigned} />
                <RecentlyModifiedTable policies={policyStats.recentlyModified} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
