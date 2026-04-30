import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import type { PolicySetting } from '@/types/graph';
import { cn } from '@/lib/utils';

export interface PolicySettingsSectionProps {
  settings: PolicySetting[];
  isLoading: boolean;
  error: string | null;
}

export function PolicySettingsSection({
  settings,
  isLoading,
  error,
}: PolicySettingsSectionProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Could not load settings: {error}
      </p>
    );
  }

  if (settings.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No configurable settings found.
      </p>
    );
  }

  // Group by category
  const grouped = new Map<string, PolicySetting[]>();
  for (const s of settings) {
    const cat = s.category || 'General';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(s);
  }

  return (
    <div className="space-y-4">
      <EyebrowLabel>CONFIGURED SETTINGS</EyebrowLabel>
      {[...grouped.entries()].map(([category, items]) => (
        <SettingsGroup key={category} category={category} settings={items} />
      ))}
    </div>
  );
}

function SettingsGroup({
  category,
  settings,
}: {
  category: string;
  settings: PolicySetting[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-lifted overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-canvas transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {category}
        <span className="ml-auto tabular-nums text-muted-foreground/60">
          {settings.length}
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {settings.map((s, i) => (
            <div key={`${s.key}-${i}`} className="px-4 py-2.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium text-ink">{s.key}</span>
                <span className={cn(
                  'shrink-0 text-right',
                  s.value === 'Enabled' && 'text-emerald-700',
                  s.value === 'Disabled' && 'text-muted-foreground',
                  s.value !== 'Enabled' && s.value !== 'Disabled' && 'text-ink/80',
                )}>
                  {s.value}
                </span>
              </div>
              {s.description && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
