import { useMemo, useState } from "react";
import { Policy } from "@/components/PolicyCard";

export const usePolicySearch = (policies: Policy[]) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPolicyType, setSelectedPolicyType] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      // Filter by policy type
      const matchesPolicyType = selectedPolicyType === "all" || policy.type === selectedPolicyType;
      
      // Filter by platform
      const matchesPlatform = selectedPlatform === "all" || policy.platform === selectedPlatform;
      
      // Filter by search term
      const matchesSearch = !searchTerm || 
        policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        policy.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        policy.settings.some(setting => 
          setting.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          setting.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (setting.description && setting.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      
      return matchesPolicyType && matchesPlatform && matchesSearch;
    });
  }, [policies, searchTerm, selectedPolicyType, selectedPlatform]);

  return {
    searchTerm,
    setSearchTerm,
    selectedPolicyType,
    setSelectedPolicyType,
    selectedPlatform,
    setSelectedPlatform,
    filteredPolicies,
  };
};