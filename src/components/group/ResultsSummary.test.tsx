import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsSummary } from './ResultsSummary';
import type { GroupAssignmentResult } from '@/types/graph';

const sample: GroupAssignmentResult[] = [
  { id: '1', category: 'mobileApp', name: 'A', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '2', category: 'mobileApp', name: 'B', intent: 'exclude', source: { kind: 'direct' }, rawObject: {} },
  { id: '3', category: 'compliancePolicy', name: 'C', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
];

describe('ResultsSummary', () => {
  it('shows group name, parent groups, and count chips', () => {
    render(
      <ResultsSummary
        groupName="Marketing-US"
        parentGroups={[{ id: 'p1', displayName: 'All-Marketing' }]}
        results={sample}
        onSelectParent={() => {}}
        onCategoryChipClick={() => {}}
      />,
    );
    expect(screen.getByText('Marketing-US')).toBeInTheDocument();
    expect(screen.getByText('All-Marketing')).toBeInTheDocument();
    expect(screen.getByText(/Mobile App.*2/)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Policy.*1/)).toBeInTheDocument();
  });

  it('fires onSelectParent when a parent chip is clicked', async () => {
    const onSelectParent = vi.fn();
    render(
      <ResultsSummary
        groupName="x"
        parentGroups={[{ id: 'p1', displayName: 'Parent' }]}
        results={[]}
        onSelectParent={onSelectParent}
        onCategoryChipClick={() => {}}
      />,
    );
    await userEvent.setup().click(screen.getByText('Parent'));
    expect(onSelectParent).toHaveBeenCalledWith('p1');
  });
});
