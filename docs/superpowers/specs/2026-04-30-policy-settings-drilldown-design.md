# Policy Settings Drill-Down in Group Lookup

**Date:** 2026-04-30
**Status:** Approved

## Problem

The group lookup feature shows which Intune policies/apps are assigned to a group, but clicking a result only shows assignment metadata (intent, source, platform, filter). Users cannot see the actual settings configured in a policy without leaving the app and opening the Intune admin center.

## Solution

Add on-demand settings fetching and rendering to the `ResultsDetailDrawer`. When a user clicks a policy in the group lookup results, the drawer shows all configured settings grouped by category in a clean key/value table.

## Architecture

### On-Demand Fetch (Not Upfront)

The group scan fetches list-level data only (id, displayName, etc.). Full settings require a separate Graph API call per policy. Fetching settings for every result during the scan would multiply API calls dramatically and slow down the initial search.

Instead, settings are fetched lazily when the drawer opens for a specific result.

### Data Flow

```
User clicks row in ResultsTable
  -> ResultsDetailDrawer opens with GroupAssignmentResult
  -> usePolicySettings(row) hook fires
  -> Determines detail endpoint from row.category
  -> Fetches full policy object via Graph beta client
  -> Extracts PolicySetting[] using settingsExtractor functions
  -> PolicySettingsSection renders grouped settings
```

### Detail Endpoints by Category

| Category | Endpoint | Settings Source |
|----------|----------|-----------------|
| configurationPolicy | `/configurationPolicies/{id}/settings?$expand=settingDefinitions` | settingInstance parsing with definition labels |
| deviceConfiguration | `/deviceConfigurations/{id}` | Flat properties on polymorphic object |
| compliancePolicy | `/deviceCompliancePolicies/{id}` | Flat properties on polymorphic object |
| endpointSecurity | `/intents/{id}/settings` | Settings array |
| appProtection | `/managedAppPolicies/{id}` | Flat properties on object |
| appConfiguration | `/mobileAppConfigurations/{id}` | Flat properties on object |
| mobileApp | No additional fetch | Show existing metadata only (app type, platform) |
| platformScript | `/deviceManagementScripts/{id}` | Script metadata (not script content) |
| remediationScript | `/deviceHealthScripts/{id}` | Script metadata |
| complianceScript | `/deviceComplianceScripts/{id}` | Script metadata |
| autopilotProfile | `/windowsAutopilotDeploymentProfiles/{id}` | Flat properties |
| enrollmentConfig | `/deviceEnrollmentConfigurations/{id}` | Flat properties |
| updateRing | `/deviceConfigurations/{id}` | Same as deviceConfiguration |

## New Files

### `src/lib/settingsExtractor.ts`

Standalone functions refactored from `GraphService` class methods. The existing `graphService.ts` has proven extraction logic in private methods (`extractSettingsFromObject`, `extractFromGraphConfigurationSetting`, `extractDeviceConfigurationSettings`). These are currently locked inside the class and only usable by the policy search feature.

Refactoring into standalone functions lets both the policy search (`PolicyCard`) and the group drill-down share the same logic without instantiating a `GraphService`.

Key exports:
- `extractSettingsFromObject(obj, category)` — generic key/value extraction, skipping metadata fields
- `extractConfigurationPolicySettings(settingsResponse)` — Settings Catalog parsing with settingDefinitions
- `extractDeviceConfigSettings(policyObject)` — polymorphic device config extraction
- `extractComplianceSettings(policyObject)` — compliance policy extraction
- `extractIntentSettings(settingsArray)` — endpoint security intent settings
- `formatSettingKey(key)` — camelCase to readable label
- `translateSettingValue(value, key)` — boolean/enum to readable text

Metadata fields to skip during extraction: `id`, `@odata.type`, `@odata.context`, `version`, `createdDateTime`, `lastModifiedDateTime`, `displayName`, `name`, `description`, `roleScopeTagIds`, `supportsScopeTags`, `isAssigned`, `assignments`, `createdBy`.

### `src/hooks/usePolicySettings.ts`

Hook that lazily fetches and extracts settings for a single `GroupAssignmentResult`.

```typescript
interface UsePolicySettingsResult {
  settings: PolicySetting[];
  isLoading: boolean;
  error: string | null;
}

function usePolicySettings(row: GroupAssignmentResult | null): UsePolicySettingsResult
```

- Uses the same `getAccessToken` ref pattern as `useGroupAssignments`
- Creates a Graph client with `defaultVersion: 'beta'`
- Determines the correct endpoint from `row.category`
- Aborts previous fetch if row changes
- Returns extracted `PolicySetting[]`

### `src/components/group/PolicySettingsSection.tsx`

Renders settings grouped by category.

- Groups `PolicySetting[]` by `setting.category`
- Each group rendered with an `EyebrowLabel` header
- Key/value rows in a clean table layout
- Collapsible groups (expanded by default, max 3 groups shown initially if many)
- Description shown as subtle text below value when present
- Loading state: skeleton shimmer lines
- Error state: inline muted message
- Empty state: "No configurable settings" text

## Modified Files

### `src/components/group/ResultsDetailDrawer.tsx`

- Widen from `sm:max-w-xl` to `sm:max-w-2xl`
- Import and use `usePolicySettings` hook
- Add `PolicySettingsSection` below existing metadata
- Add a visual separator between metadata and settings

## Styling

Follow DESIGN.md editorial palette:
- `EyebrowLabel` for category group headers
- Cream canvas background for settings rows (`bg-canvas`)
- `text-ink` for setting keys, `text-muted-foreground` for values
- `border-border` dividers between rows
- Consistent with the existing drawer and editorial design language

## Scope Boundaries

**In scope:**
- Fetch and display settings for all policy categories that support it
- Reuse existing extraction logic (refactored out of graphService)
- Editorial styling consistent with the rest of the app

**Out of scope:**
- Editing settings from the drawer
- Comparing settings across policies
- Script content display (base64 decoded PowerShell/shell scripts)
- Deep-linking to Intune admin center for the specific policy
- Caching settings across drawer opens (each open re-fetches)
