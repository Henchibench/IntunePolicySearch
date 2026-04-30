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

/* Editorial palette — warm tones that sit on cream canvas */
const TYPE_COLORS: Record<string, string> = {
  "Device Configuration": "#3860BE",
  "Compliance Policy": "#5CC58A",
  "App Protection": "#CF4500",
  "Configuration Policy": "#9A3A0A",
  "Group Policy": "#696969",
  "Security Baseline": "#F37338",
  "Enrollment Configuration": "#555555",
};

const PLATFORM_COLORS: Record<string, string> = {
  Windows: "#3860BE",
  iOS: "#5CC58A",
  Android: "#CF4500",
  macOS: "#9A3A0A",
  "All Platforms": "#696969",
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
      color: TYPE_COLORS[type] || "#696969",
    }));

    const platformCounts = policies.reduce((acc, policy) => {
      acc[policy.platform] = (acc[policy.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPlatform = Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count,
      color: PLATFORM_COLORS[platform] || "#696969",
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
