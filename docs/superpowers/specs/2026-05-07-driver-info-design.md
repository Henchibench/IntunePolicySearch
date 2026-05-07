# Driver Info — Design Spec

## Goal

A dedicated `/drivers` page that surfaces every Windows driver update across the tenant's WUfB Driver Update profiles, enriched with metadata from Dell's driver catalog (criticality, fixes, known issues, supported hardware). Solves two gaps in the Intune portal:

1. The portal lists drivers with sparse metadata — no fixes, no criticality from the OEM, no known issues, no link to release notes. Approving drivers manually becomes detective work on Dell's site.
2. The portal shows aggregate device counts per driver, but no list of *which* devices need a given update. (Per-device drill-down is deferred to v1.1; v1 surfaces the count only.)

Read-only. First version focuses on Dell + Windows + WUfB Driver Updates.

## Architecture

Driver-centric main view. Two data paths feed it:

1. **Microsoft Graph (always available)** — driver profiles, driver inventories per profile, and managed-device metadata. Fetched live, no cache beyond session-scoped `Map`s. Same pattern as the existing Audit page.
2. **Dell driver catalog (best-effort, layered)** — a baked snapshot ships in the repo (`public/driver-catalog.json`), generated from `downloads.dell.com/catalog/CatalogPC.cab` by a build-time script. In Electron mode, an additional on-demand sync writes a fresher catalog to `userData/driver-catalog/dell.json`, which overrides the baked snapshot when present.

Resolution order in the renderer:

```
1. Electron AND local synced file exists  → userData/driver-catalog/dell.json
2. Otherwise                              → /driver-catalog.json (baked)
3. Otherwise (rare)                       → no enrichment, criticality column blank
```

Renderer code calls `useDriverCatalog()` and gets the same shape regardless of source.

**Permissions** (already granted):
- `DeviceManagementConfiguration.Read.All` — driver update profiles + driver inventories
- `DeviceManagementManagedDevices.Read.All` — managed-device metadata for device-name resolution

**Graceful degradation:** Web mode loses the manual sync button but keeps the baked enrichment. Drivers that don't match the Dell catalog (non-Dell, or Dell drivers outside the catalog's scope) still render in the table with empty enrichment fields and a "No catalog data" note in the drawer.

## Page Layout

Top to bottom:

1. **PillNav** — updated to include `Drivers` between `Audit` and `Groups`
2. **UtilityRow** — unchanged
3. **Page heading** — h1 "Driver Updates" with the sync status row aligned right
4. **Filter bar** — manufacturer / driver class / approval / criticality / "affects devices" toggle / free text
5. **Pivot tabs** — `All Drivers` (default) | `By Policy`
6. **Results area** — flat table or grouped sections depending on pivot
7. **Detail drawer** — slides out on row click

## Filter Bar

Six controls, AND between them:

| Control | Type | Source | Server vs client |
|---|---|---|---|
| Manufacturer | Multi-select | Distinct `manufacturer` values from fetched inventories | Client |
| Driver class | Multi-select | Distinct `driverClass` values | Client |
| Approval status | Multi-select | Enum: `needsReview`, `approved`, `declined`, `suspended` | Client |
| Criticality (Dell) | Multi-select | Catalog values: `Urgent`, `Recommended`, `Optional`, `Other`. Disabled with tooltip when no catalog data | Client |
| Affects devices | Pill toggle | Filters to `applicableDeviceCount > 0` | Client |
| Free text | Search input | Matches `name`, `version`, `manufacturer`, `driverClass` | Client |

All filtering is client-side. Profiles + inventories are fetched once on mount; filter bar operates on the in-memory dataset, identical to the Audit page's actor/free-text filter pattern.

**Defaults**: all approval statuses visible, "Affects devices" toggle **on**, criticality unfiltered.

## Sync Status Row

Top-right of the page, beside the h1.

| State | Display |
|---|---|
| Electron, synced recently | `🟢 Catalog synced {relative} · [Sync]` (ghost button) |
| Electron, never synced or >30d old | `🟡 Catalog not synced · [Sync now]` (primary button) |
| Electron, last sync failed | `🔴 Last sync failed · [Retry]` (tooltip with error message) |
| Electron, sync in progress | `⟳ Syncing catalog… {bytesReceived} MB` (with progress bar if `content-length` available) |
| Web mode (no `__IS_ELECTRON__`) | Row hidden entirely |

Sync in v1 is **manual**. No auto-sync on app start, no scheduled refresh.

## Data Fetching

### Profiles

```http
GET /deviceManagement/windowsDriverUpdateProfiles
```

Returns all WUfB driver update profiles. Per profile: `id`, `displayName`, `approvalType` (`manual` | `automatic`), `inventorySyncStatus`, plus standard timestamps.

### Driver inventories

```http
GET /deviceManagement/windowsDriverUpdateProfiles/{policyId}/driverInventories
```

Per driver: `id`, `name`, `version`, `manufacturer`, `driverClass`, `releaseDateTime`, `approvalStatus`, `category`, `applicableDeviceCount`, `deviceCount`. Paginate via `@odata.nextLink`. Fan out across all profiles in parallel.

### Per-device status (deferred)

The per-device-per-driver list requires `POST /deviceManagement/reports/getCachedReport`. The exact `name` parameter for the Windows Driver Updates report is not enumerated in the public Graph reports reference; it must be sniffed from the Intune portal during implementation (typical names follow patterns like `WindowsDriverUpdates` or `DriverUpdateDeviceStatus`). The cached-report flow can also return 202 + polling, which is more complex than anything in the existing codebase.

**Out of v1 scope.** v1 displays only `applicableDeviceCount` from `driverInventories` as a number. v1.1 introduces the per-device drill-down once the report API behavior is verified against a real tenant.

### Managed device resolution

Reuse the existing `useManagedDevices` hook. Used by v1.1's per-device list; in v1 it's not strictly required, but the device count badge is link-ready.

### Catalog

`useDriverCatalog()` returns:
```ts
{
  entries: Map<DriverKey, CatalogEntry>;
  lastSyncedAt: string | null;
  source: 'electron-sync' | 'baked' | 'none';
  isLoading: boolean;
  sync: () => Promise<void>;        // no-op in web mode
  syncStatus: 'idle' | 'syncing' | 'error';
}
```

Internally:
1. If `window.__IS_ELECTRON__` and `window.driverCatalog.getStatus()` reports a synced file → load via `window.driverCatalog.getEntries()`
2. Otherwise `fetch('/driver-catalog.json')` (the baked snapshot)
3. Build the lookup `Map` keyed by `DriverKey`

**`DriverKey`** is a normalized lowercase string: `"${manufacturer}|${driverClass}|${name}".toLowerCase().replace(/\s+/g, ' ').trim()`. Matching between Graph driver inventories and Dell catalog entries is **best-effort** — naming isn't always identical. Unmatched drivers render with empty enrichment fields, and the renderer logs miss-rate to console for diagnostics. Not a blocker; the catalog is enrichment, not authoritative data.

### Fetch orchestration

On page mount (when authenticated):

1. Fetch `windowsDriverUpdateProfiles` → fan-out per profile
2. For each profile: fetch `driverInventories` (paginated)
3. In parallel: load the driver catalog
4. When all queries resolve → build the flat `Driver[]` array, joining inventories with catalog entries via `DriverKey`

TanStack Query is already used in the app; each resource gets its own hook (`useDriverProfiles`, `useDriverInventories`, `useDriverCatalog`), and `useDrivers()` composes them.

## Main View

### "All Drivers" pivot (default)

Flat row per driver-version. If the same `manufacturer | driverClass | name | version` appears in multiple profiles, rows are merged with a "**N policies**" pill — without merging, the list would be visually duplicated.

| Column | Source | Notes |
|---|---|---|
| ⚠️ | Catalog: `criticality` | Colored icon: red Urgent / amber Recommended / slate Optional. Empty if no catalog match. |
| Driver | `name` | Primary text. `manufacturer · driverClass` underneath, muted. |
| Version | `version` | Tabular-nums. |
| Released | `releaseDateTime` | Relative ("3w ago", "2mo ago"). Tooltip with full date. |
| Approval | `approvalStatus` | Badge: needsReview (amber), approved (emerald), declined (slate), suspended (muted). |
| Devices | `applicableDeviceCount` | Tabular-nums. Not clickable in v1. |
| Policies | Count of profiles containing the driver | Pill. Hover popover: list of `policy name + per-policy approval badge` rows. |

Click on a row → opens the drawer.

**Sorting**: default `releaseDateTime desc`. Column headers sortable. The ⚠️ column sorts Urgent → Recommended → Optional → no-data.

**Empty states**:
- Filtered to nothing: "No drivers match the current filters." + "Clear filters" link.
- Tenant has no WUfB profiles: "No Windows Driver Update profiles found in this tenant." + outlink to the Intune portal's "Create profile" view.

### "By Policy" pivot

Same data grouped by profile. Group header per policy:
- Policy name + approval-type badge (`Manual` / `Automatic`)
- Aggregate line: `12 drivers · 5 needs review · 348 devices applicable`
- Sort order: most-`needsReview` first (action-oriented)

Expand (collapsible chevron, same pattern as `AuditByResource`) → same columns as the flat table minus the "Policies" pill.

## Detail Drawer

Opens on row click. Same `Sheet`/`SheetContent` component as `AuditDetailDrawer`, `sm:max-w-2xl`.

### Header

- **Title**: driver `name`
- **Subtitle**: `manufacturer · driverClass · version`
- **Badges row**: criticality (when catalog data exists), approval status (when single policy) or "In N policies" (when multiple)

### Section: Overview

EyebrowLabel `OVERVIEW`. Two-column key/value:

| Left | Right |
|---|---|
| Released | Full date + relative |
| Driver class | `driverClass` |
| Manufacturer | `manufacturer` |
| Applicable devices | `applicableDeviceCount` (number, no drill-down in v1) |

### Section: Policies

EyebrowLabel `POLICIES`. One row per profile containing the driver:
- Policy name (visual only — no navigation in v1)
- Per-policy approval badge (the same driver can be `approved` in ring 1 and `needsReview` in ring 2)
- Approval-type label (`Manual` / `Automatic`) as muted text
- Date the driver entered the profile (if Graph exposes it)

This section is what makes "approved in one ring, pending in another" visible — something the Intune portal hides.

### Section: Catalog details

EyebrowLabel `DETAILS FROM DELL CATALOG`. Renders **only** when there's a catalog match. All sub-fields optional — only those present from the catalog render:

- **Criticality** — large badge (Urgent / Recommended / Optional)
- **Fixes / Enhancements** — bullet list from catalog release-notes snippet
- **Known issues** — bullet list from catalog `<Issues>` nodes (Dell often includes these)
- **Supported hardware** — collapsible list of Dell models the driver applies to (same `ScriptContentSection` pattern)
- **Operating systems** — badges for applicable OS (Win10 22H2, Win11 23H2, etc.)
- **Release notes link** — outlink to Dell's official page (`shell.openExternal` in Electron, new tab in web)

### Section: External lookups

EyebrowLabel `LOOKUP`. Always rendered, regardless of catalog match. Two outlink buttons:

- **Search Dell support** — `https://www.dell.com/support/search/...?q={driver name}` with the driver name pre-filled
- **Search Microsoft Update Catalog** — `https://www.catalog.update.microsoft.com/Search.aspx?q={driver name}`

Valuable even when the Dell catalog doesn't match — admin gets a one-click jump to lookup tools.

### Footer

"Raw JSON" toggle at the bottom (same pattern as `AuditDetailDrawer`). Shows the raw `driverInventory` object plus the matched `catalogEntry` if any.

### No catalog data

If the driver doesn't match any catalog entry, the "Catalog details" section is replaced by a single muted line:

> No catalog data for this driver. Use the links below to look up release notes externally.

The "External lookups" section still renders.

## Catalog Sync — Plumbing

### Build-time script

`scripts/fetch-driver-catalog.ts`:

1. Download `https://downloads.dell.com/catalog/CatalogPC.cab` via `node:https`
2. Extract CAB with the `cab` Node package (single-file extractor, no native build required)
3. Parse the embedded `CatalogPC.xml` (UTF-16 LE) with `fast-xml-parser`
4. Normalize to a flat `CatalogEntry[]` with only the fields the UI consumes
5. Write `public/driver-catalog.json` and `public/driver-catalog.meta.json`

Run manually via `npm run fetch-catalog`. **Not** wired into `vite build` or `npm run dev` — keeps clones and dev starts fast, and treats catalog refreshes as deliberate commits.

If Dell is unreachable during fetch: script exits non-zero, leaves the previous file untouched.

### Electron main process

`electron-app/driver-catalog.ts`:

- IPC handlers:
  - `driver-catalog:get-status` → `{ lastSyncedAt: string | null, entryCount: number, source: 'synced' | 'baked' | 'none' }`
  - `driver-catalog:get-entries` → `CatalogEntry[]`
  - `driver-catalog:sync` → downloads, extracts, normalizes, writes to `app.getPath('userData')/driver-catalog/dell.json` and `meta.json`. Returns final status. Emits progress via `webContents.send('driver-catalog:sync-progress', { bytesReceived, totalBytes })`.

The normalization logic is shared between the build script and Electron via `scripts/lib/dell-catalog-normalize.ts`, imported from both sides.

### Preload bridge

`electron-app/preload.ts` extended:

```ts
contextBridge.exposeInMainWorld('driverCatalog', {
  getStatus: () => ipcRenderer.invoke('driver-catalog:get-status'),
  getEntries: () => ipcRenderer.invoke('driver-catalog:get-entries'),
  sync: () => ipcRenderer.invoke('driver-catalog:sync'),
  onSyncProgress: (cb: (data: { bytesReceived: number; totalBytes: number }) => void) =>
    ipcRenderer.on('driver-catalog:sync-progress', (_e, data) => cb(data)),
});
```

### Renderer hook

`src/hooks/useDriverCatalog.ts` does the source resolution above and exposes the unified hook signature.

## File Structure

| File | Purpose |
|---|---|
| `src/pages/Drivers.tsx` | Page component: filter state, pivot orchestration |
| `src/hooks/useDriverProfiles.ts` | Fetch WUfB driver update profiles |
| `src/hooks/useDriverInventories.ts` | Fan-out fetch of inventories per profile |
| `src/hooks/useDriverCatalog.ts` | Resolves baked vs Electron-synced source, exposes lookup Map |
| `src/hooks/useDrivers.ts` | Composes profiles + inventories + catalog into `Driver[]` |
| `src/components/drivers/DriverFilterBar.tsx` | Filter controls |
| `src/components/drivers/DriverTable.tsx` | All Drivers flat table |
| `src/components/drivers/DriverByPolicy.tsx` | By Policy grouped pivot |
| `src/components/drivers/DriverDetailDrawer.tsx` | Drawer (overview, policies, catalog, lookup) |
| `src/components/drivers/CatalogSyncStatus.tsx` | Sync status row + button |
| `src/components/drivers/DriverCriticalityBadge.tsx` | Criticality icon/badge |
| `src/types/drivers.ts` | `Driver`, `DriverProfile`, `DriverInventory`, `CatalogEntry`, `DriverKey` |
| `scripts/fetch-driver-catalog.ts` | Build-time normalize → `public/driver-catalog.json` |
| `scripts/lib/dell-catalog-normalize.ts` | Shared normalization (used by script + Electron) |
| `electron-app/driver-catalog.ts` | IPC handlers for sync/get/status |
| `electron-app/preload.ts` | Extended with `driverCatalog` bridge |
| `public/driver-catalog.json` | Baked snapshot, committed to repo |
| `public/driver-catalog.meta.json` | `{ lastBaked, entryCount, catalogSource: 'CatalogPC.cab' }` |

## Navigation

`PillNav` adds `Drivers` between `Audit` and `Groups`. New route in `App.tsx`: `/drivers` → `Drivers` page component.

## Styling

Follows `DESIGN.md` and matches the Audit / GroupLookup conventions:

- `bg-canvas`, `text-ink`, `text-slate` for base
- `EyebrowLabel` for section headers (POLICIES, CATALOG DETAILS, LOOKUP)
- `EditorialCard` for the table container
- Criticality colors: `text-red-500` (Urgent), `text-amber-500` (Recommended), `text-slate-400` (Optional)
- Approval badges: `needsReview` amber, `approved` emerald, `declined` slate, `suspended` muted
- Drawer: `sm:max-w-2xl`
- Sync status row: `text-xs text-slate` with inline icons
- Tabular-nums on Version, Released, Devices columns

## Error Handling

| Failure | Behavior |
|---|---|
| Profiles fetch fails | Inline error banner in results area (no toast). "Failed to load driver update profiles. [Retry]" |
| Inventories fetch fails for one profile | Render other profiles; show per-profile "Failed to load drivers" in By Policy pivot |
| Catalog fetch fails (web) | Criticality column empty + non-blocking warning row "Could not load driver catalog" |
| Sync fails (Electron) | Red status row, tooltip with error, retain previous synced data |
| Tenant has no WUfB profiles | Helpful empty state with outlink to Intune portal |
| Driver has no catalog match | Empty enrichment fields, "No catalog data" line in drawer (silent in table) |

## Scope Boundaries

**In scope (v1):**
- Driver-centric list across all WUfB profiles
- All Drivers + By Policy pivots
- Filter, sort, free-text search
- Drawer with metadata, policies list, catalog enrichment, external lookup links
- Manual sync in Electron, baked snapshot for web
- Dell catalog as the only enrichment source
- Read-only

**Out of scope (deferred):**
- Per-device list with `getCachedReport` → **v1.1**
- Approve / decline / suspend actions → later
- Auto-sync in Electron (e.g., on app start if >Nd old) → v1.1
- Lenovo / HP / Microsoft catalog sources → v2. The architecture leaves room: `useDriverCatalog` can merge multiple catalog sources, `DriverKey` matches across manufacturers, the build script can take multiple inputs.
- Notifications for new `needsReview` drivers → later
- CSV export → later
- Replacing the Intune portal driver view — this builds *alongside*, not instead of

## Risks

- **Per-device report API name** is not enumerated in public Graph reports docs. v1 sidesteps it by deferring per-device drill-down to v1.1. When v1.1 is built, the report name must be confirmed by sniffing the Intune portal's network traffic against a real tenant.
- **`DriverKey` matching is approximate.** Dell catalog naming and Graph driver inventory naming aren't perfectly aligned. Some drivers will lack enrichment even with the catalog loaded. Acceptable for a best-effort enrichment layer; renderer logs miss-rate to console for tuning.
- **Catalog file size.** The normalized JSON is expected at 10–25 MB. Lazy-loaded on the `/drivers` page (not at app start). If it ever becomes a problem, splitting per manufacturer or per driver class is a backwards-compatible follow-up.
- **CAB extraction in CI.** Node CAB libraries are less battle-tested than mainstream Node modules. The build script must handle extraction failures gracefully (exit non-zero, leave previous snapshot in place).
