import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsSummary } from './ResultsSummary';
import type { FilterState } from '@/lib/facetCounts';

const emptyFilters: FilterState = { category: [], platform: [], appType: [], intent: [] };

describe('ResultsSummary', () => {
  it('shows group name, parent groups, and category chips with counts', () => {
    render(
      <ResultsSummary
        groupName="Marketing-US"
        parentGroups={[{ id: 'p1', displayName: 'All-Marketing' }]}
        categoryOptions={[
          { value: 'mobileApp', label: 'Mobile App', count: 2 },
          { value: 'compliancePolicy', label: 'Compliance Policy', count: 1 },
        ]}
        filters={emptyFilters}
        onFiltersChange={() => {}}
        includeCount={2}
        excludeCount={1}
        totalCount={3}
        onSelectParent={() => {}}
      />,
    );
    expect(screen.getByText('Marketing-US')).toBeInTheDocument();
    expect(screen.getByText('All-Marketing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mobile App.*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compliance Policy.*1/ })).toBeInTheDocument();
  });

  it('fires onFiltersChange when a category chip is clicked', async () => {
    const onFiltersChange = vi.fn();
    render(
      <ResultsSummary
        groupName="x"
        parentGroups={[]}
        categoryOptions={[
          { value: 'mobileApp', label: 'Mobile App', count: 5 },
        ]}
        filters={emptyFilters}
        onFiltersChange={onFiltersChange}
        includeCount={5}
        excludeCount={0}
        totalCount={5}
        onSelectParent={() => {}}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /Mobile App/ }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      category: ['mobileApp'],
      platform: [],
      appType: [],
      intent: [],
    });
  });

  it('fires onSelectParent when a parent chip is clicked', async () => {
    const onSelectParent = vi.fn();
    render(
      <ResultsSummary
        groupName="x"
        parentGroups={[{ id: 'p1', displayName: 'Parent' }]}
        categoryOptions={[]}
        filters={emptyFilters}
        onFiltersChange={() => {}}
        includeCount={0}
        excludeCount={0}
        totalCount={0}
        onSelectParent={onSelectParent}
      />,
    );
    await userEvent.setup().click(screen.getByText('Parent'));
    expect(onSelectParent).toHaveBeenCalledWith('p1');
  });
});
