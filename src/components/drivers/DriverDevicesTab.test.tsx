import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverDevicesTab } from './DriverDevicesTab';
import type { DriverApplicableDevice } from '@/types/drivers';

vi.mock('@/hooks/useDriverApplicableDevices', () => ({
  useDriverApplicableDevices: vi.fn(),
}));

import { useDriverApplicableDevices } from '@/hooks/useDriverApplicableDevices';

const mockHook = useDriverApplicableDevices as unknown as ReturnType<typeof vi.fn>;

const device = (over: Partial<DriverApplicableDevice> = {}): DriverApplicableDevice => ({
  deviceId: 'd1',
  aadDeviceId: 'a1',
  deviceName: 'LAPTOP-1',
  upn: 'user@example.com',
  policyName: 'Ring 1',
  aggregateState: 'Success',
  currentDeviceUpdateState: 8,
  currentDeviceUpdateStateLoc: 'Installed',
  currentDeviceUpdateSubstate: 23,
  currentDeviceUpdateSubstateLoc: 'Update installed',
  currentDeviceUpdateSubstateTime: '2026-03-19T12:08:16',
  lastWUScanTime: '2026-03-31T09:21:44',
  ...over,
});

describe('DriverDevicesTab', () => {
  it('renders a loading state while isLoading', () => {
    mockHook.mockReturnValue({
      devices: [], totalCount: 0, isLoading: true, error: null, retry: () => {},
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText(/Loading device report/i)).toBeInTheDocument();
  });

  it('renders the empty state when no devices', () => {
    mockHook.mockReturnValue({
      devices: [], totalCount: 0, isLoading: false, error: null, retry: () => {},
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText(/No devices currently apply/i)).toBeInTheDocument();
  });

  it('renders an error state with a retry button', () => {
    const retry = vi.fn();
    mockHook.mockReturnValue({
      devices: [], totalCount: 0, isLoading: false, error: 'Boom', retry,
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText(/Failed to load device report/i)).toBeInTheDocument();
    expect(screen.getByText(/Boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders one row per device with name, status, policy, UPN', () => {
    mockHook.mockReturnValue({
      devices: [device({ deviceName: 'LAPTOP-A' }), device({ deviceName: 'LAPTOP-B', upn: 'b@x.com' })],
      totalCount: 2, isLoading: false, error: null, retry: () => {},
    });
    render(<DriverDevicesTab catalogEntryId="cat-1" enabled />);
    expect(screen.getByText('LAPTOP-A')).toBeInTheDocument();
    expect(screen.getByText('LAPTOP-B')).toBeInTheDocument();
    expect(screen.getAllByText(/Installed/).length).toBeGreaterThan(0);
    expect(screen.getByText('b@x.com')).toBeInTheDocument();
  });
});
