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
    const message = humanizeError(e);
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

  const allRows: GroupAssignmentResult[] = [];

  const runExpandCategory = async (config: ExpandCategoryConfig) => {
    onCategoryStatus(config.category, { status: 'loading' });
    try {
      let rows = await processExpandCategory(client, config, ctx);
      if (config.category === 'deviceConfiguration') {
        rows = deriveUpdateRingRows(rows);
        const updateRingRows = rows.filter((r) => r.category === 'updateRing');
        rows = rows.filter((r) => r.category !== 'updateRing');
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
      const errorMessage = humanizeError(e);
      onCategoryStatus(config.category, {
        status: 'error',
        error: errorMessage,
      });
      if (config.category === 'deviceConfiguration') {
        // updateRing is derived from deviceConfiguration; if that fails, mark updateRing too.
        onCategoryStatus('updateRing', {
          status: 'error',
          error: errorMessage,
        });
      }
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

  await Promise.allSettled([
    ...EXPAND_CATEGORY_CONFIGS.map((c) => runExpandCategory(c)),
    ...BATCH_CATEGORY_CONFIGS.map((c) => runBatchCategory(c)),
  ]);

  if (signal.aborted) return;

  try {
    const withFilterNames = await resolveFilterDisplayNames(client, allRows);
    const changedByCategory = new Map<IntuneObjectCategory, GroupAssignmentResult[]>();
    for (const r of withFilterNames) {
      if (!changedByCategory.has(r.category)) changedByCategory.set(r.category, []);
      changedByCategory.get(r.category)!.push(r);
    }
    for (const [cat, rows] of changedByCategory) {
      onResults(cat, rows);
    }
  } catch (e) {
    console.warn('Filter name resolution failed:', e);
  }
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
  listFilter?: string;
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
    let builder: ReturnType<Client['api']>;
    if (nextLink) {
      builder = client.api(nextLink);
    } else {
      builder = client.api(config.listEndpoint);
      if (config.listFilter) builder = builder.filter(config.listFilter);
      if (config.listSelect) builder = builder.select(config.listSelect);
      builder = builder.top(PAGE_SIZE);
    }
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

// ============================================================================
// Category configurations for fetchGroupAssignments
// ============================================================================

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
    listSelect: 'id,displayName,lastModifiedDateTime',
    listFilter: 'isAssigned eq true',
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
    assignmentsPathFor: (id) => `/deviceManagement/intents/${id}/assignments`,
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

function humanizeError(e: any): string {
  if (e?.statusCode === 403 || e?.code === 'Forbidden')
    return 'Permission denied — your tenant or account may not have access to this resource.';
  if (e?.statusCode === 404) return 'Endpoint not available in this tenant.';
  if (e?.statusCode === 429) return 'Rate limited by Microsoft Graph.';
  return e?.message ?? 'Unknown error';
}
