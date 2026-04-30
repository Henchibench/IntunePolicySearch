import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterChipGroup } from './FilterChipGroup';

const opts = [
  { value: 'a', label: 'Alpha', count: 3 },
  { value: 'b', label: 'Bravo', count: 1 },
  { value: 'c', label: 'Charlie', count: 0 },
];

describe('FilterChipGroup', () => {
  it('renders the label and chips with counts, hiding zero-count options', () => {
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Platform:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alpha.*3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bravo.*1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Charlie/ })).not.toBeInTheDocument();
  });

  it('marks selected chips aria-pressed=true', () => {
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={['a']}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Alpha/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: /Bravo/ }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('toggles a chip on click — adds to selected when clicking unselected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={['a']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Bravo/ }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('toggles a chip on click — removes from selected when clicking selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChipGroup
        label="Platform"
        options={opts}
        selected={['a', 'b']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('renders nothing when every option has count zero', () => {
    const { container } = render(
      <FilterChipGroup
        label="Platform"
        options={[
          { value: 'a', label: 'A', count: 0 },
          { value: 'b', label: 'B', count: 0 },
        ]}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
