import { describe, it, expect } from 'vitest';
import { buildAuditFilter } from './useAuditEvents';

describe('buildAuditFilter', () => {
  it('builds date-only filter when no categories selected', () => {
    const from = new Date('2026-04-24T00:00:00Z');
    const to = new Date('2026-05-01T00:00:00Z');
    const result = buildAuditFilter(from, to, []);
    expect(result).toBe(
      "activityDateTime gt 2026-04-24T00:00:00.000Z and activityDateTime lt 2026-05-01T23:59:59.999Z"
    );
  });

  it('appends single category filter', () => {
    const from = new Date('2026-04-24T00:00:00Z');
    const to = new Date('2026-05-01T00:00:00Z');
    const result = buildAuditFilter(from, to, ['Compliance']);
    expect(result).toContain("and (category eq 'Compliance')");
  });

  it('chains multiple categories with or', () => {
    const from = new Date('2026-04-24T00:00:00Z');
    const to = new Date('2026-05-01T00:00:00Z');
    const result = buildAuditFilter(from, to, ['Compliance', 'Configuration']);
    expect(result).toContain("and (category eq 'Compliance' or category eq 'Configuration')");
  });
});
