import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupSearchBox } from './GroupSearchBox';

vi.mock('@/hooks/useEntraGroupSearch', () => ({
  useEntraGroupSearch: (q: string) => ({
    matches:
      q.length >= 2
        ? [{ id: 'g1', displayName: 'Marketing-US', mail: 'mkt@x.com' }]
        : [],
    isLoading: false,
    error: null,
  }),
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
});
