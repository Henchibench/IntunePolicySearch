import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Driver, DriverProfile } from '@/types/drivers';
import { DriverTable } from './DriverTable';

interface Props {
  profiles: DriverProfile[];
  drivers: Driver[];
  onDriverClick: (driver: Driver) => void;
}

interface PolicyGroup {
  profile: DriverProfile;
  drivers: Driver[];
  driversCount: number;
  needsReviewCount: number;
  applicableDevicesCount: number;
}

function pluralize(n: number, singular: string) {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

function buildGroups(profiles: DriverProfile[], drivers: Driver[]): PolicyGroup[] {
  const groups: PolicyGroup[] = profiles.map((p) => {
    const inProfile = drivers.filter((d) => d.policies.some((m) => m.profileId === p.id));
    const needsReview = inProfile.filter((d) =>
      d.policies.find((m) => m.profileId === p.id)?.approvalStatus === 'needsReview'
    );
    const applicable = inProfile.reduce((sum, d) => sum + d.applicableDeviceCount, 0);
    return {
      profile: p,
      drivers: inProfile,
      driversCount: inProfile.length,
      needsReviewCount: needsReview.length,
      applicableDevicesCount: applicable,
    };
  });
  return groups.sort((a, b) => b.needsReviewCount - a.needsReviewCount);
}

export function DriverByPolicy({ profiles, drivers, onDriverClick }: Props) {
  const groups = buildGroups(profiles, drivers);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = expanded.has(g.profile.id);
        const summary = `${pluralize(g.driversCount, 'driver')} · ${g.needsReviewCount} needs review · ${g.applicableDevicesCount} devices applicable`;
        return (
          <div key={g.profile.id} className="rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => toggle(g.profile.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
              aria-label={g.profile.displayName}
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium text-ink">{g.profile.displayName}</span>
                <Badge variant="outline">{g.profile.approvalType === 'manual' ? 'Manual' : 'Automatic'}</Badge>
              </div>
              <span className="text-xs text-slate">{summary}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border p-2">
                <DriverTable drivers={g.drivers} onDriverClick={onDriverClick} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
