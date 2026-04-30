import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('shows error state for failed categories on hover', async () => {
    const user = userEvent.setup();
    render(
      <CategoryProgressList
        groupName="x"
        states={makeStates({
          deviceConfiguration: { status: 'error', error: 'denied' },
        })}
      />,
    );
    const errorIcon = document.querySelector('.lucide-circle-alert, .lucide-alert-circle');
    if (!errorIcon) throw new Error('error icon not found');
    await user.hover(errorIcon);
    const matches = await screen.findAllByText(/denied/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
