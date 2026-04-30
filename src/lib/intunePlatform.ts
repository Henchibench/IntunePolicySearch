import type { IntunePlatform } from '@/types/graph';

const KNOWN: Record<string, IntunePlatform> = {
  // Windows family
  windows10: 'Windows',
  windows10x: 'Windows',
  windows10andlater: 'Windows',
  windowsphone81: 'Windows',
  windows81: 'Windows',
  windowsmobilemsi: 'Windows',
  // iOS / macOS
  ios: 'iOS',
  macos: 'macOS',
  // Android family
  android: 'Android',
  aosp: 'Android',
  androidworkprofile: 'Android',
  androidaospuserlessdevice: 'Android',
  androidaospuserassociateddevice: 'Android',
  androidforwork: 'Android',
};

export function normalizeConfigurationPolicyPlatforms(
  platforms: string | undefined,
): IntunePlatform | undefined {
  if (!platforms) return undefined;
  for (const raw of platforms.split(',')) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    const exact = KNOWN[token];
    if (exact) return exact;
    if (token.startsWith('windows') || token.startsWith('win32')) return 'Windows';
    if (token.startsWith('ios')) return 'iOS';
    if (token.startsWith('macos')) return 'macOS';
    if (token.startsWith('android') || token.startsWith('aosp')) return 'Android';
    // Continue to next token if this one doesn't match.
  }
  return undefined;
}
