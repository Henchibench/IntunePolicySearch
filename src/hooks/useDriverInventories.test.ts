import { describe, it, expect, vi } from 'vitest';
import { fetchInventoriesForProfiles } from './useDriverInventories';
import type { DriverInventory } from '@/types/drivers';

function inv(name: string, status: DriverInventory['approvalStatus'] = 'needsReview'): DriverInventory {
  return {
    id: name,
    name,
    version: '1.0',
    manufacturer: 'Dell Inc.',
    driverClass: 'Video',
    releaseDateTime: '2025-01-01T00:00:00Z',
    approvalStatus: status,
    category: 'recommended',
    applicableDeviceCount: 1,
    deviceCount: 1,
  };
}

describe('fetchInventoriesForProfiles', () => {
  it('fans out one fetch per profile and returns a map of profileId → inventories', async () => {
    const fetchInventories = vi.fn().mockImplementation(async (profileId: string) => [
      inv(`${profileId}-driverA`),
      inv(`${profileId}-driverB`),
    ]);

    const result = await fetchInventoriesForProfiles(['p1', 'p2'], fetchInventories);

    expect(fetchInventories).toHaveBeenCalledTimes(2);
    expect(fetchInventories).toHaveBeenCalledWith('p1');
    expect(fetchInventories).toHaveBeenCalledWith('p2');
    expect(result.results.get('p1')).toHaveLength(2);
    expect(result.results.get('p2')).toHaveLength(2);
    expect(result.results.get('p1')?.[0].name).toBe('p1-driverA');
  });

  it('continues on per-profile failure and records the error in errors map', async () => {
    const fetchInventories = vi.fn().mockImplementation(async (profileId: string) => {
      if (profileId === 'p2') throw new Error('boom');
      return [inv(`${profileId}-driver`)];
    });

    const { results, errors } = await fetchInventoriesForProfiles(['p1', 'p2'], fetchInventories, { collectErrors: true });

    expect(results.get('p1')).toHaveLength(1);
    expect(results.get('p2')).toBeUndefined();
    expect(errors.get('p2')).toBe('boom');
  });
});
