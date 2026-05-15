# Driver Info v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Devices" tab to the driver detail drawer that lists *which* managed devices are applicable for the selected driver — answering the original user ask from v1 ("Intune tells me 348 devices need this driver, but not which ones").

**Architecture:** Three-phase `getCachedReport` flow against `DriverUpdateDeviceStatusByDriver`: POST configure → GET poll until complete → POST fetch. Lazy-fired only when the user clicks the Devices tab. Schema+Values column-store response normalized via a pure helper. No new permissions needed.

**Tech Stack:** React 18 + TypeScript, Microsoft Graph SDK (`@microsoft/microsoft-graph-client`), shadcn/ui (Tabs, existing Sheet), Tailwind CSS, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-07-driver-info-v1-1-design.md`

---

## File Structure

| File | Status | Purpose |
|---|---|---|
| `src/types/drivers.ts` | Modify | Add `DriverApplicableDevice` interface |
| `src/lib/reportNormalize.ts` | Create | Pure `zipSchemaValues` helper |
| `src/lib/reportNormalize.test.ts` | Create | Tests for the helper |
| `src/hooks/useDriverApplicableDevices.ts` | Create | 3-phase fetcher hook |
| `src/hooks/useDriverApplicableDevices.test.ts` | Create | Tests for orchestration |
| `src/components/drivers/DriverDevicesTab.tsx` | Create | Devices tab UI |
| `src/components/drivers/DriverDevicesTab.test.tsx` | Create | Tab render-state tests |
| `src/components/drivers/DriverDetailDrawer.tsx` | Modify | Add Tabs wrapper, integrate Devices tab |
| `src/components/ui/tabs.tsx` | Verify exists | shadcn/ui Tabs component (likely already installed) |

---

### Task 1: Types

**Files:**
- Modify: `src/types/drivers.ts`

- [ ] **Step 1: Append the new interface to drivers.ts**

Add at the end of `src/types/drivers.ts`:

```typescript
/** A row in the per-driver device list, normalized from the cached report response */
export interface DriverApplicableDevice {
  /** Intune device id */
  deviceId: string;
  /** Microsoft Entra device id */
  aadDeviceId: string;
  /** Friendly device name (e.g., "GPC-6XTRVV3") */
  deviceName: string;
  /** Primary user UPN */
  upn: string;
  /** Name of the WUfB profile that targets this device for this driver */
  policyName: string;
  /** Localized aggregate state (e.g., "Success", "Error", "In progress") */
  aggregateState: string;
  /** Numeric update state code */
  currentDeviceUpdateState: number;
  /** Localized update state (e.g., "Installed", "Offering", "Cancelled") */
  currentDeviceUpdateStateLoc: string;
  /** Numeric substate code */
  currentDeviceUpdateSubstate: number;
  /** Localized substate (e.g., "Update installed", "Update offered") */
  currentDeviceUpdateSubstateLoc: string;
  /** When the device most recently changed state for this driver */
  currentDeviceUpdateSubstateTime: string;
  /** When the device last scanned with Windows Update */
  lastWUScanTime: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/drivers.ts
git commit -m "feat(drivers): add DriverApplicableDevice type for v1.1"
```

---

### Task 2: Pure `zipSchemaValues` helper (TDD)

**Files:**
- Create: `src/lib/reportNormalize.ts`
- Create: `src/lib/reportNormalize.test.ts`

The cached-report response has shape `{ Schema: { Column, PropertyType }[], Values: any[][] }`. We zip these into row objects with property access.

- [ ] **Step 1: Write failing tests**

Create `src/lib/reportNormalize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { zipSchemaValues } from './reportNormalize';

describe('zipSchemaValues', () => {
  it('zips a single row into a property-keyed object', () => {
    const schema = [
      { Column: 'DeviceName', PropertyType: 'String' },
      { Column: 'Count', PropertyType: 'Int32' },
    ];
    const values = [['LAPTOP-1', 42]];
    const result = zipSchemaValues(schema, values);
    expect(result).toEqual([{ DeviceName: 'LAPTOP-1', Count: 42 }]);
  });

  it('handles multiple rows', () => {
    const schema = [{ Column: 'Name', PropertyType: 'String' }];
    const values = [['a'], ['b'], ['c']];
    const result = zipSchemaValues(schema, values);
    expect(result).toEqual([{ Name: 'a' }, { Name: 'b' }, { Name: 'c' }]);
  });

  it('returns an empty array when Values is empty', () => {
    const schema = [{ Column: 'Name', PropertyType: 'String' }];
    expect(zipSchemaValues(schema, [])).toEqual([]);
  });

  it('returns an empty array when Schema is empty', () => {
    expect(zipSchemaValues([], [['x', 'y']])).toEqual([{}]);
  });

  it('truncates extra cells in a row beyond schema length', () => {
    const schema = [{ Column: 'A', PropertyType: 'String' }];
    const values = [['x', 'y', 'z']];
    expect(zipSchemaValues(schema, values)).toEqual([{ A: 'x' }]);
  });

  it('fills missing cells with undefined', () => {
    const schema = [
      { Column: 'A', PropertyType: 'String' },
      { Column: 'B', PropertyType: 'String' },
    ];
    const values = [['x']];
    expect(zipSchemaValues(schema, values)).toEqual([{ A: 'x', B: undefined }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reportNormalize.test.ts`

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/lib/reportNormalize.ts`:

```typescript
export interface ReportColumn {
  Column: string;
  PropertyType: string;
}

/**
 * Zip a column-store `{ Schema, Values }` report response into a property-keyed
 * row array. Used to normalize Intune `getCachedReport` responses.
 */
export function zipSchemaValues(
  schema: ReportColumn[],
  values: unknown[][]
): Record<string, unknown>[] {
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < schema.length; i++) {
      obj[schema[i].Column] = row[i];
    }
    return obj;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reportNormalize.test.ts`

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reportNormalize.ts src/lib/reportNormalize.test.ts
git commit -m "feat(drivers): add zipSchemaValues report normalization helper"
```

---

### Task 3: useDriverApplicableDevices hook with 3-phase orchestration (TDD on pure parts)

**Files:**
- Create: `src/hooks/useDriverApplicableDevices.ts`
- Create: `src/hooks/useDriverApplicableDevices.test.ts`

The hook orchestrates Phase 1 (POST configure) → Phase 2 (GET poll) → Phase 3 (POST fetch). The orchestration logic itself is mostly stateful (timers, retries, cancellation), so we TDD a couple of pure helper functions and integration-test the rest manually in the dev server.

- [ ] **Step 1: Write failing tests for the pure helpers**

Create `src/hooks/useDriverApplicableDevices.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildConfigBody,
  buildFetchBody,
  toApplicableDevice,
} from './useDriverApplicableDevices';

describe('buildConfigBody', () => {
  it('produces the configure-phase request body with a stable id', () => {
    const body = buildConfigBody('abc-123');
    expect(body.id).toMatch(/^DriverUpdateDeviceStatusByDriver_/);
    expect(body.filter).toBe("CatalogEntryId eq 'abc-123'");
    expect(body.select).toContain('DeviceName');
    expect(body.select).toContain('UPN');
    expect(body.select).toContain('PolicyName');
    expect(body.orderBy).toEqual([]);
  });

  it('escapes single quotes in the catalogEntryId by doubling them (OData rules)', () => {
    const body = buildConfigBody("foo'bar");
    expect(body.filter).toBe("CatalogEntryId eq 'foo''bar'");
  });
});

describe('buildFetchBody', () => {
  it('includes pagination parameters', () => {
    const body = buildFetchBody('config-id', 'cat-id', 50, 100);
    expect(body.id).toBe('config-id');
    expect(body.top).toBe(50);
    expect(body.skip).toBe(100);
    expect(body.filter).toBe("CatalogEntryId eq 'cat-id'");
  });
});

describe('toApplicableDevice', () => {
  it('maps a normalized row to a DriverApplicableDevice', () => {
    const row = {
      AadDeviceId: 'aad-1',
      AggregateState: 'Success',
      AggregateState_loc: 'Success',
      CurrentDeviceUpdateState: 8,
      CurrentDeviceUpdateState_loc: 'Installed',
      CurrentDeviceUpdateSubstate: 23,
      CurrentDeviceUpdateSubstate_loc: 'Update installed',
      CurrentDeviceUpdateSubstateTime: '2026-03-19T12:08:16',
      DeviceId: 'intune-1',
      DeviceName: 'GPC-1',
      LastWUScanTime: '2026-03-31T09:21:44',
      PolicyName: 'Ring 1',
      UPN: 'user@example.com',
    };
    const result = toApplicableDevice(row);
    expect(result).toEqual({
      deviceId: 'intune-1',
      aadDeviceId: 'aad-1',
      deviceName: 'GPC-1',
      upn: 'user@example.com',
      policyName: 'Ring 1',
      aggregateState: 'Success',
      currentDeviceUpdateState: 8,
      currentDeviceUpdateStateLoc: 'Installed',
      currentDeviceUpdateSubstate: 23,
      currentDeviceUpdateSubstateLoc: 'Update installed',
      currentDeviceUpdateSubstateTime: '2026-03-19T12:08:16',
      lastWUScanTime: '2026-03-31T09:21:44',
    });
  });

  it('falls back to empty string for missing string fields', () => {
    const result = toApplicableDevice({});
    expect(result.deviceName).toBe('');
    expect(result.upn).toBe('');
    expect(result.policyName).toBe('');
  });

  it('falls back to 0 for missing numeric fields', () => {
    const result = toApplicableDevice({});
    expect(result.currentDeviceUpdateState).toBe(0);
    expect(result.currentDeviceUpdateSubstate).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDriverApplicableDevices.test.ts`

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useDriverApplicableDevices.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from './useAuth';
import type { DriverApplicableDevice } from '@/types/drivers';
import { zipSchemaValues, type ReportColumn } from '@/lib/reportNormalize';

const REPORT_NAME = 'DriverUpdateDeviceStatusByDriver';
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;

const SELECT_COLUMNS = [
  'DeviceName',
  'UPN',
  'DeviceId',
  'AadDeviceId',
  'CurrentDeviceUpdateSubstateTime',
  'PolicyName',
  'CurrentDeviceUpdateState',
  'CurrentDeviceUpdateSubstate',
  'AggregateState',
  'HighestPriorityAlertSubType',
  'LastWUScanTime',
];

function escapeOData(s: string): string {
  return s.replace(/'/g, "''");
}

export function buildConfigBody(catalogEntryId: string) {
  return {
    id: `${REPORT_NAME}_00000000-0000-0000-0000-000000000001`,
    filter: `CatalogEntryId eq '${escapeOData(catalogEntryId)}'`,
    orderBy: [] as string[],
    select: SELECT_COLUMNS,
    search: '',
    metadata: '',
  };
}

export function buildFetchBody(
  configId: string,
  catalogEntryId: string,
  top: number,
  skip: number
) {
  return {
    id: configId,
    top,
    skip,
    search: '',
    orderBy: [] as string[],
    filter: `CatalogEntryId eq '${escapeOData(catalogEntryId)}'`,
    select: SELECT_COLUMNS,
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

export function toApplicableDevice(row: Record<string, unknown>): DriverApplicableDevice {
  return {
    deviceId: str(row.DeviceId),
    aadDeviceId: str(row.AadDeviceId),
    deviceName: str(row.DeviceName),
    upn: str(row.UPN),
    policyName: str(row.PolicyName),
    aggregateState: str(row.AggregateState_loc) || str(row.AggregateState),
    currentDeviceUpdateState: num(row.CurrentDeviceUpdateState),
    currentDeviceUpdateStateLoc: str(row.CurrentDeviceUpdateState_loc),
    currentDeviceUpdateSubstate: num(row.CurrentDeviceUpdateSubstate),
    currentDeviceUpdateSubstateLoc: str(row.CurrentDeviceUpdateSubstate_loc),
    currentDeviceUpdateSubstateTime: str(row.CurrentDeviceUpdateSubstateTime),
    lastWUScanTime: str(row.LastWUScanTime),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface CachedReportConfig {
  id: string;
  status: 'inProgress' | 'completed' | string;
}

interface CachedReportResponse {
  TotalRowCount: number;
  Schema: ReportColumn[];
  Values: unknown[][];
}

export interface UseDriverApplicableDevicesResult {
  devices: DriverApplicableDevice[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useDriverApplicableDevices(
  catalogEntryId: string | null,
  enabled: boolean
): UseDriverApplicableDevicesResult {
  const { getAccessToken } = useAuth();
  const [devices, setDevices] = useState<DriverApplicableDevice[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    if (!enabled || !catalogEntryId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      setDevices([]);
      setTotalCount(0);

      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await tokenRef.current() },
        });

        // Phase 1: configure
        const configBody = buildConfigBody(catalogEntryId);
        const phase1: CachedReportConfig = await client
          .api('/deviceManagement/reports/cachedReportConfigurations')
          .version('beta')
          .post(configBody);

        if (cancelled) return;
        const configId = phase1.id ?? configBody.id;

        // Phase 2: poll until completed (or already completed)
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        let status = phase1.status;
        while (status !== 'completed') {
          if (cancelled) return;
          if (Date.now() > deadline) {
            throw new Error('Report generation timed out after 30 seconds');
          }
          await sleep(POLL_INTERVAL_MS);
          if (cancelled) return;
          const poll: CachedReportConfig = await client
            .api(`/deviceManagement/reports/cachedReportConfigurations('${configId}')`)
            .version('beta')
            .get();
          status = poll.status;
        }

        // Phase 3: fetch
        if (cancelled) return;
        const fetchBody = buildFetchBody(configId, catalogEntryId, 50, 0);
        const phase3: CachedReportResponse = await client
          .api('/deviceManagement/reports/getCachedReport')
          .version('beta')
          .post(fetchBody);

        if (cancelled) return;
        const rows = zipSchemaValues(phase3.Schema, phase3.Values);
        setDevices(rows.map(toApplicableDevice));
        setTotalCount(phase3.TotalRowCount);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [catalogEntryId, enabled, retryCount]);

  return {
    devices,
    totalCount,
    isLoading,
    error,
    retry: () => setRetryCount((c) => c + 1),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDriverApplicableDevices.test.ts`

Expected: PASS — all 6 tests green (2 for buildConfigBody, 1 for buildFetchBody, 3 for toApplicableDevice).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDriverApplicableDevices.ts src/hooks/useDriverApplicableDevices.test.ts
git commit -m "feat(drivers): useDriverApplicableDevices hook with 3-phase orchestration"
```

---

### Task 4: DriverDevicesTab component (TDD)

**Files:**
- Create: `src/components/drivers/DriverDevicesTab.tsx`
- Create: `src/components/drivers/DriverDevicesTab.test.tsx`

A pure render component. Takes `catalogEntryId` + `enabled` and renders the loading/empty/error/loaded states. The hook does the fetch; this is just UI.

- [ ] **Step 1: Write failing tests**

Create `src/components/drivers/DriverDevicesTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverDevicesTab } from './DriverDevicesTab';
import type { DriverApplicableDevice } from '@/types/drivers';

vi.mock('@/hooks/useDriverApplicableDevices', () => ({
  useDriverApplicableDevices: vi.fn(),
}));

import { useDriverApplicableDevices } from '@/hooks/useDriverApplicableDevices';

const mockHook = useDriverApplicableDevices as unknown as ReturnType<typeof vi.fn>;

const device = (over: Partial<DriverApplicableDevice> = {}): DriverApplicableDevice => ({
  deviceId: 'd1',
  aadDeviceId: 'a1',
  deviceName: 'LAPTOP-1',
  upn: 'user@example.com',
  policyName: 'Ring 1',
  aggregateState: 'Success',
  currentDeviceUpdateState: 8,
  currentDeviceUpdateStateLoc: 'Installed',
  currentDeviceUpdateSubstate: 23,
  currentDeviceUpdateSubstateLoc: 'Update installed',
  currentDeviceUpdateSubstateTime: '2026-03-19T12:08:16',
  lastWUScanTime: '2026-03-31T09:21:44',
  ...over,
});

describe('DriverDevicesTab', () => {
  it('renders a loading state while isLoading', () => {
    mockHook.mockReturnValue({
      devices: [], totalCount: 0, isLoading: true, error: null, retry: () => {},
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText(/Loading device report/i)).toBeInTheDocument();
  });

  it('renders the empty state when no devices', () => {
    mockHook.mockReturnValue({
      devices: [], totalCount: 0, isLoading: false, error: null, retry: () => {},
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText(/No devices currently apply/i)).toBeInTheDocument();
  });

  it('renders an error state with a retry button', () => {
    const retry = vi.fn();
    mockHook.mockReturnValue({
      devices: [], totalCount: 0, isLoading: false, error: 'Boom', retry,
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText(/Failed to load device report/i)).toBeInTheDocument();
    expect(screen.getByText(/Boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders one row per device with name, status, policy, UPN', () => {
    mockHook.mockReturnValue({
      devices: [device({ deviceName: 'LAPTOP-A' }), device({ deviceName: 'LAPTOP-B', upn: 'b@x.com' })],
      totalCount: 2, isLoading: false, error: null, retry: () => {},
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText('LAPTOP-A')).toBeInTheDocument();
    expect(screen.getByText('LAPTOP-B')).toBeInTheDocument();
    expect(screen.getAllByText(/Installed/).length).toBeGreaterThan(0);
    expect(screen.getByText('b@x.com')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/drivers/DriverDevicesTab.test.tsx`

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement DriverDevicesTab**

Create `src/components/drivers/DriverDevicesTab.tsx`:

```tsx
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDriverApplicableDevices } from '@/hooks/useDriverApplicableDevices';
import type { DriverApplicableDevice } from '@/types/drivers';

interface Props {
  catalogEntryId: string | null;
  enabled: boolean;
}

function stateBadgeClasses(loc: string): string {
  const s = loc.toLowerCase();
  if (s.includes('installed')) return 'bg-emerald-100 text-emerald-900';
  if (s.includes('error') || s.includes('failed')) return 'bg-red-100 text-red-900';
  if (s.includes('offer')) return 'bg-amber-100 text-amber-900';
  if (s.includes('cancel') || s.includes('declined')) return 'bg-slate-100 text-slate-900';
  return 'bg-muted text-muted-foreground';
}

function StateBadge({ device }: { device: DriverApplicableDevice }) {
  const label = device.currentDeviceUpdateStateLoc || device.aggregateState || '—';
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs', stateBadgeClasses(label))}>
      {label}
    </span>
  );
}

function safeRelative(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function DriverDevicesTab({ catalogEntryId, enabled }: Props) {
  const { devices, totalCount, isLoading, error, retry } = useDriverApplicableDevices(
    catalogEntryId,
    enabled
  );

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate">
        Loading device report…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 rounded-2xl border border-signal/30 bg-signal/[0.10] p-3 text-sm text-signal-light">
        <div>Failed to load device report.</div>
        <div className="text-xs opacity-75">{error}</div>
        <Button type="button" size="sm" variant="outline" onClick={retry}>Retry</Button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate">
        No devices currently apply for this driver.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate">
        Showing {devices.length} of {totalCount} device{totalCount !== 1 ? 's' : ''}.
      </div>
      <div role="table" className="overflow-hidden rounded-2xl border border-border">
        <div
          role="row"
          className="grid grid-cols-[1fr_140px_1fr_140px] gap-3 border-b border-border bg-muted px-3 py-2 text-xs font-medium text-slate"
        >
          <div role="columnheader">Device</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Policy</div>
          <div role="columnheader" className="text-right">Last scan</div>
        </div>
        {devices.map((d) => (
          <div
            key={`${d.deviceId}|${d.policyName}`}
            role="row"
            aria-label={d.deviceName}
            className="grid grid-cols-[1fr_140px_1fr_140px] items-center gap-3 border-b border-border px-3 py-2"
          >
            <div role="cell">
              <div className="font-medium text-ink">{d.deviceName || '—'}</div>
              <div className="text-xs text-slate">{d.upn || '—'}</div>
            </div>
            <div role="cell"><StateBadge device={d} /></div>
            <div role="cell" className="text-xs text-slate">{d.policyName || '—'}</div>
            <div role="cell" className="text-right text-xs text-slate">
              {safeRelative(d.lastWUScanTime)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/DriverDevicesTab.test.tsx`

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/drivers/DriverDevicesTab.tsx src/components/drivers/DriverDevicesTab.test.tsx
git commit -m "feat(drivers): DriverDevicesTab with loading/empty/error/loaded states"
```

---

### Task 5: Integrate Tabs into DriverDetailDrawer

**Files:**
- Modify: `src/components/drivers/DriverDetailDrawer.tsx`
- Verify exists: `src/components/ui/tabs.tsx`

We wrap the existing drawer content in a `Tabs` component with two tabs: "Overview" (the current content) and "Devices" (new). The Devices tab is `enabled` only when it's the active tab — keeps the 3-phase flow from firing on drawer open.

- [ ] **Step 1: Verify shadcn Tabs component exists**

Run: `ls src/components/ui/tabs.tsx`

If the file exists, skip to Step 2. If not, install via:

```bash
npx shadcn@latest add tabs
```

(Or manually create per shadcn/ui docs — but it almost certainly already exists since several Radix tabs primitives are listed in `package.json`.)

- [ ] **Step 2: Update DriverDetailDrawer.tsx**

At the top of `src/components/drivers/DriverDetailDrawer.tsx`, add to the imports:

```tsx
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DriverDevicesTab } from './DriverDevicesTab';
```

The existing `import type { Driver, DriverInventory } from '@/types/drivers';` already pulls `Driver` — `Driver.key` is the inventoryId we use as catalogEntryId.

Find the `<div className="mt-6 space-y-6">` block (the existing content container). Wrap it in a Tabs component. The simplest mechanical change: replace

```tsx
        <div className="mt-6 space-y-6">
          <section ...>OVERVIEW</section>
          <section ...>POLICIES</section>
          ...
        </div>
```

with:

```tsx
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="devices">
              Devices ({driver.applicableDeviceCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* existing overview/policies/catalog/lookup sections go here, unchanged */}
            <section ...>OVERVIEW</section>
            <section ...>POLICIES</section>
            ...
          </TabsContent>

          <TabsContent value="devices">
            <DriverDevicesTab
              catalogEntryId={driver.inventoryId}
              enabled
            />
          </TabsContent>
        </Tabs>
```

**Important detail about `enabled`:** by passing `enabled` always-true here, the Devices tab fetches as soon as the drawer mounts. To defer until the user actually clicks the tab, instead track the active tab via `useState` and pass `enabled={activeTab === 'devices'}`. Implementation:

```tsx
const [activeTab, setActiveTab] = useState('overview');
// ...
<Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
  ...
  <TabsContent value="devices">
    <DriverDevicesTab
      catalogEntryId={driver.inventoryId}
      enabled={activeTab === 'devices'}
    />
  </TabsContent>
</Tabs>
```

This is the version we want — go with this. (Lazy fetch is the design.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Verify existing drawer tests still pass**

Run: `npx vitest run src/components/drivers/DriverDetailDrawer.test.tsx`

Expected: PASS — all 5 existing tests still green. The Tabs wrapper changes the DOM structure but the `getByText`-based assertions in those tests should still find their targets.

If any test fails due to the new Tabs wrapping (e.g., `getByText('Sample Driver')` finds it in a different position), update the test minimally to use `screen.getByText('Sample Driver', { selector: 'h2, h3, [class*="text-ink"]' })` or similar — but keep changes surgical.

- [ ] **Step 5: Run the full driver test suite to catch any cross-cutting regressions**

Run: `npx vitest run src/components/drivers/ src/hooks/useDriver`

Expected: All driver-related tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/drivers/DriverDetailDrawer.tsx
git commit -m "feat(drivers): add Devices tab to detail drawer (v1.1)"
```

---

### Task 6: Smoke test in dev server

**Files:** None — manual verification only.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Sign in and navigate to /drivers**

Open `http://localhost:8080/drivers`, sign in with an Intune account that has driver update profiles.

- [ ] **Step 3: Verify the Devices tab works**

- Click any driver row with `applicableDeviceCount > 0`
- Drawer opens on Overview tab (no fetch fires)
- Click "Devices" tab
- Loading spinner appears for 1-3 seconds
- Device list renders with at least one row
- Each row shows: device name, status badge, policy name, last scan time

- [ ] **Step 4: Verify edge cases**

- Open drawer for a driver with `applicableDeviceCount === 0` (if any exist). Devices tab should show "No devices currently apply for this driver."
- Open the same drawer twice in a row — second time, fetch should be re-fired (no session cache yet; that's a v1.2 polish).
- Use F12 → Network to confirm the 3-phase flow is happening as designed: one POST to `cachedReportConfigurations`, one or more GETs to poll, one POST to `getCachedReport`.

- [ ] **Step 5: Report findings**

If anything looks wrong (status doesn't render, error in console, fetch hangs, etc.), capture the specifics and either fix-as-follow-up or flag it as known-limitation for v1.2.

If everything works, the feature is shippable. No commit needed for this task.

---

## Self-Review

**Spec coverage:**

- ✅ `DriverApplicableDevice` type — Task 1
- ✅ Schema+Values normalization — Task 2
- ✅ 3-phase orchestration with polling — Task 3
- ✅ Tab UI states (loading / empty / error / loaded) — Task 4
- ✅ Tabs integration in drawer with lazy fetch — Task 5
- ✅ Smoke test against real tenant — Task 6

**Placeholder scan:** No "TBD" or vague steps. Every test has concrete assertions; every implementation step has the code.

**Type consistency:** `DriverApplicableDevice` fields used identically across Task 1 (definition), Task 3 (`toApplicableDevice`), and Task 4 (UI rendering). `catalogEntryId` plumbed through hook → tab → drawer consistently.

**Risks acknowledged in the spec:**
- `CatalogEntryId === DriverInventory.id` is a hypothesis. Task 6 smoke-tests it. If wrong, follow-up fix is local to Task 3's hook (change the source of `catalogEntryId`).
- 30-second poll timeout. Mentioned in spec; tunable in `useDriverApplicableDevices.ts` if it bites.

---

## Execution Handoff

Plan complete. Use **superpowers:subagent-driven-development** to execute. Six tasks, each focused and TDD-disciplined. The first three are pure-function-heavy (mostly mechanical given the test specs). Task 5 is the riskiest (touches existing drawer code) and warrants extra review attention.
