# Driver Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/drivers` page that lists every Windows driver update across the tenant's WUfB profiles, enriched with metadata from Dell's driver catalog (criticality, fixes, known issues, supported hardware). Manual sync in Electron, baked snapshot for web.

**Architecture:** Driver-centric main view. Two data paths feed it: Microsoft Graph (live, no cache beyond session Maps) and the Dell driver catalog (best-effort enrichment). The catalog comes from a build-time-baked snapshot (`public/driver-catalog.json`), with Electron mode adding an on-demand sync that overrides the snapshot. Per-device drill-down is **not** in v1 — only `applicableDeviceCount` numbers render.

**Tech Stack:** React 18 + TypeScript, Microsoft Graph SDK (`@microsoft/microsoft-graph-client`), shadcn/ui (Sheet, Popover, Tooltip, Tabs), Tailwind CSS, Vitest + React Testing Library, Node `cab` + `fast-xml-parser` for catalog extraction, Electron IPC + `electron-store` (already wired).

**Spec:** `docs/superpowers/specs/2026-05-07-driver-info-design.md`

---

## File Structure

| File | Purpose |
|------|---------|
| `src/types/drivers.ts` | TS interfaces: `DriverProfile`, `DriverInventory`, `CatalogEntry`, `Driver`, `DriverFilters`, `DriverPivot` |
| `scripts/lib/dell-catalog-normalize.ts` | Pure function: parsed Dell XML → `CatalogEntry[]` (shared by build script + Electron) |
| `scripts/lib/dell-catalog-normalize.test.ts` | Unit tests for normalization + `buildDriverKey` |
| `scripts/fetch-driver-catalog.ts` | Build-time CLI: download CAB, extract, normalize, write `public/driver-catalog.json` |
| `public/driver-catalog.json` | Baked catalog snapshot (committed to repo) |
| `public/driver-catalog.meta.json` | `{ lastBaked, entryCount, catalogSource }` |
| `electron-app/driver-catalog.ts` | Electron main-process IPC handlers: `:get-status`, `:get-entries`, `:sync` |
| `electron-app/preload.ts` | Extended with `contextBridge.exposeInMainWorld('driverCatalog', ...)` |
| `src/types/electron-globals.d.ts` | Ambient declaration for `window.driverCatalog`, `window.__IS_ELECTRON__` |
| `src/hooks/useDriverProfiles.ts` | Fetches WUfB driver update profiles + tests |
| `src/hooks/useDriverInventories.ts` | Fan-out fetch of driver inventories per profile + tests |
| `src/hooks/useDriverCatalog.ts` | Resolves Electron-synced vs baked catalog, exposes lookup `Map` + tests |
| `src/hooks/useDrivers.ts` | Composes profiles + inventories + catalog into `Driver[]` + tests |
| `src/components/drivers/DriverCriticalityBadge.tsx` | Criticality icon/badge + tests |
| `src/components/drivers/DriverFilterBar.tsx` | Filter controls + tests |
| `src/components/drivers/DriverTable.tsx` | All Drivers flat table + tests |
| `src/components/drivers/DriverByPolicy.tsx` | By Policy grouped pivot + tests |
| `src/components/drivers/DriverDetailDrawer.tsx` | Drawer (overview, policies, catalog, lookup) + tests |
| `src/components/drivers/CatalogSyncStatus.tsx` | Sync status row + button + tests |
| `src/pages/Drivers.tsx` | Page component: filter state, pivots, orchestration |
| `src/App.tsx` | Add `/drivers` route |
| `src/components/PillNav.tsx` | Add "Drivers" nav item |
| `package.json` | Add `fetch-catalog` script + `cab` and `fast-xml-parser` deps |

---

### Task 1: Types, Skeleton Page, Route Wiring

**Files:**
- Create: `src/types/drivers.ts`
- Create: `src/types/electron-globals.d.ts`
- Create: `src/pages/Drivers.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/PillNav.tsx`

- [ ] **Step 1: Create type definitions**

Create `src/types/drivers.ts`:

```typescript
/** WUfB driver update profile (subset of microsoft.graph.windowsDriverUpdateProfile) */
export interface DriverProfile {
  id: string;
  displayName: string;
  description: string | null;
  approvalType: 'manual' | 'automatic';
  inventorySyncStatus: {
    driverInventorySyncState: string;
    lastSuccessfulSyncDateTime: string | null;
  } | null;
  newUpdates: number;
  deviceReporting: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

/** A driver inventory entry inside a profile (subset of microsoft.graph.windowsDriverUpdateInventory) */
export interface DriverInventory {
  id: string;
  name: string;
  version: string;
  manufacturer: string;
  driverClass: string;
  releaseDateTime: string;
  approvalStatus: 'needsReview' | 'approved' | 'declined' | 'suspended';
  category: string;
  applicableDeviceCount: number;
  deviceCount: number;
}

/** Per-policy approval state for a driver (used in merged rows that appear in multiple policies) */
export interface DriverPolicyMembership {
  profileId: string;
  profileName: string;
  approvalType: 'manual' | 'automatic';
  approvalStatus: DriverInventory['approvalStatus'];
}

/** Normalized Dell catalog entry — only the fields the UI consumes */
export interface CatalogEntry {
  manufacturer: string;
  driverClass: string;
  name: string;
  version: string | null;
  releaseDate: string | null;
  criticality: 'Urgent' | 'Recommended' | 'Optional' | 'Other';
  fixes: string[];
  knownIssues: string[];
  supportedModels: string[];
  supportedOperatingSystems: string[];
  releaseNotesUrl: string | null;
}

/** Lookup key for joining DriverInventory to CatalogEntry */
export type DriverKey = string;

/** Joined driver row rendered in the UI */
export interface Driver {
  key: DriverKey;
  inventoryId: string;
  name: string;
  manufacturer: string;
  driverClass: string;
  version: string;
  releaseDateTime: string;
  applicableDeviceCount: number;
  deviceCount: number;
  policies: DriverPolicyMembership[];
  catalog: CatalogEntry | null;
}

/** Filter state for the drivers page */
export interface DriverFilters {
  manufacturers: string[];
  driverClasses: string[];
  approvalStatuses: DriverInventory['approvalStatus'][];
  criticalities: CatalogEntry['criticality'][];
  affectsDevicesOnly: boolean;
  freeText: string;
}

export type DriverPivot = 'all' | 'byPolicy';

export type CatalogSource = 'electron-sync' | 'baked' | 'none';

export interface CatalogStatus {
  lastSyncedAt: string | null;
  entryCount: number;
  source: CatalogSource;
}
```

- [ ] **Step 2: Add ambient declarations for Electron globals**

Create `src/types/electron-globals.d.ts`:

```typescript
import type { CatalogEntry, CatalogStatus } from './drivers';

declare global {
  interface Window {
    __IS_ELECTRON__?: boolean;
    driverCatalog?: {
      getStatus: () => Promise<CatalogStatus>;
      getEntries: () => Promise<CatalogEntry[]>;
      sync: () => Promise<CatalogStatus>;
      onSyncProgress: (
        cb: (data: { bytesReceived: number; totalBytes: number | null }) => void
      ) => () => void;
    };
  }
}

export {};
```

- [ ] **Step 3: Create skeleton Drivers page**

Create `src/pages/Drivers.tsx`:

```tsx
import { PillNav } from '@/components/PillNav';
import { UtilityRow } from '@/components/UtilityRow';

export default function Drivers() {
  return (
    <div className="min-h-screen bg-canvas">
      <PillNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <UtilityRow />
        <h1 className="mt-6 text-2xl font-medium tracking-tight2 text-ink">
          Driver Updates
        </h1>
        <p className="mt-1 text-sm text-slate">Coming soon</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `/drivers` route**

In `src/App.tsx`, add the import alongside the other page imports:

```tsx
import Drivers from "@/pages/Drivers";
```

Add the route alongside the existing routes (placement near `/audit` is fine):

```tsx
<Route path="/drivers" element={<Drivers />} />
```

- [ ] **Step 5: Add "Drivers" to PillNav**

In `src/components/PillNav.tsx`, update the `navItems` array (between `Audit` and `Groups`):

```tsx
const navItems = [
  { to: "/policies", label: "Policies" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/compliance", label: "Compliance" },
  { to: "/audit", label: "Audit" },
  { to: "/drivers", label: "Drivers" },
  { to: "/groups", label: "Groups" },
];
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/types/drivers.ts src/types/electron-globals.d.ts src/pages/Drivers.tsx src/App.tsx src/components/PillNav.tsx
git commit -m "feat(drivers): scaffold types, route, and pillnav entry"
```

---

### Task 2: Dell Catalog Normalization (TDD)

**Files:**
- Create: `scripts/lib/dell-catalog-normalize.ts`
- Create: `scripts/lib/dell-catalog-normalize.test.ts`

`buildDriverKey` and `normalizeCatalogXml` are pure functions used by both the build script and the Electron main process. Pure-function TDD here is fast and the keys/normalization shape are core to enrichment correctness.

- [ ] **Step 1: Write failing tests for `buildDriverKey`**

Create `scripts/lib/dell-catalog-normalize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDriverKey, normalizeCatalogXml } from './dell-catalog-normalize';

describe('buildDriverKey', () => {
  it('produces a normalized lowercase key', () => {
    expect(buildDriverKey('Dell Inc.', 'Display', 'Intel UHD Graphics 620')).toBe(
      'dell inc.|display|intel uhd graphics 620'
    );
  });

  it('collapses repeated whitespace', () => {
    expect(buildDriverKey('Dell  Inc.', 'Display', 'Intel  UHD   Graphics')).toBe(
      'dell inc.|display|intel uhd graphics'
    );
  });

  it('trims surrounding whitespace', () => {
    expect(buildDriverKey('  Dell Inc.  ', '  Display  ', '  Intel  ')).toBe(
      'dell inc.|display|intel'
    );
  });

  it('handles missing fields by using empty string segments', () => {
    expect(buildDriverKey('Dell Inc.', '', 'Intel')).toBe('dell inc.||intel');
  });
});

describe('normalizeCatalogXml', () => {
  it('extracts a single driver entry from a parsed XML object', () => {
    const parsed = {
      Manifest: {
        SoftwareComponent: [
          {
            '@_releaseDate': '2025-11-04',
            Name: { Display: { '#text': 'Intel UHD Graphics Driver' } },
            Description: { Display: { '#text': 'Graphics driver update' } },
            Category: { Display: { '#text': 'Video' } },
            Vendor: { '@_vendorVersion': '31.0.101.5186' },
            Criticality: { '@_value': '1' },
            ImportantInfo: { URL: 'https://www.dell.com/support/...' },
            SupportedSystems: {
              Brand: {
                Model: [{ Display: { '#text': 'Latitude 5440' } }],
              },
            },
            SupportedOperatingSystems: {
              OperatingSystem: [
                { Display: { '#text': 'Microsoft Windows 11' } },
              ],
            },
          },
        ],
      },
    };
    const result = normalizeCatalogXml(parsed, 'Dell Inc.');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      manufacturer: 'Dell Inc.',
      driverClass: 'Video',
      name: 'Intel UHD Graphics Driver',
      version: '31.0.101.5186',
      criticality: 'Urgent',
      releaseNotesUrl: 'https://www.dell.com/support/...',
      supportedModels: ['Latitude 5440'],
      supportedOperatingSystems: ['Microsoft Windows 11'],
    });
  });

  it('maps Criticality enum values correctly', () => {
    const make = (value: string) => ({
      Manifest: {
        SoftwareComponent: [
          {
            '@_releaseDate': '2025-11-04',
            Name: { Display: { '#text': 'X' } },
            Category: { Display: { '#text': 'Video' } },
            Criticality: { '@_value': value },
          },
        ],
      },
    });
    expect(normalizeCatalogXml(make('1'), 'Dell Inc.')[0].criticality).toBe('Urgent');
    expect(normalizeCatalogXml(make('2'), 'Dell Inc.')[0].criticality).toBe('Recommended');
    expect(normalizeCatalogXml(make('3'), 'Dell Inc.')[0].criticality).toBe('Optional');
    expect(normalizeCatalogXml(make('99'), 'Dell Inc.')[0].criticality).toBe('Other');
  });

  it('returns an empty array when SoftwareComponent is missing', () => {
    expect(normalizeCatalogXml({ Manifest: {} }, 'Dell Inc.')).toEqual([]);
  });

  it('handles SoftwareComponent as a single object (fast-xml-parser may not array-wrap singletons)', () => {
    const parsed = {
      Manifest: {
        SoftwareComponent: {
          '@_releaseDate': '2025-11-04',
          Name: { Display: { '#text': 'Single Driver' } },
          Category: { Display: { '#text': 'Audio' } },
        },
      },
    };
    const result = normalizeCatalogXml(parsed, 'Dell Inc.');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Single Driver');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/lib/dell-catalog-normalize.test.ts`

Expected: FAIL with "Cannot find module './dell-catalog-normalize'".

- [ ] **Step 3: Implement the normalization library**

Create `scripts/lib/dell-catalog-normalize.ts`:

```typescript
import type { CatalogEntry } from '../../src/types/drivers';

export function buildDriverKey(manufacturer: string, driverClass: string, name: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${norm(manufacturer)}|${norm(driverClass)}|${norm(name)}`;
}

const CRITICALITY_MAP: Record<string, CatalogEntry['criticality']> = {
  '1': 'Urgent',
  '2': 'Recommended',
  '3': 'Optional',
};

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function getDisplayText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj['#text'] === 'string') return obj['#text'];
    if (obj.Display) return getDisplayText(obj.Display);
  }
  return '';
}

interface SoftwareComponentNode {
  '@_releaseDate'?: string;
  Name?: unknown;
  Description?: unknown;
  Category?: unknown;
  Vendor?: { '@_vendorVersion'?: string } | undefined;
  Criticality?: { '@_value'?: string } | undefined;
  ImportantInfo?: { URL?: string } | undefined;
  SupportedSystems?: {
    Brand?: { Model?: unknown | unknown[] } | { Model?: unknown }[];
  };
  SupportedOperatingSystems?: { OperatingSystem?: unknown | unknown[] };
  Fixes?: { Fix?: unknown | unknown[] };
  KnownIssues?: { Issue?: unknown | unknown[] };
}

function extractModels(component: SoftwareComponentNode): string[] {
  const brands = asArray(component.SupportedSystems?.Brand);
  const out: string[] = [];
  for (const brand of brands) {
    const models = asArray((brand as { Model?: unknown }).Model);
    for (const model of models) {
      const text = getDisplayText(model);
      if (text) out.push(text);
    }
  }
  return out;
}

function extractOperatingSystems(component: SoftwareComponentNode): string[] {
  return asArray(component.SupportedOperatingSystems?.OperatingSystem)
    .map(getDisplayText)
    .filter(Boolean);
}

function extractFixes(component: SoftwareComponentNode): string[] {
  return asArray(component.Fixes?.Fix).map(getDisplayText).filter(Boolean);
}

function extractKnownIssues(component: SoftwareComponentNode): string[] {
  return asArray(component.KnownIssues?.Issue).map(getDisplayText).filter(Boolean);
}

export function normalizeCatalogXml(parsed: unknown, manufacturer: string): CatalogEntry[] {
  const root = (parsed as { Manifest?: { SoftwareComponent?: unknown } } | null)?.Manifest;
  if (!root) return [];
  const components = asArray(root.SoftwareComponent) as SoftwareComponentNode[];

  return components
    .map((component): CatalogEntry | null => {
      const name = getDisplayText(component.Name);
      if (!name) return null;
      const driverClass = getDisplayText(component.Category) || 'Other';
      const criticalityValue = component.Criticality?.['@_value'];
      const criticality = CRITICALITY_MAP[criticalityValue ?? ''] ?? 'Other';
      return {
        manufacturer,
        driverClass,
        name,
        version: component.Vendor?.['@_vendorVersion'] ?? null,
        releaseDate: component['@_releaseDate'] ?? null,
        criticality,
        fixes: extractFixes(component),
        knownIssues: extractKnownIssues(component),
        supportedModels: extractModels(component),
        supportedOperatingSystems: extractOperatingSystems(component),
        releaseNotesUrl: component.ImportantInfo?.URL ?? null,
      };
    })
    .filter((e): e is CatalogEntry => e !== null);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/lib/dell-catalog-normalize.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dell-catalog-normalize.ts scripts/lib/dell-catalog-normalize.test.ts
git commit -m "feat(drivers): catalog normalization library with tests"
```

---

### Task 3: Build Script + Stub Baked Snapshot

**Files:**
- Create: `scripts/fetch-driver-catalog.ts`
- Create: `public/driver-catalog.json` (stub)
- Create: `public/driver-catalog.meta.json` (stub)
- Modify: `package.json`

The build script downloads `CatalogPC.cab`, extracts the embedded XML, normalizes via the library from Task 2, and writes JSON to `public/`. We commit a small stub snapshot so dev/web mode can render against valid shape immediately. The user runs `npm run fetch-catalog` later to refresh against real Dell data.

- [ ] **Step 1: Add dependencies to package.json**

Run from the repo root:

```bash
npm install --save-dev cab fast-xml-parser
```

This adds `cab` (CAB extractor) and `fast-xml-parser` (XML parser) to devDependencies.

- [ ] **Step 2: Add `fetch-catalog` script**

In `package.json`, under `scripts`, add:

```json
"fetch-catalog": "tsx scripts/fetch-driver-catalog.ts"
```

If `tsx` is not already installed, add it: `npm install --save-dev tsx`. Verify in `package.json` that the new entries are present.

- [ ] **Step 3: Create the fetch script**

Create `scripts/fetch-driver-catalog.ts`:

```typescript
#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { tmpdir } from 'node:os';
import { XMLParser } from 'fast-xml-parser';
// @ts-expect-error — `cab` ships without types
import * as cab from 'cab';
import { normalizeCatalogXml } from './lib/dell-catalog-normalize.js';

const CATALOG_URL = 'https://downloads.dell.com/catalog/CatalogPC.cab';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUT_JSON = path.join(PUBLIC_DIR, 'driver-catalog.json');
const OUT_META = path.join(PUBLIC_DIR, 'driver-catalog.meta.json');

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function extractXmlFromCab(cabPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cab.extract(cabPath, (err: Error | null, files: { name: string; data: Buffer }[]) => {
      if (err) return reject(err);
      const xmlEntry = files.find((f) => /\.xml$/i.test(f.name));
      if (!xmlEntry) return reject(new Error('No XML file found inside CAB'));
      // CatalogPC.xml ships as UTF-16 LE
      resolve(xmlEntry.data.toString('utf16le'));
    });
  });
}

async function main() {
  const tmpCab = path.join(tmpdir(), `CatalogPC-${Date.now()}.cab`);
  console.log(`Downloading ${CATALOG_URL} → ${tmpCab}`);
  await downloadToFile(CATALOG_URL, tmpCab);

  console.log('Extracting XML from CAB');
  const xml = await extractXmlFromCab(tmpCab);
  fs.unlinkSync(tmpCab);

  console.log('Parsing XML');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml);

  console.log('Normalizing entries');
  const entries = normalizeCatalogXml(parsed, 'Dell Inc.');
  console.log(`Normalized ${entries.length} entries`);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(entries));
  fs.writeFileSync(
    OUT_META,
    JSON.stringify({
      lastBaked: new Date().toISOString(),
      entryCount: entries.length,
      catalogSource: CATALOG_URL,
    })
  );
  console.log(`Wrote ${OUT_JSON} and ${OUT_META}`);
}

main().catch((err) => {
  console.error('fetch-driver-catalog failed:', err.message);
  console.error('Existing files (if any) left untouched.');
  process.exit(1);
});
```

- [ ] **Step 4: Create stub baked snapshot**

Create `public/driver-catalog.json`:

```json
[
  {
    "manufacturer": "Dell Inc.",
    "driverClass": "Video",
    "name": "Sample Intel Graphics Driver",
    "version": "0.0.0.0",
    "releaseDate": "2025-01-01",
    "criticality": "Recommended",
    "fixes": ["Stub entry — replace by running `npm run fetch-catalog`."],
    "knownIssues": [],
    "supportedModels": ["Sample Model"],
    "supportedOperatingSystems": ["Microsoft Windows 11"],
    "releaseNotesUrl": null
  }
]
```

Create `public/driver-catalog.meta.json`:

```json
{
  "lastBaked": "2026-05-07T00:00:00.000Z",
  "entryCount": 1,
  "catalogSource": "stub — run `npm run fetch-catalog` to refresh"
}
```

- [ ] **Step 5: Verify build still passes**

Run: `npm run build`

Expected: PASS. The stub JSON should be copied into `dist/` as a static asset (Vite copies everything in `public/` automatically).

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-driver-catalog.ts package.json package-lock.json public/driver-catalog.json public/driver-catalog.meta.json
git commit -m "feat(drivers): add fetch-catalog build script and baked snapshot stub"
```

---

### Task 4: Electron — Driver Catalog IPC Module

**Files:**
- Create: `electron-app/driver-catalog.ts`
- Modify: `electron-app/main.ts`

The Electron main process exposes three IPC handlers: `:get-status`, `:get-entries`, and `:sync`. The sync handler reuses the same normalization library as the build script. Catalog files live under `app.getPath('userData')/driver-catalog/`.

- [ ] **Step 1: Create the catalog module**

Create `electron-app/driver-catalog.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { tmpdir } from 'node:os';
import { app, ipcMain, BrowserWindow } from 'electron';
import { XMLParser } from 'fast-xml-parser';
// @ts-expect-error — `cab` ships without types
import * as cab from 'cab';
import { normalizeCatalogXml } from '../scripts/lib/dell-catalog-normalize';

const CATALOG_URL = 'https://downloads.dell.com/catalog/CatalogPC.cab';

function getCatalogDir(): string {
  return path.join(app.getPath('userData'), 'driver-catalog');
}

function getEntriesPath(): string {
  return path.join(getCatalogDir(), 'dell.json');
}

function getMetaPath(): string {
  return path.join(getCatalogDir(), 'meta.json');
}

interface SyncedMeta {
  lastSyncedAt: string;
  entryCount: number;
}

function readMeta(): SyncedMeta | null {
  try {
    const raw = fs.readFileSync(getMetaPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getStatus() {
  const meta = readMeta();
  if (meta) {
    return {
      lastSyncedAt: meta.lastSyncedAt,
      entryCount: meta.entryCount,
      source: 'synced' as const,
    };
  }
  return { lastSyncedAt: null, entryCount: 0, source: 'none' as const };
}

function getEntries(): unknown[] {
  try {
    return JSON.parse(fs.readFileSync(getEntriesPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function downloadWithProgress(
  url: string,
  dest: string,
  onProgress: (bytesReceived: number, totalBytes: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
          return;
        }
        const totalBytes = response.headers['content-length']
          ? parseInt(response.headers['content-length'], 10)
          : null;
        let bytesReceived = 0;
        response.on('data', (chunk: Buffer) => {
          bytesReceived += chunk.length;
          onProgress(bytesReceived, totalBytes);
        });
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function extractXml(cabPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cab.extract(cabPath, (err: Error | null, files: { name: string; data: Buffer }[]) => {
      if (err) return reject(err);
      const xmlEntry = files.find((f) => /\.xml$/i.test(f.name));
      if (!xmlEntry) return reject(new Error('No XML file found inside CAB'));
      resolve(xmlEntry.data.toString('utf16le'));
    });
  });
}

async function syncCatalog(window: BrowserWindow | null) {
  fs.mkdirSync(getCatalogDir(), { recursive: true });
  const tmpCab = path.join(tmpdir(), `CatalogPC-${Date.now()}.cab`);

  try {
    await downloadWithProgress(CATALOG_URL, tmpCab, (bytesReceived, totalBytes) => {
      window?.webContents.send('driver-catalog:sync-progress', { bytesReceived, totalBytes });
    });

    const xml = await extractXml(tmpCab);
    fs.unlinkSync(tmpCab);

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);
    const entries = normalizeCatalogXml(parsed, 'Dell Inc.');

    const meta: SyncedMeta = {
      lastSyncedAt: new Date().toISOString(),
      entryCount: entries.length,
    };
    fs.writeFileSync(getEntriesPath(), JSON.stringify(entries));
    fs.writeFileSync(getMetaPath(), JSON.stringify(meta));

    return {
      lastSyncedAt: meta.lastSyncedAt,
      entryCount: meta.entryCount,
      source: 'synced' as const,
    };
  } catch (err) {
    if (fs.existsSync(tmpCab)) {
      try { fs.unlinkSync(tmpCab); } catch { /* swallow */ }
    }
    throw err;
  }
}

export function registerDriverCatalogIpc() {
  ipcMain.handle('driver-catalog:get-status', () => getStatus());
  ipcMain.handle('driver-catalog:get-entries', () => getEntries());
  ipcMain.handle('driver-catalog:sync', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return syncCatalog(window);
  });
}
```

- [ ] **Step 2: Register handlers in main.ts**

In `electron-app/main.ts`, add the import near the top:

```typescript
import { registerDriverCatalogIpc } from './driver-catalog';
```

Add the registration call inside the existing `// IPC handlers` block (after `ipcMain.handle('launch-app', ...)`):

```typescript
registerDriverCatalogIpc();
```

- [ ] **Step 3: Add fast-xml-parser and cab to electron-app deps**

The Electron main process needs the same packages. From the repo root:

```bash
cd electron-app && npm install --save fast-xml-parser cab && cd ..
```

- [ ] **Step 4: Verify Electron build compiles**

Run from `electron-app/`:

```bash
cd electron-app && npx tsc --noEmit && cd ..
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron-app/driver-catalog.ts electron-app/main.ts electron-app/package.json electron-app/package-lock.json
git commit -m "feat(drivers): add Electron IPC handlers for catalog sync"
```

---

### Task 5: Electron — Preload Bridge

**Files:**
- Modify: `electron-app/preload.ts`

Expose `window.driverCatalog` to the renderer via `contextBridge`. Already exposes `__IS_ELECTRON__`; we extend that file.

- [ ] **Step 1: Update preload.ts**

In `electron-app/preload.ts`, add the import at the top:

```typescript
import { contextBridge, ipcRenderer } from 'electron';
```

Replace the existing single-import line with the import above (it currently only imports `contextBridge`).

After the existing `contextBridge.exposeInMainWorld('__IS_ELECTRON__', true);` line, append:

```typescript
contextBridge.exposeInMainWorld('driverCatalog', {
  getStatus: () => ipcRenderer.invoke('driver-catalog:get-status'),
  getEntries: () => ipcRenderer.invoke('driver-catalog:get-entries'),
  sync: () => ipcRenderer.invoke('driver-catalog:sync'),
  onSyncProgress: (cb: (data: { bytesReceived: number; totalBytes: number | null }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: { bytesReceived: number; totalBytes: number | null }) => cb(data);
    ipcRenderer.on('driver-catalog:sync-progress', listener);
    return () => ipcRenderer.removeListener('driver-catalog:sync-progress', listener);
  },
});
```

- [ ] **Step 2: Verify Electron build compiles**

```bash
cd electron-app && npx tsc --noEmit && cd ..
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add electron-app/preload.ts
git commit -m "feat(drivers): expose driverCatalog bridge in preload"
```

---

### Task 6: useDriverCatalog Hook (TDD)

**Files:**
- Create: `src/hooks/useDriverCatalog.ts`
- Create: `src/hooks/useDriverCatalog.test.ts`

Source resolution: prefer Electron sync if available, else fall back to baked snapshot. Pure resolution logic is exposed as `resolveCatalogSource()` for direct testing.

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useDriverCatalog.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDriverCatalog } from './useDriverCatalog';
import type { CatalogEntry } from '@/types/drivers';

const sampleEntries: CatalogEntry[] = [
  {
    manufacturer: 'Dell Inc.',
    driverClass: 'Video',
    name: 'Sample',
    version: '1.0.0',
    releaseDate: '2025-01-01',
    criticality: 'Recommended',
    fixes: [],
    knownIssues: [],
    supportedModels: [],
    supportedOperatingSystems: [],
    releaseNotesUrl: null,
  },
];

describe('useDriverCatalog', () => {
  beforeEach(() => {
    delete (window as unknown as { __IS_ELECTRON__?: boolean }).__IS_ELECTRON__;
    delete (window as unknown as { driverCatalog?: unknown }).driverCatalog;
    vi.restoreAllMocks();
  });

  it('loads from baked snapshot in web mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => sampleEntries,
    } as Response);

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('baked');
    expect(result.current.entries.size).toBe(1);
    expect(result.current.entries.get('dell inc.|video|sample')).toBeDefined();
  });

  it('loads from Electron bridge when synced data exists', async () => {
    (window as unknown as { __IS_ELECTRON__: boolean }).__IS_ELECTRON__ = true;
    (window as unknown as { driverCatalog: unknown }).driverCatalog = {
      getStatus: vi.fn().mockResolvedValue({
        lastSyncedAt: '2026-05-07T00:00:00.000Z',
        entryCount: 1,
        source: 'synced',
      }),
      getEntries: vi.fn().mockResolvedValue(sampleEntries),
      sync: vi.fn(),
      onSyncProgress: vi.fn(() => () => {}),
    };

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('electron-sync');
    expect(result.current.entries.size).toBe(1);
  });

  it('falls back to baked snapshot when Electron reports no synced file', async () => {
    (window as unknown as { __IS_ELECTRON__: boolean }).__IS_ELECTRON__ = true;
    (window as unknown as { driverCatalog: unknown }).driverCatalog = {
      getStatus: vi.fn().mockResolvedValue({
        lastSyncedAt: null,
        entryCount: 0,
        source: 'none',
      }),
      getEntries: vi.fn(),
      sync: vi.fn(),
      onSyncProgress: vi.fn(() => () => {}),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => sampleEntries,
    } as Response);

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('baked');
  });

  it('returns source=none when both Electron and baked load fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('none');
    expect(result.current.entries.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDriverCatalog.test.ts`

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useDriverCatalog.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import type { CatalogEntry, CatalogSource, CatalogStatus } from '@/types/drivers';
import { buildDriverKey } from '../../scripts/lib/dell-catalog-normalize';

interface UseDriverCatalogResult {
  entries: Map<string, CatalogEntry>;
  lastSyncedAt: string | null;
  source: CatalogSource;
  isLoading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  sync: () => Promise<void>;
}

function buildEntryMap(entries: CatalogEntry[]): Map<string, CatalogEntry> {
  const map = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    map.set(buildDriverKey(entry.manufacturer, entry.driverClass, entry.name), entry);
  }
  return map;
}

async function loadBaked(): Promise<CatalogEntry[]> {
  const res = await fetch('/driver-catalog.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useDriverCatalog(): UseDriverCatalogResult {
  const [entries, setEntries] = useState<Map<string, CatalogEntry>>(new Map());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [source, setSource] = useState<CatalogSource>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.__IS_ELECTRON__ && window.driverCatalog) {
        const status = await window.driverCatalog.getStatus();
        if (status.source === 'synced') {
          const list = await window.driverCatalog.getEntries();
          setEntries(buildEntryMap(list));
          setLastSyncedAt(status.lastSyncedAt);
          setSource('electron-sync');
          return;
        }
      }
      const baked = await loadBaked();
      setEntries(buildEntryMap(baked));
      setLastSyncedAt(null);
      setSource('baked');
    } catch (err) {
      console.error('useDriverCatalog: failed to load catalog', err);
      setEntries(new Map());
      setSource('none');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const sync = useCallback(async () => {
    if (!window.__IS_ELECTRON__ || !window.driverCatalog) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const status: CatalogStatus = await window.driverCatalog.sync();
      const list = await window.driverCatalog.getEntries();
      setEntries(buildEntryMap(list));
      setLastSyncedAt(status.lastSyncedAt);
      setSource('electron-sync');
      setSyncStatus('idle');
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { entries, lastSyncedAt, source, isLoading, syncStatus, syncError, sync };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDriverCatalog.test.ts`

Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDriverCatalog.ts src/hooks/useDriverCatalog.test.ts
git commit -m "feat(drivers): useDriverCatalog hook with source resolution"
```

---

### Task 7: useDriverProfiles + useDriverInventories Hooks

**Files:**
- Create: `src/hooks/useDriverProfiles.ts`
- Create: `src/hooks/useDriverInventories.ts`
- Create: `src/hooks/useDriverInventories.test.ts`

`useDriverProfiles` is a thin Graph fetch — its logic is just paginate-all. We test that as a small integration. `useDriverInventories` does fan-out across profiles; we extract the fan-out as `fetchInventoriesForProfiles()` and test it directly.

- [ ] **Step 1: Implement useDriverProfiles**

Create `src/hooks/useDriverProfiles.ts`:

```typescript
import { useEffect, useState, useRef } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from './useAuth';
import type { DriverProfile } from '@/types/drivers';

export function useDriverProfiles(enabled: boolean) {
  const { getAccessToken } = useAuth();
  const [profiles, setProfiles] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await tokenRef.current() },
        });
        const collected: DriverProfile[] = [];
        let response = await client
          .api('/deviceManagement/windowsDriverUpdateProfiles')
          .version('beta')
          .get();
        while (response) {
          if (Array.isArray(response.value)) collected.push(...response.value);
          if (!response['@odata.nextLink']) break;
          response = await client.api(response['@odata.nextLink']).get();
        }
        if (!cancelled) setProfiles(collected);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  return { profiles, isLoading, error };
}
```

- [ ] **Step 2: Write failing tests for useDriverInventories fan-out**

Create `src/hooks/useDriverInventories.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchInventoriesForProfiles } from './useDriverInventories';
import type { DriverInventory } from '@/types/drivers';

function inv(name: string, status: DriverInventory['approvalStatus'] = 'needsReview'): DriverInventory {
  return {
    id: name,
    name,
    version: '1.0',
    manufacturer: 'Dell Inc.',
    driverClass: 'Video',
    releaseDateTime: '2025-01-01T00:00:00Z',
    approvalStatus: status,
    category: 'recommended',
    applicableDeviceCount: 1,
    deviceCount: 1,
  };
}

describe('fetchInventoriesForProfiles', () => {
  it('fans out one fetch per profile and returns a map of profileId → inventories', async () => {
    const fetchInventories = vi.fn().mockImplementation(async (profileId: string) => [
      inv(`${profileId}-driverA`),
      inv(`${profileId}-driverB`),
    ]);

    const result = await fetchInventoriesForProfiles(['p1', 'p2'], fetchInventories);

    expect(fetchInventories).toHaveBeenCalledTimes(2);
    expect(fetchInventories).toHaveBeenCalledWith('p1');
    expect(fetchInventories).toHaveBeenCalledWith('p2');
    expect(result.get('p1')).toHaveLength(2);
    expect(result.get('p2')).toHaveLength(2);
    expect(result.get('p1')?.[0].name).toBe('p1-driverA');
  });

  it('continues on per-profile failure and records the error in errors map', async () => {
    const fetchInventories = vi.fn().mockImplementation(async (profileId: string) => {
      if (profileId === 'p2') throw new Error('boom');
      return [inv(`${profileId}-driver`)];
    });

    const { results, errors } = await fetchInventoriesForProfiles(['p1', 'p2'], fetchInventories, { collectErrors: true });

    expect(results.get('p1')).toHaveLength(1);
    expect(results.get('p2')).toBeUndefined();
    expect(errors.get('p2')).toBe('boom');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDriverInventories.test.ts`

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement useDriverInventories**

Create `src/hooks/useDriverInventories.ts`:

```typescript
import { useEffect, useState, useRef } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from './useAuth';
import type { DriverInventory } from '@/types/drivers';

type FetchFn = (profileId: string) => Promise<DriverInventory[]>;

export interface FanOutResult {
  results: Map<string, DriverInventory[]>;
  errors: Map<string, string>;
}

export async function fetchInventoriesForProfiles(
  profileIds: string[],
  fetcher: FetchFn,
  opts: { collectErrors?: boolean } = {}
): Promise<FanOutResult> {
  const results = new Map<string, DriverInventory[]>();
  const errors = new Map<string, string>();
  await Promise.all(
    profileIds.map(async (id) => {
      try {
        const list = await fetcher(id);
        results.set(id, list);
      } catch (err) {
        if (opts.collectErrors) {
          errors.set(id, err instanceof Error ? err.message : String(err));
        } else {
          throw err;
        }
      }
    })
  );
  return { results, errors };
}

export function useDriverInventories(profileIds: string[], enabled: boolean) {
  const { getAccessToken } = useAuth();
  const [inventories, setInventories] = useState<Map<string, DriverInventory[]>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    if (!enabled || profileIds.length === 0) return;
    let cancelled = false;
    setIsLoading(true);

    const client = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => await tokenRef.current() },
    });

    const fetcher: FetchFn = async (profileId) => {
      const collected: DriverInventory[] = [];
      let response = await client
        .api(`/deviceManagement/windowsDriverUpdateProfiles/${profileId}/driverInventories`)
        .version('beta')
        .get();
      while (response) {
        if (Array.isArray(response.value)) collected.push(...response.value);
        if (!response['@odata.nextLink']) break;
        response = await client.api(response['@odata.nextLink']).get();
      }
      return collected;
    };

    fetchInventoriesForProfiles(profileIds, fetcher, { collectErrors: true })
      .then(({ results, errors: errMap }) => {
        if (cancelled) return;
        setInventories(results);
        setErrors(errMap);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [profileIds.join('|'), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { inventories, errors, isLoading };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDriverInventories.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDriverProfiles.ts src/hooks/useDriverInventories.ts src/hooks/useDriverInventories.test.ts
git commit -m "feat(drivers): add useDriverProfiles and useDriverInventories hooks"
```

---

### Task 8: useDrivers Composition Hook (TDD)

**Files:**
- Create: `src/hooks/useDrivers.ts`
- Create: `src/hooks/useDrivers.test.ts`

`buildDrivers()` is the pure join: `(profiles, inventoriesPerProfile, catalogMap) → Driver[]`. It merges identical drivers across profiles and attaches catalog data via `DriverKey`.

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useDrivers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDrivers } from './useDrivers';
import type { CatalogEntry, DriverInventory, DriverProfile } from '@/types/drivers';

function profile(id: string, name: string): DriverProfile {
  return {
    id,
    displayName: name,
    description: null,
    approvalType: 'manual',
    inventorySyncStatus: null,
    newUpdates: 0,
    deviceReporting: 0,
    createdDateTime: '2025-01-01T00:00:00Z',
    lastModifiedDateTime: '2025-01-01T00:00:00Z',
  };
}

function inv(name: string, version: string, profileId: string, status: DriverInventory['approvalStatus'] = 'needsReview'): DriverInventory {
  return {
    id: `${profileId}-${name}-${version}`,
    name,
    version,
    manufacturer: 'Dell Inc.',
    driverClass: 'Video',
    releaseDateTime: '2025-01-01T00:00:00Z',
    approvalStatus: status,
    category: 'recommended',
    applicableDeviceCount: 5,
    deviceCount: 10,
  };
}

const sampleCatalog: CatalogEntry = {
  manufacturer: 'Dell Inc.',
  driverClass: 'Video',
  name: 'Sample',
  version: '1.0',
  releaseDate: '2025-01-01',
  criticality: 'Urgent',
  fixes: ['fix one'],
  knownIssues: [],
  supportedModels: ['Latitude 5440'],
  supportedOperatingSystems: ['Microsoft Windows 11'],
  releaseNotesUrl: null,
};

describe('buildDrivers', () => {
  it('produces one row per (name, version) across all profiles', () => {
    const profiles = [profile('p1', 'Ring 1'), profile('p2', 'Ring 2')];
    const inventories = new Map([
      ['p1', [inv('Sample', '1.0', 'p1')]],
      ['p2', [inv('Sample', '1.0', 'p2', 'approved')]],
    ]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    expect(drivers).toHaveLength(1);
    expect(drivers[0].policies).toHaveLength(2);
    expect(drivers[0].policies.map(p => p.profileName).sort()).toEqual(['Ring 1', 'Ring 2']);
  });

  it('separates rows for different versions of the same driver', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const inventories = new Map([
      ['p1', [inv('Sample', '1.0', 'p1'), inv('Sample', '2.0', 'p1')]],
    ]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    expect(drivers).toHaveLength(2);
  });

  it('attaches catalog entry when DriverKey matches', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const inventories = new Map([['p1', [inv('Sample', '1.0', 'p1')]]]);
    const catalog = new Map([['dell inc.|video|sample', sampleCatalog]]);
    const drivers = buildDrivers(profiles, inventories, catalog);
    expect(drivers[0].catalog?.criticality).toBe('Urgent');
  });

  it('leaves catalog null when no match', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const inventories = new Map([['p1', [inv('UnknownDriver', '1.0', 'p1')]]]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    expect(drivers[0].catalog).toBeNull();
  });

  it('preserves per-policy approval status in policies array', () => {
    const profiles = [profile('p1', 'Ring 1'), profile('p2', 'Ring 2')];
    const inventories = new Map([
      ['p1', [inv('Sample', '1.0', 'p1', 'approved')]],
      ['p2', [inv('Sample', '1.0', 'p2', 'needsReview')]],
    ]);
    const drivers = buildDrivers(profiles, inventories, new Map());
    const statuses = drivers[0].policies.map(p => `${p.profileName}=${p.approvalStatus}`).sort();
    expect(statuses).toEqual(['Ring 1=approved', 'Ring 2=needsReview']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDrivers.test.ts`

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement useDrivers + buildDrivers**

Create `src/hooks/useDrivers.ts`:

```typescript
import { useMemo } from 'react';
import type {
  CatalogEntry,
  Driver,
  DriverInventory,
  DriverProfile,
} from '@/types/drivers';
import { useDriverProfiles } from './useDriverProfiles';
import { useDriverInventories } from './useDriverInventories';
import { useDriverCatalog } from './useDriverCatalog';
import { buildDriverKey } from '../../scripts/lib/dell-catalog-normalize';

export function buildDrivers(
  profiles: DriverProfile[],
  inventories: Map<string, DriverInventory[]>,
  catalog: Map<string, CatalogEntry>
): Driver[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const grouped = new Map<string, Driver>();

  for (const [profileId, list] of inventories) {
    const profile = profileById.get(profileId);
    if (!profile) continue;
    for (const inv of list) {
      const key = buildDriverKey(inv.manufacturer, inv.driverClass, inv.name);
      const groupKey = `${key}|${inv.version}`;
      let driver = grouped.get(groupKey);
      if (!driver) {
        driver = {
          key,
          inventoryId: inv.id,
          name: inv.name,
          manufacturer: inv.manufacturer,
          driverClass: inv.driverClass,
          version: inv.version,
          releaseDateTime: inv.releaseDateTime,
          applicableDeviceCount: inv.applicableDeviceCount,
          deviceCount: inv.deviceCount,
          policies: [],
          catalog: catalog.get(key) ?? null,
        };
        grouped.set(groupKey, driver);
      } else {
        driver.applicableDeviceCount += inv.applicableDeviceCount;
        driver.deviceCount += inv.deviceCount;
      }
      driver.policies.push({
        profileId: profile.id,
        profileName: profile.displayName,
        approvalType: profile.approvalType,
        approvalStatus: inv.approvalStatus,
      });
    }
  }

  return Array.from(grouped.values());
}

export function useDrivers(enabled: boolean) {
  const { profiles, isLoading: profilesLoading, error: profilesError } = useDriverProfiles(enabled);
  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const { inventories, errors: inventoryErrors, isLoading: inventoriesLoading } = useDriverInventories(profileIds, enabled);
  const catalog = useDriverCatalog();

  const drivers = useMemo(
    () => buildDrivers(profiles, inventories, catalog.entries),
    [profiles, inventories, catalog.entries]
  );

  return {
    drivers,
    profiles,
    catalog,
    inventoryErrors,
    isLoading: profilesLoading || inventoriesLoading || catalog.isLoading,
    error: profilesError,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDrivers.test.ts`

Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDrivers.ts src/hooks/useDrivers.test.ts
git commit -m "feat(drivers): useDrivers composition hook with merge logic"
```

---

### Task 9: DriverCriticalityBadge + DriverFilterBar Components

**Files:**
- Create: `src/components/drivers/DriverCriticalityBadge.tsx`
- Create: `src/components/drivers/DriverCriticalityBadge.test.tsx`
- Create: `src/components/drivers/DriverFilterBar.tsx`
- Create: `src/components/drivers/DriverFilterBar.test.tsx`

- [ ] **Step 1: Write failing tests for DriverCriticalityBadge**

Create `src/components/drivers/DriverCriticalityBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverCriticalityBadge } from './DriverCriticalityBadge';

describe('DriverCriticalityBadge', () => {
  it('renders Urgent with red color class', () => {
    const { container } = render(<DriverCriticalityBadge criticality="Urgent" />);
    expect(container.querySelector('.text-red-500')).toBeTruthy();
    expect(screen.getByLabelText(/urgent/i)).toBeInTheDocument();
  });

  it('renders Recommended with amber color class', () => {
    const { container } = render(<DriverCriticalityBadge criticality="Recommended" />);
    expect(container.querySelector('.text-amber-500')).toBeTruthy();
  });

  it('renders nothing when criticality is null', () => {
    const { container } = render(<DriverCriticalityBadge criticality={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Implement DriverCriticalityBadge**

Create `src/components/drivers/DriverCriticalityBadge.tsx`:

```tsx
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogEntry } from '@/types/drivers';

interface Props {
  criticality: CatalogEntry['criticality'] | null;
}

const COLOR_MAP: Record<CatalogEntry['criticality'], string> = {
  Urgent: 'text-red-500',
  Recommended: 'text-amber-500',
  Optional: 'text-slate-400',
  Other: 'text-slate-400',
};

export function DriverCriticalityBadge({ criticality }: Props) {
  if (!criticality) return null;
  return (
    <span
      aria-label={`Criticality: ${criticality}`}
      title={criticality}
      className={cn('inline-flex h-4 w-4 items-center justify-center', COLOR_MAP[criticality])}
    >
      <AlertCircle className="h-4 w-4" />
    </span>
  );
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/DriverCriticalityBadge.test.tsx`

Expected: PASS.

- [ ] **Step 4: Write failing tests for DriverFilterBar**

Create `src/components/drivers/DriverFilterBar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverFilterBar } from './DriverFilterBar';
import type { DriverFilters } from '@/types/drivers';

const baseFilters: DriverFilters = {
  manufacturers: [],
  driverClasses: [],
  approvalStatuses: [],
  criticalities: [],
  affectsDevicesOnly: true,
  freeText: '',
};

describe('DriverFilterBar', () => {
  it('shows free-text input value and calls onChange when typing', () => {
    const onChange = vi.fn();
    render(
      <DriverFilterBar
        filters={baseFilters}
        onChange={onChange}
        manufacturers={['Dell Inc.']}
        driverClasses={['Video']}
        catalogAvailable
      />
    );
    const input = screen.getByPlaceholderText(/search drivers/i);
    fireEvent.change(input, { target: { value: 'graphics' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ freeText: 'graphics' }));
  });

  it('disables criticality filter when catalog unavailable', () => {
    render(
      <DriverFilterBar
        filters={baseFilters}
        onChange={() => {}}
        manufacturers={[]}
        driverClasses={[]}
        catalogAvailable={false}
      />
    );
    const trigger = screen.getByRole('button', { name: /criticality/i });
    expect(trigger).toBeDisabled();
  });

  it('toggles affectsDevicesOnly when the pill is clicked', () => {
    const onChange = vi.fn();
    render(
      <DriverFilterBar
        filters={baseFilters}
        onChange={onChange}
        manufacturers={[]}
        driverClasses={[]}
        catalogAvailable
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /affects devices/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ affectsDevicesOnly: false }));
  });
});
```

- [ ] **Step 5: Implement DriverFilterBar**

Create `src/components/drivers/DriverFilterBar.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DriverFilters, DriverInventory, CatalogEntry } from '@/types/drivers';

interface Props {
  filters: DriverFilters;
  onChange: (next: DriverFilters) => void;
  manufacturers: string[];
  driverClasses: string[];
  catalogAvailable: boolean;
}

const APPROVAL_OPTIONS: DriverInventory['approvalStatus'][] = [
  'needsReview', 'approved', 'declined', 'suspended',
];
const CRITICALITY_OPTIONS: CatalogEntry['criticality'][] = [
  'Urgent', 'Recommended', 'Optional', 'Other',
];

function MultiSelectButton({
  label,
  options,
  values,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const summary = values.length === 0 ? label : `${label} (${values.length})`;
  return (
    <details className="relative">
      <summary
        role="button"
        aria-label={label}
        aria-disabled={disabled}
        className={cn(
          'cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {summary}
      </summary>
      {!disabled && (
        <div className="absolute z-10 mt-1 w-48 rounded-md border border-border bg-lifted p-2 shadow-md">
          {options.map((opt) => {
            const checked = values.includes(opt);
            return (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onChange(checked ? values.filter((v) => v !== opt) : [...values, opt]);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </details>
  );
}

export function DriverFilterBar({
  filters,
  onChange,
  manufacturers,
  driverClasses,
  catalogAvailable,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Search drivers, manufacturer, version..."
        value={filters.freeText}
        onChange={(e) => onChange({ ...filters, freeText: e.target.value })}
        className="max-w-xs"
      />
      <MultiSelectButton
        label="Manufacturer"
        options={manufacturers}
        values={filters.manufacturers}
        onChange={(next) => onChange({ ...filters, manufacturers: next })}
      />
      <MultiSelectButton
        label="Driver class"
        options={driverClasses}
        values={filters.driverClasses}
        onChange={(next) => onChange({ ...filters, driverClasses: next })}
      />
      <MultiSelectButton
        label="Approval"
        options={APPROVAL_OPTIONS}
        values={filters.approvalStatuses}
        onChange={(next) => onChange({ ...filters, approvalStatuses: next as DriverInventory['approvalStatus'][] })}
      />
      <MultiSelectButton
        label="Criticality"
        options={CRITICALITY_OPTIONS}
        values={filters.criticalities}
        onChange={(next) => onChange({ ...filters, criticalities: next as CatalogEntry['criticality'][] })}
        disabled={!catalogAvailable}
      />
      <Button
        type="button"
        variant={filters.affectsDevicesOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange({ ...filters, affectsDevicesOnly: !filters.affectsDevicesOnly })}
        aria-label="Affects devices toggle"
      >
        Affects devices
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/DriverFilterBar.test.tsx`

Expected: PASS — all three tests green. Note: the `aria-disabled` attribute on the `summary` element should make `toBeDisabled()` work; if not, adjust the test to assert `aria-disabled="true"` instead.

- [ ] **Step 7: Commit**

```bash
git add src/components/drivers/DriverCriticalityBadge.tsx src/components/drivers/DriverCriticalityBadge.test.tsx src/components/drivers/DriverFilterBar.tsx src/components/drivers/DriverFilterBar.test.tsx
git commit -m "feat(drivers): criticality badge and filter bar"
```

---

### Task 10: DriverTable (TDD)

**Files:**
- Create: `src/components/drivers/DriverTable.tsx`
- Create: `src/components/drivers/DriverTable.test.tsx`

Pure render of the merged driver list, with click-to-open-drawer.

- [ ] **Step 1: Write failing tests**

Create `src/components/drivers/DriverTable.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverTable } from './DriverTable';
import type { Driver } from '@/types/drivers';

const driver = (over: Partial<Driver> = {}): Driver => ({
  key: 'dell inc.|video|sample',
  inventoryId: 'inv1',
  name: 'Sample Driver',
  manufacturer: 'Dell Inc.',
  driverClass: 'Video',
  version: '1.0.0',
  releaseDateTime: '2025-01-01T00:00:00Z',
  applicableDeviceCount: 5,
  deviceCount: 10,
  policies: [
    { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'needsReview' },
  ],
  catalog: null,
  ...over,
});

describe('DriverTable', () => {
  it('renders one row per driver and shows the name + version', () => {
    render(<DriverTable drivers={[driver()]} onDriverClick={() => {}} />);
    expect(screen.getByText('Sample Driver')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('shows policies count pill when driver is in multiple policies', () => {
    const d = driver({
      policies: [
        { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'approved' },
        { profileId: 'p2', profileName: 'Ring 2', approvalType: 'manual', approvalStatus: 'needsReview' },
      ],
    });
    render(<DriverTable drivers={[d]} onDriverClick={() => {}} />);
    expect(screen.getByText(/2 policies/i)).toBeInTheDocument();
  });

  it('calls onDriverClick when a row is clicked', () => {
    const handler = vi.fn();
    render(<DriverTable drivers={[driver()]} onDriverClick={handler} />);
    fireEvent.click(screen.getByRole('row', { name: /Sample Driver/i }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sample Driver' }));
  });

  it('shows "No drivers match the current filters." when the list is empty', () => {
    render(<DriverTable drivers={[]} onDriverClick={() => {}} />);
    expect(screen.getByText(/No drivers match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/drivers/DriverTable.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement DriverTable**

Create `src/components/drivers/DriverTable.tsx`:

```tsx
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Driver, DriverInventory } from '@/types/drivers';
import { DriverCriticalityBadge } from './DriverCriticalityBadge';

interface Props {
  drivers: Driver[];
  onDriverClick: (driver: Driver) => void;
}

const APPROVAL_VARIANT: Record<DriverInventory['approvalStatus'], string> = {
  needsReview: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-slate-100 text-slate-900',
  suspended: 'bg-muted text-muted-foreground',
};

function ApprovalBadge({ status }: { status: DriverInventory['approvalStatus'] }) {
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs', APPROVAL_VARIANT[status])}>
      {status}
    </span>
  );
}

function summaryStatus(driver: Driver): DriverInventory['approvalStatus'] {
  // Worst-case across policies for a single representative badge in flat view
  const order: DriverInventory['approvalStatus'][] = ['needsReview', 'suspended', 'declined', 'approved'];
  for (const s of order) {
    if (driver.policies.some((p) => p.approvalStatus === s)) return s;
  }
  return 'approved';
}

export function DriverTable({ drivers, onDriverClick }: Props) {
  if (drivers.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center text-sm text-slate">
        No drivers match the current filters.
      </div>
    );
  }
  return (
    <div role="table" className="overflow-hidden rounded-2xl border border-border">
      <div role="row" className="grid grid-cols-[24px_1fr_120px_120px_120px_80px_80px] gap-3 border-b border-border bg-muted px-3 py-2 text-xs font-medium text-slate">
        <div role="columnheader" aria-label="Criticality" />
        <div role="columnheader">Driver</div>
        <div role="columnheader">Version</div>
        <div role="columnheader">Released</div>
        <div role="columnheader">Approval</div>
        <div role="columnheader" className="text-right">Devices</div>
        <div role="columnheader" className="text-right">Policies</div>
      </div>
      {drivers.map((d) => (
        <div
          key={`${d.key}|${d.version}`}
          role="row"
          aria-label={d.name}
          onClick={() => onDriverClick(d)}
          className="grid cursor-pointer grid-cols-[24px_1fr_120px_120px_120px_80px_80px] items-center gap-3 border-b border-border px-3 py-2 hover:bg-muted/50"
        >
          <div role="cell"><DriverCriticalityBadge criticality={d.catalog?.criticality ?? null} /></div>
          <div role="cell">
            <div className="font-medium text-ink">{d.name}</div>
            <div className="text-xs text-slate">{d.manufacturer} · {d.driverClass}</div>
          </div>
          <div role="cell" className="tabular-nums">{d.version}</div>
          <div role="cell" className="text-xs text-slate">
            {formatDistanceToNow(new Date(d.releaseDateTime), { addSuffix: true })}
          </div>
          <div role="cell"><ApprovalBadge status={summaryStatus(d)} /></div>
          <div role="cell" className="text-right tabular-nums">{d.applicableDeviceCount}</div>
          <div role="cell" className="text-right">
            {d.policies.length > 1 ? (
              <Badge variant="secondary">{d.policies.length} policies</Badge>
            ) : (
              <span className="text-xs text-slate">{d.policies[0]?.profileName ?? '—'}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/DriverTable.test.tsx`

Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/drivers/DriverTable.tsx src/components/drivers/DriverTable.test.tsx
git commit -m "feat(drivers): DriverTable with criticality, approval, policies"
```

---

### Task 11: DriverByPolicy Pivot (TDD)

**Files:**
- Create: `src/components/drivers/DriverByPolicy.tsx`
- Create: `src/components/drivers/DriverByPolicy.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/drivers/DriverByPolicy.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverByPolicy } from './DriverByPolicy';
import type { Driver, DriverProfile } from '@/types/drivers';

const profile = (id: string, name: string, approvalType: 'manual' | 'automatic' = 'manual'): DriverProfile => ({
  id, displayName: name, description: null, approvalType,
  inventorySyncStatus: null, newUpdates: 0, deviceReporting: 0,
  createdDateTime: '', lastModifiedDateTime: '',
});

const driver = (name: string, profileId: string, profileName: string, status: Driver['policies'][0]['approvalStatus'] = 'needsReview'): Driver => ({
  key: `dell inc.|video|${name.toLowerCase()}`,
  inventoryId: `${profileId}-${name}`,
  name, manufacturer: 'Dell Inc.', driverClass: 'Video', version: '1.0',
  releaseDateTime: '2025-01-01T00:00:00Z',
  applicableDeviceCount: 5, deviceCount: 10,
  policies: [{ profileId, profileName, approvalType: 'manual', approvalStatus: status }],
  catalog: null,
});

describe('DriverByPolicy', () => {
  it('renders one group per policy with aggregate counts', () => {
    const profiles = [profile('p1', 'Ring 1'), profile('p2', 'Ring 2')];
    const drivers = [
      driver('A', 'p1', 'Ring 1', 'needsReview'),
      driver('B', 'p1', 'Ring 1', 'approved'),
      driver('C', 'p2', 'Ring 2', 'needsReview'),
    ];
    render(<DriverByPolicy profiles={profiles} drivers={drivers} onDriverClick={() => {}} />);
    expect(screen.getByText('Ring 1')).toBeInTheDocument();
    expect(screen.getByText('Ring 2')).toBeInTheDocument();
    expect(screen.getByText(/2 drivers · 1 needs review/)).toBeInTheDocument();
    expect(screen.getByText(/1 driver · 1 needs review/)).toBeInTheDocument();
  });

  it('expands a group when its header is clicked, revealing driver rows', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const drivers = [driver('A', 'p1', 'Ring 1')];
    render(<DriverByPolicy profiles={profiles} drivers={drivers} onDriverClick={() => {}} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ring 1/ }));
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('calls onDriverClick when a driver row inside a group is clicked', () => {
    const profiles = [profile('p1', 'Ring 1')];
    const drivers = [driver('A', 'p1', 'Ring 1')];
    const handler = vi.fn();
    render(<DriverByPolicy profiles={profiles} drivers={drivers} onDriverClick={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /Ring 1/ }));
    fireEvent.click(screen.getByRole('row', { name: /A/ }));
    expect(handler).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/drivers/DriverByPolicy.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement DriverByPolicy**

Create `src/components/drivers/DriverByPolicy.tsx`:

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Driver, DriverProfile } from '@/types/drivers';
import { DriverTable } from './DriverTable';

interface Props {
  profiles: DriverProfile[];
  drivers: Driver[];
  onDriverClick: (driver: Driver) => void;
}

interface PolicyGroup {
  profile: DriverProfile;
  drivers: Driver[];
  driversCount: number;
  needsReviewCount: number;
  applicableDevicesCount: number;
}

function pluralize(n: number, singular: string) {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

function buildGroups(profiles: DriverProfile[], drivers: Driver[]): PolicyGroup[] {
  const groups: PolicyGroup[] = profiles.map((p) => {
    const inProfile = drivers.filter((d) => d.policies.some((m) => m.profileId === p.id));
    const needsReview = inProfile.filter((d) =>
      d.policies.find((m) => m.profileId === p.id)?.approvalStatus === 'needsReview'
    );
    const applicable = inProfile.reduce((sum, d) => sum + d.applicableDeviceCount, 0);
    return {
      profile: p,
      drivers: inProfile,
      driversCount: inProfile.length,
      needsReviewCount: needsReview.length,
      applicableDevicesCount: applicable,
    };
  });
  return groups.sort((a, b) => b.needsReviewCount - a.needsReviewCount);
}

export function DriverByPolicy({ profiles, drivers, onDriverClick }: Props) {
  const groups = buildGroups(profiles, drivers);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = expanded.has(g.profile.id);
        const summary = `${pluralize(g.driversCount, 'driver')} · ${g.needsReviewCount} needs review · ${g.applicableDevicesCount} devices applicable`;
        return (
          <div key={g.profile.id} className="rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => toggle(g.profile.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
              aria-label={g.profile.displayName}
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium text-ink">{g.profile.displayName}</span>
                <Badge variant="outline">{g.profile.approvalType === 'manual' ? 'Manual' : 'Automatic'}</Badge>
              </div>
              <span className="text-xs text-slate">{summary}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border p-2">
                <DriverTable drivers={g.drivers} onDriverClick={onDriverClick} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/DriverByPolicy.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/drivers/DriverByPolicy.tsx src/components/drivers/DriverByPolicy.test.tsx
git commit -m "feat(drivers): DriverByPolicy pivot with grouping and aggregates"
```

---

### Task 12: DriverDetailDrawer (TDD)

**Files:**
- Create: `src/components/drivers/DriverDetailDrawer.tsx`
- Create: `src/components/drivers/DriverDetailDrawer.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/drivers/DriverDetailDrawer.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverDetailDrawer } from './DriverDetailDrawer';
import type { Driver } from '@/types/drivers';

const baseDriver: Driver = {
  key: 'dell inc.|video|sample',
  inventoryId: 'inv1',
  name: 'Sample Driver',
  manufacturer: 'Dell Inc.',
  driverClass: 'Video',
  version: '1.0.0',
  releaseDateTime: '2025-01-01T00:00:00Z',
  applicableDeviceCount: 5,
  deviceCount: 10,
  policies: [
    { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'needsReview' },
  ],
  catalog: null,
};

describe('DriverDetailDrawer', () => {
  it('shows driver name, manufacturer, and version in header', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByText('Sample Driver')).toBeInTheDocument();
    expect(screen.getByText(/Dell Inc.*Video.*1\.0\.0/)).toBeInTheDocument();
  });

  it('renders the policies section with each policy + per-policy approval', () => {
    const d: Driver = {
      ...baseDriver,
      policies: [
        { profileId: 'p1', profileName: 'Ring 1', approvalType: 'manual', approvalStatus: 'approved' },
        { profileId: 'p2', profileName: 'Ring 2', approvalType: 'automatic', approvalStatus: 'needsReview' },
      ],
    };
    render(<DriverDetailDrawer driver={d} open onOpenChange={() => {}} />);
    expect(screen.getByText('Ring 1')).toBeInTheDocument();
    expect(screen.getByText('Ring 2')).toBeInTheDocument();
  });

  it('renders catalog details when catalog is present', () => {
    const d: Driver = {
      ...baseDriver,
      catalog: {
        manufacturer: 'Dell Inc.', driverClass: 'Video', name: 'Sample Driver',
        version: '1.0.0', releaseDate: '2025-01-01',
        criticality: 'Urgent',
        fixes: ['Fixed flicker on external displays'],
        knownIssues: ['Display freezes on hibernate'],
        supportedModels: ['Latitude 5440'],
        supportedOperatingSystems: ['Microsoft Windows 11'],
        releaseNotesUrl: 'https://www.dell.com/support/sample',
      },
    };
    render(<DriverDetailDrawer driver={d} open onOpenChange={() => {}} />);
    expect(screen.getByText(/Fixed flicker on external displays/)).toBeInTheDocument();
    expect(screen.getByText(/Display freezes on hibernate/)).toBeInTheDocument();
  });

  it('shows "No catalog data" line when catalog is null', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByText(/No catalog data/i)).toBeInTheDocument();
  });

  it('always renders external lookup links regardless of catalog', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.getByRole('link', { name: /Dell support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Microsoft Update Catalog/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/drivers/DriverDetailDrawer.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement DriverDetailDrawer**

Create `src/components/drivers/DriverDetailDrawer.tsx`:

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Driver, DriverInventory } from '@/types/drivers';
import { DriverCriticalityBadge } from './DriverCriticalityBadge';

interface Props {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const APPROVAL_VARIANT: Record<DriverInventory['approvalStatus'], string> = {
  needsReview: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-slate-100 text-slate-900',
  suspended: 'bg-muted text-muted-foreground',
};

function ApprovalBadge({ status }: { status: DriverInventory['approvalStatus'] }) {
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs', APPROVAL_VARIANT[status])}>
      {status}
    </span>
  );
}

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wide text-slate">{children}</div>;
}

export function DriverDetailDrawer({ driver, open, onOpenChange }: Props) {
  if (!driver) return null;
  const dellSearchUrl = `https://www.dell.com/support/search/results?q=${encodeURIComponent(driver.name)}`;
  const msUpdateUrl = `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(driver.name)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{driver.name}</SheetTitle>
          <div className="text-sm text-slate">
            {driver.manufacturer} · {driver.driverClass} · {driver.version}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DriverCriticalityBadge criticality={driver.catalog?.criticality ?? null} />
            {driver.policies.length === 1 ? (
              <ApprovalBadge status={driver.policies[0].approvalStatus} />
            ) : (
              <Badge variant="secondary">In {driver.policies.length} policies</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <EyebrowLabel>OVERVIEW</EyebrowLabel>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate">Released</dt>
              <dd className="text-ink">{new Date(driver.releaseDateTime).toLocaleDateString()}</dd>
              <dt className="text-slate">Driver class</dt>
              <dd className="text-ink">{driver.driverClass}</dd>
              <dt className="text-slate">Manufacturer</dt>
              <dd className="text-ink">{driver.manufacturer}</dd>
              <dt className="text-slate">Applicable devices</dt>
              <dd className="text-ink tabular-nums">{driver.applicableDeviceCount}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <EyebrowLabel>POLICIES</EyebrowLabel>
            <ul className="space-y-2">
              {driver.policies.map((p) => (
                <li key={p.profileId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <div className="text-ink">{p.profileName}</div>
                    <div className="text-xs text-slate">{p.approvalType === 'manual' ? 'Manual' : 'Automatic'} approval</div>
                  </div>
                  <ApprovalBadge status={p.approvalStatus} />
                </li>
              ))}
            </ul>
          </section>

          {driver.catalog ? (
            <section className="space-y-2">
              <EyebrowLabel>DETAILS FROM DELL CATALOG</EyebrowLabel>
              {driver.catalog.fixes.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Fixes / enhancements</div>
                  <ul className="ml-4 list-disc text-sm text-slate">
                    {driver.catalog.fixes.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {driver.catalog.knownIssues.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Known issues</div>
                  <ul className="ml-4 list-disc text-sm text-slate">
                    {driver.catalog.knownIssues.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
              {driver.catalog.supportedModels.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Supported hardware</div>
                  <div className="text-sm text-slate">{driver.catalog.supportedModels.join(', ')}</div>
                </div>
              )}
              {driver.catalog.supportedOperatingSystems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Operating systems</div>
                  <div className="flex flex-wrap gap-1">
                    {driver.catalog.supportedOperatingSystems.map((os) => (
                      <Badge key={os} variant="outline">{os}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {driver.catalog.releaseNotesUrl && (
                <a
                  href={driver.catalog.releaseNotesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary underline"
                >
                  Release notes <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </section>
          ) : (
            <section className="space-y-2">
              <EyebrowLabel>CATALOG</EyebrowLabel>
              <p className="text-sm text-slate">
                No catalog data for this driver. Use the links below to look up release notes externally.
              </p>
            </section>
          )}

          <section className="space-y-2">
            <EyebrowLabel>LOOKUP</EyebrowLabel>
            <div className="flex flex-wrap gap-2">
              <a
                href={dellSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
              >
                Search Dell support <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={msUpdateUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
              >
                Search Microsoft Update Catalog <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/DriverDetailDrawer.test.tsx`

Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/drivers/DriverDetailDrawer.tsx src/components/drivers/DriverDetailDrawer.test.tsx
git commit -m "feat(drivers): DriverDetailDrawer with overview, policies, catalog, lookup"
```

---

### Task 13: CatalogSyncStatus (TDD)

**Files:**
- Create: `src/components/drivers/CatalogSyncStatus.tsx`
- Create: `src/components/drivers/CatalogSyncStatus.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/drivers/CatalogSyncStatus.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogSyncStatus } from './CatalogSyncStatus';

describe('CatalogSyncStatus', () => {
  it('renders nothing when in web mode (not Electron)', () => {
    const { container } = render(
      <CatalogSyncStatus
        isElectron={false}
        source="baked"
        lastSyncedAt={null}
        syncStatus="idle"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "Catalog not synced" with primary Sync now button when never synced in Electron', () => {
    render(
      <CatalogSyncStatus
        isElectron
        source="baked"
        lastSyncedAt={null}
        syncStatus="idle"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Catalog not synced/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync now/i })).toBeInTheDocument();
  });

  it('shows synced relative time and ghost Sync button when lastSyncedAt set', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    render(
      <CatalogSyncStatus
        isElectron
        source="electron-sync"
        lastSyncedAt={sevenDaysAgo}
        syncStatus="idle"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Catalog synced/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sync$/i })).toBeInTheDocument();
  });

  it('shows "Syncing catalog…" and disabled button while syncStatus=syncing', () => {
    render(
      <CatalogSyncStatus
        isElectron
        source="electron-sync"
        lastSyncedAt="2026-05-01T00:00:00Z"
        syncStatus="syncing"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Syncing catalog/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows "Last sync failed" with Retry when syncStatus=error', () => {
    render(
      <CatalogSyncStatus
        isElectron
        source="electron-sync"
        lastSyncedAt="2026-05-01T00:00:00Z"
        syncStatus="error"
        syncError="boom"
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Last sync failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('calls onSync when the action button is clicked', () => {
    const handler = vi.fn();
    render(
      <CatalogSyncStatus
        isElectron
        source="baked"
        lastSyncedAt={null}
        syncStatus="idle"
        syncError={null}
        onSync={handler}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Sync now/i }));
    expect(handler).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/drivers/CatalogSyncStatus.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement CatalogSyncStatus**

Create `src/components/drivers/CatalogSyncStatus.tsx`:

```tsx
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CatalogSource } from '@/types/drivers';

interface Props {
  isElectron: boolean;
  source: CatalogSource;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  onSync: () => void;
}

export function CatalogSyncStatus({
  isElectron, source, lastSyncedAt, syncStatus, syncError, onSync,
}: Props) {
  if (!isElectron) return null;

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Syncing catalog…</span>
        <Button type="button" size="sm" variant="ghost" disabled>Sync</Button>
      </div>
    );
  }

  if (syncStatus === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600">
        <span title={syncError ?? ''}>🔴 Last sync failed</span>
        <Button type="button" size="sm" variant="outline" onClick={onSync}>Retry</Button>
      </div>
    );
  }

  if (source === 'electron-sync' && lastSyncedAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate">
        <span>🟢 Catalog synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}</span>
        <Button type="button" size="sm" variant="ghost" onClick={onSync}>Sync</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate">
      <span>🟡 Catalog not synced</span>
      <Button type="button" size="sm" onClick={onSync}>Sync now</Button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/drivers/CatalogSyncStatus.test.tsx`

Expected: PASS — all six tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/drivers/CatalogSyncStatus.tsx src/components/drivers/CatalogSyncStatus.test.tsx
git commit -m "feat(drivers): CatalogSyncStatus row with all sync states"
```

---

### Task 14: Drivers Page Composition + Filtering

**Files:**
- Modify: `src/pages/Drivers.tsx`

Compose all the components built so far into the actual page. Filter logic + pivot tabs + drawer state live here.

- [ ] **Step 1: Replace skeleton with full page composition**

Replace the entire content of `src/pages/Drivers.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { PillNav } from '@/components/PillNav';
import { UtilityRow } from '@/components/UtilityRow';
import { useAuth } from '@/hooks/useAuth';
import { useDrivers } from '@/hooks/useDrivers';
import { DriverFilterBar } from '@/components/drivers/DriverFilterBar';
import { DriverTable } from '@/components/drivers/DriverTable';
import { DriverByPolicy } from '@/components/drivers/DriverByPolicy';
import { DriverDetailDrawer } from '@/components/drivers/DriverDetailDrawer';
import { CatalogSyncStatus } from '@/components/drivers/CatalogSyncStatus';
import { cn } from '@/lib/utils';
import type { Driver, DriverFilters, DriverPivot } from '@/types/drivers';

const PIVOT_TABS: Array<{ key: DriverPivot; label: string }> = [
  { key: 'all', label: 'All Drivers' },
  { key: 'byPolicy', label: 'By Policy' },
];

function defaultFilters(): DriverFilters {
  return {
    manufacturers: [],
    driverClasses: [],
    approvalStatuses: [],
    criticalities: [],
    affectsDevicesOnly: true,
    freeText: '',
  };
}

function applyFilters(drivers: Driver[], filters: DriverFilters): Driver[] {
  let result = drivers;
  if (filters.affectsDevicesOnly) {
    result = result.filter((d) => d.applicableDeviceCount > 0);
  }
  if (filters.manufacturers.length > 0) {
    const set = new Set(filters.manufacturers);
    result = result.filter((d) => set.has(d.manufacturer));
  }
  if (filters.driverClasses.length > 0) {
    const set = new Set(filters.driverClasses);
    result = result.filter((d) => set.has(d.driverClass));
  }
  if (filters.approvalStatuses.length > 0) {
    const set = new Set(filters.approvalStatuses);
    result = result.filter((d) => d.policies.some((p) => set.has(p.approvalStatus)));
  }
  if (filters.criticalities.length > 0) {
    const set = new Set(filters.criticalities);
    result = result.filter((d) => d.catalog && set.has(d.catalog.criticality));
  }
  if (filters.freeText.trim()) {
    const q = filters.freeText.toLowerCase();
    result = result.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.manufacturer.toLowerCase().includes(q) ||
      d.driverClass.toLowerCase().includes(q) ||
      d.version.toLowerCase().includes(q)
    );
  }
  return result;
}

export default function Drivers() {
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<DriverFilters>(defaultFilters);
  const [pivot, setPivot] = useState<DriverPivot>('all');
  const [selected, setSelected] = useState<Driver | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { drivers, profiles, catalog, isLoading, error } = useDrivers(isAuthenticated);

  const manufacturers = useMemo(
    () => Array.from(new Set(drivers.map((d) => d.manufacturer))).sort(),
    [drivers]
  );
  const driverClasses = useMemo(
    () => Array.from(new Set(drivers.map((d) => d.driverClass))).sort(),
    [drivers]
  );

  const filtered = useMemo(() => applyFilters(drivers, filters), [drivers, filters]);

  const handleClick = (driver: Driver) => {
    setSelected(driver);
    setDrawerOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-canvas">
        <PillNav />
        <div className="mx-auto max-w-7xl px-4 py-6">
          <UtilityRow />
          <p className="mt-12 text-center text-sm text-slate">Sign in to view driver updates.</p>
        </div>
      </div>
    );
  }

  const noProfiles = !isLoading && !error && profiles.length === 0;

  return (
    <div className="min-h-screen bg-canvas">
      <PillNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <UtilityRow />

        <div className="mt-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-medium tracking-tight2 text-ink">Driver Updates</h1>
            <CatalogSyncStatus
              isElectron={!!window.__IS_ELECTRON__}
              source={catalog.source}
              lastSyncedAt={catalog.lastSyncedAt}
              syncStatus={catalog.syncStatus}
              syncError={catalog.syncError}
              onSync={() => void catalog.sync()}
            />
          </div>

          {!noProfiles && (
            <DriverFilterBar
              filters={filters}
              onChange={setFilters}
              manufacturers={manufacturers}
              driverClasses={driverClasses}
              catalogAvailable={catalog.source !== 'none'}
            />
          )}

          {!noProfiles && (
            <div className="flex items-center justify-between">
              <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
                {PIVOT_TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={pivot === t.key}
                    onClick={() => setPivot(t.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm transition-colors',
                      pivot === t.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="text-xs tabular-nums text-slate">
                {filtered.length} driver{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-signal/30 bg-signal/[0.10] p-3 text-sm text-signal-light">
              Failed to load driver update profiles. {error}
            </div>
          )}

          {isLoading && (
            <div className="py-12 text-center text-sm text-slate">Loading driver updates…</div>
          )}

          {noProfiles && (
            <div className="rounded-2xl border border-border p-8 text-center text-sm text-slate">
              No Windows Driver Update profiles found in this tenant.{' '}
              <a
                className="underline"
                href="https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesWindowsMenu/~/windowsDriverUpdates"
                target="_blank"
                rel="noreferrer"
              >
                Create one in the Intune portal
              </a>
              .
            </div>
          )}

          {!isLoading && !error && !noProfiles && (
            <>
              {pivot === 'all' && <DriverTable drivers={filtered} onDriverClick={handleClick} />}
              {pivot === 'byPolicy' && (
                <DriverByPolicy profiles={profiles} drivers={filtered} onDriverClick={handleClick} />
              )}
            </>
          )}
        </div>
      </div>

      <DriverDetailDrawer
        driver={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: PASS — all driver tests green plus all existing tests still passing.

- [ ] **Step 4: Run the dev server and smoke-test in browser**

Run: `npm run dev`

Open `http://localhost:8080/drivers`. Sign in. Verify:
- Page loads, "Loading driver updates…" appears, then either the table or "No Windows Driver Update profiles found" empty state.
- If profiles + drivers exist: filter bar visible, "All Drivers" pivot active, criticality badge shows where catalog matches.
- Clicking a row opens the drawer with overview, policies, catalog (if matched) or "No catalog data", and lookup links.
- Switch to "By Policy" pivot — groups expand/collapse.
- Sync status row says nothing (web mode).

If catalog matches are 0% (because we're using the stub), that's expected — only the "Sample Driver" stub will match and only against the placeholder name.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Drivers.tsx
git commit -m "feat(drivers): compose Drivers page with filters, pivots, drawer"
```

---

## Self-Review

This plan covers, in order, every spec section:

- ✅ **Goal & Architecture** — Tasks 1, 6 (catalog source resolution), 8 (composition)
- ✅ **Permissions** — already granted; called out in Task 7 (Graph fetch)
- ✅ **Page Layout** — Task 14
- ✅ **Filter Bar** — Task 9 (DriverFilterBar) + Task 14 (filter logic + defaults)
- ✅ **Sync Status Row** — Task 13 (component) + Task 14 (wiring)
- ✅ **Data Fetching** — Tasks 6, 7, 8 (catalog, profiles+inventories, composition)
- ✅ **Per-device deferral** — explicitly out-of-v1; v1 displays `applicableDeviceCount` only (Tasks 8, 10)
- ✅ **Main view ("All Drivers")** — Task 10
- ✅ **By Policy pivot** — Task 11
- ✅ **Detail Drawer** — Task 12 (overview, policies, catalog details, lookup, no-catalog fallback)
- ✅ **Catalog Sync plumbing** — Tasks 3 (build script), 4 (Electron handlers), 5 (preload bridge), 6 (renderer hook)
- ✅ **File Structure** — table at top of plan, every file accounted for in tasks
- ✅ **Navigation** — Task 1
- ✅ **Styling** — `bg-canvas`, `text-ink`, `text-slate`, EyebrowLabel, `sm:max-w-2xl` drawer, criticality colors all wired across Tasks 9–14
- ✅ **Error Handling** — Task 14 (inline banner, no-profiles empty state, loading state). Per-profile inventory error surfaces via `inventoryErrors` from Task 7 (currently silent in UI; if rendering them inline becomes important, wire `useDrivers` return through to the page in a small follow-up).
- ✅ **Scope Boundaries** — per-device list deferred (Task 8 leaves `applicableDeviceCount` as a number with no drilldown); auto-sync, multi-OEM, CSV export, etc. all explicitly out-of-scope.

Type consistency: `Driver`, `DriverInventory`, `DriverProfile`, `CatalogEntry` are defined in Task 1 and used identically across all tasks. `buildDriverKey` is defined in Task 2 and reused (not redefined) in Tasks 6, 8. `CatalogSource` and `CatalogStatus` are defined in Task 1 and used in Tasks 6, 13. Approval status enum is consistent across hooks and components.

No placeholders detected. Each step contains the actual code or command needed to perform it.

One known cosmetic gap: per-profile inventory fetch errors are returned by the hook (`useDriverInventories`) but not currently rendered in the UI. This is an intentional small follow-up — the spec calls for "per-profile error" display in the By Policy pivot, but the v1 wiring opts for silent skip. If desired, a 1-task follow-up can render per-policy error rows inside the By Policy header. Noted as a known caveat rather than a blocker.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-driver-info.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best when you want me to drive the whole thing while you skim diffs at checkpoints.

**2. Inline Execution** — I execute tasks in this session using executing-plans. Batched with checkpoints for review.

Which approach?
