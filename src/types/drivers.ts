/** WUfB driver update profile (subset of microsoft.graph.windowsDriverUpdateProfile) */
export interface DriverProfile {
  id: string;
  displayName: string;
  description: string | null;
  approvalType: 'manual' | 'automatic';
  inventorySyncStatus: {
    driverInventorySyncState: string;
    lastSuccessfulSyncDateTime: string | null;
  } | null;
  newUpdates: number;
  deviceReporting: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

/** A driver inventory entry inside a profile (subset of microsoft.graph.windowsDriverUpdateInventory) */
export interface DriverInventory {
  id: string;
  name: string;
  version: string;
  manufacturer: string;
  driverClass: string;
  releaseDateTime: string;
  approvalStatus: 'needsReview' | 'approved' | 'declined' | 'suspended';
  category: string;
  applicableDeviceCount: number;
  deviceCount: number;
}

/** Per-policy approval state for a driver (used in merged rows that appear in multiple policies) */
export interface DriverPolicyMembership {
  profileId: string;
  profileName: string;
  approvalType: 'manual' | 'automatic';
  approvalStatus: DriverInventory['approvalStatus'];
}

/** Normalized Dell catalog entry — only the fields the UI consumes */
export interface CatalogEntry {
  manufacturer: string;
  driverClass: string;
  name: string;
  version: string | null;
  releaseDate: string | null;
  criticality: 'Urgent' | 'Recommended' | 'Optional' | 'Other';
  fixes: string[];
  knownIssues: string[];
  supportedModels: string[];
  supportedOperatingSystems: string[];
  releaseNotesUrl: string | null;
}

/** Lookup key for joining DriverInventory to CatalogEntry */
export type DriverKey = string;

/** Joined driver row rendered in the UI */
export interface Driver {
  key: DriverKey;
  inventoryIds: string[];
  name: string;
  manufacturer: string;
  driverClass: string;
  version: string;
  releaseDateTime: string;
  applicableDeviceCount: number;
  deviceCount: number;
  policies: DriverPolicyMembership[];
  catalog: CatalogEntry | null;
}

/** Filter state for the drivers page */
export interface DriverFilters {
  manufacturers: string[];
  driverClasses: string[];
  approvalStatuses: DriverInventory['approvalStatus'][];
  criticalities: CatalogEntry['criticality'][];
  affectsDevicesOnly: boolean;
  freeText: string;
}

export type DriverPivot = 'all' | 'byPolicy';

export type CatalogSource = 'electron-sync' | 'baked' | 'none';

export interface CatalogStatus {
  lastSyncedAt: string | null;
  entryCount: number;
  source: CatalogSource;
}

/** A row in the per-driver device list, normalized from the cached report response */
export interface DriverApplicableDevice {
  /** Intune device id */
  deviceId: string;
  /** Microsoft Entra device id */
  aadDeviceId: string;
  /** Friendly device name (e.g., "GPC-6XTRVV3") */
  deviceName: string;
  /** Primary user UPN */
  upn: string;
  /** Name of the WUfB profile that targets this device for this driver */
  policyName: string;
  /** Localized aggregate state (e.g., "Success", "Error", "In progress") */
  aggregateState: string;
  /** Numeric update state code */
  currentDeviceUpdateState: number;
  /** Localized update state (e.g., "Installed", "Offering", "Cancelled") */
  currentDeviceUpdateStateLoc: string;
  /** Numeric substate code */
  currentDeviceUpdateSubstate: number;
  /** Localized substate (e.g., "Update installed", "Update offered") */
  currentDeviceUpdateSubstateLoc: string;
  /** When the device most recently changed state for this driver */
  currentDeviceUpdateSubstateTime: string;
  /** When the device last scanned with Windows Update */
  lastWUScanTime: string;
  /** Hardware manufacturer (e.g., "Dell Inc."). Optional — populated from managedDevices when available. */
  manufacturer?: string;
  /** Hardware model (e.g., "Latitude 5440"). Optional — populated from managedDevices when available. */
  model?: string;
}
