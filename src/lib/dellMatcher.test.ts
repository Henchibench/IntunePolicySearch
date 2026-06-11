import { describe, it, expect } from 'vitest';
import { createDellMatcher } from './dellMatcher';
import type { CatalogEntry } from '@/types/drivers';

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
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
