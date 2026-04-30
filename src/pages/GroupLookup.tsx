import { useState, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import { PillNav } from '@/components/PillNav';
import { UtilityRow } from '@/components/UtilityRow';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import { GroupSearchBox } from '@/components/group/GroupSearchBox';
import { CategoryProgressList } from '@/components/group/CategoryProgressList';
import { ResultsSummary, buildCategoryOptions } from '@/components/group/ResultsSummary';
import { ResultsTable } from '@/components/group/ResultsTable';
import { ResultsDetailDrawer } from '@/components/group/ResultsDetailDrawer';
import { useGroupAssignments } from '@/hooks/useGroupAssignments';
import { ALL_INTUNE_OBJECT_CATEGORIES, type GroupAssignmentResult } from '@/types/graph';
import type { EntraGroupMatch } from '@/hooks/useEntraGroupSearch';
import { computeFacetCounts, type FilterState } from '@/lib/facetCounts';

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

  const { perCategory, results, parentGroups, fatalError } = useGroupAssignments(
    selected?.id ?? null,
  );

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

  const allDone = ALL_INTUNE_OBJECT_CATEGORIES.every(
    (c) => perCategory[c].status === 'done' || perCategory[c].status === 'error',
  );

  return (
    <div className="min-h-screen bg-canvas">
      <div className="px-6">
        <PillNav />
        <UtilityRow />
      </div>
      <main className="mx-auto mt-12 max-w-[1240px] px-8 pb-24 space-y-8">
        <div>
          <EyebrowLabel>GROUP LOOKUP</EyebrowLabel>
          <h1 className="mt-3 text-[44px] font-medium leading-tight tracking-tight2 text-ink">
            Search any Entra group.
          </h1>
          <p className="mt-2 text-sm font-[450] text-slate">
            Find every Intune object assigned to a group — policies, apps, configurations.
          </p>
        </div>

        <GroupSearchBox onSelect={setSelected} autoFocus />

        {fatalError && (
          <div className="rounded-2xl border border-signal/30 bg-signal/[0.10] p-3 text-sm text-signal-light">
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
                <ResultsTable
                  rows={results}
                  tenantId={tenantId}
                  filters={filters}
                  onFiltersChange={setFilters}
                  onRowClick={setDrawerRow}
                />
              </>
            ) : null}
          </>
        )}

        {drawerRow && (
          <ResultsDetailDrawer
            row={drawerRow}
            open
            onOpenChange={(open) => !open && setDrawerRow(null)}
          />
        )}
      </main>
    </div>
  );
}
