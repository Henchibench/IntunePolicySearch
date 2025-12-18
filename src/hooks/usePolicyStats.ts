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

const TYPE_COLORS: Record<string, string> = {
  "Device Configuration": "#3b82f6",
  "Compliance Policy": "#22c55e",
  "App Protection": "#f97316",
  "Configuration Policy": "#8b5cf6",
};

const PLATFORM_COLORS: Record<string, string> = {
  "Windows": "#3b82f6",
  "iOS": "#22c55e",
  "Android": "#f97316",
  "macOS": "#8b5cf6",
  "All Platforms": "#6b7280",
};

export function usePolicyStats(policies: Policy[]): PolicyStats {
  return useMemo(() => {
    // Count by type
    const typeCounts = policies.reduce((acc, policy) => {
      acc[policy.type] = (acc[policy.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      color: TYPE_COLORS[type] || "#6b7280",
    }));

    // Count by platform
    const platformCounts = policies.reduce((acc, policy) => {
      acc[policy.platform] = (acc[policy.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPlatform = Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count,
      color: PLATFORM_COLORS[platform] || "#6b7280",
    }));

    // Find unassigned policies
    const unassigned = policies.filter(
      (policy) => !policy.assignedGroups || policy.assignedGroups.length === 0
    );

    // Get recently modified (last 30 days, sorted by date)
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
