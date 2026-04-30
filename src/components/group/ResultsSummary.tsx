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
