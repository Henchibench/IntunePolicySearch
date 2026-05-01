# Intune Audit Log — Design Spec

## Goal

A dedicated `/audit` page that surfaces the full Intune audit event history from the Microsoft Graph API. Provides a chronological timeline of every change made in the tenant, who made it, and exactly what changed (old value vs new value) — replacing the limited "Recently Modified" table on the dashboard.

## Architecture

New top-level page at `/audit`, added to PillNav. Fetches from `GET /deviceManagement/auditEvents` (v1.0) with OData `$filter` and `$orderby`. All data is live — no caching layer. Actor user IDs are batch-resolved to display names via `GET /users/{userId}` and held in a session-scoped Map so repeat lookups are instant.

**Permissions required** (already granted):
- `DeviceManagementApps.Read.All` — audit events
- `User.Read.All` — actor name resolution

## Page Layout

Top to bottom:

1. **PillNav** — existing, updated to include "Audit" between "Compliance" and "Groups"
2. **UtilityRow** — existing, unchanged
3. **Filter bar** — date range + category + actor + free-text search
4. **Pivot tabs** — Timeline | By Resource | By Actor
5. **Results area** — event list or grouped sections based on active pivot
6. **Detail drawer** — slides out on row click

## Filter Bar

Horizontal bar with these controls:

- **Date range picker**: Two date inputs (from/to), default "7 days ago" to "today". Quick preset pills: "24h", "7d", "30d", "90d".
- **Category dropdown**: Multi-select, populated dynamically from `GET /deviceManagement/auditEvents/getAuditCategories`. Examples: "Compliance", "Configuration", "Application", "EnrollmentConfiguration".
- **Actor search**: Text input, client-side filter on `actor.userPrincipalName` or resolved display name from loaded data.
- **Free-text search**: Client-side filter across `displayName`, `activity`, resource display names.
- **Clear filters**: Link to reset all filters to defaults.

Date range and category selection trigger a server-side re-fetch (sent as `$filter` parameters). Actor and free-text search filter client-side on the already-fetched results for responsiveness.

Combined filter logic: AND across all active filters.

## Data Fetching

### Audit Events

```
GET /deviceManagement/auditEvents
  ?$filter=activityDateTime gt {fromDate}T00:00:00Z and activityDateTime lt {toDate}T23:59:59Z
  &$orderby=activityDateTime desc
```

When categories are selected, append: `and category eq 'Compliance'`. For multiple categories, chain with `or`: `and (category eq 'Compliance' or category eq 'Configuration')`.

Paginate via `@odata.nextLink` — fetch all pages for the selected date range so pivots work on the complete dataset.

### Actor Name Resolution

After fetching audit events, collect unique `actor.userId` values. Batch-resolve via individual `GET /users/{userId}?$select=displayName,userPrincipalName` calls (typically only a handful of distinct admins). Cache results in a `Map<string, { displayName: string; upn: string }>` held in component state — survives pivot switches and filter changes within the session. Fall back to UPN if lookup fails (deleted accounts, service principals).

### Audit Categories

```
GET /deviceManagement/auditEvents/getAuditCategories
```

Fetched once on page mount to populate the category dropdown.

## Pivot Views

All three views render from the same fetched dataset. Switching pivots does not re-fetch.

### Timeline (default)

Flat reverse-chronological list. Each row displays:

| Column | Source |
|--------|--------|
| Time | `activityDateTime` — relative format ("5m ago", "2h ago", "Yesterday", "3d ago") |
| Activity | Color-coded dot + `activity` description. Green = Create, amber = Update/Patch, red = Delete |
| Resource | `resources[0].displayName` — the policy/app/script affected |
| Actor | Resolved display name (primary), UPN (secondary muted text) |
| Result | Badge: Success (default) or Failure (destructive variant) |

### By Resource

Events grouped by affected resource. Each group header:
- Resource display name + resource type badge + event count
- Sorted by most-recently-modified resource first

Expand to see chronological events for that resource. Uses collapsible sections with chevron + count pattern (same as PolicySettingsSection).

### By Actor

Events grouped by actor. Each group header:
- Actor display name (resolved) + event count
- Sorted by most-active actor first

Expand to see their actions chronologically. Same collapsible pattern.

## Detail Drawer

Opens on row click. Uses the same `Sheet`/`SheetContent` component as the group lookup drawer.

### Header

- **Title**: Activity description (e.g. "Update DeviceCompliancePolicy")
- **Badges**: Operation type (Patch/Delete/Post), result (Success/Failure), category

### Metadata Section

- **When**: Full formatted timestamp (e.g. "May 1, 2026, 14:23:05")
- **Who**: Actor display name (bold), UPN (muted), application name, IP address
- **Resource**: Resource display name, type, resource ID
- **Correlation ID**: For cross-referencing with other logs

### Changes Section

- EyebrowLabel: "CHANGES"
- For each entry in `resources[].modifiedProperties[]`:
  - Property name as label (formatted with `formatSettingKey`)
  - Two-column layout:
    - **Old value** (left): muted text, strikethrough styling. Show "*(not set)*" if empty.
    - **New value** (right): normal text, subtle highlight. Show "*(removed)*" if empty.
  - Long values (JSON objects/arrays): collapsible code block with syntax highlighting, same pattern as ScriptContentSection

### Raw JSON

"Raw JSON" toggle button at bottom showing the full `auditEvent` object (same pattern as group lookup drawer).

## File Structure

| File | Purpose |
|------|---------|
| `src/pages/Audit.tsx` | Page component with filter state, data fetching orchestration, pivot tabs |
| `src/hooks/useAuditEvents.ts` | Hook: fetches audit events with pagination, manages loading/error state |
| `src/hooks/useActorResolver.ts` | Hook: batch-resolves user IDs to display names, caches in Map |
| `src/components/audit/AuditFilterBar.tsx` | Date range, category dropdown, actor search, free-text input |
| `src/components/audit/AuditTimeline.tsx` | Timeline pivot view — flat chronological list |
| `src/components/audit/AuditByResource.tsx` | By Resource pivot view — grouped collapsible sections |
| `src/components/audit/AuditByActor.tsx` | By Actor pivot view — grouped collapsible sections |
| `src/components/audit/AuditDetailDrawer.tsx` | Detail drawer with metadata, actor info, and property diffs |
| `src/components/audit/AuditDiffSection.tsx` | The old/new value diff display for modified properties |
| `src/types/audit.ts` | TypeScript interfaces for audit events, actors, resources, properties |

## Styling

Follow DESIGN.md throughout:
- Canvas cream background, EditorialCard for the results area
- EyebrowLabel for section headers (TIMELINE, CHANGES, etc.)
- Pill-shaped preset buttons for date range quick picks
- Color-coded activity dots: `text-emerald-600` (create), `text-amber-500` (update), `text-red-500` (delete)
- Diff section: old values use `text-muted-foreground line-through`, new values use default `text-ink` with subtle `bg-emerald-50` highlight
- Drawer matches existing `sm:max-w-2xl` pattern from group lookup

## Navigation Update

PillNav links become: Policies | Dashboard | Compliance | **Audit** | Groups

Route added to `App.tsx`: `/audit` → `Audit` page component.

## Error Handling

- API fetch failure: inline error banner in the results area (not a toast)
- Empty results: "No audit events found for this time range" message with suggestion to widen the date range
- Actor resolution failure: silently fall back to UPN display
- Pagination failure: show partial results with a "Failed to load all events" warning

## Scope Boundaries

**In scope:**
- Audit event timeline, grouping, filtering, and detail drill-down
- Actor name resolution with fallback
- Property-level diffs (old/new values)
- Three pivot views

**Out of scope:**
- Export to CSV/PDF (can be added later)
- Audit event notifications/alerts
- Comparison of two specific audit events
- Modifying or deleting audit events (read-only)
- Replacing the dashboard "Recently Modified" table (it stays as-is, the audit page is a separate tool)
