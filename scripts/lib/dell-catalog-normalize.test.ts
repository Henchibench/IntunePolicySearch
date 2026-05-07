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
