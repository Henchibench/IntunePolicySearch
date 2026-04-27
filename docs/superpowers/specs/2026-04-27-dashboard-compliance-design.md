# Dashboard — Compliance (Sub-project 1)

**Status:** Design approved, pending implementation plan
**Date:** 2026-04-27
**Scope:** Dashboard shell, drill-down framework, and Compliance domain only

## Context

Intune's built-in dashboard reports headline numbers (e.g., "47 devices not compliant") without an obvious path to the underlying device list or the *why*. This sub-project builds an alternative dashboard inside IntunePolicySearch that lets an admin click a tile and drill all the way to a single non-compliant device.

This is the first of three planned sub-projects:

1. **(this spec)** Dashboard shell + drill-down framework + Compliance
2. Remaining domains (Apps, OS/Patch, Enrollment, Users, Assignment Health) — slot into the existing shell
3. Audit changelog — separate timeline UX powered by `auditEvents`

## Goals

- Read-only Compliance dashboard reachable at `/dashboard` and `/dashboard/compliance`.
- Drill-down hierarchy: tile → pivot (Reason / Platform / User) → group → device list → device detail → optional deep-fetch.
- Drill-down state lives in URL query params (deep-linkable, browser-back works).
- Initial paint fast: one paginated list call powers the entire compliance view.
- Heavier per-device data is fetched on demand, not eagerly.
- Shell is generic so v2 domains plug in without rewriting routes/components.

## Non-goals

- Write / remediation actions. Read-only stays read-only.
- Apps / OS / Enrollment / Users / Assignment-Health drill-downs (placeholders only in v1).
- Audit changelog (sub-project 3).
- Time-series / trend charts (no historical storage available).
- Server-side aggregation or Microsoft Graph Data Connect.

## Architecture

```
managedDevices (1 paginated list call, cached 30 min)
        │
        ├─► /dashboard          overview tile grid
        │     └─► Compliance KPI tile (% compliant, N failing)
        │     └─► v2 placeholders (Apps, OS, Enrollment, Users, Assignment Health)
        │
        └─► /dashboard/compliance
              ├─► PivotTabs: By Reason | By Platform | By User
              ├─► GroupList (counts + optional chart)
              ├─► DeviceTable (virtualized)
              └─► DeviceDrawer
                    ├─► A-level summary (always shown)
                    └─► [user clicks "Load deep details"]
                          └─► $batch of 3 calls for that one device:
                                deviceCompliancePolicyStates,
                                deviceConfigurationStates,
                                detectedApps
```

### Data fetch strategy: Hybrid

- **Eager, once per session (or until 30-min cache expires):** one paginated `GET /deviceManagement/managedDevices` with narrow `$select`. All three pivots and the overview tile derive client-side from this single dataset.
- **On-demand per-device:** when the user opens a device drawer and clicks "Load deep details", a `$batch` of three GETs runs for that device. Result held in component state, not persisted.
- **Optional pivot refinement:** the "By Reason" pivot defaults to `complianceState` values + a derived "stale (no check-in 30+ days)" pseudo-group. A "Refine reasons" button bulk-fetches `deviceCompliancePolicyStates` for non-compliant devices via `$batch` to surface specific failing settings as finer-grained groups. Slow, opt-in, not automatic.

## Routes & navigation

```
/                     existing policy search (unchanged)
/dashboard            tile grid overview
/dashboard/compliance compliance drill-down (pivot + group + device + drawer)
/filter, /demo        existing demo modes (unchanged)
```

Drill-down state is URL-driven:

```
/dashboard/compliance?pivot=reason&group=encryption-not-enabled&device=<id>
```

`pivot` ∈ `reason | platform | user`. `group` is a slugged group key. `device` opens the drawer for that id.

`Header.tsx` adds two top-level links: **Policies** (existing) and **Dashboard** (new). Active route highlighted. Demo modes (`/filter`, `/demo`) are unchanged and do not gate the dashboard in v1.

## Components

```
src/pages/
  Dashboard.tsx                  /dashboard overview
  DashboardCompliance.tsx        /dashboard/compliance drill-down

src/components/dashboard/
  KpiTile.tsx                    domain-agnostic tile (title, big number, sub-stat)
  PivotTabs.tsx                  segmented control for switching pivot
  GroupList.tsx                  list of pivot groups with counts
  DeviceTable.tsx                virtualized device table
  DeviceDrawer.tsx               side drawer with A-level summary + deep-load button
  DeviceDeepDetails.tsx          C-level details, lazy

src/services/
  dashboardService.ts            managedDevices + per-device deep fetches

src/hooks/
  useManagedDevices.ts           fetch + cache hook
  useDeviceDeepDetails.ts        on-demand per-device fetch

src/lib/
  compliance-pivots.ts           pure functions: groupByReason / groupByPlatform / groupByUser
```

`KpiTile`, `PivotTabs`, `GroupList`, `DeviceTable`, `DeviceDrawer` are domain-agnostic — they accept config/props, not hard-coded compliance logic. v2 domains supply their own `DashboardDomain` config (KPI extractor, pivot definitions, drill renderer) and reuse these components.

`compliance-pivots.ts` is pure (no React imports), trivially unit-testable.

## Graph API

Both calls use `/beta`. Existing MSAL scope `DeviceManagementManagedDevices.Read.All` (already in `loginRequest.scopes`) covers them — no scope changes.

| Call | When | Purpose |
|---|---|---|
| `GET /beta/deviceManagement/managedDevices?$select=…` (paginated) | `/dashboard` mount, cached 30 min | All compliance tiles and pivots |
| `$batch` of 3: `…/managedDevices/{id}/deviceCompliancePolicyStates`, `…/deviceConfigurationStates`, `…/detectedApps` | "Load deep details" click | C-level per-device dive |

`$select` for the list call:

```
id,deviceName,userPrincipalName,userDisplayName,
operatingSystem,osVersion,complianceState,lastSyncDateTime,
enrolledDateTime,managedDeviceOwnerType,
complianceGracePeriodExpirationDateTime,
deviceType,manufacturer,model
```

`$batch` reuses the existing `batchGet` helper in `graphService.ts`. Sub-requests handled per-response with 429/Retry-After backoff.

## Compliance pivots

### By Platform

Group key: `operatingSystem` normalized (`Windows | iOS | iPadOS | Android | macOS | Linux | Other`).

### By User

Group key: `userPrincipalName` (or `userDisplayName` for label). Devices without an owner go to a "Shared / unassigned" group.

### By Reason (default mode)

Group keys derived client-side from the list call:

- `compliant`, `noncompliant`, `conflict`, `error`, `inGracePeriod`, `configManager`, `unknown` (Graph values)
- `stale-30d` — synthesized: `complianceState !== compliant && lastSyncDateTime older than 30 days`
- `grace-period-expiring` — synthesized: `complianceGracePeriodExpirationDateTime within 7 days`

### By Reason (refined mode, opt-in)

User clicks "Refine reasons". For every device with `complianceState !== compliant`, fire `deviceCompliancePolicyStates` via `$batch`. Each returned non-compliant setting becomes its own group (e.g., "BitLocker not enabled — 18 devices", "OS version below minimum — 14 devices"). Cached only in memory for the session.

## Caching

- New cache keys: `intune-devices-cache` and `intune-devices-cache-timestamp`. 30-minute TTL, same pattern as `intune-policies-cache`.
- Manual "Refresh" button on `/dashboard` bypasses cache and forces re-fetch.
- Per-device deep-fetch is held in component state only — not persisted.
- Refined-reasons mode is held in memory for the session — not persisted.

## Error handling

- List call paginates inside a single try/catch. On failure, the dashboard surfaces an error banner with retry. No partial-success concept (single endpoint).
- Per-device deep-fetch failures show a red banner inside the drawer with a Retry button. Parent view stays usable.
- 429 / Retry-After:
  - Bulk list call: SDK auto-retry covers it (the SDK's retry middleware handles non-batched throttled responses).
  - `$batch` deep-fetch: handled per-response by the existing `batchGet` helper in `graphService.ts`.

## Performance

- Device list can be thousands of rows. `DeviceTable` uses virtualization. New dependency: `@tanstack/react-virtual` (~5 KB gzipped).
- All pivot computations are memoized with `useMemo` keyed on the device list reference + pivot mode. Switching pivots is instant after first compute.
- `$select` keeps the list payload small (~15 fields per device).
- Initial dashboard mount: one round-trip per page of `managedDevices` (default 1000/page) until pagination ends. Typical small/mid tenant: 1–3 round-trips.

## Testing

- `compliance-pivots.ts`: unit tests with synthetic device arrays covering each pivot, edge cases (no user, unknown OS, stale, grace-period boundaries).
- Component tests for `PivotTabs`, `GroupList`, `DeviceTable`, `DeviceDrawer` against mocked data.
- Smoke: `/dashboard` and `/dashboard/compliance` render without throwing on empty / single-device / 1000-device fixtures.
- Manual verification against a real tenant after implementation: counts match Intune portal numbers; deep-fetch surfaces the expected failing settings.

## Open questions / future work

- Whether to share the pivot framework with the existing policy search page (potentially yes in a later refactor; out of scope here).
- Whether `Refresh` should refetch policies too or just devices (decision: just devices on `/dashboard*`; policies have their own refresh on `/`).
- v2 domains will reveal whether `DashboardDomain` config abstraction holds up. Expect minor adjustments when sub-project 2 starts.
