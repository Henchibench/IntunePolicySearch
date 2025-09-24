import { Client } from "@microsoft/microsoft-graph-client";
import { AuthenticationProvider } from "@microsoft/microsoft-graph-client";
import { AccountInfo } from "@azure/msal-browser";
import { 
  GraphDeviceConfiguration, 
  GraphCompliancePolicy, 
  GraphManagedAppPolicy, 
  GraphConfigurationPolicy,
  GraphCollectionResponse,
  Policy,
  PolicySetting,
  GraphUser
} from "@/types/graph";
import { graphConfig } from "./authConfig";

/**
 * Custom authentication provider for Microsoft Graph using MSAL
 */
export class MSALAuthenticationProvider implements AuthenticationProvider {
  private getTokenFunction: () => Promise<string>;

  constructor(getAccessToken: () => Promise<string>) {
    this.getTokenFunction = getAccessToken;
  }

  async getAccessToken(): Promise<string> {
    return await this.getTokenFunction();
  }
}

/**
 * Microsoft Graph service for fetching Intune policies
 */
export class GraphService {
  private graphClient: Client;

  constructor(authProvider: AuthenticationProvider) {
    this.graphClient = Client.initWithMiddleware({ authProvider });
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<GraphUser> {
    try {
      const user = await this.graphClient.api(graphConfig.graphMeEndpoint).get();
      return user;
    } catch (error) {
      console.error("Error fetching current user:", error);
      throw error;
    }
  }

  /**
   * Fetch all device configuration policies with pagination and detailed settings
   */
  async getDeviceConfigurations(): Promise<GraphDeviceConfiguration[]> {
    try {
      const allPolicies: GraphDeviceConfiguration[] = [];
      let nextLink: string | undefined = graphConfig.graphDeviceConfigurationsEndpoint;
      
      while (nextLink) {
        const response: GraphCollectionResponse<GraphDeviceConfiguration> = await this.graphClient
          .api(nextLink)
          .get();
        
        allPolicies.push(...response.value);
        nextLink = response["@odata.nextLink"];
      }
      
      console.log(`Fetched ${allPolicies.length} device configuration policies`);
      
      // Fetch detailed settings for each device configuration policy
      const policiesWithSettings = await Promise.all(
        allPolicies.map(async (policy) => {
          try {
            // Try to get detailed policy with settings
            const detailedPolicy = await this.graphClient
              .api(`${graphConfig.graphDeviceConfigurationsEndpoint}/${policy.id}`)
              .get();
            
            // Also try to get device configuration assignments
            try {
              const assignments = await this.graphClient
                .api(`${graphConfig.graphDeviceConfigurationsEndpoint}/${policy.id}/assignments`)
                .get();
              detailedPolicy.assignments = assignments.value;
            } catch (assignmentError) {
              console.warn(`Failed to fetch assignments for policy ${policy.id}`);
            }
            
            return detailedPolicy;
          } catch (error) {
            console.warn(`Failed to fetch detailed settings for policy ${policy.id}:`, error);
            return policy;
          }
        })
      );
      
      return policiesWithSettings;
    } catch (error) {
      console.error("Error fetching device configurations:", error);
      throw error;
    }
  }

  /**
   * Fetch all compliance policies with pagination
   */
  async getCompliancePolicies(): Promise<GraphCompliancePolicy[]> {
    try {
      const allPolicies: GraphCompliancePolicy[] = [];
      let nextLink: string | undefined = graphConfig.graphCompliancePoliciesEndpoint;
      
      while (nextLink) {
        const response: GraphCollectionResponse<GraphCompliancePolicy> = await this.graphClient
          .api(nextLink)
          .get();
        
        allPolicies.push(...response.value);
        nextLink = response["@odata.nextLink"];
      }
      
      console.log(`Fetched ${allPolicies.length} compliance policies`);
      return allPolicies;
    } catch (error) {
      console.error("Error fetching compliance policies:", error);
      throw error;
    }
  }

  /**
   * Fetch all app protection policies with pagination from reliable endpoints
   */
  async getManagedAppPolicies(): Promise<GraphManagedAppPolicy[]> {
    const policies: GraphManagedAppPolicy[] = [];
    
    // Use more reliable endpoints
    const endpoints = [
      { name: "Managed App Policies", url: graphConfig.graphManagedAppProtectionPoliciesEndpoint }
    ];
    
    for (const endpoint of endpoints) {
      try {
        let nextLink: string | undefined = endpoint.url;
        let endpointCount = 0;
        
        while (nextLink) {
          const response: GraphCollectionResponse<GraphManagedAppPolicy> = await this.graphClient
            .api(nextLink)
            .get();
          
          policies.push(...response.value);
          endpointCount += response.value.length;
          nextLink = response["@odata.nextLink"];
        }
        
        console.log(`Fetched ${endpointCount} policies from ${endpoint.name}`);
      } catch (error) {
        console.warn(`Failed to fetch from ${endpoint.name} (${endpoint.url}):`, error);
        // Continue with next endpoint instead of throwing
      }
    }
    
    console.log(`Total app protection policies fetched: ${policies.length}`);
    return policies;
  }

  /**
   * Fetch all configuration policies (Settings Catalog) with pagination and detailed settings
   */
  async getConfigurationPolicies(): Promise<GraphConfigurationPolicy[]> {
    try {
      const allPolicies: GraphConfigurationPolicy[] = [];
      let nextLink: string | undefined = graphConfig.graphConfigurationPoliciesEndpoint;
      
      while (nextLink) {
        const response: GraphCollectionResponse<GraphConfigurationPolicy> = await this.graphClient
          .api(nextLink)
          .get();
        
        allPolicies.push(...response.value);
        nextLink = response["@odata.nextLink"];
      }
      
      console.log(`Fetched ${allPolicies.length} configuration policies (Settings Catalog)`);
      
      // Fetch detailed settings for each configuration policy
      const policiesWithSettings = await Promise.all(
        allPolicies.map(async (policy) => {
          try {
            const detailedPolicy = await this.graphClient
              .api(`${graphConfig.graphConfigurationPoliciesEndpoint}/${policy.id}`)
              .expand('settings')
              .get();
            return { ...policy, settings: detailedPolicy.settings || [] };
          } catch (error) {
            console.warn(`Failed to fetch settings for policy ${policy.id}:`, error);
            return policy;
          }
        })
      );
      
      return policiesWithSettings;
    } catch (error) {
      console.error("Error fetching configuration policies:", error);
      throw error;
    }
  }

  /**
   * Fetch Group Policy Configurations (ADMX)
   */
  async getGroupPolicyConfigurations(): Promise<any[]> {
    try {
      const allPolicies: any[] = [];
      let nextLink: string | undefined = graphConfig.graphGroupPolicyConfigurationsEndpoint;
      
      while (nextLink) {
        const response: GraphCollectionResponse<any> = await this.graphClient
          .api(nextLink)
          .get();
        
        allPolicies.push(...response.value);
        nextLink = response["@odata.nextLink"];
      }
      
      console.log(`Fetched ${allPolicies.length} Group Policy configurations`);
      return allPolicies;
    } catch (error) {
      console.warn("Error fetching Group Policy configurations:", error);
      return [];
    }
  }

  /**
   * Fetch Security Baselines (Intents)
   */
  async getSecurityBaselines(): Promise<any[]> {
    try {
      const allBaselines: any[] = [];
      let nextLink: string | undefined = graphConfig.graphIntentAssignmentsEndpoint;
      
      while (nextLink) {
        const response: GraphCollectionResponse<any> = await this.graphClient
          .api(nextLink)
          .get();
        
        allBaselines.push(...response.value);
        nextLink = response["@odata.nextLink"];
      }
      
      console.log(`Fetched ${allBaselines.length} Security Baselines/Intents`);
      return allBaselines;
    } catch (error) {
      console.warn("Error fetching Security Baselines:", error);
      return [];
    }
  }

  /**
   * Fetch Device Enrollment Configurations
   */
  async getDeviceEnrollmentConfigurations(): Promise<any[]> {
    try {
      const allConfigs: any[] = [];
      let nextLink: string | undefined = graphConfig.graphDeviceEnrollmentConfigurationsEndpoint;
      
      while (nextLink) {
        const response: GraphCollectionResponse<any> = await this.graphClient
          .api(nextLink)
          .get();
        
        allConfigs.push(...response.value);
        nextLink = response["@odata.nextLink"];
      }
      
      console.log(`Fetched ${allConfigs.length} Device Enrollment configurations`);
      return allConfigs;
    } catch (error) {
      console.warn("Error fetching Device Enrollment configurations:", error);
      return [];
    }
  }

  /**
   * Fetch all Intune policies and transform them into unified format
   */
  async getAllPolicies(): Promise<Policy[]> {
    const policies: Policy[] = [];
    const errors: string[] = [];
    const successful: string[] = [];

    // Fetch each policy type independently to avoid total failure
    try {
      const deviceConfigs = await this.getDeviceConfigurations();
      policies.push(...deviceConfigs.map(policy => this.transformDeviceConfiguration(policy)));
      successful.push(`Device Configurations (${deviceConfigs.length})`);
    } catch (error) {
      console.warn("Failed to fetch device configurations:", error);
      errors.push("Device Configurations");
    }

    try {
      const compliancePolicies = await this.getCompliancePolicies();
      policies.push(...compliancePolicies.map(policy => this.transformCompliancePolicy(policy)));
      successful.push(`Compliance Policies (${compliancePolicies.length})`);
    } catch (error) {
      console.warn("Failed to fetch compliance policies:", error);
      errors.push("Compliance Policies");
    }

    try {
      const appPolicies = await this.getManagedAppPolicies();
      policies.push(...appPolicies.map(policy => this.transformAppProtectionPolicy(policy)));
      successful.push(`App Protection Policies (${appPolicies.length})`);
    } catch (error) {
      console.warn("Failed to fetch app protection policies:", error);
      errors.push("App Protection Policies");
    }

    try {
      const configPolicies = await this.getConfigurationPolicies();
      policies.push(...configPolicies.map(policy => this.transformConfigurationPolicy(policy)));
      successful.push(`Configuration Policies (${configPolicies.length})`);
    } catch (error) {
      console.warn("Failed to fetch configuration policies:", error);
      errors.push("Configuration Policies");
    }

    // Fetch additional policy types
    try {
      const groupPolicies = await this.getGroupPolicyConfigurations();
      policies.push(...groupPolicies.map(policy => this.transformGroupPolicyConfiguration(policy)));
      successful.push(`Group Policy Configurations (${groupPolicies.length})`);
    } catch (error) {
      console.warn("Failed to fetch Group Policy configurations:", error);
      errors.push("Group Policy Configurations");
    }

    try {
      const securityBaselines = await this.getSecurityBaselines();
      policies.push(...securityBaselines.map(policy => this.transformSecurityBaseline(policy)));
      successful.push(`Security Baselines (${securityBaselines.length})`);
    } catch (error) {
      console.warn("Failed to fetch Security Baselines:", error);
      errors.push("Security Baselines");
    }

    try {
      const enrollmentConfigs = await this.getDeviceEnrollmentConfigurations();
      policies.push(...enrollmentConfigs.map(policy => this.transformEnrollmentConfiguration(policy)));
      successful.push(`Enrollment Configurations (${enrollmentConfigs.length})`);
    } catch (error) {
      console.warn("Failed to fetch Device Enrollment configurations:", error);
      errors.push("Device Enrollment Configurations");
    }

    console.log(`Successfully loaded: ${successful.join(", ")}`);
    if (errors.length > 0) {
      console.warn(`Failed to load: ${errors.join(", ")}`);
    }

    // If we have some policies, return them even if some endpoints failed
    if (policies.length > 0) {
      return policies;
    }

    // If no policies were loaded, throw an error
    throw new Error(`Failed to load any policies. Failed endpoints: ${errors.join(", ")}`);
  }

  /**
   * Transform device configuration policy to unified format
   */
  private transformDeviceConfiguration(policy: GraphDeviceConfiguration): Policy {
    const settings: PolicySetting[] = [];
    
    // Debug logging to see what policy names we're getting
    console.log(`Processing Device Configuration Policy:`, {
      id: policy.id,
      displayName: policy.displayName,
      name: (policy as any).name,
      description: policy.description,
      odataType: policy["@odata.type"]
    });
    
    // Extract settings from the policy object itself (many properties are settings)
    this.extractDeviceConfigurationSettings(policy, settings);
    
    // Extract settings from various sources
    if (policy.deviceSettings) {
      this.extractSettingsFromObject(policy.deviceSettings, "Device Settings", settings);
    }
    if (policy.userSettings) {
      this.extractSettingsFromObject(policy.userSettings, "User Settings", settings);
    }
    if (policy.settings) {
      policy.settings.forEach(setting => {
        settings.push(...this.extractFromGraphConfigurationSetting(setting));
      });
    }

    const transformedPolicy = {
      id: policy.id,
      name: policy.displayName || (policy as any).name || `Device Configuration ${policy.id}`,
      description: policy.description || "",
      type: "Device Configuration" as const,
      platform: this.determinePlatform(policy["@odata.type"]),
      lastModified: new Date(policy.lastModifiedDateTime).toLocaleDateString(),
      createdBy: policy.createdBy?.user?.displayName || "Unknown",
      assignedGroups: policy.assignments?.map(a => a.target.groupId || "Unknown") || [],
      settings
    };

    console.log(`Transformed to:`, {
      id: transformedPolicy.id,
      name: transformedPolicy.name,
      settingsCount: transformedPolicy.settings.length
    });

    return transformedPolicy;
  }

  /**
   * Transform compliance policy to unified format
   */
  private transformCompliancePolicy(policy: GraphCompliancePolicy): Policy {
    const settings: PolicySetting[] = [];
    
    // Extract compliance settings
    const complianceSettings = {
      "Password Required": policy.passwordRequired,
      "Password Minimum Length": policy.passwordMinimumLength,
      "Password Type": policy.passwordRequiredType,
      "Inactivity Lock (minutes)": policy.passwordMinutesOfInactivityBeforeLock,
      "Storage Encryption Required": policy.storageRequireEncryption,
      "Minimum OS Version": policy.osMinimumVersion,
      "Maximum OS Version": policy.osMaximumVersion,
      "Threat Protection Enabled": policy.deviceThreatProtectionEnabled,
      "Security Level": policy.deviceThreatProtectionRequiredSecurityLevel,
      "Antimalware Required": policy.securityRequireUpToDateAntiMalware
    };

    this.extractSettingsFromObject(complianceSettings, "Compliance Requirements", settings);

    return {
      id: policy.id,
      name: policy.displayName || policy.name || `Compliance Policy ${policy.id}`,
      description: policy.description || "",
      type: "Compliance Policy",
      platform: this.determinePlatform("compliance"),
      lastModified: new Date(policy.lastModifiedDateTime).toLocaleDateString(),
      createdBy: policy.createdBy?.user?.displayName || "Unknown",
      assignedGroups: policy.assignments?.map(a => a.target.groupId || "Unknown") || [],
      settings
    };
  }

  /**
   * Transform app protection policy to unified format
   */
  private transformAppProtectionPolicy(policy: GraphManagedAppPolicy): Policy {
    const settings: PolicySetting[] = [];
    
    // Extract app protection settings
    const appSettings = {
      "Offline Access Check": policy.periodOfflineBeforeAccessCheck,
      "Online Access Check": policy.periodOnlineBeforeAccessCheck,
      "Inbound Data Transfer": policy.allowedInboundDataTransferSources,
      "Outbound Data Transfer": policy.allowedOutboundDataTransferDestinations,
      "Organizational Credentials Required": policy.organizationalCredentialsRequired,
      "Clipboard Sharing": policy.allowedOutboundClipboardSharingLevel,
      "Data Backup Blocked": policy.dataBackupBlocked,
      "Device Compliance Required": policy.deviceComplianceRequired,
      "Managed Browser Required": policy.managedBrowserToOpenLinksRequired,
      "Save As Blocked": policy.saveAsBlocked,
      "PIN Required": policy.pinRequired,
      "Maximum PIN Retries": policy.maximumPinRetries,
      "Simple PIN Blocked": policy.simplePinBlocked,
      "Minimum PIN Length": policy.minimumPinLength,
      "Contact Sync Blocked": policy.contactSyncBlocked,
      "Print Blocked": policy.printBlocked,
      "Fingerprint Blocked": policy.fingerprintBlocked
    };

    this.extractSettingsFromObject(appSettings, "App Protection", settings);

    return {
      id: policy.id,
      name: policy.displayName || policy.name || `App Protection Policy ${policy.id}`,
      description: policy.description || "",
      type: "App Protection",
      platform: this.determinePlatform(policy["@odata.type"]),
      lastModified: new Date(policy.lastModifiedDateTime).toLocaleDateString(),
      createdBy: policy.createdBy?.user?.displayName || "Unknown",
      assignedGroups: policy.assignments?.map(a => a.target.groupId || "Unknown") || [],
      settings
    };
  }

  /**
   * Transform configuration policy to unified format
   */
  private transformConfigurationPolicy(policy: GraphConfigurationPolicy): Policy {
    const settings: PolicySetting[] = [];
    
    // Debug logging to see what policy names we're getting
    console.log(`Processing Configuration Policy:`, {
      id: policy.id,
      displayName: policy.displayName,
      name: (policy as any).name,
      description: policy.description,
      platforms: policy.platforms,
      settingsCount: policy.settings?.length || 0
    });
    
    // Extract settings from configuration policy
    if (policy.settings && Array.isArray(policy.settings)) {
      policy.settings.forEach((setting, index) => {
        console.log(`Processing setting ${index}:`, setting);
        const extractedSettings = this.extractFromGraphConfigurationSetting(setting as any);
        settings.push(...extractedSettings);
        console.log(`Extracted ${extractedSettings.length} settings from setting ${index}`);
      });
    } else {
      console.log(`No settings array found or not array:`, policy.settings);
    }

    const transformedPolicy = {
      id: policy.id,
      name: policy.displayName || (policy as any).name || `Configuration Policy ${policy.id}`,
      description: policy.description || "",
      type: "Configuration Policy" as const,
      platform: this.mapPlatformFromString(policy.platforms),
      lastModified: new Date(policy.lastModifiedDateTime).toLocaleDateString(),
      createdBy: policy.createdBy?.user?.displayName || "Unknown",
      assignedGroups: policy.assignments?.map(a => a.target.groupId || "Unknown") || [],
      settings,
      // Keep raw data for troubleshooting
      rawGraphData: policy
    };

    console.log(`Transformed to:`, {
      id: transformedPolicy.id,
      name: transformedPolicy.name,
      settingsCount: transformedPolicy.settings.length
    });

    return transformedPolicy;
  }

  /**
   * Extract device configuration settings from policy object
   */
  private extractDeviceConfigurationSettings(policy: GraphDeviceConfiguration, settings: PolicySetting[]): void {
    // Common device configuration properties that are actually settings
    const settingProperties = [
      'passwordRequired', 'passwordMinimumLength', 'passwordRequiredType',
      'passwordMinutesOfInactivityBeforeLock', 'passwordExpirationDays',
      'passwordPreviousPasswordBlockCount', 'passwordSignInFailureCountBeforeFactoryReset',
      'storageRequireEncryption', 'storageBlockRemovableStorage',
      'cameraBlocked', 'bluetoothBlocked', 'wifiBlocked', 'voiceRoamingBlocked',
      'dataRoamingBlocked', 'messagesBlocked', 'wirelessDisplayBlocked',
      'screenCaptureBlocked', 'deviceSharingAllowed', 'factoryResetBlocked',
      'usbBlocked', 'antiTheftModeBlocked', 'windowsSpotlightBlocked',
      'edgeBlocked', 'edgeBlockAccessToAboutFlags', 'smartScreenEnabled',
      'smartScreenBlockPromptOverride', 'smartScreenBlockPromptOverrideForFiles',
      'webRtcBlockLocalhostIpAddress', 'internetSharingBlocked',
      'settingsBlockAddProvisioningPackage', 'settingsBlockRemoveProvisioningPackage',
      'settingsBlockChangeSystemTime', 'settingsBlockEditDeviceName',
      'settingsBlockChangeRegion', 'settingsBlockChangeLanguage',
      'settingsBlockChangePowerSleep', 'locationServicesBlocked',
      'microsoftAccountBlocked', 'microsoftAccountBlockSettingsSync',
      'nfcBlocked', 'resetProtectionModeBlocked', 'powerButtonActionOnBattery',
      'powerButtonActionPluggedIn', 'powerLidCloseActionOnBattery',
      'powerLidCloseActionPluggedIn', 'powerHybridSleepOnBattery',
      'powerHybridSleepPluggedIn', 'windows10AppsForceUpdateSchedule',
      'enableAutomaticRedeployment', 'microsoftAccountSignInAssistantSettings',
      'authenticationAllowSecondaryDevice', 'authenticationWebSignIn',
      'authenticationPreferredAzureADTenantDomainName', 'cryptographyAllowFipsAlgorithmPolicy',
      'displayAppListWithGdiDPIScalingTurnedOn', 'displayAppListWithGdiDPIScalingTurnedOff',
      'enterpriseCloudPrintDiscoveryEndPoint', 'enterpriseCloudPrintOAuthAuthority',
      'enterpriseCloudPrintOAuthClientIdentifier', 'enterpriseCloudPrintResourceIdentifier',
      'enterpriseCloudPrintDiscoveryMaxLimit', 'enterpriseCloudPrintMopriaDiscoveryResourceIdentifier',
      'experienceBlockDeviceDiscovery', 'experienceBlockErrorDialogWhenNoSIM',
      'experienceBlockTaskSwitcher', 'logonBlockFastUserSwitching'
    ];

    const policyObj = policy as Record<string, unknown>;
    
    for (const prop of settingProperties) {
      if (policyObj[prop] !== undefined && policyObj[prop] !== null) {
        const category = this.categorizeSettingProperty(prop);
        settings.push({
          category,
          key: this.formatSettingKey(prop),
          value: String(policyObj[prop]),
          description: '' // Clean display without technical details
        });
      }
    }

    // Also extract any other properties that look like settings
    for (const [key, value] of Object.entries(policyObj)) {
      if (value !== undefined && value !== null && 
          !['id', 'displayName', 'description', 'createdDateTime', 'lastModifiedDateTime', 
            'version', '@odata.type', '@odata.context', 'createdBy', 'assignments',
            'roleScopeTagIds', 'supportsScopeTags'].includes(key) &&
          !settingProperties.includes(key)) {
        
        // Skip administrative fields that aren't useful for demo
        const keyLower = key.toLowerCase();
        if (keyLower.includes('rolescopetagids') || keyLower.includes('supportsscopetags') ||
            keyLower.includes('role scope tag') || keyLower.includes('supports scope tags')) {
          continue;
        }
        
        // Special handling for OMA Settings arrays
        if ((key.toLowerCase().includes('oma') || key.toLowerCase().includes('settings')) && Array.isArray(value)) {
          console.log(`Found OMA settings array in Device Configuration "${key}":`, value);
          
          value.forEach((omaSetting: any, index: number) => {
            if (omaSetting.displayName && omaSetting.hasOwnProperty('value')) {
              const omaUri = omaSetting.omaUri || '';
              settings.push({
                category: omaUri ? this.categorizeOmaUri(omaUri) : this.categorizeSettingProperty(omaSetting.displayName),
                key: omaSetting.displayName,
                value: String(omaSetting.value),
                description: omaSetting.description || `OMA Setting: ${omaUri}`
              });
            } else {
              console.log(`OMA setting ${index} doesn't have expected structure:`, omaSetting);
            }
          });
          
          continue; // Skip the default processing for this key
        }
        
        const category = this.categorizeSettingProperty(key);
        settings.push({
          category,
          key: this.formatSettingKey(key),
          value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
          description: '' // Clean display without technical details
        });
      }
    }
  }

  /**
   * Categorize setting property based on name
   */
  private categorizeSettingProperty(prop: string): string {
    const propLower = prop.toLowerCase();
    
    if (propLower.includes('password') || propLower.includes('pin') || propLower.includes('auth')) return "Authentication";
    if (propLower.includes('camera') || propLower.includes('bluetooth') || propLower.includes('wifi') || propLower.includes('nfc')) return "Hardware";
    if (propLower.includes('storage') || propLower.includes('encryption')) return "Storage & Encryption";
    if (propLower.includes('screen') || propLower.includes('display')) return "Display";
    if (propLower.includes('power') || propLower.includes('battery')) return "Power Management";
    if (propLower.includes('microsoft') || propLower.includes('account')) return "Microsoft Account";
    if (propLower.includes('edge') || propLower.includes('web') || propLower.includes('internet')) return "Web & Browser";
    if (propLower.includes('settings') || propLower.includes('block')) return "System Settings";
    if (propLower.includes('location') || propLower.includes('sharing')) return "Privacy";
    if (propLower.includes('experience') || propLower.includes('logon')) return "User Experience";
    if (propLower.includes('cloud') || propLower.includes('print')) return "Cloud & Printing";
    
    return "General";
  }

  /**
   * Extract settings from a generic object
   */
  private extractSettingsFromObject(obj: Record<string, unknown>, category: string, settings: PolicySetting[]): void {
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        settings.push({
          category,
          key: this.formatSettingKey(key),
          value: String(value),
          description: '' // Clean display without technical details
        });
      }
    }
  }

  /**
   * Extract settings from Graph configuration setting - simplified approach
   */
  private extractFromGraphConfigurationSetting(setting: Record<string, unknown>): PolicySetting[] {
    const settings: PolicySetting[] = [];
    
    // Simple approach: if it has displayName, description, and value - use those directly
    if (setting.displayName && setting.hasOwnProperty('value')) {
      const displayName = setting.displayName as string;
      const description = setting.description as string || '';
      const omaUri = setting.omaUri as string || '';
      let value = '';
      
      // Handle different value types
      if (setting.value !== undefined && setting.value !== null) {
        value = String(setting.value);
      } else if ((setting as any).secretReferenceValueId) {
        value = '[Encrypted Value]';
      } else if ((setting as any).isEncrypted) {
        value = '[Encrypted]';
      } else {
        value = '[No Value]';
      }
      
        settings.push({
          category: omaUri ? this.categorizeOmaUri(omaUri) : this.categorizeSettingKey(displayName),
          key: displayName,
          value: this.translateSettingValue(value, displayName),
          description: description || '' // Use original description if available, otherwise clean
        });
      
      return settings;
    }
    
    // If it's an array of settings, process each one
    if (Array.isArray(setting)) {
      setting.forEach((item: any) => {
        settings.push(...this.extractFromGraphConfigurationSetting(item));
      });
      return settings;
    }
    
    // Handle Settings Catalog format as fallback
    if (setting.settingInstance) {
      const instance = setting.settingInstance as any;
      const settingId = instance.settingDefinitionId;
      
      if (settingId) {
        const category = this.categorizeSettingId(settingId);
        const settingName = this.formatSettingKey(settingId);
        let value = '[Unknown]';
        
        if (instance.choiceSettingValue?.value) {
          value = instance.choiceSettingValue.value;
        } else if (instance.simpleSettingValue?.value !== undefined) {
          value = String(instance.simpleSettingValue.value);
        }
        
        settings.push({
          category,
          key: settingName,
          value: this.translateSettingValue(value, settingName),
          description: '' // Clean display without technical details
        });
      }
      
      return settings;
    }
    
    // Fallback: extract any meaningful properties
    for (const [key, value] of Object.entries(setting)) {
      if (key !== '@odata.type' && value !== null && value !== undefined) {
        // Skip system properties and administrative fields
        const keyLower = key.toLowerCase();
        if (['@odata.context', 'id', 'createdDateTime', 'lastModifiedDateTime', 'settingInstance'].includes(key) ||
            keyLower.includes('rolescopetagids') || keyLower.includes('supportsscopetags') ||
            keyLower.includes('role scope tag') || keyLower.includes('supports scope tags')) {
          continue;
        }
        
        // Special handling for OMA Settings arrays (common in Device Configuration policies)
        if ((key.toLowerCase().includes('oma') || key.toLowerCase().includes('settings')) && Array.isArray(value)) {
          console.log(`Found OMA settings array in key "${key}":`, value);
          
          value.forEach((omaSetting: any, index: number) => {
            if (omaSetting.displayName && omaSetting.hasOwnProperty('value')) {
              const omaUri = omaSetting.omaUri || '';
              settings.push({
                category: omaUri ? this.categorizeOmaUri(omaUri) : this.categorizeSettingKey(omaSetting.displayName),
                key: omaSetting.displayName,
                value: String(omaSetting.value),
                description: omaSetting.description || `OMA Setting: ${omaUri}`
              });
            } else {
              console.log(`OMA setting ${index} doesn't have expected structure:`, omaSetting);
            }
          });
          
          continue; // Skip the default processing for this key
        }
        
        const category = this.categorizeSettingKey(key);
        settings.push({
          category,
          key: this.formatSettingKey(key),
          value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
          description: '' // Clean display without technical details
        });
      }
    }
    
    return settings;
  }

  /**
   * Determine platform from OData type or other indicators
   */
  private determinePlatform(odataType: string): "Windows" | "iOS" | "Android" | "macOS" | "All Platforms" {
    const type = odataType.toLowerCase();
    
    if (type.includes("windows") || type.includes("win32")) return "Windows";
    if (type.includes("ios") || type.includes("iphone")) return "iOS";
    if (type.includes("android")) return "Android";
    if (type.includes("macos") || type.includes("mac")) return "macOS";
    
    return "All Platforms";
  }

  /**
   * Map platform string to enum value
   */
  private mapPlatformFromString(platformString: string): "Windows" | "iOS" | "Android" | "macOS" | "All Platforms" {
    const platform = platformString.toLowerCase();
    
    if (platform.includes("windows")) return "Windows";
    if (platform.includes("ios")) return "iOS";
    if (platform.includes("android")) return "Android";
    if (platform.includes("macos")) return "macOS";
    
    return "All Platforms";
  }

  /**
   * Format setting key for display with intelligent parsing
   */
  private formatSettingKey(key: string): string {
    // Handle device_vendor_msft_policy_config format (Settings Catalog)
    if (key.includes('device_vendor_msft_policy_config_')) {
      return this.parseSettingsCatalogId(key);
    }
    
    // Handle camelCase and snake_case
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse Settings Catalog ID to human-readable format
   */
  private parseSettingsCatalogId(settingId: string): string {
    // Remove the prefix
    const withoutPrefix = settingId.replace('device_vendor_msft_policy_config_', '');
    const parts = withoutPrefix.split('_');
    
    // Common component mappings
    const componentMap: Record<string, string> = {
      'admx': 'Administrative Template',
      'defender': 'Microsoft Defender',
      'windowsdefender': 'Microsoft Defender',
      'connectivity': 'Network Connectivity',
      'system': 'System',
      'browser': 'Browser',
      'internetexplorer': 'Internet Explorer',
      'microsoftedge': 'Microsoft Edge',
      'windowsupdate': 'Windows Update',
      'applicationmanagement': 'Application Management',
      'devicemanagement': 'Device Management',
      'privacy': 'Privacy',
      'security': 'Security',
      'windowsai': 'Windows AI',
      'search': 'Search',
      'taskscheduler': 'Task Scheduler',
      'eventlog': 'Event Log',
      'wifi': 'Wi-Fi',
      'bluetooth': 'Bluetooth',
      'kerberos': 'Kerberos',
      'credentialsui': 'Credentials UI',
      'deliveryoptimization': 'Delivery Optimization',
      'experience': 'User Experience',
      'windowslogon': 'Windows Logon',
      'remotedesktop': 'Remote Desktop',
      'localsecurityauthority': 'Local Security Authority',
      'credentials': 'Credentials',
      'smartscreen': 'Smart Screen',
      'windowsfirewall': 'Windows Firewall',
      'troubleshooting': 'Troubleshooting',
      'diagnostics': 'Diagnostics',
      'errorreporting': 'Error Reporting',
      'msdt': 'Microsoft Support Diagnostic Tool',
      'icm': 'Information Collection',
      'nc': 'Network',
      'searchcompanion': 'Search Companion'
    };

    // Action/setting mappings
    const actionMap: Record<string, string> = {
      'disable': 'Disable',
      'enable': 'Enable',
      'allow': 'Allow',
      'prevent': 'Prevent',
      'block': 'Block',
      'configure': 'Configure',
      'set': 'Set',
      'turn': 'Turn',
      'disallow': 'Disallow',
      'restrict': 'Restrict',
      'require': 'Require',
      'shellhousestoreopenwith': 'Shell House Store Open With',
      'exitonisp': 'Exit on ISP',
      'noregistration': 'No Registration',
      'disabledownloadingofprintdriversoverhttp': 'Disable Downloading of Print Drivers over HTTP',
      'diableprintingoverhttp': 'Disable Printing over HTTP',
      'disablefileupdates': 'Disable File Updates'
    };

    let result = '';
    let processedParts: string[] = [];

    // Process each part
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].toLowerCase();
      
      // Skip common prefixes and numbers
      if (part.match(/^\d+$/) || part === '' || part.length === 1) {
        continue;
      }

      // Check for component mapping
      if (componentMap[part]) {
        processedParts.push(componentMap[part]);
      }
      // Check for action mapping
      else if (actionMap[part]) {
        processedParts.push(actionMap[part]);
      }
      // Handle compound words and camelCase
      else {
        let formattedPart = part
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
          .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Handle acronyms
          .split(/(?=[A-Z])/) // Split on capitals
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        processedParts.push(formattedPart);
      }
    }

    // Create a meaningful title
    if (processedParts.length > 0) {
      result = processedParts.join(': ');
      
      // Clean up the result
      result = result
        .replace(/:\s*:/g, ':') // Remove double colons
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
        
      // Ensure it doesn't end with a colon
      result = result.replace(/:$/, '');
    }

    // Fallback to original formatting if parsing didn't work well
    if (!result || result.length < 5) {
      result = withoutPrefix
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    return result;
  }

  /**
   * Translate technical setting values to user-friendly ones
   */
  private translateSettingValue(value: string, settingName: string = ''): string {
    if (!value) return value;
    
    const valueLower = value.toLowerCase();
    const settingLower = settingName.toLowerCase();
    
    // Debug specific settings that might be problematic
    if (settingLower.includes('appinstaller') || settingLower.includes('winget')) {
      console.log(`DEBUG - App Installer setting: "${settingName}" = "${value}"`);
    }
    
    // Common value translations
    const valueMap: Record<string, string> = {
      // Boolean values
      '0': 'Disabled',
      '1': 'Enabled',
      'true': 'Enabled',
      'false': 'Disabled',
      
      // Common choice values
      'device_vendor_msft_policy_config_admx_icm_shellhousestoreopenwith_2_1': 'Enabled',
      'device_vendor_msft_policy_config_admx_icm_nc_exitonisp_1': 'Enabled',
      'device_vendor_msft_policy_config_admx_icm_nc_noregistration_1': 'Enabled',
      'device_vendor_msft_policy_config_connectivity_disabledownloadingofprintdriversoverhttp_1': 'Enabled',
      'device_vendor_msft_policy_config_connectivity_diableprintingoverhttp_1': 'Enabled',
      'device_vendor_msft_policy_config_admx_icm_searchcompanion_disablefileupdates_1': 'Enabled',
      
      // Authentication values
      'automatic': 'Automatic',
      'enabled': 'Enabled',
      'disabled': 'Disabled',
      'notconfigured': 'Not Configured',
      'devicedefault': 'Device Default',
      'userdefined': 'User Defined',
      
      // Numeric mappings for specific settings
      '2': 'Enabled', // Common for many settings
      '3': 'Disabled', // Common for many settings
    };
    
    // Direct mapping
    if (valueMap[valueLower]) {
      return valueMap[valueLower];
    }
    
    // Context-aware translations - be more careful about enable/disable logic
    if (settingLower.includes('turn') || settingLower.includes('enable') || settingLower.includes('disable')) {
      if (valueLower === '0') return 'Disabled';
      if (valueLower === '1') return 'Enabled';
    }
    
    // Clean up long technical values - but don't assume they mean "Enabled"
    if (value.startsWith('device_vendor_msft_policy_config_')) {
      // Try to extract meaningful info from the config value
      if (value.includes('_0') || value.endsWith('_0')) return 'Disabled';
      if (value.includes('_1') || value.endsWith('_1')) return 'Enabled';
      if (value.includes('disable')) return 'Disabled';
      if (value.includes('enable')) return 'Enabled';
      // If we can't determine, just return "Configured" instead of assuming "Enabled"
      return 'Configured';
    }
    
    // Return original value if no translation found, but capitalize first letter
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  /**
   * Categorize setting based on ID
   */
  private categorizeSettingId(settingId: string): string {
    const settingLower = settingId.toLowerCase();
    
    // Create hierarchical categories like Intune portal
    
    // System categories
    if (settingLower.includes('troubleshooting') || settingLower.includes('diagnostics')) {
      if (settingLower.includes('msdt')) return "System > Troubleshooting and Diagnostics > Microsoft Support Diagnostic Tool";
      return "System > Troubleshooting and Diagnostics";
    }
    if (settingLower.includes('localeservices') || settingLower.includes('locale')) return "System > Locale Services";
    if (settingLower.includes('kerberos')) return "System > Kerberos";
    if (settingLower.includes('internetcommunication') || settingLower.includes('icm')) return "System > Internet Communication Management";
    if (settingLower.includes('errorreporting')) return "System > Error Reporting";
    if (settingLower.includes('eventlog')) return "System > Event Log";
    if (settingLower.includes('taskscheduler')) return "System > Task Scheduler";
    if (settingLower.includes('system')) return "System";
    
    // Network categories  
    if (settingLower.includes('connectivity')) {
      if (settingLower.includes('print')) return "Network > Connectivity > Printing";
      return "Network > Connectivity";
    }
    if (settingLower.includes('wifi') || settingLower.includes('wireless')) return "Network > Wi-Fi";
    if (settingLower.includes('network')) return "Network";
    
    // Security categories
    if (settingLower.includes('defender') || settingLower.includes('windowsdefender')) return "Security > Microsoft Defender";
    if (settingLower.includes('firewall')) return "Security > Windows Firewall";
    if (settingLower.includes('smartscreen')) return "Security > Smart Screen";
    if (settingLower.includes('credentials') || settingLower.includes('authentication')) return "Security > Authentication";
    if (settingLower.includes('security')) return "Security";
    
    // Application categories
    if (settingLower.includes('browser') || settingLower.includes('edge') || settingLower.includes('internetexplorer')) return "Applications > Browser";
    if (settingLower.includes('search') || settingLower.includes('searchcompanion')) return "Applications > Search";
    if (settingLower.includes('windowsai')) return "Applications > Windows AI";
    if (settingLower.includes('applicationmanagement') || settingLower.includes('app')) return "Applications";
    
    // User Experience categories
    if (settingLower.includes('deliveryoptimization')) return "User Experience > Delivery Optimization";
    if (settingLower.includes('windowslogon') || settingLower.includes('logon')) return "User Experience > Windows Logon";
    if (settingLower.includes('remotedesktop') || settingLower.includes('remote')) return "User Experience > Remote Desktop";
    if (settingLower.includes('experience') || settingLower.includes('user')) return "User Experience";
    
    // Privacy categories
    if (settingLower.includes('privacy') || settingLower.includes('telemetry') || settingLower.includes('data')) return "Privacy";
    
    // Updates categories
    if (settingLower.includes('windowsupdate') || settingLower.includes('update')) return "Updates > Windows Update";
    if (settingLower.includes('update')) return "Updates";
    
    // Device categories
    if (settingLower.includes('bluetooth')) return "Device Settings > Bluetooth";
    if (settingLower.includes('device') || settingLower.includes('hardware')) return "Device Settings";
    
    // Administrative Templates
    if (settingLower.includes('admx')) return "Administrative Templates";
    
    // Legacy categories for backwards compatibility
    if (settingLower.includes("password") || settingLower.includes("pin") || settingLower.includes("auth")) return "Authentication";
    if (settingLower.includes("compliance")) return "Compliance";
    if (settingLower.includes("encryption") || settingLower.includes("bitlocker")) return "Encryption";
    
    return "General";
  }

  /**
   * Categorize setting based on OMA URI
   */
  private categorizeOmaUri(omaUri: string): string {
    const uri = omaUri.toLowerCase();
    
    if (uri.includes("/device/vendor/msft/policy/config/windowsai")) return "Windows AI";
    if (uri.includes("/device/vendor/msft/policy/config/applicationcontrol")) return "Application Control";
    if (uri.includes("/device/vendor/msft/policy/config/security")) return "Security";
    if (uri.includes("/device/vendor/msft/policy/config/defender")) return "Windows Defender";
    if (uri.includes("/device/vendor/msft/policy/config/firewall")) return "Windows Firewall";
    if (uri.includes("/device/vendor/msft/policy/config/privacy")) return "Privacy";
    if (uri.includes("/device/vendor/msft/policy/config/update")) return "Windows Update";
    if (uri.includes("/device/vendor/msft/policy/config/devicelock")) return "Device Lock";
    if (uri.includes("/device/vendor/msft/policy/config/bitlocker")) return "BitLocker";
    if (uri.includes("/device/vendor/msft/policy/config/authentication")) return "Authentication";
    if (uri.includes("/device/vendor/msft/policy/config/browser")) return "Browser";
    if (uri.includes("/device/vendor/msft/policy/config/appruntime")) return "App Runtime";
    if (uri.includes("/device/vendor/msft/policy/config/connectivity")) return "Connectivity";
    if (uri.includes("/device/vendor/msft/policy/config/deviceinstallation")) return "Device Installation";
    if (uri.includes("/device/vendor/msft/policy/config/experience")) return "User Experience";
    if (uri.includes("/device/vendor/msft/policy/config/system")) return "System";
    if (uri.includes("/device/vendor/msft/policy/config/admx")) return "ADMX Settings";
    if (uri.includes("/device/vendor/msft/policy/config/deliveryoptimization")) return "Delivery Optimization";
    
    return "Device Configuration";
  }

  /**
   * Categorize setting based on setting key name
   */
  private categorizeSettingKey(key: string): string {
    const keyLower = key.toLowerCase();
    
    if (keyLower.includes("delivery") || keyLower.includes("optimization") || keyLower.includes("download")) return "Delivery Optimization";
    if (keyLower.includes("security") || keyLower.includes("firewall") || keyLower.includes("defender")) return "Security";
    if (keyLower.includes("password") || keyLower.includes("pin") || keyLower.includes("auth")) return "Authentication";
    if (keyLower.includes("device") || keyLower.includes("hardware")) return "Device Settings";
    if (keyLower.includes("app") || keyLower.includes("application")) return "Application Settings";
    if (keyLower.includes("network") || keyLower.includes("wifi") || keyLower.includes("vpn")) return "Network";
    if (keyLower.includes("update") || keyLower.includes("patch")) return "Updates";
    if (keyLower.includes("compliance")) return "Compliance";
    if (keyLower.includes("encryption") || keyLower.includes("bitlocker")) return "Encryption";
    if (keyLower.includes("scope") || keyLower.includes("tag")) return "General";
    if (keyLower.includes("peer") || keyLower.includes("cache") || keyLower.includes("ram") || keyLower.includes("disk")) return "Delivery Optimization";
    
    return "General";
  }

  /**
   * Transform Group Policy Configuration to unified format
   */
  private transformGroupPolicyConfiguration(policy: any): Policy {
    const settings: PolicySetting[] = [];
    
    // Extract settings from Group Policy object
    this.extractSettingsFromObject(policy, "Group Policy", settings);

    return {
      id: policy.id || "unknown",
      name: policy.displayName || "Unknown Group Policy",
      description: policy.description || "",
      type: "Configuration Policy",
      platform: "Windows",
      lastModified: policy.lastModifiedDateTime ? new Date(policy.lastModifiedDateTime).toLocaleDateString() : "Unknown",
      createdBy: policy.createdBy?.user?.displayName || "Unknown",
      assignedGroups: [],
      settings
    };
  }

  /**
   * Transform Security Baseline/Intent to unified format
   */
  private transformSecurityBaseline(baseline: any): Policy {
    const settings: PolicySetting[] = [];
    
    // Extract settings from Security Baseline object
    this.extractSettingsFromObject(baseline, "Security Baseline", settings);

    return {
      id: baseline.id || "unknown",
      name: baseline.displayName || "Unknown Security Baseline",
      description: baseline.description || "",
      type: "Configuration Policy",
      platform: this.determinePlatform(baseline["@odata.type"] || ""),
      lastModified: baseline.lastModifiedDateTime ? new Date(baseline.lastModifiedDateTime).toLocaleDateString() : "Unknown",
      createdBy: baseline.createdBy?.user?.displayName || "Unknown",
      assignedGroups: [],
      settings
    };
  }

  /**
   * Transform Device Enrollment Configuration to unified format
   */
  private transformEnrollmentConfiguration(config: any): Policy {
    const settings: PolicySetting[] = [];
    
    // Extract settings from Enrollment Configuration object
    this.extractSettingsFromObject(config, "Enrollment Configuration", settings);

    return {
      id: config.id || "unknown",
      name: config.displayName || "Unknown Enrollment Configuration",
      description: config.description || "",
      type: "Configuration Policy",
      platform: this.determinePlatform(config["@odata.type"] || ""),
      lastModified: config.lastModifiedDateTime ? new Date(config.lastModifiedDateTime).toLocaleDateString() : "Unknown",
      createdBy: config.createdBy?.user?.displayName || "Unknown",
      assignedGroups: [],
      settings
    };
  }
}
