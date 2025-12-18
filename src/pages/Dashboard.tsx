import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePolicyStats } from "@/hooks/usePolicyStats";
import { Policy } from "@/types/graph";
import { mockPolicies } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Shield, Loader2, Database, FileStack, Settings, ShieldCheck, AppWindow } from "lucide-react";
import { CacheService } from "@/services/cacheService";
import { StatCard } from "@/components/dashboard/StatCard";
import { PlatformDonutChart } from "@/components/dashboard/PlatformDonutChart";
import { PolicyTypeBarChart } from "@/components/dashboard/PolicyTypeBarChart";
import { UnassignedPoliciesTable } from "@/components/dashboard/UnassignedPoliciesTable";
import { RecentlyModifiedTable } from "@/components/dashboard/RecentlyModifiedTable";

const Dashboard = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAuthenticated, graphService, error: authError } = useAuth();

  // Use mock data when not authenticated, real data when authenticated
  const activePolicies = useMemo(() => {
    return isAuthenticated ? policies : mockPolicies;
  }, [isAuthenticated, policies]);

  // Calculate stats from policies
  const stats = usePolicyStats(activePolicies);

  // Load policies from cache or Graph API when authenticated
  const loadPolicies = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) return;

    setIsLoadingPolicies(true);
    setPoliciesError(null);

    try {
      // Try to load from cache first unless forcing refresh
      if (!forceRefresh && CacheService.isCacheValid()) {
        const cachedPolicies = CacheService.loadPolicies();
        if (cachedPolicies) {
          setPolicies(cachedPolicies);
          return;
        }
      }

      // Load from API if no cache or forced refresh
      if (!graphService) {
        throw new Error("Graph service not available");
      }

      const allPolicies = await graphService.getAllPolicies();
      setPolicies(allPolicies);

      // Save to cache
      CacheService.savePolicies(allPolicies);

      toast({
        title: "Policies loaded successfully",
        description: `Fetched ${allPolicies.length} policies from your Intune tenant.`,
      });
    } catch (error) {
      console.error("Failed to load policies:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load policies";
      setPoliciesError(errorMessage);
      toast({
        title: "Error loading policies",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [graphService, isAuthenticated, toast]);

  // Load policies when authentication is complete
  useEffect(() => {
    if (isAuthenticated && graphService) {
      loadPolicies();
    }
  }, [isAuthenticated, graphService, loadPolicies]);

  const handleRefresh = async () => {
    if (isAuthenticated && graphService) {
      setIsRefreshing(true);
      await loadPolicies(true);
      setIsRefreshing(false);
    } else {
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsRefreshing(false);
      toast({
        title: "Mock data refreshed",
        description: "Demo data has been refreshed. Sign in to load real Intune policies.",
      });
    }
  };

  // Get counts by type for stat cards
  const getTypeCount = (type: string) => {
    return stats.byType.find(t => t.type === type)?.count || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Authentication & Error States */}
        {authError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Authentication error: {authError}
            </AlertDescription>
          </Alert>
        )}

        {policiesError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading policies: {policiesError}
            </AlertDescription>
          </Alert>
        )}

        {/* Demo mode notification */}
        {!isAuthenticated && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Shield className="h-5 w-5" />
                Demo Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You're viewing demo data. Sign in with your Microsoft account to see your real Intune statistics.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cache status notification */}
        {isAuthenticated && CacheService.getCacheInfo() && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Database className="h-5 w-5" />
                Cached Data
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Showing cached data from {CacheService.getCacheInfo()?.age} minutes ago.
                Click refresh to fetch the latest policies from Intune.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isAuthenticated && isLoadingPolicies && policies.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-lg">Loading policies from Intune...</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Fetching all policies to generate dashboard statistics.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Content */}
        {(!isLoadingPolicies || activePolicies.length > 0) && (
          <>
            {/* Page Title */}
            <div>
              <h2 className="text-2xl font-bold">Policy Health Dashboard</h2>
              <p className="text-muted-foreground">Overview of your Intune policy landscape</p>
            </div>

            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Policies"
                value={stats.total}
                icon={FileStack}
                color="#6366f1"
              />
              <StatCard
                title="Device Configuration"
                value={getTypeCount("Device Configuration")}
                icon={Settings}
                color="#3b82f6"
              />
              <StatCard
                title="Compliance Policies"
                value={getTypeCount("Compliance Policy")}
                icon={ShieldCheck}
                color="#22c55e"
              />
              <StatCard
                title="App Protection"
                value={getTypeCount("App Protection")}
                icon={AppWindow}
                color="#f97316"
              />
              <StatCard
                title="Settings Catalog"
                value={getTypeCount("Configuration Policy")}
                icon={Settings}
                color="#8b5cf6"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlatformDonutChart data={stats.byPlatform} />
              <PolicyTypeBarChart data={stats.byType} />
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UnassignedPoliciesTable policies={stats.unassigned} />
              <RecentlyModifiedTable policies={stats.recentlyModified} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
