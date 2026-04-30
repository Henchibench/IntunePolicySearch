import {
  ALL_INTUNE_OBJECT_CATEGORIES,
  type IntuneObjectCategory,
  type ParentGroupRef,
} from '@/types/graph';
import { categoryLabel } from './GroupTypeBadge';
import { FilterChipGroup, type FilterChipOption } from './FilterChipGroup';
import type { FilterState } from '@/lib/facetCounts';

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

export function buildCategoryOptions(
  counts: Map<string, number>,
): FilterChipOption[] {
  return ALL_INTUNE_OBJECT_CATEGORIES
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .map((c) => ({ value: c, label: categoryLabel(c), count: counts.get(c) ?? 0 }));
}
