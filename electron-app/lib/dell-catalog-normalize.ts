// IMPORTANT: This file must stay in sync with `scripts/lib/dell-catalog-normalize.ts`.
// The duplicate exists to satisfy electron-app's tsc rootDir without widening it (which
// would shift the dist-electron/ output layout). Any change here MUST be mirrored there
// (and vice versa). The type below mirrors `CatalogEntry` in `src/types/drivers.ts`.

interface CatalogEntry {
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
    Brand?: { Model?: unknown } | { Model?: unknown }[];
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
