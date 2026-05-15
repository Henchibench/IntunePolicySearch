import { describe, it, expect } from 'vitest';
import {
  buildConfigBody,
  buildFetchBody,
  toApplicableDevice,
} from './useDriverApplicableDevices';

describe('buildConfigBody', () => {
  it('produces the configure-phase request body with a stable id', () => {
    const body = buildConfigBody(['abc-123']);
    expect(body.id).toMatch(/^DriverUpdateDeviceStatusByDriver_/);
    expect(body.filter).toBe("CatalogEntryId eq 'abc-123'");
    expect(body.select).toContain('DeviceName');
    expect(body.select).toContain('UPN');
    expect(body.select).toContain('PolicyName');
    expect(body.orderBy).toEqual([]);
  });

  it('escapes single quotes in the catalogEntryId by doubling them (OData rules)', () => {
    const body = buildConfigBody(["foo'bar"]);
    expect(body.filter).toBe("CatalogEntryId eq 'foo''bar'");
  });

  it('builds an OR filter when multiple catalogEntryIds are provided', () => {
    const body = buildConfigBody(['id1', 'id2']);
    expect(body.filter).toBe("CatalogEntryId eq 'id1' or CatalogEntryId eq 'id2'");
  });
});

describe('buildFetchBody', () => {
  it('includes pagination parameters', () => {
    const body = buildFetchBody('config-id', ['cat-id'], 50, 100);
    expect(body.id).toBe('config-id');
    expect(body.top).toBe(50);
    expect(body.skip).toBe(100);
    expect(body.filter).toBe("CatalogEntryId eq 'cat-id'");
  });
});

describe('toApplicableDevice', () => {
  it('maps a normalized row to a DriverApplicableDevice', () => {
    const row = {
      AadDeviceId: 'aad-1',
      AggregateState: 'Success',
      AggregateState_loc: 'Success',
      CurrentDeviceUpdateState: 8,
      CurrentDeviceUpdateState_loc: 'Installed',
      CurrentDeviceUpdateSubstate: 23,
      CurrentDeviceUpdateSubstate_loc: 'Update installed',
      CurrentDeviceUpdateSubstateTime: '2026-03-19T12:08:16',
      DeviceId: 'intune-1',
      DeviceName: 'GPC-1',
      LastWUScanTime: '2026-03-31T09:21:44',
      PolicyName: 'Ring 1',
      UPN: 'user@example.com',
    };
    const result = toApplicableDevice(row);
    expect(result).toEqual({
      deviceId: 'intune-1',
      aadDeviceId: 'aad-1',
      deviceName: 'GPC-1',
      upn: 'user@example.com',
      policyName: 'Ring 1',
      aggregateState: 'Success',
      currentDeviceUpdateState: 8,
      currentDeviceUpdateStateLoc: 'Installed',
      currentDeviceUpdateSubstate: 23,
      currentDeviceUpdateSubstateLoc: 'Update installed',
      currentDeviceUpdateSubstateTime: '2026-03-19T12:08:16',
      lastWUScanTime: '2026-03-31T09:21:44',
    });
  });

  it('falls back to empty string for missing string fields', () => {
    const result = toApplicableDevice({});
    expect(result.deviceName).toBe('');
    expect(result.upn).toBe('');
    expect(result.policyName).toBe('');
  });

  it('falls back to 0 for missing numeric fields', () => {
    const result = toApplicableDevice({});
    expect(result.currentDeviceUpdateState).toBe(0);
    expect(result.currentDeviceUpdateSubstate).toBe(0);
  });
});
