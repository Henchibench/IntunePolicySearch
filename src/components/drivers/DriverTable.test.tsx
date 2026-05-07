import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverTable } from './DriverTable';
import type { Driver } from '@/types/drivers';

const driver = (over: Partial<Driver> = {}): Driver => ({
  key: 'dell inc.|video|sample',
  inventoryId: 'inv1',
  name: 'Sample Driver',
  manufacturer: 'Dell Inc.',
  driverClass: 'Video',
  version: '1.0.0',
  releaseDateTime: '2025-01-01T00:00:00Z',
  applicableDeviceCount: 5,
  deviceCount: 10,
  policies: [
    { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'needsReview' },
  ],
  catalog: null,
  ...over,
});

describe('DriverTable', () => {
  it('renders one row per driver and shows the name + version', () => {
    render(<DriverTable drivers={[driver()]} onDriverClick={() => {}} />);
    expect(screen.getByText('Sample Driver')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('shows policies count pill when driver is in multiple policies', () => {
    const d = driver({
      policies: [
        { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'approved' },
        { profileId: 'p2', profileName: 'Ring 2', approvalType: 'manual', approvalStatus: 'needsReview' },
      ],
    });
    render(<DriverTable drivers={[d]} onDriverClick={() => {}} />);
    expect(screen.getByText(/2 policies/i)).toBeInTheDocument();
  });

  it('calls onDriverClick when a row is clicked', () => {
    const handler = vi.fn();
    render(<DriverTable drivers={[driver()]} onDriverClick={handler} />);
    fireEvent.click(screen.getByRole('row', { name: /Sample Driver/i }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sample Driver' }));
  });

  it('shows "No drivers match the current filters." when the list is empty', () => {
    render(<DriverTable drivers={[]} onDriverClick={() => {}} />);
    expect(screen.getByText(/No drivers match/i)).toBeInTheDocument();
  });
});
