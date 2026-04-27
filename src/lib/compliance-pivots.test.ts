import { describe, it, expect } from "vitest";
import { ManagedDevice } from "@/types/managedDevice";
import { groupByReason, groupByPlatform, groupByUser, normalizePlatform, isStale } from "./compliance-pivots";

const baseDevice: ManagedDevice = {
  id: "1",
  deviceName: "PC-001",
  userPrincipalName: "alice@contoso.com",
  userDisplayName: "Alice",
  operatingSystem: "Windows",
  osVersion: "10.0.19045",
  complianceState: "compliant",
  lastSyncDateTime: new Date().toISOString(),
};

const make = (over: Partial<ManagedDevice>): ManagedDevice => ({ ...baseDevice, id: Math.random().toString(), ...over });

describe("normalizePlatform", () => {
  it("maps OS strings to canonical labels", () => {
    expect(normalizePlatform("Windows")).toBe("Windows");
    expect(normalizePlatform("iOS")).toBe("iOS");
    expect(normalizePlatform("iPadOS")).toBe("iPadOS");
    expect(normalizePlatform("Android")).toBe("Android");
    expect(normalizePlatform("macOS")).toBe("macOS");
    expect(normalizePlatform("OSX")).toBe("macOS");
    expect(normalizePlatform("Linux")).toBe("Linux");
    expect(normalizePlatform("")).toBe("Other");
    expect(normalizePlatform("ChromeOS")).toBe("Other");
  });
});

describe("isStale", () => {
  it("returns true when lastSyncDateTime is older than threshold days", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStale({ lastSyncDateTime: old } as ManagedDevice, 30)).toBe(true);
  });
  it("returns false when within threshold", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStale({ lastSyncDateTime: recent } as ManagedDevice, 30)).toBe(false);
  });
});

describe("groupByPlatform", () => {
  it("groups devices by normalized platform", () => {
    const devices = [
      make({ operatingSystem: "Windows" }),
      make({ operatingSystem: "Windows" }),
      make({ operatingSystem: "iOS" }),
      make({ operatingSystem: "OSX" }),
    ];
    const groups = groupByPlatform(devices);
    expect(groups.find(g => g.key === "Windows")?.devices.length).toBe(2);
    expect(groups.find(g => g.key === "iOS")?.devices.length).toBe(1);
    expect(groups.find(g => g.key === "macOS")?.devices.length).toBe(1);
  });
  it("sorts groups by count descending", () => {
    const devices = [
      make({ operatingSystem: "iOS" }),
      make({ operatingSystem: "Windows" }),
      make({ operatingSystem: "Windows" }),
    ];
    const groups = groupByPlatform(devices);
    expect(groups[0].key).toBe("Windows");
  });
});

describe("groupByUser", () => {
  it("groups devices by userPrincipalName", () => {
    const devices = [
      make({ userPrincipalName: "alice@contoso.com" }),
      make({ userPrincipalName: "bob@contoso.com" }),
      make({ userPrincipalName: "alice@contoso.com" }),
    ];
    const groups = groupByUser(devices);
    expect(groups.find(g => g.key === "alice@contoso.com")?.devices.length).toBe(2);
    expect(groups.find(g => g.key === "bob@contoso.com")?.devices.length).toBe(1);
  });
  it("buckets devices with no upn into 'Shared / unassigned'", () => {
    const devices = [
      make({ userPrincipalName: "" }),
      make({ userPrincipalName: undefined as any }),
    ];
    const groups = groupByUser(devices);
    expect(groups.find(g => g.key === "__unassigned__")?.devices.length).toBe(2);
    expect(groups.find(g => g.key === "__unassigned__")?.label).toBe("Shared / unassigned");
  });
});

describe("groupByReason", () => {
  it("groups by complianceState", () => {
    const devices = [
      make({ complianceState: "compliant" }),
      make({ complianceState: "noncompliant" }),
      make({ complianceState: "noncompliant" }),
      make({ complianceState: "error" }),
    ];
    const groups = groupByReason(devices);
    expect(groups.find(g => g.key === "noncompliant")?.devices.length).toBe(2);
    expect(groups.find(g => g.key === "compliant")?.devices.length).toBe(1);
    expect(groups.find(g => g.key === "error")?.devices.length).toBe(1);
  });
  it("adds synthesized 'stale-30d' group for non-compliant + stale devices", () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const devices = [
      make({ complianceState: "noncompliant", lastSyncDateTime: old }),
      make({ complianceState: "compliant", lastSyncDateTime: old }), // compliant + stale: not added
    ];
    const groups = groupByReason(devices);
    expect(groups.find(g => g.key === "stale-30d")?.devices.length).toBe(1);
  });
  it("adds 'grace-period-expiring' group for devices within 7 days of grace expiration", () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const devices = [
      make({ complianceState: "inGracePeriod", complianceGracePeriodExpirationDateTime: soon }),
      make({ complianceState: "inGracePeriod", complianceGracePeriodExpirationDateTime: far }),
    ];
    const groups = groupByReason(devices);
    expect(groups.find(g => g.key === "grace-period-expiring")?.devices.length).toBe(1);
  });
});
