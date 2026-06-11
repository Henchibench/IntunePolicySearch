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
