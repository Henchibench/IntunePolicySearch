import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverCriticalityBadge } from './DriverCriticalityBadge';

describe('DriverCriticalityBadge', () => {
  it('renders Urgent with red color class', () => {
    const { container } = render(<DriverCriticalityBadge criticality="Urgent" />);
    expect(container.querySelector('.text-red-500')).toBeTruthy();
    expect(screen.getByLabelText(/urgent/i)).toBeInTheDocument();
  });

  it('renders Recommended with amber color class', () => {
    const { container } = render(<DriverCriticalityBadge criticality="Recommended" />);
    expect(container.querySelector('.text-amber-500')).toBeTruthy();
  });

  it('renders nothing when criticality is null', () => {
    const { container } = render(<DriverCriticalityBadge criticality={null} />);
    expect(container.firstChild).toBeNull();
  });
});
