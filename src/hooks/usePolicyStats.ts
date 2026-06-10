import { useMemo } from "react";
import { Policy } from "@/types/graph";

export interface PolicyStats {
  total: number;
  byType: {
    type: string;
    count: number;
    color: string;
  }[];
  byPlatform: {
    platform: string;
    count: number;
    color: string;
  }[];
  unassigned: Policy[];
  recentlyModified: Policy[];
}

/* Fluent 2 categorical palette — brand ramp + balanced shared hues */
const TYPE_COLORS: Record<string, string> = {
  "Device Configuration": "#0F6CBD",
  "Compliance Policy": "#107C10",
  "App Protection": "#8764B8",
  "Configuration Policy": "#038387",
  "Group Policy": "#616161",
  "Security Baseline": "#F7630C",
  "Enrollment Configuration": "#479EF5",
};

const PLATFORM_COLORS: Record<string, string> = {
  Windows: "#0F6CBD",
  iOS: "#107C10",
  Android: "#F7630C",
  macOS: "#8764B8",
  "All Platforms": "#616161",
};

export function usePolicyStats(policies: Policy[]): PolicyStats {
  return useMemo(() => {
    const typeCounts = policies.reduce((acc, policy) => {
      acc[policy.type] = (acc[policy.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      color: TYPE_COLORS[type] || "#616161",
    }));

    const platformCounts = policies.reduce((acc, policy) => {
      acc[policy.platform] = (acc[policy.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPlatform = Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count,
      color: PLATFORM_COLORS[platform] || "#616161",
    }));

    const unassigned = policies.filter(
      (policy) => !policy.assignments || policy.assignments.length === 0
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyModified = policies
      .filter((policy) => new Date(policy.lastModified) > thirtyDaysAgo)
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, 10);

    return {
      total: policies.length,
      byType,
      byPlatform,
      unassigned,
      recentlyModified,
    };
  }, [policies]);
}
