import { describe, it, expect } from 'vitest';
import { buildDrivers } from './useDrivers';
import type { CatalogEntry, DriverInventory, DriverProfile } from '@/types/drivers';

function profile(id: string, name: string): DriverProfile {
  return {
    id,
    displayName: name,
    description: null,
    approvalType: 'manual',
    inventorySyncStatus: null,
    newUpdates: 0,
    deviceReporting: 0,
    createdDateTime: '2025-01-01T00:00:00Z',
    lastModifiedDateTime: '2025-01-01T00:00:00Z',
  };
}

function inv(name: string, version: string, profileId: string, status: DriverInventory['approvalStatus'] = 'needsReview'): DriverInventory {
  return {
    id: `${profileId}-${name}-${version}`,
    name,
    version,
    manufacturer: 'Dell Inc.',
    driverClass: 'Video',
    releaseDateTime: '2025-01-01T00:00:00Z',
    approvalStatus: status,
    category: 'recommended',
    applicableDeviceCount: 5,
    deviceCount: 10,
  };
}

const sampleCatalog: CatalogEntry = {
  manufacturer: 'Dell Inc.',
  driverClass: 'Video',
  name: 'Sample',
  version: '1.0',
  releaseDate: '2025-01-01',
  criticality: 'Urgent',
  fixes: ['fix one'],
  knownIssues: [],
  supportedModels: ['Latitude 5440'],
  supportedOperatingSystems: ['Microsoft Windows 11'],
  releaseNotesUrl: null,
};

describe('buildDrivers', () => {
  it('produces one row per (name, version) across all profiles', () => {
    const profiles = [profile('p1', 'Ring 1'), profile('p2', 'Ring 2')];
    const inventories = new Map([
      ['p1', [inv('Sample', '1.0', 'p1')]],
      ['p2', [inv('Sample', '1.0', 'p2', 'approved')]],
    ]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    expect(drivers).toHaveLength(1);
    expect(drivers[0].policies).toHaveLength(2);
    expect(drivers[0].policies.map(p => p.profileName).sort()).toEqual(['Ring 1', 'Ring 2']);
    expect(drivers[0].applicableDeviceCount).toBe(5);  // Max of (5, 5), not sum (10)
  });

  it('separates rows for different versions of the same driver', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const inventories = new Map([
      ['p1', [inv('Sample', '1.0', 'p1'), inv('Sample', '2.0', 'p1')]],
    ]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    expect(drivers).toHaveLength(2);
  });

  it('attaches catalog entry when DriverKey matches', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const inventories = new Map([['p1', [inv('Sample', '1.0', 'p1')]]]);
    const catalog = new Map([['dell inc.|video|sample', sampleCatalog]]);
    const drivers = buildDrivers(profiles, inventories, catalog);
    expect(drivers[0].catalog?.criticality).toBe('Urgent');
  });

  it('leaves catalog null when no match', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const inventories = new Map([['p1', [inv('UnknownDriver', '1.0', 'p1')]]]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    expect(drivers[0].catalog).toBeNull();
  });

  it('preserves per-policy approval status in policies array', () => {
    const profiles = [profile('p1', 'Ring 1'), profile('p2', 'Ring 2')];
    const inventories = new Map([
      ['p1', [inv('Sample', '1.0', 'p1', 'approved')]],
      ['p2', [inv('Sample', '1.0', 'p2', 'needsReview')]],
    ]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    const statuses = drivers[0].policies.map(p => `${p.profileName}=${p.approvalStatus}`).sort();
    expect(statuses).toEqual(['Ring 1=approved', 'Ring 2=needsReview']);
  });
});
