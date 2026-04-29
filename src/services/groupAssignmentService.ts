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
