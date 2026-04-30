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
