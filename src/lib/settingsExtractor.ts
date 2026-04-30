/**
 * settingsExtractor.ts
 *
 * Standalone extraction functions that parse raw Graph API response objects
 * into PolicySetting arrays. No Graph client dependency — operates on
 * already-fetched JSON objects.
 */

import type { PolicySetting } from '@/types/graph';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKIP_FIELDS = new Set([
  'id',
  '@odata.type',
  '@odata.context',
  'version',
  'createdDateTime',
  'lastModifiedDateTime',
  'displayName',
  'name',
  'description',
  'roleScopeTagIds',
  'supportsScopeTags',
  'isAssigned',
  'assignments',
  'createdBy',
  'deviceSettings',
  'userSettings',
  'settings',
  'deviceStatusOverview',
  'userStatusOverview',
  'deviceStatuses',
  'userStatuses',
  'deviceSettingStateSummaries',
  'detectionScriptContent',
  'remediationScriptContent',
  'scriptContent',
]);

// ---------------------------------------------------------------------------
// Script content extraction
// ---------------------------------------------------------------------------

export interface ScriptBlock {
  label: string;
  content: string;
}

/**
 * Decode base64 script fields from a Graph API response object.
 * Returns decoded PowerShell scripts for display.
 *
 * - deviceHealthScripts have `detectionScriptContent` and `remediationScriptContent`
 * - deviceManagementScripts have `scriptContent`
 */
export function extractScriptContent(obj: Record<string, unknown>): ScriptBlock[] {
  const scripts: ScriptBlock[] = [];

  if (typeof obj.detectionScriptContent === 'string' && obj.detectionScriptContent) {
    scripts.push({
      label: 'Detection Script',
      content: decodeBase64(obj.detectionScriptContent),
    });
  }

  if (typeof obj.remediationScriptContent === 'string' && obj.remediationScriptContent) {
    scripts.push({
      label: 'Remediation Script',
      content: decodeBase64(obj.remediationScriptContent),
    });
  }

  if (typeof obj.scriptContent === 'string' && obj.scriptContent) {
    scripts.push({
      label: 'Script',
      content: decodeBase64(obj.scriptContent),
    });
  }

  return scripts;
}

function decodeBase64(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return '[Could not decode script content]';
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Convert a camelCase or snake_case key to a human-readable Title Case label.
 */
export function formatSettingKey(key: string): string {
  return key
    .replace(/_/g, ' ')                    // snake_case → spaces
    .replace(/([A-Z])/g, ' $1')            // camelCase → spaces before capitals
    .replace(/^./, str => str.toUpperCase()) // Capitalise first letter
    .replace(/\s+/g, ' ')                  // collapse multiple spaces
    .trim()
    // Title-case each word
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Translate a raw setting value into a human-readable string.
 */
export function translateValue(value: string): string {
  if (!value) return value;

  const lower = value.toLowerCase();

  const directMap: Record<string, string> = {
    'true': 'Enabled',
    'false': 'Disabled',
    '0': 'Disabled',
    '1': 'Enabled',
    'enabled': 'Enabled',
    'disabled': 'Disabled',
    'notconfigured': 'Not Configured',
    'devicedefault': 'Device Default',
    'userdefined': 'User Defined',
    'automatic': 'Automatic',
    '2': 'Enabled',
    '3': 'Disabled',
  };

  if (directMap[lower]) return directMap[lower];

  // Long Settings Catalog choice values
  if (value.startsWith('device_vendor_msft_policy_config_')) {
    if (value.endsWith('_0') || value.includes('disable')) return 'Disabled';
    if (value.endsWith('_1') || value.includes('enable')) return 'Enabled';
    return 'Configured';
  }

  // Capitalise first letter and return
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Internal categorisers
// ---------------------------------------------------------------------------

function categorizeByKey(key: string): string {
  const k = key.toLowerCase();

  if (k.includes('password') || k.includes('pin') || k.includes('auth')) return 'Authentication';
  if (k.includes('security') || k.includes('firewall') || k.includes('defender')) return 'Security';
  if (k.includes('network') || k.includes('wifi') || k.includes('vpn')) return 'Network';
  if (k.includes('delivery') || k.includes('optimization') || k.includes('download')) return 'Delivery Optimization';
  if (k.includes('app') || k.includes('application')) return 'Application Settings';
  if (k.includes('device') || k.includes('hardware')) return 'Device Settings';
  if (k.includes('update') || k.includes('patch')) return 'Updates';
  if (k.includes('compliance')) return 'Compliance';
  if (k.includes('encryption') || k.includes('bitlocker')) return 'Encryption';
  if (k.includes('privacy') || k.includes('telemetry')) return 'Privacy';

  return 'General';
}

function categorizeBySettingId(settingId: string): string {
  const s = settingId.toLowerCase();

  if (s.includes('admx_terminalserver') || s.includes('remotedesktopservices')) {
    return 'Administrative Templates > Windows Components > Remote Desktop Services';
  }
  if (s.includes('troubleshooting') || s.includes('diagnostics')) return 'System > Troubleshooting and Diagnostics';
  if (s.includes('kerberos')) return 'System > Kerberos';
  if (s.includes('icm') || s.includes('internetcommunication')) return 'System > Internet Communication Management';
  if (s.includes('errorreporting')) return 'System > Error Reporting';
  if (s.includes('eventlog')) return 'System > Event Log';
  if (s.includes('taskscheduler')) return 'System > Task Scheduler';
  if (s.includes('system')) return 'System';

  if (s.includes('connectivity') && s.includes('print')) return 'Network > Connectivity > Printing';
  if (s.includes('connectivity')) return 'Network > Connectivity';
  if (s.includes('wifi') || s.includes('wireless')) return 'Network > Wi-Fi';
  if (s.includes('network')) return 'Network';

  if (s.includes('defender') || s.includes('windowsdefender')) return 'Security > Microsoft Defender';
  if (s.includes('firewall')) return 'Security > Windows Firewall';
  if (s.includes('smartscreen')) return 'Security > Smart Screen';
  if (s.includes('credentials') || s.includes('authentication')) return 'Security > Authentication';
  if (s.includes('security')) return 'Security';

  if (s.includes('browser') || s.includes('edge') || s.includes('internetexplorer')) return 'Applications > Browser';
  if (s.includes('search') || s.includes('searchcompanion')) return 'Applications > Search';
  if (s.includes('windowsai')) return 'Applications > Windows AI';
  if (s.includes('applicationmanagement') || s.includes('app')) return 'Applications';

  if (s.includes('deliveryoptimization')) return 'User Experience > Delivery Optimization';
  if (s.includes('windowslogon') || s.includes('logon')) return 'User Experience > Windows Logon';
  if (s.includes('remotedesktop') || s.includes('remote')) return 'User Experience > Remote Desktop';
  if (s.includes('experience') || s.includes('user')) return 'User Experience';

  if (s.includes('privacy') || s.includes('telemetry') || s.includes('data')) return 'Privacy';
  if (s.includes('windowsupdate') || s.includes('update')) return 'Updates > Windows Update';
  if (s.includes('bluetooth')) return 'Device Settings > Bluetooth';
  if (s.includes('device') || s.includes('hardware')) return 'Device Settings';
  if (s.includes('admx')) return 'Administrative Templates';

  if (s.includes('password') || s.includes('pin') || s.includes('auth')) return 'Authentication';
  if (s.includes('compliance')) return 'Compliance';
  if (s.includes('encryption') || s.includes('bitlocker')) return 'Encryption';

  return 'General';
}

function categorizeByOmaUri(omaUri: string): string {
  const uri = omaUri.toLowerCase();

  if (uri.includes('/windowsai')) return 'Windows AI';
  if (uri.includes('/applicationcontrol')) return 'Application Control';
  if (uri.includes('/security')) return 'Security';
  if (uri.includes('/defender')) return 'Windows Defender';
  if (uri.includes('/firewall')) return 'Windows Firewall';
  if (uri.includes('/privacy')) return 'Privacy';
  if (uri.includes('/update')) return 'Windows Update';
  if (uri.includes('/devicelock')) return 'Device Lock';
  if (uri.includes('/bitlocker')) return 'BitLocker';
  if (uri.includes('/authentication')) return 'Authentication';
  if (uri.includes('/browser')) return 'Browser';
  if (uri.includes('/appruntime')) return 'App Runtime';
  if (uri.includes('/connectivity')) return 'Connectivity';
  if (uri.includes('/deviceinstallation')) return 'Device Installation';
  if (uri.includes('/experience')) return 'User Experience';
  if (uri.includes('/system')) return 'System';
  if (uri.includes('/admx')) return 'ADMX Settings';
  if (uri.includes('/deliveryoptimization')) return 'Delivery Optimization';

  return 'Device Configuration';
}

// ---------------------------------------------------------------------------
// Exported extraction functions
// ---------------------------------------------------------------------------

/**
 * Extract key/value pairs from a generic object, skipping metadata fields.
 * Formats camelCase/snake_case keys to readable labels.
 */
export function extractSettingsFromObject(
  obj: Record<string, unknown>,
  category: string,
): PolicySetting[] {
  const settings: PolicySetting[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;

    settings.push({
      category,
      key: formatSettingKey(key),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
      description: '',
    });
  }

  return settings;
}

/**
 * Handle Settings Catalog responses
 * (`configurationPolicies/{id}/settings?$expand=settingDefinitions`).
 *
 * Each item in `response.value` may contain:
 *   - `settingInstance` — the configured value
 *   - `settingDefinitions` — metadata array for this setting + its children
 */
export function extractConfigurationPolicySettings(
  response: Record<string, unknown>,
): PolicySetting[] {
  const items = (response as any).value;
  if (!Array.isArray(items) || items.length === 0) return [];

  const results: PolicySetting[] = [];

  for (const item of items) {
    results.push(...extractFromSettingItem(item));
  }

  return results;
}

/**
 * Extract settings from a single Settings Catalog item
 * (which contains `settingInstance` + optional `settingDefinitions`).
 */
function extractFromSettingItem(item: any): PolicySetting[] {
  const results: PolicySetting[] = [];
  const instance = item.settingInstance;
  if (!instance) return results;

  const settingDefinitions: any[] = Array.isArray(item.settingDefinitions)
    ? item.settingDefinitions
    : [];

  results.push(...extractFromInstance(instance, settingDefinitions));
  return results;
}

/**
 * Recursively extract a `settingInstance` node using the shared
 * `settingDefinitions` array for metadata lookup.
 */
function extractFromInstance(
  instance: any,
  settingDefinitions: any[],
): PolicySetting[] {
  const results: PolicySetting[] = [];
  const childResults: PolicySetting[] = [];
  const settingId: string = instance.settingDefinitionId || '';

  const definition = settingDefinitions.find((d: any) => d.id === settingId) ?? null;

  const settingName = definition?.displayName || formatSettingKey(settingId);
  const description: string = definition?.description || definition?.helpText || '';
  const category = categorizeBySettingId(settingId);

  let displayValue = '[Unknown]';

  if (instance.choiceSettingValue?.value !== undefined) {
    const rawValue: string = instance.choiceSettingValue.value;
    let optionLabel: string | undefined;

    if (definition?.options && Array.isArray(definition.options)) {
      const option = definition.options.find((o: any) => o.itemId === rawValue);
      optionLabel = option?.displayName || option?.name;
    }

    displayValue = optionLabel ?? translateValue(rawValue);

    // Recurse into children
    const children: any[] = instance.choiceSettingValue.children ?? [];
    for (const child of children) {
      childResults.push(
        ...extractFromInstance(
          child,
          settingDefinitions, // pass the same definitions so children can find their metadata
        ),
      );
    }
  } else if (instance.simpleSettingValue?.value !== undefined) {
    displayValue = String(instance.simpleSettingValue.value);
  } else if (instance.simpleSettingCollectionValue && Array.isArray(instance.simpleSettingCollectionValue)) {
    displayValue = (instance.simpleSettingCollectionValue as any[])
      .map((v: any) => String(v.value ?? v))
      .join(', ');
  }

  // Push parent before children so the UI renders them in natural order
  results.push({
    category,
    key: settingName,
    value: displayValue,
    description,
  });
  results.push(...childResults);

  return results;
}

/**
 * Like `extractSettingsFromObject` but:
 * - Auto-categorizes by property name
 * - Handles OMA-URI setting arrays (`omaSettings`)
 * - Stringifies object values as JSON
 */
export function extractGenericPolicySettings(
  obj: Record<string, unknown>,
): PolicySetting[] {
  const settings: PolicySetting[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;

    // Handle OMA settings arrays
    if (
      (key.toLowerCase().includes('oma') || key.toLowerCase() === 'omasettings') &&
      Array.isArray(value)
    ) {
      for (const omaSetting of value as any[]) {
        if (omaSetting.displayName !== undefined && 'value' in omaSetting) {
          const omaUri: string = omaSetting.omaUri || '';
          settings.push({
            category: omaUri
              ? categorizeByOmaUri(omaUri)
              : categorizeByKey(omaSetting.displayName),
            key: omaSetting.displayName,
            value: String(omaSetting.value),
            description: omaSetting.description || (omaUri ? `OMA Setting: ${omaUri}` : ''),
          });
        }
      }
      continue;
    }

    const category = categorizeByKey(key);
    settings.push({
      category,
      key: formatSettingKey(key),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
      description: '',
    });
  }

  return settings;
}
