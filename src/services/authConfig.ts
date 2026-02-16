import { Configuration, PopupRequest } from "@azure/msal-browser";

// Runtime config injected by Electron preload script (if running as desktop app)
const runtimeConfig = (window as any).__INTUNE_CONFIG__ as { clientId?: string; authority?: string; redirectUri?: string } | undefined;

// MSAL configuration object
export const msalConfig: Configuration = {
  auth: {
    clientId: runtimeConfig?.clientId || import.meta.env.VITE_AZURE_CLIENT_ID || "",
    authority: runtimeConfig?.authority || import.meta.env.VITE_AZURE_AUTHORITY || "https://login.microsoftonline.com/common",
    redirectUri: runtimeConfig?.redirectUri || import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  }
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest: PopupRequest = {
  scopes: [
    "https://graph.microsoft.com/DeviceManagementConfiguration.Read.All",
    "https://graph.microsoft.com/DeviceManagementApps.Read.All", 
    "https://graph.microsoft.com/DeviceManagementManagedDevices.Read.All",
    "https://graph.microsoft.com/DeviceManagementServiceConfig.Read.All"
  ]
};

// Add the endpoints here for Microsoft Graph API services you'd like to use.
// Note: Most Intune endpoints require /beta version for full functionality
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  
  // Device Management endpoints - using beta for complete functionality
  graphDeviceConfigurationsEndpoint: "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations",
  graphCompliancePoliciesEndpoint: "https://graph.microsoft.com/beta/deviceManagement/deviceCompliancePolicies",
  graphConfigurationPoliciesEndpoint: "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies",
  
  // App Protection endpoints - using more reliable endpoints
  graphManagedAppProtectionPoliciesEndpoint: "https://graph.microsoft.com/beta/deviceAppManagement/managedAppPolicies",
  graphManagedAppRegistrationsEndpoint: "https://graph.microsoft.com/beta/deviceAppManagement/managedAppRegistrations",
  
  // Additional policy endpoints for comprehensive coverage
  graphGroupPolicyConfigurationsEndpoint: "https://graph.microsoft.com/beta/deviceManagement/groupPolicyConfigurations",
  graphIntentAssignmentsEndpoint: "https://graph.microsoft.com/beta/deviceManagement/intents",
  graphDeviceEnrollmentConfigurationsEndpoint: "https://graph.microsoft.com/beta/deviceManagement/deviceEnrollmentConfigurations"
};
