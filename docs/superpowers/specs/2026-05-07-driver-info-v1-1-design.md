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

### What partially works

**⚠️ `getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport`** — confirmed working endpoint, but returns the wrong subset of data:

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

**The catch:** this report only returns devices that have **alerts/errors** with a driver, not all devices for which the driver is *applicable*. Useful as a secondary "trouble-shooting" view, but does not answer the original user question: "which N devices need this driver?"

### What we still need to find

**⏳ A "Driver Updates Report" / applicable-devices endpoint.** The Intune portal has this view under Reports → Windows Updates → Reports → Windows Driver Update Report. It shows, for a selected driver, the devices it is applicable to with `Update State` values like *Offering / Installed / Cancelled / Needs attention*.

Candidate endpoint names to test next session (POST with appropriate `filter`):
- `getWindowsDriverUpdateDeviceStateReport`
- `getWindowsDriverUpdateDeploymentStatusReport`
- `getWindowsDriverUpdateDeviceStatusByDriverReport`
- `getDriverUpdateDeviceStatusByPolicyReport`
- Possibly via `POST /deviceManagement/reports/getCachedReport` with a specific `name` parameter

The Intune portal JavaScript bundle (inspected via F12 → Sources) revealed the convention used for the **Feature Update** equivalent: `getWindowsUpdateAlertsPerPolicyPerDeviceReport`. The pattern strongly suggests a driver-update-device-state report exists by analogy.

**Next investigation step (when we resume):** in Intune portal F12 → **Network** tab (not Sources), click into a driver in the Driver Update Report and capture the actual POST request to graph.microsoft.com. That request reveals the exact endpoint + body shape.

## Architecture

### Data flow

```
v1 (already shipped):
  windowsDriverUpdateProfiles → driverInventories (per profile)
                              → applicableDeviceCount (number only)

v1.1 (target):
  windowsDriverUpdateProfiles → driverInventories
                              → {applicable-devices report endpoint TBD}
                              → join via IntuneDeviceId to useManagedDevices
                              → drawer-shown device list with status

v1.1 secondary (already proven):
  windowsDriverUpdateProfiles → driverInventories
                              → getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport
                              → trouble-shooting tab in drawer
                              → join via IntuneDeviceId to useManagedDevices
```

### Two surfaces in the drawer (target)

1. **"Devices" tab** — primary view. All devices the driver is applicable to. Sourced from the still-to-be-identified "Driver Updates Report" endpoint. Per row: device name, model, OS, last check-in, update state (Offering / Installed / Cancelled / Needs attention).

2. **"Issues" tab** — secondary view. Only devices with errors/alerts on this driver. Sourced from the **proven-working** `getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport`. Per row: device name, alert subtype, Win32 error code, driver release date.

The Issues tab can be implemented **today** with the data we have. The Devices tab needs one more investigation round to find the right endpoint.

## Open Investigation Items

### 1. ✅ RESOLVED (2026-05-15): deploymentAudiences is dead for Intune-managed profiles

Tested. 404 on every Intune-created profile. Microsoft has confirmed this as a known bug. **Do not use this namespace.** See "What does NOT work" section above.

### 2. ✅ RESOLVED (2026-05-15): Alerts-per-policy-per-device report works

Endpoint, body shape, response shape, and permission all confirmed against a real tenant. See "What partially works" section above for the verified contract.

### 3. ⏳ OPEN: Find the "applicable-devices" report endpoint

This is the **remaining unknown**. The Intune portal clearly has this data (visible in its "Windows Driver Update Report" view). We just don't know the endpoint name yet.

**Next investigation step:**

1. Open Intune portal → **Reports** → **Windows updates** → **Reports** tab → **Windows Driver Update Report** tile
2. F12 → **Network** tab (NOT Sources, NOT search-in-page) → filter on **Fetch/XHR** → **Clear**
3. In the portal, select a driver update from the picker. The page makes a fresh request to load the device list.
4. In Network tab, find the POST request to `graph.microsoft.com` triggered by selecting the driver. There will be exactly one matching request — its URL is the endpoint name.
5. Right-click that request → **Copy** → **Copy as cURL** (or copy URL + body separately)
6. Paste the URL + body to the implementation thread

Until that's resolved, v1.1 can ship the Issues tab only (deferring the Devices tab to v1.2 if needed).

### 4. ⏳ OPEN: Required permissions

Tested empirically — the `getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport` call returned 200 with our existing v1 scopes:
- `DeviceManagementConfiguration.Read.All`
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementApps.Read.All`

No additional `WindowsUpdates.Read.All` scope was needed. **This means the entire v1.1 implementation may need zero new permissions** — assuming the applicable-devices endpoint (still TBD) uses the same `/deviceManagement/reports/` namespace as the alerts endpoint did, not the `/admin/windows/updates/` one. Confirm during step 3 above.

## Page Layout Changes

### DriverDetailDrawer — new "Devices" section

Slots between "Policies" and "Catalog details" sections (or as a tab, see below). Renders only when the audience mapping resolves successfully.

#### Default render (loading)

> "Loading device list…" with a spinner.

#### Loaded with data

A scrollable list, one row per device. Per row:

| Field | Source |
|---|---|
| Device name | `managedDevice.deviceName` |
| Model | `managedDevice.model` (or fallback to `manufacturer + model`) |
| OS | `managedDevice.osVersion` |
| Last check-in | `managedDevice.lastSyncDateTime` (relative format) |
| Status | From `matchedDevices` if present (Offered / Installed / Error / Paused), otherwise omitted |

Sort: most-recently-checked-in first.

Pagination: render the first 100, with a "Load more devices" button at the bottom that fetches the next continuation page. Don't load all pages eagerly — could be thousands.

#### Loaded with no data

> "No devices currently need this driver."

#### Failed to load

> "Could not load device list. The audience mapping for this profile may not be available." with a "Retry" button.

#### Tab vs section?

**Recommendation: tab.** Add tabs at the top of the drawer (`Overview` / `Devices`), with Overview as default (showing v1's existing content). The device list is potentially long; making it a separate tab keeps the drawer fast for users who only want the metadata. Keeps Catalog Details and Lookup in the Overview tab.

If we keep it as a section instead, the drawer becomes very long for drivers with many devices. Tabs win.

## Data Fetching

### Issues tab (proven, ready to implement)

```http
POST /beta/deviceManagement/reports/getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport
Content-Type: application/json

{
  "filter": "PolicyId eq '{profileId}'",
  "skip": 0,
  "top": 50
}
```

Response shape (confirmed empirically):

```json
{
  "SessionId": "...",
  "TotalRowCount": 0,
  "Schema": [ ... ],
  "Values": [ /* rows matching Schema column order */ ]
}
```

Note the response uses a **Schema + Values column-store shape**, not a standard OData `value: [{...}]` array. The renderer must zip Schema with Values to get usable row objects.

Pagination via `skip` / `top`. Cache per `profileId` for the session.

**Filter to a single driver**: the report does not appear to support a `DriverName eq '...'` filter (untested but typical of these endpoints). The drawer will likely need to fetch ALL alerts for the policy, then filter client-side by `DriverName` matching the currently-viewed driver. Acceptable since alert counts are typically small.

### Devices tab (endpoint TBD — Issues tab can ship first)

Same shape as above is expected, just a different endpoint name. Implementation deferred until F12 investigation reveals the exact endpoint (see "Open Investigation Items" → #3).

### Device metadata join

For each `IntuneDeviceId` from the report, look up via existing `useManagedDevices` cache. If not in cache, fetch `managedDevices/{id}?$select=deviceName,model,manufacturer,osVersion,lastSyncDateTime`. Batch up to 20 per request via `$batch`.

The report already includes `DeviceName`, `UPN`, `IntuneDeviceId` — so even without the metadata join we can render a usable list. The join adds model + OS + last check-in.

## Hooks

| Hook | Purpose | Endpoint dependency |
|---|---|---|
| `useDriverAlerts(profileId)` | Fetch the alerts report for a policy, normalize Schema+Values into row objects | ✅ Known: `getWindowsDriverUpdateAlertsPerPolicyPerDeviceReport` |
| `useDriverApplicableDevices(profileId)` | Fetch the applicable-devices report | ⏳ Endpoint TBD |
| `useDriverDeviceMetadata(intuneDeviceIds)` | Batch resolve managedDevices metadata | ✅ Existing pattern |

All hooks are session-cached. None of them fire until the drawer is opened — keep the page snappy.

## File Structure

| File | Status | Purpose |
|---|---|---|
| `src/types/drivers.ts` | Modify | Add `DriverAlert`, `DriverDevice` (joined) interfaces |
| `src/hooks/useDriverAlerts.ts` | Create | Issues report fetch + Schema/Values normalization |
| `src/hooks/useDriverApplicableDevices.ts` | Create (later) | Applicable-devices report fetch (when endpoint known) |
| `src/hooks/useDriverDeviceMetadata.ts` | Create | Batch resolve managedDevices metadata |
| `src/components/drivers/DriverIssuesTab.tsx` | Create | The Issues tab content |
| `src/components/drivers/DriverDevicesTab.tsx` | Create (later) | The Devices tab content |
| `src/components/drivers/DriverDetailDrawer.tsx` | Modify | Wrap existing content in tabs (Overview / Issues / Devices) |

No changes to `src/services/authConfig.ts` expected — existing v1 scopes were sufficient for the proven endpoint.

## Error Handling

- **Issues report returns empty**: show "No issues reported for devices using this driver." Useful, positive signal.
- **Issues report fails**: inline error in the Issues tab; Overview tab unaffected.
- **IntuneDeviceId metadata resolution fails**: fall back to showing the report's own DeviceName / UPN columns. The list still renders, just without model/OS enrichment.
- **Schema mismatch (Microsoft changes report schema)**: log a console warning, render best-effort rows by index, surface a small "Some columns may not display correctly" note.

## Permissions

**No new permissions required** for the proven (Issues) endpoint. Verified empirically on 2026-05-15 — the existing v1 scopes (`DeviceManagementConfiguration.Read.All`, `DeviceManagementManagedDevices.Read.All`, `DeviceManagementApps.Read.All`) returned 200.

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

- **Reports API is beta-shaped.** The Schema+Values column-store response shape is unusual for Graph and might evolve. We isolate the normalization in one place (`useDriverAlerts`) to limit blast radius if it changes.
- **DriverName client-side filtering can be fragile.** If `DriverName` strings don't match exactly between `driverInventories` (v1) and the alerts report, filtering to "alerts for this specific driver" breaks. Risk-mitigated by normalizing/lowercasing on both sides.
- **The Devices tab is the user's actual ask, and it's still blocked.** Shipping only the Issues tab means we technically resolve a smaller problem than the user originally raised. Should be communicated clearly when v1.1 ships.

## Implementation Plan

The Issues tab is implementable today. A short plan (TDD, subagent-driven, same discipline as v1) can be written immediately when the user is ready.

The Devices tab is gated on F12 investigation (Open Item #3). If that investigation is done in the same session, the plan can cover both tabs; otherwise v1.1 ships Issues only and Devices follows as v1.2.
