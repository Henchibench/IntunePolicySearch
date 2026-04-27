import { ManagedDevice, ComplianceState } from "@/types/managedDevice";

export type Platform = "Windows" | "iOS" | "iPadOS" | "Android" | "macOS" | "Linux" | "Other";

export interface PivotGroup {
  key: string;
  label: string;
  devices: ManagedDevice[];
}

export function normalizePlatform(os: string | undefined): Platform {
  if (!os) return "Other";
  const lower = os.toLowerCase();
  if (lower === "windows" || lower.startsWith("win")) return "Windows";
  if (lower === "ipados" || lower === "ipad") return "iPadOS";
  if (lower === "ios" || lower === "iphone") return "iOS";
  if (lower === "android") return "Android";
  if (lower === "macos" || lower === "osx" || lower === "mac" || lower === "mac os x") return "macOS";
  if (lower === "linux") return "Linux";
  return "Other";
}

export function isStale(device: ManagedDevice, days: number): boolean {
  if (!device.lastSyncDateTime) return false;
  const ageMs = Date.now() - new Date(device.lastSyncDateTime).getTime();
  return ageMs > days * 24 * 60 * 60 * 1000;
}

function sortGroupsByCountDesc(groups: PivotGroup[]): PivotGroup[] {
  return groups.sort((a, b) => b.devices.length - a.devices.length);
}

export function groupByPlatform(devices: ManagedDevice[]): PivotGroup[] {
  const map = new Map<Platform, ManagedDevice[]>();
  for (const d of devices) {
    const p = normalizePlatform(d.operatingSystem);
    if (!map.has(p)) map.set(p, []);
    map.get(p)!.push(d);
  }
  const groups: PivotGroup[] = [];
  for (const [key, ds] of map.entries()) {
    groups.push({ key, label: key, devices: ds });
  }
  return sortGroupsByCountDesc(groups);
}

export function groupByUser(devices: ManagedDevice[]): PivotGroup[] {
  const map = new Map<string, { label: string; devices: ManagedDevice[] }>();
  for (const d of devices) {
    const upn = d.userPrincipalName;
    if (!upn) {
      const k = "__unassigned__";
      if (!map.has(k)) map.set(k, { label: "Shared / unassigned", devices: [] });
      map.get(k)!.devices.push(d);
    } else {
      if (!map.has(upn)) map.set(upn, { label: d.userDisplayName || upn, devices: [] });
      map.get(upn)!.devices.push(d);
    }
  }
  const groups: PivotGroup[] = [];
  for (const [key, v] of map.entries()) {
    groups.push({ key, label: v.label, devices: v.devices });
  }
  return sortGroupsByCountDesc(groups);
}

const REASON_LABELS: Record<ComplianceState, string> = {
  compliant: "Compliant",
  noncompliant: "Non-compliant",
  conflict: "Conflict",
  error: "Error",
  inGracePeriod: "In grace period",
  configManager: "Configuration Manager",
  unknown: "Unknown",
};

export function groupByReason(devices: ManagedDevice[]): PivotGroup[] {
  const stateMap = new Map<ComplianceState, ManagedDevice[]>();
  const stale: ManagedDevice[] = [];
  const graceExpiring: ManagedDevice[] = [];
  const STALE_DAYS = 30;
  const GRACE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  for (const d of devices) {
    const s: ComplianceState = d.complianceState ?? "unknown";
    if (!stateMap.has(s)) stateMap.set(s, []);
    stateMap.get(s)!.push(d);

    if (s !== "compliant" && isStale(d, STALE_DAYS)) {
      stale.push(d);
    }
    if (d.complianceGracePeriodExpirationDateTime) {
      const ms = new Date(d.complianceGracePeriodExpirationDateTime).getTime() - Date.now();
      if (ms > 0 && ms <= GRACE_WINDOW_MS) {
        graceExpiring.push(d);
      }
    }
  }

  const groups: PivotGroup[] = [];
  for (const [key, ds] of stateMap.entries()) {
    groups.push({ key, label: REASON_LABELS[key] ?? key, devices: ds });
  }
  if (stale.length) groups.push({ key: "stale-30d", label: "No check-in 30+ days", devices: stale });
  if (graceExpiring.length) groups.push({ key: "grace-period-expiring", label: "Grace period expiring (7d)", devices: graceExpiring });
  return sortGroupsByCountDesc(groups);
}
