import { describe, it, expect } from 'vitest';
import { normalizeConfigurationPolicyPlatforms } from './intunePlatform';

describe('normalizeConfigurationPolicyPlatforms', () => {
  it('maps windows10 family to Windows', () => {
    expect(normalizeConfigurationPolicyPlatforms('windows10')).toBe('Windows');
    expect(normalizeConfigurationPolicyPlatforms('windows10X')).toBe('Windows');
    expect(normalizeConfigurationPolicyPlatforms('windows10AndLater')).toBe('Windows');
  });

  it('maps iOS, macOS, android exactly', () => {
    expect(normalizeConfigurationPolicyPlatforms('iOS')).toBe('iOS');
    expect(normalizeConfigurationPolicyPlatforms('macOS')).toBe('macOS');
    expect(normalizeConfigurationPolicyPlatforms('android')).toBe('Android');
  });

  it('maps android variants and aosp to Android', () => {
    expect(normalizeConfigurationPolicyPlatforms('aosp')).toBe('Android');
    expect(normalizeConfigurationPolicyPlatforms('androidWorkProfile')).toBe('Android');
  });

  it('multi-value: first known token wins', () => {
    expect(normalizeConfigurationPolicyPlatforms('androidWorkProfile,android')).toBe('Android');
  });

  it('multi-value: leading unknown token is skipped', () => {
    expect(normalizeConfigurationPolicyPlatforms('unknown,iOS')).toBe('iOS');
  });

  it('returns undefined for linux', () => {
    expect(normalizeConfigurationPolicyPlatforms('linux')).toBeUndefined();
  });

  it('returns undefined for empty/missing input', () => {
    expect(normalizeConfigurationPolicyPlatforms('')).toBeUndefined();
    expect(normalizeConfigurationPolicyPlatforms(undefined)).toBeUndefined();
  });

  it('returns undefined for arbitrary unknown string', () => {
    expect(normalizeConfigurationPolicyPlatforms('somethingElse')).toBeUndefined();
  });
});
