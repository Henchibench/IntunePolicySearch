import type { DriverApplicableDevice } from '@/types/drivers';
import type { ManagedDevice } from '@/types/managedDevice';

/**
 * Join `DriverApplicableDevice[]` rows with a `Map<deviceId, ManagedDevice>` to
 * surface manufacturer and model on each row. Pure: returns a new array, does
 * not mutate inputs. Devices missing from the map keep their `manufacturer` and
 * `model` as undefined.
 */
export function enrichWithDeviceMetadata(
  devices: DriverApplicableDevice[],
  managedDeviceMap: Map<string, ManagedDevice>
): DriverApplicableDevice[] {
  return devices.map((d) => {
    const managed = managedDeviceMap.get(d.deviceId);
    if (!managed) return { ...d };
    return {
      ...d,
      manufacturer: managed.manufacturer,
      model: managed.model,
    };
  });
}
