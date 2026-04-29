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
        // self-referential builder for the list call: select/top/get all return the same builder
        const builder: any = {
          select: () => builder,
          top: () => builder,
          get: async () => handler(),
        };
        return builder;
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
