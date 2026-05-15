# Driver Info v1.1 — Per-Device Drilldown Design Spec

## Goal

Add a "Devices" section to the driver detail drawer that lists *which* managed devices need or have a given driver — not just the aggregate count that v1 surfaces. Solves the gap a user immediately notices: "Intune tells me 348 devices need this update, but doesn't tell me which 348."

Read-only. Builds on v1; doesn't redesign it.

## What Changed Since the v1 Plan

The v1 spec called out per-device drilldown as out-of-scope and pointed at `POST /deviceManagement/reports/getCachedReport` as the future implementation path. After investigating against a real tenant on 2026-05-15, the actual API landscape turned out to be more nuanced than either the v1 spec OR the initial v1.1 brainstorm assumed.

### What does NOT work

**❌ `applicableContent` + `matchedDevices`** — initially looked like the cleanest path:

```http
GET /beta/admin/windows/updates/deploymentAudiences/{audienceId}/applicableContent
  ?$expand=catalogEntry,matchedDevices
```

Tested against tenant: `GET /beta/admin/windows/updates/deploymentAudiences/{profile.id}` returned **404 Not Found**. Microsoft has explicitly documented this as a known issue:

> "Accessing and updating deployment audiences on deployment resources created via Intune is not currently supported. Listing deployment audience members and listing deployment audience exclusions returns 404 Not Found."
> — https://learn.microsoft.com/graph/known-issues#accessing-and-updating-deployment-audiences-is-not-supported

This rules out the entire `/admin/windows/updates/deploymentAudiences/...` namespace for Intune-managed driver update profiles, which is what our users have. The mapping question (profile.id → audience.id) is moot because the endpoint doesn't work for Intune-created audiences regardless of the mapping.

### ✅ What works — the real endpoint (confirmed 2026-05-15)

The Intune portal uses a **three-phase `getCachedReport` flow** for the Windows Driver Update Report. F12 Network capture in the portal revealed the exact contract.

**Report name:** `DriverUpdateDeviceStatusByDriver`

**Phase 1 — configure the cached report:**

```http
POST /beta/deviceManagement/reports/cachedReportConfigurations
Content-Type: application/json

{
  "id": "DriverUpdateDeviceStatusByDriver_00000000-0000-0000-0000-000000000001",
  "filter": "CatalogEntryId eq '<catalogEntryId>'",
  "orderBy": [],
  "select": [
    "DeviceName", "UPN", "DeviceId", "AadDeviceId",
    "CurrentDeviceUpdateSubstateTime", "PolicyName",
    "CurrentDeviceUpdateState", "CurrentDeviceUpdateSubstate",
    "AggregateState", "HighestPriorityAlertSubType", "LastWUScanTime"
  ],
  "search": "",
  "metadata": ""
}
```

Server responds with `status: "inProgress"` (sometimes already `"completed"` if the report was recently generated).

**Phase 2 — poll until ready:**

```http
GET /beta/deviceManagement/reports/cachedReportConfigurations('DriverUpdateDeviceStatusByDriver_00000000-0000-0000-0000-000000000001')
```

Poll every ~1 second until `status === "completed"`. Typical completion: 1–3 seconds for small tenants.

**Phase 3 — fetch the data:**

```http
POST /beta/deviceManagement/reports/getCachedReport
Content-Type: application/json

{
  "id": "DriverUpdateDeviceStatusByDriver_00000000-0000-0000-0000-000000000001",
  "top": 50,
  "skip": 0,
  "search": "",
  "orderBy": [],
  "filter": "CatalogEntryId eq '<catalogEntryId>'",
  "select": [ /* same as Phase 1 */ ]
}
```

Response — exactly what the user asked for:

```json
{
  "TotalRowCount": 1,
  "Schema": [
    { "Column": "AadDeviceId",                      "PropertyType": "String"   },
    { "Column": "AggregateState",                   "PropertyType": "String"   },
    { "Column": "AggregateState_loc",               "PropertyType": "String"   },
    { "Column": "CurrentDeviceUpdateState",         "PropertyType": "Int32"    },
    { "Column": "CurrentDeviceUpdateState_loc",     "PropertyType": "String"   },
    { "Column": "CurrentDeviceUpdateSubstate",      "PropertyType": "Int32"    },
    { "Column": "CurrentDeviceUpdateSubstate_loc",  "PropertyType": "String"   },
    { "Column": "CurrentDeviceUpdateSubstateTime",  "PropertyType": "DateTime" },
    { "Column": "DeviceId",                         "PropertyType": "String"   },
    { "Column": "DeviceName",                       "PropertyType": "String"   },
    { "Column": "HighestPriorityAlertSubType",      "PropertyType": "Int32"    },
    { "Column": "HighestPriorityAlertSubType_loc",  "PropertyType": "String"   },
    { "Column": "LastWUScanTime",                   "PropertyType": "DateTime" },
    { "Column": "PolicyName",                       "PropertyType": "String"   },
    { "Column": "UPN",                              "PropertyType": "String"   }
  ],
  "Values": [
    [
      "<aadDeviceId>", "Success", "Success",
      8, "Installed",
      23, "Update installed",
      "2026-03-19T12:08:16",
      "<intuneDeviceId>", "GPC-6XTRVV3",
      0, "Not applicable",
      "2026-03-31T09:21:44",
      "DU002-Driver Updates First Ring-D-GBL-W11-DEV",
      "u061608@dwdev.saabgroup.com"
    ]
  ],
  "LastUpdatedTime": null
}
```

**Notes:**

- **`CatalogEntryId`** is a NEW field not surfaced in v1's `driverInventories` response. We need to investigate where it comes from. Two hypotheses (testable next session): (a) it IS the existing `DriverInventory.id` from v1 — easiest case, no schema change needed; (b) it's a different identifier that requires a separate fetch. Try (a) first; if it 200s with empty results, try (b).
- **The `_loc` suffix columns** are localized strings (e.g., `"Installed"` for state `8`). We use those directly for display rather than maintaining our own enum mapping.
- **`PolicyName`** is included per row — handy because a single device might appear once per policy it's in.
- **The Intune portal sends the filter duplicated** (`(X eq Y) and (X eq Y)`) — that's a portal quirk and unnecessary. A single `CatalogEntryId eq '...'` clause works fine.
- **Pagination** uses `skip`/`top` — same pattern as elsewhere in `/deviceManagement/reports/`.

### Secondary (lower priority): the alerts-only report

**`getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport`** — confirmed working endpoint, but returns the wrong subset of data:

```http
POST /beta/deviceManagement/reports/getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport
Content-Type: application/json

{
  "filter": "PolicyId eq '{profileId}'",
  "skip": 0,
  "top": 50
}
```

Returns 200 OK with this response shape:

```json
{
  "SessionId": "292d39ba-873f-4262-98c7-49dc8c2cdab7",
  "TotalRowCount": 0,
  "Schema": [
    { "Column": "DeviceName",          "PropertyType": "String"   },
    { "Column": "DriverName",          "PropertyType": "String"   },
    { "Column": "DriverClass",         "PropertyType": "String"   },
    { "Column": "Manufacturer",        "PropertyType": "String"   },
    { "Column": "AlertSubtype",        "PropertyType": "Int32"    },
    { "Column": "AlertId",             "PropertyType": "String"   },
    { "Column": "Win32ErrorCode",      "PropertyType": "String"   },
    { "Column": "UPN",                 "PropertyType": "String"   },
    { "Column": "DriverReleaseDateUTC","PropertyType": "DateTime" },
    { "Column": "IntuneDeviceId",      "PropertyType": "String"   }
  ],
  "Values": []
}
```

**The catch:** this report only returns devices that have **alerts/errors** with a driver, not all devices for which the driver is *applicable*. Useful only as a secondary "trouble-shooting" view; the primary "which devices need this driver" question is answered by the `DriverUpdateDeviceStatusByDriver` flow documented above.

Decision: **not implemented in v1.1.** Could be a v1.2 add-on.

## Architecture

### Data flow

```
v1 (already shipped):
  windowsDriverUpdateProfiles → driverInventories (per profile)
                              → applicableDeviceCount (number only)

v1.1 (target):
  Drawer opens for a Driver
    → CatalogEntryId resolved from Driver row (hypothesis: DriverInventory.id IS CatalogEntryId)
    → POST cachedReportConfigurations (Phase 1: configure)
    → GET cachedReportConfigurations('<id>') (Phase 2: poll until completed)
    → POST getCachedReport (Phase 3: fetch)
    → normalize Schema+Values into row objects
    → render device list in Devices tab
```

### One new surface in the drawer

**Devices tab** — primary new view. All devices for which the driver is applicable, with their current update state.

Per row (columns we'll display from the report's Schema):
- **Device name** — `DeviceName`
- **Status** — `AggregateState_loc` (e.g., "Success") with `CurrentDeviceUpdateSubstate_loc` (e.g., "Update installed") below as muted text
- **Policy** — `PolicyName` (which ring the device is in for this driver)
- **User** — `UPN`
- **Last WU scan** — `LastWUScanTime` (relative format)

Sort: most-recently-scanned first.

Pagination: report API supports `top` / `skip`. v1.1 renders the first 50, with a "Load more devices" button if `TotalRowCount > 50`.

## Open Investigation Items

### 1. ✅ RESOLVED (2026-05-15): deploymentAudiences is dead for Intune-managed profiles

Tested. 404 on every Intune-created profile. Microsoft has confirmed this as a known bug. **Do not use this namespace.** See "What does NOT work" section above.

### 2. ✅ RESOLVED (2026-05-15): Per-device endpoint identified

F12 Network capture in the Intune portal revealed the exact 3-phase flow. See "What works — the real endpoint" section above.

### 3. ⏳ MINOR OPEN: Is `CatalogEntryId === DriverInventory.id`?

The portal sends a `CatalogEntryId` like `<sha256-hash>_<guid>` in the filter. v1's `driverInventories` response already includes an `id` field that's also `<hash>_<guid>`-shaped — strong hint that they're the same. Confirm during implementation smoke-test: send `CatalogEntryId eq '<our-driver-inventory-id>'`; expect 200 with relevant rows.

If they happen to differ, we'll need to either fetch CatalogEntryId from a separate endpoint or discover it's a transformed version of the inventory ID. Either way, recoverable — but slim chance we even hit this case.

### 4. ✅ RESOLVED (2026-05-15): Required permissions

Existing v1 scopes are sufficient — no new permission required for either the alerts endpoint OR the cachedReport endpoints (both are under `/deviceManagement/reports/`, gated by `DeviceManagementConfiguration.Read.All` which we already have).

## Page Layout Changes

### DriverDetailDrawer — wrap content in Tabs, add Devices tab

The current drawer renders everything stacked vertically. We wrap the existing content (Overview, Policies, Catalog, Lookup) in an "Overview" tab and add a new "Devices" tab.

Tab labels: **Overview** (default) | **Devices** (badge with `applicableDeviceCount` count)

### Devices tab UI states

| State | Render |
|---|---|
| Tab not yet activated | Fetching deferred — don't fire the 3-phase flow until the user clicks the tab. Keep the drawer snappy. |
| Loading (phase 1 + 2) | "Loading device report…" with a spinner. Show "Generating report — this may take a few seconds" as muted secondary text after 2 seconds (typical wait). |
| Loaded with rows | Table-style list (same as v1's DriverTable styling). One row per device. |
| Loaded with zero rows | "No devices currently apply for this driver." muted message. |
| Failed (any phase) | Inline error "Failed to load device report. {error message}" with a "Retry" button. Don't auto-retry. |

## Data Fetching

The 3-phase flow (configure → poll → fetch) is documented in "What works — the real endpoint" above. Below: how the renderer orchestrates it.

### Schema+Values normalization

The report API returns a column-store shape (`Schema: Column[]` + `Values: any[][]`) instead of OData's `value: [{...}]`. A small pure helper `zipSchemaValues(schema, values)` converts the result into a `Record<string, unknown>[]` so the rest of the code can use property access.

### Polling

Phase 2 polls every 1 second up to 30 seconds. After 30 seconds, give up and surface an error. Polling uses `setInterval`-style with cleanup on unmount and on `status === "completed"`.

In practice the report is often already cached when we call Phase 1 (returns `status: "completed"` immediately), so polling is rarely needed in steady state. But we always go through Phase 2 because the API contract requires it.

### Caching

One cache entry per `CatalogEntryId` for the session lifetime. The Devices tab is unmounted/remounted as the user opens drawers for different drivers; we don't want to re-run the 3-phase flow each time the same driver is opened.

The drawer's tab activation also lazy-fires the hook — opening the drawer but never clicking "Devices" doesn't trigger the fetch.

### Device metadata enrichment (deferred)

The report already includes `DeviceName`, `UPN`, `PolicyName`, and status fields. **For v1.1 we don't enrich with `managedDevices` metadata** — the report's columns are sufficient. If we later want model/OS/etc, we can add it in v1.2 by joining `DeviceId` → `managedDevices/{id}`.

## Hooks

| Hook | Purpose |
|---|---|
| `useDriverApplicableDevices(catalogEntryId)` | Orchestrate the 3-phase flow, manage polling, expose normalized rows + loading state |

Plus one pure helper (not a hook):
- `zipSchemaValues(schema, values)` — pure function in `src/lib/reportNormalize.ts`

## File Structure

| File | Status | Purpose |
|---|---|---|
| `src/types/drivers.ts` | Modify | Add `DriverApplicableDevice` interface (the normalized row shape) |
| `src/lib/reportNormalize.ts` | Create | `zipSchemaValues` pure helper |
| `src/lib/reportNormalize.test.ts` | Create | TDD tests for `zipSchemaValues` |
| `src/hooks/useDriverApplicableDevices.ts` | Create | The 3-phase fetcher with polling |
| `src/hooks/useDriverApplicableDevices.test.ts` | Create | TDD tests for orchestration (pure parts) |
| `src/components/drivers/DriverDevicesTab.tsx` | Create | Devices tab content + tests |
| `src/components/drivers/DriverDevicesTab.test.tsx` | Create | TDD tests for render states |
| `src/components/drivers/DriverDetailDrawer.tsx` | Modify | Add Tabs wrapper, integrate Devices tab |

No changes to `src/services/authConfig.ts` — existing v1 scopes are sufficient.

## Error Handling

- **Phase 1 (configure) fails**: inline error in the Devices tab. Other tabs unaffected.
- **Phase 2 (poll) times out after 30s**: inline error "Report took too long to generate. Try again." with a Retry button.
- **Phase 3 (fetch) fails**: inline error with the error message. Retry button.
- **Empty Values array** (TotalRowCount === 0): "No devices currently apply for this driver." muted message.
- **CatalogEntryId hypothesis fails** (filter returns no rows but driver clearly has applicableDeviceCount > 0): surface a console warning so we can diagnose; render "No devices currently apply for this driver." as the user-visible state. We'll fix the mapping in a follow-up if this fires for real.
- **Schema mismatch** (Microsoft changes report schema): `zipSchemaValues` produces rows with whatever columns are present; the UI shows `—` for missing fields rather than crashing.

When the Devices endpoint is identified in a future investigation session, re-verify whether it needs additional scopes (unlikely but possible).

## Scope Boundaries

**In scope (v1.1 — what we can do today):**
- New "Issues" tab in the driver detail drawer
- Schema+Values report normalization helper
- IntuneDeviceId → managedDevices metadata join
- Tab layout in drawer (Overview / Issues)

**Deferred to v1.2 (pending F12 investigation):**
- "Devices" tab listing all applicable devices for a driver — the original user ask. Blocked on identifying the right report endpoint.

**Out of scope entirely:**
- Bulk approve/decline from the device list (still read-only)
- Filter/search within the device list
- Push notification when a device's status changes
- Cross-driver views ("show me all drivers that affect device X") — different IA
- The `/admin/windows/updates/deploymentAudiences/...` path — confirmed broken for Intune-managed profiles
- Lenovo / HP / Microsoft catalog enrichment (still v2)

## Risks

- **Reports API is beta-shaped.** The Schema+Values column-store response shape is unusual for Graph and might evolve. We isolate the normalization in one place (`zipSchemaValues`) to limit blast radius if it changes.
- **`CatalogEntryId === DriverInventory.id` is an assumption.** Strong empirical hint (both are `<hash>_<guid>`-shaped) but not formally proven. If wrong, the Devices tab shows "No devices apply" instead of the real data — recoverable, not catastrophic.
- **Report generation can be slow on large tenants.** The 30-second poll timeout might be too aggressive for tenants with thousands of devices. If users hit this in practice, bump to 60s.

## Implementation Plan

See `docs/superpowers/plans/2026-05-15-driver-info-v1-1.md` for the task-by-task TDD plan, written 2026-05-15.
