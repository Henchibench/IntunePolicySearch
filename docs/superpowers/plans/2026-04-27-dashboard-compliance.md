# Dashboard — Compliance (Sub-project 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/dashboard` overview with KPI tiles and a `/dashboard/compliance` drill-down page that lets an admin pivot non-compliant devices by reason / platform / user, click into a device list, and on demand load deep per-device details.

**Architecture:** New `dashboardService` does one paginated `managedDevices` list call (cached 30 min). All compliance pivots are pure client-side derivations from that dataset. Per-device deep details are fetched on demand via `$batch`. Drill-down state lives in URL query params for deep-linkability. Domain-agnostic shell components (KpiTile, PivotTabs, GroupList, DeviceTable, DeviceDrawer) so future v2 domains plug in without rewriting routes.

**Tech Stack:** React 18 + TypeScript + Vite, React Router v6, MSAL, `@microsoft/microsoft-graph-client`, shadcn/ui + Tailwind, Recharts (already installed). New deps: Vitest (+ jsdom, testing-library) for unit tests, `@tanstack/react-virtual` for the device table.

**Spec:** `docs/superpowers/specs/2026-04-27-dashboard-compliance-design.md`

---

## File Structure

**Create:**
- `src/types/managedDevice.ts` — `ManagedDevice`, `DeviceCompliancePolicyState`, `DetectedApp` interfaces
- `src/services/dashboardService.ts` — `DashboardService` class with `getManagedDevices()`, `getDeviceDeepDetails(id)`
- `src/services/graphBatch.ts` — shared `batchGet` helper extracted from `graphService.ts`
- `src/services/deviceCacheService.ts` — `DeviceCacheService` (parallel to `CacheService`, separate cache keys)
- `src/lib/compliance-pivots.ts` — pure functions for `groupByReason`, `groupByPlatform`, `groupByUser`
- `src/lib/compliance-pivots.test.ts` — unit tests
- `src/hooks/useManagedDevices.ts`
- `src/hooks/useDeviceDeepDetails.ts`
- `src/components/dashboard/KpiTile.tsx`
- `src/components/dashboard/PivotTabs.tsx`
- `src/components/dashboard/GroupList.tsx`
- `src/components/dashboard/DeviceTable.tsx`
- `src/components/dashboard/DeviceDrawer.tsx`
- `src/components/dashboard/DeviceDeepDetails.tsx`
- `src/pages/Dashboard.tsx` — `/dashboard` overview
- `src/pages/DashboardCompliance.tsx` — `/dashboard/compliance` drill-down
- `vitest.config.ts`
- `src/test-setup.ts`

**Modify:**
- `src/services/graphService.ts` — replace inline `batchGet` with import from `graphBatch.ts`
- `src/services/authConfig.ts` — add managedDevices endpoints
- `src/hooks/useAuth.ts` — instantiate `DashboardService` alongside `GraphService`
- `src/components/Header.tsx` — add Policies / Dashboard nav links
- `src/App.tsx` — add `/dashboard` and `/dashboard/compliance` routes
- `package.json` — new deps + `test` script
- `tsconfig.app.json` (or `tsconfig.json`) — include `src/test-setup.ts`

---

## Task 1: Install Vitest + testing-library + react-virtual

**Files:**
- Create: `vitest.config.ts`, `src/test-setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D vitest@^1 jsdom@^24 @testing-library/react@^14 @testing-library/jest-dom@^6 @testing-library/user-event@^14
npm install @tanstack/react-virtual@^3
```

Expected: packages added, no peer-dep errors.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
```

- [ ] **Step 3: Create `src/test-setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add `test` script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Verify Vitest runs (no tests yet, exits cleanly)**

Run: `npm run test:run`
Expected: "No test files found" — exit code 0 (or 1 with "No test files found, exiting with code 1" — both acceptable, just confirm Vitest itself starts without errors).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test-setup.ts
git commit -m "chore: add vitest + testing-library + react-virtual"
```

---

## Task 2: Add ManagedDevice types and Graph endpoints

**Files:**
- Create: `src/types/managedDevice.ts`
- Modify: `src/services/authConfig.ts`

- [ ] **Step 1: Create `src/types/managedDevice.ts`**

```ts
export type ComplianceState =
  | "unknown"
  | "compliant"
  | "noncompliant"
  | "conflict"
  | "error"
  | "inGracePeriod"
  | "configManager";

export interface ManagedDevice {
  id: string;
  deviceName: string;
  userPrincipalName: string;
  userDisplayName?: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: ComplianceState;
  lastSyncDateTime: string;
  enrolledDateTime?: string;
  managedDeviceOwnerType?: "unknown" | "company" | "personal";
  complianceGracePeriodExpirationDateTime?: string;
  deviceType?: string;
  manufacturer?: string;
  model?: string;
}

export interface DeviceCompliancePolicyState {
  id: string;
  displayName: string;
  state: ComplianceState;
  settingStates?: Array<{
    setting: string;
    settingName?: string;
    state: "compliant" | "nonCompliant" | "notApplicable" | "remediated" | "error" | "conflict" | "notAssigned" | "unknown";
    errorDescription?: string;
  }>;
}

export interface DeviceConfigurationState {
  id: string;
  displayName: string;
  state: "compliant" | "nonCompliant" | "notApplicable" | "remediated" | "error" | "conflict" | "notAssigned" | "unknown";
  settingStates?: Array<{
    setting: string;
    settingName?: string;
    state: string;
    errorDescription?: string;
  }>;
}

export interface DetectedApp {
  id: string;
  displayName: string;
  version?: string;
  publisher?: string;
  platform?: string;
}

export interface DeviceDeepDetails {
  compliancePolicyStates: DeviceCompliancePolicyState[];
  configurationStates: DeviceConfigurationState[];
  detectedApps: DetectedApp[];
}
```

- [ ] **Step 2: Add endpoints to `src/services/authConfig.ts`**

In the `graphConfig` object, append (after `graphDeviceEnrollmentConfigurationsEndpoint`):
```ts
  // Managed devices (Dashboard sub-project 1)
  graphManagedDevicesEndpoint: "https://graph.microsoft.com/beta/deviceManagement/managedDevices",
```

- [ ] **Step 3: Commit**

```bash
git add src/types/managedDevice.ts src/services/authConfig.ts
git commit -m "feat(dashboard): add ManagedDevice types and managedDevices endpoint"
```

---

## Task 3: Extract `batchGet` into a shared helper

**Files:**
- Create: `src/services/graphBatch.ts`
- Modify: `src/services/graphService.ts`

- [ ] **Step 1: Create `src/services/graphBatch.ts`**

```ts
import { Client } from "@microsoft/microsoft-graph-client";

export interface BatchSubRequest {
  id: string;
  relativeUrl: string;
}

export interface BatchSubResponse {
  status: number;
  body: any;
}

/**
 * Send GET requests via Microsoft Graph $batch (max 20 per call).
 * Handles 429/503 with Retry-After per sub-response. SDK auto-retry does NOT
 * apply to batched sub-requests, per Microsoft Learn throttling guidance.
 */
export async function batchGet(
  client: Client,
  requests: BatchSubRequest[],
  version: "beta" | "v1.0" = "beta"
): Promise<Map<string, BatchSubResponse>> {
  const results = new Map<string, BatchSubResponse>();
  const CHUNK_SIZE = 20;
  const MAX_RETRIES = 3;
  const batchEndpoint = `https://graph.microsoft.com/${version}/$batch`;

  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    let pending = requests.slice(i, i + CHUNK_SIZE);

    for (let attempt = 0; attempt <= MAX_RETRIES && pending.length > 0; attempt++) {
      const batchBody = {
        requests: pending.map(r => ({ id: r.id, method: "GET", url: r.relativeUrl })),
      };

      let batchResponse: any;
      try {
        batchResponse = await client.api(batchEndpoint).post(batchBody);
      } catch (err) {
        console.warn("Batch request failed entirely:", err);
        for (const r of pending) {
          if (!results.has(r.id)) results.set(r.id, { status: 0, body: null });
        }
        pending = [];
        break;
      }

      const responses: any[] = batchResponse?.responses || [];
      const retry: typeof pending = [];
      let waitSeconds = 0;

      for (const resp of responses) {
        const orig = pending.find(r => r.id === resp.id);
        if (!orig) continue;
        if (resp.status === 429 || resp.status === 503) {
          const retryAfter = resp.headers?.["Retry-After"] ?? resp.headers?.["retry-after"];
          const ra = parseInt(retryAfter ?? "5", 10);
          waitSeconds = Math.max(waitSeconds, isNaN(ra) ? 5 : ra);
          retry.push(orig);
        } else {
          results.set(resp.id, { status: resp.status, body: resp.body });
        }
      }

      pending = retry;
      if (pending.length > 0 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.max(waitSeconds, 1) * 1000));
      }
    }

    for (const r of pending) {
      if (!results.has(r.id)) results.set(r.id, { status: 429, body: null });
    }
  }

  return results;
}
```

- [ ] **Step 2: Replace inline `batchGet` in `graphService.ts`**

Delete the entire `private async batchGet(...)` method (the one added in the previous session).

Add at top of file:
```ts
import { batchGet } from "./graphBatch";
```

Replace the two existing call sites `await this.batchGet(...)` with:
```ts
await batchGet(this.graphClient, batchRequests);
```

(There are two call sites: in `getDeviceConfigurations()` and `getConfigurationPolicies()`.)

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/graphBatch.ts src/services/graphService.ts
git commit -m "refactor: extract batchGet to shared graphBatch helper"
```

---

## Task 4: Compliance pivots library (TDD)

**Files:**
- Create: `src/lib/compliance-pivots.ts`
- Test: `src/lib/compliance-pivots.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/compliance-pivots.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm run test:run -- compliance-pivots`
Expected: tests fail because `compliance-pivots.ts` doesn't exist.

- [ ] **Step 3: Implement `src/lib/compliance-pivots.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm run test:run -- compliance-pivots`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compliance-pivots.ts src/lib/compliance-pivots.test.ts
git commit -m "feat(dashboard): compliance pivot functions with unit tests"
```

---

## Task 5: DashboardService — getManagedDevices

**Files:**
- Create: `src/services/dashboardService.ts`

- [ ] **Step 1: Create `src/services/dashboardService.ts`**

```ts
import { Client } from "@microsoft/microsoft-graph-client";
import { AuthenticationProvider } from "@microsoft/microsoft-graph-client";
import { ManagedDevice, DeviceDeepDetails } from "@/types/managedDevice";
import { graphConfig } from "./authConfig";
import { batchGet } from "./graphBatch";

interface ListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

const DEVICE_SELECT_FIELDS = [
  "id",
  "deviceName",
  "userPrincipalName",
  "userDisplayName",
  "operatingSystem",
  "osVersion",
  "complianceState",
  "lastSyncDateTime",
  "enrolledDateTime",
  "managedDeviceOwnerType",
  "complianceGracePeriodExpirationDateTime",
  "deviceType",
  "manufacturer",
  "model",
].join(",");

export class DashboardService {
  private client: Client;

  constructor(authProvider: AuthenticationProvider) {
    this.client = Client.initWithMiddleware({ authProvider });
  }

  async getManagedDevices(): Promise<ManagedDevice[]> {
    const all: ManagedDevice[] = [];
    let nextLink: string | undefined =
      `${graphConfig.graphManagedDevicesEndpoint}?$select=${DEVICE_SELECT_FIELDS}`;

    while (nextLink) {
      const response: ListResponse<ManagedDevice> = await this.client.api(nextLink).get();
      all.push(...response.value);
      nextLink = response["@odata.nextLink"];
    }

    console.log(`Fetched ${all.length} managed devices`);
    return all;
  }

  async getDeviceDeepDetails(deviceId: string): Promise<DeviceDeepDetails> {
    const requests = [
      { id: "compliance", relativeUrl: `/deviceManagement/managedDevices/${deviceId}/deviceCompliancePolicyStates` },
      { id: "configuration", relativeUrl: `/deviceManagement/managedDevices/${deviceId}/deviceConfigurationStates` },
      { id: "apps", relativeUrl: `/deviceManagement/managedDevices/${deviceId}/detectedApps` },
    ];

    const responses = await batchGet(this.client, requests);

    const compliance = responses.get("compliance");
    const configuration = responses.get("configuration");
    const apps = responses.get("apps");

    return {
      compliancePolicyStates: compliance?.status === 200 ? compliance.body?.value ?? [] : [],
      configurationStates: configuration?.status === 200 ? configuration.body?.value ?? [] : [],
      detectedApps: apps?.status === 200 ? apps.body?.value ?? [] : [],
    };
  }
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/services/dashboardService.ts
git commit -m "feat(dashboard): DashboardService with managedDevices + deep details"
```

---

## Task 6: Device cache service

**Files:**
- Create: `src/services/deviceCacheService.ts`

- [ ] **Step 1: Create `src/services/deviceCacheService.ts`**

```ts
import { ManagedDevice } from "@/types/managedDevice";

const CACHE_KEY = "intune-devices-cache";
const CACHE_DURATION_MS = 30 * 60 * 1000;

interface CachePayload {
  devices: ManagedDevice[];
  timestamp: number;
}

export class DeviceCacheService {
  static save(devices: ManagedDevice[]): void {
    try {
      const payload: CachePayload = { devices, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to cache devices:", err);
    }
  }

  static load(): ManagedDevice[] | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { devices, timestamp } = JSON.parse(raw) as CachePayload;
      if (Date.now() - timestamp > CACHE_DURATION_MS) {
        this.clear();
        return null;
      }
      return devices;
    } catch {
      this.clear();
      return null;
    }
  }

  static isValid(): boolean {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const { timestamp } = JSON.parse(raw) as CachePayload;
      return Date.now() - timestamp <= CACHE_DURATION_MS;
    } catch {
      return false;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* noop */
    }
  }

  static getInfo(): { exists: boolean; ageMinutes: number; count: number } | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { devices, timestamp } = JSON.parse(raw) as CachePayload;
      return {
        exists: true,
        ageMinutes: Math.round((Date.now() - timestamp) / 60000),
        count: devices.length,
      };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/deviceCacheService.ts
git commit -m "feat(dashboard): DeviceCacheService with 30-min localStorage TTL"
```

---

## Task 7: Wire DashboardService into useAuth

**Files:**
- Modify: `src/hooks/useAuth.ts`

- [ ] **Step 1: Read current `useAuth.ts` to confirm structure**

(For reference — the file initializes `GraphService` after a successful silent token call. We mirror that for `DashboardService`.)

- [ ] **Step 2: Modify `src/hooks/useAuth.ts`**

Add import at top:
```ts
import { DashboardService } from "@/services/dashboardService";
```

Extend `AuthState`:
```ts
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GraphUser | null;
  error: string | null;
  graphService: GraphService | null;
  dashboardService: DashboardService | null;
}
```

In the initial `useState<AuthState>` default add `dashboardService: null`.

In `initializeGraphService` (or wherever the `GraphService` is constructed), after `const graphService = new GraphService(authProvider);` add:
```ts
const dashboardService = new DashboardService(authProvider);
```

And include it in the `setAuthState({ ... })` call(s):
```ts
setAuthState(prev => ({
  ...prev,
  isAuthenticated: true,
  user: currentUser,
  graphService,
  dashboardService,
  isLoading: false,
  error: null,
}));
```

In any sign-out / reset paths that null out `graphService`, also null out `dashboardService`.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat(dashboard): instantiate DashboardService alongside GraphService"
```

---

## Task 8: useManagedDevices hook

**Files:**
- Create: `src/hooks/useManagedDevices.ts`

- [ ] **Step 1: Create `src/hooks/useManagedDevices.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { ManagedDevice } from "@/types/managedDevice";
import { DashboardService } from "@/services/dashboardService";
import { DeviceCacheService } from "@/services/deviceCacheService";

interface UseManagedDevicesResult {
  devices: ManagedDevice[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  cacheAgeMinutes: number | null;
}

export function useManagedDevices(service: DashboardService | null): UseManagedDevicesResult {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);

  const fetchFromGraph = useCallback(async () => {
    if (!service) return;
    setIsLoading(true);
    setError(null);
    try {
      const fresh = await service.getManagedDevices();
      setDevices(fresh);
      DeviceCacheService.save(fresh);
      setCacheAgeMinutes(0);
    } catch (err) {
      console.error("Failed to load managed devices:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  // Initial load: prefer cache; fall back to Graph
  useEffect(() => {
    if (!service) return;
    const cached = DeviceCacheService.load();
    if (cached) {
      setDevices(cached);
      const info = DeviceCacheService.getInfo();
      setCacheAgeMinutes(info?.ageMinutes ?? null);
      return;
    }
    fetchFromGraph();
  }, [service, fetchFromGraph]);

  const refresh = useCallback(async () => {
    DeviceCacheService.clear();
    await fetchFromGraph();
  }, [fetchFromGraph]);

  return { devices, isLoading, error, refresh, cacheAgeMinutes };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useManagedDevices.ts
git commit -m "feat(dashboard): useManagedDevices hook with localStorage cache"
```

---

## Task 9: useDeviceDeepDetails hook

**Files:**
- Create: `src/hooks/useDeviceDeepDetails.ts`

- [ ] **Step 1: Create `src/hooks/useDeviceDeepDetails.ts`**

```ts
import { useCallback, useState } from "react";
import { DashboardService } from "@/services/dashboardService";
import { DeviceDeepDetails } from "@/types/managedDevice";

interface UseDeviceDeepDetailsResult {
  details: DeviceDeepDetails | null;
  isLoading: boolean;
  error: string | null;
  load: (deviceId: string) => Promise<void>;
  reset: () => void;
}

export function useDeviceDeepDetails(service: DashboardService | null): UseDeviceDeepDetailsResult {
  const [details, setDetails] = useState<DeviceDeepDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (deviceId: string) => {
      if (!service) {
        setError("Not authenticated");
        return;
      }
      setIsLoading(true);
      setError(null);
      setDetails(null);
      try {
        const data = await service.getDeviceDeepDetails(deviceId);
        setDetails(data);
      } catch (err) {
        console.error("Failed to load deep details:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  const reset = useCallback(() => {
    setDetails(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { details, isLoading, error, load, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDeviceDeepDetails.ts
git commit -m "feat(dashboard): useDeviceDeepDetails on-demand fetch hook"
```

---

## Task 10: KpiTile component

**Files:**
- Create: `src/components/dashboard/KpiTile.tsx`

- [ ] **Step 1: Create `src/components/dashboard/KpiTile.tsx`**

```tsx
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  subStat?: ReactNode;
  to?: string;
  disabled?: boolean;
  tone?: "default" | "warning" | "danger";
}

export function KpiTile({ label, value, subStat, to, disabled, tone = "default" }: KpiTileProps) {
  const navigate = useNavigate();

  const onClick = () => {
    if (disabled || !to) return;
    navigate(to);
  };

  const toneClass =
    tone === "danger" ? "text-red-500" : tone === "warning" ? "text-amber-500" : "text-foreground";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 transition-shadow",
        disabled ? "opacity-50 cursor-not-allowed" : to ? "cursor-pointer hover:shadow-md" : ""
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-semibold mt-1", toneClass)}>{value}</div>
      {subStat && <div className="text-xs text-muted-foreground mt-1">{subStat}</div>}
      {disabled && <div className="text-xs text-muted-foreground mt-2 italic">Coming in v2</div>}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/KpiTile.tsx
git commit -m "feat(dashboard): KpiTile component"
```

---

## Task 11: Dashboard overview page + route + Header link

**Files:**
- Create: `src/pages/Dashboard.tsx`
- Modify: `src/App.tsx`, `src/components/Header.tsx`

- [ ] **Step 1: Create `src/pages/Dashboard.tsx`**

```tsx
import { useMemo } from "react";
import { Header } from "@/components/Header";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { useAuth } from "@/hooks/useAuth";
import { useManagedDevices } from "@/hooks/useManagedDevices";

export default function Dashboard() {
  const { isAuthenticated, dashboardService } = useAuth();
  const { devices, isLoading, error, refresh, cacheAgeMinutes } = useManagedDevices(dashboardService);

  const stats = useMemo(() => {
    const total = devices.length;
    const compliant = devices.filter(d => d.complianceState === "compliant").length;
    const failing = total - compliant;
    const pct = total ? Math.round((compliant / total) * 100) : 0;
    return { total, compliant, failing, pct };
  }, [devices]);

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-6">
          <p className="text-muted-foreground">Sign in to view the dashboard.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header onRefresh={refresh} isRefreshing={isLoading} />
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        {error && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            Failed to load devices: {error}
          </div>
        )}
        {cacheAgeMinutes !== null && (
          <div className="text-xs text-muted-foreground">
            Showing data from {cacheAgeMinutes} minute(s) ago. Click Refresh for live data.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiTile
            label="Compliance"
            value={`${stats.pct}%`}
            subStat={`${stats.failing} failing of ${stats.total}`}
            to="/dashboard/compliance"
            tone={stats.failing > 0 ? "danger" : "default"}
          />
          <KpiTile label="Apps" value="—" disabled />
          <KpiTile label="OS & Patch" value="—" disabled />
          <KpiTile label="Enrollment" value="—" disabled />
          <KpiTile label="Users" value="—" disabled />
          <KpiTile label="Assignment Health" value="—" disabled />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Add the `/dashboard` route in `src/App.tsx`**

Add import (only `Dashboard` for now; `DashboardCompliance` is added in Task 17):
```tsx
import Dashboard from "./pages/Dashboard";
```

Add the route above the catch-all:
```tsx
<Route path="/dashboard" element={<Dashboard />} />
```

- [ ] **Step 3: Add nav links in `src/components/Header.tsx`**

Replace the title block (line 27-32) with a title + nav:
```tsx
<div className="flex items-center gap-6">
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold text-foreground">
      Intune Policy Search
    </h1>
    <p className="text-sm text-muted-foreground">
      Workplace Ninja Summit 2025
    </p>
  </div>
  <nav className="flex items-center gap-1">
    <NavLink
      to="/"
      end
      className={({ isActive }) =>
        cn(
          "px-3 py-1.5 rounded text-sm",
          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      Policies
    </NavLink>
    <NavLink
      to="/dashboard"
      className={({ isActive }) =>
        cn(
          "px-3 py-1.5 rounded text-sm",
          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      Dashboard
    </NavLink>
  </nav>
</div>
```

Add at top of file:
```tsx
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
```

- [ ] **Step 4: Run build and dev**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run dev -- --host 0.0.0.0`
Manually verify: navigate to `/dashboard`, KPI tiles render, only "Compliance" is clickable, `cacheAgeMinutes` line shows after first load. Sign in if needed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/App.tsx src/components/Header.tsx
git commit -m "feat(dashboard): /dashboard overview with KPI tiles + nav"
```

---

## Task 12: PivotTabs component

**Files:**
- Create: `src/components/dashboard/PivotTabs.tsx`

- [ ] **Step 1: Create `src/components/dashboard/PivotTabs.tsx`**

```tsx
import { cn } from "@/lib/utils";

export type PivotKey = "reason" | "platform" | "user";

interface PivotTabsProps {
  value: PivotKey;
  onChange: (next: PivotKey) => void;
}

const TABS: Array<{ key: PivotKey; label: string }> = [
  { key: "reason", label: "By Reason" },
  { key: "platform", label: "By Platform" },
  { key: "user", label: "By User" },
];

export function PivotTabs({ value, onChange }: PivotTabsProps) {
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {TABS.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm transition-colors",
            value === t.key
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PivotTabs.tsx
git commit -m "feat(dashboard): PivotTabs segmented control"
```

---

## Task 13: GroupList component

**Files:**
- Create: `src/components/dashboard/GroupList.tsx`

- [ ] **Step 1: Create `src/components/dashboard/GroupList.tsx`**

```tsx
import { PivotGroup } from "@/lib/compliance-pivots";
import { cn } from "@/lib/utils";

interface GroupListProps {
  groups: PivotGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  total: number;
}

export function GroupList({ groups, selectedKey, onSelect, total }: GroupListProps) {
  return (
    <div className="rounded-md border bg-card divide-y">
      {groups.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">No devices match.</div>
      )}
      {groups.map(g => {
        const pct = total ? Math.round((g.devices.length / total) * 100) : 0;
        const selected = selectedKey === g.key;
        return (
          <button
            key={g.key}
            onClick={() => onSelect(g.key)}
            className={cn(
              "w-full text-left p-3 hover:bg-accent/50 transition-colors flex items-center justify-between gap-3",
              selected && "bg-accent"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{g.label}</div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-sm tabular-nums">
              <span className="font-semibold">{g.devices.length}</span>
              <span className="text-muted-foreground"> ({pct}%)</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/GroupList.tsx
git commit -m "feat(dashboard): GroupList component"
```

---

## Task 14: DeviceTable component (virtualized)

**Files:**
- Create: `src/components/dashboard/DeviceTable.tsx`

- [ ] **Step 1: Create `src/components/dashboard/DeviceTable.tsx`**

```tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ManagedDevice } from "@/types/managedDevice";
import { cn } from "@/lib/utils";

interface DeviceTableProps {
  devices: ManagedDevice[];
  selectedDeviceId: string | null;
  onSelect: (id: string) => void;
}

const ROW_HEIGHT = 44;

export function DeviceTable({ devices, selectedDeviceId, onSelect }: DeviceTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: devices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
        <div>Device</div>
        <div>User</div>
        <div>Platform</div>
        <div>Compliance</div>
        <div>Last sync</div>
      </div>
      <div ref={parentRef} className="h-[480px] overflow-auto">
        {devices.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No devices in this group.</div>
        ) : (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const device = devices[virtualRow.index];
              const selected = device.id === selectedDeviceId;
              return (
                <button
                  key={device.id}
                  onClick={() => onSelect(device.id)}
                  className={cn(
                    "absolute left-0 right-0 grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-2 px-3 items-center text-sm hover:bg-accent/50 text-left",
                    selected && "bg-accent"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="truncate">{device.deviceName}</div>
                  <div className="truncate text-muted-foreground">{device.userDisplayName || device.userPrincipalName || "—"}</div>
                  <div className="truncate">{device.operatingSystem} {device.osVersion}</div>
                  <div className={cn(
                    "truncate",
                    device.complianceState === "compliant" ? "text-emerald-600" :
                    device.complianceState === "noncompliant" ? "text-red-600" :
                    "text-amber-600"
                  )}>
                    {device.complianceState}
                  </div>
                  <div className="truncate text-muted-foreground">
                    {device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString() : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground border-t">{devices.length} device(s)</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/DeviceTable.tsx
git commit -m "feat(dashboard): virtualized DeviceTable"
```

---

## Task 15: DeviceDeepDetails component (C-level)

**Files:**
- Create: `src/components/dashboard/DeviceDeepDetails.tsx`

- [ ] **Step 1: Create `src/components/dashboard/DeviceDeepDetails.tsx`**

```tsx
import { DeviceDeepDetails as DeepDetails } from "@/types/managedDevice";

interface DeviceDeepDetailsProps {
  details: DeepDetails;
}

export function DeviceDeepDetails({ details }: DeviceDeepDetailsProps) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h4 className="font-semibold mb-2">Compliance policies ({details.compliancePolicyStates.length})</h4>
        <div className="space-y-1">
          {details.compliancePolicyStates.length === 0 && (
            <div className="text-muted-foreground">None</div>
          )}
          {details.compliancePolicyStates.map(p => (
            <div key={p.id} className="rounded border p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{p.displayName}</div>
                <div className="text-xs">{p.state}</div>
              </div>
              {p.settingStates && p.settingStates.length > 0 && (
                <ul className="mt-1 ml-3 list-disc text-xs text-muted-foreground space-y-0.5">
                  {p.settingStates
                    .filter(s => s.state !== "compliant" && s.state !== "notApplicable")
                    .map((s, i) => (
                      <li key={`${p.id}-s${i}`}>
                        <span className="font-medium">{s.settingName || s.setting}</span>
                        {": "}{s.state}
                        {s.errorDescription ? ` — ${s.errorDescription}` : ""}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="font-semibold mb-2">Configuration profiles ({details.configurationStates.length})</h4>
        <div className="space-y-1">
          {details.configurationStates.length === 0 && (
            <div className="text-muted-foreground">None</div>
          )}
          {details.configurationStates.map(c => (
            <div key={c.id} className="rounded border p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{c.displayName}</div>
                <div className="text-xs">{c.state}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="font-semibold mb-2">Detected apps ({details.detectedApps.length})</h4>
        {details.detectedApps.length === 0 ? (
          <div className="text-muted-foreground">None</div>
        ) : (
          <div className="max-h-64 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Version</th>
                  <th className="text-left p-2">Publisher</th>
                </tr>
              </thead>
              <tbody>
                {details.detectedApps.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2 truncate max-w-[200px]">{a.displayName}</td>
                    <td className="p-2 text-muted-foreground">{a.version || "—"}</td>
                    <td className="p-2 text-muted-foreground truncate max-w-[150px]">{a.publisher || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/DeviceDeepDetails.tsx
git commit -m "feat(dashboard): DeviceDeepDetails (C-level) component"
```

---

## Task 16: DeviceDrawer component

**Files:**
- Create: `src/components/dashboard/DeviceDrawer.tsx`

- [ ] **Step 1: Create `src/components/dashboard/DeviceDrawer.tsx`**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { ManagedDevice } from "@/types/managedDevice";
import { useDeviceDeepDetails } from "@/hooks/useDeviceDeepDetails";
import { DeviceDeepDetails } from "./DeviceDeepDetails";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface DeviceDrawerProps {
  device: ManagedDevice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const intunePortalUrl = (id: string) =>
  `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${id}`;

export function DeviceDrawer({ device, open, onOpenChange }: DeviceDrawerProps) {
  const { dashboardService } = useAuth();
  const { details, isLoading, error, load, reset } = useDeviceDeepDetails(dashboardService);

  // Reset deep details whenever the drawer is closed or the selected device changes.
  useEffect(() => {
    reset();
  }, [device?.id, reset]);

  if (!device) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{device.deviceName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
            <dt className="text-muted-foreground">User</dt>
            <dd className="col-span-2">{device.userDisplayName || device.userPrincipalName || "—"}</dd>

            <dt className="text-muted-foreground">Platform</dt>
            <dd className="col-span-2">{device.operatingSystem} {device.osVersion}</dd>

            <dt className="text-muted-foreground">Compliance</dt>
            <dd className="col-span-2">{device.complianceState}</dd>

            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="col-span-2">{device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString() : "—"}</dd>

            <dt className="text-muted-foreground">Enrolled</dt>
            <dd className="col-span-2">{device.enrolledDateTime ? new Date(device.enrolledDateTime).toLocaleString() : "—"}</dd>

            <dt className="text-muted-foreground">Owner type</dt>
            <dd className="col-span-2">{device.managedDeviceOwnerType || "—"}</dd>

            <dt className="text-muted-foreground">Manufacturer</dt>
            <dd className="col-span-2">{device.manufacturer || "—"}</dd>

            <dt className="text-muted-foreground">Model</dt>
            <dd className="col-span-2">{device.model || "—"}</dd>
          </dl>

          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={intunePortalUrl(device.id)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open in Intune
            </a>
          </Button>

          <hr />

          {!details && !isLoading && !error && (
            <Button onClick={() => load(device.id)} size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Load deep details
            </Button>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading deep details…
            </div>
          )}

          {error && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm">
              Failed to load: {error}
              <Button onClick={() => load(device.id)} variant="link" size="sm" className="ml-2">
                Retry
              </Button>
            </div>
          )}

          {details && <DeviceDeepDetails details={details} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify the shadcn `sheet` component exists**

Run: `ls src/components/ui/sheet.tsx`
Expected: file exists. If not, run `npx shadcn@latest add sheet` (or copy from shadcn docs) and commit it as part of this task.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DeviceDrawer.tsx
git commit -m "feat(dashboard): DeviceDrawer with on-demand deep details"
```

---

## Task 17: DashboardCompliance page (URL-driven state)

**Files:**
- Create: `src/pages/DashboardCompliance.tsx`
- Modify: `src/App.tsx` (add the `/dashboard/compliance` route)

- [ ] **Step 1: Create `src/pages/DashboardCompliance.tsx`**

```tsx
import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useManagedDevices } from "@/hooks/useManagedDevices";
import { groupByPlatform, groupByReason, groupByUser, PivotGroup } from "@/lib/compliance-pivots";
import { PivotTabs, PivotKey } from "@/components/dashboard/PivotTabs";
import { GroupList } from "@/components/dashboard/GroupList";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { DeviceDrawer } from "@/components/dashboard/DeviceDrawer";
import { ChevronLeft } from "lucide-react";

const VALID_PIVOTS: PivotKey[] = ["reason", "platform", "user"];

function pivotFromParam(p: string | null): PivotKey {
  return (VALID_PIVOTS as string[]).includes(p ?? "") ? (p as PivotKey) : "reason";
}

export default function DashboardCompliance() {
  const { isAuthenticated, dashboardService } = useAuth();
  const { devices, isLoading, error, refresh, cacheAgeMinutes } = useManagedDevices(dashboardService);

  const [searchParams, setSearchParams] = useSearchParams();
  const pivot = pivotFromParam(searchParams.get("pivot"));
  const groupKey = searchParams.get("group");
  const deviceId = searchParams.get("device");

  const groups: PivotGroup[] = useMemo(() => {
    if (pivot === "platform") return groupByPlatform(devices);
    if (pivot === "user") return groupByUser(devices);
    return groupByReason(devices);
  }, [devices, pivot]);

  const selectedGroup = useMemo(
    () => (groupKey ? groups.find(g => g.key === groupKey) ?? null : null),
    [groups, groupKey]
  );

  const selectedDevice = useMemo(
    () => (deviceId ? devices.find(d => d.id === deviceId) ?? null : null),
    [devices, deviceId]
  );

  const setPivot = (next: PivotKey) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("pivot", next);
      sp.delete("group");
      sp.delete("device");
      return sp;
    });
  };

  const setGroup = (key: string) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("group", key);
      sp.delete("device");
      return sp;
    });
  };

  const setDevice = (id: string | null) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      if (id) sp.set("device", id);
      else sp.delete("device");
      return sp;
    });
  };

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-6">
          <p className="text-muted-foreground">Sign in to view the dashboard.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header onRefresh={refresh} isRefreshing={isLoading} />
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <h2 className="text-xl font-semibold">Compliance</h2>

        {error && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm">
            Failed to load devices: {error}
          </div>
        )}
        {cacheAgeMinutes !== null && (
          <div className="text-xs text-muted-foreground">
            Showing data from {cacheAgeMinutes} minute(s) ago.
          </div>
        )}

        <PivotTabs value={pivot} onChange={setPivot} />

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <GroupList groups={groups} selectedKey={groupKey} onSelect={setGroup} total={devices.length} />
          <div>
            {selectedGroup ? (
              <DeviceTable
                devices={selectedGroup.devices}
                selectedDeviceId={deviceId}
                onSelect={id => setDevice(id)}
              />
            ) : (
              <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                Select a group to see its devices.
              </div>
            )}
          </div>
        </div>
      </main>

      <DeviceDrawer
        device={selectedDevice}
        open={!!selectedDevice}
        onOpenChange={open => { if (!open) setDevice(null); }}
      />
    </>
  );
}
```

- [ ] **Step 2: Add the route in `src/App.tsx`**

Add (above the catch-all):
```tsx
<Route path="/dashboard/compliance" element={<DashboardCompliance />} />
```

Add the import at top:
```tsx
import DashboardCompliance from "./pages/DashboardCompliance";
```

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run dev -- --host 0.0.0.0`

Manual checks:
1. Navigate to `/dashboard`. Click the Compliance tile.
2. URL is `/dashboard/compliance`. Default pivot is `reason`. GroupList shows compliance reasons.
3. Click "By Platform". URL gets `?pivot=platform`. Groups change.
4. Click a group. URL adds `&group=...`. Device table appears.
5. Click a device. URL adds `&device=<id>`. Drawer opens with A-level summary.
6. Click "Load deep details". `$batch` request fires (visible in DevTools). Compliance policies / config / apps render.
7. Hit browser back: drawer closes. Back again: device unselected. Back again: pivot restored.
8. Refresh the page on a deep URL like `/dashboard/compliance?pivot=user&group=alice@contoso.com&device=<id>`: state is restored.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardCompliance.tsx src/App.tsx
git commit -m "feat(dashboard): /dashboard/compliance drill-down with URL state"
```

---

## Task 18: Refine reasons (optional opt-in pivot refinement)

This task is opt-in: skip if v1 should ship without it.

**Files:**
- Modify: `src/services/dashboardService.ts`, `src/pages/DashboardCompliance.tsx`

- [ ] **Step 1: Add `getNonCompliantPolicyStatesBulk` to `dashboardService.ts`**

Add method to `DashboardService`:
```ts
async getNonCompliantPolicyStatesBulk(
  deviceIds: string[]
): Promise<Map<string, Array<{ policyDisplayName: string; failingSettings: string[] }>>> {
  const requests = deviceIds.map((id, idx) => ({
    id: `r${idx}`,
    relativeUrl: `/deviceManagement/managedDevices/${id}/deviceCompliancePolicyStates`,
  }));

  const responses = await batchGet(this.client, requests);

  const out = new Map<string, Array<{ policyDisplayName: string; failingSettings: string[] }>>();
  deviceIds.forEach((deviceId, idx) => {
    const resp = responses.get(`r${idx}`);
    if (resp?.status !== 200) {
      out.set(deviceId, []);
      return;
    }
    const policies = (resp.body?.value ?? []) as Array<any>;
    const flat: Array<{ policyDisplayName: string; failingSettings: string[] }> = [];
    for (const p of policies) {
      if (p.state !== "compliant" && p.state !== "notApplicable") {
        const failing = (p.settingStates ?? [])
          .filter((s: any) => s.state !== "compliant" && s.state !== "notApplicable")
          .map((s: any) => s.settingName || s.setting);
        flat.push({ policyDisplayName: p.displayName, failingSettings: failing });
      }
    }
    out.set(deviceId, flat);
  });
  return out;
}
```

- [ ] **Step 2: Add a "Refine reasons" button + state to `DashboardCompliance.tsx`**

Above `<PivotTabs />` add a refinement panel that's only visible when `pivot === "reason"`:

```tsx
const [refinedGroups, setRefinedGroups] = useState<PivotGroup[] | null>(null);
const [isRefining, setIsRefining] = useState(false);

const refineReasons = async () => {
  if (!dashboardService) return;
  setIsRefining(true);
  try {
    const ids = devices
      .filter(d => d.complianceState !== "compliant" && d.complianceState !== "unknown")
      .map(d => d.id);
    const map = await dashboardService.getNonCompliantPolicyStatesBulk(ids);
    const settingMap = new Map<string, ManagedDevice[]>();
    for (const d of devices) {
      const entries = map.get(d.id) ?? [];
      for (const e of entries) {
        for (const s of e.failingSettings) {
          if (!settingMap.has(s)) settingMap.set(s, []);
          settingMap.get(s)!.push(d);
        }
      }
    }
    const groups: PivotGroup[] = [];
    for (const [key, ds] of settingMap.entries()) {
      groups.push({ key: `setting:${key}`, label: key, devices: ds });
    }
    groups.sort((a, b) => b.devices.length - a.devices.length);
    setRefinedGroups(groups);
  } finally {
    setIsRefining(false);
  }
};

const displayedGroups = pivot === "reason" && refinedGroups ? refinedGroups : groups;
```

(Add `import { ManagedDevice } from "@/types/managedDevice";` at top.)

Replace `<GroupList groups={groups} ... />` with `<GroupList groups={displayedGroups} ... />`.

Above the grid, when `pivot === "reason"`:

```tsx
{pivot === "reason" && (
  <div className="flex items-center gap-3">
    <Button onClick={refineReasons} disabled={isRefining || !devices.length} variant="outline" size="sm">
      {isRefining ? "Refining…" : refinedGroups ? "Refine again" : "Refine reasons (slow, opt-in)"}
    </Button>
    {refinedGroups && (
      <Button onClick={() => setRefinedGroups(null)} variant="ghost" size="sm">
        Clear refinement
      </Button>
    )}
  </div>
)}
```

(Import `Button` from `@/components/ui/button` and `useState` from `react`.)

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build`
Click "Refine reasons" — verify it groups by failing setting names.

- [ ] **Step 4: Commit**

```bash
git add src/services/dashboardService.ts src/pages/DashboardCompliance.tsx
git commit -m "feat(dashboard): opt-in 'refine reasons' bulk deep-fetch pivot"
```

---

## Final smoke checklist

After all tasks, manually verify against a real tenant:

- [ ] `/dashboard` overview loads in <2s on cache hit; <10s on cold cache.
- [ ] Compliance tile percentage and count match the Intune portal's Compliance overview.
- [ ] All three pivots produce sensible groupings, with totals matching the device count.
- [ ] Device list virtualizes (no jank scrolling 1000+ rows).
- [ ] Drawer's A-level summary populates from cached data (no extra Graph calls).
- [ ] "Load deep details" fires exactly one `$batch` POST per click; renders compliance / config / apps sections.
- [ ] Browser back / forward navigates the URL state correctly.
- [ ] Bookmarking a deep URL and re-opening restores the same view.
- [ ] No TypeScript or build warnings.

---

## Notes for implementer

- **Existing patterns:** caching mirrors `src/services/cacheService.ts`; service classes mirror `src/services/graphService.ts` (auth provider in constructor, Client created internally).
- **Auth scope:** `DeviceManagementManagedDevices.Read.All` is already requested in `loginRequest.scopes` (`src/services/authConfig.ts:24`). No scope change needed.
- **Refresh button:** the existing `Header` `onRefresh` prop is wired through both new pages; on `/dashboard*` it refreshes devices, on `/` it refreshes policies (existing behavior).
- **No code-splitting yet:** the build already warns about chunk size. Don't tackle code-splitting in this plan — it's a separate concern.
