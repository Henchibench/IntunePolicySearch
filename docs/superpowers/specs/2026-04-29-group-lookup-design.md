# Group Lookup — Design Spec

**Status:** Approved for implementation
**Date:** 2026-04-29
**Author:** Henrik Söderström (with Claude)

## 1. Goal

Add a feature that lets an Intune admin pick an Entra (Microsoft Entra ID) group and see every Intune object — policies, apps, security configurations, scripts, enrollment configurations, etc. — assigned to that group, including assignments inherited via transitive parent-group membership. Results are presented as a single sortable, filterable data table behind a summary view, with a side drawer for object detail.

## 2. User flow

1. User clicks **Group Lookup** in the top nav, lands on `/groups`.
2. Types in the search box; debounced typeahead queries Microsoft Graph and returns up to 10 group matches.
3. User selects a group.
4. Page enters a loading state showing 13 categories of Intune objects with per-category progress.
5. As each category completes, its results stream into the data table.
6. User filters/sorts/saves views, clicks any row to open a side drawer with full object detail.
7. User can pick a different group at any time; in-flight requests are cancelled.

## 3. Scope

**In scope (v1):**

- Group selection via Entra typeahead (`/groups` filter on `displayName`).
- Direct assignments to the selected group **and** transitive parent-group assignments, labeled by source.
- Both `include` and `exclude` intents shown with visual distinction.
- 13 Intune object categories (see Section 6.2).
- Summary header → data table (sortable, multi-select column filters, free-text name search, saved filter views in `localStorage`).
- Side drawer detail; reuses existing `PolicyCard` for the four legacy object types.
- Per-category progress animation with live counts.
- On-demand fetch per group selection (no tenant-wide cross-search caching).

**Out of scope (v1, explicit non-goals):**

- Export (CSV/JSON).
- Reverse lookup ("which groups is this user/device a member of and what does that mean?").
- Transitive *child* group expansion (only parent direction).
- Persistence of fetched data across navigations.
- Any write actions (assigning, editing, removing).
- Tenant-level pre-cache of all assignments at app start.

## 4. Architecture

### 4.1 New surfaces

```
src/pages/
  GroupLookup.tsx              # /groups page

src/components/group/
  GroupSearchBox.tsx           # debounced Entra typeahead
  ResultsSummary.tsx           # selected group + parent lineage + count chips
  CategoryProgressList.tsx     # animated per-category status grid
  ResultsTable.tsx             # TanStack-Table-backed data table
  ResultsDetailDrawer.tsx      # shadcn Sheet drawer
  GroupTypeBadge.tsx           # color-coded category badge

src/hooks/
  useEntraGroupSearch.ts       # 250ms debounced search hook
  useGroupAssignments.ts       # streams orchestrator state to UI

src/services/
  groupAssignmentService.ts    # parallel Graph fan-out orchestrator
```

### 4.2 Existing surfaces touched

- `src/App.tsx` — register `/groups` route.
- `src/components/Header.tsx` — add nav link.
- `src/types/graph.ts` — add new type definitions (Section 5).
- `package.json` — add `@tanstack/react-table` dependency.

`graphService.ts` is **not modified**. The new feature is fully self-contained in its own service to avoid regressions on the existing search and dashboard pages.

### 4.3 Data flow

```
GroupSearchBox ──(groupId)──▶ useGroupAssignments
                                    │
                                    ▼
                       groupAssignmentService.fetchGroupAssignments
                                    │
                  ┌─────────────────┼─────────────────────┐
                  ▼                 ▼                     ▼
        resolve target group   transitiveMemberOf   13 parallel category fetches
        (display name)         (parent groups)      (Promise.allSettled)
                                                          │
                                            onCategoryStatus / onResults
                                                          │
                                                          ▼
                                            useGroupAssignments state
                                                          │
                            ┌─────────────────────────────┼─────────────────────┐
                            ▼                             ▼                     ▼
                     ResultsSummary             CategoryProgressList    ResultsTable
                                                                              │
                                                                              ▼
                                                                    ResultsDetailDrawer
```

## 5. Data model

New types in `src/types/graph.ts`:

```ts
export type IntuneObjectCategory =
  | 'deviceConfiguration'
  | 'compliancePolicy'
  | 'configurationPolicy'      // Settings Catalog
  | 'appProtection'
  | 'mobileApp'
  | 'appConfiguration'
  | 'endpointSecurity'         // intents
  | 'platformScript'           // deviceManagementScripts
  | 'remediationScript'        // deviceHealthScripts
  | 'complianceScript'         // deviceComplianceScripts
  | 'autopilotProfile'
  | 'enrollmentConfig'
  | 'updateRing';              // Windows update profiles

export interface GroupAssignmentSource {
  kind: 'direct' | 'parent';
  groupId?: string;            // populated when kind === 'parent'
  groupName?: string;          // populated when kind === 'parent'
}

export interface GroupAssignmentFilter {
  id: string;
  displayName?: string;        // resolved at end of fetch
  mode: 'include' | 'exclude';
}

export interface GroupAssignmentResult {
  id: string;                  // intune object id
  category: IntuneObjectCategory;
  name: string;
  description?: string;
  platform?: 'Windows' | 'iOS' | 'Android' | 'macOS' | 'All Platforms';
  intent: 'include' | 'exclude';
  appIntent?: 'available' | 'required' | 'uninstall';  // mobileApps only
  source: GroupAssignmentSource;
  filter?: GroupAssignmentFilter;
  lastModified?: string;
  rawObject: unknown;          // original Graph payload, used by the drawer
}

export type CategoryStatus = 'pending' | 'loading' | 'done' | 'error';

export interface CategoryState {
  status: CategoryStatus;
  count?: number;
  error?: string;
}

export interface GroupLookupState {
  groupId: string;
  groupName: string;
  parentGroups: { id: string; displayName: string }[];
  perCategory: Record<IntuneObjectCategory, CategoryState>;
  results: GroupAssignmentResult[];
}
```

A single Intune object may produce **multiple** `GroupAssignmentResult` rows when it is targeted by both the selected group and a parent group (e.g., excluded directly, included via parent). One row per matching assignment record.

## 6. Fetch orchestration

### 6.1 Public API

```ts
fetchGroupAssignments(
  groupId: string,
  callbacks: {
    signal: AbortSignal;
    onCategoryStatus: (cat: IntuneObjectCategory, state: CategoryState) => void;
    onResults: (cat: IntuneObjectCategory, rows: GroupAssignmentResult[]) => void;
    onParentGroups: (parents: { id: string; displayName: string }[]) => void;
  },
): Promise<void>;
```

The function streams events as data arrives. Returns when all categories have settled (done or error) or the signal aborts.

### 6.2 Algorithm

1. **Resolve target group set**
   - `GET /groups/{id}?$select=id,displayName` → group display name.
   - `GET /groups/{id}/transitiveMemberOf/microsoft.graph.group?$select=id,displayName&$top=999` with header `ConsistencyLevel: eventual` → list of parent groups (direct + nested).
   - Build `targetIds = new Set([groupId, ...parentGroupIds])`.
   - Invoke `onParentGroups(...)`.

2. **Per-category fan-out** (all in parallel, `Promise.allSettled`):

   | Category              | Endpoint                                                                   | Strategy |
   |-----------------------|----------------------------------------------------------------------------|----------|
   | `deviceConfiguration` | `/deviceManagement/deviceConfigurations?$expand=assignments`               | expand   |
   | `compliancePolicy`    | `/deviceManagement/deviceCompliancePolicies?$expand=assignments`           | expand   |
   | `configurationPolicy` | `/deviceManagement/configurationPolicies?$expand=assignments`              | expand   |
   | `appProtection`       | `/deviceAppManagement/managedAppPolicies?$expand=assignments`              | expand   |
   | `mobileApp`           | `/deviceAppManagement/mobileApps?$select=id,displayName,...`, then `$batch` per-app `/deviceAppManagement/mobileApps/{id}/assignments` | batch (≤20/req) |
   | `appConfiguration`    | `/deviceAppManagement/mobileAppConfigurations?$expand=assignments`         | expand   |
   | `endpointSecurity`    | `/deviceManagement/intents` then per-intent `/assignments` via `$batch`    | batch    |
   | `platformScript`      | `/deviceManagement/deviceManagementScripts?$expand=assignments`            | expand   |
   | `remediationScript`   | `/deviceManagement/deviceHealthScripts?$expand=assignments`                | expand   |
   | `complianceScript`    | `/deviceManagement/deviceComplianceScripts?$expand=assignments`            | expand   |
   | `autopilotProfile`    | `/deviceManagement/windowsAutopilotDeploymentProfiles?$expand=assignments` | expand   |
   | `enrollmentConfig`    | `/deviceManagement/deviceEnrollmentConfigurations?$expand=assignments`     | expand   |
   | `updateRing`          | derived from `deviceConfiguration` results — see derivation rule below; do **not** issue a separate fetch | derived  |

   **`updateRing` derivation rule:** while processing `deviceConfiguration` results in step 3, if a row's underlying object has an `@odata.type` matching `#microsoft.graph.windowsUpdateForBusinessConfiguration` (or other Windows update profile types), reclassify the row's `category` as `updateRing`. The row is emitted under the `updateRing` category, not `deviceConfiguration`. This means `deviceConfiguration` and `updateRing` counts are mutually exclusive.

   `mobileApp` uses `$batch` because Microsoft deprecated `$expand=assignments` on `/mobileApps`. Tenants commonly have hundreds of apps; batching keeps round-trips bounded. `endpointSecurity` (intents) follows the same pattern — list, then batched per-intent assignment fetch.

3. **Per-category processing**

   For each category:
   1. Emit `onCategoryStatus(cat, { status: 'loading' })`.
   2. Fetch with `?$top=200` paging; follow `@odata.nextLink` until exhausted. All requests honor `AbortSignal`.
   3. For each returned object, scan its `assignments[]`. For each assignment whose `target.groupId ∈ targetIds`:
      - Build a `GroupAssignmentResult`.
      - `intent` = `'exclude'` if `assignment.target['@odata.type']` ends with `exclusionGroupAssignmentTarget`; otherwise `'include'` (covers both `groupAssignmentTarget` and any future include-style target types).
      - `source` = `{ kind: 'direct' }` if `groupId === selectedGroupId`, else `{ kind: 'parent', groupId, groupName }` (groupName resolved from the parent group set built in step 1).
      - `appIntent` populated for mobileApps from `assignment.intent`.
      - `filter` populated when `assignment.target.deviceAndAppManagementAssignmentFilterId` is present (display name resolved later).
   4. Emit `onResults(cat, rows)` and `onCategoryStatus(cat, { status: 'done', count: rows.length })`.
   5. On error: catch, log, emit `onCategoryStatus(cat, { status: 'error', error: message })`. Continue other categories.

4. **Filter display name resolution** (post-pass)
   - Collect all unique `assignmentFilterId`s seen across results.
   - One call to `/deviceManagement/assignmentFilters?$select=id,displayName`.
   - Patch `filter.displayName` into rows. Re-emit the affected categories' `onResults` so the table re-renders with names.

### 6.3 Cancellation

`AbortSignal` is plumbed into the underlying `fetch` of every Graph call. When the user picks a new group, the hook aborts the previous run before starting a new one. Aborted requests do not emit completion events.

### 6.4 Failure isolation

`Promise.allSettled` ensures one category failing (auth, throttle, schema change) never blocks the rest. Throttling (HTTP 429) is handled by the Graph client's existing retry middleware; we do not add a layer.

## 7. UI behavior

### 7.1 GroupSearchBox

- Debounce: 250 ms.
- Query: `GET /groups?$filter=startswith(displayName,'<input>')&$select=id,displayName,description,mail&$top=10` (no `ConsistencyLevel` header needed for `startswith`).
- Keyboard: ↑/↓ to navigate, Enter to select, Esc to close. Fully accessible (ARIA combobox).
- Shows display name + secondary line (mail or description) per result.

### 7.2 ResultsSummary

- Group name (large), description if present.
- Parent-group lineage as small chips: "Member of: All-Marketing, All-EMEA" — clicking a chip switches the lookup to that parent group.
- Count chips per category (clickable: click to filter the table to that category).

### 7.3 CategoryProgressList

Vertical list of all 13 categories. Each row:

- Status icon: `pending` (dim grey clock) → `loading` (`Loader2` spinner) → `done` (green check) or `error` (amber `AlertCircle` with tooltip).
- Category label.
- Animated count, increments from 0 to final value with brief number-roll.
- Subtle shimmer behind the row while loading.

Above the list: **"Inspecting <Group Name>…"** + cumulative line "X of 13 complete · N connections found".

When all 13 settle, the block collapses to a single summary line that the user can re-expand.

### 7.4 ResultsTable

Backed by **TanStack Table** (`@tanstack/react-table`). Columns:

| Column | Sort | Filter |
|---|---|---|
| Name | yes | free-text (search above table) |
| Category | yes | multi-select |
| Platform | yes | multi-select |
| Intent | yes | multi-select (Include / Exclude) |
| App intent | yes | multi-select (Required / Available / Uninstall) — only visible when ≥1 row populates it |
| Source | yes | multi-select (Direct / via *parent name*) |
| Filter | yes | multi-select |
| Last modified | yes | none in v1 |

**Saved views**:
- Dropdown above the table: "Saved views" with a list, "Save current view…" action, per-view delete.
- Persisted to `localStorage` keyed `groupLookup.savedViews.<tenantId>`. Stored shape: `{ name, filters, sorting, freeTextSearch }`. Column visibility is **not** persisted in v1.
- A view applies on selection; it does not auto-apply on page load.

**Empty / partial states**:
- While categories load, the table shows what has arrived; footer reads "Still loading: <category names>".
- Per-category errors render as a dismissible warning chip above the table ("Could not load Mobile Apps — <reason> · [Retry]"). Clicking Retry re-runs that category in isolation.

### 7.5 ResultsDetailDrawer

shadcn `Sheet`, opens on row click.

- Header: object name, category badge, intent badge.
- For categories the existing app already models (`deviceConfiguration`, `compliancePolicy`, `appProtection`, `configurationPolicy`): reuse `PolicyCard` inline, in expanded mode.
- For new categories: structured detail view (key fields per category) plus a "Raw JSON" toggle that pretty-prints `rawObject`.
- Footer: link "Open in Intune portal" (constructs the deep link from `category` + `id` where stable; omitted otherwise).

### 7.6 Animation tone

Informative, not noisy. No confetti, no toasts. The animation's job is to communicate which categories are being inspected and surface errors immediately.

## 8. Permissions

The new feature uses Graph permissions already declared in the project README:

- `Group.Read.All` — group search, transitive memberOf
- `DeviceManagementConfiguration.Read.All` — most policy reads
- `DeviceManagementApps.Read.All` — apps, app config, app protection
- `DeviceManagementServiceConfig.Read.All` — Autopilot, enrollment configs
- `DeviceManagementManagedDevices.Read.All` — assignment-filter reads

No new admin consent required.

## 9. Error handling

| Error | Behavior |
|---|---|
| 401 | Existing MSAL silent-refresh / interactive flow. No new code path. |
| 403 (per category) | Mark category as `error` with a tenant-friendly message. Other categories continue. |
| 404 (per category, e.g., beta endpoint not available) | Same as 403. |
| 429 | Graph SDK middleware retries with `Retry-After`. We don't add a layer. |
| Group not found / deleted | Full-page error state with "Search another group" button. |
| Network failure mid-stream | Per-category error chip with Retry. Other categories' results remain visible. |
| User picks new group | `AbortController` cancels in-flight requests; new run starts cleanly. |

## 10. Testing strategy

**Unit tests** (Vitest + React Testing Library — confirm tooling matches project conventions during planning):

- `groupAssignmentService` with a mocked Graph client:
  - Direct-only matching.
  - Transitive-parent matching.
  - Both-source matching (object assigned via direct AND parent → produces 2 rows).
  - Include + exclude collisions on the same object.
  - Per-category error isolation (one category's 403 does not affect others).
  - `mobileApps` `$batch` path: verify batch payload structure, response merging, partial-batch failure tolerance.
  - Filter-id resolution post-pass.

- `useGroupAssignments` hook: streaming state shape, cancellation when groupId changes.

- `ResultsTable`: sort, multi-select filter, free-text search, saved-view CRUD against `localStorage`.

**Component / integration tests:**

- `GroupSearchBox`: debounce, keyboard nav, empty-state, error handling.
- `GroupLookup` end-to-end with mocked service: select → progress animates → table populates → drawer opens.

**Manual smoke:**

- Run against a real tenant with a known group; verify counts match the Intune portal's "Assignments" view per object type.

## 11. Open questions / future work

- Reverse lookup (user/device → effective Intune surface) — natural follow-on once group lookup is solid.
- Transitive *child* group expansion — was deferred per Q6.
- Export — was deferred per Q10.
- Cross-search caching — was deferred per Q7. If usage data shows the same group searched repeatedly, revisit.
- `$batch` rollout to other categories as a perf optimization once v1 is stable.
