import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { resolveTargetGroupSet } from './groupAssignmentService';
import { BATCH_CATEGORY_CONFIGS } from './groupAssignmentService';

describe('category registration', () => {
  it('every category routes through BATCH mode', () => {
    const expected = [
      'configurationPolicy',
      'deviceConfiguration',
      'compliancePolicy',
      'appProtection',
      'appConfiguration',
      'platformScript',
      'remediationScript',
      'complianceScript',
      'autopilotProfile',
      'enrollmentConfig',
      'mobileApp',
      'endpointSecurity',
    ];
    const batch = BATCH_CATEGORY_CONFIGS.map((c) => c.category);
    expect(batch).toEqual(expect.arrayContaining(expected));
  });

  it('configurationPolicy uses /beta endpoint with isAssigned filter and select', () => {
    const cfg = BATCH_CATEGORY_CONFIGS.find((c) => c.category === 'configurationPolicy')!;
    expect(cfg.listEndpoint).toBe('/deviceManagement/configurationPolicies');
    expect(cfg.listFilter).toBe('isAssigned eq true');
    expect(cfg.listSelect).toBe('id,name,description,platforms,lastModifiedDateTime,isAssigned');
    expect(cfg.assignmentsPathFor('p1')).toBe('/deviceManagement/configurationPolicies/p1/assignments');
  });

  it('deviceConfiguration uses beta endpoint without @odata.type in select', () => {
    const cfg = BATCH_CATEGORY_CONFIGS.find((c) => c.category === 'deviceConfiguration')!;
    expect(cfg.listEndpoint).toBe('/deviceManagement/deviceConfigurations');
    expect(cfg.listFilter).toBeUndefined();
    expect(cfg.listSelect).toBe('id,displayName,description,lastModifiedDateTime');
    expect(cfg.assignmentsPathFor('p1')).toBe('/deviceManagement/deviceConfigurations/p1/assignments');
  });
});

function makeMockClient(handlers: Record<string, () => unknown>): Client {
  return {
    api: (path: string) => {
      const handler = handlers[path];
      if (!handler) throw new Error(`Unmocked path: ${path}`);
      return {
        select: () => ({ get: async () => handler() }),
        header: () => ({
          get: async () => handler(),
          select: () => ({
            get: async () => handler(),
            top: () => ({ get: async () => handler() }),
          }),
          top: () => ({
            get: async () => handler(),
            select: () => ({ get: async () => handler() }),
          }),
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
    const builder: any = {
      expand: () => builder,
      top: () => builder,
      get: async () => {
        const page = pages[i] ?? [];
        i++;
        return {
          value: page,
          '@odata.nextLink': i < pages.length ? `next-${i}` : undefined,
        };
      },
    };
    return {
      api: () => builder,
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

import { processBatchCategory, type BatchCategoryConfig } from './groupAssignmentService';
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
  }): { client: Client; postedBatches: any[]; listFilters: string[] } {
    const postedBatches: any[] = [];
    const listFilters: string[] = [];
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
        // self-referential builder: filter/select/top/get all return the same builder
        const builder: any = {
          filter: (s: string) => {
            listFilters.push(s);
            return builder;
          },
          select: () => builder,
          top: () => builder,
          get: async () => handler(),
        };
        return builder;
      },
    } as unknown as Client;
    return { client, postedBatches, listFilters };
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
    expect(rows).toHaveLength(20);
    expect(rows[0]).toMatchObject({
      category: 'mobileApp',
      intent: 'include',
      appIntent: 'required',
    });
  });

  it('passes listFilter to the list endpoint when configured', async () => {
    const filteredConfig: BatchCategoryConfig = {
      ...config,
      listFilter: 'isAssigned eq true',
    };
    const { client, listFilters } = batchClient({
      listPages: [[]],
      batchResponses: [],
    });

    await processBatchCategory(client, filteredConfig, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(listFilters).toEqual(['isAssigned eq true']);
  });

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
      listEndpoint: '/deviceAppManagement/mobileApps',
      listSelect: 'id,displayName,lastModifiedDateTime,@odata.type,isAssigned',
      listFilter: 'isAssigned eq true',
      assignmentsPathFor: (id) => `/deviceAppManagement/mobileApps/${id}/assignments`,
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

  it('configurationPolicy: extracts platform from policies via normalizer', async () => {
    const cfg = BATCH_CATEGORY_CONFIGS.find((c) => c.category === 'configurationPolicy')!;
    const policies = [
      { id: 'p-win', name: 'Win', platforms: 'windows10' },
      { id: 'p-ios', name: 'iOS', platforms: 'iOS' },
      { id: 'p-mac', name: 'Mac', platforms: 'macOS' },
      { id: 'p-and', name: 'And', platforms: 'android' },
    ];
    const { client } = batchClient({
      listPages: [policies],
      batchResponses: [
        policies.map((_, i) => ({
          id: String(i + 1),
          status: 200,
          body: {
            value: [
              {
                id: `a-${i}`,
                target: {
                  '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                  groupId: 'g1',
                },
              },
            ],
          },
        })),
      ],
    });

    const rows = await processBatchCategory(client, cfg, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(rows).toHaveLength(4);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.platform]));
    expect(byId).toEqual({
      'p-win': 'Windows',
      'p-ios': 'iOS',
      'p-mac': 'macOS',
      'p-and': 'Android',
    });
    expect(rows.every((r) => r.category === 'configurationPolicy')).toBe(true);
    expect(rows.every((r) => r.intent === 'include')).toBe(true);
  });

  it('configurationPolicy: handles include + exclude assignments on the same policy', async () => {
    const cfg = BATCH_CATEGORY_CONFIGS.find((c) => c.category === 'configurationPolicy')!;
    const { client } = batchClient({
      listPages: [
        [{ id: 'p1', name: 'P', platforms: 'windows10' }],
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
                {
                  id: 'a2',
                  target: {
                    '@odata.type': '#microsoft.graph.exclusionGroupAssignmentTarget',
                    groupId: 'parent1',
                  },
                },
              ],
            },
          },
        ],
      ],
    });

    const rows = await processBatchCategory(client, cfg, {
      targetIds: new Set(['g1', 'parent1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map([
        ['parent1', { id: 'parent1', displayName: 'Parent' }],
      ]),
      signal: new AbortController().signal,
    });

    expect(rows).toHaveLength(2);
    const direct = rows.find((r) => r.source.kind === 'direct')!;
    const parent = rows.find((r) => r.source.kind === 'parent')!;
    expect(direct.intent).toBe('include');
    expect(parent.intent).toBe('exclude');
    expect(parent.source.kind === 'parent' && parent.source.groupName).toBe('Parent');
  });

  it('deviceConfiguration: rows include rawObject so deriveUpdateRingRows can reclassify updateRing later', async () => {
    const cfg = BATCH_CATEGORY_CONFIGS.find((c) => c.category === 'deviceConfiguration')!;
    const winUpdate = {
      id: 'wu1',
      displayName: 'Patch Tuesday',
      '@odata.type': '#microsoft.graph.windowsUpdateForBusinessConfiguration',
    };
    const wifi = {
      id: 'cfg1',
      displayName: 'Wifi',
      '@odata.type': '#microsoft.graph.windows10GeneralConfiguration',
    };
    const { client } = batchClient({
      listPages: [[winUpdate, wifi]],
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
          {
            id: '2',
            status: 200,
            body: {
              value: [
                {
                  id: 'a2',
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

    const rows = await processBatchCategory(client, cfg, {
      targetIds: new Set(['g1']),
      selectedGroupId: 'g1',
      parentGroupsById: new Map(),
      signal: new AbortController().signal,
    });

    expect(rows).toHaveLength(2);
    // Both rows are still 'deviceConfiguration' here — runBatchCategory in
    // fetchGroupAssignments reclassifies via deriveUpdateRingRows.
    expect(rows.every((r) => r.category === 'deviceConfiguration')).toBe(true);
    // rawObject must carry @odata.type so the post-process can inspect it.
    const wuRow = rows.find((r) => r.id === 'wu1')!;
    expect((wuRow.rawObject as any)['@odata.type']).toBe(
      '#microsoft.graph.windowsUpdateForBusinessConfiguration',
    );
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

import { resolveFilterDisplayNames, fetchGroupAssignments } from './groupAssignmentService';
import type { CategoryState as _CategoryState, IntuneObjectCategory as _IntuneObjectCategory } from '@/types/graph';

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
          },
        ],
      }),
    };
    const client = {
      api: (path: string) => {
        const handler = handlers[path] ?? (() => ({ value: [] }));
        const builder: any = {
          get: async () => handler(),
          post: async () => ({
            // BATCH mode: deviceConfiguration assignments come back here.
            responses: [
              {
                id: '1',
                status: 200,
                body: {
                  value: [
                    {
                      id: 'a',
                      target: {
                        '@odata.type': '#microsoft.graph.groupAssignmentTarget',
                        groupId: 'g1',
                      },
                    },
                  ],
                },
              },
            ],
          }),
          select: () => builder,
          expand: () => builder,
          filter: () => builder,
          top: () => builder,
          header: () => builder,
        };
        return builder;
      },
    } as unknown as Client;

    const statuses: Array<[_IntuneObjectCategory, _CategoryState]> = [];
    const results: Array<[_IntuneObjectCategory, GroupAssignmentResult[]]> = [];

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

    const statuses: Array<[_IntuneObjectCategory, _CategoryState]> = [];

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

  it('marks updateRing as error when deviceConfiguration fails', async () => {
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

    const statuses: Array<[_IntuneObjectCategory, _CategoryState]> = [];

    await fetchGroupAssignments(client, 'g1', {
      signal: new AbortController().signal,
      onCategoryStatus: (c, s) => statuses.push([c, s]),
      onResults: () => {},
      onParentGroups: () => {},
    });

    const updateRingFinal = [...statuses]
      .reverse()
      .find(([c]) => c === 'updateRing');
    expect(updateRingFinal?.[1].status).toBe('error');
  });
});

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
