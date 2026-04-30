import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsDetailDrawer } from './ResultsDetailDrawer';
import type { GroupAssignmentResult } from '@/types/graph';

const row: GroupAssignmentResult = {
  id: '1',
  category: 'platformScript',
  name: 'Custom Script',
  intent: 'include',
  source: { kind: 'direct' },
  rawObject: { foo: 'bar' },
};

describe('ResultsDetailDrawer', () => {
  it('renders the row name and category and a Raw JSON toggle', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ResultsDetailDrawer row={row} open onOpenChange={onOpenChange} />);
    expect(screen.getByText('Custom Script')).toBeInTheDocument();
    expect(screen.getByText(/Platform Script/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /raw json/i }));
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
  });
});
