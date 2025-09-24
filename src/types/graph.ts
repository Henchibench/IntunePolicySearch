// Microsoft Graph API response interfaces for Intune policies

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
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
  assignedGroups: string[];
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
