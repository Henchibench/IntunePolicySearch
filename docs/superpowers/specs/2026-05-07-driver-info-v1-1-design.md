# Driver Info v1.1 — Per-Device Drilldown Design Spec

## Goal

Add a "Devices" section to the driver detail drawer that lists *which* managed devices need or have a given driver — not just the aggregate count that v1 surfaces. Solves the gap a user immediately notices: "Intune tells me 348 devices need this update, but doesn't tell me which 348."

Read-only. Builds on v1; doesn't redesign it.

## What Changed Since the v1 Plan

The v1 spec called out per-device drilldown as out-of-scope and pointed at `POST /deviceManagement/reports/getCachedReport` as the future implementation path. **That was the wrong API to plan around.** During v1.1 brainstorming we found a cleaner, OData-native path:

```http
GET /beta/admin/windows/updates/deploymentAudiences/{audienceId}/applicableContent
  ?$expand=catalogEntry,matchedDevices
```

This is part of the **Windows Update for Business deployment service** API (separate namespace from `/deviceManagement/windowsDriverUpdateProfiles/`). It returns driver/firmware catalog entries with a `matchedDevices` navigation property that lists exactly which Microsoft Entra devices match each entry. No 202+polling, just standard OData expand + continuation token pagination.

Source: [Deploy a driver update using Windows Autopatch — step 5](https://learn.microsoft.com/graph/windowsupdates-manage-driver-update#step-5-get-inventory-of-driver-updates).

This v1.1 spec replaces the v1 spec's "deferred to v1.1" note about `getCachedReport`. We will **not** use `getCachedReport`.

## Architecture

### Data flow

```
v1 (already shipped):
  windowsDriverUpdateProfiles → driverInventories (per profile)
                              → applicableDeviceCount (number only)

v1.1 (this spec):
  windowsDriverUpdateProfiles → deploymentAudiences (NEW: mapping)
                              → applicableContent?$expand=catalogEntry,matchedDevices
                              → matchedDevices[]
                              → managedDevices/{id} (resolve to friendly metadata)
```

### Three new pieces

1. **Profile → Audience mapping.** `windowsDriverUpdateProfile` and `deploymentAudience` are separate resources in different Graph namespaces. We need to determine the correspondence — how to find the audience ID for a given driver update profile.

2. **`applicableContent` fetch + per-driver `matchedDevices` drill-down.** Lazy: only fired when the user opens the drawer for a specific driver, not on page load. Avoids hitting the API for drivers the user never inspects.

3. **Device metadata join.** `matchedDevices` returns Entra device IDs. We resolve to friendly fields (name, model, OS, last check-in) via the existing `useManagedDevices` hook + `managedDevices/{id}`.

## Open Investigation Items

Three things must be answered against a real tenant before implementation can finalize. Best done by sniffing the Intune portal's network traffic in F12 + a quick Graph Explorer test.

### 1. How does a `windowsDriverUpdateProfile` map to a `deploymentAudience`?

Possibilities, in order of likelihood:

- **Direct property.** The profile resource has an undocumented or beta-only `deploymentAudienceId` field.
- **Implicit by ID equality.** `windowsDriverUpdateProfile.id` IS the audience ID, and the resources are two views of the same underlying entity.
- **Match via assignments.** Both share the same target group assignments, so we look up the audience whose assignments match the profile's.
- **Separate mapping API.** A `/beta/admin/windows/updates/...` endpoint surfaces the relationship.

**Verification step:** Open Intune portal → Driver Updates → click into a profile while F12 is recording. Look for any request to `/admin/windows/updates/deploymentAudiences`. The response (or the URL) should reveal the mapping.

### 2. What does `matchedDevices` actually return?

The docs say "Microsoft Entra devices that are applicable for each driver." Per device we need at least one of: `azureADDeviceId`, `intuneDeviceId`, `id`. Plus ideally: status (offered / installed / declined / error), last contact time.

If `matchedDevices` only returns IDs, we do the resolve via `managedDevices`. If it includes status + check-in we can render those directly without an extra fetch.

**Verification step:** `GET /beta/admin/windows/updates/deploymentAudiences/{id}/applicableContent/{contentId}/matchedDevices` against a known audience. Inspect the response shape.

### 3. Required permissions

The `/admin/windows/updates/` namespace is gated by `WindowsUpdates.Read.All` or `WindowsUpdates.ReadWrite.All`. Currently the app registration only has Intune permissions (`DeviceManagementConfiguration.Read.All`, `DeviceManagementManagedDevices.Read.All`, `DeviceManagementApps.Read.All`).

**Action:** Extend the app registration with `WindowsUpdates.Read.All` (delegated). Re-grant admin consent. Update `src/services/authConfig.ts` to request the new scope.

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

### Resolve audience mapping (one-time, on drawer open)

Pseudo-code:

```ts
async function resolveAudienceId(profileId: string): Promise<string | null> {
  // Strategy depends on the answer to investigation item #1.
  // Most likely: profile.id === audience.id, in which case this is a no-op.
  // Otherwise: GET /beta/admin/windows/updates/deploymentAudiences and search
  //            for the one matching profile by name / assignments.
}
```

Cached in a Map keyed by `profileId` for the session. Drawer opens for the same profile multiple times never re-resolve.

### Fetch applicable content + matched devices

```http
GET /beta/admin/windows/updates/deploymentAudiences/{audienceId}/applicableContent/{driverContentId}/matchedDevices?$top=100
```

`driverContentId` comes from the `applicableContent` collection — that's a separate query first time we open the drawer for any driver in this audience. Cache the (audience → applicableContent[]) lookup once per audience.

### Resolve device metadata

For each `matchedDevices` entry, look up via existing `useManagedDevices` cache. If not in cache, fetch `managedDevices/{id}?$select=deviceName,model,manufacturer,osVersion,lastSyncDateTime`. Batch up to 20 per request via `$batch` to avoid one-at-a-time round trips.

## Hooks

| Hook | Purpose |
|---|---|
| `useDriverAudiences()` | Fetch all `deploymentAudiences` once, builds a profile-id → audience-id Map (strategy depends on investigation #1) |
| `useDriverApplicableContent(audienceId)` | Fetch `applicableContent` for an audience; returns the per-driver content IDs |
| `useDriverMatchedDevices(audienceId, driverContentId)` | Fetch `matchedDevices` paginated; returns devices + continuation token |
| `useDriverDeviceMetadata(deviceIds)` | Resolves device metadata via batch managedDevices fetch |

All hooks are session-cached. None of them fire until the drawer is opened — keep the page snappy.

## File Structure

| File | Status | Purpose |
|---|---|---|
| `src/types/drivers.ts` | Modify | Add `MatchedDevice`, `DeploymentAudience`, `DriverDevice` (joined) interfaces |
| `src/hooks/useDriverAudiences.ts` | Create | Audience mapping |
| `src/hooks/useDriverApplicableContent.ts` | Create | Applicable content per audience |
| `src/hooks/useDriverMatchedDevices.ts` | Create | Per-driver device list with pagination |
| `src/hooks/useDriverDeviceMetadata.ts` | Create | Batch resolve device metadata |
| `src/components/drivers/DriverDevicesSection.tsx` | Create | The new "Devices" tab content |
| `src/components/drivers/DriverDetailDrawer.tsx` | Modify | Wrap existing content in tabs, add Devices tab |
| `src/services/authConfig.ts` | Modify | Add `WindowsUpdates.Read.All` scope |
| `docs/Entra-Setup-Guide.md` | Modify | Document the new permission requirement |

## Error Handling

- **Audience mapping fails** (no audience found for profile): drawer shows "Device list not available for this profile" — graceful degradation. Overview tab still works fully.
- **Permission denied** (e.g., `WindowsUpdates.Read.All` not granted yet): show a one-time admin warning at the top of the page: "Driver device drilldown requires the WindowsUpdates.Read.All permission. [Setup guide]" with link to docs.
- **Empty `matchedDevices`**: show "No devices currently need this driver." instead of an empty list.
- **Per-device metadata resolution fails**: fall back to showing the raw Entra device ID. The list still renders.
- **Continuation token fetch fails**: show partial list + "Failed to load more devices" inline.

## Permissions

Adds: `WindowsUpdates.Read.All` (delegated)

Documented in updated `docs/Entra-Setup-Guide.md` with screenshots of how to grant it.

## Scope Boundaries

**In scope (v1.1):**
- Audience mapping investigation + implementation
- Per-driver device list in the drawer
- Device metadata resolution (name, model, OS, last sync)
- Pagination via continuation tokens
- Tab layout in drawer
- New permission scope wired up

**Out of scope (deferred):**
- Bulk approve/decline from the device list (still read-only)
- Filter/search within the device list (e.g., by model). Add later if list size warrants it.
- Push notification when a device's status changes
- Cross-driver views ("show me all drivers that affect device X") — that's a different IA, plausibly v1.2
- Lenovo / HP / Microsoft catalog enrichment (still v2)
- The `getCachedReport` fallback path for legacy tenants — assume the deployment service API is universally available; revisit only if a tenant reports unsupported

## Risks

- **Audience mapping might not be 1:1.** If a single profile maps to multiple audiences (e.g., Intune fans out by platform/version), we'd need to query multiple audiences and merge. Investigation step #1 should reveal this.
- **`/admin/windows/updates/` is beta and evolving.** Breaking changes possible. We accept that risk because the alternative (`getCachedReport`) is worse.
- **Device list size for popular drivers.** A common driver could match thousands of devices. Pagination is mandatory; the UI must not try to render them all at once.
- **Permission granting friction.** Asking the admin to add a new scope after v1 already shipped is real friction. Consider bundling into a "what's new" notice or onboarding refresh.

## Implementation Plan

To be written after the open investigation items are answered. The plan will include the same TDD discipline, file-per-task decomposition, and subagent-driven execution we used for v1.

The investigation items above are the prerequisite — without them, the plan would be writing against guesses. Recommended: a 30-minute exploration session against the user's tenant to nail down questions 1 and 2, then the plan writes itself.
