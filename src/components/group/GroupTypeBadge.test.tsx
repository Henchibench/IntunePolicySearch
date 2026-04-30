import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupTypeBadge } from './GroupTypeBadge';

describe('GroupTypeBadge', () => {
  it('renders the human label for a category', () => {
    render(<GroupTypeBadge category="mobileApp" />);
    expect(screen.getByText('Application')).toBeInTheDocument();
  });

  it('renders the updateRing label', () => {
    render(<GroupTypeBadge category="updateRing" />);
    expect(screen.getByText('Update Ring')).toBeInTheDocument();
  });
});
