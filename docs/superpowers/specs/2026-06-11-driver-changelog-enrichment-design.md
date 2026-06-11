# Driver changelog / "what it fixes" enrichment

**Date:** 2026-06-11
**Status:** Approved design, pre-plan
**Surfaces:** Web app (baked) + Electron desktop (live sync) — both first-class

## Problem

The Drivers page lists Windows Update for Business (WUfB) driver updates from
Intune, but Intune's `driverInventories` carries no changelog: only name,
version, manufacturer, class, release date. Users want to know **what a driver
fixes / changes** before approving it.

The existing "catalog" feature is scaffolding only:
- `public/driver-catalog.json` is a 1-entry stub — never populated. This is why
  the drawer shows "No catalog data" for every driver.
- The join from a driver to a `CatalogEntry` is an exact
  `manufacturer|driverClass|name` key. Intune's WUfB names
  (e.g. `Dell, Inc. Firmware Driver Update (0.1.38.2)`) never equal Dell's
  catalog component naming, so even a populated catalog would rarely match.
- The catalog source is Dell-only (`CatalogPC.cab`); the fleet also runs
  Intel/Realtek drivers Dell's catalog does not cover.

## Decisions (from brainstorming)

1. **Layered:** show structured data when we have it, always fall back to a
   precise link. No dead "No catalog data" end-state.
2. **Both surfaces equally:** shared data layer — Electron fetches live and
   caches; web consumes the build-time bake. Same `CatalogEntry`, one UI.
3. **Dell structured + universal links:** invest structured parsing in Dell
   (the OEM for this fleet, already scaffolded); every other driver gets a
   precise Microsoft Update Catalog / vendor link.

## Architecture

Most plumbing already exists (types, `fetch-driver-catalog.ts`,
`dell-catalog-normalize.ts`, Electron sync, baked-JSON loader, drawer
rendering). This work makes the plumbing carry data and fixes the join.

### Two data lanes (existing `CatalogSource` model, unchanged)
- **Web** → `public/driver-catalog.json`, baked at build time. A CI step runs
  `npm run fetch-catalog` so each deployed build ships a fresh Dell catalog.
- **Desktop** → `useDriverCatalog` prefers live Electron sync
  (`window.driverCatalog.getStatus/sync`), falls back to the baked JSON. Sync
  fetches `CatalogPC.cab` and caches it in userData.

### The resolver (the real fix)
Replace the exact-key lookup with a pure two-tier resolver:

```
resolveDriverEnrichment(driver, catalogIndex) -> {
  structured: CatalogEntry | null,   // Dell fuzzy match, or null
  links: DriverLink[]                // universal, always non-empty
}
```

1. **Structured:** best-effort Dell fuzzy match (see Matching).
2. **Links:** always computed from the driver's name/version/manufacturer,
   independent of any catalog match.

Both halves are pure functions — unit-testable without network or Graph. Dell
matching lives in one module so it can be extended/swapped without touching UI.

## Universal link backbone (reliable, 100% coverage)

Pure string building, no network:
- **Microsoft Update Catalog** (primary, every driver):
  `https://www.catalog.update.microsoft.com/Search.aspx?q=<name + version>`.
  Every WUfB driver has a Microsoft Update Catalog presence; the name+version
  query lands on or one click from the exact entry.
- **Vendor search** (secondary, by manufacturer family): Dell/Intel/Realtek/etc.
  support search URL.

Delivers the "links always" half on day one for all drivers.

## Dell structured matching (best-effort)

Exact-name matching is hopeless, so the resolver tries, in order:
1. Normalize manufacturer to a **family** (`Dell, Inc.`/`Dell Inc.` → `dell`).
2. Match on **driverClass + version** within that family.
3. Tie-break / confirm with **name-token overlap** between the Intune name and
   the Dell component name.
4. Attach structured data only on a confident match; otherwise fall through to
   links.

### Phase 0 — measurement spike (BEFORE building the full matcher)
Dell WUfB names are generic; Dell `CatalogPC.cab` uses specific component
names. Hit rate is unknown until measured.

Run `fetch-catalog` to get the real Dell catalog, run it against a snapshot of
the actual driver inventory, and print a hit-rate report (matched / ambiguous /
unmatched, with examples).
- **Decent hit rate** → build the matcher as designed.
- **Poor hit rate** → do not sink effort into a rarely-firing matcher; the
  universal links already carry the feature. Record Dell-structured as "needs a
  better key" (future hardware-ID join) rather than faking coverage.

This is a one-off diagnostic script, not a permanent test. It gates how much
matcher complexity is justified, so the feature ships value either way.

## UI (drawer CATALOG section)

Strict fallback chain, no dead end:
1. **Structured matched** → render fixes / known issues / criticality /
   supported models + a "Release notes" link (existing rendering, now actually
   fed).
2. **Always** → a "Find release notes" block with the Microsoft Update Catalog
   link (primary) and vendor search (secondary). Replaces today's bare "Lookup".

The contradictory "No catalog data" terminal state is removed.

## Testing

- **Link builder** (pure): correct URL + version encoding per vendor family;
  Microsoft Update Catalog link present for every driver.
- **Resolver / matcher** (pure): exact, fuzzy, ambiguous, and no-match cases;
  confident-match-only behavior.
- **Drawer** (render): three states — structured, links-only, loading.
- All tests run without network or Graph (catalog injected).
- Spike output is a report, not a committed test.

## Out of scope (YAGNI)
- Intel/Realtek/HP/Lenovo structured parsers (links only for now).
- Scraping Microsoft Update Catalog detail pages (Approach B) — thin content,
  brittle; revisit only if Dell hit rate is poor and richer data is wanted.
- LLM-assisted summaries (Approach C) — hallucinates changelog specifics.
- Direct (UpdateID-deep-link) Microsoft Update Catalog URLs — search URL is the
  reliable v1; direct links are a later refinement if an ID is obtainable.

## Risks
- **Dell hit rate** — primary risk, resolved by the Phase 0 spike before
  matcher investment.
- **`fetch-catalog` portability** — relies on Windows `expand.exe` for CAB
  extraction (reachable from WSL; ENOENT on pure Linux CI). The CI bake step
  must run on a runner where CAB extraction works, or use a cross-platform CAB
  extractor. Flagged for the plan.
