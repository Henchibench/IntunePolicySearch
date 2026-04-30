import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupSearchBox } from './GroupSearchBox';

const mockExpand = vi.fn();

vi.mock('@/hooks/useEntraGroupSearch', () => ({
  useEntraGroupSearch: (q: string) => {
    const matches =
      q.length >= 2
        ? [{ id: 'g1', displayName: 'Marketing-US', mail: 'mkt@x.com' }]
        : [];
    return {
      matches,
      // Pretend the server reports many more matches than the typeahead returned.
      total: q.length >= 2 ? 42 : null,
      isLoading: false,
      error: null,
      mode: 'typeahead' as const,
      expandToFullList: mockExpand,
    };
  },
}));

describe('GroupSearchBox', () => {
  it('shows matches and fires onSelect with the selected group', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<GroupSearchBox onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText(/search groups/i), 'Mar');
    await user.click(await screen.findByText('Marketing-US'));

    expect(onSelect).toHaveBeenCalledWith({
      id: 'g1',
      displayName: 'Marketing-US',
      mail: 'mkt@x.com',
    });
  });

  it('displays an empty hint for short queries', async () => {
    const user = userEvent.setup();
    render(<GroupSearchBox onSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText(/search groups/i), 'M');
    expect(
      screen.getByText(/keep typing/i),
    ).toBeInTheDocument();
  });

  it('renders a "Show all matches" sentinel when total exceeds matches and triggers expandToFullList on click', async () => {
    const user = userEvent.setup();
    mockExpand.mockClear();
    render(<GroupSearchBox onSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText(/search groups/i), 'Mar');

    const sentinel = await screen.findByText(/Show all matches for "Mar" \(42\)/);
    await user.click(sentinel);

    expect(mockExpand).toHaveBeenCalledTimes(1);
  });
});
