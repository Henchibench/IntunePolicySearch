export type ComplianceState =
  | "unknown"
  | "compliant"
  | "noncompliant"
  | "conflict"
  | "error"
  | "inGracePeriod"
  | "configManager";

export type PolicyEvaluationState =
  | "compliant"
  | "nonCompliant"
  | "notApplicable"
  | "remediated"
  | "error"
  | "conflict"
  | "notAssigned"
  | "unknown";

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
  state: PolicyEvaluationState;
  settingStates?: Array<{
    setting: string;
    settingName?: string;
    state: PolicyEvaluationState;
    errorDescription?: string;
  }>;
}

export interface DeviceConfigurationState {
  id: string;
  displayName: string;
  state: PolicyEvaluationState;
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

export interface MobileAppState {
  applicationId: string;
  displayName: string;
  mobileAppIntent?:
    | "available"
    | "notAvailable"
    | "requiredInstall"
    | "requiredUninstall"
    | "requiredAndAvailableInstall"
    | "availableInstallWithoutEnrollment"
    | "exclude"
    | string;
  installState?:
    | "installed"
    | "failed"
    | "notInstalled"
    | "uninstallFailed"
    | "pendingInstall"
    | "unknown"
    | "notApplicable"
    | string;
  displayVersion?: string;
}

export interface DeviceDeepDetails {
  compliancePolicyStates: DeviceCompliancePolicyState[];
  configurationStates: DeviceConfigurationState[];
  detectedApps: DetectedApp[];
  managedAppStates: MobileAppState[];
}
