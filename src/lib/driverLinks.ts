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
  // Intune driver names usually already embed the version (e.g.
  // "Dell, Inc. - Firmware - 0.1.27.0"); only append it when it's missing so
  // the search query doesn't carry a duplicate version token.
  const query = driver.name.includes(driver.version)
    ? driver.name.trim()
    : `${driver.name} ${driver.version}`.trim();
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
