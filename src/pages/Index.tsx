import { useState } from "react";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { PolicyCard } from "@/components/PolicyCard";
import { mockPolicies, policyTypeOptions, platformOptions } from "@/lib/mockData";
import { usePolicySearch } from "@/hooks/usePolicySearch";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  const {
    searchTerm,
    setSearchTerm,
    selectedPolicyType,
    setSelectedPolicyType,
    selectedPlatform,
    setSelectedPlatform,
    filteredPolicies,
  } = usePolicySearch(mockPolicies);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
    toast({
      title: "Policies refreshed",
      description: "Policy data has been updated successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Search and Filters Section */}
        <div className="space-y-6">
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
                Showing {filteredPolicies.length} of {mockPolicies.length} policies
                {searchTerm && (
                  <span className="ml-1">
                    for "<span className="font-medium text-foreground">{searchTerm}</span>"
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Policies Grid */}
        <div className="space-y-6">
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground text-lg">
                No policies found matching your search criteria
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Try adjusting your search terms or filters
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredPolicies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  searchTerm={searchTerm}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
