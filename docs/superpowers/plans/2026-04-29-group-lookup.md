# Group Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/groups` page that lets the user pick an Entra group (typeahead) and see every Intune object (policies, apps, security configs, scripts, enrollment configs, etc.) directly assigned to that group **or** inherited via transitive parent-group membership, with a streaming per-category progress animation, a sortable/filterable data table, and a detail drawer.

**Architecture:** A new self-contained service (`groupAssignmentService`) performs parallel Graph fan-out, streaming per-category status and rows to a hook (`useGroupAssignments`) that powers the page. Existing `graphService.ts` is **not modified** to keep the existing search/dashboard regression-free. UI uses TanStack Table + shadcn primitives already in the project.

**Tech Stack:** React 18 + TypeScript + Vite, MSAL React, Microsoft Graph SDK (beta), shadcn/ui (Sheet, Table, Command, Popover, DropdownMenu), Tailwind, Lucide icons, **new:** `@tanstack/react-table`, **new (dev):** Vitest + React Testing Library + jsdom.

**Reference spec:** `docs/superpowers/specs/2026-04-29-group-lookup-design.md`

---

## File Map

**New files:**
- `vitest.config.ts` — Vitest config
- `src/test/setup.ts` — Vitest global setup (jest-dom matchers)
- `src/services/groupAssignmentService.ts` — Graph fan-out orchestrator (the meat of v1)
- `src/services/groupAssignmentService.test.ts`
- `src/hooks/useEntraGroupSearch.ts` + `.test.ts`
- `src/hooks/useGroupAssignments.ts` + `.test.ts`
- `src/components/group/GroupTypeBadge.tsx` + `.test.tsx`
- `src/components/group/GroupSearchBox.tsx` + `.test.tsx`
- `src/components/group/CategoryProgressList.tsx` + `.test.tsx`
- `src/components/group/ResultsSummary.tsx` + `.test.tsx`
- `src/components/group/ResultsDetailDrawer.tsx` + `.test.tsx`
- `src/components/group/ResultsTable.tsx` + `.test.tsx`
- `src/components/group/SavedViewsMenu.tsx` + `.test.tsx`
- `src/lib/savedViews.ts` + `.test.ts` — localStorage CRUD for saved filter views
- `src/pages/GroupLookup.tsx`

**Modified files:**
- `package.json` — add deps + `test` script
- `src/types/graph.ts` — append new types
- `src/App.tsx` — register `/groups` route
- `src/components/Header.tsx` — add nav link

---

## Task 1: Set up Vitest + RTL + add @tanstack/react-table

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Install runtime dependency**

```bash
npm install @tanstack/react-table
```

- [ ] **Step 3: Add `test` script to `package.json`**

In `package.json` `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `vitest.config.ts` in repo root**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

- [ ] **Step 5: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create a smoke test `src/test/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the smoke test**

Run: `npm test`
Expected: 1 passing test, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/test/smoke.test.ts
git commit -m "chore: add vitest, rtl, and @tanstack/react-table"
```

---

## Task 2: Add type definitions

**Files:**
- Modify: `src/types/graph.ts` (append at end)

- [ ] **Step 1: Append the new types to `src/types/graph.ts`**

Add at the very bottom of the file (after the `GraphError` interface):

```ts
// ============================================================================
// Group Lookup feature types
// ============================================================================

export type IntuneObjectCategory =
  | 'deviceConfiguration'
  | 'compliancePolicy'
  | 'configurationPolicy'
  | 'appProtection'
  | 'mobileApp'
  | 'appConfiguration'
  | 'endpointSecurity'
  | 'platformScript'
  | 'remediationScript'
  | 'complianceScript'
  | 'autopilotProfile'
  | 'enrollmentConfig'
  | 'updateRing';

export const ALL_INTUNE_OBJECT_CATEGORIES: IntuneObjectCategory[] = [
  'deviceConfiguration',
  'compliancePolicy',
  'configurationPolicy',
  'appProtection',
  'mobileApp',
  'appConfiguration',
  'endpointSecurity',
  'platformScript',
  'remediationScript',
  'complianceScript',
  'autopilotProfile',
  'enrollmentConfig',
  'updateRing',
];

export type GroupAssignmentSourceKind = 'direct' | 'parent';

export interface GroupAssignmentSource {
  kind: GroupAssignmentSourceKind;
  groupId?: string;
  groupName?: string;
}

export interface GroupAssignmentFilterRef {
  id: string;
  displayName?: string;
  mode: 'include' | 'exclude';
}

export type AssignmentIntent = 'include' | 'exclude';
export type AppInstallIntent = 'available' | 'required' | 'uninstall';
export type IntunePlatform =
  | 'Windows'
  | 'iOS'
  | 'Android'
  | 'macOS'
  | 'All Platforms';

export interface GroupAssignmentResult {
  id: string;
  category: IntuneObjectCategory;
  name: string;
  description?: string;
  platform?: IntunePlatform;
  intent: AssignmentIntent;
  appIntent?: AppInstallIntent;
  source: GroupAssignmentSource;
  filter?: GroupAssignmentFilterRef;
  lastModified?: string;
  rawObject: unknown;
}

export type CategoryStatus = 'pending' | 'loading' | 'done' | 'error';

export interface CategoryState {
  status: CategoryStatus;
  count?: number;
  error?: string;
}

export interface ParentGroupRef {
  id: string;
  displayName: string;
}

export interface GroupLookupState {
  groupId: string;
  groupName: string;
  parentGroups: ParentGroupRef[];
  perCategory: Record<IntuneObjectCategory, CategoryState>;
  results: GroupAssignmentResult[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. (If pre-existing errors exist, ignore unrelated ones.)

- [ ] **Step 3: Commit**

```bash
git add src/types/graph.ts
git commit -m "feat(types): add group lookup type definitions"
```

---

## Task 3: Service skeleton + group resolution

**Files:**
- Create: `src/services/groupAssignmentService.ts`
- Create: `src/services/groupAssignmentService.test.ts`

- [ ] **Step 1: Write failing tests for `resolveTargetGroupSet`**

Create `src/services/groupAssignmentService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { resolveTargetGroupSet } from './groupAssignmentService';

function makeMockClient(handlers: Record<string, () => unknown>): Client {
  return {
    api: (path: string) => {
      const handler = handlers[path];
      if (!handler) throw new Error(`Unmocked path: ${path}`);
      return {
        select: () => ({ get: async () => handler() }),
        header: () => ({
          get: async () => handler(),
          select: () => ({ get: async () => handler() }),
          top: () => ({ get: async () => handler() }),
        }),
        get: async () => handler(),
        top: () => ({ get: async () => handler() }),
      };
    },
  } as unknown as Client;
}

describe('resolveTargetGroupSet', () => {
  it('returns the selected group + parent groups', async () => {
    const client = makeMockClient({
      '/groups/g1': () => ({ id: 'g1', displayName: 'Marketing-US' }),
      '/groups/g1/transitiveMemberOf/microsoft.graph.group': () => ({
        value: [
          { id: 'p1', displayName: 'All-Marketing' },
          { id: 'p2', displayName: 'All-EMEA' },
        ],
      }),
    });

    const result = await resolveTargetGroupSet(client, 'g1');

    expect(result.groupName).toBe('Marketing-US');
    expect(result.parentGroups).toEqual([
      { id: 'p1', displayName: 'All-Marketing' },
      { id: 'p2', displayName: 'All-EMEA' },
    ]);
    expect([...result.targetIds]).toEqual(
      expect.arrayContaining(['g1', 'p1', 'p2']),
    );
    expect(result.targetIds.size).toBe(3);
  });

  it('returns just the group when there are no parents', async () => {
    const client = makeMockClient({
      '/groups/g1': () => ({ id: 'g1', displayName: 'Lonely' }),
      '/groups/g1/transitiveMemberOf/microsoft.graph.group': () => ({
        value: [],
      }),
    });

    const result = await resolveTargetGroupSet(client, 'g1');

    expect(result.parentGroups).toEqual([]);
    expect([...result.targetIds]).toEqual(['g1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- groupAssignmentService`
Expected: import error (`resolveTargetGroupSet` not found).

- [ ] **Step 3: Create `src/services/groupAssignmentService.ts` with the function**

```ts
import type { Client } from '@microsoft/microsoft-graph-client';
import type {
  GroupAssignmentResult,
  CategoryState,
  IntuneObjectCategory,
  ParentGroupRef,
} from '@/types/graph';

export interface ResolvedTargetGroupSet {
  groupName: string;
  parentGroups: ParentGroupRef[];
  targetIds: Set<string>;
}

export async function resolveTargetGroupSet(
  client: Client,
  groupId: string,
): Promise<ResolvedTargetGroupSet> {
  const group = (await client
    .api(`/groups/${groupId}`)
    .select('id,displayName')
    .get()) as { id: string; displayName: string };

  const parentResp = (await client
    .api(`/groups/${groupId}/transitiveMemberOf/microsoft.graph.group`)
    .header('ConsistencyLevel', 'eventual')
    .select('id,displayName')
    .top(999)
    .get()) as { value: Array<{ id: string; displayName: string }> };

  const parentGroups: ParentGroupRef[] = parentResp.value.map((g) => ({
    id: g.id,
    displayName: g.displayName,
  }));

  const targetIds = new Set<string>([groupId, ...parentGroups.map((p) => p.id)]);
  return { groupName: group.displayName, parentGroups, targetIds };
}

export interface FetchGroupAssignmentsCallbacks {
  signal: AbortSignal;
  onCategoryStatus: (cat: IntuneObjectCategory, state: CategoryState) => void;
  onResults: (cat: IntuneObjectCategory, rows: GroupAssignmentResult[]) => void;
  onParentGroups: (parents: ParentGroupRef[]) => void;
}

export async function fetchGroupAssignments(
  _client: Client,
  _groupId: string,
  _callbacks: FetchGroupAssignmentsCallbacks,
): Promise<void> {
  throw new Error('not implemented yet');
}
```

Note: the mock client in the test uses chainable `select`/`header`/`top` methods. The Graph SDK's actual `api(...)` builder also supports those chainably — the test mocks that surface.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- groupAssignmentService`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "feat(group-lookup): add target group resolution"
```

---

## Task 4: Generic expand-category processor

This task implements the helper used by the **10 categories** that support `?$expand=assignments` directly. Categories: `deviceConfiguration`, `compliancePolicy`, `configurationPolicy`, `appProtection`, `appConfiguration`, `platformScript`, `remediationScript`, `complianceScript`, `autopilotProfile`, `enrollmentConfig`.

**Files:**
- Modify: `src/services/groupAssignmentService.ts`
- Modify: `src/services/groupAssignmentService.test.ts`

- [ ] **Step 1: Write failing tests for `processExpandCategory`**

Append to `src/services/groupAssignmentService.test.ts`:

```ts
import {
  processExpandCategory,
  type ExpandCategoryConfig,
} from './groupAssignmentService';

describe('processExpandCategory', () => {
  const config: ExpandCategoryConfig = {
    category: 'deviceConfiguration',
    endpoint: '/deviceManagement/deviceConfigurations',
    extractName: (o: any) => o.displayName,
    extractDescription: (o: any) => o.description,
    extractPlatform: () => 'Windows',
    extractLastModified: (o: any) => o.lastModifiedDateTime,
  };

  function pageClient(pages: any[][]): Client {
    let i = 0;
    return {
      api: () => ({
        expand: () => ({
          top: () => ({
            get: async () => {
              const page = pages[i] ?? [];
              i++;
              return {
                value: page,
                '@odata.nextLink':
                  i < pages.length ? `next-${i}` : undefined,
              };
            },
          }),
        }),
        get: async () => {
          const page = pages[i] ?? [];
          i++;
          return {
            value: page,
            '@odata.nextLink': i < pages.length ? `next-${i}` : undefined,
          };
        },
      }),
    } as unknown as Client;
  }

  it('returns one row per matching include assignment', async () => {
    const client = pageClient([
      [
        {
          id: 'p1',
          displayName: 'Policy 1',
          description: 'd',
          lastModifiedDateTime: '2026-01-01T00:00:00Z',
          assignments: [
            {
              id: 'a1',
              target: {
                '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                groupId: 'g1',
              },
            },
          ],
        },
      ],
    ]);

    const rows = await processExpandCategory(client, config, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'p1',
      category: 'deviceConfiguration',
      name: 'Policy 1',
      intent: 'include',
      source: { kind: 'direct' },
      platform: 'Windows',
    });
  });

  it('marks exclusionGroupAssignmentTarget rows as exclude', async () => {
    const client = pageClient([
      [
        {
          id: 'p1',
          displayName: 'P',
          assignments: [
            {
              id: 'a1',
              target: {
                '@odata.type':
                  '#microsoft.graph.exclusionGroupAssignmentTarget',
                groupId: 'g1',
              },
            },
          ],
        },
      ],
    ]);

    const rows = await processExpandCategory(client, config, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(rows[0].intent).toBe('exclude');
  });

  it('labels parent-group assignments with parent source', async () => {
    const client = pageClient([
      [
        {
          id: 'p1',
          displayName: 'P',
          assignments: [
            {
              id: 'a1',
              target: {
                '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                groupId: 'parent1',
              },
            },
          ],
        },
      ],
    ]);

    const rows = await processExpandCategory(client, config, {
      targetIds: new Set(['g1', 'parent1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map([
        ['parent1', { id: 'parent1', displayName: 'Parent Group' }],
      ]),
      signal: new AbortController().signal,
    });

    expect(rows[0].source).toEqual({
      kind: 'parent',
      groupId: 'parent1',
      groupName: 'Parent Group',
    });
  });

  it('emits multiple rows when both direct and parent assignments match', async () => {
    const client = pageClient([
      [
        {
          id: 'p1',
          displayName: 'P',
          assignments: [
            {
              id: 'a1',
              target: {
                '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                groupId: 'g1',
              },
            },
            {
              id: 'a2',
              target: {
                '@odata.type':
                  '#microsoft.graph.exclusionGroupAssignmentTarget',
                groupId: 'parent1',
              },
            },
          ],
        },
      ],
    ]);

    const rows = await processExpandCategory(client, config, {
      targetIds: new Set(['g1', 'parent1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map([
        ['parent1', { id: 'parent1', displayName: 'Parent Group' }],
      ]),
      signal: new AbortController().signal,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.intent).sort()).toEqual(['exclude', 'include']);
  });

  it('extracts assignment filter info', async () => {
    const client = pageClient([
      [
        {
          id: 'p1',
          displayName: 'P',
          assignments: [
            {
              id: 'a1',
              target: {
                '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                groupId: 'g1',
                deviceAndAppManagementAssignmentFilterId: 'f1',
                deviceAndAppManagementAssignmentFilterType: 'include',
              },
            },
          ],
        },
      ],
    ]);

    const rows = await processExpandCategory(client, config, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(rows[0].filter).toEqual({ id: 'f1', mode: 'include' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- groupAssignmentService`
Expected: tests fail because `processExpandCategory` and `ExpandCategoryConfig` are not exported.

- [ ] **Step 3: Implement `processExpandCategory`**

Append to `src/services/groupAssignmentService.ts`:

```ts
import type {
  GroupAssignmentResult,
  GroupAssignmentSource,
  IntunePlatform,
  IntuneObjectCategory,
} from '@/types/graph';

export interface ExpandCategoryConfig {
  category: IntuneObjectCategory;
  endpoint: string;
  extractName: (obj: any) => string;
  extractDescription?: (obj: any) => string | undefined;
  extractPlatform?: (obj: any) => IntunePlatform | undefined;
  extractLastModified?: (obj: any) => string | undefined;
}

export interface ProcessContext {
  targetIds: Set<string>;
  selectedGroupId: string;
  parentGroupsById: Map<string, ParentGroupRef>;
  signal: AbortSignal;
}

const PAGE_SIZE = 200;

function classifySource(
  groupId: string,
  ctx: ProcessContext,
): GroupAssignmentSource {
  if (groupId === ctx.selectedGroupId) return { kind: 'direct' };
  const parent = ctx.parentGroupsById.get(groupId);
  return {
    kind: 'parent',
    groupId,
    groupName: parent?.displayName,
  };
}

function buildRowsFromObject(
  obj: any,
  config: ExpandCategoryConfig,
  ctx: ProcessContext,
): GroupAssignmentResult[] {
  const assignments: any[] = obj.assignments ?? [];
  const rows: GroupAssignmentResult[] = [];

  for (const a of assignments) {
    const targetType = a.target?.['@odata.type'] as string | undefined;
    const groupId = a.target?.groupId as string | undefined;
    if (!groupId || !ctx.targetIds.has(groupId)) continue;

    const isExclude = !!targetType && targetType.endsWith('exclusionGroupAssignmentTarget');

    const filterId = a.target?.deviceAndAppManagementAssignmentFilterId as string | undefined;
    const filterMode = a.target?.deviceAndAppManagementAssignmentFilterType as
      | 'include'
      | 'exclude'
      | undefined;

    rows.push({
      id: obj.id,
      category: config.category,
      name: config.extractName(obj),
      description: config.extractDescription?.(obj),
      platform: config.extractPlatform?.(obj),
      intent: isExclude ? 'exclude' : 'include',
      source: classifySource(groupId, ctx),
      filter:
        filterId != null
          ? { id: filterId, mode: filterMode ?? 'include' }
          : undefined,
      lastModified: config.extractLastModified?.(obj),
      rawObject: obj,
    });
  }

  return rows;
}

export async function processExpandCategory(
  client: Client,
  config: ExpandCategoryConfig,
  ctx: ProcessContext,
): Promise<GroupAssignmentResult[]> {
  const results: GroupAssignmentResult[] = [];
  let nextLink: string | undefined;

  do {
    if (ctx.signal.aborted) throw new Error('aborted');

    const request = nextLink
      ? client.api(nextLink)
      : client.api(config.endpoint).expand('assignments').top(PAGE_SIZE);

    const page = (await request.get()) as {
      value: any[];
      '@odata.nextLink'?: string;
    };

    for (const obj of page.value ?? []) {
      results.push(...buildRowsFromObject(obj, config, ctx));
    }

    nextLink = page['@odata.nextLink'];
  } while (nextLink);

  return results;
}
```

Update the mock client in the existing tests' `pageClient` so that `expand`/`top` chains work — the existing function in your test file already supports that pattern.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- groupAssignmentService`
Expected: all expand-category tests pass alongside the group-resolution tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "feat(group-lookup): add expand-category processor"
```

---

## Task 5: Batch-category processor (mobileApps + intents)

**Files:**
- Modify: `src/services/groupAssignmentService.ts`
- Modify: `src/services/groupAssignmentService.test.ts`

- [ ] **Step 1: Write failing tests for `processBatchCategory`**

Append to `src/services/groupAssignmentService.test.ts`:

```ts
import { processBatchCategory, type BatchCategoryConfig } from './groupAssignmentService';

describe('processBatchCategory', () => {
  const config: BatchCategoryConfig = {
    category: 'mobileApp',
    listEndpoint: '/deviceAppManagement/mobileApps',
    listSelect: 'id,displayName,lastModifiedDateTime',
    assignmentsPathFor: (id) =>
      `/deviceAppManagement/mobileApps/${id}/assignments`,
    extractName: (o: any) => o.displayName,
    extractAppIntent: (a: any) => a.intent,
  };

  function batchClient(opts: {
    listPages: any[][];
    batchResponses: any[][]; // one per $batch POST
  }): { client: Client; postedBatches: any[] } {
    const postedBatches: any[] = [];
    let listIdx = 0;
    let batchIdx = 0;
    const client = {
      api: (path: string) => {
        if (path === '/$batch') {
          return {
            post: async (body: any) => {
              postedBatches.push(body);
              const responses = opts.batchResponses[batchIdx] ?? [];
              batchIdx++;
              return { responses };
            },
          };
        }
        const handler = () => {
          const page = opts.listPages[listIdx] ?? [];
          listIdx++;
          return {
            value: page,
            '@odata.nextLink':
              listIdx < opts.listPages.length ? `next-${listIdx}` : undefined,
          };
        };
        return {
          select: () => ({
            top: () => ({ get: async () => handler() }),
            get: async () => handler(),
          }),
          top: () => ({ get: async () => handler() }),
          get: async () => handler(),
        };
      },
    } as unknown as Client;
    return { client, postedBatches };
  }

  it('lists objects then fetches assignments via $batch (≤20 per request)', async () => {
    const { client, postedBatches } = batchClient({
      listPages: [
        Array.from({ length: 25 }, (_, i) => ({
          id: `app${i}`,
          displayName: `App ${i}`,
        })),
      ],
      batchResponses: [
        // first batch: 20 responses
        Array.from({ length: 20 }, (_, i) => ({
          id: `${i + 1}`,
          status: 200,
          body: {
            value: [
              {
                id: `a-${i}`,
                intent: 'required',
                target: {
                  '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                  groupId: 'g1',
                },
              },
            ],
          },
        })),
        // second batch: 5 responses
        Array.from({ length: 5 }, (_, i) => ({
          id: `${i + 1}`,
          status: 200,
          body: { value: [] },
        })),
      ],
    });

    const rows = await processBatchCategory(client, config, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(postedBatches).toHaveLength(2);
    expect(postedBatches[0].requests).toHaveLength(20);
    expect(postedBatches[1].requests).toHaveLength(5);
    expect(rows).toHaveLength(20); // 20 apps had matching assignments
    expect(rows[0]).toMatchObject({
      category: 'mobileApp',
      intent: 'include',
      appIntent: 'required',
    });
  });

  it('tolerates per-item batch failures', async () => {
    const { client } = batchClient({
      listPages: [
        [
          { id: 'app1', displayName: 'A1' },
          { id: 'app2', displayName: 'A2' },
        ],
      ],
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
          { id: '2', status: 403, body: { error: { message: 'denied' } } },
        ],
      ],
    });

    const rows = await processBatchCategory(client, config, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('app1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- groupAssignmentService`
Expected: import error for `processBatchCategory`.

- [ ] **Step 3: Implement `processBatchCategory`**

Append to `src/services/groupAssignmentService.ts`:

```ts
export interface BatchCategoryConfig {
  category: IntuneObjectCategory;
  listEndpoint: string;
  listSelect?: string;
  assignmentsPathFor: (objectId: string) => string;
  extractName: (obj: any) => string;
  extractDescription?: (obj: any) => string | undefined;
  extractPlatform?: (obj: any) => IntunePlatform | undefined;
  extractLastModified?: (obj: any) => string | undefined;
  /** Only populated for mobileApps */
  extractAppIntent?: (assignment: any) => AppInstallIntent | undefined;
}

const BATCH_SIZE = 20;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function processBatchCategory(
  client: Client,
  config: BatchCategoryConfig,
  ctx: ProcessContext,
): Promise<GroupAssignmentResult[]> {
  // Step 1: list all objects with paging.
  const objects: any[] = [];
  let nextLink: string | undefined;

  do {
    if (ctx.signal.aborted) throw new Error('aborted');
    const builder = nextLink
      ? client.api(nextLink)
      : config.listSelect
        ? client.api(config.listEndpoint).select(config.listSelect).top(PAGE_SIZE)
        : client.api(config.listEndpoint).top(PAGE_SIZE);
    const page = (await builder.get()) as {
      value: any[];
      '@odata.nextLink'?: string;
    };
    objects.push(...(page.value ?? []));
    nextLink = page['@odata.nextLink'];
  } while (nextLink);

  if (objects.length === 0) return [];

  // Step 2: $batch assignment fetches in chunks of 20.
  const objById = new Map(objects.map((o) => [o.id, o]));
  const batches = chunk(objects, BATCH_SIZE);
  const rows: GroupAssignmentResult[] = [];

  for (const batch of batches) {
    if (ctx.signal.aborted) throw new Error('aborted');

    const requests = batch.map((o, i) => ({
      id: String(i + 1),
      method: 'GET',
      url: config.assignmentsPathFor(o.id),
    }));
    const objectByReqId = new Map(
      batch.map((o, i) => [String(i + 1), o] as const),
    );

    const resp = (await client
      .api('/$batch')
      .post({ requests })) as { responses: Array<{ id: string; status: number; body: any }> };

    for (const r of resp.responses ?? []) {
      if (r.status !== 200) continue; // tolerate per-item failures
      const obj = objectByReqId.get(r.id);
      if (!obj) continue;
      const assignments: any[] = r.body?.value ?? [];

      for (const a of assignments) {
        const targetType = a.target?.['@odata.type'] as string | undefined;
        const groupId = a.target?.groupId as string | undefined;
        if (!groupId || !ctx.targetIds.has(groupId)) continue;

        const isExclude =
          !!targetType && targetType.endsWith('exclusionGroupAssignmentTarget');

        const filterId = a.target?.deviceAndAppManagementAssignmentFilterId as string | undefined;
        const filterMode = a.target?.deviceAndAppManagementAssignmentFilterType as
          | 'include'
          | 'exclude'
          | undefined;

        rows.push({
          id: obj.id,
          category: config.category,
          name: config.extractName(obj),
          description: config.extractDescription?.(obj),
          platform: config.extractPlatform?.(obj),
          intent: isExclude ? 'exclude' : 'include',
          appIntent: config.extractAppIntent?.(a),
          source: classifySource(groupId, ctx),
          filter:
            filterId != null
              ? { id: filterId, mode: filterMode ?? 'include' }
              : undefined,
          lastModified: config.extractLastModified?.(obj),
          rawObject: obj,
        });
      }
    }
  }

  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- groupAssignmentService`
Expected: all batch-category tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "feat(group-lookup): add batch-category processor for mobileApps and intents"
```

---

## Task 6: updateRing derivation rule

**Files:**
- Modify: `src/services/groupAssignmentService.ts`
- Modify: `src/services/groupAssignmentService.test.ts`

- [ ] **Step 1: Write failing test for `deriveUpdateRingRows`**

Append to test file:

```ts
import { deriveUpdateRingRows } from './groupAssignmentService';
import type { GroupAssignmentResult } from '@/types/graph';

describe('deriveUpdateRingRows', () => {
  it('reclassifies windowsUpdateForBusinessConfiguration rows to updateRing', () => {
    const input: GroupAssignmentResult[] = [
      {
        id: 'd1',
        category: 'deviceConfiguration',
        name: 'Wifi',
        intent: 'include',
        source: { kind: 'direct' },
        rawObject: { '@odata.type': '#microsoft.graph.windows10GeneralConfiguration' },
      },
      {
        id: 'd2',
        category: 'deviceConfiguration',
        name: 'Update Ring',
        intent: 'include',
        source: { kind: 'direct' },
        rawObject: { '@odata.type': '#microsoft.graph.windowsUpdateForBusinessConfiguration' },
      },
    ];

    const result = deriveUpdateRingRows(input);

    expect(result.map((r) => [r.name, r.category])).toEqual([
      ['Wifi', 'deviceConfiguration'],
      ['Update Ring', 'updateRing'],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- groupAssignmentService`

- [ ] **Step 3: Implement `deriveUpdateRingRows`**

Append to `src/services/groupAssignmentService.ts`:

```ts
const UPDATE_RING_ODATA_TYPES = new Set([
  '#microsoft.graph.windowsUpdateForBusinessConfiguration',
  '#microsoft.graph.windowsQualityUpdateProfile',
  '#microsoft.graph.windowsFeatureUpdateProfile',
  '#microsoft.graph.windowsDriverUpdateProfile',
]);

export function deriveUpdateRingRows(
  rows: GroupAssignmentResult[],
): GroupAssignmentResult[] {
  return rows.map((row) => {
    if (row.category !== 'deviceConfiguration') return row;
    const odataType = (row.rawObject as { '@odata.type'?: string } | undefined)
      ?.['@odata.type'];
    if (odataType && UPDATE_RING_ODATA_TYPES.has(odataType)) {
      return { ...row, category: 'updateRing' };
    }
    return row;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- groupAssignmentService`

- [ ] **Step 5: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "feat(group-lookup): add updateRing derivation rule"
```

---

## Task 7: Filter ID resolution post-pass

**Files:**
- Modify: `src/services/groupAssignmentService.ts`
- Modify: `src/services/groupAssignmentService.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { resolveFilterDisplayNames } from './groupAssignmentService';

describe('resolveFilterDisplayNames', () => {
  it('patches filter display names into rows', async () => {
    const rows: GroupAssignmentResult[] = [
      {
        id: 'p1',
        category: 'deviceConfiguration',
        name: 'P',
        intent: 'include',
        source: { kind: 'direct' },
        filter: { id: 'f1', mode: 'include' },
        rawObject: {},
      },
      {
        id: 'p2',
        category: 'deviceConfiguration',
        name: 'P2',
        intent: 'include',
        source: { kind: 'direct' },
        filter: { id: 'f1', mode: 'include' },
        rawObject: {},
      },
      {
        id: 'p3',
        category: 'deviceConfiguration',
        name: 'P3',
        intent: 'include',
        source: { kind: 'direct' },
        rawObject: {},
      },
    ];

    const client = {
      api: (path: string) => {
        expect(path).toBe('/deviceManagement/assignmentFilters');
        return {
          select: () => ({
            get: async () => ({
              value: [{ id: 'f1', displayName: 'Marketing Filter' }],
            }),
          }),
        };
      },
    } as unknown as Client;

    const out = await resolveFilterDisplayNames(client, rows);

    expect(out[0].filter?.displayName).toBe('Marketing Filter');
    expect(out[1].filter?.displayName).toBe('Marketing Filter');
    expect(out[2].filter).toBeUndefined();
  });

  it('is a no-op when no filters are present', async () => {
    const calls: string[] = [];
    const client = {
      api: (path: string) => {
        calls.push(path);
        return { select: () => ({ get: async () => ({ value: [] }) }) };
      },
    } as unknown as Client;

    const rows: GroupAssignmentResult[] = [
      {
        id: 'p',
        category: 'compliancePolicy',
        name: 'P',
        intent: 'include',
        source: { kind: 'direct' },
        rawObject: {},
      },
    ];
    const out = await resolveFilterDisplayNames(client, rows);
    expect(calls).toEqual([]);
    expect(out).toBe(rows);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- groupAssignmentService`

- [ ] **Step 3: Implement `resolveFilterDisplayNames`**

Append:

```ts
export async function resolveFilterDisplayNames(
  client: Client,
  rows: GroupAssignmentResult[],
): Promise<GroupAssignmentResult[]> {
  const filterIds = new Set<string>();
  for (const r of rows) if (r.filter?.id) filterIds.add(r.filter.id);
  if (filterIds.size === 0) return rows;

  const resp = (await client
    .api('/deviceManagement/assignmentFilters')
    .select('id,displayName')
    .get()) as { value: Array<{ id: string; displayName: string }> };

  const nameById = new Map(resp.value.map((f) => [f.id, f.displayName]));

  return rows.map((r) => {
    if (!r.filter) return r;
    const displayName = nameById.get(r.filter.id);
    if (!displayName) return r;
    return { ...r, filter: { ...r.filter, displayName } };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- groupAssignmentService`

- [ ] **Step 5: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "feat(group-lookup): resolve assignment filter display names"
```

---

## Task 8: Top-level orchestrator with error isolation + AbortSignal

**Files:**
- Modify: `src/services/groupAssignmentService.ts`
- Modify: `src/services/groupAssignmentService.test.ts`

- [ ] **Step 1: Write failing tests for `fetchGroupAssignments`**

Add to test file:

```ts
import { fetchGroupAssignments } from './groupAssignmentService';
import type { CategoryState, IntuneObjectCategory } from '@/types/graph';

describe('fetchGroupAssignments', () => {
  it('calls onCategoryStatus loading->done for each category and emits results', async () => {
    const handlers: Record<string, () => any> = {
      '/groups/g1': () => ({ id: 'g1', displayName: 'G1' }),
      '/groups/g1/transitiveMemberOf/microsoft.graph.group': () => ({
        value: [],
      }),
      '/deviceManagement/deviceConfigurations': () => ({
        value: [
          {
            id: 'p1',
            displayName: 'P',
            assignments: [
              {
                id: 'a',
                target: {
                  '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                  groupId: 'g1',
                },
              },
            ],
          },
        ],
      }),
    };
    // For unmocked endpoints, return empty.
    const client = {
      api: (path: string) => {
        const handler = handlers[path] ?? (() => ({ value: [] }));
        const builder: any = {
          get: async () => handler(),
          post: async () => ({ responses: [] }),
          select: () => builder,
          expand: () => builder,
          top: () => builder,
          header: () => builder,
        };
        return builder;
      },
    } as unknown as Client;

    const statuses: Array<[IntuneObjectCategory, CategoryState]> = [];
    const results: Array<[IntuneObjectCategory, GroupAssignmentResult[]]> = [];

    await fetchGroupAssignments(client, 'g1', {
      signal: new AbortController().signal,
      onCategoryStatus: (c, s) => statuses.push([c, s]),
      onResults: (c, r) => results.push([c, r]),
      onParentGroups: () => {},
    });

    const dcStatuses = statuses
      .filter(([c]) => c === 'deviceConfiguration')
      .map(([, s]) => s.status);
    expect(dcStatuses).toEqual(expect.arrayContaining(['loading', 'done']));

    const dcResults = results.find(([c]) => c === 'deviceConfiguration');
    expect(dcResults?.[1]).toHaveLength(1);
  });

  it('isolates per-category errors', async () => {
    const client = {
      api: (path: string) => {
        const builder: any = {
          get: async () => {
            if (path === '/groups/g1') return { id: 'g1', displayName: 'G1' };
            if (path === '/groups/g1/transitiveMemberOf/microsoft.graph.group')
              return { value: [] };
            if (path === '/deviceManagement/deviceConfigurations')
              throw Object.assign(new Error('forbidden'), { statusCode: 403 });
            return { value: [] };
          },
          post: async () => ({ responses: [] }),
          select: () => builder,
          expand: () => builder,
          top: () => builder,
          header: () => builder,
        };
        return builder;
      },
    } as unknown as Client;

    const statuses: Array<[IntuneObjectCategory, CategoryState]> = [];

    await fetchGroupAssignments(client, 'g1', {
      signal: new AbortController().signal,
      onCategoryStatus: (c, s) => statuses.push([c, s]),
      onResults: () => {},
      onParentGroups: () => {},
    });

    const dcFinal = [...statuses]
      .reverse()
      .find(([c]) => c === 'deviceConfiguration');
    expect(dcFinal?.[1].status).toBe('error');

    const otherFinals = [...statuses]
      .reverse()
      .find(([c]) => c === 'compliancePolicy');
    expect(otherFinals?.[1].status).toBe('done');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- groupAssignmentService`
Expected: real `fetchGroupAssignments` still throws "not implemented yet".

- [ ] **Step 3: Implement the orchestrator**

Replace the placeholder `fetchGroupAssignments` in `src/services/groupAssignmentService.ts`:

```ts
const EXPAND_CATEGORY_CONFIGS: ExpandCategoryConfig[] = [
  {
    category: 'deviceConfiguration',
    endpoint: '/deviceManagement/deviceConfigurations',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'compliancePolicy',
    endpoint: '/deviceManagement/deviceCompliancePolicies',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'configurationPolicy',
    endpoint: '/deviceManagement/configurationPolicies',
    extractName: (o) => o.name ?? o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'appProtection',
    endpoint: '/deviceAppManagement/managedAppPolicies',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'appConfiguration',
    endpoint: '/deviceAppManagement/mobileAppConfigurations',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'platformScript',
    endpoint: '/deviceManagement/deviceManagementScripts',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'remediationScript',
    endpoint: '/deviceManagement/deviceHealthScripts',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'complianceScript',
    endpoint: '/deviceManagement/deviceComplianceScripts',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'autopilotProfile',
    endpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
  {
    category: 'enrollmentConfig',
    endpoint: '/deviceManagement/deviceEnrollmentConfigurations',
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
];

const BATCH_CATEGORY_CONFIGS: BatchCategoryConfig[] = [
  {
    category: 'mobileApp',
    listEndpoint: '/deviceAppManagement/mobileApps',
    listSelect: 'id,displayName,lastModifiedDateTime,@odata.type',
    assignmentsPathFor: (id) =>
      `/deviceAppManagement/mobileApps/${id}/assignments`,
    extractName: (o) => o.displayName,
    extractLastModified: (o) => o.lastModifiedDateTime,
    extractAppIntent: (a) => {
      const v = (a?.intent as string | undefined)?.toLowerCase();
      if (v === 'available' || v === 'required' || v === 'uninstall') return v;
      if (v === 'availablewithoutenrollment') return 'available';
      return undefined;
    },
  },
  {
    category: 'endpointSecurity',
    listEndpoint: '/deviceManagement/intents',
    listSelect: 'id,displayName,description,lastModifiedDateTime',
    assignmentsPathFor: (id) =>
      `/deviceManagement/intents/${id}/assignments`,
    extractName: (o) => o.displayName,
    extractDescription: (o) => o.description,
    extractLastModified: (o) => o.lastModifiedDateTime,
  },
];

const ALL_CATEGORIES_FOR_PROGRESS: IntuneObjectCategory[] = [
  ...EXPAND_CATEGORY_CONFIGS.map((c) => c.category),
  ...BATCH_CATEGORY_CONFIGS.map((c) => c.category),
  'updateRing',
];

export async function fetchGroupAssignments(
  client: Client,
  groupId: string,
  callbacks: FetchGroupAssignmentsCallbacks,
): Promise<void> {
  const { signal, onCategoryStatus, onResults, onParentGroups } = callbacks;

  // Mark every category as pending up front so the UI can render the full list.
  for (const cat of ALL_CATEGORIES_FOR_PROGRESS) {
    onCategoryStatus(cat, { status: 'pending' });
  }

  let resolved: ResolvedTargetGroupSet;
  try {
    resolved = await resolveTargetGroupSet(client, groupId);
  } catch (e: any) {
    const message = e?.message ?? 'Failed to resolve group';
    for (const cat of ALL_CATEGORIES_FOR_PROGRESS) {
      onCategoryStatus(cat, { status: 'error', error: message });
    }
    throw e;
  }
  onParentGroups(resolved.parentGroups);

  const parentGroupsById = new Map(
    resolved.parentGroups.map((p) => [p.id, p] as const),
  );

  const ctx: ProcessContext = {
    targetIds: resolved.targetIds,
    selectedGroupId: groupId,
    parentGroupsById,
    signal,
  };

  // Track all rows so we can do filter-name resolution + emit a re-render after.
  const allRows: GroupAssignmentResult[] = [];

  // Collect the deviceConfiguration rows separately so we can run the updateRing
  // derivation once they are in.
  const runExpandCategory = async (config: ExpandCategoryConfig) => {
    onCategoryStatus(config.category, { status: 'loading' });
    try {
      let rows = await processExpandCategory(client, config, ctx);
      if (config.category === 'deviceConfiguration') {
        rows = deriveUpdateRingRows(rows);
        const updateRingRows = rows.filter((r) => r.category === 'updateRing');
        rows = rows.filter((r) => r.category !== 'updateRing');
        // emit updateRing in its own bucket
        onResults('updateRing', updateRingRows);
        onCategoryStatus('updateRing', {
          status: 'done',
          count: updateRingRows.length,
        });
        allRows.push(...updateRingRows);
      }
      onResults(config.category, rows);
      onCategoryStatus(config.category, {
        status: 'done',
        count: rows.length,
      });
      allRows.push(...rows);
    } catch (e: any) {
      onCategoryStatus(config.category, {
        status: 'error',
        error: humanizeError(e),
      });
    }
  };

  const runBatchCategory = async (config: BatchCategoryConfig) => {
    onCategoryStatus(config.category, { status: 'loading' });
    try {
      const rows = await processBatchCategory(client, config, ctx);
      onResults(config.category, rows);
      onCategoryStatus(config.category, {
        status: 'done',
        count: rows.length,
      });
      allRows.push(...rows);
    } catch (e: any) {
      onCategoryStatus(config.category, {
        status: 'error',
        error: humanizeError(e),
      });
    }
  };

  // updateRing has no fetch of its own — derived from deviceConfiguration.
  // We mark it 'loading' the same time deviceConfiguration starts; the
  // runExpandCategory wrapper above flips it to 'done' when results arrive.
  // To make sure the UI shows it animating, set 'loading' when deviceConfiguration starts.
  // (Done by keying off deviceConfiguration in runExpandCategory above.)

  await Promise.allSettled([
    ...EXPAND_CATEGORY_CONFIGS.map((c) => runExpandCategory(c)),
    ...BATCH_CATEGORY_CONFIGS.map((c) => runBatchCategory(c)),
  ]);

  // Filter ID resolution post-pass.
  if (signal.aborted) return;

  try {
    const withFilterNames = await resolveFilterDisplayNames(client, allRows);
    // Re-emit any category whose rows changed.
    const changedByCategory = new Map<IntuneObjectCategory, GroupAssignmentResult[]>();
    for (const r of withFilterNames) {
      if (!changedByCategory.has(r.category)) changedByCategory.set(r.category, []);
      changedByCategory.get(r.category)!.push(r);
    }
    for (const [cat, rows] of changedByCategory) {
      onResults(cat, rows);
    }
  } catch (e) {
    // Don't fail the whole run for filter name resolution problems.
    console.warn('Filter name resolution failed:', e);
  }
}

function humanizeError(e: any): string {
  if (e?.statusCode === 403 || e?.code === 'Forbidden')
    return 'Permission denied — your tenant or account may not have access to this resource.';
  if (e?.statusCode === 404) return 'Endpoint not available in this tenant.';
  if (e?.statusCode === 429) return 'Rate limited by Microsoft Graph.';
  return e?.message ?? 'Unknown error';
}
```

Note: `updateRing` is shown as `pending` initially (via the `ALL_CATEGORIES_FOR_PROGRESS` loop) and flipped to `done` when `deviceConfiguration` finishes. Acceptable — it never enters `loading`, just `pending → done`. If you prefer a `loading` shimmer, the `runExpandCategory` for `deviceConfiguration` can also call `onCategoryStatus('updateRing', { status: 'loading' })` at its start.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- groupAssignmentService`
Expected: all orchestrator tests pass alongside earlier tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/groupAssignmentService.ts src/services/groupAssignmentService.test.ts
git commit -m "feat(group-lookup): add top-level fan-out orchestrator with error isolation"
```

---

## Task 9: `useEntraGroupSearch` hook

**Files:**
- Create: `src/hooks/useEntraGroupSearch.ts`
- Create: `src/hooks/useEntraGroupSearch.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEntraGroupSearch } from './useEntraGroupSearch';

const mockGet = vi.fn();
vi.mock('@/services/groupAssignmentService', () => ({}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: async () => 'token',
  }),
}));
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: () => ({
      api: () => ({
        filter: () => ({ select: () => ({ top: () => ({ get: mockGet }) }) }),
      }),
    }),
  },
}));

describe('useEntraGroupSearch', () => {
  it('debounces and returns matches', async () => {
    mockGet.mockResolvedValueOnce({
      value: [{ id: 'g1', displayName: 'Marketing-US', mail: null }],
    });

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useEntraGroupSearch(q),
      { initialProps: { q: '' } },
    );

    rerender({ q: 'Mark' });
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(result.current.matches[0].displayName).toBe('Marketing-US');
  });

  it('returns empty matches for queries shorter than 2 chars', async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useEntraGroupSearch(q),
      { initialProps: { q: '' } },
    );
    rerender({ q: 'a' });
    expect(result.current.matches).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useEntraGroupSearch`

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useEntraGroupSearch.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';

export interface EntraGroupMatch {
  id: string;
  displayName: string;
  mail?: string | null;
  description?: string | null;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const TOP = 10;

export function useEntraGroupSearch(query: string) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [matches, setMatches] = useState<EntraGroupMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (timer.current) clearTimeout(timer.current);
    if (aborter.current) aborter.current.abort();

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    timer.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      const ac = new AbortController();
      aborter.current = ac;
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessToken() },
        });
        const escaped = query.replace(/'/g, "''");
        const resp = (await client
          .api('/groups')
          .filter(`startswith(displayName,'${escaped}')`)
          .select('id,displayName,mail,description')
          .top(TOP)
          .get()) as { value: EntraGroupMatch[] };
        if (!ac.signal.aborted) setMatches(resp.value ?? []);
      } catch (e: any) {
        if (!ac.signal.aborted) setError(e?.message ?? 'Search failed');
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, isAuthenticated, getAccessToken]);

  return { matches, isLoading, error };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useEntraGroupSearch`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEntraGroupSearch.ts src/hooks/useEntraGroupSearch.test.ts
git commit -m "feat(group-lookup): add Entra group typeahead hook"
```

Note: if `useAuth` does not currently expose `getAccessToken`, add it using the same pattern `graphService.ts` uses (MSAL `acquireTokenSilent`). Otherwise reuse the existing pattern.

---

## Task 10: `useGroupAssignments` hook

**Files:**
- Create: `src/hooks/useGroupAssignments.ts`
- Create: `src/hooks/useGroupAssignments.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGroupAssignments } from './useGroupAssignments';
import { ALL_INTUNE_OBJECT_CATEGORIES } from '@/types/graph';

let lastSignal: AbortSignal | undefined;
vi.mock('@/services/groupAssignmentService', () => ({
  fetchGroupAssignments: vi.fn(async (_client, gid, cb) => {
    lastSignal = cb.signal;
    cb.onParentGroups([{ id: 'p1', displayName: 'Parent' }]);
    cb.onCategoryStatus('deviceConfiguration', { status: 'loading' });
    cb.onResults('deviceConfiguration', [
      {
        id: 'd1',
        category: 'deviceConfiguration',
        name: 'Pol',
        intent: 'include',
        source: { kind: 'direct' },
        rawObject: {},
      },
    ]);
    cb.onCategoryStatus('deviceConfiguration', { status: 'done', count: 1 });
  }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, getAccessToken: async () => 't' }),
}));
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: { initWithMiddleware: () => ({}) },
}));

describe('useGroupAssignments', () => {
  it('initializes all categories as pending then transitions on events', async () => {
    const { result } = renderHook(() => useGroupAssignments('g1'));

    await waitFor(() =>
      expect(result.current.perCategory.deviceConfiguration.status).toBe('done'),
    );

    for (const cat of ALL_INTUNE_OBJECT_CATEGORIES) {
      const s = result.current.perCategory[cat].status;
      if (cat !== 'deviceConfiguration') {
        expect(s === 'pending' || s === 'done' || s === 'loading' || s === 'error').toBe(true);
      }
    }
    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.parentGroups).toEqual([
      { id: 'p1', displayName: 'Parent' },
    ]);
  });

  it('aborts previous request when groupId changes', async () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useGroupAssignments(id),
      { initialProps: { id: 'g1' } },
    );
    const firstSignal = lastSignal;
    rerender({ id: 'g2' });
    expect(firstSignal?.aborted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useGroupAssignments`

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useGroupAssignments.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';
import {
  ALL_INTUNE_OBJECT_CATEGORIES,
  type CategoryState,
  type GroupAssignmentResult,
  type IntuneObjectCategory,
  type ParentGroupRef,
} from '@/types/graph';
import { fetchGroupAssignments } from '@/services/groupAssignmentService';

function makePendingMap(): Record<IntuneObjectCategory, CategoryState> {
  const m = {} as Record<IntuneObjectCategory, CategoryState>;
  for (const c of ALL_INTUNE_OBJECT_CATEGORIES) m[c] = { status: 'pending' };
  return m;
}

export interface UseGroupAssignmentsResult {
  perCategory: Record<IntuneObjectCategory, CategoryState>;
  results: GroupAssignmentResult[];
  parentGroups: ParentGroupRef[];
  isLoading: boolean;
  fatalError: string | null;
}

export function useGroupAssignments(
  groupId: string | null,
): UseGroupAssignmentsResult {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [perCategory, setPerCategory] = useState(makePendingMap);
  const [resultsByCat, setResultsByCat] = useState<
    Record<IntuneObjectCategory, GroupAssignmentResult[]>
  >({} as any);
  const [parentGroups, setParentGroups] = useState<ParentGroupRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    if (aborter.current) aborter.current.abort();
    if (!groupId || !isAuthenticated) {
      setPerCategory(makePendingMap());
      setResultsByCat({} as any);
      setParentGroups([]);
      setIsLoading(false);
      setFatalError(null);
      return;
    }

    const ac = new AbortController();
    aborter.current = ac;
    setPerCategory(makePendingMap());
    setResultsByCat({} as any);
    setParentGroups([]);
    setIsLoading(true);
    setFatalError(null);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessToken() },
        });
        await fetchGroupAssignments(client, groupId, {
          signal: ac.signal,
          onParentGroups: (p) => {
            if (!ac.signal.aborted) setParentGroups(p);
          },
          onCategoryStatus: (cat, state) => {
            if (ac.signal.aborted) return;
            setPerCategory((prev) => ({ ...prev, [cat]: state }));
          },
          onResults: (cat, rows) => {
            if (ac.signal.aborted) return;
            setResultsByCat((prev) => ({ ...prev, [cat]: rows }));
          },
        });
      } catch (e: any) {
        if (!ac.signal.aborted) setFatalError(e?.message ?? 'Failed');
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [groupId, isAuthenticated, getAccessToken]);

  const results = Object.values(resultsByCat).flat();
  return { perCategory, results, parentGroups, isLoading, fatalError };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useGroupAssignments`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGroupAssignments.ts src/hooks/useGroupAssignments.test.ts
git commit -m "feat(group-lookup): add useGroupAssignments orchestrator hook"
```

---

## Task 11: `GroupTypeBadge` component

**Files:**
- Create: `src/components/group/GroupTypeBadge.tsx`
- Create: `src/components/group/GroupTypeBadge.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupTypeBadge } from './GroupTypeBadge';

describe('GroupTypeBadge', () => {
  it('renders the human label for a category', () => {
    render(<GroupTypeBadge category="mobileApp" />);
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
  });

  it('renders the updateRing label', () => {
    render(<GroupTypeBadge category="updateRing" />);
    expect(screen.getByText('Update Ring')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GroupTypeBadge`

- [ ] **Step 3: Implement the component**

```tsx
import { Badge } from '@/components/ui/badge';
import type { IntuneObjectCategory } from '@/types/graph';
import { cn } from '@/lib/utils';

const LABELS: Record<IntuneObjectCategory, string> = {
  deviceConfiguration: 'Device Configuration',
  compliancePolicy: 'Compliance Policy',
  configurationPolicy: 'Settings Catalog',
  appProtection: 'App Protection',
  mobileApp: 'Mobile App',
  appConfiguration: 'App Configuration',
  endpointSecurity: 'Endpoint Security',
  platformScript: 'Platform Script',
  remediationScript: 'Remediation Script',
  complianceScript: 'Compliance Script',
  autopilotProfile: 'Autopilot Profile',
  enrollmentConfig: 'Enrollment Config',
  updateRing: 'Update Ring',
};

const COLOR: Record<IntuneObjectCategory, string> = {
  deviceConfiguration: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  compliancePolicy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  configurationPolicy: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  appProtection: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  mobileApp: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  appConfiguration: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  endpointSecurity: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  platformScript: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  remediationScript: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  complianceScript: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  autopilotProfile: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  enrollmentConfig: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  updateRing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
};

export function categoryLabel(c: IntuneObjectCategory): string {
  return LABELS[c];
}

export function GroupTypeBadge({
  category,
  className,
}: {
  category: IntuneObjectCategory;
  className?: string;
}) {
  return (
    <Badge className={cn('font-medium', COLOR[category], className)} variant="secondary">
      {LABELS[category]}
    </Badge>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- GroupTypeBadge`

- [ ] **Step 5: Commit**

```bash
git add src/components/group/GroupTypeBadge.tsx src/components/group/GroupTypeBadge.test.tsx
git commit -m "feat(group-lookup): add GroupTypeBadge"
```

---

## Task 12: `GroupSearchBox` component

**Files:**
- Create: `src/components/group/GroupSearchBox.tsx`
- Create: `src/components/group/GroupSearchBox.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupSearchBox } from './GroupSearchBox';

vi.mock('@/hooks/useEntraGroupSearch', () => ({
  useEntraGroupSearch: (q: string) => ({
    matches:
      q.length >= 2
        ? [{ id: 'g1', displayName: 'Marketing-US', mail: 'mkt@x.com' }]
        : [],
    isLoading: false,
    error: null,
  }),
}));

describe('GroupSearchBox', () => {
  it('shows matches and fires onSelect with the selected group', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<GroupSearchBox onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText(/search groups/i), 'Mar');
    await user.click(await screen.findByText('Marketing-US'));

    expect(onSelect).toHaveBeenCalledWith({
      id: 'g1',
      displayName: 'Marketing-US',
      mail: 'mkt@x.com',
    });
  });

  it('displays an empty hint for short queries', async () => {
    const user = userEvent.setup();
    render(<GroupSearchBox onSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText(/search groups/i), 'M');
    expect(
      screen.getByText(/keep typing/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GroupSearchBox`

- [ ] **Step 3: Implement the component**

```tsx
import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useEntraGroupSearch, type EntraGroupMatch } from '@/hooks/useEntraGroupSearch';

export interface GroupSearchBoxProps {
  onSelect: (group: EntraGroupMatch) => void;
  autoFocus?: boolean;
}

export function GroupSearchBox({ onSelect, autoFocus = false }: GroupSearchBoxProps) {
  const [query, setQuery] = useState('');
  const { matches, isLoading, error } = useEntraGroupSearch(query);

  return (
    <div className="w-full max-w-2xl">
      <Command shouldFilter={false} className="rounded-lg border shadow-sm">
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
        <CommandList>
          {query.trim().length < 2 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Keep typing — at least 2 characters.
            </div>
          ) : (
            <>
              <CommandEmpty>{error ? `Error: ${error}` : 'No groups found.'}</CommandEmpty>
              <CommandGroup>
                {matches.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={g.id}
                    onSelect={() => onSelect(g)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{g.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.mail || g.description || g.id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- GroupSearchBox`

- [ ] **Step 5: Commit**

```bash
git add src/components/group/GroupSearchBox.tsx src/components/group/GroupSearchBox.test.tsx
git commit -m "feat(group-lookup): add GroupSearchBox typeahead"
```

---

## Task 13: `CategoryProgressList` component

**Files:**
- Create: `src/components/group/CategoryProgressList.tsx`
- Create: `src/components/group/CategoryProgressList.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryProgressList } from './CategoryProgressList';
import { ALL_INTUNE_OBJECT_CATEGORIES, type CategoryState, type IntuneObjectCategory } from '@/types/graph';

function makeStates(overrides: Partial<Record<IntuneObjectCategory, CategoryState>> = {}) {
  const m = {} as Record<IntuneObjectCategory, CategoryState>;
  for (const c of ALL_INTUNE_OBJECT_CATEGORIES) m[c] = { status: 'pending' };
  return { ...m, ...overrides };
}

describe('CategoryProgressList', () => {
  it('shows the cumulative count of completed categories', () => {
    render(
      <CategoryProgressList
        groupName="My Group"
        states={makeStates({
          deviceConfiguration: { status: 'done', count: 5 },
          compliancePolicy: { status: 'done', count: 2 },
        })}
      />,
    );
    expect(screen.getByText(/2 of 13 complete/i)).toBeInTheDocument();
    expect(screen.getByText(/7 connections found/i)).toBeInTheDocument();
  });

  it('shows the group name in the heading', () => {
    render(<CategoryProgressList groupName="Marketing-US" states={makeStates()} />);
    expect(screen.getByText(/Inspecting Marketing-US/i)).toBeInTheDocument();
  });

  it('shows error state for failed categories', () => {
    render(
      <CategoryProgressList
        groupName="x"
        states={makeStates({
          deviceConfiguration: { status: 'error', error: 'denied' },
        })}
      />,
    );
    expect(screen.getByText(/denied/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CategoryProgressList`

- [ ] **Step 3: Implement the component**

```tsx
import { Clock, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_INTUNE_OBJECT_CATEGORIES,
  type CategoryState,
  type IntuneObjectCategory,
} from '@/types/graph';
import { categoryLabel } from './GroupTypeBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface CategoryProgressListProps {
  groupName: string;
  states: Record<IntuneObjectCategory, CategoryState>;
}

export function CategoryProgressList({
  groupName,
  states,
}: CategoryProgressListProps) {
  const total = ALL_INTUNE_OBJECT_CATEGORIES.length;
  const completed = ALL_INTUNE_OBJECT_CATEGORIES.filter(
    (c) => states[c].status === 'done' || states[c].status === 'error',
  ).length;
  const totalConnections = ALL_INTUNE_OBJECT_CATEGORIES.reduce(
    (sum, c) => sum + (states[c].count ?? 0),
    0,
  );

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-base font-semibold">Inspecting {groupName}…</div>
        <div className="text-sm text-muted-foreground">
          {completed} of {total} complete · {totalConnections} connections found
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {ALL_INTUNE_OBJECT_CATEGORIES.map((c) => {
          const s = states[c];
          return (
            <li
              key={c}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                s.status === 'loading' && 'animate-pulse',
              )}
            >
              <StatusIcon state={s} />
              <span className="flex-1 truncate">{categoryLabel(c)}</span>
              {s.count != null && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {s.count}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusIcon({ state }: { state: CategoryState }) {
  if (state.status === 'pending')
    return <Clock className="h-4 w-4 text-muted-foreground/50" />;
  if (state.status === 'loading')
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (state.status === 'done')
    return <Check className="h-4 w-4 text-emerald-600" />;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertCircle className="h-4 w-4 text-amber-600" />
        </TooltipTrigger>
        <TooltipContent>{state.error ?? 'Unknown error'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- CategoryProgressList`

- [ ] **Step 5: Commit**

```bash
git add src/components/group/CategoryProgressList.tsx src/components/group/CategoryProgressList.test.tsx
git commit -m "feat(group-lookup): add CategoryProgressList animation"
```

---

## Task 14: `ResultsSummary` component

**Files:**
- Create: `src/components/group/ResultsSummary.tsx`
- Create: `src/components/group/ResultsSummary.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsSummary } from './ResultsSummary';
import type { GroupAssignmentResult } from '@/types/graph';

const sample: GroupAssignmentResult[] = [
  { id: '1', category: 'mobileApp', name: 'A', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '2', category: 'mobileApp', name: 'B', intent: 'exclude', source: { kind: 'direct' }, rawObject: {} },
  { id: '3', category: 'compliancePolicy', name: 'C', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
];

describe('ResultsSummary', () => {
  it('shows group name, parent groups, and count chips', () => {
    render(
      <ResultsSummary
        groupName="Marketing-US"
        parentGroups={[{ id: 'p1', displayName: 'All-Marketing' }]}
        results={sample}
        onSelectParent={() => {}}
        onCategoryChipClick={() => {}}
      />,
    );
    expect(screen.getByText('Marketing-US')).toBeInTheDocument();
    expect(screen.getByText('All-Marketing')).toBeInTheDocument();
    expect(screen.getByText(/Mobile App.*2/)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Policy.*1/)).toBeInTheDocument();
  });

  it('fires onSelectParent when a parent chip is clicked', async () => {
    const onSelectParent = vi.fn();
    render(
      <ResultsSummary
        groupName="x"
        parentGroups={[{ id: 'p1', displayName: 'Parent' }]}
        results={[]}
        onSelectParent={onSelectParent}
        onCategoryChipClick={() => {}}
      />,
    );
    await userEvent.setup().click(screen.getByText('Parent'));
    expect(onSelectParent).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ResultsSummary`

- [ ] **Step 3: Implement the component**

```tsx
import { Badge } from '@/components/ui/badge';
import { ALL_INTUNE_OBJECT_CATEGORIES, type GroupAssignmentResult, type IntuneObjectCategory, type ParentGroupRef } from '@/types/graph';
import { categoryLabel } from './GroupTypeBadge';

export interface ResultsSummaryProps {
  groupName: string;
  parentGroups: ParentGroupRef[];
  results: GroupAssignmentResult[];
  onSelectParent: (groupId: string) => void;
  onCategoryChipClick: (category: IntuneObjectCategory) => void;
}

export function ResultsSummary({
  groupName,
  parentGroups,
  results,
  onSelectParent,
  onCategoryChipClick,
}: ResultsSummaryProps) {
  const counts = countByCategory(results);
  const total = results.length;
  const includes = results.filter((r) => r.intent === 'include').length;
  const excludes = total - includes;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{groupName}</h2>
        <div className="text-sm text-muted-foreground">
          {total} connections · {includes} included · {excludes} excluded
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
      <div className="flex flex-wrap gap-2">
        {ALL_INTUNE_OBJECT_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0).map(
          (c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCategoryChipClick(c)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <Badge variant="outline" className="cursor-pointer">
                {categoryLabel(c)} · {counts[c]}
              </Badge>
            </button>
          ),
        )}
      </div>
    </section>
  );
}

function countByCategory(rows: GroupAssignmentResult[]) {
  const m: Partial<Record<IntuneObjectCategory, number>> = {};
  for (const r of rows) m[r.category] = (m[r.category] ?? 0) + 1;
  return m;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ResultsSummary`

- [ ] **Step 5: Commit**

```bash
git add src/components/group/ResultsSummary.tsx src/components/group/ResultsSummary.test.tsx
git commit -m "feat(group-lookup): add ResultsSummary"
```

---

## Task 15: `ResultsDetailDrawer` component

**Files:**
- Create: `src/components/group/ResultsDetailDrawer.tsx`
- Create: `src/components/group/ResultsDetailDrawer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsDetailDrawer } from './ResultsDetailDrawer';
import type { GroupAssignmentResult } from '@/types/graph';

const row: GroupAssignmentResult = {
  id: '1',
  category: 'platformScript',
  name: 'Custom Script',
  intent: 'include',
  source: { kind: 'direct' },
  rawObject: { foo: 'bar' },
};

describe('ResultsDetailDrawer', () => {
  it('renders the row name and category and a Raw JSON toggle', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ResultsDetailDrawer row={row} open onOpenChange={onOpenChange} />);
    expect(screen.getByText('Custom Script')).toBeInTheDocument();
    expect(screen.getByText(/Platform Script/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /raw json/i }));
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ResultsDetailDrawer`

- [ ] **Step 3: Implement the component**

```tsx
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { GroupTypeBadge } from './GroupTypeBadge';
import { Badge } from '@/components/ui/badge';
import type { GroupAssignmentResult } from '@/types/graph';

export interface ResultsDetailDrawerProps {
  row: GroupAssignmentResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResultsDetailDrawer({ row, open, onOpenChange }: ResultsDetailDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {row && (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="text-lg">{row.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <GroupTypeBadge category={row.category} />
                <Badge variant={row.intent === 'exclude' ? 'destructive' : 'default'}>
                  {row.intent}
                </Badge>
                {row.appIntent && (
                  <Badge variant="outline">{row.appIntent}</Badge>
                )}
                {row.source.kind === 'parent' && (
                  <Badge variant="outline">via {row.source.groupName ?? row.source.groupId}</Badge>
                )}
              </div>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              {row.description && <p className="text-muted-foreground">{row.description}</p>}
              {row.platform && (
                <div><span className="text-muted-foreground">Platform:</span> {row.platform}</div>
              )}
              {row.filter && (
                <div>
                  <span className="text-muted-foreground">Filter:</span>{' '}
                  {row.filter.displayName ?? row.filter.id}
                  {' '}<Badge variant="outline">{row.filter.mode}</Badge>
                </div>
              )}
              {row.lastModified && (
                <div>
                  <span className="text-muted-foreground">Last modified:</span>{' '}
                  {new Date(row.lastModified).toLocaleString()}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRaw((s) => !s)}
              >
                {showRaw ? 'Hide raw JSON' : 'Raw JSON'}
              </Button>
              {showRaw && (
                <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(row.rawObject, null, 2)}
                </pre>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ResultsDetailDrawer`

- [ ] **Step 5: Commit**

```bash
git add src/components/group/ResultsDetailDrawer.tsx src/components/group/ResultsDetailDrawer.test.tsx
git commit -m "feat(group-lookup): add ResultsDetailDrawer"
```

---

## Task 16: Saved views storage

**Files:**
- Create: `src/lib/savedViews.ts`
- Create: `src/lib/savedViews.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSavedViews,
  saveView,
  deleteView,
  type SavedView,
} from './savedViews';

beforeEach(() => {
  localStorage.clear();
});

describe('savedViews', () => {
  it('starts empty', () => {
    expect(loadSavedViews('tenant1')).toEqual([]);
  });

  it('saves and loads a view', () => {
    const v: SavedView = {
      name: 'Mine',
      filters: { category: ['mobileApp'] },
      sorting: [{ id: 'name', desc: false }],
      freeTextSearch: 'a',
    };
    saveView('tenant1', v);
    expect(loadSavedViews('tenant1')).toEqual([v]);
  });

  it('overwrites a view with the same name', () => {
    saveView('t', { name: 'X', filters: {}, sorting: [], freeTextSearch: '' });
    saveView('t', { name: 'X', filters: { intent: ['exclude'] }, sorting: [], freeTextSearch: '' });
    const all = loadSavedViews('t');
    expect(all).toHaveLength(1);
    expect(all[0].filters.intent).toEqual(['exclude']);
  });

  it('deletes a view by name', () => {
    saveView('t', { name: 'X', filters: {}, sorting: [], freeTextSearch: '' });
    saveView('t', { name: 'Y', filters: {}, sorting: [], freeTextSearch: '' });
    deleteView('t', 'X');
    expect(loadSavedViews('t').map((v) => v.name)).toEqual(['Y']);
  });

  it('isolates views per tenant', () => {
    saveView('t1', { name: 'A', filters: {}, sorting: [], freeTextSearch: '' });
    saveView('t2', { name: 'B', filters: {}, sorting: [], freeTextSearch: '' });
    expect(loadSavedViews('t1')).toHaveLength(1);
    expect(loadSavedViews('t2')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- savedViews`

- [ ] **Step 3: Implement**

```ts
import type { SortingState } from '@tanstack/react-table';

export interface SavedView {
  name: string;
  filters: Record<string, string[]>;
  sorting: SortingState;
  freeTextSearch: string;
}

const KEY = (tenantId: string) => `groupLookup.savedViews.${tenantId}`;

export function loadSavedViews(tenantId: string): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveView(tenantId: string, view: SavedView): void {
  const all = loadSavedViews(tenantId).filter((v) => v.name !== view.name);
  all.push(view);
  localStorage.setItem(KEY(tenantId), JSON.stringify(all));
}

export function deleteView(tenantId: string, name: string): void {
  const all = loadSavedViews(tenantId).filter((v) => v.name !== name);
  localStorage.setItem(KEY(tenantId), JSON.stringify(all));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- savedViews`

- [ ] **Step 5: Commit**

```bash
git add src/lib/savedViews.ts src/lib/savedViews.test.ts
git commit -m "feat(group-lookup): add saved views localStorage CRUD"
```

---

## Task 17: `ResultsTable` component (with saved views integration)

**Files:**
- Create: `src/components/group/ResultsTable.tsx`
- Create: `src/components/group/ResultsTable.test.tsx`
- Create: `src/components/group/SavedViewsMenu.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsTable } from './ResultsTable';
import type { GroupAssignmentResult } from '@/types/graph';

const rows: GroupAssignmentResult[] = [
  { id: '1', category: 'mobileApp', name: 'Outlook', platform: 'iOS', intent: 'include', appIntent: 'required', source: { kind: 'direct' }, rawObject: {} },
  { id: '2', category: 'compliancePolicy', name: 'Win Compliance', platform: 'Windows', intent: 'include', source: { kind: 'parent', groupId: 'p1', groupName: 'All-Marketing' }, rawObject: {} },
  { id: '3', category: 'mobileApp', name: 'Teams', platform: 'iOS', intent: 'exclude', source: { kind: 'direct' }, rawObject: {} },
];

describe('ResultsTable', () => {
  it('renders all rows initially', () => {
    render(<ResultsTable rows={rows} tenantId="t1" onRowClick={() => {}} />);
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.getByText('Win Compliance')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
  });

  it('filters by free-text search on name', async () => {
    const user = userEvent.setup();
    render(<ResultsTable rows={rows} tenantId="t1" onRowClick={() => {}} />);
    await user.type(screen.getByPlaceholderText(/search by name/i), 'Outlook');
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
  });

  it('fires onRowClick when a row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<ResultsTable rows={rows} tenantId="t1" onRowClick={onRowClick} />);
    await user.click(screen.getByText('Outlook'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ResultsTable`

- [ ] **Step 3: Implement `SavedViewsMenu`**

Create `src/components/group/SavedViewsMenu.tsx`:

```tsx
import { useState } from 'react';
import { Bookmark, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  loadSavedViews,
  saveView,
  deleteView,
  type SavedView,
} from '@/lib/savedViews';

export interface SavedViewsMenuProps {
  tenantId: string;
  current: Omit<SavedView, 'name'>;
  onApply: (view: SavedView) => void;
}

export function SavedViewsMenu({ tenantId, current, onApply }: SavedViewsMenuProps) {
  const [views, setViews] = useState<SavedView[]>(() => loadSavedViews(tenantId));
  const [name, setName] = useState('');

  const refresh = () => setViews(loadSavedViews(tenantId));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmark className="h-4 w-4" /> Saved views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Saved views
        </div>
        {views.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved views</div>
        ) : (
          views.map((v) => (
            <DropdownMenuItem
              key={v.name}
              className="flex justify-between"
              onSelect={(e) => {
                e.preventDefault();
                onApply(v);
              }}
            >
              <span>{v.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView(tenantId, v.name);
                  refresh();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 p-2">
          <Input
            placeholder="View name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              saveView(tenantId, { name: name.trim(), ...current });
              setName('');
              refresh();
            }}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Implement `ResultsTable`**

```tsx
import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GroupTypeBadge } from './GroupTypeBadge';
import { SavedViewsMenu } from './SavedViewsMenu';
import { type SavedView } from '@/lib/savedViews';
import type { GroupAssignmentResult } from '@/types/graph';

export interface ResultsTableProps {
  rows: GroupAssignmentResult[];
  tenantId: string;
  onRowClick: (row: GroupAssignmentResult) => void;
}

export function ResultsTable({ rows, tenantId, onRowClick }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const showAppIntent = useMemo(() => rows.some((r) => r.appIntent), [rows]);

  const columns = useMemo<ColumnDef<GroupAssignmentResult>[]>(() => {
    const base: ColumnDef<GroupAssignmentResult>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortHeader column={column}>Name</SortHeader>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <SortHeader column={column}>Category</SortHeader>,
        cell: ({ row }) => <GroupTypeBadge category={row.original.category} />,
        filterFn: (row, _id, value: string[]) =>
          value.length === 0 || value.includes(row.original.category),
      },
      {
        accessorKey: 'platform',
        header: ({ column }) => <SortHeader column={column}>Platform</SortHeader>,
        cell: ({ row }) => row.original.platform ?? '—',
      },
      {
        accessorKey: 'intent',
        header: ({ column }) => <SortHeader column={column}>Intent</SortHeader>,
        cell: ({ row }) => (
          <Badge variant={row.original.intent === 'exclude' ? 'destructive' : 'default'}>
            {row.original.intent}
          </Badge>
        ),
      },
    ];
    if (showAppIntent) {
      base.push({
        accessorKey: 'appIntent',
        header: ({ column }) => <SortHeader column={column}>App intent</SortHeader>,
        cell: ({ row }) => row.original.appIntent ?? '—',
      });
    }
    base.push(
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) =>
          row.original.source.kind === 'direct' ? (
            <Badge variant="outline">Direct</Badge>
          ) : (
            <Badge variant="outline">via {row.original.source.groupName ?? '?'}</Badge>
          ),
      },
      {
        accessorKey: 'filter',
        header: 'Filter',
        cell: ({ row }) =>
          row.original.filter ? (
            <span className="text-xs">
              {row.original.filter.displayName ?? row.original.filter.id} ({row.original.filter.mode})
            </span>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'lastModified',
        header: ({ column }) => <SortHeader column={column}>Last modified</SortHeader>,
        cell: ({ row }) =>
          row.original.lastModified
            ? new Date(row.original.lastModified).toLocaleDateString()
            : '—',
      },
    );
    return base;
  }, [showAppIntent]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) =>
      row.original.name.toLowerCase().includes(String(value).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filtersByColumn: Record<string, string[]> = {};
  for (const f of columnFilters) {
    if (Array.isArray(f.value)) filtersByColumn[f.id] = f.value as string[];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search by name…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSorting([]);
            setColumnFilters([]);
            setGlobalFilter('');
          }}
        >
          Reset
        </Button>
        <div className="ml-auto">
          <SavedViewsMenu
            tenantId={tenantId}
            current={{ filters: filtersByColumn, sorting, freeTextSearch: globalFilter }}
            onApply={(v) => applyView(v, setSorting, setColumnFilters, setGlobalFilter)}
          />
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-sm text-muted-foreground">
                  No matching results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRowClick(r.original)}
                >
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortHeader({
  column,
  children,
}: {
  column: any;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
}

function applyView(
  v: SavedView,
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>,
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>,
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>,
) {
  setSorting(v.sorting);
  setColumnFilters(
    Object.entries(v.filters).map(([id, value]) => ({ id, value })),
  );
  setGlobalFilter(v.freeTextSearch);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- ResultsTable`

- [ ] **Step 6: Commit**

```bash
git add src/components/group/ResultsTable.tsx src/components/group/ResultsTable.test.tsx src/components/group/SavedViewsMenu.tsx
git commit -m "feat(group-lookup): add ResultsTable with sorting, filtering, and saved views"
```

---

## Task 18: `GroupLookup` page

**Files:**
- Create: `src/pages/GroupLookup.tsx`

- [ ] **Step 1: Implement the page**

```tsx
import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { Header } from '@/components/Header';
import { GroupSearchBox } from '@/components/group/GroupSearchBox';
import { CategoryProgressList } from '@/components/group/CategoryProgressList';
import { ResultsSummary } from '@/components/group/ResultsSummary';
import { ResultsTable } from '@/components/group/ResultsTable';
import { ResultsDetailDrawer } from '@/components/group/ResultsDetailDrawer';
import { useGroupAssignments } from '@/hooks/useGroupAssignments';
import { ALL_INTUNE_OBJECT_CATEGORIES, type GroupAssignmentResult } from '@/types/graph';
import type { EntraGroupMatch } from '@/hooks/useEntraGroupSearch';

export default function GroupLookupPage() {
  const { accounts } = useMsal();
  const tenantId = accounts[0]?.tenantId ?? 'unknown';

  const [selected, setSelected] = useState<EntraGroupMatch | null>(null);
  const [drawerRow, setDrawerRow] = useState<GroupAssignmentResult | null>(null);

  const { perCategory, results, parentGroups, fatalError } = useGroupAssignments(
    selected?.id ?? null,
  );

  const allDone = ALL_INTUNE_OBJECT_CATEGORIES.every(
    (c) => perCategory[c].status === 'done' || perCategory[c].status === 'error',
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Group Lookup</h1>
          <p className="text-muted-foreground text-sm">
            Search any Entra group to see every Intune object assigned to it.
          </p>
        </div>

        <GroupSearchBox onSelect={setSelected} autoFocus />

        {fatalError && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
            {fatalError}{' '}
            <button
              type="button"
              className="underline"
              onClick={() => setSelected(null)}
            >
              Search another group
            </button>
          </div>
        )}

        {selected && !fatalError && (
          <>
            {!allDone && (
              <CategoryProgressList
                groupName={selected.displayName}
                states={perCategory}
              />
            )}

            {results.length > 0 || allDone ? (
              <>
                <ResultsSummary
                  groupName={selected.displayName}
                  parentGroups={parentGroups}
                  results={results}
                  onSelectParent={(gid) => {
                    const parent = parentGroups.find((p) => p.id === gid);
                    if (parent) setSelected({ id: parent.id, displayName: parent.displayName });
                  }}
                  onCategoryChipClick={() => {
                    /* no-op for v1; clicking the chip is decorative until we wire filter */
                  }}
                />
                <ResultsTable
                  rows={results}
                  tenantId={tenantId}
                  onRowClick={setDrawerRow}
                />
              </>
            ) : null}
          </>
        )}

        <ResultsDetailDrawer
          row={drawerRow}
          open={!!drawerRow}
          onOpenChange={(open) => !open && setDrawerRow(null)}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add src/pages/GroupLookup.tsx
git commit -m "feat(group-lookup): add GroupLookup page"
```

---

## Task 19: Routing + nav integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Register the route in `src/App.tsx`**

Edit `src/App.tsx` — add the import and route line:

```tsx
import GroupLookup from "./pages/GroupLookup";
```

In the `<Routes>` block, add **above** the catch-all `*` route:

```tsx
<Route path="/groups" element={<GroupLookup />} />
```

- [ ] **Step 2: Add nav link in `src/components/Header.tsx`**

In the imports, add `Users` to the lucide imports:

```tsx
import { RefreshCw, LogIn, LogOut, User, Search, LayoutDashboard, Users } from "lucide-react";
```

In the `<nav>` block, after the Dashboard `NavLink`, add:

```tsx
<NavLink to="/groups" className={navLinkClass}>
  <Users className="h-4 w-4" />
  Group Lookup
</NavLink>
```

- [ ] **Step 3: Verify the dev build works**

Run: `npm run dev`
Manually open the app, sign in, click **Group Lookup**, confirm the search box appears. Then Ctrl-C the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Header.tsx
git commit -m "feat(group-lookup): wire /groups route and header nav"
```

---

## Task 20: Manual smoke test + final polish

**Files:** none new — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors related to new files.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no new errors related to new files.

- [ ] **Step 4: Build production bundle**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 5: Smoke-test against a real tenant**

Run: `npm run dev`. Sign in with an account that has Intune read permissions. Steps:

1. Navigate to `/groups`.
2. Search for a known group with assignments (e.g., a department group).
3. Verify:
   - Typeahead shows suggestions within ~250 ms.
   - On selection, all 13 categories appear in the progress list.
   - Categories transition `pending → loading → done`/`error`.
   - Counts increment as data lands.
   - Results table populates incrementally.
   - Clicking a row opens the side drawer with detail and the "Raw JSON" toggle works.
   - Parent-group chips appear when the group is a member of other groups.
   - Picking a different group cancels the previous run and starts over.
   - Save a filter view; reload the page; load the saved view and confirm filters apply.
4. Cross-check 1–2 categories' counts against the Intune portal's "Assignments" view.

- [ ] **Step 6: Commit any final fixes**

If smoke-testing surfaced a bug, fix it and commit. Otherwise no commit needed.

```bash
git add -A
git commit -m "fix(group-lookup): <describe>"
```

---

## Self-Review Checklist (executed during plan authoring)

**Spec coverage:**
- ✅ Group typeahead → Task 9 + 12
- ✅ Transitive parent-group resolution → Task 3
- ✅ Include + exclude with visual distinction → Task 4 (data model) + Task 17 (rendering)
- ✅ All 13 Intune categories → Tasks 4 + 5 + 6 + 8
- ✅ mobileApps `$batch` workaround → Task 5 + 8
- ✅ updateRing derivation → Task 6 + 8
- ✅ Filter ID resolution post-pass → Task 7 + 8
- ✅ Per-category error isolation → Task 8
- ✅ AbortSignal cancellation → Task 8 + 10
- ✅ Streaming hook + page state → Task 10
- ✅ Per-category progress animation → Task 13
- ✅ Summary + count chips + parent-group lineage → Task 14
- ✅ Data table with sort/filter/free-text → Task 17
- ✅ Saved views in localStorage → Tasks 16 + 17
- ✅ Side drawer with raw-JSON fallback → Task 15
- ✅ Routing + nav → Task 19
- ✅ Testing (Vitest + RTL) → Task 1 setup + per-task tests
- ✅ Manual smoke → Task 20

**Placeholder scan:** None found.

**Type consistency:** `IntuneObjectCategory`, `GroupAssignmentResult`, `CategoryState`, `ParentGroupRef` are defined in Task 2 and used unchanged in subsequent tasks. `SavedView` defined in Task 16, consumed in Task 17.

**Out-of-scope reminders (from spec):** No export, no reverse lookup, no transitive child groups, no cross-search caching, no write actions — none of these appear as tasks. ✓
