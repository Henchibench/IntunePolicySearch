import { Badge } from '@/components/ui/badge';
import type { IntuneObjectCategory } from '@/types/graph';
import { cn } from '@/lib/utils';

const LABELS: Record<IntuneObjectCategory, string> = {
  deviceConfiguration: 'Device Configuration',
  compliancePolicy: 'Compliance Policy',
  configurationPolicy: 'Settings Catalog',
  appProtection: 'App Protection',
  mobileApp: 'Application',
  appConfiguration: 'App Configuration',
  endpointSecurity: 'Endpoint Security',
  platformScript: 'Platform Script',
  remediationScript: 'Remediation Script',
  complianceScript: 'Compliance Script',
  autopilotProfile: 'Autopilot Profile',
  enrollmentConfig: 'Enrollment Config',
  updateRing: 'Update Ring',
};

const COLOR: Record<IntuneObjectCategory, string> = {
  deviceConfiguration: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  compliancePolicy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  configurationPolicy: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  appProtection: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  mobileApp: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  appConfiguration: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  endpointSecurity: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  platformScript: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  remediationScript: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  complianceScript: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  autopilotProfile: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  enrollmentConfig: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  updateRing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
};

export function categoryLabel(c: IntuneObjectCategory): string {
  return LABELS[c];
}

export function GroupTypeBadge({
  category,
  className,
}: {
  category: IntuneObjectCategory;
  className?: string;
}) {
  return (
    <Badge className={cn('font-medium', COLOR[category], className)} variant="secondary">
      {LABELS[category]}
    </Badge>
  );
}
