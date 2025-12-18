import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { PolicyCard } from "@/components/PolicyCard";
import { mockPolicies, policyTypeOptions, platformOptions } from "@/lib/mockData";
import { usePolicySearch } from "@/hooks/usePolicySearch";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Policy } from "@/types/graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Shield, Loader2, Database } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CacheService } from "@/services/cacheService";

const ITEMS_PER_LOAD = 20;

const Index = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_LOAD);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hideCertificates, setHideCertificates] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, graphService, error: authError } = useAuth();

  // Check URL for certificate filtering
  useEffect(() => {
    const shouldHideCerts = window.location.pathname.includes('/filter') || window.location.pathname.includes('/demo');
    setHideCertificates(shouldHideCerts);
  }, []);
  
  // Function to detect certificate policies
  const isCertificatePolicy = (policy: Policy): boolean => {
    const certificateKeywords = [
      'certificate', 'cert', 'ca', 'root ca', 'trusted', 'publisher', 
      'pkcs', 'scep', 'pki', 'trusted root', 'intermediate', 'chain'
    ];
    
    const policyText = `${policy.name} ${policy.description}`.toLowerCase();
    return certificateKeywords.some(keyword => policyText.includes(keyword));
  };

  // Filter out certificates if needed
  const policiesForSearch = useMemo(() => {
    const basePolicies = isAuthenticated ? policies : mockPolicies;
    if (hideCertificates) {
      return basePolicies.filter(policy => !isCertificatePolicy(policy));
    }
    return basePolicies;
  }, [policies, mockPolicies, isAuthenticated, hideCertificates]);

  const {
    searchTerm,
    setSearchTerm,
    selectedPolicyType,
    setSelectedPolicyType,
    selectedPlatform,
    setSelectedPlatform,
    filteredPolicies,
  } = usePolicySearch(policiesForSearch);

  // Infinite scroll logic
  const displayedPolicies = useMemo(() => {
    return filteredPolicies.slice(0, displayedCount);
  }, [filteredPolicies, displayedCount]);

  const hasMore = displayedCount < filteredPolicies.length;

  // Load more items for infinite scroll
  const loadMoreItems = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    // Simulate a small delay for smooth UX
    setTimeout(() => {
      setDisplayedCount(prev => prev + ITEMS_PER_LOAD);
      setIsLoadingMore(false);
    }, 300);
  }, [hasMore, isLoadingMore]);

  // Set up infinite scroll observer
  const { observerTarget } = useInfiniteScroll(loadMoreItems, {
    threshold: 0.1,
    rootMargin: '100px',
  });

  // Reset displayed count when search/filter changes
  useEffect(() => {
    setDisplayedCount(ITEMS_PER_LOAD);
  }, [searchTerm, selectedPolicyType, selectedPlatform]);

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
          const cacheInfo = CacheService.getCacheInfo();
          toast({
            title: "Policies loaded from cache",
            description: `Loaded ${cachedPolicies.length} policies from cache (${cacheInfo?.age} minutes old). Click refresh to fetch latest data.`,
          });
          return;
        }
      }

      // Load from API if no cache or forced refresh
      if (!graphService) {
        throw new Error("Graph service not available");
      }

      console.log("Fetching policies from Intune API...");
      const allPolicies = await graphService.getAllPolicies();
      setPolicies(allPolicies);
      
      // Save to cache
      CacheService.savePolicies(allPolicies);
      
      console.log(`Successfully loaded ${allPolicies.length} total policies`);
      
      toast({
        title: "Policies loaded successfully",
        description: `Fetched ${allPolicies.length} policies from your Intune tenant and cached for 30 minutes.`,
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
      await loadPolicies(true); // Force refresh from API
      setIsRefreshing(false);
    } else {
      // Mock data refresh for demonstration
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsRefreshing(false);
      toast({
        title: "Mock data refreshed",
        description: "Demo data has been refreshed. Sign in to load real Intune policies.",
      });
    }
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
                You're viewing demo data. Sign in with your Microsoft account to connect to Intune and view your actual policies.
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

        {/* Loading state for initial policy fetch */}
        {isAuthenticated && isLoadingPolicies && policies.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-lg">Loading policies from Intune...</span>
              </div>
              <div className="text-sm text-muted-foreground max-w-md text-center">
                Fetching all configuration policies, compliance policies, and app protection policies. 
                This may take a moment for large tenants with 200+ policies.
              </div>
              <div className="text-xs text-muted-foreground">
                Check the browser console (F12) for detailed progress information.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters Section - Sticky */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-6 mb-6">
          <div className="space-y-6 pt-6">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search policies, settings, and configurations..."
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FilterDropdown
                    label="Policy Type"
                    value={selectedPolicyType}
                    options={policyTypeOptions}
                    onChange={setSelectedPolicyType}
                    placeholder="All policy types"
                  />
                  <FilterDropdown
                    label="Platform"
                    value={selectedPlatform}
                    options={platformOptions}
                    onChange={setSelectedPlatform}
                    placeholder="All platforms"
                  />
                </div>
              </div>
              
              {/* Results summary */}
              <div className="md:col-span-2 flex items-end">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min(displayedCount, filteredPolicies.length)} of {filteredPolicies.length} policies
                  {filteredPolicies.length !== (isAuthenticated ? policies.length : mockPolicies.length) && (
                    <span className="ml-1">
                      (filtered from {isAuthenticated ? policies.length : mockPolicies.length} total)
                    </span>
                  )}
                  {searchTerm && (
                    <span className="ml-1">
                      for "<span className="font-medium text-foreground">{searchTerm}</span>"
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Policies Grid */}
        <div className="space-y-6">
          {filteredPolicies.length === 0 && !isLoadingPolicies ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground text-lg">
                No policies found matching your search criteria
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Try adjusting your search terms or filters
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-6">
                {displayedPolicies.map((policy, index) => (
                  <PolicyCard
                    key={`${policy.id}-${index}`}
                    policy={policy}
                    searchTerm={searchTerm}
                  />
                ))}
              </div>

              {/* Infinite Scroll Trigger & Loading Indicator */}
              {hasMore && (
                <div
                  ref={observerTarget}
                  className="flex items-center justify-center py-8"
                >
                  {isLoadingMore && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more policies...</span>
                    </div>
                  )}
                </div>
              )}

              {/* End of results indicator */}
              {!hasMore && filteredPolicies.length > ITEMS_PER_LOAD && (
                <div className="text-center py-8 text-sm text-muted-foreground border-t">
                  You've reached the end of the results ({filteredPolicies.length} policies)
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
