import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverByPolicy } from './DriverByPolicy';
import type { Driver, DriverProfile } from '@/types/drivers';

const profile = (id: string, name: string, approvalType: 'manual' | 'automatic' = 'manual'): DriverProfile => ({
  id, displayName: name, description: null, approvalType,
  inventorySyncStatus: null, newUpdates: 0, deviceReporting: 0,
  createdDateTime: '', lastModifiedDateTime: '',
});

const driver = (name: string, profileId: string, profileName: string, status: Driver['policies'][0]['approvalStatus'] = 'needsReview'): Driver => ({
  key: `dell inc.|video|${name.toLowerCase()}`,
  inventoryIds: [`${profileId}-${name}`],
  name, manufacturer: 'Dell Inc.', driverClass: 'Video', version: '1.0',
  releaseDateTime: '2025-01-01T00:00:00Z',
  applicableDeviceCount: 5, deviceCount: 10,
  policies: [{ profileId, profileName, approvalType: 'manual', approvalStatus: status }],
  catalog: null,
});

describe('DriverByPolicy', () => {
  it('renders one group per policy with aggregate counts', () => {
    const profiles = [profile('p1', 'Ring 1'), profile('p2', 'Ring 2')];
    const drivers = [
      driver('A', 'p1', 'Ring 1', 'needsReview'),
      driver('B', 'p1', 'Ring 1', 'approved'),
      driver('C', 'p2', 'Ring 2', 'needsReview'),
    ];
    render(<DriverByPolicy profiles={profiles} drivers={drivers} onDriverClick={() => {}} />);
    expect(screen.getByText('Ring 1')).toBeInTheDocument();
    expect(screen.getByText('Ring 2')).toBeInTheDocument();
    expect(screen.getByText(/2 drivers · 1 needs review/)).toBeInTheDocument();
    expect(screen.getByText(/1 driver · 1 needs review/)).toBeInTheDocument();
  });

  it('expands a group when its header is clicked, revealing driver rows', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const drivers = [driver('A', 'p1', 'Ring 1')];
    render(<DriverByPolicy profiles={profiles} drivers={drivers} onDriverClick={() => {}} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ring 1/ }));
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('calls onDriverClick when a driver row inside a group is clicked', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const drivers = [driver('A', 'p1', 'Ring 1')];
    const handler = vi.fn();
    render(<DriverByPolicy profiles={profiles} drivers={drivers} onDriverClick={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /Ring 1/ }));
    fireEvent.click(screen.getByRole('row', { name: /^A$/ }));
    expect(handler).toHaveBeenCalled();
  });

  it('shows per-profile error when inventoryErrors contains the profile id', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const drivers = [driver('A', 'p1', 'Ring 1')];
    const inventoryErrors = new Map([['p1', 'Network timeout']]);
    render(
      <DriverByPolicy
        profiles={profiles}
        drivers={drivers}
        onDriverClick={() => {}}
        inventoryErrors={inventoryErrors}
      />
    );
    expect(screen.getByText(/Failed to load drivers for this profile/)).toBeInTheDocument();
  });
});
