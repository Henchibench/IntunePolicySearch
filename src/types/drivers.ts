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
  inventoryId: string;
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
