import type { Client } from '@microsoft/microsoft-graph-client';
import type {
  AppInstallIntent,
  CategoryState,
  GroupAssignmentResult,
  GroupAssignmentSource,
  IntuneObjectCategory,
  IntunePlatform,
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
    // v1 limitation: assumes <= 999 transitive parents. Switch to nextLink paging if needed.
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

// ============================================================================
// processExpandCategory — generic handler for ?$expand=assignments categories
// ============================================================================

export interface ExpandCategoryConfig {
  category: IntuneObjectCategory;
  endpoint: string;
  extractName: (obj: any) => string;
  extractDescription?: (obj: any) => string | undefined;
  extractPlatform?: (obj: any) => IntunePlatform | undefined;
  extractLastModified?: (obj: any) => string | undefined;
  extractAppIntent?: (assignment: any) => AppInstallIntent | undefined;
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

    const isExclude =
      !!targetType && targetType.endsWith('exclusionGroupAssignmentTarget');

    const filterId = a.target
      ?.deviceAndAppManagementAssignmentFilterId as string | undefined;
    const filterMode = a.target
      ?.deviceAndAppManagementAssignmentFilterType as
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

  return rows;
}

// ============================================================================
// processBatchCategory — list + $batch assignment fetches (mobileApps, intents)
// ============================================================================

export interface BatchCategoryConfig {
  category: IntuneObjectCategory;
  listEndpoint: string;
  listSelect?: string;
  assignmentsPathFor: (objectId: string) => string;
  extractName: (obj: any) => string;
  extractDescription?: (obj: any) => string | undefined;
  extractPlatform?: (obj: any) => IntunePlatform | undefined;
  extractLastModified?: (obj: any) => string | undefined;
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
  const batches = chunk(objects, BATCH_SIZE);
  const rows: GroupAssignmentResult[] = [];

  // Adapt BatchCategoryConfig → ExpandCategoryConfig so we can reuse buildRowsFromObject.
  const adaptedConfig: ExpandCategoryConfig = {
    category: config.category,
    endpoint: config.listEndpoint,
    extractName: config.extractName,
    extractDescription: config.extractDescription,
    extractPlatform: config.extractPlatform,
    extractLastModified: config.extractLastModified,
    extractAppIntent: config.extractAppIntent,
  };

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
      .post({ requests })) as {
      responses: Array<{ id: string; status: number; body: any }>;
    };

    for (const r of resp.responses ?? []) {
      if (r.status !== 200) continue; // tolerate per-item failures
      const obj = objectByReqId.get(r.id);
      if (!obj) continue;
      const assignments: any[] = r.body?.value ?? [];

      // Attach fetched assignments to the local obj and reuse buildRowsFromObject.
      obj.assignments = assignments;
      rows.push(...buildRowsFromObject(obj, adaptedConfig, ctx));
    }
  }

  if (ctx.signal.aborted) throw new Error('aborted');
  return rows;
}

// ============================================================================
// deriveUpdateRingRows — reclassify Windows update profile rows
// ============================================================================

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

  if (ctx.signal.aborted) throw new Error('aborted');
  return results;
}

// ============================================================================
// resolveFilterDisplayNames — post-pass to patch filter names into rows
// ============================================================================

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
