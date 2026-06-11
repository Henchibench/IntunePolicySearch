import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriverDetailDrawer } from './DriverDetailDrawer';
import type { Driver } from '@/types/drivers';

// Stub the devices tab so the drawer tests don't pull in the report hook /
// auth context. The stub exposes a button that fires onLoaded, letting us
// drive the "count appears after the report loads" wiring.
vi.mock('./DriverDevicesTab', () => ({
  DriverDevicesTab: ({ onLoaded }: { onLoaded?: (n: number) => void }) => (
    <button type="button" onClick={() => onLoaded?.(4)}>
      stub-load-devices
    </button>
  ),
}));

const baseDriver: Driver = {
  key: 'dell inc.|video|sample',
  inventoryIds: ['inv1'],
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

  it('shows a Find release notes block with Microsoft Update Catalog when no catalog match', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.queryByText(/No catalog data/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Find release notes/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Microsoft Update Catalog/i })).toBeInTheDocument();
  });

  it('always renders external lookup links regardless of catalog', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByRole('link', { name: /Dell support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Microsoft Update Catalog/i })).toBeInTheDocument();
  });

  it('does not put applicableDeviceCount in the Devices tab label', () => {
    // applicableDeviceCount (inventory) and the device-status report count
    // are different populations; the tab must not advertise the inventory
    // number, which routinely disagrees with the list it labels.
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: /Devices/ });
    expect(tab).toHaveTextContent(/^Devices$/);
    expect(tab).not.toHaveTextContent('5');
  });

  it('still shows applicable device count in the Overview tab', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByText('Applicable devices')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows the report total in the Devices tab label once it loads', async () => {
    const user = userEvent.setup();
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /Devices/ }));
    await user.click(screen.getByRole('button', { name: 'stub-load-devices' }));
    expect(screen.getByRole('tab', { name: /Devices/ })).toHaveTextContent('Devices (4)');
  });
});
