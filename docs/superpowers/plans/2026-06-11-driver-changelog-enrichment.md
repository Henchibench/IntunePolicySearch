# Driver Changelog Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "what a driver fixes / changelog" on the Drivers page — universal Microsoft Update Catalog links for every driver, plus structured fix/known-issue data from Dell's catalog where it can be matched.

**Architecture:** Two pure functions feed the existing drawer. `buildDriverLinks` always returns precise lookup links (Microsoft Update Catalog + vendor). `createDellMatcher` replaces today's exact-name catalog join with a fuzzy (family + version + name-token) match, populating `Driver.catalog`. A Phase 0 spike measures the Dell hit rate before we trust the matcher. Web ships a locally-baked catalog JSON; Electron syncs live.

**Tech Stack:** React + TypeScript, Vite, Vitest, Microsoft Graph, Dell `CatalogPC.cab` (XML), `fast-xml-parser`, `tsx`.

**Spec:** `docs/superpowers/specs/2026-06-11-driver-changelog-enrichment-design.md`

---

## File Structure

- Create `src/lib/driverLinks.ts` — pure: `buildDriverLinks(driver) -> DriverLink[]`. Owns lookup-URL construction.
- Create `src/lib/driverLinks.test.ts`.
- Create `src/lib/dellMatcher.ts` — pure: `createDellMatcher(entries) -> (driver) => CatalogEntry | null`. Owns the fuzzy Dell join.
- Create `src/lib/dellMatcher.test.ts`.
- Create `scripts/measure-dell-catalog-hitrate.ts` — one-off diagnostic (Phase 0). Not shipped, not a committed test.
- Modify `src/types/drivers.ts` — add `DriverLink`.
- Modify `src/hooks/useDrivers.ts` — replace exact `catalog.get(key)` with `createDellMatcher`.
- Modify `src/components/drivers/DriverDetailDrawer.tsx` — fallback chain; use `buildDriverLinks`; remove the "No catalog data" dead end.
- Modify `src/components/drivers/DriverDetailDrawer.test.tsx` — update the removed-text test.
- Modify `public/driver-catalog.json` — replace the stub with a real baked Dell catalog (Task 5).

Notes for the engineer:
- This repo's tests flake under CPU load (WSL on `/mnt/c`). If `vitest run` reports "Failed to start ... worker", re-run with `--pool=threads`, or `--no-file-parallelism` for a fully serial, stable run. These are infra retries, not test failures.
- Always run vitest via `export PATH="$HOME/.local/node/bin:$PATH"` first (Linux Node lives there).
- `@/` is the Vite alias for `src/`.

---

## Task 0: Phase 0 — measure the Dell catalog hit rate (orchestrator-run)

This gates how much matcher complexity is justified. Run before trusting Task 2's output. Requires a real Dell catalog and a snapshot of the live driver inventory.

**Files:**
- Create: `scripts/measure-dell-catalog-hitrate.ts`
- Uses: `public/driver-catalog.json` (real, from `npm run fetch-catalog`), `scripts/fixtures/driver-inventory-snapshot.json` (captured from the running app, gitignored)

- [ ] **Step 1: Capture a driver inventory snapshot.** In the running app (signed in), open DevTools / use the existing Playwright session, capture the JSON responses from
  `GET /beta/deviceManagement/windowsDriverUpdateProfiles/<id>/driverInventories` for each profile, concatenate their `.value` arrays, and save to `scripts/fixtures/driver-inventory-snapshot.json`. Add `scripts/fixtures/` to `.gitignore`.

- [ ] **Step 2: Bake the real Dell catalog.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npm run fetch-catalog`
Expected: `public/driver-catalog.json` and `public/driver-catalog.meta.json` rewritten with thousands of entries.
If `expand.exe` is unavailable (ENOENT), fall back to the Electron app's "Sync catalog" path and copy `<userData>/driver-catalog/dell.json` to `public/driver-catalog.json` (documented in `fetch-driver-catalog.ts`).

- [ ] **Step 3: Write the spike script.**

```ts
// scripts/measure-dell-catalog-hitrate.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDellMatcher } from '../src/lib/dellMatcher';
import type { CatalogEntry } from '../src/types/drivers';

const catalog: CatalogEntry[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'driver-catalog.json'), 'utf8')
);
const inventory: Array<{ manufacturer: string; driverClass: string; version: string; name: string }> =
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'driver-inventory-snapshot.json'), 'utf8'));

const match = createDellMatcher(catalog);
let matched = 0, dellTotal = 0;
const examples: string[] = [];
for (const d of inventory) {
  const isDell = d.manufacturer.toLowerCase().includes('dell');
  if (isDell) dellTotal++;
  const hit = match(d);
  if (hit) { matched++; if (examples.length < 10) examples.push(`MATCH  ${d.name} -> ${hit.name}`); }
  else if (isDell && examples.length < 10) examples.push(`MISS   ${d.name} (v${d.version}, ${d.driverClass})`);
}
console.log(`Dell drivers: ${dellTotal} / ${inventory.length} total`);
console.log(`Matched: ${matched} (${dellTotal ? Math.round((matched / dellTotal) * 100) : 0}% of Dell)`);
console.log(examples.join('\n'));
```

- [ ] **Step 4: Run the spike** (after Task 2's `dellMatcher.ts` exists).

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx tsx scripts/measure-dell-catalog-hitrate.ts`
Expected: a hit-rate report. If `@/`-alias imports fail under tsx, temporarily switch `dellMatcher.ts`'s `@/types/drivers` import to the relative `../types/drivers` for the run, or run through a throwaway vitest file.

- [ ] **Step 5: Decision gate (no commit).**
  - Hit rate **acceptable** (rough bar: ≥ ~30% of Dell drivers, the orchestrator judges) → keep the matcher as built in Task 2.
  - Hit rate **poor** → leave the matcher in place (harmless; returns null), but do not invest further tuning. The universal links (Task 1/4) carry the feature. Record the finding in the spec's Risks section.

---

## Task 1: `buildDriverLinks` — universal lookup links

**Files:**
- Modify: `src/types/drivers.ts` (add `DriverLink`)
- Create: `src/lib/driverLinks.ts`
- Test: `src/lib/driverLinks.test.ts`

- [ ] **Step 1: Add the type.** Append to `src/types/drivers.ts`:

```ts
/** A link out to find a driver's release notes / changelog */
export interface DriverLink {
  label: string;
  url: string;
}
```

- [ ] **Step 2: Write the failing test.** Create `src/lib/driverLinks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDriverLinks } from './driverLinks';

describe('buildDriverLinks', () => {
  it('always includes a Microsoft Update Catalog search with name + version', () => {
    const links = buildDriverLinks({ name: 'Realtek MEDIA Driver Update', version: '6.0.9835.3', manufacturer: 'Realtek Semiconductor Corp.' });
    const mu = links.find((l) => l.label === 'Microsoft Update Catalog');
    expect(mu).toBeDefined();
    expect(mu!.url).toContain('catalog.update.microsoft.com/Search.aspx?q=');
    expect(mu!.url).toContain(encodeURIComponent('Realtek MEDIA Driver Update 6.0.9835.3'));
  });

  it('adds a Dell support link for Dell drivers', () => {
    const links = buildDriverLinks({ name: 'Dell, Inc. Firmware Driver Update', version: '0.1.38.2', manufacturer: 'Dell, Inc.' });
    expect(links.some((l) => l.label === 'Search Dell support' && l.url.includes('dell.com/support/search'))).toBe(true);
  });

  it('adds an Intel link for Intel drivers', () => {
    const links = buildDriverLinks({ name: 'Intel HIDClass', version: '2.2.2.17', manufacturer: 'Intel(R) Corporation' });
    expect(links.some((l) => l.label === 'Search Intel downloads' && l.url.includes('intel.com'))).toBe(true);
  });

  it('returns only the Microsoft link for vendors without a known site', () => {
    const links = buildDriverLinks({ name: 'Realtek MEDIA', version: '6.0.9835.3', manufacturer: 'Realtek Semiconductor Corp.' });
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe('Microsoft Update Catalog');
  });
});
```

- [ ] **Step 3: Run it, verify it fails.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/lib/driverLinks.test.ts --pool=threads`
Expected: FAIL — `buildDriverLinks` not found.

- [ ] **Step 4: Implement.** Create `src/lib/driverLinks.ts`:

```ts
import type { DriverLink } from '@/types/drivers';

interface DriverLinkInput {
  name: string;
  version: string;
  manufacturer: string;
}

function familyOf(manufacturer: string): string {
  return manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] ?? '';
}

function vendorLink(manufacturer: string, query: string): DriverLink | null {
  const q = encodeURIComponent(query);
  switch (familyOf(manufacturer)) {
    case 'dell':
      return { label: 'Search Dell support', url: `https://www.dell.com/support/search/results?q=${q}` };
    case 'intel':
      return { label: 'Search Intel downloads', url: `https://www.intel.com/content/www/us/en/search.html?ws=text#q=${q}` };
    default:
      return null;
  }
}

export function buildDriverLinks(driver: DriverLinkInput): DriverLink[] {
  const query = `${driver.name} ${driver.version}`.trim();
  const links: DriverLink[] = [
    {
      label: 'Microsoft Update Catalog',
      url: `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(query)}`,
    },
  ];
  const vendor = vendorLink(driver.manufacturer, query);
  if (vendor) links.push(vendor);
  return links;
}
```

- [ ] **Step 5: Run it, verify it passes.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/lib/driverLinks.test.ts --pool=threads`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit.**

```bash
git add src/types/drivers.ts src/lib/driverLinks.ts src/lib/driverLinks.test.ts
git commit -m "feat(drivers): buildDriverLinks for universal release-note lookups"
```

---

## Task 2: `createDellMatcher` — fuzzy Dell catalog join

**Files:**
- Create: `src/lib/dellMatcher.ts`
- Test: `src/lib/dellMatcher.test.ts`

- [ ] **Step 1: Write the failing test.** Create `src/lib/dellMatcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDellMatcher } from './dellMatcher';
import type { CatalogEntry } from '@/types/drivers';

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  manufacturer: 'Dell Inc.', driverClass: 'Firmware', name: 'Dell Firmware', version: '0.1.38.2',
  releaseDate: null, criticality: 'Recommended', fixes: [], knownIssues: [],
  supportedModels: [], supportedOperatingSystems: [], releaseNotesUrl: null, ...over,
});

const driver = (over: Partial<{ manufacturer: string; driverClass: string; version: string; name: string }> = {}) => ({
  manufacturer: 'Dell, Inc.', driverClass: 'Firmware', version: '0.1.38.2', name: 'Dell, Inc. Firmware Driver Update (0.1.38.2)', ...over,
});

describe('createDellMatcher', () => {
  it('matches a unique Dell entry on version', () => {
    const match = createDellMatcher([entry({ name: 'Dell TPM Firmware' })]);
    expect(match(driver())?.name).toBe('Dell TPM Firmware');
  });

  it('returns null when no version matches', () => {
    const match = createDellMatcher([entry({ version: '9.9.9.9' })]);
    expect(match(driver())).toBeNull();
  });

  it('returns null for non-Dell manufacturers', () => {
    const match = createDellMatcher([entry()]);
    expect(match(driver({ manufacturer: 'Intel(R) Corporation' }))).toBeNull();
  });

  it('disambiguates same-version entries by class + name-token overlap', () => {
    const match = createDellMatcher([
      entry({ name: 'Dell Audio Realtek', driverClass: 'Audio' }),
      entry({ name: 'Dell TPM Firmware Update', driverClass: 'Firmware' }),
    ]);
    expect(match(driver({ name: 'Dell TPM Firmware Update', driverClass: 'Firmware' }))?.name).toBe('Dell TPM Firmware Update');
  });

  it('returns null when same-version candidates tie (not confident)', () => {
    const match = createDellMatcher([
      entry({ name: 'Dell Component A', driverClass: 'Firmware' }),
      entry({ name: 'Dell Component B', driverClass: 'Firmware' }),
    ]);
    expect(match(driver({ name: 'Dell, Inc. Firmware Driver Update (0.1.38.2)' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/lib/dellMatcher.test.ts --pool=threads`
Expected: FAIL — `createDellMatcher` not found.

- [ ] **Step 3: Implement.** Create `src/lib/dellMatcher.ts`:

```ts
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

    if (scored[0].score > 0 && scored[0].score > scored[1].score) return scored[0].e;
    return null; // ambiguous → no confident match
  };
}
```

- [ ] **Step 4: Run it, verify it passes.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/lib/dellMatcher.test.ts --pool=threads`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/dellMatcher.ts src/lib/dellMatcher.test.ts
git commit -m "feat(drivers): createDellMatcher fuzzy catalog join (family+version+tokens)"
```

---

## Task 3: Wire the matcher into `useDrivers`

**Files:**
- Modify: `src/hooks/useDrivers.ts`

- [ ] **Step 1: No test edit needed — confirm why.** `src/hooks/useDrivers.test.ts` has two catalog tests. `attaches catalog entry when DriverKey matches` uses inventory `{manufacturer: 'Dell Inc.', driverClass: 'Video', version: '1.0', name: 'Sample'}` and a catalog whose only entry is `sampleCatalog` (`manufacturer: 'Dell Inc.'`, `version: '1.0'`). The new matcher indexes that entry by version `1.0`, finds it as the unique candidate, and returns it — so `drivers[0].catalog?.criticality === 'Urgent'` still holds. `leaves catalog null when no match` passes an empty catalog Map, so the matcher returns null. Both pass unchanged. Do not edit the test file.

- [ ] **Step 2: Run the existing hook tests to confirm the green baseline before changing code.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/hooks/useDrivers.test.ts --pool=threads`
Expected: PASS (current exact-join implementation).

- [ ] **Step 3: Replace the exact join.** In `src/hooks/useDrivers.ts`:
  - Add import: `import { createDellMatcher } from '@/lib/dellMatcher';`
  - At the top of `buildDrivers`, after `const grouped = ...`, add: `const matchDell = createDellMatcher([...catalog.values()]);`
  - Replace the driver-creation field `catalog: catalog.get(key) ?? null,` with:
    `catalog: matchDell({ manufacturer: inv.manufacturer, driverClass: inv.driverClass, version: inv.version, name: inv.name }),`
  - Leave the `buildDriverKey` import and `key`/`groupKey` grouping untouched (still used for grouping).

- [ ] **Step 4: Run hook tests + typecheck.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/hooks/useDrivers.test.ts --pool=threads && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c "error TS"`
Expected: tests PASS; tsc error count unchanged from baseline (16).

- [ ] **Step 5: Commit.**

```bash
git add src/hooks/useDrivers.ts
git commit -m "feat(drivers): join catalog via fuzzy Dell matcher instead of exact name"
```

---

## Task 4: Drawer fallback chain — structured data, then links, no dead end

**Files:**
- Modify: `src/components/drivers/DriverDetailDrawer.tsx`
- Test: `src/components/drivers/DriverDetailDrawer.test.tsx`

- [ ] **Step 1: Update the tests.** In `src/components/drivers/DriverDetailDrawer.test.tsx`:
  - Replace the test `shows "No catalog data" line when catalog is null` with:

```ts
  it('shows a Find release notes block with Microsoft Update Catalog when no catalog match', () => {
    render(<DriverDetailDrawer driver={baseDriver} open onOpenChange={() => {}} />);
    expect(screen.queryByText(/No catalog data/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Find release notes/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Microsoft Update Catalog/i })).toBeInTheDocument();
  });
```

  - The existing `always renders external lookup links regardless of catalog` test stays valid (`baseDriver.manufacturer` is `Dell Inc.`, so both the Dell support and Microsoft Update Catalog links render). Leave it.

- [ ] **Step 2: Run the drawer tests to verify the new one fails.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/components/drivers/DriverDetailDrawer.test.tsx --pool=threads`
Expected: FAIL on the new test (text "Find release notes" not present yet).

- [ ] **Step 3: Implement the drawer changes.** In `src/components/drivers/DriverDetailDrawer.tsx`:
  - Add import: `import { buildDriverLinks } from '@/lib/driverLinks';`
  - Remove the two consts `dellSearchUrl` and `msUpdateUrl`.
  - After `if (!driver) return null;` add: `const links = buildDriverLinks(driver);`
  - Delete the entire `) : (` else-branch that renders the `EyebrowLabel>CATALOG` + "No catalog data" `<section>` (so the structured catalog `<section>` renders only when `driver.catalog` is truthy — change the `{driver.catalog ? ( ... ) : ( ...No catalog data... )}` ternary into `{driver.catalog && ( ... )}`).
  - Replace the final `LOOKUP` `<section>` (the one with the two hardcoded `<a>` tags) with:

```tsx
          <section className="space-y-2">
            <EyebrowLabel>FIND RELEASE NOTES</EyebrowLabel>
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </section>
```

- [ ] **Step 4: Run the drawer tests + typecheck.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/components/drivers/DriverDetailDrawer.test.tsx --pool=threads && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c "error TS"`
Expected: tests PASS; tsc error count unchanged (16).

- [ ] **Step 5: Commit.**

```bash
git add src/components/drivers/DriverDetailDrawer.tsx src/components/drivers/DriverDetailDrawer.test.tsx
git commit -m "feat(drivers): drawer shows structured data then always a release-notes link"
```

---

## Task 5: Bake the real catalog + verify in the app (orchestrator-run)

**Files:**
- Modify: `public/driver-catalog.json`, `public/driver-catalog.meta.json`

- [ ] **Step 1: Confirm the baked catalog from Task 0 Step 2 is real** (thousands of entries, not the stub). If Task 0 used the Electron-sync fallback, ensure `public/driver-catalog.json` holds that data.

- [ ] **Step 2: Run the app and verify** (use the `run` skill / Playwright). Sign in, open the Drivers page, open a Dell driver that the spike reported as a match: confirm the "Details from Dell catalog" section shows fixes/known-issues. Open any driver: confirm the "Find release notes" block always shows the Microsoft Update Catalog link. Confirm no "No catalog data" text appears anywhere.

- [ ] **Step 3: Commit the baked catalog.**

```bash
git add public/driver-catalog.json public/driver-catalog.meta.json
git commit -m "chore(drivers): bake real Dell driver catalog for the web build"
```

---

## Task 6: Finalize (orchestrator-run)

- [ ] **Step 1: Full suite, serial for stability.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run --no-file-parallelism`
Expected: all tests PASS.

- [ ] **Step 2: Typecheck.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c "error TS"`
Expected: 16 (unchanged baseline; no new errors).

- [ ] **Step 3: Merge to main and push.**

```bash
git checkout main && git merge feat/driver-changelog-enrichment --no-edit && git push && git branch -d feat/driver-changelog-enrichment
```

---

## Self-review notes
- Phase 0 spike gates matcher trust (spec §Dell matching). ✓
- Universal links for all drivers (spec §Universal link backbone) → Task 1. ✓
- Dell fuzzy match populating `Driver.catalog` (spec §resolver) → Tasks 2–3; also re-lights the table criticality badge + filter for free. ✓
- Drawer fallback chain, no dead end (spec §UI) → Task 4. ✓
- Both surfaces: web baked (Task 5), Electron sync (unchanged, already wired). ✓
- CI auto-bake intentionally deferred (spec Risks: `expand.exe` portability; no web-deploy pipeline exists) — v1 commits a locally-baked catalog. ✓
