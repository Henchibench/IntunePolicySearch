import { Policy } from "@/components/PolicyCard";

export const mockPolicies: Policy[] = [
  {
    id: "1",
    name: "Windows 11 Security Baseline",
    description: "Comprehensive security configuration for Windows 11 devices including BitLocker, Windows Defender, and firewall settings",
    type: "Device Configuration",
    platform: "Windows",
    lastModified: "2024-01-15",
    settings: [
      {
        category: "Security",
        key: "BitLocker Drive Encryption",
        value: "Enabled",
        description: "Enables BitLocker encryption for all drives"
      },
      {
        category: "Security",
        key: "Windows Defender Real-time Protection",
        value: "Enabled",
        description: "Enables real-time malware protection"
      },
      {
        category: "Firewall",
        key: "Windows Firewall - Domain Profile",
        value: "Enabled",
        description: "Enables firewall for domain network profile"
      },
      {
        category: "Authentication",
        key: "Windows Hello for Business",
        value: "Enabled",
        description: "Enables biometric authentication"
      }
    ]
  },
  {
    id: "2",
    name: "iOS App Protection Policy",
    description: "Mobile application management policy for iOS devices with data loss prevention and app-specific security controls",
    type: "App Protection",
    platform: "iOS",
    lastModified: "2024-01-12",
    settings: [
      {
        category: "Data Protection",
        key: "Prevent backup of app data",
        value: "Yes",
        description: "Prevents app data from being backed up to iCloud"
      },
      {
        category: "Data Protection",
        key: "Encrypt app data",
        value: "Yes",
        description: "Encrypts app data on device"
      },
      {
        category: "Access Requirements",
        key: "PIN for access",
        value: "Required",
        description: "Requires PIN to access managed apps"
      },
      {
        category: "Access Requirements",
        key: "PIN complexity",
        value: "Numeric complex",
        description: "Requires complex numeric PIN"
      }
    ]
  },
  {
    id: "3",
    name: "Android Work Profile Compliance",
    description: "Device compliance policy for Android Enterprise work profile devices ensuring minimum security standards",
    type: "Compliance Policy",
    platform: "Android",
    lastModified: "2024-01-10",
    settings: [
      {
        category: "Device Health",
        key: "Device encryption",
        value: "Required",
        description: "Device must be encrypted"
      },
      {
        category: "Device Health",
        key: "Minimum OS version",
        value: "Android 10.0",
        description: "Minimum required Android version"
      },
      {
        category: "Security",
        key: "Screen lock type",
        value: "Password, PIN, or biometric",
        description: "Required screen lock security"
      },
      {
        category: "Security",
        key: "Maximum inactivity before lock",
        value: "15 minutes",
        description: "Maximum time before screen locks"
      }
    ]
  },
  {
    id: "4",
    name: "Multi-Platform Conditional Access",
    description: "Cross-platform conditional access policy requiring MFA and compliant devices for accessing corporate resources",
    type: "Conditional Access",
    platform: "All Platforms",
    lastModified: "2024-01-08",
    settings: [
      {
        category: "Assignments",
        key: "Target users",
        value: "All users",
        description: "Policy applies to all users"
      },
      {
        category: "Assignments",
        key: "Cloud apps",
        value: "Office 365",
        description: "Policy applies to Office 365 apps"
      },
      {
        category: "Access Controls",
        key: "Grant access",
        value: "Require multi-factor authentication",
        description: "MFA required for access"
      },
      {
        category: "Access Controls",
        key: "Device compliance",
        value: "Required",
        description: "Device must be compliant"
      }
    ]
  },
  {
    id: "5",
    name: "macOS FileVault Configuration",
    description: "Device configuration for macOS devices enabling FileVault disk encryption and recovery key management",
    type: "Device Configuration",
    platform: "All Platforms",
    lastModified: "2024-01-05",
    settings: [
      {
        category: "Encryption",
        key: "FileVault",
        value: "Enabled",
        description: "Enables full disk encryption on macOS"
      },
      {
        category: "Encryption",
        key: "Recovery key type",
        value: "Institutional",
        description: "Uses institutional recovery key"
      },
      {
        category: "Security",
        key: "Gatekeeper",
        value: "Enabled",
        description: "Enables Gatekeeper app verification"
      },
      {
        category: "Updates",
        key: "Automatic security updates",
        value: "Enabled",
        description: "Automatically installs security updates"
      }
    ]
  }
];

export const policyTypeOptions = [
  { value: "all", label: "All Policy Types" },
  { value: "Device Configuration", label: "Device Configuration" },
  { value: "Compliance Policy", label: "Compliance Policy" },
  { value: "App Protection", label: "App Protection" },
  { value: "Conditional Access", label: "Conditional Access" },
];

export const platformOptions = [
  { value: "all", label: "All Platforms" },
  { value: "Windows", label: "Windows" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
  { value: "All Platforms", label: "Cross-Platform" },
];