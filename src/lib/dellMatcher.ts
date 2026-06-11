import type { CatalogEntry } from '@/types/drivers';

export interface DriverMatchInput {
  manufacturer: string;
  driverClass: string;
  version: string;
  name: string;
}

function familyOf(manufacturer: string): string {
  return manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] ?? '';
}

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t.length > 2));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export type DellMatcher = (driver: DriverMatchInput) => CatalogEntry | null;

export function createDellMatcher(entries: CatalogEntry[]): DellMatcher {
  // Version is the most selective key; index Dell entries by it.
  const byVersion = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    if (familyOf(e.manufacturer) !== 'dell' || !e.version) continue;
    const v = e.version.trim();
    const list = byVersion.get(v) ?? [];
    list.push(e);
    byVersion.set(v, list);
  }

  return (driver) => {
    if (familyOf(driver.manufacturer) !== 'dell') return null;
    const candidates = byVersion.get(driver.version.trim());
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const dClass = driver.driverClass.toLowerCase();
    const dTokens = tokens(driver.name);
    const scored = candidates
      .map((e) => ({ e, score: (e.driverClass.toLowerCase() === dClass ? 2 : 0) + overlap(dTokens, tokens(e.name)) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0].score > scored[1].score) return scored[0].e;
    return null; // ambiguous → no confident match
  };
}
