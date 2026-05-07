import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverDetailDrawer } from './DriverDetailDrawer';
import type { Driver } from '@/types/drivers';

const baseDriver: Driver = {
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
};

describe('DriverDetailDrawer', () => {
  it('shows driver name, manufacturer, and version in header', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByText('Sample Driver')).toBeInTheDocument();
    expect(screen.getByText(/Dell Inc.*Video.*1\.0\.0/)).toBeInTheDocument();
  });

  it('renders the policies section with each policy + per-policy approval', () => {
    const d: Driver = {
      ...baseDriver,
      policies: [
        { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'approved' },
        { profileId: 'p2', profileName: 'Ring 2', approvalType: 'automatic', approvalStatus: 'needsReview' },
      ],
    };
    render(<DriverDetailDrawer driver={d} open onOpenChange={() => {}} />);
    expect(screen.getByText('Ring 1')).toBeInTheDocument();
    expect(screen.getByText('Ring 2')).toBeInTheDocument();
  });

  it('renders catalog details when catalog is present', () => {
    const d: Driver = {
      ...baseDriver,
      catalog: {
        manufacturer: 'Dell Inc.', driverClass: 'Video', name: 'Sample Driver',
        version: '1.0.0', releaseDate: '2025-01-01',
        criticality: 'Urgent',
        fixes: ['Fixed flicker on external displays'],
        knownIssues: ['Display freezes on hibernate'],
        supportedModels: ['Latitude 5440'],
        supportedOperatingSystems: ['Microsoft Windows 11'],
        releaseNotesUrl: 'https://www.dell.com/support/sample',
      },
    };
    render(<DriverDetailDrawer driver={d} open onOpenChange={() => {}} />);
    expect(screen.getByText(/Fixed flicker on external displays/)).toBeInTheDocument();
    expect(screen.getByText(/Display freezes on hibernate/)).toBeInTheDocument();
  });

  it('shows "No catalog data" line when catalog is null', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByText(/No catalog data/i)).toBeInTheDocument();
  });

  it('always renders external lookup links regardless of catalog', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByRole('link', { name: /Dell support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Microsoft Update Catalog/i })).toBeInTheDocument();
  });
});
