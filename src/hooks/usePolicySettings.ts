import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';
import type { GroupAssignmentResult, PolicySetting, IntuneObjectCategory } from '@/types/graph';
import {
  extractConfigurationPolicySettings,
  extractGenericPolicySettings,
} from '@/lib/settingsExtractor';

interface DetailEndpoint {
  path: (id: string) => string;
  extractor: (data: any) => PolicySetting[];
}

const DETAIL_ENDPOINTS: Partial<Record<IntuneObjectCategory, DetailEndpoint>> = {
  configurationPolicy: {
    path: (id) => `/deviceManagement/configurationPolicies/${id}/settings`,
    extractor: (data) => extractConfigurationPolicySettings(data),
  },
  deviceConfiguration: {
    path: (id) => `/deviceManagement/deviceConfigurations/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  compliancePolicy: {
    path: (id) => `/deviceManagement/deviceCompliancePolicies/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  endpointSecurity: {
    path: (id) => `/deviceManagement/intents/${id}/settings`,
    extractor: (data) => {
      const items: any[] = data.value ?? [];
      const settings: PolicySetting[] = [];
      for (const item of items) {
        if (item.displayName || item.definitionId) {
          settings.push({
            category: 'Endpoint Security',
            key: item.displayName || item.definitionId || 'Unknown',
            value: item.value != null ? String(item.value) :
                   item.valueJson ? String(item.valueJson) : '[Not set]',
            description: item.description || '',
          });
        }
      }
      return settings;
    },
  },
  appProtection: {
    path: (id) => `/deviceAppManagement/managedAppPolicies/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  appConfiguration: {
    path: (id) => `/deviceAppManagement/mobileAppConfigurations/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  platformScript: {
    path: (id) => `/deviceManagement/deviceManagementScripts/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  remediationScript: {
    path: (id) => `/deviceManagement/deviceHealthScripts/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  complianceScript: {
    path: (id) => `/deviceManagement/deviceComplianceScripts/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  autopilotProfile: {
    path: (id) => `/deviceManagement/windowsAutopilotDeploymentProfiles/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  enrollmentConfig: {
    path: (id) => `/deviceManagement/deviceEnrollmentConfigurations/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
  updateRing: {
    path: (id) => `/deviceManagement/deviceConfigurations/${id}`,
    extractor: (data) => extractGenericPolicySettings(data),
  },
};

export interface UsePolicySettingsResult {
  settings: PolicySetting[];
  isLoading: boolean;
  error: string | null;
}

export function usePolicySettings(
  row: GroupAssignmentResult | null,
): UsePolicySettingsResult {
  const { getAccessToken } = useAuth();
  const [settings, setSettings] = useState<PolicySetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    if (aborter.current) aborter.current.abort();
    setSettings([]);
    setError(null);

    if (!row) {
      setIsLoading(false);
      return;
    }

    const endpoint = DETAIL_ENDPOINTS[row.category];
    if (!endpoint) {
      setIsLoading(false);
      return;
    }

    const ac = new AbortController();
    aborter.current = ac;
    setIsLoading(true);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await getAccessTokenRef.current() },
          defaultVersion: 'beta',
        });

        let builder = client.api(endpoint.path(row.id));
        if (row.category === 'configurationPolicy') {
          builder = builder.expand('settingDefinitions');
        }

        const data = await builder.get();
        if (ac.signal.aborted) return;

        const extracted = endpoint.extractor(data);
        setSettings(extracted);
      } catch (e: unknown) {
        if (!ac.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Failed to load settings');
        }
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [row?.id, row?.category]);

  return { settings, isLoading, error };
}
