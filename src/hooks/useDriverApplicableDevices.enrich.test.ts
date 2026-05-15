import { describe, it, expect } from 'vitest';
import { enrichWithDeviceMetadata } from './useDriverApplicableDevices.enrich';
import type { DriverApplicableDevice } from '@/types/drivers';
import type { ManagedDevice } from '@/types/managedDevice';

const baseDevice: DriverApplicableDevice = {
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
};

function makeManagedDevice(over: Partial<ManagedDevice> = {}): ManagedDevice {
  return {
    id: 'd1',
    deviceName: 'LAPTOP-1',
    userPrincipalName: 'user@example.com',
    operatingSystem: 'Windows',
    osVersion: '10.0.22631.0',
    complianceState: 'compliant',
    lastSyncDateTime: '2026-03-31T09:21:44',
    manufacturer: 'Dell Inc.',
    model: 'Latitude 5440',
    ...over,
  };
}

describe('enrichWithDeviceMetadata', () => {
  it('adds manufacturer + model when the device is in the map', () => {
    const map = new Map([['d1', makeManagedDevice()]]);
    const result = enrichWithDeviceMetadata([baseDevice], map);
    expect(result).toHaveLength(1);
    expect(result[0].manufacturer).toBe('Dell Inc.');
    expect(result[0].model).toBe('Latitude 5440');
  });

  it('leaves manufacturer + model undefined when the device is not in the map', () => {
    const result = enrichWithDeviceMetadata([baseDevice], new Map());
    expect(result[0].manufacturer).toBeUndefined();
    expect(result[0].model).toBeUndefined();
  });

  it('preserves all other DriverApplicableDevice fields', () => {
    const map = new Map([['d1', makeManagedDevice()]]);
    const result = enrichWithDeviceMetadata([baseDevice], map);
    expect(result[0].deviceName).toBe('LAPTOP-1');
    expect(result[0].upn).toBe('user@example.com');
    expect(result[0].policyName).toBe('Ring 1');
    expect(result[0].currentDeviceUpdateStateLoc).toBe('Installed');
    expect(result[0].lastWUScanTime).toBe('2026-03-31T09:21:44');
  });

  it('handles a partial match (some devices in map, others not)', () => {
    const dev2: DriverApplicableDevice = { ...baseDevice, deviceId: 'd2', deviceName: 'LAPTOP-2' };
    const map = new Map([['d1', makeManagedDevice({ manufacturer: 'Dell Inc.', model: 'A' })]]);
    const result = enrichWithDeviceMetadata([baseDevice, dev2], map);
    expect(result[0].manufacturer).toBe('Dell Inc.');
    expect(result[1].manufacturer).toBeUndefined();
  });

  it('returns an empty array given an empty input', () => {
    expect(enrichWithDeviceMetadata([], new Map())).toEqual([]);
  });

  it('does not mutate the input devices', () => {
    const map = new Map([['d1', makeManagedDevice()]]);
    enrichWithDeviceMetadata([baseDevice], map);
    expect(baseDevice.manufacturer).toBeUndefined();
    expect(baseDevice.model).toBeUndefined();
  });
});
