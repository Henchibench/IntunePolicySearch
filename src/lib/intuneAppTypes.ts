import type { IntunePlatform } from '@/types/graph';

export interface MobileAppClassification {
  platform: IntunePlatform;
  appType: string;
}

const PREFIX = '#microsoft.graph.';

const KNOWN = {
  win32LobApp: { platform: 'Windows', appType: 'Win32' },
  win32CatalogApp: { platform: 'Windows', appType: 'Win32 (Catalog)' },
  windowsStoreApp: { platform: 'Windows', appType: 'Microsoft Store' },
  microsoftStoreForBusinessApp: { platform: 'Windows', appType: 'Microsoft Store for Business' },
  officeSuiteApp: { platform: 'Windows', appType: 'Microsoft 365 Apps' },
  windowsAppX: { platform: 'Windows', appType: 'Windows AppX' },
  windowsUniversalAppX: { platform: 'Windows', appType: 'Windows Universal AppX' },
  windowsMobileMSI: { platform: 'Windows', appType: 'Windows MSI' },
  windowsPhone81AppX: { platform: 'Windows', appType: 'Windows Phone AppX' },
  windowsPhone81AppXBundle: { platform: 'Windows', appType: 'Windows Phone AppX Bundle' },
  windowsPhone81StoreApp: { platform: 'Windows', appType: 'Windows Phone Store' },
  windowsMicrosoftEdgeApp: { platform: 'Windows', appType: 'Microsoft Edge' },
  windowsWebApp: { platform: 'Windows', appType: 'Web Link (Windows)' },
  webApp: { platform: 'Web', appType: 'Web Link' },
  iosStoreApp: { platform: 'iOS', appType: 'iOS Store' },
  iosLobApp: { platform: 'iOS', appType: 'iOS LOB' },
  iosVppApp: { platform: 'iOS', appType: 'iOS VPP' },
  iosWebClip: { platform: 'iOS', appType: 'iOS Web Clip' },
  managedIOSStoreApp: { platform: 'iOS', appType: 'Managed iOS Store' },
  managedIOSLobApp: { platform: 'iOS', appType: 'Managed iOS LOB' },
  androidStoreApp: { platform: 'Android', appType: 'Android Store' },
  androidLobApp: { platform: 'Android', appType: 'Android LOB' },
  androidManagedStoreApp: { platform: 'Android', appType: 'Managed Google Play' },
  androidManagedStoreWebApp: { platform: 'Android', appType: 'Managed Google Play Web' },
  androidForWorkApp: { platform: 'Android', appType: 'Android for Work' },
  managedAndroidStoreApp: { platform: 'Android', appType: 'Managed Android Store' },
  managedAndroidLobApp: { platform: 'Android', appType: 'Managed Android LOB' },
  macOSDmgApp: { platform: 'macOS', appType: 'macOS DMG' },
  macOSPkgApp: { platform: 'macOS', appType: 'macOS PKG' },
  macOSLobApp: { platform: 'macOS', appType: 'macOS LOB' },
  macOSOfficeSuiteApp: { platform: 'macOS', appType: 'macOS Office Suite' },
  macOSMicrosoftEdgeApp: { platform: 'macOS', appType: 'macOS Microsoft Edge' },
  macOSMicrosoftDefenderApp: { platform: 'macOS', appType: 'macOS Microsoft Defender' },
  macOsVppApp: { platform: 'macOS', appType: 'macOS VPP' },
} satisfies Record<string, MobileAppClassification>;

export function classifyMobileApp(
  odataType: string | undefined,
): MobileAppClassification | undefined {
  if (!odataType) return undefined;
  const localName = odataType.startsWith(PREFIX)
    ? odataType.slice(PREFIX.length)
    : odataType;
  if (!localName) return undefined;

  const known = KNOWN[localName];
  if (known) return known;

  // Prefix fallback — case-insensitive so macOS / macOs both match.
  const lower = localName.toLowerCase();
  if (lower.startsWith('ios')) return { platform: 'iOS', appType: localName };
  if (lower.startsWith('android')) return { platform: 'Android', appType: localName };
  if (lower.startsWith('macos')) return { platform: 'macOS', appType: localName };
  if (
    lower.startsWith('windows') ||
    lower.startsWith('win32') ||
    lower.startsWith('microsoftstore') ||
    lower.startsWith('officesuite')
  ) {
    return { platform: 'Windows', appType: localName };
  }
  return undefined;
}
