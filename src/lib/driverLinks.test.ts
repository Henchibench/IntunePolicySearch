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

  it('does not duplicate the version when the name already contains it', () => {
    const links = buildDriverLinks({ name: 'Dell, Inc. - Firmware - 0.1.27.0', version: '0.1.27.0', manufacturer: 'Dell, Inc.' });
    const mu = links.find((l) => l.label === 'Microsoft Update Catalog')!;
    expect(mu.url).toContain(encodeURIComponent('Dell, Inc. - Firmware - 0.1.27.0'));
    expect(mu.url).not.toContain(encodeURIComponent('0.1.27.0 0.1.27.0'));
  });

  it('returns only the Microsoft link for vendors without a known site', () => {
    const links = buildDriverLinks({ name: 'Realtek MEDIA', version: '6.0.9835.3', manufacturer: 'Realtek Semiconductor Corp.' });
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe('Microsoft Update Catalog');
  });
});
