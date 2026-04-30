# Policy Settings Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user clicks a policy in the group lookup results, the detail drawer fetches and displays all configured settings for that policy in a grouped, readable table.

**Architecture:** A new `usePolicySettings` hook lazily fetches the full policy object from Graph beta when the drawer opens. A new `settingsExtractor.ts` module provides standalone extraction functions (refactored from `GraphService` private methods). A new `PolicySettingsSection` component renders grouped settings in the editorial design style.

**Tech Stack:** React, TypeScript, Microsoft Graph SDK (`@microsoft/microsoft-graph-client`), Tailwind CSS, editorial design system (DESIGN.md)

---

### Task 1: Create `settingsExtractor.ts` — core extraction functions

**Files:**
- Create: `src/lib/settingsExtractor.ts`
- Create: `src/lib/settingsExtractor.test.ts`
- Reference: `src/services/graphService.ts:638-818` (existing extraction logic)
- Reference: `src/types/graph.ts:172-177` (`PolicySetting` type)

This module extracts `PolicySetting[]` from raw Graph API response objects. It's a standalone refactor of the private methods currently in `GraphService`. No Graph client dependency — it operates on already-fetched JSON objects.

- [ ] **Step 1: Write failing tests for `extractSettingsFromObject`**

```typescript
// src/lib/settingsExtractor.test.ts
import { describe, it, expect } from 'vitest';
import { extractSettingsFromObject } from './settingsExtractor';

describe('extractSettingsFromObject', () => {
  it('extracts non-null key-value pairs with formatted keys', () => {
    const obj = {
      passwordRequired: true,
      passwordMinimumLength: 8,
      osMinimumVersion: null,
    };
    const result = extractSettingsFromObject(obj, 'Compliance');
    expect(result).toEqual([
      { category: 'Compliance', key: 'Password Required', value: 'true', description: '' },
      { category: 'Compliance', key: 'Password Minimum Length', value: '8', description: '' },
    ]);
  });

  it('returns empty array for empty object', () => {
    expect(extractSettingsFromObject({}, 'Test')).toEqual([]);
  });

  it('skips undefined values', () => {
    const obj = { settingA: undefined, settingB: 'yes' };
    const result = extractSettingsFromObject(obj, 'General');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Setting B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/settingsExtractor.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement `extractSettingsFromObject` and `formatSettingKey`**

```typescript
// src/lib/settingsExtractor.ts
import type { PolicySetting } from '@/types/graph';

/**
 * Metadata fields to skip when extracting settings from a raw policy object.
 */
const SKIP_FIELDS = new Set([
  'id', '@odata.type', '@odata.context', 'version', 'createdDateTime',
  'lastModifiedDateTime', 'displayName', 'name', 'description',
  'roleScopeTagIds', 'supportsScopeTags', 'isAssigned', 'assignments',
  'createdBy', 'deviceSettings', 'userSettings', 'settings',
  'deviceStatusOverview', 'userStatusOverview', 'deviceStatuses', 'userStatuses',
  'deviceSettingStateSummaries',
]);

/**
 * Convert camelCase/snake_case key to readable label.
 */
export function formatSettingKey(key: string): string {
  // Handle device_vendor_msft_policy_config format (Settings Catalog)
  if (key.includes('device_vendor_msft_policy_config_')) {
    const withoutPrefix = key.replace('device_vendor_msft_policy_config_', '');
    return withoutPrefix
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  }

  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key-value settings from a generic object, skipping metadata fields.
 */
export function extractSettingsFromObject(
  obj: Record<string, unknown>,
  category: string,
): PolicySetting[] {
  const settings: PolicySetting[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (SKIP_FIELDS.has(key)) continue;
    settings.push({
      category,
      key: formatSettingKey(key),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
      description: '',
    });
  }
  return settings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/settingsExtractor.test.ts`
Expected: PASS

- [ ] **Step 5: Add tests for `extractConfigurationPolicySettings`**

This handles Settings Catalog (`configurationPolicies/{id}/settings?$expand=settingDefinitions`).

```typescript
// Add to src/lib/settingsExtractor.test.ts
import { extractConfigurationPolicySettings } from './settingsExtractor';

describe('extractConfigurationPolicySettings', () => {
  it('extracts choice setting with definition metadata', () => {
    const response = {
      value: [
        {
          settingInstance: {
            settingDefinitionId: 'device_vendor_msft_policy_config_browser_allowautofill',
            choiceSettingValue: {
              value: 'device_vendor_msft_policy_config_browser_allowautofill_1',
            },
          },
          settingDefinitions: [
            {
              id: 'device_vendor_msft_policy_config_browser_allowautofill',
              displayName: 'Allow Autofill',
              description: 'Controls the browser autofill feature',
              options: [
                { itemId: 'device_vendor_msft_policy_config_browser_allowautofill_0', displayName: 'Disabled' },
                { itemId: 'device_vendor_msft_policy_config_browser_allowautofill_1', displayName: 'Enabled' },
              ],
            },
          ],
        },
      ],
    };
    const result = extractConfigurationPolicySettings(response);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Allow Autofill');
    expect(result[0].value).toBe('Enabled');
    expect(result[0].description).toBe('Controls the browser autofill feature');
  });

  it('extracts simple setting value', () => {
    const response = {
      value: [
        {
          settingInstance: {
            settingDefinitionId: 'some_setting_id',
            simpleSettingValue: { value: 42 },
          },
          settingDefinitions: [
            {
              id: 'some_setting_id',
              displayName: 'Max Retries',
            },
          ],
        },
      ],
    };
    const result = extractConfigurationPolicySettings(response);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Max Retries');
    expect(result[0].value).toBe('42');
  });

  it('returns empty array for empty response', () => {
    expect(extractConfigurationPolicySettings({ value: [] })).toEqual([]);
  });
});
```

- [ ] **Step 6: Implement `extractConfigurationPolicySettings`**

```typescript
// Add to src/lib/settingsExtractor.ts

/**
 * Extract settings from a Settings Catalog response
 * (configurationPolicies/{id}/settings?$expand=settingDefinitions).
 */
export function extractConfigurationPolicySettings(
  response: { value: any[] },
): PolicySetting[] {
  const settings: PolicySetting[] = [];
  for (const entry of response.value ?? []) {
    settings.push(...extractSettingInstance(entry));
  }
  return settings;
}

function extractSettingInstance(entry: any): PolicySetting[] {
  const instance = entry.settingInstance ?? entry;
  const definitions: any[] = entry.settingDefinitions ?? [];
  const settingId: string | undefined = instance.settingDefinitionId;
  if (!settingId) return [];

  const def = definitions.find((d: any) => d.id === settingId);
  const name = def?.displayName || formatSettingKey(settingId);
  const description = def?.description || def?.helpText || '';
  const category = def?.keywords
    ? categoryFromKeywords(def.keywords)
    : categorizeSettingId(settingId);

  const settings: PolicySetting[] = [];
  let displayValue = '[Unknown]';

  if (instance.choiceSettingValue?.value) {
    const raw = instance.choiceSettingValue.value;
    if (def?.options) {
      const opt = def.options.find((o: any) => o.itemId === raw);
      displayValue = opt?.displayName || opt?.name || translateValue(raw);
    } else {
      displayValue = translateValue(raw);
    }
    // Recurse into child settings
    for (const child of instance.choiceSettingValue.children ?? []) {
      settings.push(
        ...extractSettingInstance({ settingInstance: child, settingDefinitions: definitions }),
      );
    }
  } else if (instance.simpleSettingValue?.value !== undefined) {
    displayValue = String(instance.simpleSettingValue.value);
  } else if (instance.simpleSettingCollectionValue) {
    displayValue = (instance.simpleSettingCollectionValue as any[])
      .map((v: any) => String(v.value ?? v))
      .join(', ');
  }

  settings.push({ category, key: name, value: displayValue, description });
  return settings;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/settingsExtractor.test.ts`
Expected: PASS

- [ ] **Step 8: Add `extractGenericPolicySettings` and helper functions**

This is the generic extractor used for device configurations, compliance, app protection, etc. — it strips metadata fields and formats the remaining properties.

```typescript
// Add to src/lib/settingsExtractor.ts

/**
 * Translate technical values to human-readable.
 */
export function translateValue(value: string): string {
  if (!value) return value;
  const lower = value.toLowerCase();
  const map: Record<string, string> = {
    '0': 'Disabled', '1': 'Enabled', 'true': 'Enabled', 'false': 'Disabled',
    'notconfigured': 'Not Configured', 'devicedefault': 'Device Default',
  };
  if (map[lower]) return map[lower];
  if (value.startsWith('device_vendor_msft_policy_config_')) {
    if (value.endsWith('_0') || value.includes('disable')) return 'Disabled';
    if (value.endsWith('_1') || value.includes('enable')) return 'Enabled';
    return 'Configured';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Derive a category from Settings Catalog keywords (e.g. "\\Microsoft Edge").
 */
function categoryFromKeywords(keywords: string[]): string {
  if (!keywords || !Array.isArray(keywords)) return 'General';
  for (const kw of keywords) {
    if (kw.startsWith('\\')) {
      const parts = kw.substring(1).split('\\');
      return parts.length > 1
        ? `Administrative Templates > ${parts.join(' > ')}`
        : `Administrative Templates > ${parts[0]}`;
    }
  }
  return 'General';
}

/**
 * Derive a category from a settingDefinitionId.
 */
function categorizeSettingId(settingId: string): string {
  const s = settingId.toLowerCase();
  if (s.includes('defender') || s.includes('windowsdefender')) return 'Security > Microsoft Defender';
  if (s.includes('firewall')) return 'Security > Windows Firewall';
  if (s.includes('browser') || s.includes('edge')) return 'Applications > Browser';
  if (s.includes('connectivity')) return 'Network > Connectivity';
  if (s.includes('update')) return 'Updates > Windows Update';
  if (s.includes('admx')) return 'Administrative Templates';
  if (s.includes('privacy')) return 'Privacy';
  if (s.includes('system')) return 'System';
  return 'General';
}

/**
 * Extract settings from any Intune policy object by stripping metadata
 * and converting remaining properties to key/value settings.
 * Handles OMA-URI setting arrays found in device configurations.
 */
export function extractGenericPolicySettings(
  obj: Record<string, unknown>,
): PolicySetting[] {
  const settings: PolicySetting[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (SKIP_FIELDS.has(key)) continue;
    const keyLower = key.toLowerCase();
    if (keyLower.includes('rolescopetagids') || keyLower.includes('supportsscopetags')) continue;

    // Handle OMA Settings arrays (common in device configurations)
    if ((keyLower.includes('oma') || keyLower === 'omasettings') && Array.isArray(value)) {
      for (const oma of value as any[]) {
        if (oma.displayName && Object.prototype.hasOwnProperty.call(oma, 'value')) {
          const omaUri: string = oma.omaUri || '';
          settings.push({
            category: omaUri ? categorizeOmaUri(omaUri) : 'Device Configuration',
            key: oma.displayName,
            value: String(oma.value),
            description: oma.description || (omaUri ? `OMA-URI: ${omaUri}` : ''),
          });
        }
      }
      continue;
    }

    const category = categorizePropertyKey(key);
    settings.push({
      category,
      key: formatSettingKey(key),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
      description: '',
    });
  }
  return settings;
}

function categorizePropertyKey(prop: string): string {
  const p = prop.toLowerCase();
  if (p.includes('password') || p.includes('pin') || p.includes('auth')) return 'Authentication';
  if (p.includes('camera') || p.includes('bluetooth') || p.includes('wifi') || p.includes('nfc')) return 'Hardware';
  if (p.includes('storage') || p.includes('encryption')) return 'Storage & Encryption';
  if (p.includes('screen') || p.includes('display')) return 'Display';
  if (p.includes('power') || p.includes('battery')) return 'Power Management';
  if (p.includes('edge') || p.includes('web') || p.includes('internet')) return 'Web & Browser';
  if (p.includes('experience') || p.includes('logon')) return 'User Experience';
  return 'General';
}

function categorizeOmaUri(uri: string): string {
  const u = uri.toLowerCase();
  if (u.includes('defender')) return 'Windows Defender';
  if (u.includes('firewall')) return 'Windows Firewall';
  if (u.includes('privacy')) return 'Privacy';
  if (u.includes('update')) return 'Windows Update';
  if (u.includes('bitlocker')) return 'BitLocker';
  if (u.includes('browser')) return 'Browser';
  if (u.includes('connectivity')) return 'Connectivity';
  if (u.includes('security')) return 'Security';
  return 'Device Configuration';
}
```

- [ ] **Step 9: Add tests for `extractGenericPolicySettings`**

```typescript
// Add to src/lib/settingsExtractor.test.ts
import { extractGenericPolicySettings } from './settingsExtractor';

describe('extractGenericPolicySettings', () => {
  it('skips metadata fields', () => {
    const obj = {
      id: 'abc-123',
      displayName: 'My Policy',
      '@odata.type': '#microsoft.graph.something',
      lastModifiedDateTime: '2026-01-01',
      passwordRequired: true,
      storageRequireEncryption: false,
    };
    const result = extractGenericPolicySettings(obj);
    expect(result.map((r) => r.key)).toEqual([
      'Password Required',
      'Storage Require Encryption',
    ]);
  });

  it('handles OMA settings arrays', () => {
    const obj = {
      id: 'x',
      omaSettings: [
        {
          displayName: 'Allow Camera',
          value: '1',
          omaUri: './Device/Vendor/MSFT/Policy/Config/Camera/AllowCamera',
          description: 'Camera policy',
        },
      ],
    };
    const result = extractGenericPolicySettings(obj);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Allow Camera');
    expect(result[0].value).toBe('1');
  });

  it('stringifies object values as JSON', () => {
    const obj = { complexSetting: { nested: true } };
    const result = extractGenericPolicySettings(obj);
    expect(result[0].value).toContain('"nested": true');
  });
});
```

- [ ] **Step 10: Run all tests to verify they pass**

Run: `npx vitest run src/lib/settingsExtractor.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/settingsExtractor.ts src/lib/settingsExtractor.test.ts
git commit -m "feat(groups): add settingsExtractor module for policy settings extraction"
```

---

### Task 2: Create `usePolicySettings` hook — lazy fetch on drawer open

**Files:**
- Create: `src/hooks/usePolicySettings.ts`
- Reference: `src/hooks/useGroupAssignments.ts` (same auth/client pattern)
- Reference: `src/lib/settingsExtractor.ts` (extraction functions from Task 1)
- Reference: `src/types/graph.ts:172-177, 203-215` (`PolicySetting`, `IntuneObjectCategory`)

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/usePolicySettings.ts
import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from '@/hooks/useAuth';
import type { GroupAssignmentResult } from '@/types/graph';
import type { PolicySetting } from '@/types/graph';
import type { IntuneObjectCategory } from '@/types/graph';
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
      // intents/settings returns { value: [...] } with flat setting objects
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
      // No settings to fetch for this category (e.g. mobileApp)
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
        // Settings Catalog needs $expand=settingDefinitions
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
```

- [ ] **Step 2: Verify the hook compiles**

Run: `npx tsc --noEmit`
Expected: No type errors related to usePolicySettings

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePolicySettings.ts
git commit -m "feat(groups): add usePolicySettings hook for lazy settings fetch"
```

---

### Task 3: Create `PolicySettingsSection` component

**Files:**
- Create: `src/components/group/PolicySettingsSection.tsx`
- Reference: `src/components/ui/EyebrowLabel.tsx` (editorial styling)
- Reference: `src/types/graph.ts:172-177` (`PolicySetting` type)
- Reference: `DESIGN.md` (editorial palette)

- [ ] **Step 1: Create the component**

```typescript
// src/components/group/PolicySettingsSection.tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import type { PolicySetting } from '@/types/graph';
import { cn } from '@/lib/utils';

export interface PolicySettingsSectionProps {
  settings: PolicySetting[];
  isLoading: boolean;
  error: string | null;
}

export function PolicySettingsSection({
  settings,
  isLoading,
  error,
}: PolicySettingsSectionProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Could not load settings: {error}
      </p>
    );
  }

  if (settings.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No configurable settings found.
      </p>
    );
  }

  // Group by category
  const grouped = new Map<string, PolicySetting[]>();
  for (const s of settings) {
    const cat = s.category || 'General';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(s);
  }

  return (
    <div className="space-y-4">
      <EyebrowLabel>CONFIGURED SETTINGS</EyebrowLabel>
      {[...grouped.entries()].map(([category, items]) => (
        <SettingsGroup key={category} category={category} settings={items} />
      ))}
    </div>
  );
}

function SettingsGroup({
  category,
  settings,
}: {
  category: string;
  settings: PolicySetting[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-lifted overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-canvas transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {category}
        <span className="ml-auto tabular-nums text-muted-foreground/60">
          {settings.length}
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {settings.map((s, i) => (
            <div key={`${s.key}-${i}`} className="px-4 py-2.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium text-ink">{s.key}</span>
                <span className={cn(
                  'shrink-0 text-right',
                  s.value === 'Enabled' && 'text-emerald-700',
                  s.value === 'Disabled' && 'text-muted-foreground',
                  s.value !== 'Enabled' && s.value !== 'Disabled' && 'text-ink/80',
                )}>
                  {s.value}
                </span>
              </div>
              {s.description && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: No type errors related to PolicySettingsSection

- [ ] **Step 3: Commit**

```bash
git add src/components/group/PolicySettingsSection.tsx
git commit -m "feat(groups): add PolicySettingsSection component for settings display"
```

---

### Task 4: Integrate into `ResultsDetailDrawer`

**Files:**
- Modify: `src/components/group/ResultsDetailDrawer.tsx`

- [ ] **Step 1: Update the drawer to use the hook and render settings**

Replace the full file content:

```typescript
// src/components/group/ResultsDetailDrawer.tsx
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { GroupTypeBadge } from './GroupTypeBadge';
import { Badge } from '@/components/ui/badge';
import { PolicySettingsSection } from './PolicySettingsSection';
import { usePolicySettings } from '@/hooks/usePolicySettings';
import type { GroupAssignmentResult } from '@/types/graph';
import { Separator } from '@/components/ui/separator';

export interface ResultsDetailDrawerProps {
  row: GroupAssignmentResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResultsDetailDrawer({ row, open, onOpenChange }: ResultsDetailDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);
  const { settings, isLoading, error } = usePolicySettings(open ? row : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {row && (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="text-lg">{row.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <GroupTypeBadge category={row.category} />
                <Badge variant={row.intent === 'exclude' ? 'destructive' : 'default'}>
                  {row.intent}
                </Badge>
                {row.appIntent && (
                  <Badge variant="outline">{row.appIntent}</Badge>
                )}
                {row.source.kind === 'parent' && (
                  <Badge variant="outline">via {row.source.groupName ?? row.source.groupId}</Badge>
                )}
              </div>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              {row.description && <p className="text-muted-foreground">{row.description}</p>}
              {row.platform && (
                <div><span className="text-muted-foreground">Platform:</span> {row.platform}</div>
              )}
              {row.appType && (
                <div><span className="text-muted-foreground">App type:</span> {row.appType}</div>
              )}
              {row.filter && (
                <div>
                  <span className="text-muted-foreground">Filter:</span>{' '}
                  {row.filter.displayName ?? row.filter.id}
                  {' '}<Badge variant="outline">{row.filter.mode}</Badge>
                </div>
              )}
              {row.lastModified && (
                <div>
                  <span className="text-muted-foreground">Last modified:</span>{' '}
                  {new Date(row.lastModified).toLocaleString()}
                </div>
              )}

              <Separator />

              <PolicySettingsSection
                settings={settings}
                isLoading={isLoading}
                error={error}
              />

              <Separator />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRaw((s) => !s)}
              >
                {showRaw ? 'Hide raw JSON' : 'Raw JSON'}
              </Button>
              {showRaw && (
                <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(row.rawObject, null, 2)}
                </pre>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

Key changes from the original:
- Import `PolicySettingsSection` and `usePolicySettings`
- Import `Separator` for visual division
- Hook call: `usePolicySettings(open ? row : null)` — only fetches when drawer is open
- Widen from `sm:max-w-xl` to `sm:max-w-2xl`
- Add `PolicySettingsSection` between metadata and raw JSON toggle
- Add `Separator` components above and below settings

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/group/ResultsDetailDrawer.tsx
git commit -m "feat(groups): integrate policy settings drill-down into detail drawer"
```

---

### Task 5: End-to-end verification and polish

**Files:**
- All files from Tasks 1-4

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Start dev server and test manually**

Run: `npx vite --port 8080`

Manual test steps:
1. Navigate to `/groups`
2. Search for a group
3. Click a result row to open the drawer
4. Verify settings load with a spinner, then display grouped by category
5. Test collapsing/expanding category groups
6. Test different policy types:
   - A Settings Catalog policy (configurationPolicy) — should show rich labels from settingDefinitions
   - A device configuration — should show flat property settings
   - A compliance policy — should show compliance requirements
   - A mobile app — should show "No configurable settings found"
7. Verify the raw JSON toggle still works below settings
8. Verify the drawer is wider and scrollable

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(groups): final verification of settings drill-down feature"
```

Note: Only if any adjustments were needed during manual testing. If everything works, skip this step.
