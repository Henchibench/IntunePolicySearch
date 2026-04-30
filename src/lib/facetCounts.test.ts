import { describe, it, expect } from 'vitest';
import { computeFacetCounts, applyAllFilters, type FilterState } from './facetCounts';
import type { GroupAssignmentResult } from '@/types/graph';

const emptyFilters: FilterState = {
  category: [],
  platform: [],
  appType: [],
  intent: [],
};

const rows: GroupAssignmentResult[] = [
  { id: '1', category: 'mobileApp', name: 'Outlook', platform: 'iOS', appType: 'iOS Store', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '2', category: 'mobileApp', name: 'Teams iOS', platform: 'iOS', appType: 'iOS Store', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '3', category: 'mobileApp', name: 'Acme Win32', platform: 'Windows', appType: 'Win32', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '4', category: 'compliancePolicy', name: 'WinComp', platform: 'Windows', intent: 'include', source: { kind: 'direct' }, rawObject: {} },
  { id: '5', category: 'mobileApp', name: 'BadApp', platform: 'Android', appType: 'Android Store', intent: 'exclude', source: { kind: 'direct' }, rawObject: {} },
];

describe('computeFacetCounts', () => {
  it('returns counts grouped by dimension when no filters are set', () => {
    const counts = computeFacetCounts(rows, emptyFilters, 'platform');
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(2);
    expect(counts.get('Android')).toBe(1);
  });

  it('excludes its own dimension from the active filter set', () => {
    const counts = computeFacetCounts(
      rows,
      { ...emptyFilters, platform: ['iOS'] },
      'platform',
    );
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(2);
    expect(counts.get('Android')).toBe(1);
  });

  it('applies other dimensions when computing a facet', () => {
    const counts = computeFacetCounts(
      rows,
      { ...emptyFilters, category: ['mobileApp'] },
      'platform',
    );
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(1);
    expect(counts.get('Android')).toBe(1);
  });

  it('combines multiple non-self filters', () => {
    const counts = computeFacetCounts(
      rows,
      { ...emptyFilters, category: ['mobileApp'], intent: ['include'] },
      'platform',
    );
    expect(counts.get('iOS')).toBe(2);
    expect(counts.get('Windows')).toBe(1);
    expect(counts.get('Android')).toBeUndefined();
  });

  it('skips rows where the requested dimension is undefined', () => {
    const counts = computeFacetCounts(rows, emptyFilters, 'appType');
    expect(counts.has('iOS Store')).toBe(true);
    expect(counts.has(undefined as unknown as string)).toBe(false);
    expect(counts.size).toBe(3);
  });

  it('returns an empty map when row set is empty', () => {
    expect(computeFacetCounts([], emptyFilters, 'category').size).toBe(0);
  });
});

describe('applyAllFilters', () => {
  it('returns every row when no filters are set', () => {
    expect(applyAllFilters(rows, emptyFilters)).toHaveLength(rows.length);
  });

  it('narrows by a single dimension', () => {
    const out = applyAllFilters(rows, { ...emptyFilters, platform: ['iOS'] });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.platform === 'iOS')).toBe(true);
  });

  it('AND-combines multiple dimensions', () => {
    const out = applyAllFilters(rows, {
      ...emptyFilters,
      category: ['mobileApp'],
      intent: ['include'],
    });
    expect(out.map((r) => r.id).sort()).toEqual(['1', '2', '3']);
  });

  it('drops rows missing a filtered dimension value', () => {
    // row 4 (compliancePolicy) has no appType — must be dropped when appType filter is set.
    const out = applyAllFilters(rows, { ...emptyFilters, appType: ['Win32'] });
    expect(out.map((r) => r.id)).toEqual(['3']);
  });
});
