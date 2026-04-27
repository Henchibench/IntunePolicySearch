export type ComplianceState =
  | "unknown"
  | "compliant"
  | "noncompliant"
  | "conflict"
  | "error"
  | "inGracePeriod"
  | "configManager";

export interface ManagedDevice {
  id: string;
  deviceName: string;
  userPrincipalName: string;
  userDisplayName?: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: ComplianceState;
  lastSyncDateTime: string;
  enrolledDateTime?: string;
  managedDeviceOwnerType?: "unknown" | "company" | "personal";
  complianceGracePeriodExpirationDateTime?: string;
  deviceType?: string;
  manufacturer?: string;
  model?: string;
}

export interface DeviceCompliancePolicyState {
  id: string;
  displayName: string;
  state: ComplianceState;
  settingStates?: Array<{
    setting: string;
    settingName?: string;
    state: "compliant" | "nonCompliant" | "notApplicable" | "remediated" | "error" | "conflict" | "notAssigned" | "unknown";
    errorDescription?: string;
  }>;
}

export interface DeviceConfigurationState {
  id: string;
  displayName: string;
  state: "compliant" | "nonCompliant" | "notApplicable" | "remediated" | "error" | "conflict" | "notAssigned" | "unknown";
  settingStates?: Array<{
    setting: string;
    settingName?: string;
    state: string;
    errorDescription?: string;
  }>;
}

export interface DetectedApp {
  id: string;
  displayName: string;
  version?: string;
  publisher?: string;
  platform?: string;
}

export interface DeviceDeepDetails {
  compliancePolicyStates: DeviceCompliancePolicyState[];
  configurationStates: DeviceConfigurationState[];
  detectedApps: DetectedApp[];
}
