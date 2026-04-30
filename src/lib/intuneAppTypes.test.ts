import { describe, it, expect } from 'vitest';
import { classifyMobileApp } from './intuneAppTypes';

describe('classifyMobileApp', () => {
  it('classifies a known Win32 LOB app', () => {
    expect(classifyMobileApp('#microsoft.graph.win32LobApp')).toEqual({
      platform: 'Windows',
      appType: 'Win32',
    });
  });

  it('classifies iOS Store app', () => {
    expect(classifyMobileApp('#microsoft.graph.iosStoreApp')).toEqual({
      platform: 'iOS',
      appType: 'iOS Store',
    });
  });

  it('classifies macOS DMG (capital OS)', () => {
    expect(classifyMobileApp('#microsoft.graph.macOSDmgApp')).toEqual({
      platform: 'macOS',
      appType: 'macOS DMG',
    });
  });

  it('classifies macOs VPP (lowercase s — Graph quirk)', () => {
    expect(classifyMobileApp('#microsoft.graph.macOsVppApp')).toEqual({
      platform: 'macOS',
      appType: 'macOS VPP',
    });
  });

  it('classifies webApp as Web platform', () => {
    expect(classifyMobileApp('#microsoft.graph.webApp')).toEqual({
      platform: 'Web',
      appType: 'Web Link',
    });
  });

  it('classifies Microsoft 365 Apps via officeSuiteApp', () => {
    expect(classifyMobileApp('#microsoft.graph.officeSuiteApp')).toEqual({
      platform: 'Windows',
      appType: 'Microsoft 365 Apps',
    });
  });

  it('falls back to iOS prefix for unknown ios* type', () => {
    expect(classifyMobileApp('#microsoft.graph.iosFutureApp')).toEqual({
      platform: 'iOS',
      appType: 'iosFutureApp',
    });
  });

  it('falls back to Windows for unknown win32* type', () => {
    expect(classifyMobileApp('#microsoft.graph.win32FutureApp')).toEqual({
      platform: 'Windows',
      appType: 'win32FutureApp',
    });
  });

  it('falls back to macOS for unknown macOs* lowercase type', () => {
    expect(classifyMobileApp('#microsoft.graph.macOsFutureApp')).toEqual({
      platform: 'macOS',
      appType: 'macOsFutureApp',
    });
  });

  it('returns undefined for unmatched type', () => {
    expect(classifyMobileApp('#microsoft.graph.somethingElseApp')).toBeUndefined();
  });

  it('returns undefined for missing or empty input', () => {
    expect(classifyMobileApp(undefined)).toBeUndefined();
    expect(classifyMobileApp('')).toBeUndefined();
    expect(classifyMobileApp('#microsoft.graph.')).toBeUndefined();
  });
});
