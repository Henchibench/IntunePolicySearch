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

// Fluent 2 uses neutral tints for taxonomy badges — color is reserved for
// action/selection/status, not category labeling. All categories share one
// subtle neutral badge treatment (Surface 3 fill, Foreground 2 text).
const BADGE_CLASS =
  'border-transparent bg-muted text-muted-foreground';

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
    <Badge
      className={cn('rounded-md', BADGE_CLASS, className)}
      variant="secondary"
    >
      {LABELS[category]}
    </Badge>
  );
}
