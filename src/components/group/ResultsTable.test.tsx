import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsTable } from './ResultsTable';
import type { GroupAssignmentResult } from '@/types/graph';
import type { FilterState } from '@/lib/facetCounts';

const emptyFilters: FilterState = {
  category: [], platform: [], appType: [], intent: [],
};

const rows: GroupAssignmentResult[] = [
  { id: '1', category: 'mobileApp', name: 'Outlook', platform: 'iOS', intent: 'include', appIntent: 'required', source: { kind: 'direct' }, rawObject: {} },
  { id: '2', category: 'compliancePolicy', name: 'Win Compliance', platform: 'Windows', intent: 'include', source: { kind: 'parent', groupId: 'p1', groupName: 'All-Marketing' }, rawObject: {} },
  { id: '3', category: 'mobileApp', name: 'Teams', platform: 'iOS', intent: 'exclude', source: { kind: 'direct' }, rawObject: {} },
];

describe('ResultsTable', () => {
  it('renders all rows initially', () => {
    render(
      <ResultsTable
        rows={rows}
        tenantId="t1"
        filters={emptyFilters}
        onFiltersChange={() => {}}
        onRowClick={() => {}}
      />,
    );
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.getByText('Win Compliance')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
  });

  it('filters by free-text search on name', async () => {
    const user = userEvent.setup();
    render(
      <ResultsTable
        rows={rows}
        tenantId="t1"
        filters={emptyFilters}
        onFiltersChange={() => {}}
        onRowClick={() => {}}
      />,
    );
    await user.type(screen.getByPlaceholderText(/search by name/i), 'Outlook');
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
  });

  it('fires onRowClick when a row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <ResultsTable
        rows={rows}
        tenantId="t1"
        filters={emptyFilters}
        onFiltersChange={() => {}}
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByText('Outlook'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
