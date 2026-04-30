import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryProgressList } from './CategoryProgressList';
import { ALL_INTUNE_OBJECT_CATEGORIES, type CategoryState, type IntuneObjectCategory } from '@/types/graph';

function makeStates(overrides: Partial<Record<IntuneObjectCategory, CategoryState>> = {}) {
  const m = {} as Record<IntuneObjectCategory, CategoryState>;
  for (const c of ALL_INTUNE_OBJECT_CATEGORIES) m[c] = { status: 'pending' };
  return { ...m, ...overrides };
}

describe('CategoryProgressList', () => {
  it('shows the cumulative count of completed categories', () => {
    render(
      <CategoryProgressList
        groupName="My Group"
        states={makeStates({
          deviceConfiguration: { status: 'done', count: 5 },
          compliancePolicy: { status: 'done', count: 2 },
        })}
      />,
    );
    expect(screen.getByText(/2 of 13 complete/i)).toBeInTheDocument();
    expect(screen.getByText(/7 connections found/i)).toBeInTheDocument();
  });

  it('shows the group name in the heading', () => {
    render(<CategoryProgressList groupName="Marketing-US" states={makeStates()} />);
    expect(screen.getByText(/Inspecting Marketing-US/i)).toBeInTheDocument();
  });

  it('shows error state for failed categories', () => {
    render(
      <CategoryProgressList
        groupName="x"
        states={makeStates({
          deviceConfiguration: { status: 'error', error: 'denied' },
        })}
      />,
    );
    expect(screen.getByText(/denied/i)).toBeInTheDocument();
  });
});
