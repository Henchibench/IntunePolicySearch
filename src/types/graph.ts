// Microsoft Graph API response interfaces for Intune policies

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface GraphDirectoryObject {
  id: string;
  "@odata.type": string;
  displayName: string;
}

export interface GraphPolicyBase {
  id: string;
  displayName: string;
  description?: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: {
    user?: {
      displayName: string;
    };
  };
  assignments?: GraphAssignment[];
}

export interface GraphAssignment {
  id: string;
  target: {
    "@odata.type": string;
    groupId?: string;
    deviceAndAppManagementAssignmentFilterId?: string;
    deviceAndAppManagementAssignmentFilterType?: string;
  };
  intent?: string; // For assignment intent (apply, remove, etc.)
}

export interface AssignmentDetails {
  id: string;
  displayName: string;
  type: "group" | "user" | "allUsers" | "allDevices";
  intent?: "include" | "exclude" | "apply" | "remove";
  filterId?: string;
  filterDisplayName?: string;
  filterType?: "include" | "exclude";
}

// Device Configuration Policy
export interface GraphDeviceConfiguration extends GraphPolicyBase {
  "@odata.type": string;
  deviceSettings?: Record<string, unknown>;
  userSettings?: Record<string, unknown>;
  settings?: GraphConfigurationSetting[];
}

// Compliance Policy
export interface GraphCompliancePolicy extends GraphPolicyBase {
  scheduledActionsForRule?: GraphScheduledAction[];
  deviceThreatProtectionEnabled?: boolean;
  deviceThreatProtectionRequiredSecurityLevel?: string;
  advancedThreatProtectionRequiredSecurityLevel?: string;
  securityRequireUpToDateAntiMalware?: boolean;
  securityRequireEnabled?: boolean;
  passwordRequired?: boolean;
  passwordMinimumLength?: number;
  passwordRequiredType?: string;
  passwordMinutesOfInactivityBeforeLock?: number;
  passwordExpirationDays?: number;
  passwordPreviousPasswordBlockCount?: number;
  storageRequireEncryption?: boolean;
  osMinimumVersion?: string;
  osMaximumVersion?: string;
}

export interface GraphScheduledAction {
  ruleName: string;
  scheduledActionConfigurations: GraphScheduledActionConfiguration[];
}

export interface GraphScheduledActionConfiguration {
  actionType: string;
  gracePeriodHours: number;
  notificationTemplateId?: string;
}

// App Protection Policy  
export interface GraphManagedAppPolicy extends GraphPolicyBase {
  "@odata.type": string;
  periodOfflineBeforeAccessCheck?: string;
  periodOnlineBeforeAccessCheck?: string;
  allowedInboundDataTransferSources?: string;
  allowedOutboundDataTransferDestinations?: string;
  organizationalCredentialsRequired?: boolean;
  allowedOutboundClipboardSharingLevel?: string;
  dataBackupBlocked?: boolean;
  deviceComplianceRequired?: boolean;
  managedBrowserToOpenLinksRequired?: boolean;
  saveAsBlocked?: boolean;
  periodOfflineBeforeWipeIsEnforced?: string;
  pinRequired?: boolean;
  maximumPinRetries?: number;
  simplePinBlocked?: boolean;
  minimumPinLength?: number;
  pinCharacterSet?: string;
  allowedDataStorageLocations?: string[];
  contactSyncBlocked?: boolean;
  printBlocked?: boolean;
  fingerprintBlocked?: boolean;
  apps?: GraphManagedMobileApp[];
}

export interface GraphManagedMobileApp {
  id: string;
  mobileAppIdentifier: {
    "@odata.type": string;
    packageId?: string;
    bundleId?: string;
  };
}

// Configuration Policy (Settings Catalog)
export interface GraphConfigurationPolicy extends GraphPolicyBase {
  platforms: string;
  technologies: string;
  templateReference?: {
    templateId: string;
    templateDisplayName?: string;
    templateDisplayVersion?: string;
  };
  settings: GraphConfigurationSetting[];
}

export interface GraphConfigurationSetting {
  "@odata.type": string;
  settingInstance: {
    "@odata.type": string;
    settingDefinitionId: string;
    settingInstanceTemplateReference?: {
      settingInstanceTemplateId: string;
    };
    choiceSettingValue?: {
      "@odata.type": string;
      value: string;
      children?: GraphConfigurationSetting[];
    };
    simpleSettingValue?: {
      "@odata.type": string;
      value: string | number | boolean;
    };
    groupSettingCollectionValue?: GraphConfigurationSetting[];
  };
}

// Unified policy interface for the application
export interface Policy {
  id: string;
  name: string;
  description: string;
  type: "Device Configuration" | "Compliance Policy" | "App Protection" | "Configuration Policy";
  platform: "Windows" | "iOS" | "Android" | "macOS" | "All Platforms";
  lastModified: string;
  createdBy: string;
  assignedGroups: string[]; // Deprecated - use assignments instead
  assignments: AssignmentDetails[];
  settings: PolicySetting[];
  rawGraphData?: any; // For troubleshooting - contains original Graph API response
}

export interface PolicySetting {
  category: string;
  key: string;
  value: string;
  description?: string;
}

// Graph API collection responses
export interface GraphCollectionResponse<T> {
  "@odata.context": string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: T[];
}

// Error response
export interface GraphError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      code: string;
      message: string;
    }>;
  };
}

// ============================================================================
// Group Lookup feature types
// ============================================================================

export type IntuneObjectCategory =
  | 'deviceConfiguration'
  | 'compliancePolicy'
  | 'configurationPolicy'
  | 'appProtection'
  | 'mobileApp'
  | 'appConfiguration'
  | 'endpointSecurity'
  | 'platformScript'
  | 'remediationScript'
  | 'complianceScript'
  | 'autopilotProfile'
  | 'enrollmentConfig'
  | 'updateRing';

export const ALL_INTUNE_OBJECT_CATEGORIES: IntuneObjectCategory[] = [
  'deviceConfiguration',
  'compliancePolicy',
  'configurationPolicy',
  'appProtection',
  'mobileApp',
  'appConfiguration',
  'endpointSecurity',
  'platformScript',
  'remediationScript',
  'complianceScript',
  'autopilotProfile',
  'enrollmentConfig',
  'updateRing',
];

export type GroupAssignmentSourceKind = 'direct' | 'parent';

export interface GroupAssignmentSource {
  kind: GroupAssignmentSourceKind;
  groupId?: string;
  groupName?: string;
}

export interface GroupAssignmentFilterRef {
  id: string;
  displayName?: string;
  mode: 'include' | 'exclude';
}

export type AssignmentIntent = 'include' | 'exclude';
export type AppInstallIntent = 'available' | 'required' | 'uninstall';
export type IntunePlatform =
  | 'Windows'
  | 'iOS'
  | 'Android'
  | 'macOS'
  | 'All Platforms';

export interface GroupAssignmentResult {
  id: string;
  category: IntuneObjectCategory;
  name: string;
  description?: string;
  platform?: IntunePlatform;
  intent: AssignmentIntent;
  appIntent?: AppInstallIntent;
  source: GroupAssignmentSource;
  filter?: GroupAssignmentFilterRef;
  lastModified?: string;
  rawObject: unknown;
}

export type CategoryStatus = 'pending' | 'loading' | 'done' | 'error';

export interface CategoryState {
  status: CategoryStatus;
  count?: number;
  error?: string;
}

export interface ParentGroupRef {
  id: string;
  displayName: string;
}

export interface GroupLookupState {
  groupId: string;
  groupName: string;
  parentGroups: ParentGroupRef[];
  perCategory: Record<IntuneObjectCategory, CategoryState>;
  results: GroupAssignmentResult[];
}
