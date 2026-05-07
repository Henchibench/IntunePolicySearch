import { useMemo } from 'react';
import type {
  CatalogEntry,
  Driver,
  DriverInventory,
  DriverProfile,
} from '@/types/drivers';
import { useDriverProfiles } from './useDriverProfiles';
import { useDriverInventories } from './useDriverInventories';
import { useDriverCatalog } from './useDriverCatalog';
import { buildDriverKey } from '../../scripts/lib/dell-catalog-normalize';

export function buildDrivers(
  profiles: DriverProfile[],
  inventories: Map<string, DriverInventory[]>,
  catalog: Map<string, CatalogEntry>
): Driver[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const grouped = new Map<string, Driver>();

  for (const [profileId, list] of inventories) {
    const profile = profileById.get(profileId);
    if (!profile) continue;
    for (const inv of list) {
      const key = buildDriverKey(inv.manufacturer, inv.driverClass, inv.name);
      const groupKey = `${key}|${inv.version}`;
      let driver = grouped.get(groupKey);
      if (!driver) {
        driver = {
          key,
          inventoryId: inv.id,
          name: inv.name,
          manufacturer: inv.manufacturer,
          driverClass: inv.driverClass,
          version: inv.version,
          releaseDateTime: inv.releaseDateTime,
          applicableDeviceCount: inv.applicableDeviceCount,
          deviceCount: inv.deviceCount,
          policies: [],
          catalog: catalog.get(key) ?? null,
        };
        grouped.set(groupKey, driver);
      } else {
        driver.applicableDeviceCount += inv.applicableDeviceCount;
        driver.deviceCount += inv.deviceCount;
      }
      driver.policies.push({
        profileId: profile.id,
        profileName: profile.displayName,
        approvalType: profile.approvalType,
        approvalStatus: inv.approvalStatus,
      });
    }
  }

  return Array.from(grouped.values());
}

export function useDrivers(enabled: boolean) {
  const { profiles, isLoading: profilesLoading, error: profilesError } = useDriverProfiles(enabled);
  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const { inventories, errors: inventoryErrors, isLoading: inventoriesLoading } = useDriverInventories(profileIds, enabled);
  const catalog = useDriverCatalog();

  const drivers = useMemo(
    () => buildDrivers(profiles, inventories, catalog.entries),
    [profiles, inventories, catalog.entries]
  );

  return {
    drivers,
    profiles,
    catalog,
    inventoryErrors,
    isLoading: profilesLoading || inventoriesLoading || catalog.isLoading,
    error: profilesError,
  };
}
