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
    default: {
      const _exhaustive: never = dim;
      return _exhaustive;
    }
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
