import { useMemo, useState } from "react";
import { Policy } from "@/types/graph";

export const usePolicySearch = (policies: Policy[]) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPolicyType, setSelectedPolicyType] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedAssignment, setSelectedAssignment] = useState("all");

  // Extract unique assignments from all policies
  const uniqueAssignments = useMemo(() => {
    const assignmentSet = new Set<string>();
    policies.forEach(policy => {
      policy.assignments?.forEach(assignment => {
        assignmentSet.add(assignment.displayName);
      });
    });
    return Array.from(assignmentSet).sort();
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      // Filter by policy type
      const matchesPolicyType = selectedPolicyType === "all" || policy.type === selectedPolicyType;
      
      // Filter by platform
      const matchesPlatform = selectedPlatform === "all" || policy.platform === selectedPlatform;
      
      // Filter by assignment
      const matchesAssignment = selectedAssignment === "all" || 
        policy.assignments?.some(assignment => assignment.displayName === selectedAssignment);
      
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
      
      return matchesPolicyType && matchesPlatform && matchesAssignment && matchesSearch;
    });
  }, [policies, searchTerm, selectedPolicyType, selectedPlatform, selectedAssignment]);

  return {
    searchTerm,
    setSearchTerm,
    selectedPolicyType,
    setSelectedPolicyType,
    selectedPlatform,
    setSelectedPlatform,
    selectedAssignment,
    setSelectedAssignment,
    uniqueAssignments,
    filteredPolicies,
  };
};