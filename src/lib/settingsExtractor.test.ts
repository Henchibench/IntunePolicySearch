import { describe, it, expect } from 'vitest';
import {
  formatSettingKey,
  translateValue,
  extractSettingsFromObject,
  extractConfigurationPolicySettings,
  extractGenericPolicySettings,
  extractScriptContent,
} from './settingsExtractor';

// ---------------------------------------------------------------------------
// formatSettingKey
// ---------------------------------------------------------------------------
describe('formatSettingKey', () => {
  it('converts camelCase to Title Case words', () => {
    expect(formatSettingKey('passwordRequired')).toBe('Password Required');
  });

  it('converts snake_case to Title Case words', () => {
    expect(formatSettingKey('device_lock')).toBe('Device Lock');
  });

  it('returns already-spaced string capitalised', () => {
    expect(formatSettingKey('hello world')).toBe('Hello World');
  });
});

// ---------------------------------------------------------------------------
// translateValue
// ---------------------------------------------------------------------------
describe('translateValue', () => {
  it('maps "true" to "Enabled"', () => {
    expect(translateValue('true')).toBe('Enabled');
  });

  it('maps "false" to "Disabled"', () => {
    expect(translateValue('false')).toBe('Disabled');
  });

  it('passes through unknown values with first letter capitalised', () => {
    expect(translateValue('someValue')).toBe('SomeValue');
  });
});

// ---------------------------------------------------------------------------
// extractSettingsFromObject
// ---------------------------------------------------------------------------
describe('extractSettingsFromObject', () => {
  it('extracts non-null key-value pairs with formatted keys', () => {
    const obj = { passwordRequired: true, deviceLock: false };
    const result = extractSettingsFromObject(obj, 'Test');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ category: 'Test', key: 'Password Required' });
    expect(result[1]).toMatchObject({ category: 'Test', key: 'Device Lock' });
  });

  it('returns empty array for empty object', () => {
    expect(extractSettingsFromObject({}, 'Test')).toEqual([]);
  });

  it('skips undefined and null values', () => {
    const obj = { good: 'yes', bad: null, ugly: undefined };
    const result = extractSettingsFromObject(obj as Record<string, unknown>, 'Cat');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Good');
  });

  it('skips SKIP_FIELDS metadata keys', () => {
    const obj = {
      id: '123',
      '@odata.type': '#microsoft.graph.windows10GeneralConfiguration',
      '@odata.context': 'https://graph.microsoft.com',
      displayName: 'My Policy',
      version: 1,
      createdDateTime: '2024-01-01',
      lastModifiedDateTime: '2024-06-01',
      roleScopeTagIds: [],
      supportsScopeTags: true,
      isAssigned: false,
      passwordRequired: true,
    };
    const result = extractSettingsFromObject(obj as Record<string, unknown>, 'Cat');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Password Required');
  });
});

// ---------------------------------------------------------------------------
// extractConfigurationPolicySettings
// ---------------------------------------------------------------------------
describe('extractConfigurationPolicySettings', () => {
  it('returns empty array for empty response', () => {
    expect(extractConfigurationPolicySettings({})).toEqual([]);
    expect(extractConfigurationPolicySettings({ value: [] })).toEqual([]);
  });

  it('extracts a choice setting with definition display name and option label', () => {
    const response = {
      value: [
        {
          settingInstance: {
            settingDefinitionId: 'device_vendor_msft_policy_config_security_requiredeviceencryption',
            choiceSettingValue: {
              value: 'device_vendor_msft_policy_config_security_requiredeviceencryption_1',
              children: [],
            },
          },
          settingDefinitions: [
            {
              id: 'device_vendor_msft_policy_config_security_requiredeviceencryption',
              displayName: 'Require Device Encryption',
              description: 'Requires device encryption.',
              options: [
                {
                  itemId: 'device_vendor_msft_policy_config_security_requiredeviceencryption_1',
                  displayName: 'Enabled',
                },
                {
                  itemId: 'device_vendor_msft_policy_config_security_requiredeviceencryption_0',
                  displayName: 'Disabled',
                },
              ],
            },
          ],
        },
      ],
    };

    const result = extractConfigurationPolicySettings(response);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Require Device Encryption');
    expect(result[0].value).toBe('Enabled');
    expect(result[0].description).toBe('Requires device encryption.');
  });

  it('extracts a simple setting value', () => {
    const response = {
      value: [
        {
          settingInstance: {
            settingDefinitionId: 'device_vendor_msft_policy_config_connectivity_allowbluetooth',
            simpleSettingValue: {
              value: '2',
            },
          },
          settingDefinitions: [
            {
              id: 'device_vendor_msft_policy_config_connectivity_allowbluetooth',
              displayName: 'Allow Bluetooth',
              description: '',
            },
          ],
        },
      ],
    };

    const result = extractConfigurationPolicySettings(response);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('Allow Bluetooth');
    expect(result[0].value).toBe('2');
  });

  it('recurses into child settings', () => {
    const response = {
      value: [
        {
          settingInstance: {
            settingDefinitionId: 'parent_setting',
            choiceSettingValue: {
              value: 'parent_setting_enabled',
              children: [
                {
                  settingDefinitionId: 'child_setting',
                  simpleSettingValue: { value: '30' },
                },
              ],
            },
          },
          settingDefinitions: [
            {
              id: 'parent_setting',
              displayName: 'Parent Setting',
              description: '',
              options: [
                { itemId: 'parent_setting_enabled', displayName: 'Enabled' },
              ],
            },
            {
              id: 'child_setting',
              displayName: 'Child Timeout',
              description: 'Timeout in minutes.',
            },
          ],
        },
      ],
    };

    const result = extractConfigurationPolicySettings(response);
    // Should have both parent and child
    const keys = result.map(r => r.key);
    expect(keys).toContain('Parent Setting');
    expect(keys).toContain('Child Timeout');
    const child = result.find(r => r.key === 'Child Timeout')!;
    expect(child.value).toBe('30');
  });
});

// ---------------------------------------------------------------------------
// extractGenericPolicySettings
// ---------------------------------------------------------------------------
describe('extractGenericPolicySettings', () => {
  it('skips metadata fields', () => {
    const obj = {
      id: 'abc',
      displayName: 'Policy',
      '@odata.type': '#microsoft.graph.foo',
      description: 'some description',
      version: 3,
      createdDateTime: '2024-01-01',
      passwordRequired: true,
    };
    const result = extractGenericPolicySettings(obj as Record<string, unknown>);
    expect(result.every(r => r.key !== 'Id')).toBe(true);
    expect(result.every(r => r.key !== 'Display Name')).toBe(true);
    expect(result.some(r => r.key === 'Password Required')).toBe(true);
  });

  it('handles OMA settings arrays', () => {
    const obj = {
      omaSettings: [
        {
          displayName: 'Allow Screenshot',
          omaUri: './Device/Vendor/MSFT/Policy/Config/Experience/AllowScreenCapture',
          value: 'true',
          description: 'Allows screenshots',
        },
        {
          displayName: 'Block Camera',
          omaUri: './Device/Vendor/MSFT/Policy/Config/Camera/AllowCamera',
          value: 'false',
        },
      ],
    };
    const result = extractGenericPolicySettings(obj);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('Allow Screenshot');
    expect(result[0].value).toBe('true');
    expect(result[1].key).toBe('Block Camera');
  });

  it('stringifies object values as JSON', () => {
    const obj = {
      networkConfig: { ssid: 'CorpWifi', security: 'WPA2' },
    };
    const result = extractGenericPolicySettings(obj);
    expect(result).toHaveLength(1);
    expect(result[0].value).toContain('ssid');
  });

  it('auto-categorizes by property name', () => {
    const obj = {
      passwordMinLength: '8',
      firewallEnabled: 'true',
    };
    const result = extractGenericPolicySettings(obj);
    const pwdSetting = result.find(r => r.key === 'Password Min Length')!;
    expect(pwdSetting.category).toBe('Authentication');
    const fwSetting = result.find(r => r.key === 'Firewall Enabled')!;
    expect(fwSetting.category).toBe('Security');
  });
});

// ---------------------------------------------------------------------------
// extractScriptContent
// ---------------------------------------------------------------------------

describe('extractScriptContent', () => {
  it('decodes base64 detection and remediation scripts from deviceHealthScript', () => {
    const obj = {
      id: 'abc',
      displayName: 'Test Script',
      detectionScriptContent: btoa('Write-Host "Detecting..."'),
      remediationScriptContent: btoa('Write-Host "Remediating..."'),
    };
    const scripts = extractScriptContent(obj);
    expect(scripts).toHaveLength(2);
    expect(scripts[0].label).toBe('Detection Script');
    expect(scripts[0].content).toBe('Write-Host "Detecting..."');
    expect(scripts[1].label).toBe('Remediation Script');
    expect(scripts[1].content).toBe('Write-Host "Remediating..."');
  });

  it('decodes base64 scriptContent from deviceManagementScript', () => {
    const obj = {
      id: 'xyz',
      scriptContent: btoa('Get-Process | Out-File report.txt'),
    };
    const scripts = extractScriptContent(obj);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].label).toBe('Script');
    expect(scripts[0].content).toBe('Get-Process | Out-File report.txt');
  });

  it('returns empty array when no script fields present', () => {
    const obj = { id: 'no-scripts', displayName: 'A Policy' };
    expect(extractScriptContent(obj)).toEqual([]);
  });

  it('skips empty string script fields', () => {
    const obj = { detectionScriptContent: '', remediationScriptContent: '' };
    expect(extractScriptContent(obj)).toEqual([]);
  });
});
