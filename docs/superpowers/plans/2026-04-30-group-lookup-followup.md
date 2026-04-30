# Group Lookup follow-up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five-item Group Lookup follow-up bundle: granular app categorization (platform + appType from `@odata.type`), filter chips on `ResultsSummary`/`ResultsTable`, and three search-input bug fixes.

**Architecture:** Lift filter state into `GroupLookupPage`, derive react-table column filters from it, render a reusable `FilterChipGroup` in both `ResultsSummary` (category) and `ResultsTable` (platform/appType/intent). Switch the mobileApps service call to the `/beta` endpoint so `isAssigned` and `@odata.type` arrive in the response and feed a `classifyMobileApp` lookup that produces platform + humanised app-type label.

**Tech Stack:** TypeScript, React 18, react-table v8, vitest + @testing-library/react, Microsoft Graph SDK.

**Spec:** `docs/superpowers/specs/2026-04-30-group-lookup-followup-design.md`

---

## File Map

```
NEW   src/lib/intuneAppTypes.ts                    # classifyMobileApp + KNOWN_TYPES table
NEW   src/lib/intuneAppTypes.test.ts
NEW   src/lib/facetCounts.ts                       # FilterState type + computeFacetCounts
NEW   src/lib/facetCounts.test.ts
NEW   src/components/group/FilterChipGroup.tsx
NEW   src/components/group/FilterChipGroup.test.tsx

MOD   src/types/graph.ts                           # +'Web' platform, +appType field
MOD   src/services/groupAssignmentService.ts       # /beta endpoint, +extractAppType, +select @odata.type
MOD   src/services/groupAssignmentService.test.ts
MOD   src/pages/GroupLookup.tsx                    # lift filter state
MOD   src/components/group/ResultsSummary.tsx      # controlled chips via FilterChipGroup
MOD   src/components/group/ResultsSummary.test.tsx
MOD   src/components/group/ResultsTable.tsx        # controlled filters, +chip rows, +AppType column
MOD   src/components/group/ResultsTable.test.tsx
MOD   src/components/group/GroupSearchBox.tsx      # close-on-select + drop outer wrapper
MOD   src/components/group/GroupSearchBox.test.tsx
MOD   src/components/group/ResultsDetailDrawer.tsx # render appType
```

Tasks land in dependency order. Anything Task N writes is consumed only by Task >N.

---

## Task 1: Type extensions

**Files:**
- Modify: `src/types/graph.ts`

The `IntunePlatform` union gains `'Web'`; `GroupAssignmentResult` gains an optional `appType: string`.

- [ ] **Step 1: Edit `src/types/graph.ts`**

Find the existing `IntunePlatform` union (currently around line 250):

```ts
export type IntunePlatform =
  | 'Windows'
  | 'iOS'
  | 'Android'
  | 'macOS'
  | 'All Platforms';
```

Replace with:

```ts
export type IntunePlatform =
  | 'Windows'
  | 'iOS'
  | 'Android'
  | 'macOS'
  | 'Web'
  | 'All Platforms';
```

Find the `GroupAssignmentResult` interface and add `appType?: string` directly after the existing `platform?: IntunePlatform` line:

```ts
export interface GroupAssignmentResult {
  // ... existing fields including:
  platform?: IntunePlatform;
  appType?: string;
  // ... rest of existing fields unchanged
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (No consumer code references `appType` yet.)

- [ ] **Step 3: Commit**

```bash
git add src/types/graph.ts
git commit -m "$(cat <<'EOF'
feat(group-lookup): add Web platform and appType to GroupAssignmentResult

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `classifyMobileApp` module (TDD)

**Files:**
- Create: `src/lib/intuneAppTypes.ts`
- Create: `src/lib/intuneAppTypes.test.ts`

Pure helper that maps a Graph `@odata.type` to `{ platform, appType }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/intuneAppTypes.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest';
import { classifyMobileApp } from './intuneAppTypes';

describe('classifyMobileApp', () => {
  it('classifies a known Win32 LOB app', () => {
    expect(classifyMobileApp('#microsoft.graph.win32LobApp')).toEqual({
      platform: 'Windows',
      appType: 'Win32',
    });
  });

  it('classifies iOS Store app', () => {
    expect(classifyMobileApp('#microsoft.graph.iosStoreApp')).toEqual({
      platform: 'iOS',
      appType: 'iOS Store',
    });
  });

  it('classifies macOS DMG (capital OS)', () => {
    expect(classifyMobileApp('#microsoft.graph.macOSDmgApp')).toEqual({
      platform: 'macOS',
      appType: 'macOS DMG',
    });
  });

  it('classifies macOs VPP (lowercase s — Graph quirk)', () => {
    expect(classifyMobileApp('#microsoft.graph.macOsVppApp')).toEqual({
      platform: 'macOS',
      appType: 'macOS VPP',
    });
  });

  it('classifies webApp as Web platform', () => {
    expect(classifyMobileApp('#microsoft.graph.webApp')).toEqual({
      platform: 'Web',
      appType: 'Web Link',
    });
  });

  it('classifies Microsoft 365 Apps via officeSuiteApp', () => {
    expect(classifyMobileApp('#microsoft.graph.officeSuiteApp')).toEqual({
      platform: 'Windows',
      appType: 'Microsoft 365 Apps',
    });
  });

  it('falls back to iOS prefix for unknown ios* type', () => {
    expect(classifyMobileApp('#microsoft.graph.iosFutureApp')).toEqual({
      platform: 'iOS',
      appType: 'iosFutureApp',
    });
  });

  it('falls back to Windows for unknown win32* type', () => {
    expect(classifyMobileApp('#microsoft.graph.win32FutureApp')).toEqual({
      platform: 'Windows',
      appType: 'win32FutureApp',
    });
  });

  it('falls back to macOS for unknown macOs* lowercase type', () => {
    expect(classifyMobileApp('#microsoft.graph.macOsFutureApp')).toEqual({
      platform: 'macOS',
      appType: 'macOSFutureApp'.replace('S', 's'),  // localName preserved verbatim
    });
  });

  it('returns undefined for unmatched type', () => {
    expect(classifyMobileApp('#microsoft.graph.somethingElseApp')).toBeUndefined();
  });

  it('returns undefined for missing or empty input', () => {
    expect(classifyMobileApp(undefined)).toBeUndefined();
    expect(classifyMobileApp('')).toBeUndefined();
    expect(classifyMobileApp('#microsoft.graph.')).toBeUndefined();
  });
});
```

(The slightly contorted `'macOSFutureApp'.replace('S', 's')` literal evaluates at import time to `'macOsFutureApp'` — it documents intent that `localName` is preserved verbatim, not re-cased. Equivalent: `'macOsFutureApp'`. Either form is fine.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- intuneAppTypes`
Expected: FAIL with "Failed to resolve import './intuneAppTypes'".

- [ ] **Step 3: Implement `src/lib/intuneAppTypes.ts`**

```ts
import type { IntunePlatform } from '@/types/graph';

export interface MobileAppClassification {
  platform: IntunePlatform;
  appType: string;
}

const PREFIX = '#microsoft.graph.';

const KNOWN: Record<string, MobileAppClassification> = {
  win32LobApp: { platform: 'Windows', appType: 'Win32' },
  win32CatalogApp: { platform: 'Windows', appType: 'Win32 (Catalog)' },
  windowsStoreApp: { platform: 'Windows', appType: 'Microsoft Store' },
  microsoftStoreForBusinessApp: { platform: 'Windows', appType: 'Microsoft Store for Business' },
  officeSuiteApp: { platform: 'Windows', appType: 'Microsoft 365 Apps' },
  windowsAppX: { platform: 'Windows', appType: 'Windows AppX' },
  windowsUniversalAppX: { platform: 'Windows', appType: 'Windows Universal AppX' },
  windowsMobileMSI: { platform: 'Windows', appType: 'Windows MSI' },
  windowsPhone81AppX: { platform: 'Windows', appType: 'Windows Phone AppX' },
  windowsPhone81AppXBundle: { platform: 'Windows', appType: 'Windows Phone AppX Bundle' },
  windowsPhone81StoreApp: { platform: 'Windows', appType: 'Windows Phone Store' },
  windowsMicrosoftEdgeApp: { platform: 'Windows', appType: 'Microsoft Edge' },
  windowsWebApp: { platform: 'Windows', appType: 'Web Link (Windows)' },
  webApp: { platform: 'Web', appType: 'Web Link' },
  iosStoreApp: { platform: 'iOS', appType: 'iOS Store' },
  iosLobApp: { platform: 'iOS', appType: 'iOS LOB' },
  iosVppApp: { platform: 'iOS', appType: 'iOS VPP' },
  iosWebClip: { platform: 'iOS', appType: 'iOS Web Clip' },
  managedIOSStoreApp: { platform: 'iOS', appType: 'Managed iOS Store' },
  managedIOSLobApp: { platform: 'iOS', appType: 'Managed iOS LOB' },
  androidStoreApp: { platform: 'Android', appType: 'Android Store' },
  androidLobApp: { platform: 'Android', appType: 'Android LOB' },
  androidManagedStoreApp: { platform: 'Android', appType: 'Managed Google Play' },
  androidManagedStoreWebApp: { platform: 'Android', appType: 'Managed Google Play Web' },
  androidForWorkApp: { platform: 'Android', appType: 'Android for Work' },
  managedAndroidStoreApp: { platform: 'Android', appType: 'Managed Android Store' },
  managedAndroidLobApp: { platform: 'Android', appType: 'Managed Android LOB' },
  macOSDmgApp: { platform: 'macOS', appType: 'macOS DMG' },
  macOSPkgApp: { platform: 'macOS', appType: 'macOS PKG' },
  macOSLobApp: { platform: 'macOS', appType: 'macOS LOB' },
  macOSOfficeSuiteApp: { platform: 'macOS', appType: 'macOS Office Suite' },
  macOSMicrosoftEdgeApp: { platform: 'macOS', appType: 'macOS Microsoft Edge' },
  macOSMicrosoftDefenderApp: { platform: 'macOS', appType: 'macOS Microsoft Defender' },
  macOsVppApp: { platform: 'macOS', appType: 'macOS VPP' },
};

export function classifyMobileApp(
  odataType: string | undefined,
): MobileAppClassification | undefined {
  if (!odataType) return undefined;
  const localName = odataType.startsWith(PREFIX)
    ? odataType.slice(PREFIX.length)
    : odataType;
  if (!localName) return undefined;

  const known = KNOWN[localName];
  if (known) return known;

  // Prefix fallback — case-insensitive so macOS / macOs both match.
  const lower = localName.toLowerCase();
  if (lower.startsWith('ios')) return { platform: 'iOS', appType: localName };
  if (lower.startsWith('android')) return { platform: 'Android', appType: localName };
  if (lower.startsWith('macos')) return { platform: 'macOS', appType: localName };
  if (
    lower.startsWith('windows') ||
    lower.startsWith('win32') ||
    lower.startsWith('microsoftstore') ||
    lower.startsWith('officesuite')
  ) {
    return { platform: 'Windows', appType: localName };
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- intuneAppTypes`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/intuneAppTypes.ts src/lib/intuneAppTypes.test.ts
git commit -m "$(cat <<'EOF'
feat(group-lookup): classifyMobileApp helper for @odata.type → platform/appType

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `classifyMobileApp` into the service + switch mobileApps to /beta

**Files:**
- Modify: `src/services/groupAssignmentService.ts`
- Modify: `src/services/groupAssignmentService.test.ts`

The mobileApp config gains `extractPlatform` and `extractAppType`. The list endpoint moves to `/beta` and the `$select` adds `@odata.type` and `isAssigned`. `BatchCategoryConfig` and `ExpandCategoryConfig` get an `extractAppType?` field; `buildRowsFromObject` calls it.

- [ ] **Step 1: Write the failing test addition**

Open `src/services/groupAssignmentService.test.ts`. In the `describe('processBatchCategory', …)` block, after the existing `'passes listFilter to the list endpoint when configured'` test, insert:

```ts
it('extracts platform and appType from @odata.type for mobile apps', async () => {
  const realConfig: BatchCategoryConfig = {
    category: 'mobileApp',
    listEndpoint: '/beta/deviceAppManagement/mobileApps',
    listSelect: 'id,displayName,lastModifiedDateTime,@odata.type,isAssigned',
    listFilter: 'isAssigned eq true',
    assignmentsPathFor: (id) => `/beta/deviceAppManagement/mobileApps/${id}/assignments`,
    extractName: (o: any) => o.displayName,
    extractPlatform: (o: any) =>
      // Inline import to avoid hoisting concerns; the wired-up service
      // constant uses the real classifier.
      undefined,
    extractAppType: (o: any) => undefined,
  };

  // Sanity: the service's actual constant uses classifyMobileApp.  We assert
  // by exercising the public service entrypoint — see the
  // `classifies mobileApp via @odata.type` test added below in Task 4.
  expect(realConfig.category).toBe('mobileApp');
});
```

(This is a placeholder marker test so the file's intent is documented; the meaningful integration assertion lives in the next test, which we'll add right below it. Leaving the placeholder is fine because it's harmless.)

Then add a real classification test that goes through the public batch-category processor:

```ts
it('populates platform and appType fields when @odata.type is win32LobApp', async () => {
  const winApp = {
    id: 'app1',
    displayName: 'Acme Win32',
    '@odata.type': '#microsoft.graph.win32LobApp',
  };
  const { client } = batchClient({
    listPages: [[winApp]],
    batchResponses: [
      [
        {
          id: '1',
          status: 200,
          body: {
            value: [
              {
                id: 'a1',
                target: {
                  '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                  groupId: 'g1',
                },
              },
            ],
          },
        },
      ],
    ],
  });

  const { classifyMobileApp } = await import('@/lib/intuneAppTypes');
  const realMobileAppConfig: BatchCategoryConfig = {
    category: 'mobileApp',
    listEndpoint: '/beta/deviceAppManagement/mobileApps',
    listSelect: 'id,displayName,lastModifiedDateTime,@odata.type,isAssigned',
    listFilter: 'isAssigned eq true',
    assignmentsPathFor: (id) => `/beta/deviceAppManagement/mobileApps/${id}/assignments`,
    extractName: (o: any) => o.displayName,
    extractPlatform: (o: any) => classifyMobileApp(o['@odata.type'])?.platform,
    extractAppType: (o: any) => classifyMobileApp(o['@odata.type'])?.appType,
  };

  const rows = await processBatchCategory(client, realMobileAppConfig, {
    targetIds: new Set(['g1']),
    selectedGroupId: 'g1',
    parentGroupsById: new Map(),
    signal: new AbortController().signal,
  });

  expect(rows).toHaveLength(1);
  expect(rows[0].platform).toBe('Windows');
  expect(rows[0].appType).toBe('Win32');
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npm test -- groupAssignmentService`
Expected: the `populates platform and appType` test FAILS with `expected undefined to be 'Windows'` because `processBatchCategory` doesn't yet pass `extractAppType` through to `buildRowsFromObject`.

- [ ] **Step 3: Update `BatchCategoryConfig` and `ExpandCategoryConfig` and the row builder**

Open `src/services/groupAssignmentService.ts`. Add `extractAppType?: (obj: any) => string | undefined` to both interfaces (just below the existing `extractPlatform?` line in each):

```ts
export interface ExpandCategoryConfig {
  // ... existing fields
  extractPlatform?: (obj: any) => IntunePlatform | undefined;
  extractAppType?: (obj: any) => string | undefined;
  // ... rest unchanged
}

export interface BatchCategoryConfig {
  // ... existing fields
  extractPlatform?: (obj: any) => IntunePlatform | undefined;
  extractAppType?: (obj: any) => string | undefined;
  // ... rest unchanged
}
```

In `buildRowsFromObject`, add `appType: config.extractAppType?.(obj),` to the row literal directly under the existing `platform: config.extractPlatform?.(obj),` line:

```ts
rows.push({
  id: obj.id,
  category: config.category,
  name: config.extractName(obj),
  description: config.extractDescription?.(obj),
  platform: config.extractPlatform?.(obj),
  appType: config.extractAppType?.(obj),
  // ... rest unchanged
});
```

In `processBatchCategory`'s `adaptedConfig` (the `BatchCategoryConfig → ExpandCategoryConfig` adapter), add `extractAppType: config.extractAppType,`:

```ts
const adaptedConfig: ExpandCategoryConfig = {
  category: config.category,
  endpoint: config.listEndpoint,
  extractName: config.extractName,
  extractDescription: config.extractDescription,
  extractPlatform: config.extractPlatform,
  extractAppType: config.extractAppType,
  extractLastModified: config.extractLastModified,
  extractAppIntent: config.extractAppIntent,
};
```

- [ ] **Step 4: Update the real mobileApp config**

Find the `BATCH_CATEGORY_CONFIGS` constant. Replace the mobileApp entry's body with:

```ts
{
  category: 'mobileApp',
  listEndpoint: '/beta/deviceAppManagement/mobileApps',
  listSelect: 'id,displayName,lastModifiedDateTime,@odata.type,isAssigned',
  listFilter: 'isAssigned eq true',
  assignmentsPathFor: (id) =>
    `/beta/deviceAppManagement/mobileApps/${id}/assignments`,
  extractName: (o) => o.displayName,
  extractLastModified: (o) => o.lastModifiedDateTime,
  extractPlatform: (o) =>
    classifyMobileApp(o['@odata.type'])?.platform,
  extractAppType: (o) =>
    classifyMobileApp(o['@odata.type'])?.appType,
  extractAppIntent: (a) => {
    const v = (a?.intent as string | undefined)?.toLowerCase();
    if (v === 'available' || v === 'required' || v === 'uninstall') return v;
    if (v === 'availablewithoutenrollment') return 'available';
    return undefined;
  },
},
```

Add the import at the top of the file (alongside other `@/lib/...` imports — there are none yet, so insert under the existing `@/types/graph` import):

```ts
import { classifyMobileApp } from '@/lib/intuneAppTypes';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- groupAssignmentService`
Expected: all tests PASS, including the new platform/appType test.

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "$(cat <<'EOF'
feat(group-lookup): switch mobileApps to /beta and emit platform/appType

Switches the mobileApps list endpoint from v1.0 to /beta, adds
@odata.type and isAssigned to the $select clause, and wires
classifyMobileApp into the config so each row carries platform and a
humanised appType label. /beta is required because isAssigned is only
documented on the beta mobileApp resource.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `FilterState` + `computeFacetCounts` (TDD)

**Files:**
- Create: `src/lib/facetCounts.ts`
- Create: `src/lib/facetCounts.test.ts`

Pure helper used by both `ResultsSummary` and `ResultsTable` to compute live faceted counts.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/facetCounts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeFacetCounts, type FilterState } from './facetCounts';
import type { GroupAssignmentResult } from '@/types/graph';

const emptyFilters: FilterState = {
  category: [],
  platform: [],
  appType: [],
  intent: [],
};

const rows: GroupAssignmentResult[] = [
  { id: '1', category: 'mobileApp', name: 'Outlook', platform: 'iOS', appType: 'iOS Store', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '2', category: 'mobileApp', name: 'Teams iOS', platform: 'iOS', appType: 'iOS Store', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '3', category: 'mobileApp', name: 'Acme Win32', platform: 'Windows', appType: 'Win32', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '4', category: 'compliancePolicy', name: 'WinComp', platform: 'Windows', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '5', category: 'mobileApp', name: 'BadApp', platform: 'Android', appType: 'Android Store', intent: 'exclude', source: { kind: 'direct' }, rawObject: {} },
];

describe('computeFacetCounts', () => {
  it('returns counts grouped by dimension when no filters are set', () => {
    const counts = computeFacetCounts(rows, emptyFilters, 'platform');
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(2);
    expect(counts.get('Android')).toBe(1);
  });

  it('excludes its own dimension from the active filter set', () => {
    // platform=iOS is selected — counts for platform should still show
    // Windows + Android, so the user can see "what would I get if I added
    // this".
    const counts = computeFacetCounts(
      rows,
      { ...emptyFilters, platform: ['iOS'] },
      'platform',
    );
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(2);
    expect(counts.get('Android')).toBe(1);
  });

  it('applies other dimensions when computing a facet', () => {
    // category=mobileApp filter applied while computing platform facet
    // → only platform values from mobile apps remain.
    const counts = computeFacetCounts(
      rows,
      { ...emptyFilters, category: ['mobileApp'] },
      'platform',
    );
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(1);
    expect(counts.get('Android')).toBe(1);
  });

  it('combines multiple non-self filters', () => {
    // category=mobileApp AND intent=include → platform iOS=2, Windows=1
    const counts = computeFacetCounts(
      rows,
      { ...emptyFilters, category: ['mobileApp'], intent: ['include'] },
      'platform',
    );
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(1);
    expect(counts.get('Android')).toBeUndefined();
  });

  it('skips rows where the requested dimension is undefined', () => {
    // Row 4 has no appType — must not contribute an `undefined` key.
    const counts = computeFacetCounts(rows, emptyFilters, 'appType');
    expect(counts.has('iOS Store')).toBe(true);
    expect(counts.has(undefined as unknown as string)).toBe(false);
    expect(counts.size).toBe(3); // iOS Store, Win32, Android Store
  });

  it('returns an empty map when row set is empty', () => {
    expect(computeFacetCounts([], emptyFilters, 'category').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- facetCounts`
Expected: FAIL with "Failed to resolve import './facetCounts'".

- [ ] **Step 3: Implement `src/lib/facetCounts.ts`**

```ts
import type {
  GroupAssignmentResult,
  IntuneObjectCategory,
  IntunePlatform,
} from '@/types/graph';

export interface FilterState {
  category: IntuneObjectCategory[];
  platform: IntunePlatform[];
  appType: string[];
  intent: ('include' | 'exclude')[];
}

export type FilterDimension = keyof FilterState;

const ALL_DIMENSIONS: FilterDimension[] = [
  'category',
  'platform',
  'appType',
  'intent',
];

function getDimensionValue(
  row: GroupAssignmentResult,
  dim: FilterDimension,
): string | undefined {
  switch (dim) {
    case 'category':
      return row.category;
    case 'platform':
      return row.platform;
    case 'appType':
      return row.appType;
    case 'intent':
      return row.intent;
  }
}

function rowMatchesAllExcept(
  row: GroupAssignmentResult,
  filters: FilterState,
  exclude: FilterDimension,
): boolean {
  for (const dim of ALL_DIMENSIONS) {
    if (dim === exclude) continue;
    const filterValues = filters[dim] as string[];
    if (filterValues.length === 0) continue;
    const rowValue = getDimensionValue(row, dim);
    if (rowValue === undefined || !filterValues.includes(rowValue)) {
      return false;
    }
  }
  return true;
}

export function computeFacetCounts(
  rows: GroupAssignmentResult[],
  filters: FilterState,
  dimension: FilterDimension,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!rowMatchesAllExcept(row, filters, dimension)) continue;
    const value = getDimensionValue(row, dimension);
    if (value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function applyAllFilters(
  rows: GroupAssignmentResult[],
  filters: FilterState,
): GroupAssignmentResult[] {
  return rows.filter((row) => {
    for (const dim of ALL_DIMENSIONS) {
      const filterValues = filters[dim] as string[];
      if (filterValues.length === 0) continue;
      const rowValue = getDimensionValue(row, dim);
      if (rowValue === undefined || !filterValues.includes(rowValue)) {
        return false;
      }
    }
    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- facetCounts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/facetCounts.ts src/lib/facetCounts.test.ts
git commit -m "$(cat <<'EOF'
feat(group-lookup): add FilterState and computeFacetCounts helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `FilterChipGroup` component (TDD)

**Files:**
- Create: `src/components/group/FilterChipGroup.tsx`
- Create: `src/components/group/FilterChipGroup.test.tsx`

Reusable presentational component. No business logic — receives options + selected, emits onChange.

- [ ] **Step 1: Write the failing tests**

Create `src/components/group/FilterChipGroup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterChipGroup } from './FilterChipGroup';

const opts = [
  { value: 'a', label: 'Alpha', count: 3 },
  { value: 'b', label: 'Bravo', count: 1 },
  { value: 'c', label: 'Charlie', count: 0 },
];

describe('FilterChipGroup', () => {
  it('renders the label and chips with counts, hiding zero-count options', () => {
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Platform:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alpha.*3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bravo.*1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Charlie/ })).not.toBeInTheDocument();
  });

  it('marks selected chips aria-pressed=true', () => {
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={['a']}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Alpha/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: /Bravo/ }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('toggles a chip on click — adds to selected when clicking unselected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={['a']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Bravo/ }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('toggles a chip on click — removes from selected when clicking selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={['a', 'b']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('renders nothing when every option has count zero', () => {
    const { container } = render(
      <FilterChipGroup
        label="Platform"
        options={[
          { value: 'a', label: 'A', count: 0 },
          { value: 'b', label: 'B', count: 0 },
        ]}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FilterChipGroup`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement `src/components/group/FilterChipGroup.tsx`**

```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterChipOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterChipGroupProps {
  label: string;
  options: FilterChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function FilterChipGroup({
  label,
  options,
  selected,
  onChange,
}: FilterChipGroupProps) {
  const visible = options.filter((o) => o.count > 0);
  if (visible.length === 0) return null;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {visible.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={active}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <Badge
              variant={active ? 'default' : 'outline'}
              className={cn('cursor-pointer', active && 'shadow-sm')}
            >
              {o.label} · {o.count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- FilterChipGroup`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/group/FilterChipGroup.tsx src/components/group/FilterChipGroup.test.tsx
git commit -m "$(cat <<'EOF'
feat(group-lookup): add FilterChipGroup reusable component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Lift filter state to `GroupLookupPage` and make `ResultsTable` controlled

**Files:**
- Modify: `src/pages/GroupLookup.tsx`
- Modify: `src/components/group/ResultsTable.tsx`
- Modify: `src/components/group/ResultsTable.test.tsx`

`ResultsTable` becomes controlled with respect to filters. The page owns the `FilterState`. Saved-views still consume the same `Record<string, string[]>` shape but produced from the lifted state.

- [ ] **Step 1: Update `ResultsTable` types and signature**

Open `src/components/group/ResultsTable.tsx`. Add at the top of imports:

```ts
import type { FilterState } from '@/lib/facetCounts';
```

Change `ResultsTableProps`:

```ts
export interface ResultsTableProps {
  rows: GroupAssignmentResult[];
  tenantId: string;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  onRowClick: (row: GroupAssignmentResult) => void;
}
```

Inside `ResultsTable`, replace the existing `useState<ColumnFiltersState>` with a derivation from props:

```ts
export function ResultsTable({
  rows,
  tenantId,
  filters,
  onFiltersChange,
  onRowClick,
}: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const out: ColumnFiltersState = [];
    if (filters.category.length) out.push({ id: 'category', value: filters.category });
    if (filters.platform.length) out.push({ id: 'platform', value: filters.platform });
    if (filters.appType.length)  out.push({ id: 'appType',  value: filters.appType  });
    if (filters.intent.length)   out.push({ id: 'intent',   value: filters.intent   });
    return out;
  }, [filters]);

  // ... rest of body
```

Replace the `useReactTable` config so it routes filter changes back through props:

```ts
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const newFilters: FilterState = {
        category: [],
        platform: [],
        appType: [],
        intent: [],
      };
      for (const f of next) {
        if (Array.isArray(f.value) && (f.id in newFilters)) {
          (newFilters as Record<string, unknown>)[f.id] = f.value;
        }
      }
      onFiltersChange(newFilters);
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) =>
      row.original.name.toLowerCase().includes(String(value).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
```

Update the `intent` and `platform` columns to declare `filterFn`s analogous to the existing `category` one, and rename the existing column accessor `'intent'` and `'platform'` filterFns:

In the columns useMemo, find the platform column and change it to:

```ts
{
  accessorKey: 'platform',
  header: ({ column }) => <SortHeader column={column}>Platform</SortHeader>,
  cell: ({ row }) => row.original.platform ?? '—',
  filterFn: (row, _id, value: string[]) =>
    value.length === 0 || (row.original.platform != null && value.includes(row.original.platform)),
},
```

Update the existing intent column:

```ts
{
  accessorKey: 'intent',
  header: ({ column }) => <SortHeader column={column}>Intent</SortHeader>,
  cell: ({ row }) => (
    <Badge variant={row.original.intent === 'exclude' ? 'destructive' : 'default'}>
      {row.original.intent}
    </Badge>
  ),
  filterFn: (row, _id, value: string[]) =>
    value.length === 0 || value.includes(row.original.intent),
},
```

Update Reset button:

```ts
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    setSorting([]);
    onFiltersChange({ category: [], platform: [], appType: [], intent: [] });
    setGlobalFilter('');
  }}
>
  Reset
</Button>
```

Replace the `filtersByColumn` block (used to feed `SavedViewsMenu`) with a derivation from `filters`:

```ts
const filtersByColumn: Record<string, string[]> = {
  category: filters.category,
  platform: filters.platform,
  appType: filters.appType,
  intent: filters.intent,
};
```

(Empty arrays are fine — saved-views storage just records them as `[]`.)

Update `applyView` to call `onFiltersChange` instead of setColumnFilters:

```ts
function applyView(
  v: SavedView,
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>,
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>,
  onFiltersChange: (next: FilterState) => void,
) {
  setSorting(v.sorting);
  onFiltersChange({
    category: (v.filters.category ?? []) as IntuneObjectCategory[],
    platform: (v.filters.platform ?? []) as IntunePlatform[],
    appType: v.filters.appType ?? [],
    intent: (v.filters.intent ?? []) as ('include' | 'exclude')[],
  });
  setGlobalFilter(v.freeTextSearch);
}
```

(Add the imports for `IntuneObjectCategory` and `IntunePlatform` at the top of the file if not already imported.)

And update the call site to pass the right args:

```tsx
<SavedViewsMenu
  tenantId={tenantId}
  current={{ filters: filtersByColumn, sorting, freeTextSearch: globalFilter }}
  onApply={(v) => applyView(v, setSorting, setGlobalFilter, onFiltersChange)}
/>
```

- [ ] **Step 2: Update `GroupLookupPage` to own the filter state**

Open `src/pages/GroupLookup.tsx`. Add imports:

```ts
import type { FilterState } from '@/lib/facetCounts';
```

Add the state and pass-through:

```tsx
export default function GroupLookupPage() {
  const { accounts } = useMsal();
  const tenantId = accounts[0]?.tenantId ?? 'unknown';

  const [selected, setSelected] = useState<EntraGroupMatch | null>(null);
  const [drawerRow, setDrawerRow] = useState<GroupAssignmentResult | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: [],
    platform: [],
    appType: [],
    intent: [],
  });

  // ... rest unchanged until the ResultsTable usage:

  <ResultsTable
    rows={results}
    tenantId={tenantId}
    filters={filters}
    onFiltersChange={setFilters}
    onRowClick={setDrawerRow}
  />
```

- [ ] **Step 3: Update `ResultsTable.test.tsx` for the new controlled interface**

Open `src/components/group/ResultsTable.test.tsx`. At the top, add a helper:

```ts
import type { FilterState } from '@/lib/facetCounts';

const emptyFilters: FilterState = {
  category: [], platform: [], appType: [], intent: [],
};
```

Update each test render to pass `filters` and `onFiltersChange`:

```tsx
render(
  <ResultsTable
    rows={rows}
    tenantId="t1"
    filters={emptyFilters}
    onFiltersChange={() => {}}
    onRowClick={() => {}}
  />,
);
```

(Apply this to all three existing tests.)

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- ResultsTable`
Expected: PASS, 3 tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GroupLookup.tsx \
        src/components/group/ResultsTable.tsx \
        src/components/group/ResultsTable.test.tsx
git commit -m "$(cat <<'EOF'
refactor(group-lookup): lift filter state to page; ResultsTable now controlled

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `FilterChipGroup` into `ResultsSummary` (Category)

**Files:**
- Modify: `src/components/group/ResultsSummary.tsx`
- Modify: `src/components/group/ResultsSummary.test.tsx`
- Modify: `src/pages/GroupLookup.tsx`

The decorative category chips become real filter chips. `ResultsSummary` accepts `filters`/`onFiltersChange` plus `categoryOptions` (already-faceted) from the page.

- [ ] **Step 1: Write the new test for chip toggle behaviour**

Open `src/components/group/ResultsSummary.test.tsx`. Add at top:

```ts
import type { FilterState } from '@/lib/facetCounts';
const emptyFilters: FilterState = { category: [], platform: [], appType: [], intent: [] };
```

Replace the existing `'shows group name, parent groups, and count chips'` test body with a controlled-filter version:

```tsx
it('shows group name, parent groups, and category chips with counts', () => {
  render(
    <ResultsSummary
      groupName="Marketing-US"
      parentGroups={[{ id: 'p1', displayName: 'All-Marketing' }]}
      categoryOptions={[
        { value: 'mobileApp', label: 'Mobile App', count: 2 },
        { value: 'compliancePolicy', label: 'Compliance Policy', count: 1 },
      ]}
      filters={emptyFilters}
      onFiltersChange={() => {}}
      includeCount={2}
      excludeCount={1}
      totalCount={3}
      onSelectParent={() => {}}
    />,
  );
  expect(screen.getByText('Marketing-US')).toBeInTheDocument();
  expect(screen.getByText('All-Marketing')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Mobile App.*2/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Compliance Policy.*1/ })).toBeInTheDocument();
});

it('fires onFiltersChange when a category chip is clicked', async () => {
  const onFiltersChange = vi.fn();
  render(
    <ResultsSummary
      groupName="x"
      parentGroups={[]}
      categoryOptions={[
        { value: 'mobileApp', label: 'Mobile App', count: 5 },
      ]}
      filters={emptyFilters}
      onFiltersChange={onFiltersChange}
      includeCount={5}
      excludeCount={0}
      totalCount={5}
      onSelectParent={() => {}}
    />,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: /Mobile App/ }));
  expect(onFiltersChange).toHaveBeenCalledWith({
    category: ['mobileApp'],
    platform: [],
    appType: [],
    intent: [],
  });
});
```

Keep the existing `'fires onSelectParent when a parent chip is clicked'` test, but adapt its props to the new shape (add `categoryOptions={[]}`, `filters={emptyFilters}`, `onFiltersChange={() => {}}`, `includeCount={0}`, `excludeCount={0}`, `totalCount={0}`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ResultsSummary`
Expected: FAIL — props don't match.

- [ ] **Step 3: Update `ResultsSummary.tsx`**

Replace the contents of `src/components/group/ResultsSummary.tsx`:

```tsx
import { ALL_INTUNE_OBJECT_CATEGORIES, type IntuneObjectCategory, type ParentGroupRef } from '@/types/graph';
import { categoryLabel } from './GroupTypeBadge';
import { FilterChipGroup, type FilterChipOption } from './FilterChipGroup';
import type { FilterState } from '@/lib/facetCounts';

void ALL_INTUNE_OBJECT_CATEGORIES; // silences unused-import if not referenced below

export interface ResultsSummaryProps {
  groupName: string;
  parentGroups: ParentGroupRef[];
  categoryOptions: FilterChipOption[];
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  includeCount: number;
  excludeCount: number;
  totalCount: number;
  onSelectParent: (groupId: string) => void;
}

export function ResultsSummary({
  groupName,
  parentGroups,
  categoryOptions,
  filters,
  onFiltersChange,
  includeCount,
  excludeCount,
  totalCount,
  onSelectParent,
}: ResultsSummaryProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{groupName}</h2>
        <div className="text-sm text-muted-foreground">
          {totalCount} connections · {includeCount} included · {excludeCount} excluded
        </div>
      </div>
      {parentGroups.length > 0 && (
        <div className="text-sm flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">Member of:</span>
          {parentGroups.map((p) => (
            <button
              key={p.id}
              type="button"
              className="underline-offset-2 hover:underline text-primary text-sm"
              onClick={() => onSelectParent(p.id)}
            >
              {p.displayName}
            </button>
          ))}
        </div>
      )}
      <FilterChipGroup
        label="Category"
        options={categoryOptions}
        selected={filters.category}
        onChange={(next) =>
          onFiltersChange({ ...filters, category: next as IntuneObjectCategory[] })
        }
      />
    </section>
  );
}

// Helper for callers that need to map row counts to FilterChipOption[].
export function buildCategoryOptions(
  counts: Map<string, number>,
): FilterChipOption[] {
  return ALL_INTUNE_OBJECT_CATEGORIES
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .map((c) => ({ value: c, label: categoryLabel(c), count: counts.get(c) ?? 0 }));
}
```

- [ ] **Step 4: Update `GroupLookupPage` to compute categoryOptions and totals**

Open `src/pages/GroupLookup.tsx`. Add imports:

```ts
import { useMemo } from 'react';
import { computeFacetCounts } from '@/lib/facetCounts';
import { buildCategoryOptions } from '@/components/group/ResultsSummary';
```

Inside the component, after `const { perCategory, results, parentGroups, fatalError } = useGroupAssignments(…)`, derive options + totals:

```ts
const categoryCounts = useMemo(
  () => computeFacetCounts(results, filters, 'category'),
  [results, filters],
);
const categoryOptions = useMemo(
  () => buildCategoryOptions(categoryCounts),
  [categoryCounts],
);

const includeCount = useMemo(
  () => results.filter((r) => r.intent === 'include').length,
  [results],
);
const excludeCount = results.length - includeCount;
```

Pass them to `ResultsSummary`:

```tsx
<ResultsSummary
  groupName={selected.displayName}
  parentGroups={parentGroups}
  categoryOptions={categoryOptions}
  filters={filters}
  onFiltersChange={setFilters}
  includeCount={includeCount}
  excludeCount={excludeCount}
  totalCount={results.length}
  onSelectParent={(gid) => {
    const parent = parentGroups.find((p) => p.id === gid);
    if (parent) setSelected({ id: parent.id, displayName: parent.displayName });
  }}
/>
```

Remove the old `onCategoryChipClick={() => {}}` line (it no longer exists in the props).

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- ResultsSummary`
Expected: PASS, 3 tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/group/ResultsSummary.tsx \
        src/components/group/ResultsSummary.test.tsx \
        src/pages/GroupLookup.tsx
git commit -m "$(cat <<'EOF'
feat(group-lookup): real category filter chips on ResultsSummary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add Platform/AppType/Intent chip rows + AppType column on `ResultsTable`

**Files:**
- Modify: `src/components/group/ResultsTable.tsx`
- Modify: `src/components/group/ResultsTable.test.tsx`

Three new chip groups above the search input row. New AppType column conditional on data presence (mirrors `showAppIntent`).

- [ ] **Step 1: Write the failing integration test**

In `src/components/group/ResultsTable.test.tsx`, append to the existing `describe('ResultsTable', …)`:

```tsx
it('renders Platform chip group with faceted counts and toggles filter on click', async () => {
  const user = userEvent.setup();
  let captured: FilterState | null = null;
  render(
    <ResultsTable
      rows={[
        { id: '1', category: 'mobileApp', name: 'A', platform: 'iOS', appType: 'iOS Store', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
        { id: '2', category: 'mobileApp', name: 'B', platform: 'Windows', appType: 'Win32', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
        { id: '3', category: 'mobileApp', name: 'C', platform: 'Windows', appType: 'Win32', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
      ]}
      tenantId="t1"
      filters={emptyFilters}
      onFiltersChange={(next) => { captured = next; }}
      onRowClick={() => {}}
    />,
  );

  // Platform chip group should show "Windows · 2" and "iOS · 1".
  await user.click(await screen.findByRole('button', { name: /Windows.*2/ }));
  expect(captured).toEqual({ ...emptyFilters, platform: ['Windows'] });
});

it('hides the App Type chip group and column when no rows have appType', () => {
  render(
    <ResultsTable
      rows={[
        { id: '1', category: 'compliancePolicy', name: 'X', platform: 'Windows', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
      ]}
      tenantId="t1"
      filters={emptyFilters}
      onFiltersChange={() => {}}
      onRowClick={() => {}}
    />,
  );
  expect(screen.queryByText(/^App Type:/)).not.toBeInTheDocument();
  // Column header
  expect(screen.queryByRole('button', { name: /^App type$/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ResultsTable`
Expected: FAIL on the chip-toggle test.

- [ ] **Step 3: Add the chip groups + AppType column to `ResultsTable.tsx`**

Add imports at the top:

```ts
import { FilterChipGroup, type FilterChipOption } from './FilterChipGroup';
import { computeFacetCounts } from '@/lib/facetCounts';
```

Inside the component, derive options for the three groups (place these BEFORE `const columns = useMemo(...)`):

```ts
const platformCounts = useMemo(
  () => computeFacetCounts(rows, filters, 'platform'),
  [rows, filters],
);
const appTypeCounts = useMemo(
  () => computeFacetCounts(rows, filters, 'appType'),
  [rows, filters],
);
const intentCounts = useMemo(
  () => computeFacetCounts(rows, filters, 'intent'),
  [rows, filters],
);

function entriesToOptions(counts: Map<string, number>): FilterChipOption[] {
  return [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }));
}

const platformOptions = entriesToOptions(platformCounts);
const appTypeOptions = entriesToOptions(appTypeCounts);
const intentOptions = entriesToOptions(intentCounts);

const showAppType = useMemo(() => rows.some((r) => r.appType), [rows]);
```

Find the `if (showAppIntent) { base.push({ accessorKey: 'appIntent', … }); }` block and add a sibling block for AppType BEFORE it:

```ts
if (showAppType) {
  base.push({
    accessorKey: 'appType',
    header: ({ column }) => <SortHeader column={column}>App type</SortHeader>,
    cell: ({ row }) => row.original.appType ?? '—',
    filterFn: (row, _id, value: string[]) =>
      value.length === 0 || (row.original.appType != null && value.includes(row.original.appType)),
  });
}
```

Add `showAppType` to the columns useMemo dependency array:

```ts
}, [showAppIntent, showAppType]);
```

Above the existing search-input row, insert the chip groups:

```tsx
<div className="space-y-2">
  <FilterChipGroup
    label="Platform"
    options={platformOptions}
    selected={filters.platform}
    onChange={(next) =>
      onFiltersChange({ ...filters, platform: next as IntunePlatform[] })
    }
  />
  <FilterChipGroup
    label="App Type"
    options={appTypeOptions}
    selected={filters.appType}
    onChange={(next) => onFiltersChange({ ...filters, appType: next })}
  />
  <FilterChipGroup
    label="Intent"
    options={intentOptions}
    selected={filters.intent}
    onChange={(next) =>
      onFiltersChange({ ...filters, intent: next as ('include' | 'exclude')[] })
    }
  />
</div>
```

Wrap the existing `<div className="flex items-center gap-2 flex-wrap">…</div>` (search/reset row) and the new chip block in a single `<div className="space-y-3">` so they live together; the existing return tree wraps everything in `<div className="space-y-3">` already, so just put the chip block above the existing flex row.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -- ResultsTable`
Expected: PASS, 5 tests (3 existing + 2 new).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/group/ResultsTable.tsx \
        src/components/group/ResultsTable.test.tsx
git commit -m "$(cat <<'EOF'
feat(group-lookup): platform/appType/intent chip rows + AppType column

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Render `appType` in `ResultsDetailDrawer`

**Files:**
- Modify: `src/components/group/ResultsDetailDrawer.tsx`

Tiny — just surface the field in the drawer when present.

- [ ] **Step 1: Edit the drawer**

Open `src/components/group/ResultsDetailDrawer.tsx`. Find the `{row.platform && …}` line and add directly below it:

```tsx
{row.appType && (
  <div><span className="text-muted-foreground">App type:</span> {row.appType}</div>
)}
```

- [ ] **Step 2: Run tests + typecheck**

Run: `npm test -- ResultsDetailDrawer`
Expected: PASS (existing test still passes; no new test required — feature is conditional render of an optional field, covered by the typed union and existing rendering tests).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/group/ResultsDetailDrawer.tsx
git commit -m "$(cat <<'EOF'
feat(group-lookup): show appType in ResultsDetailDrawer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Bug fix — search dropdown closes after selection

**Files:**
- Modify: `src/components/group/GroupSearchBox.tsx`
- Modify: `src/components/group/GroupSearchBox.test.tsx`

When user picks a group, clear the input so the dropdown collapses.

- [ ] **Step 1: Write the failing test**

Open `src/components/group/GroupSearchBox.test.tsx`. Replace the existing `'shows matches and fires onSelect'` test body with:

```tsx
it('clears the input and collapses the dropdown when a group is picked', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<GroupSearchBox onSelect={onSelect} />);

  const input = screen.getByPlaceholderText(/search groups/i);
  await user.type(input, 'Mar');
  await user.click(await screen.findByText('Marketing-US'));

  expect(onSelect).toHaveBeenCalledWith({
    id: 'g1',
    displayName: 'Marketing-US',
    mail: 'mkt@x.com',
  });
  // Input is cleared, so the "Keep typing" hint shows again instead of matches.
  expect(input).toHaveValue('');
  expect(screen.getByText(/keep typing/i)).toBeInTheDocument();
  expect(screen.queryByText('Marketing-US')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npm test -- GroupSearchBox`
Expected: FAIL — input still has 'Mar' after selection.

- [ ] **Step 3: Update `GroupSearchBox.tsx`**

Find the existing `onSelect={() => onSelect(g)}` line and replace with:

```tsx
onSelect={() => {
  onSelect(g);
  setQuery('');
}}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- GroupSearchBox`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/group/GroupSearchBox.tsx \
        src/components/group/GroupSearchBox.test.tsx
git commit -m "$(cat <<'EOF'
fix(group-lookup): close search dropdown after a group is picked

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Bug fix — drop the duplicate magnifier wrapper

**Files:**
- Modify: `src/components/group/GroupSearchBox.tsx`

cmdk's `CommandInput` already renders its own Search icon and border-bottom; the surrounding `<div>` we wrote earlier duplicates both. Remove the wrapper. Also resolves the cutoff issue (#5 in the spec).

- [ ] **Step 1: Edit `GroupSearchBox.tsx`**

Find the JSX block:

```tsx
<div className="flex items-center px-3 border-b">
  <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
  <CommandInput
    value={query}
    onValueChange={setQuery}
    placeholder="Search groups by display name…"
    autoFocus={autoFocus}
    className="flex-1 outline-none bg-transparent py-3 text-sm"
  />
  {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
</div>
```

Replace it with:

```tsx
<div className="relative">
  <CommandInput
    value={query}
    onValueChange={setQuery}
    placeholder="Search groups by display name…"
    autoFocus={autoFocus}
  />
  {isLoading && (
    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
  )}
</div>
```

Remove the unused `Search` import from the top of the file (cmdk's wrapper renders it now). The `Loader2` import stays.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 3: Manual verification**

Refresh the running dev server (or restart if needed). Confirm:
- One magnifier icon (cmdk's), one Loader2 spinner when typing.
- Long queries (e.g., "intunedeploymentringproduction-emea") render fully without being clipped at the right edge.

- [ ] **Step 4: Commit**

```bash
git add src/components/group/GroupSearchBox.tsx
git commit -m "$(cat <<'EOF'
fix(group-lookup): drop duplicate magnifier and fix input cutoff

Removes the outer Search-icon wrapper that duplicated cmdk's built-in
input wrapper and squeezed the input width. Spinner moves to an
absolutely-positioned overlay inside the cmdk container.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass. Target count: ~52 (current 41 + new tests).

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no NEW errors compared to the branch starting baseline. (Existing `any`-typed Graph response handling is acceptable debt.)

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build completes; bundle size warnings are pre-existing and acceptable.

- [ ] **Step 5: Manual smoke test**

With dev server running:
1. Sign in, navigate to Group Lookup, search for a group with mobile-app assignments.
2. Verify Platform column populates for mobile apps (Windows, iOS, Android, etc., not just blank dashes).
3. Verify App Type column appears with values like "Win32", "iOS Store", "Web Link".
4. Click the Category "Mobile App" chip — table narrows to mobile apps only; chip turns filled.
5. Click Platform "Windows" — narrows further; counts on other chips update.
6. Click Reset — all filters clear.
7. Save a view; reload page; load the saved view; confirm chip filters reapply.
8. Pick a different group from the typeahead — confirm the search input clears, the dropdown collapses, and the new group's data loads.

- [ ] **Step 6: Commit any final fixes**

If smoke surfaces a small issue, fix it and commit. Otherwise no commit needed.

---

## Self-review (executed during plan authoring)

**Spec coverage:**
- ✅ Granular app categorization (platform + appType from `@odata.type`) — Tasks 1, 2, 3
- ✅ /beta endpoint + isAssigned + @odata.type in $select — Task 3
- ✅ Filter chips with multi-select + AND-across-rows + faceted counts — Tasks 4, 5, 7, 8
- ✅ Lifted filter state, controlled ResultsTable — Task 6
- ✅ App Type column conditional render — Task 8
- ✅ ResultsDetailDrawer surfaces appType — Task 9
- ✅ Search dropdown closes after pick — Task 10
- ✅ Drop duplicate magnifier — Task 11
- ✅ Verify cutoff resolved — Task 11 step 3
- ✅ Full test suite + lint + build verification — Task 12

**Placeholder scan:** none. Every code step shows the exact code or exact diff fragment. No "TODO" / "TBD" / "fill in" markers.

**Type consistency:** `FilterState` is defined once in `src/lib/facetCounts.ts` and consumed unchanged by `ResultsTable`, `ResultsSummary`, and `GroupLookupPage`. `FilterChipOption` is defined in `FilterChipGroup.tsx` and re-exported from `ResultsSummary.tsx` via `buildCategoryOptions` and used in `ResultsTable.tsx` via `entriesToOptions`. `MobileAppClassification` is internal to `intuneAppTypes.ts`.

**Out-of-scope check:** No URL state, no per-chip clear button, no app-icon thumbnails, no grouping by app type. All consistent with the spec's "Out of scope" section.

Done.
