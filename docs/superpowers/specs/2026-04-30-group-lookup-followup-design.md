# Group Lookup follow-up — design

**Date:** 2026-04-30
**Branch (target):** new branch off `feat/group-lookup` (or off `main` if that has been merged)
**Status:** Approved

## Summary

A bundled follow-up on the Group Lookup feature covering five user-reported items observed during real-tenant testing:

1. **Granular app categorization** — every Mobile App row is currently labelled "Mobile App" with an empty Platform column. Surface platform (Windows / iOS / Android / macOS / Web) plus a humanised app type (Win32, iOS Store, Web Link, ...) by reading `@odata.type`.
2. **Filter findings via clickable chips** — wire the existing decorative Category chips on `ResultsSummary` into a real filter and add Platform / App Type / Intent chip rows above the results table. Multi-select within a row, AND-combined across rows, faceted live counts.
3. **Search dropdown stays open after group selection** — bug. Close it on `onSelect`.
4. **Two magnifying-glass icons inside the search input** — bug. Drop the outer wrapper that duplicates cmdk's built-in icon.
5. **Search input text gets cut off mid-bar** — likely a side-effect of #4. Verify after #4.

All five land in a single PR. Tests stay TDD-style. Saved views (existing localStorage layer) automatically gain the new chip filter values via the existing key/value `filters` map — no schema migration.

## Motivation

Real-tenant testing revealed that mobile app rows are barely useful as a flat "Mobile App" bucket: a tenant with thousands of apps spans Win32 / Store / Web / iOS / Android / macOS, and an admin auditing assignments needs to narrow on those axes. The chip-based filter UX leverages UI elements that already render (the `ResultsSummary` category chips were planned as a no-op stub) and gives "filter to Windows mobile apps" in two clicks. The three bugs hurt every search interaction and each one is a contained fix.

## Architecture overview

```
┌──────────────────────────────────────────────────────────┐
│ GroupLookupPage                                          │
│   filters: FilterState (lifted)                          │
│   results: GroupAssignmentResult[] (from hook)           │
│                                                          │
│   ┌──────────────┐  ┌─────────────────────────────────┐ │
│   │ResultsSummary│  │ ResultsTable                    │ │
│   │ Category     │  │   FilterChipGroup × 3           │ │
│   │ chip group   │  │   (Platform / App Type / Intent)│ │
│   │              │  │   <table> rows                  │ │
│   └──────────────┘  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

         ▲ both read filters + onFiltersChange from parent
         │ both render <FilterChipGroup>
         │ both apply faceted counts via computeFacetCounts()
```

Filter state lifts from `ResultsTable` into `GroupLookupPage`. Both `ResultsSummary` and `ResultsTable` are passed `filters` and `onFiltersChange`. `ResultsTable` becomes controlled with respect to filters (drops its internal `columnFilters` state). The existing saved-views feature continues to read/write the same key/value shape.

## §1. Data model

### Type changes

`src/types/graph.ts`:

```ts
export type IntunePlatform =
  | 'Windows'
  | 'iOS'
  | 'Android'
  | 'macOS'
  | 'Web'           // NEW — for webApp
  | 'All Platforms';

export interface GroupAssignmentResult {
  // ... existing fields
  platform?: IntunePlatform;
  appType?: string;  // NEW — humanised label like "Win32", "iOS Store", "Web Link"
}
```

`appType` stays open-string rather than a closed enum so a new Graph type doesn't crash the UI.

### New module: `src/lib/intuneAppTypes.ts`

```ts
export interface MobileAppClassification {
  platform: IntunePlatform;
  appType: string;
}

export function classifyMobileApp(
  odataType: string | undefined,
): MobileAppClassification | undefined;
```

Internally a static mapping table covers the known `microsoft.graph.*App` derived types. Mapping entries (verified via Microsoft Learn `mobileApp` derived-type pages):

| `@odata.type` (no `#microsoft.graph.` prefix) | platform | appType |
| --- | --- | --- |
| `win32LobApp`                       | Windows | Win32 |
| `win32CatalogApp`                   | Windows | Win32 (Catalog) |
| `windowsStoreApp`                   | Windows | Microsoft Store |
| `microsoftStoreForBusinessApp`      | Windows | Microsoft Store for Business |
| `officeSuiteApp`                    | Windows | Microsoft 365 Apps |
| `windowsAppX`                       | Windows | Windows AppX |
| `windowsUniversalAppX`              | Windows | Windows Universal AppX |
| `windowsMobileMSI`                  | Windows | Windows MSI |
| `windowsPhone81AppX`                | Windows | Windows Phone AppX |
| `windowsPhone81AppXBundle`          | Windows | Windows Phone AppX Bundle |
| `windowsPhone81StoreApp`            | Windows | Windows Phone Store |
| `windowsMicrosoftEdgeApp`           | Windows | Microsoft Edge |
| `windowsWebApp`                     | Windows | Web Link (Windows) |
| `webApp`                            | Web     | Web Link |
| `iosStoreApp`                       | iOS     | iOS Store |
| `iosLobApp`                         | iOS     | iOS LOB |
| `iosVppApp`                         | iOS     | iOS VPP |
| `iosWebClip`                        | iOS     | iOS Web Clip |
| `managedIOSStoreApp`                | iOS     | Managed iOS Store |
| `managedIOSLobApp`                  | iOS     | Managed iOS LOB |
| `androidStoreApp`                   | Android | Android Store |
| `androidLobApp`                     | Android | Android LOB |
| `androidManagedStoreApp`            | Android | Managed Google Play |
| `androidManagedStoreWebApp`         | Android | Managed Google Play Web |
| `androidForWorkApp`                 | Android | Android for Work |
| `managedAndroidStoreApp`            | Android | Managed Android Store |
| `managedAndroidLobApp`              | Android | Managed Android LOB |
| `macOSDmgApp`                       | macOS   | macOS DMG |
| `macOSPkgApp`                       | macOS   | macOS PKG |
| `macOSLobApp`                       | macOS   | macOS LOB |
| `macOSOfficeSuiteApp`               | macOS   | macOS Office Suite |
| `macOSMicrosoftEdgeApp`             | macOS   | macOS Microsoft Edge |
| `macOSMicrosoftDefenderApp`         | macOS   | macOS Microsoft Defender |
| `macOsVppApp`                       | macOS   | macOS VPP (note lowercase 'os') |

**Fallback for unknown types:** prefix-based platform inference, with the bare local-name as `appType`. Order matters because `macOs` (lowercase 's') must be matched before generic `macOS` rules and before any catch-all:

```
ios*            → iOS,     local-name as-is (capitalised)
android*        → Android, local-name as-is
macOS* | macOs* → macOS,   local-name as-is
windows* | win* | microsoftStore* | officeSuite* → Windows, local-name as-is
webApp          → Web,     "Web Link"
otherwise       → undefined (don't guess)
```

`classifyMobileApp` returns `undefined` when no rule matches (rather than guessing a platform), so the table's "Platform" column gracefully shows "—" for that row.

### Service plumbing

`src/services/groupAssignmentService.ts`:

- `BatchCategoryConfig` and `ExpandCategoryConfig` both gain `extractAppType?: (obj: any) => string | undefined`.
- `buildRowsFromObject` populates `appType` from it.
- `BATCH_CATEGORY_CONFIGS` mobileApp entry gets:
  ```ts
  {
    category: 'mobileApp',
    listEndpoint: '/beta/deviceAppManagement/mobileApps',  // CHANGED — was v1.0
    listSelect: 'id,displayName,lastModifiedDateTime,@odata.type,isAssigned',  // CHANGED
    listFilter: 'isAssigned eq true',                    // unchanged from earlier commit
    assignmentsPathFor: (id) => `/beta/deviceAppManagement/mobileApps/${id}/assignments`,
    extractName:        (o) => o.displayName,
    extractPlatform:    (o) => classifyMobileApp(o['@odata.type'])?.platform,
    extractAppType:     (o) => classifyMobileApp(o['@odata.type'])?.appType,
    extractLastModified:(o) => o.lastModifiedDateTime,
    extractAppIntent:   /* unchanged */,
  }
  ```

The endpoint switch (v1.0 → beta) is required because `isAssigned` is documented only on the beta `mobileApp`; the existing rest of `graphConfig` in `authConfig.ts` already uses `/beta/` for Intune endpoints, so this aligns with codebase convention.

### Table column changes

`src/components/group/ResultsTable.tsx`:

- New "App Type" column added after Platform. Visible only when at least one row has `appType` (mirror existing `showAppIntent` pattern).
- "Platform" column already exists — starts populating for mobile apps automatically.
- `ResultsDetailDrawer` adds an `appType` line under "Platform:" when the row carries it.

## §2. Filter chip components and state

### State shape

`src/pages/GroupLookup.tsx` adds:

```ts
type FilterState = {
  category: IntuneObjectCategory[];
  platform: IntunePlatform[];
  appType: string[];
  intent: ('include' | 'exclude')[];
};
const [filters, setFilters] = useState<FilterState>({
  category: [], platform: [], appType: [], intent: [],
});
```

Empty arrays mean "no filter on this dimension." Filters AND across dimensions and OR within a dimension.

### `ResultsTable` becomes controlled

`ResultsTable` drops its internal `columnFilters` state. New props: `filters: FilterState`, `onFiltersChange: (next: FilterState) => void`. The react-table `state.columnFilters` is derived from `filters` on every render via:

```ts
const columnFilters = useMemo<ColumnFiltersState>(() => [
  filters.category.length ? { id: 'category', value: filters.category } : null,
  filters.platform.length ? { id: 'platform', value: filters.platform } : null,
  filters.appType.length  ? { id: 'appType',  value: filters.appType  } : null,
  filters.intent.length   ? { id: 'intent',   value: filters.intent   } : null,
].filter(Boolean) as ColumnFiltersState, [filters]);
```

Saved-views (de)serialisation maps trivially — `SavedView.filters: Record<string, string[]>` already keys by column id. Loading a saved view calls `onFiltersChange` with the persisted dimensions.

### `FilterChipGroup` component

`src/components/group/FilterChipGroup.tsx`:

```ts
interface FilterChipOption {
  value: string;
  label: string;
  count: number;  // post-facet count (excludes own dimension's filter)
}

interface FilterChipGroupProps {
  label: string;
  options: FilterChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}
```

Renders `<label>: chip chip chip` on one wrapping row. Each chip is a real `<button>` with `aria-pressed={selected.includes(value)}`. Active chips use a filled `Badge` variant; inactive use outlined. Options with `count === 0` are filtered out before render. Clicking toggles membership in `selected`.

If the input `options` array is empty after the count filter, the whole group renders nothing (no empty row of label).

### Faceted count helper

`src/lib/facetCounts.ts`:

```ts
export function computeFacetCounts<D extends keyof FilterState>(
  rows: GroupAssignmentResult[],
  filters: FilterState,
  dimension: D,
): Map<string, number>;
```

Applies every filter *except* the one on `dimension`, then groups remaining rows by `row[dimension]` (or whatever maps to that column) and returns a value→count map. This is the standard faceted-search pattern: counts for a dimension exclude that dimension's own filter so the user sees "if I add X, how many results would I get."

Memoised in the page via `useMemo` keyed on `[results, filters]`. Result-set sizes are small (rarely >1000 rows for one group's assignments), so this is O(rows × dimensions) per render with tiny constants.

### Wiring

`ResultsSummary`:

```tsx
<FilterChipGroup
  label="Category"
  options={categoryOptions}        // built from computeFacetCounts(rows, filters, 'category')
  selected={filters.category}
  onChange={(next) => onFiltersChange({ ...filters, category: next as IntuneObjectCategory[] })}
/>
```

The current decorative chips are replaced. `onSelectParent` and the parent-groups breadcrumb stay unchanged.

`ResultsTable` renders three `FilterChipGroup`s above its existing search-input row:

```tsx
<FilterChipGroup label="Platform" ... />
<FilterChipGroup label="App Type" ... />  {/* hidden if no row has appType */}
<FilterChipGroup label="Intent"   ... />
```

Reset button additionally clears all four dimensions: `onFiltersChange({ category: [], platform: [], appType: [], intent: [] })`.

## §3. UI bug fixes

### #3 — search dropdown stays open after group pick

`src/components/group/GroupSearchBox.tsx`. The `query` state stays populated after `onSelect`, keeping matches rendered. Fix: when a `CommandItem` is selected, call both `onSelect(g)` and `setQuery('')`. The cmdk dropdown collapses naturally because `query.length < 2` falls into the existing "Keep typing…" branch. No new state needed.

### #4 — two magnifying glasses

Same file. The component wraps cmdk's `CommandInput` (which has its own internal Search icon + border + padding) in a second `<div>` with another `<Search>` icon. Fix: drop the outer `<div className="flex items-center px-3 border-b">…</div>` and the redundant `<Search>` import usage. Loader2 spinner moves into a `<div className="absolute right-3 top-1/2 -translate-y-1/2">` overlay placed inside the cmdk input's containing element, OR rendered as a sibling after `CommandInput` if the existing flex layout cooperates. Pick whichever lints cleaner — both produce one icon and one spinner.

### #5 — text cutoff in the search input

Almost certainly a side-effect of #4. After applying #4, verify in the running dev server at multiple viewport widths that long queries display fully. If still cut off, add `min-w-0 flex-1` to the immediate parent of `CommandInput` so the input shrinks correctly inside its flex parent.

## §4. Testing strategy

All TDD-first. New tests:

- **`src/lib/intuneAppTypes.test.ts`** — `classifyMobileApp` covers (a) a sampling of well-known types from the table, (b) the `macOs` vs `macOS` casing edge case, (c) prefix-fallback for an `iosFooApp`-style unknown, (d) `webApp` → Web/`Web Link`, (e) returns `undefined` for unmatched / missing input.
- **`src/lib/facetCounts.test.ts`** — `computeFacetCounts` covers (a) excludes own dimension's filter, (b) applies other dimensions' filters, (c) returns empty map for missing rows, (d) ignores rows where the dimension field is undefined.
- **`src/components/group/FilterChipGroup.test.tsx`** — renders chips with counts; click toggles selected state and fires `onChange` with the new array; active chips have `aria-pressed=true`; group renders nothing if all options have `count === 0`.

Updates:

- **`src/services/groupAssignmentService.test.ts`** — mobileApp config emits `platform` and `appType` from a fixture row's `@odata.type` (use `win32LobApp` for the happy path and a fabricated `iosNewerThanWeKnowApp` for the prefix fallback).
- **`src/components/group/ResultsSummary.test.tsx`** — new controlled-filter interface (`filters`, `onFiltersChange`); clicking a Category chip fires `onFiltersChange` with the right shape.
- **`src/components/group/ResultsTable.test.tsx`** — same controlled-filter wiring; integration test "click Platform=Windows narrows to Windows rows."
- **`src/components/group/GroupSearchBox.test.tsx`** — selection clears the query and the dropdown renders the "Keep typing" branch afterward.

All existing tests continue to pass. Test count target after this work: ~52 (current 41 + ~11 new/changed).

## §5. Out of scope

- No URL state for filters (deep-linking) — saved views cover persistence.
- No "clear individual chip" affordance beyond clicking the chip again to deselect.
- No new platforms beyond adding `'Web'` to the union.
- No app-icon thumbnails in the table.
- No grouping by app type in the table (filter only).
- No reverse lookup ("what groups is this app assigned to") — already explicitly out-of-scope from the original feature.

## §6. File map

```
NEW   src/lib/intuneAppTypes.ts
NEW   src/lib/intuneAppTypes.test.ts
NEW   src/lib/facetCounts.ts
NEW   src/lib/facetCounts.test.ts
NEW   src/components/group/FilterChipGroup.tsx
NEW   src/components/group/FilterChipGroup.test.tsx

MOD   src/types/graph.ts                           # +'Web' platform, +appType field
MOD   src/services/groupAssignmentService.ts       # /beta endpoint, +extractAppType, +select @odata.type
MOD   src/services/groupAssignmentService.test.ts  # mobileApp classification assertions
MOD   src/pages/GroupLookup.tsx                    # lift filter state, wire FilterChipGroups, drawer unmount
MOD   src/components/group/ResultsSummary.tsx      # controlled chips via FilterChipGroup
MOD   src/components/group/ResultsSummary.test.tsx
MOD   src/components/group/ResultsTable.tsx        # controlled filters, +Platform/AppType/Intent chip rows, +AppType column
MOD   src/components/group/ResultsTable.test.tsx
MOD   src/components/group/GroupSearchBox.tsx      # close-on-select, drop outer wrapper
MOD   src/components/group/GroupSearchBox.test.tsx
MOD   src/components/group/ResultsDetailDrawer.tsx # render appType
```

## §7. Self-review

- **Placeholder scan:** none. All "TODO"-style notes in the plan are explicit "out of scope" / "deferred to manual smoke."
- **Internal consistency:** `FilterState` matches the four chip groups; `IntunePlatform` adds `'Web'` once and is used consistently; saved-view shape is unchanged.
- **Scope:** five user-reported items, single PR, ~13 files. Single implementation plan can drive this.
- **Ambiguity:** `appType` is intentionally an open string with documented mapping table; the fallback rules are spelled out in order. The "show only chips with count > 0" rule is stated explicitly. Reset button behaviour is stated.

## Spec coverage map

| User report                          | Section |
| ------------------------------------ | ------- |
| Granular app categorization          | §1      |
| Filter findings via chips            | §2      |
| Search dropdown closes after pick    | §3 #3   |
| Two magnifying glasses               | §3 #4   |
| Search input cutoff                  | §3 #5   |

Done.
